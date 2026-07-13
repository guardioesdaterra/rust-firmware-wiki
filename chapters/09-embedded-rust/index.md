---
layout: chapter
title: "Embedded Rust"
chapter: 9
progress: 56
prev: /chapters/08-concurrency/
next: /chapters/10-no-std/
---

# Embedded Rust

{% include callout.html type="info" title="Why this matters" content="Firmware security and trusted computing starts at the register level. Embedded Rust is the foundation for writing secure firmware that replaces legacy C code. Understanding memory-mapped I/O, volatile operations, and hardware abstraction layers is essential — and all of it depends on bit manipulation. See the [Bit Manipulation Deep Reference](/reference/bit-manipulation/) for a comprehensive guide with real code and stories." %}

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
    //
    // │ OPERATOR: BITWISE OR (|)
    // │ Intuition: 0|0=0, 0|1=1, 1|0=1, 1|1=1  — "any 1 makes it 1"
    // │ Usage:     SET bits to 1 without disturbing other bits
    // │
    // │ current = 0b...XXXX_XXXX_XXXX_XXXX  (unknown/previous state)
    // │ 0b01    = 0b...0000_0000_0000_0001  (mask for bit 0)
    // │ current | 0b01 ensures bit 0 is 1, all other bits unchanged.
    // │
    // │┌──────────────────────────────────────────────────────────────────┐
    // ││                    MODER register layout                        │
    // ││ Each GPIO pin uses 2 bits in MODER:                             │
    // ││   00 = Input    01 = Output    10 = Alternate    11 = Analog    │
    // ││                                                                  │
//  ││   bit 1  bit 0  │  Meaning                                        │
    // ││   0      0     │  Input (default/reset state)                    │
    // ││   0      1     │  Output  ← we want this                        │
    // ││   1      0     │  Alternate function                            │
    // ││   1      1     │  Analog                                         │
    // ││                                                                  │
    // ││ Pin 0 = bits [1:0],  Pin 1 = bits [3:2],  Pin 2 = bits [5:4]   │
    // │└──────────────────────────────────────────────────────────────────┘
    //
    // Why | 0b01 instead of just = 0b01?
    // Because other bits in the register control OTHER pins. Writing 0b01
    // would reset those to input mode. Using |= preserves existing config.
    core::ptr::write_volatile(GPIO_MODER, current | 0b01);
}
```

### The Volatile Problem

Compilers optimize away "unnecessary" reads and writes. If you write to a register and immediately read it back, the compiler might skip the write or reuse a cached value. This is catastrophic for hardware registers that can change state externally.

```rust
// ── BAD: non-volatile access ──────────────────────────────────────────
// Compiler sees: write to *reg, then read *reg.
// Optimization: "the value at *reg hasn't changed between write and read,
//                and no other code could have changed it."
// Result: compiler REUSES the written value (0x01) instead of re-reading.
//         For a hardware register that auto-clears or changes on read,
//         this is CATASTROPHIC — you missed the actual hardware state.
let reg = 0x4000_0000 as *mut u32;
unsafe { *reg = 0x01; }
unsafe { let val = *reg; } // compiler might skip the read entirely!

// ── GOOD: volatile access ─────────────────────────────────────────────
// volatile tells the compiler: "this address has SIDE EFFECTS on read/write"
//   - Every volatile read MUST actually read from the address
//   - Every volatile write MUST actually write to the address
//   - Volatile accesses CANNOT be reordered past each other
//   - Volatile accesses CANNOT be eliminated even if "unused"
//
// This is the SOLE guarantee that firmware has against the optimizer.
// MMIO registers, DMA buffers, and shared memory ALL depend on volatile.
let reg = 0x4000_0000 as *mut u32;
unsafe { core::ptr::write_volatile(reg, 0x01); }
unsafe { let val = core::ptr::read_volatile(reg); } // guaranteed: read happens AFTER write
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

// ── Type-safe GPIO configuration via PAC modify() ─────────────────────
// The modify() closure does a READ-MODIFY-WRITE:
//   1. Reads current MODER value (volatile)
//   2. Applies changes through the `w` (writer) proxy
//   3. Writes result back (volatile)
//
// .moder5().output():
//   → Pin 5 uses MODER bits [11:10] (each pin = 2 bits)
//   → Clears bits [11:10] to 00, then sets them to 01
//   → Equivalent raw: (reg & !(0b11 << 10)) | (0b01 << 10)
//
//   Step by step:
//     reg          = 0b...XXXX_XXXX_XXXX_XXXX  (current register)
//     !(0b11 << 10)= 0b...1111_0011_1111_1111  (clear mask for bits 11:10)
//     reg & mask   = 0b...XXXX_00XX_XXXX_XXXX  (bits 11:10 = 00)
//     | 0b01 << 10 = 0b...0001_0000_0000_0000
//     final        = 0b...XX01_00XX_XXXX_XXXX  (bits 11:10 = 01 = output)
peripherals.GPIOA.moder.modify(|_, w| {
    w.moder5().output() // Set PA5 as output — readable and safe
});

// ── Type-safe register write via PAC modify() ─────────────────────────
// .odr5().set_bit():
//   → ODR (Output Data Register) uses 1 bit per pin
//   → Sets bit 5 to 1 → PA5 goes HIGH → LED on
//   → Equivalent raw: reg |= 1 << 5
//
//   reg     = 0b...XXXX_XXXX_XX0X_XXXX  (current, bit 5 = 0)
//   1 << 5  = 0b...0000_0000_0010_0000  (mask for bit 5)
//   |= mask = 0b...XXXX_XXXX_XX1X_XXXX  (bit 5 = 1, others unchanged)
peripherals.GPIOA.odr.modify(|_, w| {
    w.odr5().set_bit() // Turn on LED
});
```

### Comparison: Raw vs PAC

```rust
// ── Raw register manipulation (dangerous, hard to read) ───────────────
//
// This single line does THREE bitwise operations. Let's decode each:
//
//   (val & !0x3) | 0x1
//    │      │        │
//    │      │        └── 2. OR with 0x1 = set bit 0 to 1
//    │      │               (output mode, the low bit of the field)
//    │      │
//    │      └── 1. !0x3 = bitwise NOT of mask 0b0011
//    │                    !0b0011 = 0b...11111100
//    │                    val & !0x3 = CLEAR bits [1:0] (the pin 0 field)
//    │                    This clears both MODER bits for pin 0 to 00.
//    │
//    └── 3. (cleared_val) | 0x1 = set bit 0 only → 0b01 = output
//
// Why NOT then OR? The "clear-then-set" pattern is universal:
//   reg = (reg & ~MASK) | VALUE
//
// This is the SAFE way to modify a bitfield: clear the field first,
// then set the new value. Without the clear step, old bits would remain:
//   val = 0b11;  val | 0x1 = 0b11 (WRONG! we wanted 0b01)
//   val = 0b11; (val & !0x3) = 0b00; 0b00 | 0x1 = 0b01 (CORRECT!)
unsafe {
    let moder = (0x4002_0000 + 0x00) as *mut u32;
    let val = core::ptr::read_volatile(moder);
    core::ptr::write_volatile(moder, (val & !0x3) | 0x1);
}

// ── PAC equivalent (safe, readable, self-documenting) ─────────────────
//
// The PAC's modify() closure does the EXACT same clear-then-set pattern
// internally, but you write it as named fields. The closure receives:
//   |register_value, writer|
//
// The `w` (writer) has methods like:
//   .moder0().output()  →  clears MODER0 field, sets it to Output
//
// Under the hood, the PAC generates:
//   self.moder.modify(|r, w| {
//       let r = (r & !0x3) | 0x1;  ← exact same raw bit ops!
//       w.bits(r)
//   });
//
// But you never see the bit manipulation — it's abstracted away safely.
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
    // ── Clear interrupt flag with PAC modify() ──────────────────────────
    // TIM2_SR (Status Register) bit 0 = UIF (Update Interrupt Flag)
    //
    // When the timer overflows, hardware SETS UIF=1 automatically.
    // We must CLEAR it in software, or the interrupt fires forever.
    //
    // .uif().clear_bit():
    //   → writes 0 to bit 0 of TIM2_SR
    //   → raw equivalent: reg &= !(1 << 0)
    //
    // Why clear_bit() vs write(0)?
    //   modify() preserves other bits. Writing 0 to the register would
    //   clear ALL status flags, potentially losing other events.
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
        led.set_high();                             // ← HAL wrapper: writes 1 to ODR bit 5
        cortex_m::asm::delay(8_000_000); // ~1 second at 16MHz
        led.set_low();                              // ← HAL wrapper: writes 0 to ODR bit 5
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
    // ── PAC modify() — multiple bitfield writes in one closure ──────────
    //
    // This single modify() call does ONE read-modify-write cycle that
    // modifies THREE separate bitfields simultaneously.
    //
    // GPIO MODER register layout (each pin = 2 bits):
    //
    //   Bits    │ Field  │ Description
    //   ────────┼────────┼──────────────────────────────────
    //   [1:0]   │ MODER0 │ Pin 0 mode (00=in, 01=out, 10=alt, 11=analog)
    //   [3:2]   │ MODER1 │ Pin 1 mode
    //   [5:4]   │ MODER2 │ Pin 2 mode
    //   ...     │ ...    │
    //   [31:30] │ MODER15│ Pin 15 mode
    //
    // .moder0().output() does:
    //   (reg & !(0b11 << 0)) | (0b01 << 0)
    //   → clear bits [1:0], set them to 01
    //
    // .moder1().output() does:
    //   (reg & !(0b11 << 2)) | (0b01 << 2)
    //   → clear bits [3:2], set them to 01
    //
    // The PAC is smart: it first reads the register ONCE, applies ALL
    // three field modifications to the shadow value, then writes ONCE.
    // This prevents race conditions between independent field updates.
    //
    // Equivalent raw bit ops (without PAC):
    //   let val = gpioa.moder.read().bits();
    //   val = (val & !(0b11 << 0)) | (0b01 << 0);  // pin 0 → output
    //   val = (val & !(0b11 << 2)) | (0b01 << 2);  // pin 1 → output
    //   val = (val & !(0b11 << 4)) | (0b01 << 4);  // pin 2 → output
    //   gpioa.moder.write(|w| unsafe { w.bits(val) });
    gpioa.moder.modify(|_, w| {
        w.moder0().output();
        w.moder1().output();
        w.moder2().output()
    });

    // ── ODR: Output Data Register ──────────────────────────────────────
    //
    // Unlike MODER (which uses 2 bits per pin), ODR uses 1 bit per pin.
    //
    //   bit N = 1 → pin N output is HIGH  (LED on for active-high wiring)
    //   bit N = 0 → pin N output is LOW   (LED off)
    //
    // .clear_bit() on each pin ensures all LEDs start OFF.
    // Equivalent raw: reg &= !(1 << 0)  and  reg &= !(1 << 1)
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

    // ── Toggle LED every other interrupt ──────────────────────────────
    // *COUNT += 1: simple counter increments each interrupt
    // *COUNT % 2 == 0: toggles on even counts (every other interrupt)
    //
    // .odr5().toggle():
    //   → XOR bit 5 of ODR (Output Data Register)
    //   → raw equivalent: reg ^= 1 << 5
    //
    // XOR toggle:
    //   First toggle:  ODR bit 5 was 0 → becomes 1 (LED ON)
    //   Second toggle: ODR bit 5 was 1 → becomes 0 (LED OFF)
    //   Third toggle:  ODR bit 5 was 0 → becomes 1 (LED ON again)
    //
    // Without % 2, the LED would toggle EVERY interrupt (1ms) — too fast
    // to see. The counter gives a visible 2ms blink.
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

    // ── modify(): READ-MODIFY-WRITE for individual bits ──────────────────
    //
    // .tim2en().set_bit()
    //   → sets bit 0 of RCC_APB1ENR (TIM2 clock enable)
    //   → equivalent raw: reg |= 1 << 0
    //   Without this, TIM2 doesn't receive a clock → no interrupts → silence
    dp.RCC.apb1enr.modify(|_, w| w.tim2en().set_bit());

    // ── write(): OVERWRITE the entire register ───────────────────────────
    //
    // .psc().bits(15999)
    //   → writes 15999 to the PSC (Prescaler) field of TIM2_PSC
    //   → timer clock = 16MHz / (15999 + 1) = 1kHz (1 tick per ms)
    //
    // Unlike modify(), write() doesn't read first — it sets the FULL value.
    // This is safe here because PSC is a dedicated register with no other
    // bitfields that could be disturbed.
    dp.TIM2.psc.write(|w| w.psc().bits(15999));

    // .arr().bits(999)
    //   → writes 999 to ARR (Auto-Reload Register)
    //   → timer counts from 0 to 999 then overflows
    //   → 1000 ticks × 1ms/tick = 1 second per interrupt
    //
    // Understanding .bits():
    //   The .bits() method writes the RAW value to a bitfield.
    //   It's the lowest-level PAC write — you handle the value directly.
    //   Some fields have named variants like .output() or .set_bit()
    //   that are safer because they prevent invalid values.
    dp.TIM2.arr.write(|w| w.arr().bits(999));

    // .uie().set_bit()
    //   → sets bit 0 of TIM2_DIER (Update Interrupt Enable)
    //   → allows TIM2 to generate an interrupt on overflow
    //   → raw equivalent: reg |= 1 << 0
    dp.TIM2.dier.modify(|_, w| w.uie().set_bit());

    // .cen().set_bit()
    //   → sets bit 0 of TIM2_CR1 (Counter ENable)
    //   → the timer starts counting NOW
    //   → raw equivalent: reg |= 1 << 0
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
