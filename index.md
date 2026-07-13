---
layout: default
title: "Rust Firmware Wiki"
description: "Complete guide from Rust basics to Caliptra/OpenPRoT firmware development"
---

<div class="hero">
  <h1><span class="emoji">🦀</span> Rust Firmware Wiki</h1>
  <p>Complete guide from Rust basics to Caliptra/OpenPRoT firmware development. Interactive tutorials, exercises, and real-world projects.</p>
  <span class="badge">16 Chapters · 50+ Exercises · Real Projects</span>
</div>

## Your Learning Path

<table>
  <thead>
    <tr>
      <th>Phase</th>
      <th>Chapters</th>
      <th>Topics</th>
      <th>Time</th>
      <th>Projects</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Phase 1</strong></td>
      <td>1-3</td>
      <td>Rust Language Fundamentals</td>
      <td>2-3 weeks</td>
      <td>Hello World, Calculator</td>
    </tr>
    <tr>
      <td><strong>Phase 2</strong></td>
      <td>4-8</td>
      <td>Advanced Rust Features</td>
      <td>3-4 weeks</td>
      <td>CLI Tool, Library</td>
    </tr>
    <tr>
      <td><strong>Phase 3</strong></td>
      <td>9-10</td>
      <td>Embedded Rust</td>
      <td>4-6 weeks</td>
      <td>LED Blink, UART Driver</td>
    </tr>
    <tr>
      <td><strong>Phase 4</strong></td>
      <td>11-13</td>
      <td>Firmware Protocols</td>
      <td>4-6 weeks</td>
      <td>MCTP Stack, SPDM Client</td>
    </tr>
    <tr>
      <td><strong>Phase 5</strong></td>
      <td>14-16</td>
      <td>Caliptra & OpenPRoT</td>
      <td>6-8 weeks</td>
      <td>Portfolio Projects</td>
    </tr>
  </tbody>
</table>

## Chapter Overview

<div class="chapter-grid">
  <a href="/rust-firmware-wiki/chapters/01-rust-basics/" class="chapter-card">
    <span class="number">1</span>
    <h3>Rust Basics</h3>
    <p>Variables, types, functions, control flow - your first Rust program</p>
    <div class="tags">
      <span class="tag">beginner</span>
      <span class="tag">fundamentals</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/02-ownership/" class="chapter-card">
    <span class="number">2</span>
    <h3>Ownership</h3>
    <p>Rust's memory safety system - ownership, borrowing, lifetimes</p>
    <div class="tags">
      <span class="tag">core concept</span>
      <span class="tag">memory</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/03-structs-enums/" class="chapter-card">
    <span class="number">3</span>
    <h3>Structs & Enums</h3>
    <p>Custom types, methods, pattern matching, Option and Result</p>
    <div class="tags">
      <span class="tag">types</span>
      <span class="tag">patterns</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/04-error-handling/" class="chapter-card">
    <span class="number">4</span>
    <h3>Error Handling</h3>
    <p>Result, Option, panic!, the ? operator, custom errors</p>
    <div class="tags">
      <span class="tag">reliability</span>
      <span class="tag">safety</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/05-generics-traits/" class="chapter-card">
    <span class="number">5</span>
    <h3>Generics & Traits</h3>
    <p>Code reuse, polymorphism, trait bounds, associated types</p>
    <div class="tags">
      <span class="tag">abstraction</span>
      <span class="tag">reuse</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/06-closures-iterators/" class="chapter-card">
    <span class="number">6</span>
    <h3>Closures & Iterators</h3>
    <p>Anonymous functions, iterator adapters, functional patterns</p>
    <div class="tags">
      <span class="tag">functional</span>
      <span class="tag">patterns</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/07-smart-pointers/" class="chapter-card">
    <span class="number">7</span>
    <h3>Smart Pointers</h3>
    <p>Box, Rc, RefCell, interior mutability, reference counting</p>
    <div class="tags">
      <span class="tag">memory</span>
      <span class="tag">ownership</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/08-concurrency/" class="chapter-card">
    <span class="number">8</span>
    <h3>Concurrency</h3>
    <p>Threads, async/await, channels, Send/Sync traits</p>
    <div class="tags">
      <span class="tag">async</span>
      <span class="tag">parallel</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/09-embedded-rust/" class="chapter-card">
    <span class="number">9</span>
    <h3>Embedded Rust</h3>
    <p>Hardware interaction, memory-mapped I/O, interrupts</p>
    <div class="tags">
      <span class="tag">firmware</span>
      <span class="tag">hardware</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/10-no-std/" class="chapter-card">
    <span class="number">10</span>
    <h3>no_std</h3>
    <p>Writing Rust without the standard library for bare metal</p>
    <div class="tags">
      <span class="tag">embedded</span>
      <span class="tag">critical</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/11-firmware-protocols/" class="chapter-card">
    <span class="number">11</span>
    <h3>Firmware Protocols</h3>
    <p>MCTP, SPDM, PLDM - communication standards</p>
    <div class="tags">
      <span class="tag">protocols</span>
      <span class="tag">standards</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/12-mctp/" class="chapter-card">
    <span class="number">12</span>
    <h3>MCTP Deep Dive</h3>
    <p>Management Component Transport Protocol implementation</p>
    <div class="tags">
      <span class="tag">MCTP</span>
      <span class="tag">implementation</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/13-spdm-dice/" class="chapter-card">
    <span class="number">13</span>
    <h3>SPDM & DICE</h3>
    <p>Security protocols and chain of trust</p>
    <div class="tags">
      <span class="tag">security</span>
      <span class="tag">authentication</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/14-caliptra/" class="chapter-card">
    <span class="number">14</span>
    <h3>Caliptra</h3>
    <p>Root of Trust, ROM/FMC/Runtime, attestation</p>
    <div class="tags">
      <span class="tag">Caliptra</span>
      <span class="tag">firmware</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/15-openprot/" class="chapter-card">
    <span class="number">15</span>
    <h3>OpenPRoT</h3>
    <p>Open firmware stack, Hubris RTOS, Bazel build</p>
    <div class="tags">
      <span class="tag">OpenPRoT</span>
      <span class="tag">Hubris</span>
    </div>
  </a>
  
  <a href="/rust-firmware-wiki/chapters/16-portfolio/" class="chapter-card">
    <span class="number">16</span>
    <h3>Portfolio Projects</h3>
    <p>Hands-on projects to showcase your skills</p>
    <div class="tags">
      <span class="tag">projects</span>
      <span class="tag">portfolio</span>
    </div>
  </a>
</div>

## Quick Start

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Verify installation
rustc --version
cargo --version

# Create your first project
cargo new hello-rust
cd hello-rust
cargo run

# For embedded development (later)
rustup target add thumbv7m-none-eabi
```

## Resources

- [Rust Book](https://doc.rust-lang.org/book/) - Official Rust documentation
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/) - Interactive examples
- [Embedded Rust Book](https://docs.rust-embedded.org/book/) - Embedded development
- [Caliptra](https://github.com/chipsalliance/caliptra-sw) - Root of Trust firmware
- [OpenPRoT](https://github.com/OpenPRoT/openprot) - Open firmware stack
- [Caliptra](https://github.com/chipsalliance/caliptra-sw) - Open source Root of Trust firmware

<div class="info-box success">
  <strong>Ready to start?</strong> Begin with <a href="/rust-firmware-wiki/chapters/01-rust-basics/">Chapter 1: Rust Basics</a> and work your way through each chapter. Complete the exercises at the end of each chapter to reinforce your learning.
</div>
