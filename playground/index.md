---
layout: default
title: "Interactive Playground"
---

# Interactive Playground

Practice Rust firmware concepts with these interactive examples. Modify the code and run it to see how changes affect the output.

---
layout: default
title: "Interactive Playground"
---

# Interactive Playground

Practice Rust firmware concepts with these interactive examples. Modify the code and run it to see how changes affect the output.

---

## 🔷 Bitwise Operator Cheat Sheet

Firmware engineering is **bit manipulation**. Every hardware register is a collection of bits that control pins, clocks, interrupts, and more.

```
OPERATOR    NAME            EXAMPLE           FIRMWARE USAGE                 BINARY INTUITION
──────────  ──────────────  ────────────────  ────────────────────────────   ───────────────────────
<<          LEFT SHIFT      1 << 3            Create bitmask for bit N      0001 → 1000  (×2^N)
>>          RIGHT SHIFT     0xF0 >> 4         Extract field, divide by 2^N  11110000 → 00001111
|           BITWISE OR      a | b             Set bits (combine masks)      0101|0011=0111
&           BITWISE AND     a & b             Check/isolate bits            0101&0011=0001
^           BITWISE XOR     a ^ b             Toggle bits, CRC, crypto      0101^0011=0110
|=          OR-ASSIGN       a |= mask         Set specific bits ON           a = a | mask
&=          AND-ASSIGN      a &= mask         Clear specific bits OFF        a = a & mask  
^=          XOR-ASSIGN      a ^= mask         Toggle specific bits           a = a ^ mask
!           BITWISE NOT     !(1 << bit)       Invert mask for clearing       (Rust: ! on ints = ~)
~           BITWISE NOT     ~mask             Alternative invert syntax      (C style; in Rust ! is ~)
```

### Common Firmware Patterns

```rust
// SET bit N:    reg |= 1 << N;       ← OR in a 1 at position N
// CLEAR bit N:  reg &= !(1 << N);    ← AND with inverted mask (all 1s except bit N)
// TOGGLE bit N: reg ^= 1 << N;       ← XOR flips bit N
// CHECK bit N:  if reg & (1 << N) != 0  ← AND isolates, check if nonzero
// MASK field:   (reg >> start) & ((1 << width) - 1)  ← shift then AND
// COMBINE vals: (val1 << 8) | val2   ← shift left + OR to pack bytes
```

### Why Every Operator Matters in Firmware

| Operator | Daily Firmware Use |
|----------|-------------------|
| `<<` | Set a specific bit: `1 << 5` = mask for bit 5. Pack multiple values into one register |
| `>>` | Extract a field: `(reg >> 12) & 0xF` gets 4 bits starting at position 12 |
| `|` | Turn on features: `RCC.ahb1enr |= GPIOA_EN` enables a peripheral clock |
| `&` | Check status: `if status & ERROR_FLAG != 0` checks if an error occurred |
| `^` | CRC calculation, DICE key derivation, toggling, encryption |
| `!` | Invert mask: `!(1 << 3)` = `0b11110111`, used in `&= !(1 << N)` to clear bit N |

---

## 1. no_std Basics

```rust
// This example shows no_std fundamentals
// Remove the std imports and add #![no_std] for embedded

fn main() {
    // Stack-allocated arrays (works in no_std)
    let measurements: [u32; 5] = [100, 200, 300, 400, 500];
    
    // Iterators (work in no_std)
    let sum: u32 = measurements.iter().sum();
    let avg = sum / measurements.len() as u32;
    
    println!("Measurements: {:?}", measurements);
    println!("Sum: {}, Average: {}", sum, avg);
    
    // Pattern matching (works in no_std)
    for &value in &measurements {
        match value {
            0..=100 => println!("  Low: {}", value),
            101..=400 => println!("  Medium: {}", value),
            _ => println!("  High: {}", value),
        }
    }
}
```

## 2. Volatile Register Access

```rust
// Simulating volatile register operations
// In real firmware, these would be memory-mapped

struct SimulatedRegister {
    value: u32,
}

impl SimulatedRegister {
    fn new() -> Self {
        SimulatedRegister { value: 0 }
    }
    
    // Simulates read_volatile
    fn read(&self) -> u32 {
        self.value
    }
    
    // Simulates write_volatile
    fn write(&mut self, val: u32) {
        self.value = val;
    }
    
    // ──────────────────────────────────────────────────────────────────────────
    // BIT MANIPULATION — the heart of firmware engineering
    //
    // Hardware registers are just collections of bits. Each bit (or group of bits)
    // controls a specific aspect of hardware: pin state, clock enable, interrupt mask, etc.
    //
    // The three fundamental operations are: SET, CLEAR, TOGGLE a specific bit.
    // ──────────────────────────────────────────────────────────────────────────

    // ── SET BIT ───────────────────────────────────────────────────────────────
    // Pattern:   reg |= 1 << N       (read: "reg OR-equals 1 shifted left by N")
    //
    // Step by step for set_bit(3):
    //   1. 1            = 0b00000000_00000000_00000000_00000001
    //   2. 1 << 3       = 0b00000000_00000000_00000000_00001000  (mask with bit 3 set)
    //                                                    ^-- bit 3
    //   3. old_value = 0b00000000_00000000_00000000_01100101  (example: 0x65)
    //   4. |= mask:     OR each bit. 0|0=0, 0|1=1, 1|0=1, 1|1=1
    //                    0b...01100101
    //                  | 0b...00001000
    //                  = 0b...01101101  ← bit 3 is now 1, others unchanged
    //
    // Practical use: enable a peripheral clock, set GPIO high, unmask interrupt
    fn set_bit(&mut self, bit: u8) {
        self.value |= 1 << bit;
    }
    
    // ── CLEAR BIT ─────────────────────────────────────────────────────────────
    // Pattern:   reg &= !(1 << N)    (read: "reg AND-equals NOT(1 shifted left by N)")
    //
    // Step by step for clear_bit(3):
    //   1. 1 << 3       = 0b00001000  (same mask as set_bit)
    //   2. !(1 << 3)    = 0b11110111  (bitwise NOT: every FLIPS, 0→1, 1→0)
    //                                      ^-- bit 3 is now 0 in the mask
    //   3. old_value    = 0b01101101  (from previous example)
    //   4. &= mask:     AND each bit. 0&0=0, 0&1=0, 1&0=0, 1&1=1
    //                    0b...01101101
    //                  & 0b...11110111
    //                  = 0b...01100101  ← bit 3 is now 0, all others preserved
    //
    // Why NOT? The pattern !(1 << N) creates a mask with ALL 1s EXCEPT bit N.
    // ANDing with this mask clears bit N while leaving everything else intact.
    //
    // In C:   ~(1 << N)     uses ~ for bitwise NOT
    // In Rust: !(1 << N)    uses !  for bitwise NOT (yes, ! is logical NOT in
    //                         booleans, but BITWISE NOT on integer types)
    //
    // CRITICAL: In Rust, on integers, ! is bitwise NOT (flips all bits).
    // On booleans, ! is logical NOT. This is a common point of confusion.
    // But for u8/u16/u32/u64, ! acts exactly like C's ~.
    //
    // Practical use: disable a peripheral, set GPIO low, clear interrupt flag
    fn clear_bit(&mut self, bit: u8) {
        self.value &= !(1 << bit);
    }
    
    // ── TOGGLE BIT ────────────────────────────────────────────────────────────
    // Pattern:   reg ^= 1 << N       (read: "reg XOR-equals 1 shifted left by N")
    //
    // XOR truth table:  0^0=0, 0^1=1, 1^0=1, 1^1=0
    //   Key insight: XOR with 1 FLIPS the bit. XOR with 0 LEAVES it alone.
    //
    // Step by step for toggle_bit(3):
    //   1. 1 << 3       = 0b00001000
    //   2. old_value    = 0b01101101
    //   3. ^= mask:
    //                    0b...01101101
    //                  ^ 0b...00001000
    //                  = 0b...01100101  ← bit 3 flipped: 1→0
    //
    // Run again:
    //                    0b...01100101
    //                  ^ 0b...00001000
    //                  = 0b...01101101  ← bit 3 flipped back: 0→1
    //
    // Practical use: toggle LED, alternate between two states, CRC calculation
    fn toggle_bit(&mut self, bit: u8) {
        self.value ^= 1 << bit;
    }
}

fn main() {
    let mut reg = SimulatedRegister::new();
    
    println!("Initial value: {:#010x}", reg.read());
    
    reg.set_bit(0);
    println!("After set_bit(0): {:#010x}", reg.read());
    
    reg.set_bit(7);
    println!("After set_bit(7): {:#010x}", reg.read());
    
    reg.toggle_bit(0);
    println!("After toggle_bit(0): {:#010x}", reg.read());
    
    reg.clear_bit(7);
    println!("After clear_bit(7): {:#010x}", reg.read());
}
```

## 3. MCTP Header Parsing

```rust
// MCTP header structure and parsing

#[derive(Debug, Clone, Copy)]
struct McptHeader {
    source_addr: u8,
    dest_addr: u8,
    message_type: u8,
    message_id: u8,
    payload_length: u16,
}

impl McptHeader {
    const SIZE: usize = 6;
    
    fn parse(buffer: &[u8]) -> Result<Self, String> {
        if buffer.len() < Self::SIZE {
            return Err("Buffer too small".to_string());
        }
        
        Ok(McptHeader {
            source_addr: buffer[0],
            dest_addr: buffer[1],
            message_type: buffer[2],
            message_id: buffer[3],
            payload_length: u16::from_le_bytes([buffer[4], buffer[5]]),
        })
    }
    
    fn serialize(&self) -> [u8; 6] {
        let mut buffer = [0u8; 6];
        buffer[0] = self.source_addr;
        buffer[1] = self.dest_addr;
        buffer[2] = self.message_type;
        buffer[3] = self.message_id;
        let len_bytes = self.payload_length.to_le_bytes();
        buffer[4] = len_bytes[0];
        buffer[5] = len_bytes[1];
        buffer
    }
}

fn main() {
    // Create a header
    let header = McptHeader {
        source_addr: 0x01,
        dest_addr: 0x02,
        message_type: 0x00, // MCTP control
        message_id: 42,
        payload_length: 100,
    };
    
    println!("Original header: {:?}", header);
    
    // Serialize
    let serialized = header.serialize();
    println!("Serialized: {:02x?}", serialized);
    
    // Parse back
    let parsed = McptHeader::parse(&serialized).unwrap();
    println!("Parsed: {:?}", parsed);
    
    // Verify roundtrip
    assert_eq!(header.source_addr, parsed.source_addr);
    assert_eq!(header.dest_addr, parsed.dest_addr);
    assert_eq!(header.message_type, parsed.message_type);
    assert_eq!(header.message_id, parsed.message_id);
    assert_eq!(header.payload_length, parsed.payload_length);
    
    println!("Roundtrip successful!");
}
```

## 4. CRC-16 Calculation

```rust
// CRC-16 calculation used in MCTP and other protocols
//
// ── WHAT IS CRC? ─────────────────────────────────────────────────────────────
// Cyclic Redundancy Check — a hash that detects accidental data corruption.
// It's NOT cryptographic (unlike SHA). It's designed to catch:
//   - Single-bit errors
//   - Burst errors (multiple consecutive flipped bits)
//   - Most common transmission errors
//
// CRC is essentially POLYNOMIAL DIVISION in binary. The "polynomial" for the
// commonly used CRC-16-IBM is 0xA001 (reversed form of 0x8005).
//
// ── BITWISE OPERATORS IN CRC ────────────────────────────────────────────────
//   ^  (XOR)  — the core of CRC: polynomial "subtraction" is XOR
//   >> (RSH)  — shift bits right, feeding through the polynomial
//   &  (AND)  — check if the LSB (least significant bit) is 1

fn crc16(data: &[u8]) -> u16 {
    // 0xFFFF is the initial value. All 16 bits set to 1.
    // This prevents a leading zero from producing a zero CRC.
    let mut crc: u16 = 0xFFFF;
    
    for &byte in data {
        // ── XOR the next byte into the CRC ───────────────────────────────────
        // crc (u16)         = 0bHHHH_HHHH_LLLL_LLLL   (high byte, low byte)
        // byte as u16       = 0b0000_0000_BBBB_BBBB
        // crc ^= byte       = XOR each bit position
        //
        // XOR truth: 0^0=0, 0^1=1, 1^0=1, 1^1=0
        // This "feeds" the data byte into the CRC accumulator.
        //
        // Practical: XOR is reversible! CRC(XOR(a,b)) = CRC(a) XOR CRC(b)
        // This is why CRC is good for detecting errors but NOT cryptographically secure.
        crc ^= byte as u16;
        
        // ── Process 8 bits (one byte) ────────────────────────────────────────
        for _ in 0..8 {
            // ── Check LSB with & ─────────────────────────────────────────────
            // crc & 1  = isolate the least significant bit (bit 0)
            //   crc = 0b...XXXX_XXX1
            // &   1 = 0b...0000_0001
            //        = 0b...0000_0001  (nonzero → true)
            //
            // This checks whether a 1 "fell off" the right side on the next shift.
            // If so, we need to XOR with the polynomial to "reflect" it back.
            if crc & 1 != 0 {
                // ── Right shift + polynomial ─────────────────────────────────
                // crc >> 1  = shift all bits right by 1 (divide by 2)
                //   0bABCD_EFGH >> 1 = 0b0ABC_DEFG
                //
                // ^ 0xA001 = XOR with the CRC-16-IBM polynomial (reflected)
                //   0xA001 = 0b1010_0000_0000_0001
                //
                // Why XOR? Shifting right drops the LSB. But in CRC, that bit
                // represents a term in the polynomial that must be "fed back."
                // XOR with the polynomial compensates for the lost term.
                crc = (crc >> 1) ^ 0xA001;
            } else {
                // ── Just right shift (no polynomial feedback) ────────────────
                // If LSB was 0, nothing to feed back — just shift.
                // crc >>= 1 is equivalent to crc = crc >> 1
                crc >>= 1;
            }
        }
    }
    
    crc
}

fn main() {
    let test_data = b"Hello, MCTP!";
    let crc = crc16(test_data);
    
    println!("Data: {}", String::from_utf8_lossy(test_data));
    println!("CRC-16: {:#06x}", crc);
    
    // Verify CRC is appended correctly
    let mut data_with_crc = test_data.to_vec();
    let crc_bytes = crc.to_le_bytes();
    data_with_crc.extend_from_slice(&crc_bytes);
    
    let verified_crc = crc16(&data_with_crc);
    println!("Verification CRC: {:#06x} (should be 0x0000)", verified_crc);
}
```

## 5. DICE CDI Generation

```rust
// Simplified DICE CDI generation using HMAC-SHA256
//
// ── WHY XOR IN CRYPTO? ───────────────────────────────────────────────────────
// XOR is the universal primitive in cryptography because:
//   a) It's REVERSIBLE:   (a ^ b) ^ b = a   (XOR twice = identity)
//   b) It's BALANCED:     each output bit depends equally on both input bits
//   c) It's FAST:         single instruction on any CPU
//
// Real symmetric ciphers (AES, ChaCha20) use XOR as their final mixing step.
// HMAC uses XOR for inner/outer padding (ipad/opad):
//   ipad = key ^ 0x363636...   (the "inner" pad)
//   opad = key ^ 0x5C5C5C...   (the "outer" pad)
//
// In DICE, XOR isn't the real HMAC — this is a simulation to demonstrate
// how XOR integrates into a layered security scheme.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

// Simple HMAC simulation (real implementation uses crypto library)
fn simple_hmac(key: &[u8], data: &[u8]) -> [u8; 32] {
    let mut result = [0u8; 32];
    
    // ── XOR for key-data mixing ──────────────────────────────────────────────
    // This simulates the real HMAC inner/outer pad construction:
    //   Real:  inner = H((K ^ ipad) || message)
    //   Here:  result[i] = key_byte ^ data_byte  (simplified)
    //
    // ^ (XOR) on each byte position:
    //   key_byte  = 0b1100_1010
    //   data_byte = 0b1010_1111
    //   result    = 0b0110_0101   ← bits differ → 1, bits same → 0
    //
    // XOR with key gives us a MIXED value where neither key nor data
    // alone determines the output. This is the avalanche principle.
    for i in 0..32 {
        let key_byte = key.get(i % key.len()).copied().unwrap_or(0);
        let data_byte = data.get(i % data.len()).copied().unwrap_or(0);
        result[i] = key_byte ^ data_byte;
    }
    
    // Hash the result (simplified)
    let mut hasher = DefaultHasher::new();
    result.hash(&mut hasher);
    let hash = hasher.finish().to_le_bytes();
    
    // ── XOR to fold hash back into result ────────────────────────────────────
    // The 8-byte hash is folded into the 32-byte result with XOR.
    // This spreads the hash's entropy across all positions.
    //
    // result[i % 32] ^= hash[i];
    //   meaning: result[pos] = result[pos] ^ hash[i]
    //
    // Since i % 32 gives 0..7 (hash is 8 bytes), each hash byte XORs
    // into four different result positions:
    //   hash[0] → result[0], result[8],  result[16], result[24]
    //   hash[1] → result[1], result[9],  result[17], result[25]
    //   ...
    //
    // Unlike |= (set) and &= (clear), ^= FLIPS bits rather than fixing them.
    // This is essential for diffusion — small input changes cascade.
    for i in 0..8 {
        result[i % 32] ^= hash[i];
    }
    
    result
}

fn main() {
    println!("=== DICE CDI Generation ===\n");
    
    // Hardware Root of Trust (simulated)
    let uds: [u8; 32] = [0x11; 32];
    println!("UDS (Device Unique Secret): {:02x?}", uds);
    
    // ROM Stage
    let rom_cdi = simple_hmac(&uds, b"caliptra-rom");
    println!("\nROM CDI: {:02x?}", rom_cdi);
    
    // FMC Stage
    let fmc_code_hash = [0x22; 32]; // Simulated code hash
    let fmc_cdi = simple_hmac(&rom_cdi, &fmc_code_hash);
    println!("FMC CDI: {:02x?}", fmc_cdi);
    
    // Runtime Stage
    let runtime_code_hash = [0x33; 32]; // Simulated code hash
    let runtime_cdi = simple_hmac(&fmc_cdi, &runtime_code_hash);
    println!("Runtime CDI: {:02x?}", runtime_cdi);
    
    // Derive signing key from runtime CDI
    let signing_key = simple_hmac(&runtime_cdi, b"signing");
    println!("\nSigning Key: {:02x?}", signing_key);
    
    println!("\n=== Each layer creates unique CDI from previous ===");
}
```

## 6. PCR Bank Operations

```rust
// Platform Configuration Register (PCR) simulation

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

fn sha256_simulate(data: &[u8]) -> [u8; 32] {
    let mut result = [0u8; 32];
    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    let hash = hasher.finish().to_le_bytes();
    
    // ── XOR for position-dependent mixing ────────────────────────────────────
    // hash[i % 8] ^ (i as u8)
    //
    // This XORs each hash byte with its position index to ensure that
    // even if the hash is all zeros, different positions get different values.
    //
    //   i=0:  hash[0] ^ 0x00  = hash[0]   (unchanged)
    //   i=1:  hash[1] ^ 0x01  = hash[1] flipped at bit 0
    //   i=2:  hash[2] ^ 0x02  = hash[2] flipped at bit 1
    //   i=8:  hash[0] ^ 0x08  = same hash byte, but bit 3 flipped
    //
    // Without XOR, hash[i % 8] would repeat every 8 bytes identically.
    // The ^ (i as u8) breaks this symmetry — each position is unique.
    for i in 0..32 {
        result[i] = hash[i % 8] ^ (i as u8);
    }
    
    result
}

struct PcrBank {
    pcrs: Vec<[u8; 32]>,
}

impl PcrBank {
    fn new(num_pcrs: usize) -> Self {
        PcrBank {
            pcrs: vec![[0u8; 32]; num_pcrs],
        }
    }
    
    fn extend(&mut self, index: usize, data: &[u8]) {
        if index >= self.pcrs.len() {
            panic!("Invalid PCR index");
        }
        
        // PCR extend: new = SHA256(old || data)
        let old = self.pcrs[index];
        let mut input = Vec::new();
        input.extend_from_slice(&old);
        input.extend_from_slice(data);
        
        self.pcrs[index] = sha256_simulate(&input);
    }
    
    fn read(&self, index: usize) -> [u8; 32] {
        self.pcrs[index]
    }
}

fn main() {
    println!("=== PCR Bank Operations ===\n");
    
    let mut bank = PcrBank::new(8);
    
    // Measure ROM
    let rom_hash = sha256_simulate(b"ROM firmware code");
    bank.extend(0, &rom_hash);
    println!("PCR[0] (ROM): {:02x?}", bank.read(0));
    
    // Measure FMC
    let fmc_hash = sha256_simulate(b"FMC firmware code");
    bank.extend(1, &fmc_hash);
    println!("PCR[1] (FMC): {:02x?}", bank.read(1));
    
    // Measure Runtime
    let runtime_hash = sha256_simulate(b"Runtime firmware");
    bank.extend(2, &runtime_hash);
    println!("PCR[2] (Runtime): {:02x?}", bank.read(2));
    
    // Extend same PCR again (measures multiple stages)
    bank.extend(0, &fmc_hash);
    println!("\nPCR[0] after FMC measure: {:02x?}", bank.read(0));
    
    println!("\n=== PCR values change with each measurement ===");
}
```

## 7. Hubris Task Communication

```rust
// Simulating Hubris IPC between tasks

use std::sync::mpsc;
use std::thread;

#[derive(Debug)]
enum CaliptraRequest {
    GetAttestation,
    GetMeasurements,
    GetVersion,
}

#[derive(Debug)]
enum CaliptraResponse {
    Attestation(Vec<u8>),
    Measurements([u8; 32]),
    Version(String),
}

fn caliptra_task(rx: mpsc::Receiver<(CaliptraRequest, mpsc::Sender<CaliptraResponse>)>) {
    for (request, response_tx) in rx {
        match request {
            CaliptraRequest::GetAttestation => {
                let attestation = vec![0x01, 0x02, 0x03]; // Simulated
                response_tx.send(CaliptraResponse::Attestation(attestation)).unwrap();
            }
            CaliptraRequest::GetMeasurements => {
                let measurements = [0xAA; 32]; // Simulated
                response_tx.send(CaliptraResponse::Measurements(measurements)).unwrap();
            }
            CaliptraRequest::GetVersion => {
                response_tx.send(CaliptraResponse::Version("1.0.0".to_string())).unwrap();
            }
        }
    }
}

fn main() {
    println!("=== Hubris Task Communication Simulation ===\n");
    
    let (tx, rx) = mpsc::channel();
    
    // Spawn caliptra task
    let handle = thread::spawn(move || {
        caliptra_task(rx);
    });
    
    // Client sends requests
    let requests = vec![
        CaliptraRequest::GetVersion,
        CaliptraRequest::GetMeasurements,
        CaliptraRequest::GetAttestation,
    ];
    
    for request in requests {
        let (response_tx, response_rx) = mpsc::channel();
        tx.send((request, response_rx.recv().unwrap())).unwrap();
        // In real Hubris, this would be IPC
    }
    
    // For demo, just send directly
    let (resp_tx, resp_rx) = mpsc::channel();
    tx.send((CaliptraRequest::GetVersion, resp_tx)).unwrap();
    
    if let Ok(response) = resp_rx.recv() {
        println!("Response: {:?}", response);
    }
    
    drop(tx);
    handle.join().unwrap();
    
    println!("\n=== Tasks communicate via message passing ===");
}
```

## 8. Protocol Comparison

```rust
// Comparing different firmware protocols

struct ProtocolInfo {
    name: &'static str,
    layer: &'static str,
    purpose: &'static str,
    transport: &'static str,
}

fn main() {
    let protocols = vec![
        ProtocolInfo {
            name: "MCTP",
            layer: "Transport",
            purpose: "Message transport between management components",
            transport: "SMBus, I2C, PCIe VDM",
        },
        ProtocolInfo {
            name: "SPDM",
            layer: "Security",
            purpose: "Device authentication and key exchange",
            transport: "Any MCTP transport",
        },
        ProtocolInfo {
            name: "PLDM",
            layer: "Data Model",
            purpose: "Platform data exchange and firmware updates",
            transport: "Any MCTP transport",
        },
        ProtocolInfo {
            name: "DICE",
            layer: "Trust",
            purpose: "Hardware-rooted attestation",
            transport: "Hardware (ROM/FMC/Runtime)",
        },
    ];
    
    println!("=== Firmware Protocol Comparison ===\n");
    
    println!("{:<10} {:<15} {:<45} {}", "Protocol", "Layer", "Purpose", "Transport");
    println!("{}", "-".repeat(100));
    
    for proto in &protocols {
        println!(
            "{:<10} {:<15} {:<45} {}",
            proto.name, proto.layer, proto.purpose, proto.transport
        );
    }
    
    println!("\n=== These protocols work together in a secure platform ===");
    println!("MCTP provides transport, SPDM adds security, PLDM defines data, DICE creates trust.");
}
```

## 9. Binary Serialization

```rust
// Common binary serialization patterns in firmware

fn serialize_u16_le(value: u16) -> [u8; 2] {
    value.to_le_bytes()
}

fn deserialize_u16_le(buffer: &[u8]) -> Result<u16, String> {
    if buffer.len() < 2 {
        return Err("Buffer too small".to_string());
    }
    Ok(u16::from_le_bytes([buffer[0], buffer[1]]))
}

fn serialize_u32_le(value: u32) -> [u8; 4] {
    value.to_le_bytes()
}

fn deserialize_u32_le(buffer: &[u8]) -> Result<u32, String> {
    if buffer.len() < 4 {
        return Err("Buffer too small".to_string());
    }
    Ok(u32::from_le_bytes([buffer[0], buffer[1], buffer[2], buffer[3]]))
}

#[derive(Debug)]
struct FirmwareHeader {
    magic: u32,
    version: u16,
    size: u32,
    checksum: u16,
}

impl FirmwareHeader {
    fn serialize(&self) -> Vec<u8> {
        let mut buffer = Vec::new();
        buffer.extend_from_slice(&serialize_u32_le(self.magic));
        buffer.extend_from_slice(&serialize_u16_le(self.version));
        buffer.extend_from_slice(&serialize_u32_le(self.size));
        buffer.extend_from_slice(&serialize_u16_le(self.checksum));
        buffer
    }
    
    fn parse(buffer: &[u8]) -> Result<Self, String> {
        if buffer.len() < 12 {
            return Err("Buffer too small".to_string());
        }
        
        Ok(FirmwareHeader {
            magic: deserialize_u32_le(&buffer[0..4])?,
            version: deserialize_u16_le(&buffer[4..6])?,
            size: deserialize_u32_le(&buffer[6..10])?,
            checksum: deserialize_u16_le(&buffer[10..12])?,
        })
    }
}

fn main() {
    println!("=== Binary Serialization ===\n");
    
    let header = FirmwareHeader {
        magic: 0x46575254, // "FWRT"
        version: 0x0100,
        size: 65536,
        checksum: 0xABCD,
    };
    
    println!("Original: {:?}", header);
    
    let serialized = header.serialize();
    println!("Serialized: {:02x?}", serialized);
    
    let parsed = FirmwareHeader::parse(&serialized).unwrap();
    println!("Parsed: {:?}", parsed);
    
    println!("\n=== Little-endian is standard for firmware ===");
}
```

## 10. Error Handling Patterns

```rust
// Common error handling patterns in firmware

#[derive(Debug)]
enum FirmwareError {
    InvalidHeader,
    ChecksumMismatch,
    BufferTooSmall,
    DeviceNotFound,
    Timeout,
    UnsupportedCommand,
}

impl std::fmt::Display for FirmwareError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            FirmwareError::InvalidHeader => write!(f, "Invalid header magic"),
            FirmwareError::ChecksumMismatch => write!(f, "Checksum verification failed"),
            FirmwareError::BufferTooSmall => write!(f, "Buffer too small"),
            FirmwareError::DeviceNotFound => write!(f, "Device not found"),
            FirmwareError::Timeout => write!(f, "Operation timed out"),
            FirmwareError::UnsupportedCommand => write!(f, "Unsupported command"),
        }
    }
}

fn validate_firmware(data: &[u8]) -> Result<(), FirmwareError> {
    if data.len() < 12 {
        return Err(FirmwareError::BufferTooSmall);
    }
    
    // Check magic number
    let magic = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
    if magic != 0x46575254 {
        return Err(FirmwareError::InvalidHeader);
    }
    
    // Verify checksum
    let stored_checksum = u16::from_le_bytes([data[10], data[11]]);
    let calculated_checksum: u16 = data[..10].iter().fold(0u16, |acc, &b| {
        acc.wrapping_add(b as u16)
    });
    
    if stored_checksum != calculated_checksum {
        return Err(FirmwareError::ChecksumMismatch);
    }
    
    Ok(())
}

fn main() {
    println!("=== Error Handling Patterns ===\n");
    
    // Valid firmware
    let mut valid_firmware = vec![0u8; 64];
    valid_firmware[0..4].copy_from_slice(&0x46575254u32.to_le_bytes());
    valid_firmware[4..6].copy_from_slice(&0x0100u16.to_le_bytes());
    valid_firmware[6..10].copy_from_slice(&64u32.to_le_bytes());
    
    // Calculate checksum
    let checksum: u16 = valid_firmware[..10].iter().fold(0u16, |acc, &b| {
        acc.wrapping_add(b as u16)
    });
    valid_firmware[10..12].copy_from_slice(&checksum.to_le_bytes());
    
    match validate_firmware(&valid_firmware) {
        Ok(()) => println!("Valid firmware: OK"),
        Err(e) => println!("Valid firmware: Error - {}", e),
    }
    
    // Invalid firmware (wrong magic)
    let mut invalid_firmware = valid_firmware.clone();
    invalid_firmware[0] = 0xFF;
    
    match validate_firmware(&invalid_firmware) {
        Ok(()) => println!("Invalid firmware: OK"),
        Err(e) => println!("Invalid firmware: Error - {}", e),
    }
    
    // Too small
    let small_data = vec![0u8; 4];
    
    match validate_firmware(&small_data) {
        Ok(()) => println!("Small data: OK"),
        Err(e) => println!("Small data: Error - {}", e),
    }
    
    println!("\n=== Use Result<T, E> for recoverable errors ===");
}
```

## Running the Examples

Each example above can be run in the Rust Playground or locally:

1. Copy the code into a new Rust project: `cargo new playground && cd playground`
2. Replace `src/main.rs` with the example code
3. Run with `cargo run`

For no_std examples, you'll need to:
- Add `#![no_std]` and `#![no_main]`
- Use a cross-compilation target
- Provide a panic handler
- Use `#[entry]` attribute for the main function

## Next Steps

After completing these examples:
1. Try the exercises in each chapter
2. Build the portfolio projects
3. Contribute to open-source firmware projects
4. Apply your knowledge to real hardware
