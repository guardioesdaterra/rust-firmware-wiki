---
layout: chapter
title: "Firmware Protocols"
chapter: 11
progress: 69
prev: /chapters/10-no-std/
next: /chapters/12-mctp/
---

# Firmware Protocols

{% include callout.html type="info" title="Why this matters for 9elements" content="Firmware security depends on standardized protocols for communication between components. At 9elements, we implement and contribute to protocols like MCTP, SPDM, PLDM, and DICE that form the foundation of platform trust. Understanding these protocols is essential for building secure firmware ecosystems." %}

## Why Protocols Matter

Firmware doesn't run in isolation. A modern computing platform has dozens of firmware components that need to communicate:

- **BIOS/UEFI** communicates with **BMC** (Baseboard Management Controller)
- **BMC** communicates with **NIC** (Network Interface Card)
- **Root of Trust** communicates with **Measured Boot**
- **Security coprocessor** communicates with **main CPU**

Without standardized protocols, each vendor would invent their own, creating an interoperability nightmare.

### The DMTF Standards

The **Distributed Management Task Force (DMTF)** defines many of the protocols used in firmware:

| Protocol | Purpose | Scope |
|----------|---------|-------|
| **MCTP** | Management Component Transport Protocol | Transport layer |
| **SPDM** | Security Protocol and Data Model | Authentication |
| **PLDM** | Platform Level Data Model | Data exchange |
| **Redfish** | RESTful API for management | Remote management |
| **CXL** | Compute Express Link | Memory/IO protocol |

## Protocol Stacks

Firmware protocols are organized in layers, similar to the OSI model:

```text
┌─────────────────────────────────────┐
│         Application Layer           │
│    (Redfish, vendor-specific)       │
├─────────────────────────────────────┤
│         Security Layer              │
│    (SPDM, DICE, attestation)        │
├─────────────────────────────────────┤
│         Data Model Layer            │
│    (PLDM, NCSI, NC-SI)             │
├─────────────────────────────────────┤
│         Transport Layer             │
│    (MCTP, SMBus, I2C, PCIe)        │
├─────────────────────────────────────┤
│         Physical Layer              │
│    (SMBus, I2C, PCIe, USB)         │
└─────────────────────────────────────┘
```

## Message Framing

Every protocol needs to define how messages are structured. A typical message frame includes:

### Generic Message Structure

```rust
// A typical firmware protocol message frame
struct ProtocolMessage {
    header: MessageHeader,
    payload: [u8; MAX_PAYLOAD_SIZE],
    crc: u16,
}

struct MessageHeader {
    source_addr: u8,
    dest_addr: u8,
    message_type: u8,
    message_id: u8,
    payload_length: u16,
    flags: u8,
}
```

### Example: MCTP Message Frame

```rust
// MCTP header structure (simplified)
#[repr(C, packed)]
struct McptHeader {
    // Byte 0
    source_addr: u8,
    // Byte 1
    destination_addr: u8,
    // Byte 2
    message_type: u8,
    // Byte 3
    message_id: u8,
    // Byte 4-5
    payload_length: u16,
}

// Message type constants
const MSG_TYPE_PLDM: u8 = 0x01;
const MSG_TYPE_MCTP_CTRL: u8 = 0x00;
const MSG_TYPE_VENDOR: u8 = 0x7E;
```

## Request/Response Patterns

Most firmware protocols follow a request/response pattern:

```text
┌────────┐                    ┌────────┐
│ Client │                    │ Server │
└───┬────┘                    └───┬────┘
    │     Request (msg_id=1)      │
    │────────────────────────────>│
    │                             │ Processing...
    │     Response (msg_id=1)     │
    │<────────────────────────────│
    │                             │
    │     Request (msg_id=2)      │
    │────────────────────────────>│
    │     Error (msg_id=2)        │
    │<────────────────────────────│
```

### Request/Response Implementation

```rust
// Generic request/response handler
trait ProtocolHandler {
    type Request;
    type Response;
    type Error;

    fn handle_request(&self, request: &Self::Request) 
        -> Result<Self::Response, Self::Error>;
}

// MCTP control message handler
struct McptControlHandler;

impl ProtocolHandler for McptControlHandler {
    type Request = McptControlRequest;
    type Response = McptControlResponse;
    type Error = McptError;

    fn handle_request(&self, request: &Self::Request) 
        -> Result<Self::Response, Self::Error> {
        match request.command_code {
            0x01 => self.get_message_type_support(),
            0x02 => self.get_message_type_version(),
            0x03 => self.set_endpoint_id(),
            0x04 => self.get_endpoint_id(),
            _ => Err(McptError::UnsupportedCommand),
        }
    }
}
```

## Serialization

Firmware protocols need to serialize and deserialize data efficiently. Common approaches:

### Binary Serialization (Most Common)

```rust
// Manual binary serialization
fn serialize_get_version_request(buffer: &mut [u8]) -> usize {
    buffer[0] = 0x00; // Message type: MCTP control
    buffer[1] = 0x01; // Command: Get Version
    buffer[2] = 0x00; // Reserved
    buffer[3] = 0x00; // Data length: 0
    4 // Return bytes written
}

fn deserialize_version_response(buffer: &[u8]) -> Result<VersionInfo, Error> {
    if buffer.len() < 4 {
        return Err(Error::BufferTooSmall);
    }

    let major = buffer[0];
    let minor = buffer[1];
    let patch = buffer[2];

    Ok(VersionInfo { major, minor, patch })
}
```

### Using serde (When Available)

```rust
// With serde (requires alloc or std)
#[derive(serde::Serialize, serde::Deserialize)]
struct FirmwareVersion {
    major: u8,
    minor: u8,
    patch: u16,
    build: [u8; 16],
}

// Binary format with postcard (no_std compatible)
fn serialize_version(version: &FirmwareVersion) -> Result<Vec<u8>, Error> {
    postcard::to_vec(version).map_err(|e| Error::SerializationFailed(e))
}
```

## Real-World Protocol Usage

### BMC to NIC Communication

```text
┌─────────────────────────────────────────────────────┐
│                    BMC (Server)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Redfish  │  │  PLDM    │  │    MCTP Stack    │  │
│  │  Server  │  │ Handler  │  │                  │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                 │             │
│       └──────────────┴─────────────────┘             │
│                      │                               │
│              ┌───────┴───────┐                       │
│              │   SMBus/I2C   │                       │
│              └───────┬───────┘                       │
└──────────────────────┼───────────────────────────────┘
                       │
              ┌────────┴────────┐
              │    NIC Card     │
              │  (MCTP Endpoint)│
              └─────────────────┘
```

### Firmware Update Flow

```text
1. Host sends PLDM "Apply" command via MCTP
2. BMC acknowledges receipt
3. BMC transfers firmware blocks to NIC
4. NIC validates each block (CRC/checksum)
5. NIC reports progress via PLDM events
6. BMC monitors completion status
7. NIC applies firmware and resets
8. BMC verifies new firmware version
```

## MCTP Overview

**MCTP (Management Component Transport Protocol)** is the transport layer for management communications.

Key features:
- **Message-based transport** — sends discrete messages, not streams
- **Multiple physical layers** — SMBus, I2C, PCIe VDM
- **Endpoint discovery** — automatic detection of devices
- **Message routing** — supports complex topologies
- **Error handling** — built-in retry and error recovery

## SPDM Overview

**SPDM (Security Protocol and Data Model)** provides authentication and key exchange.

Key features:
- **Device authentication** — mutual authentication using certificates
- **Key exchange** — establishes encrypted channels
- **Challenge-response** — proves device identity
- **Certificate management** — validates trust chains

## PLDM Overview

**PLDM (Platform Level Data Model)** defines data structures and commands for platform management.

Key features:
- **Firmware update** — standardized firmware distribution
- **Platform monitoring** — sensor readings and events
- **BIOS management** — configuration and control
- **Redfish support** — maps PLDM to REST APIs

## DICE Overview

**DICE (Device Identifier Composition Engine)** creates a chain of trust from hardware root of trust.

Key features:
- **Hardware root of trust** — starts from immutable ROM
- **Layer-by-layer attestation** — each layer measures the next
- **Certificate chain** — X.509 certificates for verification
- **CDI (Compound Device Identifier)** — unique device secrets

## Protocol Comparison

| Feature | MCTP | SPDM | PLDM | DICE |
|---------|------|------|------|------|
| **Layer** | Transport | Security | Data | Trust |
| **Primary Use** | Message transport | Authentication | Data exchange | Attestation |
| **Physical** | SMBus, I2C, PCIe | Any MCTP transport | Any MCTP transport | Hardware |
| **Complexity** | Medium | High | Medium | High |
| **Mandatory** | Yes (for management) | Optional | Optional | Optional |

{% include callout.html type="info" title="Protocol Layering" content="These protocols work together. MCTP provides transport, SPDM adds security, PLDM defines data formats, and DICE creates trust. A typical secure management flow uses all four." %}

<details>
<summary>Advanced: Protocol State Machines</summary>

```rust
// SPDM state machine (simplified)
enum SpdmState {
    Idle,
    Version,
    Capabilities,
    Algorithms,
    Authenticate,
    Established,
    Error,
}

impl SpdmState {
    fn next(&self, message_type: SpdmMessageType) -> Result<SpdmState, SpdmError> {
        match (self, message_type) {
            (SpdmState::Idle, SpdmMessageType::Version) => Ok(SpdmState::Version),
            (SpdmState::Version, SpdmMessageType::Capabilities) => Ok(SpdmState::Capabilities),
            (SpdmState::Capabilities, SpdmMessageType::Algorithms) => Ok(SpdmState::Algorithms),
            (SpdmState::Algorithms, SpdmMessageType::Challenge) => Ok(SpdmState::Authenticate),
            (SpdmState::Authenticate, SpdmMessageType::Finish) => Ok(SpdmState::Established),
            _ => Err(SpdmError::UnexpectedMessage),
        }
    }
}
```

</details>

## Quiz

<div class="quiz" data-answer="MCTP is the transport layer that provides message-based communication over SMBus, I2C, or PCIe VDM">
<strong>Q1:</strong> What is the primary role of MCTP in the firmware protocol stack?

<details>
<summary>Answer</summary>
MCTP is the transport layer that provides message-based communication over SMBus, I2C, or PCIe VDM. It handles message framing, routing, and delivery between management components.
</details>
</div>

<div class="quiz" data-answer="SPDM provides device authentication through certificate exchange and challenge-response, establishing encrypted channels">
<strong>Q2:</strong> How does SPDM differ from MCTP?

<details>
<summary>Answer</summary>
SPDM provides device authentication through certificate exchange and challenge-response, establishing encrypted channels. MCTP provides transport, while SPDM adds security on top of that transport.
</details>
</div>

<div class="quiz" data-answer="DICE creates a chain of trust starting from hardware root of trust, with each layer measuring the next and creating certificates">
<strong>Q3:</strong> What is the purpose of DICE in firmware security?

<details>
<summary>Answer</summary>
DICE creates a chain of trust starting from hardware root of trust, with each layer measuring the next and creating certificates. This allows verification that each firmware layer is authentic and unmodified.
</details>
</div>

## Exercises

<div class="exercise">
<h3>Exercise 1: Message Parser</h3>
<p>Write a Rust struct that parses an MCTP message header from raw bytes. Include validation checks.</p>

<details>
<summary>Solution</summary>

```rust
#[derive(Debug, Clone, Copy)]
#[repr(C, packed)]
struct McptHeader {
    source_addr: u8,
    destination_addr: u8,
    message_type: u8,
    message_id: u8,
    payload_length: u16,
}

#[derive(Debug)]
enum ParseError {
    BufferTooSmall,
    InvalidPayloadLength,
    InvalidMessageType,
}

impl McptHeader {
    const MIN_SIZE: usize = 6;

    fn parse(buffer: &[u8]) -> Result<Self, ParseError> {
        if buffer.len() < Self::MIN_SIZE {
            return Err(ParseError::BufferTooSmall);
        }

        let header = McptHeader {
            source_addr: buffer[0],
            destination_addr: buffer[1],
            message_type: buffer[2],
            message_id: buffer[3],
            payload_length: u16::from_le_bytes([buffer[4], buffer[5]]),
        };

        if header.payload_length > 4096 {
            return Err(ParseError::InvalidPayloadLength);
        }

        if header.message_type > 0x7F && header.message_type != 0xFF {
            return Err(ParseError::InvalidMessageType);
        }

        Ok(header)
    }

    fn serialize(&self) -> [u8; 6] {
        let mut buffer = [0u8; 6];
        buffer[0] = self.source_addr;
        buffer[1] = self.destination_addr;
        buffer[2] = self.message_type;
        buffer[3] = self.message_id;
        let length_bytes = self.payload_length.to_le_bytes();
        buffer[4] = length_bytes[0];
        buffer[5] = length_bytes[1];
        buffer
    }
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 2: Protocol Handler</h3>
<p>Implement a trait-based protocol handler that can process different message types.</p>

<details>
<summary>Solution</summary>

```rust
trait MessageHandler {
    type Message;
    type Response;

    fn handle(&mut self, message: &Self::Message) -> Option<Self::Response>;
}

struct PldmHandler {
    version: PldmVersion,
}

impl MessageHandler for PldmHandler {
    type Message = PldmMessage;
    type Response = PldmResponse;

    fn handle(&mut self, message: &Self::Message) -> Option<Self::Response> {
        match message.command {
            PldmCommand::GetPldmVersion => {
                Some(PldmResponse::Version(self.version))
            }
            PldmCommand::GetPldmTypes => {
                Some(PldmResponse::Types(vec![
                    PldmType::Base,
                    PldmType::Platform,
                    PldmType::BIOS,
                ]))
            }
            PldmCommand::GetPldmCommands => {
                Some(PldmResponse::Commands(vec![
                    0x01, 0x02, 0x03, 0x04,
                ]))
            }
            _ => None,
        }
    }
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 3: Error Recovery</h3>
<p>Implement error recovery logic for a protocol handler that retries failed messages up to 3 times with exponential backoff.</p>

<details>
<summary>Solution</summary>

```rust
struct RetryHandler<H: MessageHandler> {
    handler: H,
    max_retries: u32,
    base_delay_ms: u32,
}

impl<H: MessageHandler> RetryHandler<H> {
    fn new(handler: H) -> Self {
        RetryHandler {
            handler,
            max_retries: 3,
            base_delay_ms: 10,
        }
    }

    fn send_with_retry(&mut self, message: &H::Message) -> Result<H::Response, Error> {
        let mut last_error = None;

        for attempt in 0..=self.max_retries {
            match self.handler.handle(message) {
                Some(response) => return Ok(response),
                None => {
                    last_error = Some(Error::NoResponse);

                    if attempt < self.max_retries {
                        let delay = self.base_delay_ms * (1 << attempt);
                        cortex_m::asm::delay(delay * 8000); // Assume 8MHz
                    }
                }
            }
        }

        Err(last_error.unwrap_or(Error::MaxRetriesExceeded))
    }
}
```

</details>
</div>

## Summary

In this chapter, you learned:

- **Firmware protocols** enable secure communication between platform components
- **Protocol stacks** organize protocols in layers: transport, security, data model
- **Message framing** defines how bytes are organized in protocol messages
- **Request/response patterns** are the foundation of most firmware communication
- **Serialization** converts structured data to/from bytes
- **MCTP** provides message-based transport over SMBus, I2C, or PCIe
- **SPDM** adds authentication and key exchange
- **PLDM** defines data formats for platform management
- **DICE** creates a hardware-rooted chain of trust

In the next chapter, we'll do a deep dive into MCTP, implementing a complete message parser and transport layer.

<div class="chapter-nav">
<a href="{{ page.prev }}" class="btn">← Previous: no_std Rust</a>
<a href="{{ page.next }}" class="btn">Next: MCTP Deep Dive →</a>
</div>
