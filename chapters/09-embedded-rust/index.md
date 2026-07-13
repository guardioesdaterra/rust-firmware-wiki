---
layout: chapter
title: "Embedded Rust"
chapter: 9
progress: 56
prev: /chapters/08-concurrency/
next: /chapters/10-no-std/
---

# Embedded Rust

{% include callout.html type="info" title="Why this matters for 9elements" content="9elements specializes in firmware security and trusted computing. Embedded Rust is the foundation for writing secure firmware that replaces legacy C code. Understanding memory-mapped I/O, volatile operations, and hardware abstraction layers is essential for firmware engineers building products like Caliptra and OpenPRoT." %}

## What is Embedded Rust?

Embedded Rust is the practice of writing firmware for microcontrollers and other resource-constrained hardware using the Rust programming language. Unlike application-level Rust, embedded Rust operates without an operating system, directly interfacing with hardware registers and peripherals.

### Why Rust for Embedded?

Traditional embedded firmware is written in C, which provides direct hardware access but lacks memory safety guarantees. Rust offers the same low-level control while preventing entire classes of bugs at compile time:

- **No buffer overflows** — bounds checking at compile time
- **No use-after-free** — ownership system prevents dangling pointers
- **No data races** — type system enforces exclusive access
- **No null pointer dereferences** — `Option<T>` replaces null

```rust
// C: potential buffer overflow — compiles fine, crashes at runtime
void write_register(uint8_t *buffer, size_t len) {
    volatile uint32_t *reg = (uint32_t *)0x40000000;
    for (size_t i = 0; i <= len; i++) { // off-by-one!
        reg[i] = buffer[i];
    }
}

// Rust: caught at compile time
fn write_register(reg: &mut [u32], buffer: &[u8]) {
    for (i, byte) in buffer.iter().enumerate() {
        reg[i] = *byte as u32; // bounds checked
    }
}
```

## Memory-Mapped I/O

In embedded systems, hardware peripherals are controlled by reading and writing to specific memory addresses. This is called **memory-mapped I/O (MMIO)**.

### How MMIO Works

Every peripheral (UART, SPI, GPIO, etc.) maps its control registers into the processor's address space. To configure a GPIO pin as output, you write to a specific bit in a configuration register at a fixed address.

```rust
// Direct memory-mapped register access (unsafe, but necessary)
const GPIO_BASE: usize = 0x4002_0000;
const GPIO_MODER: *mut u32 = (GPIO_BASE + 0x00) as *mut u32;

unsafe {
    // Read current value
    let current = core::ptr::read_volatile(GPIO_MODER);
    // Set bits 0-1 to configure pin 0 as output (01)
    core::ptr::write_volatile(GPIO_MODER, current | 0b01);
}
```

### The Volatile Problem

Compilers optimize away "unnecessary" reads and writes. If you write to a register and immediately read it back, the compiler might skip the write or reuse a cached value. This is catastrophic for hardware registers that can change state externally.

```rust
// BAD: compiler may optimize away the write
let reg = 0x4000_0000 as *mut u32;
unsafe { *reg = 0x01; }
unsafe { let val = *reg; } // compiler might skip the write!

// GOOD: volatile ensures the access happens
let reg = 0x4000_0000 as *mut u32;
unsafe { core::ptr::write_volatile(reg, 0x01); }
unsafe { let val = core::ptr::read_volatile(reg); } // guaranteed to read after write
```

{% include callout.html type="warning" title="Volatile is Non-Negotiable" content="Every single access to a hardware register MUST use volatile operations. Forgetting volatile is the #1 source of subtle, hard-to-debug firmware issues. The `read_volatile` and `write_volatile` functions are your safety net." %}

## PAC Crates — Peripheral Access Crates

Manually writing raw pointer arithmetic for every register is error-prone. **PAC (Peripheral Access Crate)** crates auto-generate type-safe wrappers around register definitions from SVD (System View Description) files.

### What a PAC Provides

- **Type-safe register access** — each register is its own type
- **Bitfield manipulation** — named fields with read/write methods
- **Register locks** — prevents accidental concurrent access
- **No runtime cost** — zero-cost abstractions

```rust
// Using a PAC (e.g., stm32f4xx-hal)
use stm32f4::stm32f411;

let peripherals = stm32f411::Peripherals::take().unwrap();

// Type-safe GPIO configuration
peripherals.GPIOA.moder.modify(|_, w| {
    w.moder5().output() // Set PA5 as output — readable and safe
});

// Type-safe register write
peripherals.GPIOA.odr.modify(|_, w| {
    w.odr5().set_bit() // Turn on LED
});
```

### Comparison: Raw vs PAC

```rust
// Raw (dangerous, hard to read)
unsafe {
    let moder = (0x4002_0000 + 0x00) as *mut u32;
    let val = core::ptr::read_volatile(moder);
    core::ptr::write_volatile(moder, (val & !0x3) | 0x1);
}

// PAC (safe, readable, self-documenting)
peripherals.GPIOA.moder.modify(|_, w| w.moder0().output());
```

## HAL Traits — Hardware Abstraction Layer

The `embedded-hal` crate defines traits that hardware vendors implement, allowing driver crates to work across different microcontrollers.

### Key HAL Traits

```rust
use embedded_hal::digital::{InputPin, OutputPin};
use embedded_hal::serial::{Read, Write};
use embedded_hal::blocking::spi::Transfer;

// A driver that works with ANY microcontroller implementing these traits
fn blink<Led: OutputPin>(led: &mut Led, times: u32) {
    for _ in 0..times {
        led.set_high().ok();
        delay_ms(500);
        led.set_low().ok();
        delay_ms(500);
    }
}
```

### HAL Implementation Structure

```text
┌─────────────────────────────────────────────┐
│              Application Code               │
├─────────────────────────────────────────────┤
│           Driver Crates (embedded-hal)       │
├─────────────────────────────────────────────┤
│     HAL Crate (stm32f4-hal, nrf52-hal)      │
├─────────────────────────────────────────────┤
│         PAC Crate (auto-generated)           │
├─────────────────────────────────────────────┤
│              Hardware (MCU)                  │
└─────────────────────────────────────────────┘
```

## Interrupts

Interrupts allow hardware to signal the processor when something happens (timer expiry, data received, button press).

### Interrupt Handling in Rust

```rust
// Define an interrupt handler
#[interrupt]
fn TIM2_IRQ() {
    // Clear interrupt flag
    unsafe {
        let tim2 = &*stm32f411::TIM2::ptr();
        tim2.sr.modify(|_, w| w.uif().clear_bit());
    }
    // Toggle LED
    cortex_m::asm::bkpt(); // breakpoint for debugging
}

// In main, configure the interrupt
fn main() -> ! {
    // ... setup code ...

    // Enable interrupt in NVIC
    unsafe {
        cortex_m::peripheral::NVIC::unmask(
            stm32f411::Interrupt::TIM2_IRQ
        );
    }

    loop {
        cortex_m::asm::wfi(); // wait for interrupt
    }
}
```

## QEMU Setup for Learning

You don't need physical hardware to learn embedded Rust. QEMU can emulate ARM Cortex-M processors.

### Installing QEMU

```bash
# Ubuntu/Debian
sudo apt install qemu-system-arm

# macOS
brew install qemu

# Verify installation
qemu-system-arm --version
```

### Running with probe-rs

```bash
# Install probe-rs
cargo install probe-rs --features cli

# Run on QEMU (Cortex-M4 target)
cargo run --target thumbv7em-none-eabihf --release
```

### Setting Up a New Project

```bash
# Install the target
rustup target add thumbv7em-none-eabihf

# Generate a new project
cargo generate --git https://github.com/rust-embedded/cortex-m-quickstart

# Build for embedded target
cargo build --target thumbv7em-none-eabihf
```

## ARM Cortex-M Basics

The ARM Cortex-M family is the most common architecture for embedded microcontrollers.

### Key Concepts

- **Thumb-2 instruction set** — compact 16/32-bit instructions
- **Harvard architecture** — separate instruction and data buses
- **Nested Vectored Interrupt Controller (NVIC)** — hardware interrupt management
- **System Control Block** — processor configuration registers

```rust
use cortex_m::asm;

// Read the processor ID
let cpuid: u32 = cortex_m::peripheral::CPUID.read();

// Use WFI (Wait For Interrupt) to save power
asm::wfi();

// Use SEV (Send Event) to wake from WFI
asm::sev();

// Memory barrier to ensure ordering
asm::dsb();
asm::isb();
```

## LED Blink Project

Let's build a complete LED blink example for an STM32F411 microcontroller.

### Project Structure

```text
led-blink/
├── Cargo.toml
├── memory.x
├── src/
│   └── main.rs
└── .cargo/
    └── config.toml
```

### Cargo.toml

```toml
[package]
name = "led-blink"
version = "0.1.0"
edition = "2021"

[dependencies]
cortex-m = "0.7"
cortex-m-rt = "0.7"
stm32f4xx-hal = { version = "0.21", features = ["stm32f411"] }
panic-halt = "0.2"

[profile.release]
opt-level = "s"
lto = true
```

### main.rs

```rust
#![no_std]
#![no_main]

use cortex_m_rt::entry;
use panic_halt as _;
use stm32f4xx_hal::{pac, prelude::*};

#[entry]
fn main() -> ! {
    let dp = pac::Peripherals::take().unwrap();
    let gpioa = dp.GPIOA.split();

    let mut led = gpioa.pa5.into_push_pull_output();

    loop {
        led.set_high();
        cortex_m::asm::delay(8_000_000); // ~1 second at 16MHz
        led.set_low();
        cortex_m::asm::delay(8_000_000);
    }
}
```

### memory.x (Linker Script)

```text
MEMORY
{
    FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 512K
    RAM (rwx)  : ORIGIN = 0x20000000, LENGTH = 128K
}
```

{% include callout.html type="info" title="Try It Yourself" content="Open the embedded playground below. Modify the delay values and observe how the LED blink rate changes. Then try configuring a different GPIO pin." %}

<details>
<summary>Advanced: Custom Interrupt Priorities</summary>

```rust
// Set interrupt priority (lower number = higher priority)
unsafe {
    let scb = &*cortex_m::peripheral::SCB::ptr();
    // Priority is implementation-defined (typically 4 bits)
    scb.shpr[10].write(0x60); // TIM2 priority = 0x60
}

// Pend an interrupt from software
cortex_m::peripheral::NVIC::pend(stm32f411::Interrupt::TIM2_IRQ);
```

</details>

## Quiz

<div class="quiz" data-answer="volatile ensures the compiler does not optimize away reads and writes to hardware registers">
<strong>Q1:</strong> Why must all hardware register access in embedded Rust use volatile operations?

<details>
<summary>Answer</summary>
Volatile ensures the compiler does not optimize away reads and writes to hardware registers. Without volatile, the compiler might skip a write or reuse a cached value, which is incorrect for hardware that can change state externally.
</details>
</div>

<div class="quiz" data-answer="PAC crates auto-generate type-safe wrappers from SVD files, providing named bitfield access without runtime cost">
<strong>Q2:</strong> What advantage do PAC crates provide over raw pointer manipulation?

<details>
<summary>Answer</summary>
PAC crates auto-generate type-safe wrappers from SVD files, providing named bitfield access without runtime cost. They prevent common errors like writing to the wrong bit position and make the code self-documenting.
</details>
</div>

<div class="quiz" data-answer="embedded-hal traits allow driver crates to be hardware-agnostic, working across any microcontroller that implements the traits">
<strong>Q3:</strong> What is the purpose of embedded-hal traits?

<details>
<summary>Answer</summary>
embedded-hal traits allow driver crates to be hardware-agnostic, working across any microcontroller that implements the traits. This enables code reuse across different hardware platforms.
</details>
</div>

## Exercises

<div class="exercise">
<h3>Exercise 1: GPIO Configuration</h3>
<p>Write a function that configures three GPIO pins (PA0, PA1, PA2) as outputs using the STM32 HAL. Each pin should control a separate LED.</p>

<details>
<summary>Solution</summary>

```rust
use stm32f4xx_hal::{pac, prelude::*, gpio::Pin};

struct Leds {
    red: Pin<'A', 0, false>,
    green: Pin<'A', 1, false>,
    blue: Pin<'A', 2, false>,
}

fn setup_leds(gpioa: &mut pac::GPIOA) -> Leds {
    // Configure MODER register: set pins 0, 1, 2 to output mode (01)
    gpioa.moder.modify(|_, w| {
        w.moder0().output();
        w.moder1().output();
        w.moder2().output()
    });

    // Configure ODR: start with all LEDs off
    gpioa.odr.modify(|_, w| {
        w.odr0().clear_bit();
        w.odr1().clear_bit();
        w.odr2().clear_bit()
    });

    // Return configured pins
    Leds {
        red: gpioa.pa0.into_push_pull_output(),
        green: gpioa.pa1.into_push_pull_output(),
        blue: gpioa.pa2.into_push_pull_output(),
    }
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 2: Timer Interrupt</h3>
<p>Write an interrupt handler that toggles an LED every time Timer 2 overflows. Configure the timer with a prescaler of 16000 and auto-reload value of 1000.</p>

<details>
<summary>Solution</summary>

```rust
#[interrupt]
fn TIM2_IRQ() {
    static mut COUNT: u32 = 0;

    // Clear interrupt flag
    unsafe {
        let tim2 = &*pac::TIM2::ptr();
        tim2.sr.modify(|_, w| w.uif().clear_bit());
    }

    // Toggle LED every interrupt
    *COUNT += 1;
    if *COUNT % 2 == 0 {
        // Toggle LED
        unsafe {
            let gpioa = &*pac::GPIOA::ptr();
            gpioa.odr.modify(|_, w| w.odr5().toggle());
        }
    }
}

fn setup_timer() {
    let dp = pac::Peripherals::take().unwrap();

    // Enable TIM2 clock
    dp.RCC.apb1enr.modify(|_, w| w.tim2en().set_bit());

    // Configure prescaler: 16MHz / 16000 = 1kHz
    dp.TIM2.psc.write(|w| w.psc().bits(15999));

    // Auto-reload: 1000 counts = 1 second
    dp.TIM2.arr.write(|w| w.arr().bits(999));

    // Enable update interrupt
    dp.TIM2.dier.modify(|_, w| w.uie().set_bit());

    // Enable timer
    dp.TIM2.cr1.modify(|_, w| w.cen().set_bit());

    // Enable interrupt in NVIC
    unsafe {
        cortex_m::peripheral::NVIC::unmask(pac::Interrupt::TIM2_IRQ);
    }
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 3: SPI Communication</h3>
<p>Write a function that sends a 4-byte command over SPI to a peripheral device, reading back any response bytes.</p>

<details>
<summary>Solution</summary>

```rust
use embedded_hal::blocking::spi::Transfer;

fn send_spi_command<SPI, CS>(
    spi: &mut SPI,
    cs: &mut CS,
    command: &[u8; 4],
) -> Result<[u8; 4], SPI::Error>
where
    SPI: Transfer<u8>,
    CS: embedded_hal::digital::OutputPin,
{
    // Assert chip select (active low)
    cs.set_low().ok();

    let mut buffer = *command;

    // Transfer 4 bytes (simultaneous send/receive)
    spi.transfer(&mut buffer)?;

    // Deassert chip select
    cs.set_high().ok();

    Ok(buffer)
}

// Usage
fn read_device_id(spi: &mut SPI, cs: &mut CS) -> Result<u32, Error> {
    let response = send_spi_command(spi, cs, &[0x9F, 0x00, 0x00, 0x00])?;
    let id = u32::from_be_bytes([response[1], response[2], response[3], 0]);
    Ok(id)
}
```

</details>
</div>

## Summary

In this chapter, you learned:

- **Embedded Rust** provides memory safety for firmware without runtime overhead
- **Memory-mapped I/O** requires `volatile` operations to prevent compiler optimizations
- **PAC crates** auto-generate type-safe register access from SVD descriptions
- **HAL traits** enable hardware-agnostic driver development
- **Interrupts** allow responsive handling of hardware events
- **QEMU** provides a no-hardware environment for learning
- **ARM Cortex-M** is the dominant architecture for embedded systems

In the next chapter, we'll dive deep into `no_std` Rust, understanding how to write Rust code without the standard library — a requirement for bare-metal firmware.

<div class="chapter-nav">
<a href="{{ page.prev }}" class="btn">← Previous: Concurrency</a>
<a href="{{ page.next }}" class="btn">Next: no_std Rust →</a>
</div>
