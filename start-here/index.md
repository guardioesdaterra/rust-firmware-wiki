---
layout: default
title: "Start Here"
---

# Start Here

Welcome to the Rust Firmware Wiki! This guide will help you get started with learning firmware engineering using Rust.

## What You'll Learn

This wiki covers the essential skills for firmware engineering:

- **Embedded Rust** — Writing code for microcontrollers
- **no_std Development** — Programming without an operating system
- **Firmware Protocols** — MCTP, SPDM, PLDM, and DICE
- **Root of Trust** — Caliptra and attestation
- **RTOS Concepts** — Hubris task isolation and IPC
- **Portfolio Development** — Presenting your skills to employers

## Prerequisites

### Required Knowledge

- **Rust basics** — Variables, functions, structs, enums, pattern matching
- **Git basics** — Clone, commit, push, pull requests
- **Command line** — Basic terminal commands

### Recommended Background

- **C programming** — Understanding of pointers and memory
- **Computer architecture** — Registers, memory maps, interrupts
- **Networking basics** — Binary data, protocols, serialization

### Tools to Install

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add embedded target
rustup target add thumbv7em-none-eabihf

# Install cargo-generate (for project templates)
cargo install cargo-generate

# Optional: Install probe-rs for hardware debugging
cargo install probe-rs --features cli
```

## Learning Path

### Track 1: Firmware Basics (2-3 weeks)

1. **Chapter 9: Embedded Rust**
   - Memory-mapped I/O
   - Volatile operations
   - PAC and HAL crates

2. **Chapter 10: no_std Rust**
   - Core vs std
   - Panic handlers
   - Custom allocators

3. **Project:** Build an LED blink example

### Track 2: Firmware Protocols (3-4 weeks)

4. **Chapter 11: Firmware Protocols**
   - Protocol stacks
   - Message framing
   - Serialization

5. **Chapter 12: MCTP Deep Dive**
   - Header structure
   - Transport bindings
   - Complete parser

6. **Project:** Implement MCTP message parser

### Track 3: Security & Trust (3-4 weeks)

7. **Chapter 13: SPDM & DICE**
   - Authentication flow
   - Certificate chains
   - Attestation

8. **Chapter 14: Caliptra**
   - Architecture
   - Boot flow
   - Mailbox interface

9. **Project:** DICE certificate generator

### Track 4: Platform Firmware (2-3 weeks)

10. **Chapter 15: OpenPRoT**
    - Hubris RTOS
    - Task isolation
    - HAL layer

11. **Project:** Hubris task with IPC

### Track 5: Portfolio (1 week)

12. **Chapter 16: Portfolio Projects**
    - Repository structure
    - README templates
    - CI configuration

13. **Project:** Complete firmware portfolio

## Study Schedule

### Option 1: Intensive (4 weeks)

| Week | Chapters | Projects |
|------|----------|----------|
| 1 | 9, 10 | LED blink, no_std basics |
| 2 | 11, 12 | MCTP parser |
| 3 | 13, 14 | DICE generator |
| 4 | 15, 16 | Hubris task, Portfolio |

### Option 2: Regular (8 weeks)

| Week | Focus |
|------|-------|
| 1-2 | Embedded Rust fundamentals |
| 3-4 | no_std and HAL traits |
| 5-6 | Firmware protocols |
| 7-8 | MCTP implementation |
| 9-10 | SPDM and DICE |
| 11-12 | Caliptra |
| 13-14 | OpenPRoT and Hubris |
| 15-16 | Portfolio development |

### Option 3: Self-Paced (12+ weeks)

Take your time with each chapter:
- Read the chapter thoroughly
- Complete all exercises
- Build the associated project
- Move to the next chapter when comfortable

## How to Use This Wiki

### Reading Chapters

1. **Start with the "Why this matters" box** — Understand the context
2. **Read the detailed explanations** — Build understanding
3. **Study the code examples** — See concepts in action
4. **Try the interactive playground** — Experiment with code
5. **Complete the quizzes** — Test your knowledge
6. **Do the exercises** — Apply what you learned
7. **Read the summary** — Reinforce key concepts

### Interactive Elements

- **Code blocks** — Copy and run the code
- **Quizzes** — Test your understanding
- **Exercises** — Practice implementing concepts
- **Collapsible sections** — Explore advanced topics
- **Comparison blocks** — Learn best practices

### Navigation

- Use **Previous/Next** buttons to move between chapters
- Visit the **Exercises** page for a complete list
- Use the **Playground** for hands-on practice
- Check the **Portfolio** chapter for project ideas

## Community

### Getting Help

- **GitHub Issues** — Report problems or ask questions
- **Discussions** — Share ideas and get feedback
- **Pull Requests** — Contribute improvements

### Contributing

We welcome contributions:
- Fix typos or unclear explanations
- Add new examples or exercises
- Improve code samples
- Suggest new topics

### Connect

- **9elements** — [9elements.com](https://9elements.com)
- **Caliptra** — [github.com/chipsalliance/caliptra-sw](https://github.com/chipsalliance/caliptra-sw)
- **OpenPRoT** — [github.com/chipsalliance/openprot](https://github.com/chipsalliance/openprot)
- **Hubris** — [hubris.oxide.computer](https://hubris.oxide.computer)

## Quick Start

If you're new to firmware engineering, start here:

```bash
# 1. Set up your environment
rustup target add thumbv7em-none-eabihf

# 2. Create your first embedded project
cargo generate --git https://github.com/rust-embedded/cortex-m-quickstart

# 3. Read Chapter 9: Embedded Rust

# 4. Try the LED blink example

# 5. Continue through the chapters
```

## Chapter Overview

| Chapter | Title | Key Topics |
|---------|-------|------------|
| 9 | Embedded Rust | MMIO, volatile, PAC, HAL, interrupts |
| 10 | no_std Rust | core, alloc, panic handlers, allocators |
| 11 | Firmware Protocols | Protocol stacks, framing, serialization |
| 12 | MCTP Deep Dive | Headers, transports, complete parser |
| 13 | SPDM & DICE | Authentication, certificates, attestation |
| 14 | Caliptra | Architecture, boot flow, mailbox |
| 15 | OpenPRoT | Hubris, tasks, IPC, HAL |
| 16 | Portfolio Projects | Projects, READMEs, CI, interviews |

## Success Tips

1. **Practice regularly** — Write code every day if possible
2. **Build real projects** — Apply concepts to actual hardware
3. **Read source code** — Study Caliptra and OpenPRoT
4. **Join the community** — Ask questions, share progress
5. **Document your work** — Build your portfolio as you learn
6. **Don't rush** — Understanding is more important than speed

## Ready to Start?

Begin with [Chapter 9: Embedded Rust](/chapters/09-embedded-rust/) or explore the [Interactive Playground](/playground/) to get hands-on experience immediately.

Good luck on your firmware engineering journey!
