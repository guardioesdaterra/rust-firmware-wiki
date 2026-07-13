---
layout: chapter
title: "no_std Rust"
chapter: 10
progress: 62
prev: /chapters/09-embedded-rust/
next: /chapters/11-firmware-protocols/
---

# no_std Rust

{% include callout.html type="info" title="Why this matters for 9elements" content="Firmware running on microcontrollers and in bootloader contexts has no operating system, no heap allocator, and often no filesystem. `no_std` Rust is how you write code that runs in these minimal environments. Every project at 9elements — from Caliptra to OpenPRoT — uses `no_std` extensively." %}

## What is no_std?

Rust's standard library (`std`) depends on an operating system for features like file I/O, networking, threading, and heap allocation. Embedded firmware and bootloaders don't have an OS, so `std` is unavailable.

`no_std` Rust uses only the `core` library, which provides fundamental types and traits without any OS dependency. Optionally, you can use the `alloc` crate for heap allocation if you provide a custom allocator.

### core vs alloc vs std

| Feature | `core` | `alloc` | `std` |
|---------|--------|---------|-------|
| No OS required | ✅ | ✅ | ❌ |
| Heap allocation | ❌ | ✅ | ✅ |
| File I/O | ❌ | ❌ | ✅ |
| Networking | ❌ | ❌ | ✅ |
| Threading | ❌ | ❌ | ✅ |
| Available in firmware | ✅ | ✅* | ❌ |

*alloc requires a custom global allocator

## The #![no_std] Attribute

The `#![no_std]` attribute tells the Rust compiler to link against `core` instead of `std`.

```rust
// Standard Rust (requires OS)
fn main() {
    println!("Hello, world!"); // uses OS stdout
    let v = vec![1, 2, 3]; // uses heap allocator
}

// no_std Rust (no OS required)
#![no_std]

// We can still use core types
use core::fmt;

struct Buffer {
    data: [u8; 256],
    len: usize,
}

impl Buffer {
    const fn new() -> Self {
        Buffer {
            data: [0u8; 256],
            len: 0,
        }
    }
}
```

## The #![no_main] Attribute

In standard Rust, `fn main()` is the program entry point. In embedded systems, the entry point is determined by the hardware (typically a reset handler). The `#![no_main]` attribute tells Rust not to generate a `main` symbol.

```rust
#![no_std]
#![no_main]

use cortex_m_rt::entry;

#[entry]
fn main() -> ! {
    // Your firmware entry point
    loop {
        cortex_m::asm::wfi();
    }
}
```

## Panic Handlers

When a panic occurs in `no_std` code, there's no OS to display an error message. You must provide a custom panic handler.

### Option 1: Panic Halt

```rust
use panic_halt as _; // Halts the processor on panic

// Or write your own:
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {
        cortex_m::asm::bkpt(); // Enter debugger
    }
}
```

### Option 2: Panic Reset

```rust
use panic_reset as _; // Resets the MCU on panic
```

### Option 3: Custom Panic Handler

```rust
#[panic_handler]
fn panic(info: &core::panic::PanicInfo) -> ! {
    // Write panic message to a debug UART
    if let Some(location) = info.location() {
        debug_print!("PANIC at {}:{}: {}", 
            location.file(), 
            location.line(),
            info.message()
        );
    }

    // Signal error via LED pattern
    unsafe {
        let gpioa = &*stm32f4::stm32f411::GPIOA::ptr();
        // Fast blink = error
        for _ in 0..10 {
            gpioa.odr.modify(|_, w| w.odr5().set_bit());
            delay_cycles(100_000);
            gpioa.odr.modify(|_, w| w.odr5().clear_bit());
            delay_cycles(100_000);
        }
    }

    cortex_m::asm::bkpt();
    loop {}
}
```

{% include callout.html type="warning" title="Panic Handler is Required" content="Every `no_std` program MUST have exactly one `#[panic_handler]`. If you forget it, you'll get a linker error. Use `panic_halt` for quick prototyping and a custom handler for production firmware." %}

## The alloc Crate

The `alloc` crate provides heap-allocated collections (`Vec`, `Box`, `String`, etc.) without requiring `std`. However, you must provide a global allocator.

### Enabling alloc

```rust
#![no_std]

// Enable heap allocation
extern crate alloc;

use alloc::vec::Vec;
use alloc::boxed::Box;
use alloc::string::String;
use alloc::vec;
```

### Custom Global Allocator

```rust
use core::alloc::{GlobalAlloc, Layout};

struct SimpleAllocator {
    // Your allocation implementation
}

unsafe impl GlobalAlloc for SimpleAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        // Implement your allocator here
        // This is a simplified bump allocator
        static mut HEAP: [u8; 8192] = [0u8; 8192];
        static mut OFFSET: usize = 0;

        let size = layout.size();
        let align = layout.align();

        // Align the offset
        let aligned_offset = (OFFSET + align - 1) & !(align - 1);

        if aligned_offset + size > HEAP.len() {
            return core::ptr::null_mut();
        }

        let ptr = HEAP.as_mut_ptr().add(aligned_offset);
        OFFSET = aligned_offset + size;
        ptr
    }

    unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) {
        // Bump allocator: no deallocation
    }
}

#[global_allocator]
static ALLOCATOR: SimpleAllocator = SimpleAllocator {};
```

### Using alloc in Practice

```rust
#![no_std]
#![no_main]

extern crate alloc;

use alloc::vec::Vec;
use alloc::format;
use cortex_m_rt::entry;

#[entry]
fn main() -> ! {
    // Use Vec just like in std Rust
    let mut measurements: Vec<u32> = Vec::new();

    for i in 0..100 {
        let adc_value = read_adc(i);
        measurements.push(adc_value);

        // Format string (requires alloc)
        let msg = format!("Reading {}: {}mV", i, adc_value * 3300 / 4096);
        debug_print(&msg);
    }

    // Calculate average
    let sum: u32 = measurements.iter().sum();
    let avg = sum / measurements.len() as u32;

    loop {
        cortex_m::asm::wfi();
    }
}
```

## #[no_mangle] and extern "C"

When interfacing with hardware or calling code from different compilation units, you need stable function names and calling conventions.

```rust
// #[no_mangle] prevents Rust from renaming the function
#[no_mangle]
pub extern "C" fn reset_handler() {
    // Entry point called by hardware
    main();
}

// extern "C" ensures C-compatible calling convention
#[no_mangle]
pub extern "C" fn UART2_IRQ_handler() {
    // Interrupt handler callable from C code
}

// Callback that C code can call
#[no_mangle]
pub extern "C" fn firmware_callback(data: *const u8, len: usize) {
    let slice = unsafe { core::slice::from_raw_parts(data, len) };
    process_data(slice);
}
```

## Cargo.toml Configuration

A complete `no_std` project's `Cargo.toml`:

```toml
[package]
name = "my-firmware"
version = "0.1.0"
edition = "2021"

[dependencies]
cortex-m = "0.7"
cortex-m-rt = "0.7"
panic-halt = "0.2"

# Optional: for heap allocation
# alloc = { path = "../alloc" }

[profile.release]
opt-level = "s"    # Optimize for size
lto = true         # Link-time optimization
codegen-units = 1  # Better optimization
debug = true       # Keep debug symbols for profiling
```

## .cargo/config.toml

This file configures the default target and runner for your project:

```toml
[build]
target = "thumbv7em-none-eabihf"  # ARM Cortex-M4F

[target.thumbv7em-none-eabihf]
runner = "probe-rs run --chip STM32F411CEUx"

[alias]
# Shortcuts for common operations
flash = "run --release"
debug = "run --release"
```

## Cross-Compilation

Cross-compilation means building for a different target architecture than your development machine.

### Adding Targets

```bash
# ARM Cortex-M targets
rustup target add thumbv6m-none-eabi      # Cortex-M0/M0+
rustup target add thumbv7m-none-eabi      # Cortex-M3
rustup target add thumbv7em-none-eabihf   # Cortex-M4/M7 with FPU
rustup target add thumbv8m.main-none-eabihf # Cortex-M33

# RISC-V targets
rustup target add riscv32i-unknown-none-elf
rustup target add riscv32imac-unknown-none-elf
```

### Building

```bash
# Build for release
cargo build --target thumbv7em-none-eabihf --release

# Check without building (faster for CI)
cargo check --target thumbv7em-none-eabihf

# Build with size analysis
cargo build --release && arm-none-eabi-size target/thumbv7em-none-eabihf/release/my-firmware
```

## embedded-hal in no_std

The `embedded-hal` crate defines traits for hardware abstraction in `no_std` environments:

```rust
use embedded_hal::digital::{InputPin, OutputPin};
use embedded_hal::serial::{Read, Write};
use embedded_hal::blocking::i2c::{WriteRead, Write};

// These traits work the same in no_std as in std
// The key difference: no dynamic dispatch, no heap allocation

fn read_sensor<I2C: WriteRead>(
    i2c: &mut I2C,
    address: u8,
    register: u8,
) -> Result<u8, I2C::Error> {
    let mut buffer = [0u8; 1];
    i2c.write_read(address, &[register], &mut buffer)?;
    Ok(buffer[0])
}
```

## Complete no_std Project Setup

Here's a step-by-step guide to creating a complete `no_std` project:

### Step 1: Create the Project

```bash
cargo new my-firmware --bin
cd my-firmware
```

### Step 2: Configure Cargo.toml

```toml
[package]
name = "my-firmware"
version = "0.1.0"
edition = "2021"

[dependencies]
cortex-m = "0.7"
cortex-m-rt = "0.7"
panic-halt = "0.2"

[profile.release]
opt-level = "s"
lto = true
```

### Step 3: Create .cargo/config.toml

```toml
[build]
target = "thumbv7em-none-eabihf"

[target.thumbv7em-none-eabihf]
runner = "probe-rs run --chip STM32F411CEUx"
```

### Step 4: Create memory.x

```text
MEMORY
{
    FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 512K
    RAM (rwx)  : ORIGIN = 0x20000000, LENGTH = 128K
}
```

### Step 5: Write main.rs

```rust
#![no_std]
#![no_main]

use cortex_m_rt::entry;
use panic_halt as _;

#[entry]
fn main() -> ! {
    let peripherals = stm32f4::stm32f411::Peripherals::take().unwrap();

    // Enable GPIOA clock
    peripherals.RCC.ahb1enr.modify(|_, w| w.gpioaen().set_bit());

    // Configure PA5 as output
    peripherals.GPIOA.moder.modify(|_, w| w.moder5().output());

    loop {
        // Toggle LED
        peripherals.GPIOA.odr.modify(|_, w| w.odr5().toggle());
        cortex_m::asm::delay(8_000_000);
    }
}
```

### Step 6: Build and Flash

```bash
cargo build --release
cargo run --release
```

{% include callout.html type="info" title="Interactive Playground" content="Try the no_std examples below. Notice how we avoid heap allocation and OS dependencies." %}

<details>
<summary>Advanced: Custom Allocator for Secure Firmware</summary>

```rust
use core::alloc::{GlobalAlloc, Layout};
use core::sync::atomic::{AtomicBool, Ordering};

struct SecureAllocator {
    initialized: AtomicBool,
    heap: [u8; 16384],
    offset: core::sync::atomic::AtomicUsize,
}

unsafe impl GlobalAlloc for SecureAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if !self.initialized.load(Ordering::Acquire) {
            return core::ptr::null_mut();
        }

        let size = layout.size();
        let align = layout.align();

        let current = self.offset.load(Ordering::Relaxed);
        let aligned = (current + align - 1) & !(align - 1);

        if aligned + size > self.heap.len() {
            return core::ptr::null_mut();
        }

        self.offset.store(aligned + size, Ordering::Relaxed);
        self.heap.as_ptr().add(aligned) as *mut u8
    }

    unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) {
        // Secure allocator: no deallocation to prevent use-after-free
    }
}

#[global_allocator]
static ALLOCATOR: SecureAllocator = SecureAllocator {
    initialized: AtomicBool::new(false),
    heap: [0u8; 16384],
    offset: core::sync::atomic::AtomicUsize::new(0),
};

// Initialize after hardware setup
fn init_allocator() {
    ALLOCATOR.initialized.store(true, Ordering::Release);
}
```

</details>

## Quiz

<div class="quiz" data-answer="core provides fundamental types without OS dependency, alloc adds heap allocation, std requires a full OS">
<strong>Q1:</strong> What is the difference between `core`, `alloc`, and `std`?

<details>
<summary>Answer</summary>
`core` provides fundamental types without OS dependency, `alloc` adds heap allocation, and `std` requires a full OS. Firmware can use `core` and optionally `alloc`, but never `std`.
</details>
</div>

<div class="quiz" data-answer="#![no_main] tells Rust not to generate a main function, because the entry point is determined by hardware (reset handler)">
<strong>Q2:</strong> Why do embedded programs need `#![no_main]`?

<details>
<summary>Answer</summary>
`#![no_main]` tells Rust not to generate a main function, because the entry point is determined by hardware (reset handler). The actual entry point is marked with `#[entry]` from `cortex-m-rt`.
</details>
</div>

<div class="quiz" data-answer="A global allocator is required when using the alloc crate because core has no allocator, and someone must provide the implementation">
<strong>Q3:</strong> Why does `alloc` require a custom global allocator?

<details>
<summary>Answer</summary>
A global allocator is required when using the alloc crate because core has no allocator, and someone must provide the implementation. The `#[global_allocator]` attribute marks which allocator to use.
</details>
</div>

## Exercises

<div class="exercise">
<h3>Exercise 1: no_std Conversion</h3>
<p>Convert the following std Rust code to no_std. Remove all OS-dependent features.</p>

```rust
use std::collections::HashMap;
use std::fs::File;
use std::io::Write;

fn main() {
    let mut config = HashMap::new();
    config.insert("baud_rate", "115200");
    config.insert("parity", "none");

    let mut file = File::create("config.txt").unwrap();
    for (key, value) in &config {
        writeln!(file, "{}={}", key, value).unwrap();
    }
}
```

<details>
<summary>Solution</summary>

```rust
#![no_std]
#![no_main]

extern crate alloc;
use alloc::collections::BTreeMap; // BTreeMap works in no_std
use cortex_m_rt::entry;

#[entry]
fn main() -> ! {
    // BTreeMap instead of HashMap (no hashing in core)
    let mut config = BTreeMap::new();
    config.insert("baud_rate", "115200");
    config.insert("parity", "none");

    // Instead of file I/O, write to a UART or buffer
    let mut output = [0u8; 256];
    let mut offset = 0;

    for (key, value) in &config {
        let entry = format!("{}={}\n", key, value);
        let bytes = entry.as_bytes();
        let len = bytes.len().min(output.len() - offset);
        output[offset..offset + len].copy_from_slice(&bytes[..len]);
        offset += len;
    }

    // Send output to UART or store in flash
    transmit_uart(&output[..offset]);

    loop {
        cortex_m::asm::wfi();
    }
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 2: Custom Panic Handler</h3>
<p>Write a custom panic handler that blinks an LED in a specific pattern (SOS: three short, three long, three short) before halting.</p>

<details>
<summary>Solution</summary>

```rust
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe {
        let gpioa = &*stm32f4::stm32f411::GPIOA::ptr();
        let rcc = &*stm32f4::stm32f411::RCC::ptr();

        // Enable GPIOA clock
        rcc.ahb1enr.modify(|_, w| w.gpioaen().set_bit());
        // Configure PA5 as output
        gpioa.moder.modify(|_, w| w.moder5().output());

        let mut led_on = || gpioa.odr.modify(|_, w| w.odr5().set_bit());
        let mut led_off = || gpioa.odr.modify(|_, w| w.odr5().clear_bit());

        let short = 200_000;
        let long = 600_000;

        // SOS pattern: ... --- ...
        for _ in 0..3 { led_on(); delay(short); led_off(); delay(short); }
        for _ in 0..3 { led_on(); delay(long);  led_off(); delay(long); }
        for _ in 0..3 { led_on(); delay(short); led_off(); delay(short); }
    }

    cortex_m::asm::bkpt();
    loop {}
}

unsafe fn delay(cycles: u32) {
    cortex_m::asm::delay(cycles);
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 3: Memory-Safe Buffer</h3>
<p>Implement a fixed-size ring buffer in no_std Rust that is safe to use from both main context and interrupt handlers.</p>

<details>
<summary>Solution</summary>

```rust
use core::sync::atomic::{AtomicUsize, Ordering};

pub struct RingBuffer<T, const N: usize> {
    buffer: [core::mem::MaybeUninit<T>; N],
    read_pos: AtomicUsize,
    write_pos: AtomicUsize,
}

impl<T, const N: usize> RingBuffer<T, N> {
    pub const fn new() -> Self {
        RingBuffer {
            buffer: unsafe { core::mem::MaybeUninit::uninit().assume_init() },
            read_pos: AtomicUsize::new(0),
            write_pos: AtomicUsize::new(0),
        }
    }

    pub fn push(&self, value: T) -> Result<(), T> {
        let write = self.write_pos.load(Ordering::Relaxed);
        let read = self.read_pos.load(Ordering::Acquire);

        let next_write = (write + 1) % N;
        if next_write == read {
            return Err(value); // Buffer full
        }

        unsafe {
            self.buffer[write].as_mut_ptr().write(value);
        }

        self.write_pos.store(next_write, OrderStatus::Release);
        Ok(())
    }

    pub fn pop(&self) -> Option<T> {
        let read = self.read_pos.load(Ordering::Relaxed);
        let write = self.write_pos.load(Ordering::Acquire);

        if read == write {
            return None; // Buffer empty
        }

        let value = unsafe { self.buffer[read].as_ptr().read() };
        let next_read = (read + 1) % N;

        self.read_pos.store(next_read, OrderStatus::Release);
        Some(value)
    }

    pub fn is_empty(&self) -> bool {
        self.read_pos.load(Ordering::Relaxed) == self.write_pos.load(Ordering::Relaxed)
    }

    pub fn is_full(&self) -> bool {
        let write = self.write_pos.load(Ordering::Relaxed);
        let read = self.read_pos.load(Ordering::Relaxed);
        (write + 1) % N == read
    }
}

// Usage from interrupt
static TX_BUFFER: RingBuffer<u8, 64> = RingBuffer::new();

#[interrupt]
fn USART2_IRQ() {
    if let Some(byte) = TX_BUFFER.pop() {
        // Send byte
    }
}
```

</details>
</div>

## Summary

In this chapter, you learned:

- **`#![no_std]`** tells Rust to use only the `core` library
- **`#![no_main]`** removes the default entry point for hardware-defined entry
- **Panic handlers** are required for `no_std` programs to handle errors
- **`alloc` crate** provides heap collections with a custom allocator
- **`#[no_mangle]`** prevents Rust from renaming symbols for FFI
- **`extern "C"`** ensures C-compatible calling conventions
- **Cross-compilation** targets different architectures using `rustup target`
- **`.cargo/config.toml`** configures default targets and runners

In the next chapter, we'll explore firmware protocols — the communication standards that allow different firmware components to exchange information securely.

<div class="chapter-nav">
<a href="{{ page.prev }}" class="btn">← Previous: Embedded Rust</a>
<a href="{{ page.next }}" class="btn">Next: Firmware Protocols →</a>
</div>
