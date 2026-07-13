---
layout: chapter
title: "Caliptra"
chapter: 14
progress: 87
prev: /chapters/13-spdm-dice/
next: /chapters/15-openprot/
---

# Caliptra

{% include callout.html type="info" title="Why this matters for 9elements" content="Caliptra is an Open Source Root of Trust (RoT) project co-developed by 9elements with Google, AMD, NVIDIA, Microsoft, and other industry leaders. Understanding Caliptra's architecture, boot flow, and attestation mechanisms is essential for contributing to this critical security infrastructure." %}

## What is Caliptra?

Caliptra is an Open Source Root of Trust (RoT) for compute platforms. It provides:

- **Hardware Root of Trust** — immutable ROM with device-unique secrets
- **DICE-based attestation** — measured boot with certificate chains
- **Firmware integrity** — secure boot with anti-rollback protection
- **Mailbox interface** — standardized API for host communication
- **SPDM support** — secure device authentication

### Key Features

| Feature | Description |
|---------|-------------|
| **Open Source** | Apache 2.0 license, auditable code |
| **Standards Compliant** | DICE, SPDM, MCTP, TCG specifications |
| **Language** | Written in Rust for memory safety |
| **Hardware Agnostic** | FPGA and ASIC implementations |
| **Production Ready** | Used in Google, AMD, and NVIDIA products |

## Architecture

### Caliptra System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Host System                               │
│                    (CPU, BMC, or SoC)                            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                │ Mailbox Interface
                                │ (MMIO or SPI)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Caliptra IP Block                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Caliptra ROM                          │    │
│  │  (Immutable, burned into silicon)                       │    │
│  │  • Boot validation                                      │    │
│  │  • Hardware secret derivation                           │    │
│  │  • Anti-rollback enforcement                            │    │
│  │  • FMC code verification                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                │                                 │
│                                ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    FMC (First Mutable Code)              │    │
│  │  • DICE layer 1                                         │    │
│  │  • Runtime verification                                 │    │
│  │  • Certificate generation                               │    │
│  │  • Mailbox command processing                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                │                                 │
│                                ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Runtime Firmware                      │    │
│  │  • SPDM responder                                       │    │
│  │  • Attestation services                                 │    │
│  │  • Key management                                       │    │
│  │  • Self-test and health monitoring                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Hardware Security Module               │    │
│  │  • Device-unique secrets (UDS)                           │    │
│  │  • True Random Number Generator (TRNG)                   │    │
│  │  • Cryptographic accelerators                            │    │
│  │  • Tamper detection                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## ROM/FMC/Runtime Boot Chain

### Boot Sequence

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Power On / Reset                               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ROM Stage                                      │
├─────────────────────────────────────────────────────────────────┤
│  1. Initialize hardware                                          │
│  2. Derive UDS (Device Unique Secret)                           │
│  3. Derive CDI_0 = HMAC(UDS, "caliptra-rom")                    │
│  4. Load FMC from flash                                          │
│  5. Verify FMC signature (against burned public key)            │
│  6. Measure FMC code hash → extend PCR[0]                       │
│  7. Derive CDI_1 = HMAC(CDI_0, FMC_measurement || tcb_info)     │
│  8. Jump to FMC entry point                                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FMC Stage                                      │
├─────────────────────────────────────────────────────────────────┤
│  1. Initialize FMC runtime                                       │
│  2. Generate FMC certificate (signed by CDI_1 key)              │
│  3. Store certificate in certificate store                      │
│  4. Load Runtime from flash                                      │
│  5. Verify Runtime signature                                     │
│  6. Measure Runtime code hash → extend PCR[1]                   │
│  7. Derive CDI_2 = HMAC(CDI_1, Runtime_measurement)             │
│  8. Initialize mailbox interface                                 │
│  9. Jump to Runtime entry point                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Runtime Stage                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. Initialize all services                                      │
│  2. Generate Runtime certificate (signed by CDI_2 key)          │
│  3. Start SPDM responder                                         │
│  4. Process mailbox commands                                     │
│  5. Handle attestation requests                                  │
│  6. Monitor for tampering                                        │
│  7. Self-test and health checks                                 │
└─────────────────────────────────────────────────────────────────┘
```

### DICE in Caliptra

```rust
// Caliptra DICE implementation
impl CaliptraDice {
    fn generate_dice_chain(&self) -> Result<DiceChain, DiceError> {
        let mut chain = DiceChain::new();

        // Layer 0: ROM
        let rom_tcb = DiceTcbInfo {
            version: 0,
            svn: self.rom_svn,
            vendor_id: *b"Caliptra         ",
            vendor_info: self.rom_version,
            flags: DICE_FLAG_BOOT,
        };
        chain.add_layer(self.cdi_0, rom_tcb)?;

        // Layer 1: FMC
        let fmc_tcb = DiceTcbInfo {
            version: 1,
            svn: self.fmc_svn,
            vendor_id: *b"Caliptra         ",
            vendor_info: self.fmc_version,
            flags: DICE_FLAG_MEASURED,
        };
        chain.add_layer(self.cdi_1, fmc_tcb)?;

        // Layer 2: Runtime
        let runtime_tcb = DiceTcbInfo {
            version: 2,
            svn: self.runtime_svn,
            vendor_id: *b"Caliptra         ",
            vendor_info: self.runtime_version,
            flags: DICE_FLAG_MEASURED | DICE_FLAG_AUTH,
        };
        chain.add_layer(self.cdi_2, runtime_tcb)?;

        Ok(chain)
    }
}
```

## Mailbox Interface

Caliptra uses a mailbox for host communication. The host writes commands and reads responses through MMIO registers.

### Mailbox Registers

```rust
// Caliptra mailbox register map
const CALIPTRA_MAILBOX_BASE: usize = 0x3000_0000;

const MAILBOX_LOCK: usize = CALIPTRA_MAILBOX_BASE + 0x00;
const MAILBOX_CMD: usize = CALIPTRA_MAILBOX_BASE + 0x04;
const MAILBOX_DLEN: usize = CALIPTRA_MAILBOX_BASE + 0x08;
const MAILBOX_DATA_IN: usize = CALIPTRA_MAILBOX_BASE + 0x10;
const MAILBOX_DATA_OUT: usize = CALIPTRA_MAILBOX_BASE + 0x18;
const MAILBOX_STATUS: usize = CALIPTRA_MAILBOX_BASE + 0x20;
const MAILBOX_IRQ: usize = CALIPTRA_MAILBOX_BASE + 0x24;

// Status register bits
const STATUS_BUSY: u32 = 0x01;
const STATUS_READY: u32 = 0x02;
const STATUS_VALID: u32 = 0x04;
const STATUS_ERROR: u32 = 0x08;

// Command codes
const CMD_FIRMWARE_LOAD: u32 = 0x0000_0001;
const CMD_GET_DEVICE_ID: u32 = 0x0000_0002;
const CMD_GET_FMC_MEASUREMENT: u32 = 0x0000_0003;
const CMD_GET_RUNTIME_MEASUREMENT: u32 = 0x0000_0004;
const CMD_DICE_SPDM: u32 = 0x0000_0005;
```

### Mailbox Driver

```rust
pub struct CaliptraMailbox {
    base: usize,
}

impl CaliptraMailbox {
    pub fn new(base: usize) -> Self {
        CaliptraMailbox { base }
    }

    pub fn lock(&self) -> Result<(), MailboxError> {
        let lock_reg = self.base + MAILBOX_LOCK;
        unsafe {
            let val = core::ptr::read_volatile(lock_reg as *const u32);
            if val & 0x01 != 0 {
                return Err(MailboxError::AlreadyLocked);
            }
            core::ptr::write_volatile(lock_reg as *mut u32, 0x01);
        }
        Ok(())
    }

    pub fn unlock(&self) {
        let lock_reg = self.base + MAILBOX_LOCK;
        unsafe {
            core::ptr::write_volatile(lock_reg as *mut u32, 0x00);
        }
    }

    pub fn send_command(
        &self,
        cmd: u32,
        data: &[u8],
    ) -> Result<Vec<u8>, MailboxError> {
        self.lock()?;

        // Set command
        unsafe {
            core::ptr::write_volatile(
                (self.base + MAILBOX_CMD) as *mut u32,
                cmd,
            );
        }

        // Set data length
        unsafe {
            core::ptr::write_volatile(
                (self.base + MAILBOX_DLEN) as *mut u32,
                data.len() as u32,
            );
        }

        // Write data
        for (i, chunk) in data.chunks(4).enumerate() {
            let mut buf = [0u8; 4];
            buf[..chunk.len()].copy_from_slice(chunk);
            let val = u32::from_le_bytes(buf);

            unsafe {
                core::ptr::write_volatile(
                    (self.base + MAILBOX_DATA_IN + i * 4) as *mut u32,
                    val,
                );
            }
        }

        // Trigger execution
        unsafe {
            core::ptr::write_volatile(
                (self.base + MAILBOX_STATUS) as *mut u32,
                STATUS_READY,
            );
        }

        // Wait for completion
        loop {
            let status = self.read_status();
            if status & STATUS_VALID != 0 {
                break;
            }
            if status & STATUS_ERROR != 0 {
                self.unlock();
                return Err(MailboxError::CommandFailed);
            }
            cortex_m::asm::nop();
        }

        // Read response length
        let resp_len = unsafe {
            core::ptr::read_volatile((self.base + MAILBOX_DLEN) as *const u32)
        };

        // Read response data
        let mut response = vec![0u8; resp_len as usize];
        for i in 0..(resp_len as usize + 3) / 4 {
            let val = unsafe {
                core::ptr::read_volatile(
                    (self.base + MAILBOX_DATA_OUT + i * 4) as *const u32,
                )
            };
            let bytes = val.to_le_bytes();
            let start = i * 4;
            let end = (start + 4).min(response.len());
            response[start..end].copy_from_slice(&bytes[..end - start]);
        }

        self.unlock();
        Ok(response)
    }

    fn read_status(&self) -> u32 {
        unsafe {
            core::ptr::read_volatile((self.base + MAILBOX_STATUS) as *const u32)
        }
    }
}
```

## Attestation Commands

Caliptra provides several attestation-related commands through the mailbox.

### Firmware Load Command

```rust
fn load_firmware(
    mailbox: &CaliptraMailbox,
    firmware: &[u8],
) -> Result<(), CaliptraError> {
    // Verify firmware signature before loading
    verify_firmware_signature(firmware)?;

    // Send firmware load command
    mailbox.send_command(CMD_FIRMWARE_LOAD, firmware)?;

    Ok(())
}
```

### Get DICE Chain Command

```rust
fn get_dice_chain(
    mailbox: &CaliptraMailbox,
) -> Result<Vec<u8>, CaliptraError> {
    let response = mailbox.send_command(CMD_DICE_SPDM, &[])?;
    Ok(response)
}
```

### Get Measurements Command

```rust
fn get_measurements(
    mailbox: &CaliptraMailbox,
) -> Result<CaliptraMeasurements, CaliptraError> {
    // Get FMC measurement
    let fmc_measurement = mailbox.send_command(
        CMD_GET_FMC_MEASUREMENT,
        &[0], // PCR index
    )?;

    // Get Runtime measurement
    let runtime_measurement = mailbox.send_command(
        CMD_GET_RUNTIME_MEASUREMENT,
        &[1], // PCR index
    )?;

    Ok(CaliptraMeasurements {
        fmc: fmc_measurement,
        runtime: runtime_measurement,
    })
}
```

## Key Management

Caliptra manages several types of cryptographic keys:

### Key Hierarchy

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Key Hierarchy                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  UDS (Device Unique Secret)                                       │
│  └─> Burned into silicon, never exposed                          │
│                                                                   │
│  CDI_0 (Root CDI)                                                 │
│  └─> HMAC(UDS, "caliptra-rom")                                   │
│       │                                                           │
│       ├─> CDI_1 (FMC CDI)                                        │
│       │    └─> HMAC(CDI_0, measurements || tcb_info)              │
│       │         │                                                 │
│       │         ├─> FMC Signing Key                               │
│       │         │    └─> HKDF(CDI_1, "fmc-signing")              │
│       │         │                                                 │
│       │         └─> CDI_2 (Runtime CDI)                           │
│       │              └─> HMAC(CDI_1, measurements)                │
│       │                   │                                       │
│       │                   ├─> Runtime Signing Key                 │
│       │                   │    └─> HKDF(CDI_2, "rt-signing")      │
│       │                   │                                       │
│       │                   └─> Attestation Key                     │
│       │                        └─> HKDF(CDI_2, "attest")          │
│       │                                                           │
│       └─> Encryption Keys                                         │
│            └─> HKDF(CDI_0, "encryption")                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Derivation

```rust
fn derive_keys(cdi: &[u8; 32], context: &[u8]) -> CaliptraKeys {
    use hkdf::Hkdf;

    let hkdf = Hkdf::<Sha256>::new(Some(context), cdi);

    let mut signing_key = [0u8; 32];
    let mut attestation_key = [0u8; 32];
    let mut encryption_key = [0u8; 32];

    hkdf.expand(b"signing", &mut signing_key).unwrap();
    hkdf.expand(b"attestation", &mut attestation_key).unwrap();
    hkdf.expand(b"encryption", &mut encryption_key).unwrap();

    CaliptraKeys {
        signing: signing_key,
        attestation: attestation_key,
        encryption: encryption_key,
    }
}
```

## caliptra-sw Repository Structure

```text
caliptra-sw/
├── rom/                    # ROM firmware
│   ├── src/
│   │   ├── main.rs
│   │   ├── dice.rs         # DICE implementation
│   │   ├── fmc_loader.rs   # FMC loading and verification
│   │   └── mbox.rs         # Mailbox driver
│   └── Cargo.toml
│
├── fmc/                    # First Mutable Code
│   ├── src/
│   │   ├── main.rs
│   │   ├── dice.rs
│   │   ├── cert_store.rs   # Certificate storage
│   │   └── attestation.rs
│   └── Cargo.toml
│
├── runtime/                # Runtime firmware
│   ├── src/
│   │   ├── main.rs
│   │   ├── spdm.rs         # SPDM responder
│   │   ├── key_mgr.rs      # Key management
│   │   └── self_test.rs
│   └── Cargo.toml
│
├── drivers/                # Hardware drivers
│   ├── src/
│   │   ├── sha.rs          # SHA accelerator
│   │   ├── ecc.rs          # ECC accelerator
│   │   ├── hmac.rs         # HMAC accelerator
│   │   ├── trng.rs         # True RNG
│   │   └── pcrc.rs         # PCR module
│   └── Cargo.toml
│
├── lib/                    # Shared libraries
│   ├── src/
│   │   ├── dice.rs
│   │   ├── error.rs
│   │   └── types.rs
│   └── Cargo.toml
│
├── tests/                  # Integration tests
│   ├── src/
│   │   ├── test_rom.rs
│   │   ├── test_fmc.rs
│   │   └── test_runtime.rs
│   └── Cargo.toml
│
├── tools/                  # Build and testing tools
│   ├── caliptra-builder/
│   ├── caliptra-firmware-test/
│   └── caliptra-image-builder/
│
└── Cargo.toml              # Workspace root
```

## Contributing to Caliptra

### Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/chipsalliance/caliptra-sw.git
cd caliptra-sw

# Install dependencies
./tools/scripts/deps.sh

# Build all firmware
cargo build --release

# Run tests
cargo test

# Run with FPGA emulator
cargo run --bin caliptra-firmware-test -- --emulator
```

### Code Review Process

1. **Fork the repository** on GitHub
2. **Create a feature branch** from `main`
3. **Write tests** for new functionality
4. **Run CI checks** before submitting
5. **Submit pull request** with clear description
6. **Address review comments** from maintainers
7. **Squash and merge** after approval

### Testing Requirements

```bash
# Unit tests
cargo test --lib

# Integration tests
cargo test --test integration

# FPGA tests (requires hardware)
cargo test --features fpga

# Security audit checks
cargo audit
cargo deny check licenses
```

## 9elements' Role in Caliptra

9elements contributes to Caliptra in several key areas:

### Core Contributions

- **DICE implementation** — DICE certificate generation and validation
- **SPDM responder** — Secure device authentication
- **MCTP transport** — Message transport implementation
- **Testing framework** — Comprehensive test suites
- **Documentation** — Specification and API documentation

### Recent Work

- **Caliptra 1.0 release** — Production-ready firmware
- **FIPS 140-3 compliance** — Cryptographic module validation
- **OpenPRoT integration** — Hubris RTOS integration
- **FPGA emulation** — Hardware-in-the-loop testing

{% include callout.html type="info" title="Getting Involved" content="Caliptra is an active open-source project. Visit https://github.com/chipsalliance/caliptra-sw to contribute. Join the CHIPS Alliance TAC meetings to participate in governance decisions." %}

<details>
<summary>Advanced: Caliptra Security Features</summary>

### Anti-Rollback Protection

```rust
// Anti-rollback SVN tracking
struct AntiRollback {
    min_svn: u32,
    max_svn: u32,
    current_svn: u32,
}

impl AntiRollback {
    fn check_firmware(&self, firmware_svn: u32) -> Result<(), RollbackError> {
        if firmware_svn < self.min_svn {
            return Err(RollbackError::BelowMinimum);
        }
        if firmware_svn > self.max_svn {
            return Err(RollbackError::AboveMaximum);
        }
        if firmware_svn < self.current_svn {
            return Err(RollbackError::RollbackDetected);
        }
        Ok(())
    }
}
```

### Tamper Detection

```rust
// Tamper event handling
#[interrupt]
fn TAMPER_IRQ() {
    let tamper_status = read_tamper_status();

    if tamper_status.voltage_glitch {
        // Log tamper event
        log_tamper_event(TamperEvent::VoltageGlitch);

        // Zeroize secrets
        zeroize_secrets();

        // Enter locked state
        enter_locked_state();
    }

    if tamper_status.temperature_anomaly {
        log_tamper_event(TamperEvent::TemperatureAnomaly);
        // ... handle temperature tamper
    }

    if tamper_status.light_detection {
        log_tamper_event(TamperEvent::LightDetection);
        // ... handle light tamper
    }
}
```

</details>

## Quiz

<div class="quiz" data-answer="Caliptra uses DICE to derive CDIs at each boot layer, creating certificates signed by the previous layer">
<strong>Q1:</strong> How does Caliptra use DICE for attestation?

<details>
<summary>Answer</summary>
Caliptra uses DICE to derive CDIs (Compound Device Identifiers) at each boot layer using HMAC. ROM derives CDI_0, FMC derives CDI_1, and Runtime derives CDI_2. Each layer issues a certificate signed by its CDI, creating a chain of trust.
</details>
</div>

<div class="quiz" data-answer="The mailbox interface provides a standardized API for host communication through MMIO registers for commands, data, and status">
<strong>Q2:</strong> What is the purpose of Caliptra's mailbox interface?

<details>
<summary>Answer</summary>
The mailbox interface provides a standardized API for host communication through MMIO registers for commands, data, and status. It allows the host to load firmware, get measurements, and perform attestation operations.
</details>
</div>

<div class="quiz" data-answer="Firmware is verified through signature validation against a burned public key and measurement of code hashes into PCRs">
<strong>Q3:</strong> How does Caliptra verify firmware integrity?

<details>
<summary>Answer</summary>
Firmware is verified through signature validation against a burned public key and measurement of code hashes into PCRs. The ROM verifies FMC, and FMC verifies Runtime, creating a measured boot chain.
</details>
</div>

## Exercises

<div class="exercise">
<h3>Exercise 1: Mailbox Command</h3>
<p>Implement a function that sends a GET_MEASUREMENTS command through the Caliptra mailbox and parses the response.</p>

<details>
<summary>Solution</summary>

```rust
fn get_measurements(mailbox: &CaliptraMailbox) -> Result<CaliptraMeasurements, CaliptraError> {
    // Send FMC measurement command
    let fmc_resp = mailbox.send_command(
        CMD_GET_FMC_MEASUREMENT,
        &[0x00],  // PCR index 0
    )?;

    if fmc_resp.len() < 32 {
        return Err(CaliptraError::InvalidResponse);
    }

    let mut fmc_measurement = [0u8; 32];
    fmc_measurement.copy_from_slice(&fmc_resp[..32]);

    // Send Runtime measurement command
    let rt_resp = mailbox.send_command(
        CMD_GET_RUNTIME_MEASUREMENT,
        &[0x01],  // PCR index 1
    )?;

    if rt_resp.len() < 32 {
        return Err(CaliptraError::InvalidResponse);
    }

    let mut runtime_measurement = [0u8; 32];
    runtime_measurement.copy_from_slice(&rt_resp[..32]);

    Ok(CaliptraMeasurements {
        fmc: fmc_measurement,
        runtime: runtime_measurement,
    })
}

// Test the function
#[test]
fn test_get_measurements() {
    let mut mailbox = CaliptraMailbox::new(0x3000_0000);
    let measurements = get_measurements(&mut mailbox).unwrap();

    assert_ne!(measurements.fmc, [0u8; 32]);
    assert_ne!(measurements.runtime, [0u8; 32]);
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 2: Certificate Validation</h3>
<p>Implement a function that validates a DICE certificate chain from leaf to root.</p>

<details>
<summary>Solution</summary>

```rust
fn validate_certificate_chain(
    chain: &[DiceCertificate],
) -> Result<(), CertificateError> {
    if chain.is_empty() {
        return Err(CertificateError::EmptyChain);
    }

    // Validate each certificate
    for i in 0..chain.len() {
        let cert = &chain[i];

        // Validate header magic
        if cert.header.magic != *b"DIC0" {
            return Err(CertificateError::InvalidMagic);
        }

        // Validate version
        if cert.header.version != 1 {
            return Err(CertificateError::UnsupportedVersion);
        }

        // If not the root certificate, verify signature against parent
        if i < chain.len() - 1 {
            let parent = &chain[i + 1];
            let content_hash = Sha256::digest(
                &[&cert.tcb_info.to_bytes()[..], &cert.public_key[..]].concat()
            );

            // Verify signature using parent's public key
            let verifying_key = VerifyingKey::from_sec1_bytes(&parent.public_key)
                .map_err(|_| CertificateError::InvalidKey)?;
            
            let signature = Signature::from_slice(&cert.signature)
                .map_err(|_| CertificateError::InvalidSignature)?;
            
            verifying_key.verify(&content_hash, &signature)
                .map_err(|_| CertificateError::SignatureVerificationFailed)?;
        }
    }

    // Validate root is self-signed
    let root = chain.last().unwrap();
    let root_hash = Sha256::digest(
        &[&root.tcb_info.to_bytes()[..], &root.public_key[..]].concat()
    );

    let root_key = VerifyingKey::from_sec1_bytes(&root.public_key)
        .map_err(|_| CertificateError::InvalidKey)?;
    
    let root_sig = Signature::from_slice(&root.signature)
        .map_err(|_| CertificateError::InvalidSignature)?;
    
    root_key.verify(&root_hash, &root_sig)
        .map_err(|_| CertificateError::RootNotSelfSigned)?;

    Ok(())
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 3: Key Derivation</h3>
<p>Implement Caliptra's key derivation function that creates signing, attestation, and encryption keys from a CDI.</p>

<details>
<summary>Solution</summary>

```rust
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub struct CaliptraKeys {
    pub signing: [u8; 32],
    pub attestation: [u8; 32],
    pub encryption: [u8; 32],
}

fn derive_keys(cdi: &[u8; 32], layer_context: &[u8]) -> CaliptraKeys {
    // Create context-specific CDI
    let mut cdi_hasher = HmacSha256::new_from_slice(cdi)
        .expect("HMAC accepts any key size");
    cdi_hasher.update(layer_context);
    let layer_cdi = cdi_hasher.finalize().into_bytes();

    // Derive signing key
    let mut signing_key = [0u8; 32];
    let mut signing_hasher = HmacSha256::new_from_slice(&layer_cdi)
        .expect("HMAC accepts any key size");
    signing_hasher.update(b"signing");
    signing_key.copy_from_slice(&signing_hasher.finalize().into_bytes());

    // Derive attestation key
    let mut attestation_key = [0u8; 32];
    let mut attestation_hasher = HmacSha256::new_from_slice(&layer_cdi)
        .expect("HMAC accepts any key size");
    attestation_hasher.update(b"attestation");
    attestation_key.copy_from_slice(&attestation_hasher.finalize().into_bytes());

    // Derive encryption key
    let mut encryption_key = [0u8; 32];
    let mut encryption_hasher = HmacSha256::new_from_slice(&layer_cdi)
        .expect("HMAC accepts any key size");
    encryption_hasher.update(b"encryption");
    encryption_key.copy_from_slice(&encryption_hasher.finalize().into_bytes());

    CaliptraKeys {
        signing: signing_key,
        attestation: attestation_key,
        encryption: encryption_key,
    }
}

#[test]
fn test_key_derivation() {
    let cdi = [0xAB; 32];
    let context = b"fmc-measurements";

    let keys = derive_keys(&cdi, context);

    // Keys should be deterministic
    let keys2 = derive_keys(&cdi, context);
    assert_eq!(keys.signing, keys2.signing);
    assert_eq!(keys.attestation, keys2.attestation);
    assert_eq!(keys.encryption, keys2.encryption);

    // Different context should produce different keys
    let keys3 = derive_keys(&cdi, b"runtime-measurements");
    assert_ne!(keys.signing, keys3.signing);
}
```

</details>
</div>

## Summary

In this chapter, you learned:

- **Caliptra** is an Open Source Root of Trust implementing DICE and SPDM
- **Architecture** consists of ROM, FMC, and Runtime layers with hardware security
- **Boot chain** validates firmware at each stage using signatures and measurements
- **DICE** creates a certificate chain rooted in hardware secrets
- **Mailbox interface** provides standardized host communication
- **Key management** derives cryptographic keys from CDIs at each layer
- **Contributing** requires following the fork-PR-review workflow

In the next chapter, we'll explore OpenPRoT — the Open Protocol Runtime that builds on Caliptra for platform firmware.

<div class="chapter-nav">
<a href="{{ page.prev }}" class="btn">← Previous: SPDM & DICE</a>
<a href="{{ page.next }}" class="btn">Next: OpenPRoT →</a>
</div>
