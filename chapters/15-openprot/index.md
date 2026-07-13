---
layout: chapter
title: "OpenPRoT"
chapter: 15
progress: 94
prev: /chapters/14-caliptra/
next: /chapters/16-portfolio/
---

# OpenPRoT

{% include callout.html type="info" title="Why this matters for 9elements" content="OpenPRoT (Open Protocol Runtime) is a platform firmware framework that integrates Caliptra with Hubris RTOS. 9elements contributes to OpenPRoT's development, particularly in HAL layer implementation and firmware protocol support. Understanding OpenPRoT is essential for building production firmware on modern platforms." %}

## What is OpenPRoT?

OpenPRoT is an open-source platform firmware framework that provides:

- **Hubris RTOS Integration** — Secure task isolation and IPC
- **Caliptra Integration** — Root of Trust and attestation
- **HAL Layer** — Hardware abstraction for platform independence
- **Protocol Stack** — MCTP, SPDM, PLDM implementations
- **Bazel Build** — Reproducible, hermetic builds

### Project Goals

| Goal | Description |
|------|-------------|
| **Security** | Memory-safe Rust with task isolation |
| **Portability** | Hardware-agnostic HAL layer |
| **Standards** | DMTF protocol compliance |
| **Open Source** | Apache 2.0, community-driven |
| **Production Ready** | Used in real products |

## Hubris RTOS

Hubris is a real-time operating system designed for safety-critical embedded systems. It provides strong isolation between tasks.

### Hubris Task Model

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Hubris Kernel                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Task 1: Caliptra Service                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Handles attestation requests                         │    │
│  │  • Manages DICE certificate chain                       │    │
│  │  • Owns Caliptra mailbox driver                         │    │
│  │  Stack: 8KB                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Task 2: MCTP Transport                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Sends/receives MCTP messages                         │    │
│  │  • Handles SMBus/I2C communication                      │    │
│  │  • Manages endpoint discovery                           │    │
│  │  Stack: 4KB                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Task 3: SPDM Responder                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Processes SPDM requests                              │    │
│  │  • Handles authentication and key exchange              │    │
│  │  • Manages secure sessions                              │    │
│  │  Stack: 8KB                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Task 4: PLDM Handler                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Processes PLDM commands                              │    │
│  │  • Handles firmware updates                             │    │
│  │  • Manages platform data                                │    │
│  │  Stack: 4KB                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Task 5: Watchdog                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Monitors task health                                 │    │
│  │  • Resets on hang                                       │    │
│  │  • Logs system events                                   │    │
│  │  Stack: 2KB                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Task Isolation

```rust
// Each task runs in its own memory space
// Tasks communicate only through IPC

// Task 1: Caliptra Service
#[main]
fn caliptra_service_main(mut sender: Sender<CaliptraRequest>) {
    let mut caliptra = CaliptraService::new();

    loop {
        // Receive request from another task
        let (response_channel, request) = sender.recv();

        match request {
            CaliptraRequest::GetAttestation { nonce } => {
                let report = caliptra.attest(&nonce);
                response_channel.send(report).ok();
            }
            CaliptraRequest::GetMeasurements => {
                let measurements = caliptra.get_measurements();
                response_channel.send(measurements).ok();
            }
        }
    }
}

// Task 2: SPDM Responder
#[main]
fn spdm_responder_main(mut sender: Sender<SpdmRequest>) {
    let mut spdm = SpdmResponder::new();
    let caliptra_client = CaliptraClient::new();

    loop {
        let (response_channel, request) = sender.recv();

        match request {
            SpdmRequest::Challenge { nonce } => {
                // Delegate attestation to Caliptra task
                let attestation = caliptra_client
                    .get_attestation(nonce.clone())
                    .unwrap();

                let response = spdm.handle_challenge(&nonce, &attestation);
                response_channel.send(response).ok();
            }
        }
    }
}
```

### IPC (Inter-Process Communication)

```rust
// IPC message definitions
#[derive(Serialize, Deserialize)]
enum CaliptraRequest {
    GetAttestation { nonce: [u8; 32] },
    GetMeasurements,
    LoadFirmware { firmware: Vec<u8> },
    GetCertificateChain,
}

#[derive(Serialize, Deserialize)]
enum CaliptraResponse {
    Attestation(AttestationReport),
    Measurements(CaliptraMeasurements),
    FirmwareLoadResult(Result<(), FirmwareError>),
    CertificateChain(Vec<u8>),
}

// Client implementation
struct CaliptraClient {
    task_id: TaskId,
}

impl CaliptraClient {
    fn get_attestation(&self, nonce: [u8; 32]) -> Result<AttestationReport, IpcError> {
        let request = CaliptraRequest::GetAttestation { nonce };
        let response: CaliptraResponse = self.task_id.call(request)?;
        
        match response {
            CaliptraResponse::Attestation(report) => Ok(report),
            _ => Err(IpcError::UnexpectedResponse),
        }
    }
}
```

## HAL Layer

The HAL (Hardware Abstraction Layer) provides platform-independent interfaces for hardware operations.

### HAL Traits

```rust
// Core HAL traits
pub trait Flash {
    type Error;

    fn read(&mut self, offset: u32, buffer: &mut [u8]) -> Result<(), Self::Error>;
    fn write(&mut self, offset: u32, data: &[u8]) -> Result<(), Self::Error>;
    fn erase(&mut self, sector: u32) -> Result<(), Self::Error>;
    fn size(&self) -> u32;
}

pub trait Timer {
    type Error;

    fn start(&mut self) -> Result<(), Self::Error>;
    fn stop(&mut self) -> Result<(), Self::Error>;
    fn get_elapsed_ms(&self) -> u32;
    fn delay_ms(&mut self, ms: u32) -> Result<(), Self::Error>;
}

pub trait Crypto {
    type Error;

    fn sha256(&mut self, data: &[u8]) -> Result<[u8; 32], Self::Error>;
    fn hmac_sha256(&mut self, key: &[u8], data: &[u8]) -> Result<[u8; 32], Self::Error>;
    fn ecdsa_sign(&mut self, key: &[u8; 32], data: &[u8]) -> Result<[u8; 64], Self::Error>;
    fn ecdsa_verify(&mut self, pubkey: &[u8; 64], data: &[u8], sig: &[u8; 64]) -> Result<bool, Self::Error>;
}

pub trait I2c {
    type Error;

    fn write(&mut self, addr: u8, data: &[u8]) -> Result<(), Self::Error>;
    fn read(&mut self, addr: u8, buffer: &mut [u8]) -> Result<(), Self::Error>;
    fn write_read(&mut self, addr: u8, write: &[u8], read: &mut [u8]) -> Result<(), Self::Error>;
}
```

### Platform-Specific Implementation

```rust
// FPGA implementation
#[cfg(feature = "fpga")]
pub mod fpga {
    use super::*;

    pub struct FpgaFlash {
        base: usize,
    }

    impl Flash for FpgaFlash {
        type Error = FpgaError;

        fn read(&mut self, offset: u32, buffer: &mut [u8]) -> Result<(), FpgaError> {
            for (i, byte) in buffer.iter_mut().enumerate() {
                let addr = self.base + (offset as usize) + i;
                *byte = unsafe { core::ptr::read_volatile(addr as *const u8) };
            }
            Ok(())
        }

        fn write(&mut self, offset: u32, data: &[u8]) -> Result<(), FpgaError> {
            for (i, &byte) in data.iter().enumerate() {
                let addr = self.base + (offset as usize) + i;
                unsafe { core::ptr::write_volatile(addr as *mut u8, byte) };
            }
            Ok(())
        }

        fn erase(&mut self, sector: u32) -> Result<(), FpgaError> {
            // FPGA flash erase implementation
            Ok(())
        }

        fn size(&self) -> u32 {
            4 * 1024 * 1024 // 4MB
        }
    }
}

// ASIC implementation
#[cfg(feature = "asic")]
pub mod asic {
    use super::*;

    pub struct AsicFlash {
        controller: FlashController,
    }

    impl Flash for AsicFlash {
        type Error = AsicError;

        fn read(&mut self, offset: u32, buffer: &mut [u8]) -> Result<(), AsicError> {
            self.controller.read(offset, buffer)?;
            Ok(())
        }

        fn write(&mut self, offset: u32, data: &[u8]) -> Result<(), AsicError> {
            self.controller.program(offset, data)?;
            Ok(())
        }

        fn erase(&mut self, sector: u32) -> Result<(), AsicError> {
            self.controller.sector_erase(sector)?;
            Ok(())
        }

        fn size(&self) -> u32 {
            self.controller.get_capacity()
        }
    }
}
```

## Bazel Build System

OpenPRoT uses Bazel for reproducible, hermetic builds.

### MODULE.bazel

```python
module(
    name = "openprot",
    version = "1.0.0",
    compatibility_level = 1,
)

# Rust rules
bazel_dep(name = "rules_rust", version = "0.34.1")

# Caliptra dependency
bazel_dep(name = "caliptra-sw", version = "1.0.0")

# Hubris RTOS
bazel_dep(name = "hubris", version = "0.1.0")
```

### BUILD.bazel (OpenPRoT Runtime)

```python
load("@rules_rust//rust:defs.bzl", "rust_binary", "rust_library")

rust_library(
    name = "openprot_runtime",
    srcs = glob(["src/**/*.rs"]),
    deps = [
        "//lib:caliptra",
        "//lib:mctp",
        "//lib:spdm",
        "//lib:pldm",
        "@hubris//:hubris_rt",
    ],
    crate_features = ["runtime"],
)

rust_binary(
    name = "openprot_image",
    srcs = ["build.rs"],
    deps = [
        ":openprot_runtime",
        "//tools:caliptra-image-builder",
    ],
)

# Task definitions
rust_binary(
    name = "caliptra_task",
    srcs = ["tasks/caliptra.rs"],
    deps = [
        ":openprot_runtime",
        "@hubris//:task",
    ],
)

rust_binary(
    name = "spdm_task",
    srcs = ["tasks/spdm.rs"],
    deps = [
        ":openprot_runtime",
        "@hubris//:task",
    ],
)
```

### BUILD.bazel (Tests)

```python
rust_test(
    name = "unit_tests",
    srcs = ["tests/unit.rs"],
    deps = [
        ":openprot_runtime",
    ],
)

rust_test(
    name = "integration_tests",
    srcs = ["tests/integration.rs"],
    deps = [
        ":openprot_runtime",
        "//testutils:emulator",
    ],
)

# Presubmit checks
test_suite(
    name = "presubmit",
    tests = [
        ":unit_tests",
        ":integration_tests",
        "//lint:check",
        "//fmt:check",
    ],
)
```

## Presubmit Checks

OpenPRoT requires several checks before merging:

```bash
# Run all presubmit checks
bazel test //:presubmit

# Individual checks
bazel test //lint:check        # Clippy lints
bazel test //fmt:check         # rustfmt check
bazel test //tests:unit        # Unit tests
bazel test //tests:integration # Integration tests
```

### CI Configuration

```yaml
# .github/workflows/presubmit.yml
name: Presubmit

on:
  pull_request:
    branches: [main]

jobs:
  presubmit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Bazel
        uses: bazelbuild/setup-bazelisk@v2
      
      - name: Run presubmit checks
        run: bazel test //:presubmit
      
      - name: Run security audit
        run: |
          cargo install cargo-deny
          cargo deny check
```

## Contributing Workflow

### Step 1: Set Up Development Environment

```bash
# Clone OpenPRoT
git clone https://github.com/chipsalliance/openprot.git
cd openprot

# Install dependencies
./scripts/setup.sh

# Verify build
bazel build //...
```

### Step 2: Create Feature Branch

```bash
git checkout -b feature/my-feature
```

### Step 3: Make Changes

```rust
// Example: Add new MCTP command handler
impl MctpHandler {
    fn handle_vendor_command(
        &mut self,
        request: &VendorRequest,
    ) -> Result<VendorResponse, MctpError> {
        // New command implementation
        match request.command_code {
            VENDOR_CMD_GET_INFO => self.get_vendor_info(),
            VENDOR_CMD_SET_CONFIG => self.set_config(&request.data),
            _ => Err(MctpError::UnsupportedCommand),
        }
    }
}
```

### Step 4: Write Tests

```rust
#[test]
fn test_vendor_command_get_info() {
    let mut handler = MctpHandler::new();
    let request = VendorRequest {
        command_code: VENDOR_CMD_GET_INFO,
        data: vec![],
    };

    let response = handler.handle_vendor_command(&request).unwrap();
    assert_eq!(response.completion_code, 0x00);
    assert!(!response.data.is_empty());
}
```

### Step 5: Run Checks

```bash
bazel test //:presubmit
```

### Step 6: Submit Pull Request

```bash
git add .
git commit -m "feat: add vendor command handler"
git push origin feature/my-feature
# Create PR on GitHub
```

## 9elements' Role in OpenPRoT

### Key Contributions

- **HAL Implementation** — Platform-specific hardware drivers
- **MCTP Stack** — Transport layer implementation
- **Testing** — Comprehensive test suites and emulators
- **Documentation** — API documentation and guides
- **Code Review** — Security-focused review process

### Recent Work

- **FPGA Emulation Support** — Hardware-in-the-loop testing
- **SPDM Integration** — Secure authentication support
- **Performance Optimization** — Reducing boot time
- **Security Hardening** — Vulnerability mitigations

{% include callout.html type="info" title="Contribute to OpenPRoT" content="OpenPRoT is actively seeking contributors. Visit https://github.com/chipsalliance/openprot to get started. Join the CHIPS Alliance working groups to participate in design discussions." %}

<details>
<summary>Advanced: Custom Hubris Tasks</summary>

### Creating a Custom Task

```rust
// tasks/custom_service.rs
#![no_std]
#![no_main]

use hubris_task::prelude::*;
use openprot_lib::{CustomRequest, CustomResponse};

#[main]
fn main(mut sender: Sender<CustomRequest>) -> ! {
    let mut service = CustomService::new();

    loop {
        let (response_channel, request) = sender.recv();

        match request {
            CustomRequest::ProcessData { data } => {
                let result = service.process(&data);
                response_channel.send(CustomResponse::Processed(result)).ok();
            }
            CustomRequest::GetStatus => {
                let status = service.status();
                response_channel.send(CustomResponse::Status(status)).ok();
            }
        }
    }
}

struct CustomService {
    state: ServiceState,
}

impl CustomService {
    fn new() -> Self {
        CustomService {
            state: ServiceState::Ready,
        }
    }

    fn process(&mut self, data: &[u8]) -> Vec<u8> {
        // Process data using allocated buffers
        data.iter().map(|&b| b.wrapping_add(1)).collect()
    }

    fn status(&self) -> ServiceStatus {
        ServiceStatus {
            state: self.state.clone(),
            uptime: get_uptime_ms(),
        }
    }
}
```

### Hubris Configuration (task-diagram.toml)

```toml
[tasks.caliptra]
name = "Caliptra Service"
stack_size = 8192
uses = ["caliptra_mailbox"]
notifications = ["caliptra_irq"]

[tasks.spdm]
name = "SPDM Responder"
stack_size = 8192
uses = ["mctp_smbus"]
notifications = ["mctp_irq"]

[tasks.mctp]
name = "MCTP Transport"
stack_size = 4096
uses = ["i2c_bus"]
notifications = ["i2c_irq"]

[uses.caliptra_mailbox]
base = 0x3000_0000
size = 0x1000

[uses.mctp_smbus]
base = 0x4000_0000
size = 0x1000

[uses.i2c_bus]
base = 0x4001_0000
size = 0x1000
```

</details>

## Quiz

<div class="quiz" data-answer="Hubris provides memory isolation between tasks, preventing one task from accessing another's memory space">
<strong>Q1:</strong> What security feature does Hubris provide for OpenPRoT tasks?

<details>
<summary>Answer</summary>
Hubris provides memory isolation between tasks, preventing one task from accessing another's memory space. Each task runs in its own address space and can only communicate through defined IPC mechanisms.
</details>
</div>

<div class="quiz" data-answer="Bazel provides reproducible, hermetic builds with dependency management and caching">
<strong>Q2:</strong> Why does OpenPRoT use Bazel instead of Cargo for builds?

<details>
<summary>Answer</summary>
Bazel provides reproducible, hermetic builds with dependency management and caching. It ensures that builds are identical regardless of the development environment and supports complex multi-language projects.
</details>
</div>

<div class="quiz" data-answer="The HAL layer provides platform-independent interfaces for hardware, allowing the same code to run on different FPGA or ASIC implementations">
<strong>Q3:</strong> What is the purpose of the HAL layer in OpenPRoT?

<details>
<summary>Answer</summary>
The HAL layer provides platform-independent interfaces for hardware, allowing the same code to run on different FPGA or ASIC implementations. This makes OpenPRoT portable across different hardware platforms.
</details>
</div>

## Exercises

<div class="exercise">
<h3>Exercise 1: Hubris Task</h3>
<p>Create a Hubris task that monitors system temperature and triggers alerts when thresholds are exceeded.</p>

<details>
<summary>Solution</summary>

```rust
#![no_std]
#![no_main]

use hubris_task::prelude::*;
use openprot_lib::{TemperatureAlert, TemperatureReading};

#[main]
fn main(mut sender: Sender<TemperatureRequest>) -> ! {
    let mut monitor = TemperatureMonitor::new();
    let mut alert_client = AlertClient::new();

    loop {
        let (response_channel, request) = sender.recv();

        match request {
            TemperatureRequest::GetReading => {
                let reading = monitor.read_temperature();
                response_channel.send(TemperatureResponse::Reading(reading)).ok();
            }
            TemperatureRequest::SetThreshold { high, low } => {
                monitor.set_thresholds(high, low);
                response_channel.send(TemperatureResponse::ThresholdsSet).ok();
            }
            TemperatureRequest::CheckAlerts => {
                let reading = monitor.read_temperature();
                if monitor.should_alert(&reading) {
                    alert_client.send_alert(TemperatureAlert {
                        temperature: reading.value,
                        threshold: monitor.get_threshold(),
                        timestamp: get_uptime_ms(),
                    });
                }
                response_channel.send(TemperatureResponse::Checked).ok();
            }
        }
    }
}

struct TemperatureMonitor {
    high_threshold: i32,
    low_threshold: i32,
    sensor: TemperatureSensor,
}

impl TemperatureMonitor {
    fn new() -> Self {
        TemperatureMonitor {
            high_threshold: 85,  // 85°C
            low_threshold: 0,    // 0°C
            sensor: TemperatureSensor::new(),
        }
    }

    fn read_temperature(&self) -> TemperatureReading {
        let raw = self.sensor.read();
        TemperatureReading {
            value: self.convert_to_celsius(raw),
            timestamp: get_uptime_ms(),
        }
    }

    fn set_thresholds(&mut self, high: i32, low: i32) {
        self.high_threshold = high;
        self.low_threshold = low;
    }

    fn should_alert(&self, reading: &TemperatureReading) -> bool {
        reading.value > self.high_threshold || reading.value < self.low_threshold
    }

    fn convert_to_celsius(&self, raw: u16) -> i32 {
        ((raw as i32) * 3300 / 4096 - 50) / 10
    }
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 2: HAL Implementation</h3>
<p>Implement the Flash trait for a simulated flash device that stores data in RAM.</p>

<details>
<summary>Solution</summary>

```rust
pub struct SimulatedFlash {
    data: Vec<u8>,
    sector_size: usize,
    erased_sectors: HashSet<usize>,
}

impl SimulatedFlash {
    pub fn new(size: usize, sector_size: usize) -> Self {
        SimulatedFlash {
            data: vec![0xFF; size],
            sector_size,
            erased_sectors: HashSet::new(),
        }
    }

    fn sector_of(&self, offset: u32) -> usize {
        offset as usize / self.sector_size
    }
}

impl Flash for SimulatedFlash {
    type Error = SimulatedError;

    fn read(&mut self, offset: u32, buffer: &mut [u8]) -> Result<(), SimulatedError> {
        let start = offset as usize;
        if start + buffer.len() > self.data.len() {
            return Err(SimulatedError::OutOfBounds);
        }

        buffer.copy_from_slice(&self.data[start..start + buffer.len()]);
        Ok(())
    }

    fn write(&mut self, offset: u32, data: &[u8]) -> Result<(), SimulatedError> {
        let start = offset as usize;
        if start + data.len() > self.data.len() {
            return Err(SimulatedError::OutOfBounds);
        }

        // Check if sector is erased (all 0xFF)
        let sector = self.sector_of(offset);
        if !self.erased_sectors.contains(&sector) {
            return Err(SimulatedError::SectorNotErased);
        }

        // Write data
        self.data[start..start + data.len()].copy_from_slice(data);
        Ok(())
    }

    fn erase(&mut self, sector: u32) -> Result<(), SimulatedError> {
        let sector = sector as usize;
        let start = sector * self.sector_size;
        let end = start + self.sector_size;

        if end > self.data.len() {
            return Err(SimulatedError::OutOfBounds);
        }

        // Fill sector with 0xFF
        self.data[start..end].fill(0xFF);
        self.erased_sectors.insert(sector);
        Ok(())
    }

    fn size(&self) -> u32 {
        self.data.len() as u32
    }
}

#[test]
fn test_simulated_flash() {
    let mut flash = SimulatedFlash::new(1024, 64);

    // Erase sector 0
    flash.erase(0).unwrap();

    // Write data
    let data = b"Hello, Flash!";
    flash.write(0, data).unwrap();

    // Read back
    let mut buffer = [0u8; 13];
    flash.read(0, &mut buffer).unwrap();
    assert_eq!(&buffer, data);
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 3: IPC Messages</h3>
<p>Design a complete IPC message protocol for firmware update operations between tasks.</p>

<details>
<summary>Solution</summary>

```rust
// Firmware update IPC protocol
#[derive(Serialize, Deserialize, Debug)]
enum FirmwareUpdateRequest {
    // Start a new firmware update
    BeginUpdate {
        firmware_size: u32,
        firmware_hash: [u8; 32],
        version: FirmwareVersion,
    },

    // Transfer firmware data chunk
    TransferChunk {
        chunk_id: u32,
        offset: u32,
        data: Vec<u8>,
    },

    // Finalize the update
    FinalizeUpdate {
        signature: [u8; 64],
    },

    // Abort the update
    AbortUpdate,

    // Get update status
    GetStatus,

    // Get current firmware version
    GetCurrentVersion,
}

#[derive(Serialize, Deserialize, Debug)]
enum FirmwareUpdateResponse {
    UpdateAccepted {
        update_id: u32,
    },

    ChunkAccepted {
        chunk_id: u32,
        bytes_received: u32,
    },

    UpdateFinalized {
        success: bool,
        error: Option<String>,
    },

    UpdateAborted,

    Status {
        state: UpdateState,
        progress: f32,
        error: Option<String>,
    },

    Version {
        version: FirmwareVersion,
        hash: [u8; 32],
    },
}

#[derive(Serialize, Deserialize, Debug)]
enum UpdateState {
    Idle,
    InProgress {
        chunks_received: u32,
        total_chunks: u32,
    },
    Verifying,
    Applying,
    Complete,
    Failed {
        reason: String,
    },
}

// Update manager task
#[main]
fn firmware_update_main(mut sender: Sender<FirmwareUpdateRequest>) -> ! {
    let mut update_manager = FirmwareUpdateManager::new();

    loop {
        let (response_channel, request) = sender.recv();

        match request {
            FirmwareUpdateRequest::BeginUpdate { firmware_size, firmware_hash, version } => {
                let update_id = update_manager.begin_update(firmware_size, firmware_hash, version);
                response_channel.send(FirmwareUpdateResponse::UpdateAccepted { update_id }).ok();
            }
            FirmwareUpdateRequest::TransferChunk { chunk_id, offset, data } => {
                match update_manager.transfer_chunk(chunk_id, offset, &data) {
                    Ok(bytes_received) => {
                        response_channel.send(FirmwareUpdateResponse::ChunkAccepted { chunk_id, bytes_received }).ok();
                    }
                    Err(e) => {
                        response_channel.send(FirmwareUpdateResponse::Status {
                            state: UpdateState::Failed { reason: e.to_string() },
                            progress: 0.0,
                            error: Some(e.to_string()),
                        }).ok();
                    }
                }
            }
            FirmwareUpdateRequest::FinalizeUpdate { signature } => {
                let result = update_manager.finalize(signature);
                response_channel.send(FirmwareUpdateResponse::UpdateFinalized {
                    success: result.is_ok(),
                    error: result.err().map(|e| e.to_string()),
                }).ok();
            }
            FirmwareUpdateRequest::AbortUpdate => {
                update_manager.abort();
                response_channel.send(FirmwareUpdateResponse::UpdateAborted).ok();
            }
            FirmwareUpdateRequest::GetStatus => {
                let (state, progress) = update_manager.status();
                response_channel.send(FirmwareUpdateResponse::Status { state, progress, error: None }).ok();
            }
            FirmwareUpdateRequest::GetCurrentVersion => {
                let version = update_manager.get_current_version();
                response_channel.send(FirmwareUpdateResponse::Version { version: version.0, hash: version.1 }).ok();
            }
        }
    }
}
```

</details>
</div>

## Summary

In this chapter, you learned:

- **OpenPRoT** integrates Caliptra with Hubris RTOS for platform firmware
- **Hubris** provides memory isolation between firmware tasks
- **IPC** enables secure communication between tasks
- **HAL Layer** abstracts hardware for platform independence
- **Bazel** provides reproducible, hermetic builds
- **Presubmit checks** ensure code quality before merging
- **Contributing** follows the fork-PR-review workflow

In the final chapter, we'll create portfolio projects that demonstrate your Rust firmware skills to employers.

<div class="chapter-nav">
<a href="{{ page.prev }}" class="btn">← Previous: Caliptra</a>
<a href="{{ page.next }}" class="btn">Next: Portfolio Projects →</a>
</div>
