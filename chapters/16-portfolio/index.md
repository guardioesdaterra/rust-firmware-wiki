---
layout: chapter
title: "Portfolio Projects"
chapter: 16
progress: 100
prev: /chapters/15-openprot/
next: null
---

# Portfolio Projects

{% include callout.html type="info" title="Why this matters" content="A strong portfolio demonstrates practical firmware engineering skills to potential employers. Working projects with proper documentation, tests, and CI show real capability. These five projects cover the essential skills for firmware engineering positions." %}

## Portfolio Overview

This chapter presents five portfolio projects that demonstrate progressively advanced Rust firmware skills. Each project builds on the previous ones, creating a comprehensive portfolio.

| Project | Skills Demonstrated | Difficulty | Time |
|---------|---------------------|------------|------|
| no-std-playground | Basic no_std, HAL traits | Beginner | 2-3 days |
| mctp-protocol-rs | Protocol implementation | Intermediate | 1-2 weeks |
| caliptra-examples | DICE, attestation | Advanced | 2-3 weeks |
| hubris-learning | RTOS, IPC, tasks | Advanced | 2-3 weeks |
| firmware-portfolio | Portfolio presentation | Beginner | 1 day |

## Project 1: no-std-playground

A collection of no_std Rust examples for embedded systems.

### Repository Structure

```text
no-std-playground/
├── Cargo.toml
├── README.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── lib.rs
│   ├── basics/
│   │   ├── mod.rs
│   │   ├── no_std_basics.rs
│   │   ├── panic_handler.rs
│   │   └── alloc_example.rs
│   ├── hal/
│   │   ├── mod.rs
│   │   ├── gpio.rs
│   │   ├── uart.rs
│   │   └── spi.rs
│   └── examples/
│       ├── mod.rs
│       ├── led_blink.rs
│       ├── button_input.rs
│       └── sensor_reading.rs
└── tests/
    └── integration_tests.rs
```

### README Template

```markdown
# no-std Playground

A collection of no_std Rust examples for embedded systems development.

## Overview

This project demonstrates fundamental concepts in embedded Rust:
- Setting up no_std projects
- Custom panic handlers
- GPIO, UART, and SPI implementations
- Reading sensors and controlling LEDs

## Hardware Requirements

- STM32F411 Discovery Board (or similar)
- ST-Link debugger
- LED, button, and sensor modules

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/no-std-playground.git
cd no-std-playground

# Build for STM32F411
cargo build --target thumbv7em-none-eabihf --release

# Flash to hardware
cargo run --release
```

## Project Structure

- `src/basics/` - Fundamental no_std concepts
- `src/hal/` - Hardware abstraction layer implementations
- `src/examples/` - Complete working examples

## Learning Path

1. Start with `basics/no_std_basics.rs`
2. Review the panic handler in `basics/panic_handler.rs`
3. Try the GPIO example in `examples/led_blink.rs`
4. Advance to sensor reading in `examples/sensor_reading.rs`

## Contributing

Contributions welcome! Please read CONTRIBUTING.md first.

## License

MIT OR Apache-2.0
```

### CI Configuration

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  CARGO_TERM_COLOR: always

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: thumbv7em-none-eabihf

      - name: Build
        run: cargo build --target thumbv7em-none-eabihf --release

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Run tests
        run: cargo test

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt

      - name: Check formatting
        run: cargo fmt -- --check

      - name: Run clippy
        run: cargo clippy -- -D warnings
```

### Example Code

```rust
// src/basics/no_std_basics.rs
#![no_std]
#![no_main]

use cortex_m_rt::entry;
use panic_halt as _;

#[entry]
fn main() -> ! {
    // Basic no_std example
    let x: [u32; 4] = [1, 2, 3, 4];
    let sum: u32 = x.iter().sum();

    // Cannot use println! without std
    // Cannot use heap allocation without alloc

    loop {
        cortex_m::asm::wfi();
    }
}
```

## Project 2: mctp-protocol-rs

A complete MCTP protocol implementation in Rust.

### Repository Structure

```text
mctp-protocol-rs/
├── Cargo.toml
├── README.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── lib.rs
│   ├── header.rs          # MCTP header parsing
│   ├── message.rs         # Message types
│   ├── transport/
│   │   ├── mod.rs
│   │   ├── smbus.rs       # SMBus transport
│   │   ├── i2c.rs         # I2C transport
│   │   └── pcie.rs        # PCIe VDM transport
│   ├── handler/
│   │   ├── mod.rs
│   │   ├── control.rs     # Control messages
│   │   └── vendor.rs      # Vendor-defined messages
│   └── error.rs           # Error types
├── examples/
│   ├── discover_endpoints.rs
│   ├── send_message.rs
│   └── listen_messages.rs
└── tests/
    ├── header_tests.rs
    ├── message_tests.rs
    └── integration_tests.rs
```

### README Template

```markdown
# mctp-protocol-rs

A complete MCTP (Management Component Transport Protocol) implementation in Rust.

## Overview

This crate provides a type-safe, no_std-compatible implementation of the MCTP protocol as defined in DMTF DSP0236.

## Features

- **Type-safe headers** - Compile-time validation of message fields
- **Multiple transports** - SMBus, I2C, and PCIe VDM
- **Message parsing** - Complete MCTP message serialization/deserialization
- **Error handling** - Comprehensive error types with recovery
- **no_std compatible** - Works in embedded environments
- **Async support** - Optional async/await interface

## Usage

```rust
use mctp_protocol::{Mcpt, McptMessage, TransportType};

// Initialize with SMBus transport
let transport = SMBusTransport::new(i2c_bus, 0x20);
let mut mctp = Mcpt::new(transport);

// Discover endpoints
let endpoints = mctp.discover()?;

// Send a message
let response = mctp.send(1, 0x01, &payload)?;
```

## Examples

```bash
# Run the endpoint discovery example
cargo run --example discover_endpoints

# Run the message listener
cargo run --example listen_messages
```

## Documentation

- [API Documentation](https://docs.rs/mctp-protocol-rs)
- [MCTP Specification (DSP0236)](https://www.dmtf.org/standards/DSP0236)
- [Examples](./examples/)

## Contributing

See CONTRIBUTING.md for guidelines.

## License

Apache-2.0
```

### Example Code

```rust
// src/header.rs
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

    pub fn parse(buffer: &[u8]) -> Result<Self, McptError> {
        if buffer.len() < Self::SIZE {
            return Err(McptError::BufferTooSmall);
        }

        Ok(McptHeader {
            source_addr: buffer[0],
            dest_addr: buffer[1],
            message_type: buffer[2],
            message_id: buffer[3],
            payload_length: u16::from_le_bytes([buffer[4], buffer[5]]),
        })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_header_parse() {
        let buffer = [0x01, 0x02, 0x00, 0x05, 0x0A, 0x00];
        let header = McptHeader::parse(&buffer).unwrap();

        assert_eq!(header.source_addr, 0x01);
        assert_eq!(header.dest_addr, 0x02);
        assert_eq!(header.message_type, 0x00);
        assert_eq!(header.message_id, 0x05);
        assert_eq!(header.payload_length, 10);
    }

    #[test]
    fn test_header_serialize() {
        let header = McptHeader {
            source_addr: 0x01,
            dest_addr: 0x02,
            message_type: 0x00,
            message_id: 0x05,
            payload_length: 10,
        };

        let mut buffer = [0u8; 6];
        header.serialize(&mut buffer).unwrap();

        assert_eq!(buffer, [0x01, 0x02, 0x00, 0x05, 0x0A, 0x00]);
    }
}
```

## Project 3: caliptra-examples

Example implementations of Caliptra attestation and DICE.

### Repository Structure

```text
caliptra-examples/
├── Cargo.toml
├── README.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── examples/
│   ├── dice_chain.rs       # DICE certificate chain generation
│   ├── attestation.rs      # Device attestation flow
│   ├── pcr_measurement.rs  # PCR bank operations
│   └── key_derivation.rs   # CDI and key derivation
├── src/
│   ├── lib.rs
│   ├── dice.rs
│   ├── attestation.rs
│   └── pcr.rs
└── tests/
    ├── dice_tests.rs
    └── attestation_tests.rs
```

### README Template

```markdown
# caliptra-examples

Example implementations of Caliptra DICE attestation in Rust.

## Overview

This repository contains working examples of Caliptra-related functionality:
- DICE certificate chain generation
- Device attestation flows
- PCR measurement operations
- CDI and key derivation

## Examples

### DICE Chain Generation

Demonstrates creating a DICE certificate chain from ROM to Runtime.

```bash
cargo run --example dice_chain
```

### Device Attestation

Shows the complete attestation flow including challenge-response.

```bash
cargo run --example attestation
```

### PCR Measurement

Illustrates extending and reading PCR values.

```bash
cargo run --example pcr_measurement
```

### Key Derivation

Demonstrates CDI and key derivation functions.

```bash
cargo run --example key_derivation
```

## Learning Path

1. Start with `examples/key_derivation.rs`
2. Review `examples/pcr_measurement.rs`
3. Understand `examples/dice_chain.rs`
4. Complete with `examples/attestation.rs`

## Dependencies

- `sha2` - SHA-256 hashing
- `p256` - ECDSA P-256 cryptography
- `hmac` - HMAC for CDI generation
- `hkdf` - Key derivation

## References

- [Caliptra Specification](https://github.com/chipsalliance/caliptra-sw)
- [DICE Standard](https://trustedcomputinggroup.org/resource/dice/)
- [SPDM Specification](https://www.dmtf.org/standards/DSP0274)

## License

Apache-2.0
```

### Example Code

```rust
// examples/dice_chain.rs
use caliptra_examples::{DiceChain, DiceTcbInfo};
use sha2::{Sha256, Digest};

fn main() {
    println!("=== DICE Certificate Chain Generation ===\n");

    // Simulate ROM stage
    let rom_cdi = [0x11; 32];
    let rom_tcb = DiceTcbInfo {
        version: 0,
        svn: 1,
        vendor_id: *b"Example          ",
        vendor_info: [0u8; 16],
        flags: 0x01,
    };

    println!("ROM Stage:");
    println!("  CDI: {:02x?}", rom_cdi);
    println!("  TCB: {:?}", rom_tcb);

    // Generate FMC CDI
    let fmc_code_hash = Sha256::digest(b"fmc firmware code");
    let fmc_cdi = hmac_sha256(&rom_cdi, &fmc_code_hash);

    let fmc_tcb = DiceTcbInfo {
        version: 1,
        svn: 1,
        vendor_id: *b"Example          ",
        vendor_info: [0u8; 16],
        flags: 0x02,
    };

    println!("\nFMC Stage:");
    println!("  Code hash: {:02x?}", fmc_code_hash);
    println!("  CDI: {:02x?}", fmc_cdi);
    println!("  TCB: {:?}", fmc_tcb);

    // Generate Runtime CDI
    let rt_code_hash = Sha256::digest(b"runtime firmware code");
    let rt_cdi = hmac_sha256(&fmc_cdi, &rt_code_hash);

    let rt_tcb = DiceTcbInfo {
        version: 2,
        svn: 1,
        vendor_id: *b"Example          ",
        vendor_info: [0u8; 16],
        flags: 0x04,
    };

    println!("\nRuntime Stage:");
    println!("  Code hash: {:02x?}", rt_code_hash);
    println!("  CDI: {:02x?}", rt_cdi);
    println!("  TCB: {:?}", rt_tcb);

    println!("\n=== DICE Chain Complete ===");
}

fn hmac_sha256(key: &[u8; 32], data: &[u8]) -> [u8; 32] {
    use hmac::{Hmac, Mac};
    type HmacSha256 = Hmac<Sha256>;

    let mut mac = HmacSha256::new_from_slice(key).unwrap();
    mac.update(data);
    mac.finalize().into_bytes().into()
}
```

## Project 4: hubris-learning

Learning Hubris RTOS concepts through practical examples.

### Repository Structure

```text
hubris-learning/
├── Cargo.toml
├── README.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── task-diagram.toml       # Hubris task configuration
├── tasks/
│   ├── blink/
│   │   ├── main.rs
│   │   └── Cargo.toml
│   ├── button/
│   │   ├── main.rs
│   │   └── Cargo.toml
│   ├── console/
│   │   ├── main.rs
│   │   └── Cargo.toml
│   └── sensor/
│       ├── main.rs
│       └── Cargo.toml
└── examples/
    ├── task_communication.rs
    └── shared_resources.rs
```

### README Template

```markdown
# hubris-learning

Learning Hubris RTOS through practical examples.

## Overview

This repository contains examples for learning Hubris RTOS concepts:
- Task creation and isolation
- Inter-Process Communication (IPC)
- Shared resource management
- Hardware abstraction

## Prerequisites

- Hubris development environment
- STM32F4 Discovery Board
- ST-Link debugger

## Examples

### Task Communication

Demonstrates basic IPC between two tasks.

```bash
cargo xtask build task_communication
cargo xtask boot task_communication
```

### Shared Resources

Shows how to safely share hardware between tasks.

```bash
cargo xtask build shared_resources
cargo xtask boot shared_resources
```

## Task Configuration

The `task-diagram.toml` file defines the task layout:

```toml
[tasks.blink]
name = "LED Blink"
stack_size = 1024

[tasks.button]
name = "Button Handler"
stack_size = 1024
```

## Learning Path

1. Read the Hubris documentation
2. Run the `task_communication` example
3. Study the `shared_resources` example
4. Create your own tasks

## References

- [Hubris Documentation](https://hubris.oxide.computer/)
- [Hubris Repository](https://github.com/oxidecomputer/hubris)

## License

MIT OR Apache-2.0
```

## Project 5: firmware-portfolio

A portfolio project showcasing all your firmware skills.

### Repository Structure

```text
firmware-portfolio/
├── Cargo.toml
├── README.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── lib.rs
│   ├── no_std_examples/
│   │   └── mod.rs
│   ├── mctp_examples/
│   │   └── mod.rs
│   ├── caliptra_examples/
│   │   └── mod.rs
│   └── hubris_examples/
│       └── mod.rs
└── docs/
    ├── architecture.md
    └── learning-journal.md
```

### README Template

```markdown
# Firmware Engineering Portfolio

A comprehensive portfolio demonstrating Rust firmware engineering skills.

## About

This repository showcases my journey learning firmware engineering with Rust. It includes examples and projects covering:

- **no_std Rust** - Bare metal programming without standard library
- **MCTP Protocol** - Management Component Transport Protocol implementation
- **Caliptra** - DICE attestation and Root of Trust
- **Hubris RTOS** - Real-time operating system concepts

## Projects

### 1. no_std Examples

Fundamental no_std Rust concepts including:
- Custom panic handlers
- Memory allocation strategies
- Hardware abstraction layers

### 2. MCTP Implementation

A complete MCTP protocol implementation featuring:
- Type-safe header parsing
- Multiple transport bindings
- Async support

### 3. Caliptra Examples

DICE attestation demonstrations:
- Certificate chain generation
- Attestation flows
- PCR measurements

### 4. Hubris Learning

RTOS concepts through examples:
- Task isolation
- IPC mechanisms
- Resource sharing

## Skills Demonstrated

| Skill | Level | Projects |
|-------|-------|----------|
| Rust | Advanced | All |
| Embedded Systems | Intermediate | no_std, Hubris |
| Security | Intermediate | Caliptra, DICE |
| Protocols | Advanced | MCTP |
| Testing | Advanced | All |
| Documentation | Advanced | All |

## Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/firmware-portfolio.git
cd firmware-portfolio

# Build all examples
cargo build --release

# Run tests
cargo test
```

## Documentation

- [Architecture Overview](docs/architecture.md)
- [Learning Journal](docs/learning-journal.md)
- [API Documentation](https://docs.rs/firmware-portfolio)

## Contributing

This is a personal portfolio, but suggestions are welcome via issues.

## License

MIT OR Apache-2.0

## Contact

- GitHub: [yourusername](https://github.com/yourusername)
- LinkedIn: [Your Name](https://linkedin.com/in/yourname)
- Email: your.email@example.com
```

### CI Configuration

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Build
        run: cargo build --release

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Run tests
        run: cargo test

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt

      - name: Check formatting
        run: cargo fmt -- --check

      - name: Run clippy
        run: cargo clippy -- -D warnings

  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Build documentation
        run: cargo doc --no-deps

      - name: Deploy to GitHub Pages
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./target/doc
```

## How to Present to Employers

### Portfolio Presentation Tips

1. **Show Progression** — Start with basics, advance to complex topics
2. **Include Tests** — Every project should have tests
3. **Document Everything** — READMEs, comments, architecture docs
4. **CI/CD** — Show you understand modern development practices
5. **Real Hardware** — If possible, show projects running on actual hardware

### Interview Preparation

**Common Questions:**

- "Tell me about a firmware project you've worked on"
- "How do you ensure memory safety in embedded systems?"
- "Explain the DICE attestation flow"
- "What is MCTP and how does it work?"
- "How does Hubris provide task isolation?"

**Your Portfolio Answers:**

1. Point to specific projects and files
2. Explain the architecture decisions
3. Discuss trade-offs and alternatives
4. Show testing approaches
5. Demonstrate understanding of security implications

### GitHub Profile Tips

- **Pin your best repositories** — Show 3-4 strong projects
- **Write detailed READMEs** — First impression matters
- **Show activity** — Regular commits and updates
- **Include screenshots/diagrams** — Visual documentation helps
- **Link related projects** — Show how projects connect

{% include callout.html type="info" title="Portfolio Checklist" content="Before presenting your portfolio, ensure: all repositories have READMEs, CI passes on main, tests are documented, code is formatted and linted, and architecture docs exist for complex projects." %}

<details>
<summary>Advanced: Portfolio Enhancement Ideas</summary>

### Additional Projects to Consider

1. **Firmware Update System** — Show secure update implementation
2. **Custom RTOS** — Build a minimal task scheduler
3. **Driver Development** — Write a hardware driver from scratch
4. **Security Audit** — Perform and document a security review
5. **Performance Optimization** — Profile and optimize firmware

### Presentation Materials

- **Demo Video** — Record a 5-minute walkthrough
- **Architecture Diagrams** — Use tools like draw.io or Mermaid
- **Blog Posts** — Write about your learning journey
- **Conference Talks** — Present at local meetups
- **Open Source Contributions** — Contribute to existing projects

### Skill Validation

- **Certifications** — Consider embedded systems certifications
- **Competition** — Participate in CTF or firmware challenges
- **Teaching** — Write tutorials or mentor others
- **Writing** — Publish technical articles
- **Speaking** — Present at conferences or meetups

</details>

## Quiz

<div class="quiz" data-answer="A good firmware portfolio shows progression from basic to advanced topics, includes tests and documentation, and demonstrates understanding of security implications">
<strong>Q1:</strong> What makes a firmware portfolio stand out to employers?

<details>
<summary>Answer</summary>
A good firmware portfolio shows progression from basic to advanced topics, includes tests and documentation, and demonstrates understanding of security implications. It should also have CI/CD, clear READMEs, and ideally show projects running on real hardware.
</details>
</div>

<div class="quiz" data-answer="MCTP demonstrates protocol implementation skills including binary parsing, type safety, and transport abstraction">
<strong>Q2:</strong> Why is the MCTP project valuable for a firmware portfolio?

<details>
<summary>Answer</summary>
MCTP demonstrates protocol implementation skills including binary parsing, type safety, and transport abstraction. It shows understanding of real-world firmware protocols and the ability to implement complex specifications in Rust.
</details>
</div>

<div class="quiz" data-answer="Caliptra examples demonstrate security-focused firmware development, understanding of attestation flows, and ability to work with hardware root of trust">
<strong>Q3:</strong> What does the Caliptra project demonstrate?

<details>
<summary>Answer</summary>
Caliptra examples demonstrate security-focused firmware development, understanding of attestation flows, and ability to work with hardware root of trust. This is valuable for positions in firmware security and trusted computing.
</details>
</div>

## Exercises

<div class="exercise">
<h3>Exercise 1: Portfolio README</h3>
<p>Write a comprehensive README for your firmware portfolio that showcases your skills and projects.</p>

<details>
<summary>Solution</summary>

```markdown
# [Your Name] - Firmware Engineering Portfolio

## About Me

Firmware engineer specializing in Rust for embedded systems and security. Passionate about memory-safe firmware and open-source hardware projects.

## Technical Skills

### Languages
- Rust (Advanced)
- C (Intermediate)
- Assembly (Basic)

### Domains
- Embedded Systems
- Firmware Security
- Real-Time Operating Systems
- Hardware Abstraction

### Tools
- Git/GitHub
- Bazel/Cargo
- probe-rs/OpenOCD
- QEMU

## Featured Projects

### 1. MCTP Protocol Implementation
A complete, type-safe MCTP implementation in Rust with multiple transport bindings.

**Key Features:**
- Compile-time message validation
- Async support
- Comprehensive test suite

**Link:** [mctp-protocol-rs](https://github.com/yourusername/mctp-protocol-rs)

### 2. Caliptra DICE Examples
Working examples of DICE attestation and certificate chain generation.

**Key Features:**
- Certificate generation
- Attestation flows
- PCR measurements

**Link:** [caliptra-examples](https://github.com/yourusername/caliptra-examples)

### 3. Hubris Learning Projects
RTOS concepts demonstrated through practical examples.

**Key Features:**
- Task isolation
- IPC mechanisms
- Resource sharing

**Link:** [hubris-learning](https://github.com/yourusername/hubris-learning)

## Experience

### Firmware Engineer Intern - [Company]
- Developed MCTP transport layer
- Implemented DICE attestation
- Contributed to Caliptra project

## Education

### [University] - Computer Engineering
- Relevant coursework: Embedded Systems, Computer Architecture
- Senior project: Firmware security analysis

## Contact

- GitHub: [yourusername](https://github.com/yourusername)
- LinkedIn: [Your Name](https://linkedin.com/in/yourname)
- Email: your.email@example.com
```

</details>
</div>

<div class="exercise">
<h3>Exercise 2: CI Pipeline</h3>
<p>Design a complete CI pipeline for a firmware project that includes building, testing, linting, and documentation generation.</p>

<details>
<summary>Solution</summary>

```yaml
# .github/workflows/ci.yml
name: Firmware CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  CARGO_TERM_COLOR: always
  RUST_VERSION: "1.75"

jobs:
  check:
    name: Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: thumbv7em-none-eabihf
      
      - name: Cache cargo
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/bin/
            ~/.cargo/registry/index/
            ~/.cargo/registry/cache/
            ~/.cargo/git/db/
            target/
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
      
      - name: Check formatting
        run: cargo fmt -- --check
      
      - name: Run clippy
        run: cargo clippy --target thumbv7em-none-eabihf -- -D warnings
      
      - name: Check no_std compatibility
        run: cargo check --target thumbv7em-none-eabihf

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: check
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: thumbv7em-none-eabihf
      
      - name: Build release
        run: cargo build --target thumbv7em-none-eabihf --release
      
      - name: Analyze binary size
        run: |
          arm-none-eabi-size target/thumbv7em-none-eabihf/release/firmware
          echo "Binary size analysis complete"

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: check
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Run unit tests
        run: cargo test --lib
      
      - name: Run integration tests
        run: cargo test --test integration
      
      - name: Generate coverage
        run: |
          cargo install cargo-tarpaulin
          cargo tarpaulin --out Html

  docs:
    name: Documentation
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Build documentation
        run: cargo doc --no-deps
      
      - name: Check documentation links
        run: |
          cargo install cargo-deadlinks
          cargo deadlinks
      
      - name: Deploy to GitHub Pages
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./target/doc

  security:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Run cargo audit
        run: |
          cargo install cargo-audit
          cargo audit
      
      - name: Run cargo deny
        run: |
          cargo install cargo-deny
          cargo deny check
```

</details>
</div>

<div class="exercise">
<h3>Exercise 3: Project Description</h3>
<p>Write a compelling 200-word project description for your MCTP implementation that highlights technical decisions and trade-offs.</p>

<details>
<summary>Solution</summary>

```markdown
# mctp-protocol-rs

A type-safe, no_std-compatible MCTP (Management Component Transport Protocol) implementation in Rust, designed for firmware environments where memory safety and performance are critical.

## Technical Decisions

**Binary Parsing:** I chose manual binary parsing over a serialization library like serde to minimize code size and avoid heap allocation. The `McptHeader` struct uses `#[repr(C, packed)]` for exact memory layout control, ensuring compatibility with the wire format.

**Error Handling:** The crate defines a comprehensive error enum with specific variants for each failure mode. This enables callers to handle errors precisely without relying on string-based error messages.

**Transport Abstraction:** The `McptTransport` trait abstracts physical layer differences (SMBus, I2C, PCIe VDM). This allows the same protocol logic to work across different hardware platforms.

**Async Support:** Optional async/await support via a feature flag enables non-blocking operation in RTOS environments like Hubris, while keeping the default synchronous API simple for bare-metal use.

## Trade-offs

- Manual parsing increases code complexity but reduces binary size
- No heap allocation limits flexibility but ensures determinism
- `#[repr(C, packed)]` requires careful alignment handling but guarantees wire compatibility

## Future Work

- Add support for MCTP over USB
- Implement message fragmentation for large payloads
- Add fuzzing tests for robustness validation
```

</details>
</div>

## Summary

In this chapter, you learned:

- **Portfolio structure** — How to organize and present firmware projects
- **README templates** — Professional documentation for each project
- **CI configuration** — Automated testing and deployment
- **Project descriptions** — Highlighting technical decisions and trade-offs
- **Interview preparation** — Common questions and portfolio answers
- **GitHub presentation** — Profile tips and repository organization

## Congratulations!

You've completed the Rust Firmware Wiki! You now have the knowledge to:

- Write embedded Rust code without the standard library
- Implement firmware protocols like MCTP, SPDM, and DICE
- Work with Caliptra and OpenPRoT projects
- Build Hubris RTOS applications
- Create a professional firmware portfolio

### Next Steps

1. **Contribute to open source** — Caliptra, OpenPRoT, or Hubris
2. **Build real projects** — Apply your knowledge to actual hardware
3. **Join the community** — CHIPS Alliance, Rust Embedded Working Group
4. **Keep learning** — Firmware security is an evolving field

### Resources

- [Rust Embedded Book](https://docs.rust-embedded.org/book/)
- [Caliptra Repository](https://github.com/chipsalliance/caliptra-sw)
- [OpenPRoT Repository](https://github.com/chipsalliance/openprot)
- [Hubris Documentation](https://hubris.oxide.computer/)
- [DMTF Standards](https://www.dmtf.org/standards)

<div class="chapter-nav">
<a href="{{ page.prev }}" class="btn">← Previous: OpenPRoT</a>
</div>
