---
layout: chapter
title: "MCTP Deep Dive"
chapter: 12
progress: 75
prev: /chapters/11-firmware-protocols/
next: /chapters/13-spdm-dice/
---

# MCTP Deep Dive

{% include callout.html type="info" title="Why this matters" content="MCTP is the backbone of management component communication. The mctp-estack crate implements MCTP in Rust for Caliptra and OpenPRoT. Understanding MCTP internals is essential for firmware engineers working on platform security and device management." %}

## MCTP Specification

The **Management Component Transport Protocol (MCTP)** is defined in the DMTF specification DSP0236. It provides a standardized way for management controllers to communicate.

### Key Concepts

- **Endpoint**: Any device that can send/receive MCTP messages
- **Source/Destination EID**: Endpoint Identifiers (0-255)
- **Message Type**: Identifies the protocol carried by MCTP
- **Transport Binding**: Physical layer (SMBus, I2C, PCIe VDM)

### Message Types

| Type | Value | Description |
|------|-------|-------------|
| MCTP Control | 0x00 | MCTP management messages |
| PLDM | 0x01 | Platform Level Data Model |
| NCSI | 0x02 | Network Controller Sideband Interface |
| Ethernet IPMI | 0x03 | IPMI over Ethernet |
| Redfish | 0x04 | Redfish messages |
| Vendor Defined | 0x7E | Vendor-specific messages |
| Reserved | 0x7F-0xFF | Reserved for future use |

## Message Header Structure

Every MCTP message starts with a header that identifies the source, destination, and message type.

### MCTP Header Format

```text
Byte 0:   [7:0] Source Endpoint Address
Byte 1:   [7:0] Destination Endpoint Address
Byte 2:   [7:0] Message Type
Byte 3:   [7:0] Message ID
Bytes 4-5: [15:0] Payload Length (little-endian)
```

### Rust Header Implementation

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(C, packed)]
pub struct McptHeader {
    pub source_addr: u8,
    pub dest_addr: u8,
    pub message_type: u8,
    pub message_id: u8,
    pub payload_length: u16,
}

impl McptHeader {
    pub const SIZE: usize = 6;

    pub fn new(src: u8, dst: u8, msg_type: u8, msg_id: u8, payload_len: u16) -> Self {
        McptHeader {
            source_addr: src,
            dest_addr: dst,
            message_type: msg_type,
            message_id: msg_id,
            payload_length: payload_len,
        }
    }

    pub fn parse(buffer: &[u8]) -> Result<Self, McptError> {
        if buffer.len() < Self::SIZE {
            return Err(McptError::BufferTooSmall);
        }

        let header = McptHeader {
            source_addr: buffer[0],
            dest_addr: buffer[1],
            message_type: buffer[2],
            message_id: buffer[3],
            payload_length: u16::from_le_bytes([buffer[4], buffer[5]]),
        };

        if header.payload_length as usize > buffer.len() - Self::SIZE {
            return Err(McptError::PayloadLengthMismatch);
        }

        Ok(header)
    }

    pub fn serialize(&self, buffer: &mut [u8]) -> Result<(), McptError> {
        if buffer.len() < Self::SIZE {
            return Err(McptError::BufferTooSmall);
        }

        buffer[0] = self.source_addr;
        buffer[1] = self.dest_addr;
        buffer[2] = self.message_type;
        buffer[3] = self.message_id;
        let len_bytes = self.payload_length.to_le_bytes();
        buffer[4] = len_bytes[0];
        buffer[5] = len_bytes[1];

        Ok(())
    }
}
```

## Message Types in Detail

### MCTP Control Messages

MCTP control messages are used for management operations like endpoint discovery and configuration.

```rust
// MCTP Control Message Types
pub const MCTP_CTRL_CMD_GET_MSG_TYPE_SUPPORT: u8 = 0x01;
pub const MCTP_CTRL_CMD_GET_MSG_TYPE_VERSION: u8 = 0x02;
pub const MCTP_CTRL_CMD_SET_ENDPOINT_ID: u8 = 0x03;
pub const MCTP_CTRL_CMD_GET_ENDPOINT_ID: u8 = 0x04;
pub const MCTP_CTRL_CMD_GET_UUID: u8 = 0x05;
pub const MCTP_CTRL_CMD_GET_VDM_SUPPORT: u8 = 0x06;

// Control message structure
#[repr(C, packed)]
struct McptControlMsg {
    rqr_dgram_id: u8,      // Request/Response and datagram ID
    command_code: u8,       // Command code
    message_type: u8,       // Message type for this command
    payload_length: u8,     // Length of additional data
}

// RQR (Request/Response) field bits
const RQR_BIT_REQUEST: u8 = 0x80;
const RQR_BIT_DATAGRAM: u8 = 0x40;
const RQR_BIT_IC: u8 = 0x20;  // Integrity Check
const RQR_BIT_EOM: u8 = 0x10; // End of Message
```

### Get Endpoint ID Response

```rust
#[repr(C, packed)]
struct GetEndpointIdResponse {
    completion_code: u8,
    endpoint_id: u8,
    endpoint_id_type: u8,  // 0=dynamic, 1=static, 2=static from EID pool
    reserved: u8,
}

impl GetEndpointIdResponse {
    fn parse(buffer: &[u8]) -> Result<Self, McptError> {
        if buffer.len() < 4 {
            return Err(McptError::BufferTooSmall);
        }

        Ok(GetEndpointIdResponse {
            completion_code: buffer[0],
            endpoint_id: buffer[1],
            endpoint_id_type: buffer[2],
            reserved: buffer[3],
        })
    }
}
```

## Endpoint Discovery

MCTP uses a discovery process to find and configure endpoints on a bus.

### Discovery Flow

```text
1. Polling
   Master broadcasts "Get Endpoint ID" to address 0xFF
   Endpoints respond with their current EID

2. Enumeration
   Master assigns EIDs to discovered endpoints
   Sends "Set Endpoint ID" to each endpoint

3. Verification
   Master queries each endpoint's UUID
   Verifies endpoint capabilities

4. Configuration
   Master sets message type support
   Configures transport-specific parameters
```

### Discovery Implementation

```rust
struct EndpointDiscovery {
    bus: Box<dyn McptTransport>,
    discovered_endpoints: Vec<EndpointInfo>,
}

struct EndpointInfo {
    eid: u8,
    uuid: [u8; 16],
    supported_types: Vec<u8>,
    transport_address: u8,
}

impl EndpointDiscovery {
    fn new(bus: Box<dyn McptTransport>) -> Self {
        EndpointDiscovery {
            bus,
            discovered_endpoints: Vec::new(),
        }
    }

    fn discover(&mut self) -> Result<(), McptError> {
        // Step 1: Broadcast discovery request
        let request = self.build_discovery_request();
        self.bus.send(0xFF, &request)?;

        // Step 2: Collect responses
        let responses = self.bus.receive_all(Duration::from_millis(100))?;

        for response in responses {
            let endpoint = self.parse_endpoint_response(&response)?;
            self.discovered_endpoints.push(endpoint);
        }

        // Step 3: Assign EIDs
        for (i, endpoint) in self.discovered_endpoints.iter_mut().enumerate() {
            let new_eid = (i + 1) as u8; // EID 0 is reserved
            self.assign_eid(endpoint.transport_address, new_eid)?;
            endpoint.eid = new_eid;
        }

        // Step 4: Get capabilities
        for endpoint in &self.discovered_endpoints {
            let uuid = self.get_uuid(endpoint.eid)?;
            let types = self.get_supported_types(endpoint.eid)?;
            // Update endpoint info
        }

        Ok(())
    }
}
```

## Transport Bindings

MCTP supports multiple physical transport layers:

### SMBus Transport

```rust
struct SMBusTransport {
    i2c_bus: I2cBus,
    slave_addr: u8,
}

impl McptTransport for SMBusTransport {
    fn send(&mut self, dest_eid: u8, data: &[u8]) -> Result<(), McptError> {
        // SMBus uses I2C with specific addressing
        let smbus_addr = self.eid_to_smbus_addr(dest_eid);
        self.i2c_bus.write(smbus_addr, data)?;
        Ok(())
    }

    fn receive(&mut self, timeout: Duration) -> Result<Vec<u8>, McptError> {
        let mut buffer = vec![0u8; 256];
        let len = self.i2c_bus.read(self.slave_addr, &mut buffer, timeout)?;
        buffer.truncate(len);
        Ok(buffer)
    }

    fn eid_to_smbus_addr(&self, eid: u8) -> u8 {
        // SMBus address = base address + EID
        0x20 + eid
    }
}
```

### I2C Transport

```rust
struct I2cTransport {
    i2c: I2c,
    own_addr: u8,
    max_payload: usize,
}

impl McptTransport for I2cTransport {
    fn send(&mut self, dest_eid: u8, data: &[u8]) -> Result<(), McptError> {
        if data.len() > self.max_payload {
            return Err(McptError::PayloadTooLarge);
        }

        // I2C multi-byte write
        self.i2c.write(dest_eid, data)?;
        Ok(())
    }

    fn receive(&mut self, timeout: Duration) -> Result<Vec<u8>, McptError> {
        let mut buffer = vec![0u8; self.max_payload];
        self.i2c.read(self.own_addr, &mut buffer)?;
        Ok(buffer)
    }
}
```

### PCIe VDM Transport

```rust
struct PcieVdmTransport {
    pcie: PcieDevice,
    source_bdf: (u8, u8, u8), // Bus, Device, Function
}

impl McptTransport for PcieVdmTransport {
    fn send(&mut self, dest_eid: u8, data: &[u8]) -> Result<(), McptError> {
        // PCIe uses Vendor Defined Messages (VDM)
        let vdm_header = PcieVdmHeader {
            fmt_type: 0x7F, // VDM type
            length: data.len() as u16,
            vendor_id: 0x1CB0, // DMTF vendor ID
            message_code: 0x00, // MCTP
        };

        let mut packet = Vec::new();
        packet.extend_from_slice(&vdm_header.serialize());
        packet.extend_from_slice(data);

        self.pcie.send_vdm(dest_eid, &packet)?;
        Ok(())
    }

    fn receive(&mut self, timeout: Duration) -> Result<Vec<u8>, McptError> {
        let vdm = self.pcie.receive_vdm(timeout)?;
        Ok(vdm.payload)
    }
}
```

## Request/Response Flow

### Complete Message Exchange

```text
┌────────┐                           ┌────────┐
│ Client │                           │ Server │
└───┬────┘                           └───┬────┘
    │                                     │
    │  1. Build MCTP header               │
    │  2. Add control message             │
    │  3. Calculate CRC                   │
    │                                     │
    │     MCTP Request                    │
    │     [Header][Control][Payload][CRC] │
    │────────────────────────────────────>│
    │                                     │
    │                    4. Parse header  │
    │                    5. Validate CRC  │
    │                    6. Process cmd   │
    │                    7. Build response│
    │                                     │
    │     MCTP Response                   │
    │     [Header][Control][Payload][CRC] │
    │<────────────────────────────────────│
    │                                     │
```

### Message ID Tracking

```rust
struct MessageTracker {
    pending: HashMap<u8, PendingMessage>,
    next_id: u8,
}

struct PendingMessage {
    timestamp: Instant,
    retry_count: u32,
    callback: Box<dyn FnOnce(Result<Vec<u8>, McptError>)>,
}

impl MessageTracker {
    fn new() -> Self {
        MessageTracker {
            pending: HashMap::new(),
            next_id: 0,
        }
    }

    fn register(&mut self, callback: Box<dyn FnOnce(Result<Vec<u8>, McptError>)>) -> u8 {
        let msg_id = self.next_id;
        self.next_id = self.next_id.wrapping_add(1);

        self.pending.insert(msg_id, PendingMessage {
            timestamp: Instant::now(),
            retry_count: 0,
            callback,
        });

        msg_id
    }

    fn complete(&mut self, msg_id: u8, result: Result<Vec<u8>, McptError>) {
        if let Some(mut pending) = self.pending.remove(&msg_id) {
            (pending.callback)(result);
        }
    }
}
```

## Error Handling

MCTP defines several error conditions and recovery mechanisms.

### Error Codes

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum McptCompletionCode {
    Success = 0x00,
    Error = 0x01,
    ErrorInvalidData = 0x02,
    ErrorInvalidLength = 0x03,
    ErrorNotReady = 0x04,
    ErrorUnsupportedCmd = 0x05,
    ErrorInvalidDestination = 0x06,
    ErrorInvalidSource = 0x07,
    ErrorInvalidMessageId = 0x08,
    ErrorInvalidPayload = 0x09,
    ErrorTransportSpecific = 0x80,
}
```

### Retry Logic

```rust
struct RetryPolicy {
    max_retries: u32,
    base_timeout: Duration,
    max_timeout: Duration,
    backoff_factor: f64,
}

impl RetryPolicy {
    fn should_retry(&self, attempt: u32, error: &McptError) -> bool {
        match error {
            McptError::Timeout => attempt < self.max_retries,
            McptError::Nack => false, // Don't retry NACKs
            McptError::TransportError(e) => e.is_retryable(),
            _ => false,
        }
    }

    fn get_timeout(&self, attempt: u32) -> Duration {
        let timeout = self.base_timeout.as_millis() as f64 
            * self.backoff_factor.powi(attempt as i32);
        let timeout = timeout.min(self.max_timeout.as_millis() as f64);
        Duration::from_millis(timeout as u64)
    }
}
```

## Rust Implementation

### Complete MCTP Parser

```rust
#![no_std]

use alloc::vec::Vec;
use core::fmt;

#[derive(Debug, Clone)]
pub enum McptError {
    BufferTooSmall,
    PayloadTooLarge,
    PayloadLengthMismatch,
    InvalidChecksum,
    InvalidMessageType,
    Timeout,
    TransportError(TransportError),
}

impl fmt::Display for McptError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            McptError::BufferTooSmall => write!(f, "Buffer too small"),
            McptError::PayloadTooLarge => write!(f, "Payload too large"),
            McptError::PayloadLengthMismatch => write!(f, "Payload length mismatch"),
            McptError::InvalidChecksum => write!(f, "Invalid checksum"),
            McptError::InvalidMessageType => write!(f, "Invalid message type"),
            McptError::Timeout => write!(f, "Timeout"),
            McptError::TransportError(e) => write!(f, "Transport error: {:?}", e),
        }
    }
}

// Complete MCTP message
pub struct McptMessage {
    pub header: McptHeader,
    pub payload: Vec<u8>,
    pub checksum: u16,
}

impl McptMessage {
    pub fn parse(buffer: &[u8]) -> Result<Self, McptError> {
        if buffer.len() < McptHeader::SIZE + 2 {
            return Err(McptError::BufferTooSmall);
        }

        let header = McptHeader::parse(buffer)?;
        let payload_end = McptHeader::SIZE + header.payload_length as usize;

        if buffer.len() < payload_end + 2 {
            return Err(McptError::PayloadLengthMismatch);
        }

        let payload = buffer[McptHeader::SIZE..payload_end].to_vec();
        let checksum = u16::from_le_bytes([buffer[payload_end], buffer[payload_end + 1]]);

        // Verify checksum
        let calculated = Self::calculate_checksum(&header, &payload);
        if calculated != checksum {
            return Err(McptError::InvalidChecksum);
        }

        Ok(McptMessage {
            header,
            payload,
            checksum,
        })
    }

    pub fn serialize(&self) -> Vec<u8> {
        let mut buffer = Vec::new();
        buffer.resize(McptHeader::SIZE + self.payload.len() + 2, 0);

        self.header.serialize(&mut buffer).unwrap();
        buffer[McptHeader::SIZE..McptHeader::SIZE + self.payload.len()]
            .copy_from_slice(&self.payload);

        let checksum = Self::calculate_checksum(&self.header, &self.payload);
        let checksum_bytes = checksum.to_le_bytes();
        let checksum_pos = McptHeader::SIZE + self.payload.len();
        buffer[checksum_pos] = checksum_bytes[0];
        buffer[checksum_pos + 1] = checksum_bytes[1];

        buffer
    }

    fn calculate_checksum(header: &McptHeader, payload: &[u8]) -> u16 {
        let mut crc: u16 = 0xFFFF;
        let header_bytes = header.serialize(&mut [0u8; 6]).unwrap();

        for &byte in &header_bytes {
            crc = crc16_update(crc, byte);
        }
        for &byte in payload {
            crc = crc16_update(crc, byte);
        }

        crc
    }
}

fn crc16_update(crc: u16, byte: u8) -> u16 {
    // ── XOR byte into CRC accumulator ────────────────────────────────────────
    // crc ^ (byte as u16):
    //
    //   crc         = 0bHHHH_HHHH_HHHH_HHHH   (u16: current CRC value)
    //   byte as u16 = 0b0000_0000_BBBB_BBBB   (u8 zero-extended to u16)
    //   XOR result  = 0bHHHH_HHHH_HHHH_H?H?   (high byte preserved,
    //                                           low byte bits XOR'd with byte)
    //
    // Why XOR? CRC is based on binary polynomial division, where
    // "addition" IS XOR (carryless addition). This feeds the new byte
    // into the polynomial division state machine.
    //
    // XOR truth table:  0^0=0  0^1=1  1^0=1  1^1=0
    // Key property: XOR is its own inverse: (a ^ b) ^ b = a
    // This is why CRC verification works: if you include the CRC in the data,
    // the final CRC is always 0x0000 (the polynomial division has no remainder).
    let mut crc = crc ^ (byte as u16);
    
    // ── Process 8 bits (one byte) ────────────────────────────────────────────
    for _ in 0..8 {
        // ── Check LSB with & (AND) ────────────────────────────────────────
        // crc & 1  = isolate the least significant bit (bit 0) of the CRC
        //
        //   crc   = 0b...HHHH_HHHH_HHHH_H?   (? = LSB before shifting)
        // & 1     = 0b...0000_0000_0000_0001
        // result  = 0b...0000_0000_0000_000?   (only LSB survives)
        //
        // In CRC, the LSB determines whether the polynomial gets "fed back."
        // If LSB = 1, the bit that would be lost (shifted out) gets XOR'd back.
        if crc & 1 != 0 {
            // ── Shift + polynomial XOR ────────────────────────────────────
            // (crc >> 1) ^ 0xA001:
            //
            // Step 1: crc >> 1  (right shift by 1 = divide by 2)
            //   crc before  = 0b...HHHH_HHHH_HHHH_H?1   (LSB=1)
            //   crc >> 1    = 0b...0HHH_HHHH_HHHH_HHH   (LSB falls off, MSB→0)
            //                                                    ↑ lost!
            //
            // Step 2: ^ 0xA001
            //   0xA001 = 0b1010_0000_0000_0001
            //   This is the CRC-16-IBM polynomial in "reflected" form
            //   (the LSB represents the highest-degree term).
            //
            //   XOR with 0xA001 "feeds back" the lost bit into the polynomial.
            //   Effectively: the lost 1 re-enters at specific tap positions.
            //
            // Practical: 0xA001 is the REVERSED form of 0x8005.
            //   Original polynomial: x^16 + x^15 + x^2 + 1
            //   Reversed: 0xA001 = 1010 0000 0000 0001
            crc = (crc >> 1) ^ 0xA001;
        } else {
            // ── Just shift (no polynomial feedback) ───────────────────────
            // If LSB = 0, nothing to feed back. Just shift right.
            //
            // crc >>= 1:
            //   crc before  = 0b...HHHH_HHHH_HHHH_H?0   (LSB=0)
            //   crc >>= 1   = 0b...0HHH_HHHH_HHHH_HHH   (LSB=0 discarded, MSB→0)
            //
            // The 0 that fell off would not have affected the polynomial
            // (0 × x^n = 0), so no XOR correction needed.
            crc >>= 1;
        }
    }
    crc
}
```

## mctp-estack Crate

The `mctp-estack` crate is a Rust implementation of the MCTP protocol stack.

### Features

- **no_std compatible** — works in firmware environments
- **Transport agnostic** — SMBus, I2C, PCIe VDM implementations
- **Async support** — optional async/await interface
- **Type-safe** — compile-time guarantees for message types

### Usage Example

```rust
use mctp_estack::{Mcpt, TransportType, McptMessage};

fn main() -> Result<(), mctp_estack::Error> {
    // Initialize MCTP with SMBus transport
    let transport = mctp_estack::smbus::SMBusTransport::new(
        I2cBus::open(1)?,
        0x20, // Our SMBus address
    );

    let mut mctp = Mcpt::new(transport);

    // Discover endpoints
    let endpoints = mctp.discover()?;

    for ep in &endpoints {
        println!("Found endpoint: EID={}, UUID={:?}", ep.eid, ep.uuid);
    }

    // Send a PLDM message
    let pldm_request = vec![0x01, 0x00, 0x01]; // PLDM GetVersion
    let response = mctp.send_request(1, 0x01, &pldm_request)?;

    println!("PLDM response: {:?}", response);

    Ok(())
}
```

{% include callout.html type="info" title="Try It Yourself" content="Modify the MCTP parser below to handle different message types. Add a new handler for vendor-defined messages." %}

<details>
<summary>Advanced: Async MCTP Transport</summary>

```rust
use futures::future::Future;

async fn discover_endpoints_async(
    transport: &impl AsyncTransport,
) -> Result<Vec<EndpointInfo>, McptError> {
    let mut endpoints = Vec::new();

    // Broadcast discovery
    let request = build_discovery_request();
    transport.send_async(0xFF, &request).await?;

    // Collect responses with timeout
    let responses = tokio::time::timeout(
        Duration::from_millis(100),
        transport.receive_all_async()
    ).await.map_err(|_| McptError::Timeout)??;

    for response in responses {
        let endpoint = parse_endpoint_response(&response)?;
        endpoints.push(endpoint);
    }

    Ok(endpoints)
}
```

</details>

## Quiz

<div class="quiz" data-answer="The MCTP header contains source address, destination address, message type, message ID, and payload length">
<strong>Q1:</strong> What are the fields in an MCTP message header?

<details>
<summary>Answer</summary>
The MCTP header contains source address, destination address, message type, message ID, and payload length. These 6 bytes identify the source and destination endpoints, what protocol the message carries, and how much data follows.
</details>
</div>

<div class="quiz" data-answer="SMBus, I2C, and PCIe VDM are the three main transport bindings for MCTP">
<strong>Q2:</strong> What are the three main MCTP transport bindings?

<details>
<summary>Answer</summary>
SMBus, I2C, and PCIe VDM are the three main transport bindings for MCTP. Each provides different characteristics: SMBus for board-level management, I2C for chip-to-chip communication, and PCIe VDM for high-speed component management.
</details>
</div>

<div class="quiz" data-answer="CRC-16 is used to verify message integrity, calculated over the header and payload">
<strong>Q3:</strong> How does MCTP verify message integrity?

<details>
<summary>Answer</summary>
CRC-16 is used to verify message integrity, calculated over the header and payload. If the calculated CRC doesn't match the received CRC, the message is rejected as corrupted.
</details>
</div>

## Exercises

<div class="exercise">
<h3>Exercise 1: MCTP Message Builder</h3>
<p>Implement a builder pattern for constructing MCTP messages with optional fields.</p>

<details>
<summary>Solution</summary>

```rust
pub struct McptMessageBuilder {
    header: McptHeader,
    payload: Vec<u8>,
}

impl McptMessageBuilder {
    pub fn new(src: u8, dst: u8, msg_type: u8) -> Self {
        McptMessageBuilder {
            header: McptHeader::new(src, dst, msg_type, 0, 0),
            payload: Vec::new(),
        }
    }

    pub fn message_id(mut self, id: u8) -> Self {
        self.header.message_id = id;
        self
    }

    pub fn payload(mut self, data: &[u8]) -> Self {
        self.payload.extend_from_slice(data);
        self.header.payload_length = self.payload.len() as u16;
        self
    }

    pub fn payload_u8(mut self, value: u8) -> Self {
        self.payload.push(value);
        self.header.payload_length = self.payload.len() as u16;
        self
    }

    pub fn payload_u16(mut self, value: u16) -> Self {
        self.payload.extend_from_slice(&value.to_le_bytes());
        self.header.payload_length = self.payload.len() as u16;
        self
    }

    pub fn build(self) -> McptMessage {
        let checksum = McptMessage::calculate_checksum(&self.header, &self.payload);
        McptMessage {
            header: self.header,
            payload: self.payload,
            checksum,
        }
    }
}

// Usage
let message = McptMessageBuilder::new(0x00, 0x01, 0x00)
    .message_id(42)
    .payload_u8(0x01) // Command code
    .payload_u8(0x00) // Reserved
    .build();
```

</details>
</div>

<div class="exercise">
<h3>Exercise 2: Transport Abstraction</h3>
<p>Define a trait for MCTP transport and implement it for a mock transport for testing.</p>

<details>
<summary>Solution</summary>

```rust
pub trait McptTransport {
    fn send(&mut self, dest_eid: u8, data: &[u8]) -> Result<(), McptError>;
    fn receive(&mut self, timeout: Duration) -> Result<Vec<u8>, McptError>;
    fn get_own_eid(&self) -> u8;
}

// Mock transport for testing
pub struct MockTransport {
    own_eid: u8,
    sent_messages: Vec<(u8, Vec<u8>)>,
    receive_queue: Vec<Vec<u8>>,
}

impl MockTransport {
    pub fn new(eid: u8) -> Self {
        MockTransport {
            own_eid: eid,
            sent_messages: Vec::new(),
            receive_queue: Vec::new(),
        }
    }

    pub fn queue_response(&mut self, response: Vec<u8>) {
        self.receive_queue.push(response);
    }

    pub fn get_sent_messages(&self) -> &[(u8, Vec<u8>)] {
        &self.sent_messages
    }
}

impl McptTransport for MockTransport {
    fn send(&mut self, dest_eid: u8, data: &[u8]) -> Result<(), McptError> {
        self.sent_messages.push((dest_eid, data.to_vec()));
        Ok(())
    }

    fn receive(&mut self, _timeout: Duration) -> Result<Vec<u8>, McptError> {
        self.receive_queue.pop()
            .ok_or(McptError::Timeout)
    }

    fn get_own_eid(&self) -> u8 {
        self.own_eid
    }
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 3: Error Recovery</h3>
<p>Implement a retry mechanism with exponential backoff for MCTP message sending.</p>

<details>
<summary>Solution</summary>

```rust
pub struct McptClient<T: McptTransport> {
    transport: T,
    retry_policy: RetryPolicy,
}

struct RetryPolicy {
    max_retries: u32,
    base_timeout_ms: u32,
    max_timeout_ms: u32,
}

impl<T: McptTransport> McptClient<T> {
    pub fn new(transport: T) -> Self {
        McptClient {
            transport,
            retry_policy: RetryPolicy {
                max_retries: 3,
                base_timeout_ms: 100,
                max_timeout_ms: 5000,
            },
        }
    }

    pub fn send_with_retry(
        &mut self,
        dest_eid: u8,
        message: &McptMessage,
    ) -> Result<Vec<u8>, McptError> {
        let serialized = message.serialize();

        for attempt in 0..=self.retry_policy.max_retries {
            match self.transport.send(dest_eid, &serialized) {
                Ok(()) => {
                    let timeout = self.get_timeout(attempt);
                    match self.transport.receive(timeout) {
                        Ok(response) => return Ok(response),
                        Err(McptError::Timeout) => {
                            if attempt == self.retry_policy.max_retries {
                                return Err(McptError::Timeout);
                            }
                            // Wait before retry
                            cortex_m::asm::delay(self.get_delay_cycles(attempt));
                        }
                        Err(e) => return Err(e),
                    }
                }
                Err(McptError::TransportError(e)) if e.is_retryable() => {
                    if attempt == self.retry_policy.max_retries {
                        return Err(McptError::TransportError(e));
                    }
                }
                Err(e) => return Err(e),
            }
        }

        Err(McptError::MaxRetriesExceeded)
    }

    fn get_timeout(&self, attempt: u32) -> Duration {
        let ms = self.retry_policy.base_timeout_ms as u64 
            * 2u64.pow(attempt);
        Duration::from_millis(ms.min(self.retry_policy.max_timeout_ms as u64))
    }

    fn get_delay_cycles(&self, attempt: u32) -> u32 {
        let ms = self.retry_policy.base_timeout_ms * 2u32.pow(attempt);
        ms * 8000 // Assume 8MHz clock
    }
}
```

</details>
</div>

## Summary

In this chapter, you learned:

- **MCTP header structure** — source/dest addresses, message type, ID, payload length
- **Message types** — control, PLDM, vendor-defined, and others
- **Endpoint discovery** — finding and configuring devices on a bus
- **Transport bindings** — SMBus, I2C, and PCIe VDM implementations
- **Request/response flow** — message ID tracking and async patterns
- **Error handling** — completion codes, retry logic, and recovery
- **mctp-estack** — Rust MCTP implementation

In the next chapter, we'll explore SPDM and DICE — the security and trust protocols that build on top of MCTP.

<div class="chapter-nav">
<a href="{{ page.prev }}" class="btn">← Previous: Firmware Protocols</a>
<a href="{{ page.next }}" class="btn">Next: SPDM & DICE →</a>
</div>
