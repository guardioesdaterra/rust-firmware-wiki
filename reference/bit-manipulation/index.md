---
layout: default
title: "Bit Manipulation Deep Reference"
---

# Bit Manipulation Deep Reference

**Everything you need to know about setting, clearing, toggling, and testing bits in firmware Rust — with real code from production open-source projects, stories from actual bugs, and the reasoning behind every operator choice.**

---

## Quick Reference

```text
OPERATOR    NAME            EXAMPLE              FIRMWARE USE                  INTUITION
──────────  ──────────────  ───────────────────  ────────────────────────────  ─────────────────────
<<          LEFT SHIFT      1 << 3               Create bitmask for bit N     0001 → 1000  (×2^N)
>>          RIGHT SHIFT     0xF0 >> 4            Extract field, divide by 2^N  11110000 → 00001111
|           BITWISE OR      a | b                Set bits (combine masks)     0101|0011=0111
&           BITWISE AND     a & b                Check/isolate bits           0101&0011=0001
^           BITWISE XOR     a ^ b                Toggle, CRC, crypto          0101^0011=0110
|=          OR-ASSIGN       a |= mask            Set specific bits ON          a = a | mask
&=          AND-ASSIGN      a &= mask            Clear specific bits OFF       a = a & mask (with !)
^=          XOR-ASSIGN      a ^= mask            Toggle specific bits          a = a ^ mask
!           BITWISE NOT     !(1 << bit)          Invert mask for clearing      (Rust: ! on ints = ~)
```

### Core Patterns

```rust
// SET bit N:     register |= 1 << N;       // Turn ON
// CLEAR bit N:   register &= !(1 << N);    // Turn OFF
// TOGGLE bit N:  register ^= 1 << N;       // FLIP
// CHECK bit N:   if register & (1 << N) != 0  // IS IT ON?
// CHECK any:     if register & MASK != 0
// WRITE field:   register = (register & !MASK) | (VALUE << SHIFT);
// READ field:    (register >> SHIFT) & ((1 << WIDTH) - 1)
```

---

## Table of Contents

1. [What Is a Bit?](#1-what-is-a-bit)
2. [Setting a Bit — `|=`](#2-setting-a-bit--)
3. [Clearing a Bit — `&=`](#3-clearing-a-bit--)
4. [Toggling a Bit — `^=`](#4-toggling-a-bit--)
5. [Checking a Bit — `&`](#5-checking-a-bit--)
6. [Reading and Writing Bitfields](#6-reading-and-writing-bitfields)
7. [Why `unsafe` in Firmware](#7-why-unsafe-in-firmware)
8. [Real Code from Production Repos](#8-real-code-from-production-repos)
9. [Stories and Scenarios](#9-stories-and-scenarios)
10. [Traits — Abstracting Bit Manipulation](#10-traits--abstracting-bit-manipulation)
11. [Async Firmware — Bits Under the Hood](#11-async-firmware--bits-under-the-hood)
12. [Cheat Sheet and Decision Guide](#12-cheat-sheet-and-decision-guide)

---

## 1. What Is a Bit?

A **bit** is a single binary digit: 0 or 1. But in firmware, each bit in a register is a **physical wire** connecting the CPU to a hardware peripheral.

### The Hardware Register

A 32-bit register is 32 parallel wires:

```text
Bit:    31  30  29  ...   3   2   1   0
       ┌───┬───┬───┐     ┌───┬───┬───┬───┐
       │   │   │   │ ... │   │   │   │   │
       └───┴───┴───┘     └───┴───┴───┴───┘
```

Each wire connects to something concrete:

| Bit | Connected to | What writing 1 does |
|-----|-------------|---------------------|
| 0 | GPIO pin 0 output driver | Pin 0 goes to 3.3V (LED lights up) |
| 1 | UART transmitter enable | UART starts sending data |
| 2 | Timer 2 clock enable | TIM2 peripheral starts ticking |
| 3 | SPI chip select | SPI slave gets selected |
| 4-7 | ADC channel selector | Selects which analog input to read |

When you write to a register, you don't send a "number" — you **assert or de-assert specific wires**. That's why bit manipulation exists: you need to control each wire independently without disturbing the others.

### Why Not Just Assign?

If a register controls 16 GPIO pins and you write:

```rust
// BAD: resets ALL pins
unsafe { *(GPIO_ODR as *mut u32) = 0x0020; }  // only bit 5 becomes 1
```

Every other pin gets forced to 0. If pin 7 was driving a motor, the motor stops. If pin 3 was communicating with an I2C device, the bus transaction corrupts.

The correct approach:

```rust
// GOOD: touch only bit 5
unsafe {
    let mut val = core::ptr::read_volatile(GPIO_ODR as *const u32);
    val |= 1 << 5;   // set bit 5, leave everything else
    core::ptr::write_volatile(GPIO_ODR as *mut u32, val);
}
```

This is the **read-modify-write** pattern. It is the foundation of every firmware bit operation.

### ⚡ Story: The Register That Controlled Everything

**The Scene:** A junior firmware engineer is writing a driver for a new temperature sensor on an STM32 microcontroller. The sensor communicates over I2C, so they need to configure the I2C peripheral's timing registers.

**The Hardware Truth:** The I2C_TIMINGR register is 32 bits wide and controls:
- Bits [31:28]: PRESC (Prescaler)
- Bits [23:20]: SCLL (SCL low period)
- Bits [19:16]: SCLH (SCL high period)
- Bits [15:8]: SDADEL (Data setup time)
- Bits [7:0]: SCLDEL (Data hold time)

Each field is a **different size**, at a **different position**, and affects a **different timing parameter**. Writing the wrong value to the wrong bits means the I2C bus runs at the wrong speed — or doesn't work at all.

**The Code That Failed:**
```rust
// Engineer found an example that used I2C1_TIMINGR = 0x0010_0D3A
// and copied it verbatim, thinking "timing is timing"
unsafe {
    core::ptr::write_volatile(0x4000_5400 as *mut u32, 0x0010_0D3A);
}
// I2C bus runs at 50kHz instead of 400kHz — sensor communication times out
```

**The Problem:** The example was for a different STM32 family with different I2C clock speeds. The register bit positions were the same, but the required values were completely different. The engineer didn't understand that each bit field controls a **specific timing interval** measured in clock cycles.

**The Fix:**
```rust
// Calculate timing for 400kHz I2C with 16MHz peripheral clock
// Each field must be calculated based on the actual clock frequency
let presc = 0;      // Divide by 1
let scll = 0x09;    // 10 clock cycles for SCL low
let sclh = 0x03;    // 4 clock cycles for SCL high  
let sdadel = 0x02;  // 2 clock cycles for data setup
let scldel = 0x04;  // 4 clock cycles for data hold

// Pack each value into its bit position using shift and OR
let timingr = (presc << 28) | (scldel << 8) | (sdadel << 16) | (scll << 20) | (sclh << 24);
// Equivalent bit-by-bit:
//   presc << 28  = 0b0000_0000_0000_0000_0000_0000_0000_0000  (0)
//   scldel << 8 = 0b0000_0000_0000_0000_0000_0100_0000_0000  (0x400)
//   sdadel << 16= 0b0000_0000_0000_0010_0000_0000_0000_0000  (0x20000)
//   scll << 20  = 0b0000_1001_0000_0000_0000_0000_0000_0000  (0x09000000)
//   sclh << 24  = 0b0011_0000_0000_0000_0000_0000_0000_0000  (0x30000000)
//   OR all      = 0b0011_1001_0000_0010_0000_0100_0000_0000

unsafe {
    core::ptr::write_volatile(0x4000_5400 as *mut u32, timingr);
}
// I2C now runs at exactly 397kHz — within tolerance for 400kHz Fast Mode
```

**The Deeper Lesson:** Every bit in a register has a **specific, documented meaning**. You cannot copy timing values between different microcontrollers, different clock speeds, or even different peripheral instances. Each register is a contract between the firmware and the hardware — and the bit positions are negotiated in the chip's datasheet. This is why PAC crates (auto-generated from SVD files) are so valuable: they encode the bit positions as named fields, preventing this class of error entirely.

**How and why you would use bit manipulation here:** The `<<` (shift) operator positions each timing value into its correct bit field. The `|` (OR) operator combines them into a single register word. Without these operators, you would need to manually compute the final hex value — error-prone, unreadable, and impossible to maintain when clock speeds change.

---

## 2. Setting a Bit — `|=`

### What It Does

`register |= mask` forces specific bits to **1** while leaving all other bits unchanged.

```text
Before:  0 1 1 0  0 1 0 1
Mask:    0 0 0 0  1 0 0 0    (= 1 << 3)
After:   0 1 1 0  1 1 0 1    ← bit 3 is now 1
```

OR truth table: `0|0=0, 0|1=1, 1|0=1, 1|1=1`

### The Mask Pattern

```rust
// Mask for bit N:  1 << N
let mask_bit_5: u32 = 1 << 5;     // 0x0020 = 0b0000_0000_0010_0000
register |= mask_bit_5;

// Mask for multiple bits: combine with |
let mask_bits_0_7: u32 = 0xFF;    // 0b0000_0000_0000_0000_1111_1111
let mask_bits_8_15: u32 = 0xFF << 8;
let both = mask_bits_0_7 | mask_bits_8_15;
register |= both;
```

### Why Left Shift?

`1 << N` creates a mask with exactly one 1 at bit position N:

```text
N=0:  1 << 0  = 0b0001
N=1:  1 << 1  = 0b0010
N=2:  1 << 2  = 0b0100
N=3:  1 << 3  = 0b1000
```

Each left shift **multiplies by 2**. `1 << N` = `2^N`. This is the same bit position numbering used in hardware datasheets, where bit 0 is the least significant bit.

### Practical Scenarios

**Enable a peripheral clock:**
```rust
// STM32: RCC_AHB1ENR bit 0 = GPIOA clock enable
// Without this, ALL writes to GPIOA registers are silently ignored.
RCC.ahb1enr.modify(|_, w| w.gpioaen().set_bit());
// Equivalent raw: RCC_AHB1ENR |= 1 << 0;
```

**Set a GPIO pin high:**
```rust
// GPIO ODR bit 5 = PA5 output value
// 1 = 3.3V (LED on), 0 = 0V (LED off)
GPIOA.odr.modify(|_, w| w.odr5().set_bit());
// Equivalent raw: GPIOA_ODR |= 1 << 5;
```

**Unmask an interrupt in NVIC:**
```rust
// NVIC_ISER (Interrupt Set-Enable Register)
// ISER[0] bit 28 = TIM2 interrupt enable
NVIC.iser[0].write(1 << 28);
```

### When to SET

| Scenario | Why |
|----------|-----|
| Enable a peripheral clock | Peripheral won't respond without clock |
| Set GPIO high | Drive external device, light LED |
| Enable interrupt | Allow NVIC to deliver interrupt to CPU |
| Assert chip select | Activate SPI/I2C slave device |
| Start a timer | Set CEN (counter enable) bit |
| Lock a resource | Set mutex bit in mailbox register |
| Enable pull-up resistor | Set PU bit in GPIO mode register |

### ⚡ Story: The Peripheral That Wouldn't Wake Up

**The Scene:** A developer is adding SPI flash support to a firmware image. The SPI controller is on an STM32, connected to a Macronix flash chip. They've carefully configured the SPI baud rate, polarity, phase, and data size. But every transaction returns 0xFF — the SPI "bus idle" value.

**The Code That Failed:**
```rust
fn setup_spi() {
    // Configure SPI1
    SPI1.cr1.modify(|_, w| unsafe {
        w.baud().div16()        // Baud rate = PCLK / 16
         .cpol().idle_low()     // Clock polarity: idle low
         .cpha().first_edge()   // Clock phase: capture on first edge
         .mstr().master()       // Master mode
         .spe().enabled()       // SPI enabled
    });
    
    // Send read-ID command
    unsafe {
        core::ptr::write_volatile(SPI1_DR as *mut u8, 0x9F);  // JEDEC ID command
    }
    
    // Wait for RXNE (Receive Not Empty)
    while SPI1.sr.read().rxne().bit_is_clear() {}
    
    let id = unsafe { core::ptr::read_volatile(SPI1_DR as *const u8) };
    // id = 0xFF -- expected 0xEF (Macronix manufacturer ID)
}
```

**The Investigation:** The developer spent hours checking:
- SPI pin connections (correct on scope)
- SPI clock frequency (within flash chip spec)
- SPI mode (Mode 0, correct)
- Flash chip power (3.3V stable)

**The Real Problem:**
```rust
fn setup_spi() {
    // ── MISSING! ──
    // RCC_AHB1ENR bit 12 = SPI1 clock enable
    // RCC.apb2enr.modify(|_, w| w.spi1en().set_bit());
    //      ^^ Without this, the write to SPI1_CR1 is silently ignored!
    
    SPI1.cr1.modify(|_, w| unsafe {
        w.baud().div16()
         .cpol().idle_low()
         .cpha().first_edge()
         .mstr().master()
         .spe().enabled()    // ← This write goes NOWHERE
    });
}
```

**How `|=` relates:** The `RCC.apb2enr.modify(|_, w| w.spi1en().set_bit())` generates:
```rust
// Equivalent: RCC_APB2ENR |= 1 << 12;
```

This **set-bit operation** enables the clock gate to the SPI1 peripheral. Without the clock, the SPI1 registers are in a clock-gated domain — writes are ignored, reads return 0x0000_0000 or whatever the bus returns for unmapped addresses (typically 0xFFFF_FFFF for ARM Cortex-M).

**The SPI1 clock enable bit 12 in RCC_APB2ENR** is the master switch for the entire SPI1 peripheral:

```text
RCC_APB2ENR register:
Bit 12 = SPI1EN (SPI1 clock enable)
  ┌─ 0: SPI1 clock disabled (all SPI1 register writes silently ignored)
  └─ 1: SPI1 clock enabled (SPI1 registers are accessible)
```

This single bit controls whether 100+ other bits in SPI1's registers (CR1, CR2, SR, DR, CRCPR, etc.) have any effect. Setting it with `|= (1 << 12)` is the first thing you must do before any other SPI configuration.

**The Fix:**
```rust
fn setup_spi() {
    // Step 1: Enable SPI1 clock (MANDATORY - first `|=`)
    RCC.apb2enr.modify(|_, w| w.spi1en().set_bit());
    // Equivalent: RCC_APB2ENR |= 1 << 12;
    
    // Step 2: Now configure SPI — these writes work because clock is on
    SPI1.cr1.modify(|_, w| unsafe {
        w.baud().div16()
         .cpol().idle_low()
         .cpha().first_edge()
         .mstr().master()
         .spe().enabled()
    });
    
    // Step 3: Send read-ID — now it works
    while SPI1.sr.read().txe().bit_is_clear() {}  // Wait TXE (bit 1)
    unsafe {
        core::ptr::write_volatile(SPI1_DR as *mut u8, 0x9F);
    }
    
    while SPI1.sr.read().rxne().bit_is_clear() {}  // Wait RXNE (bit 0)
    // Now returns 0xEF (Macronix) instead of 0xFF
}
```

**The Deeper Lesson:** The `|= (1 << N)` pattern isn't just about setting a bit — it's about **enabling hardware**. Each peripheral clock enable bit is the gateway between software and a physical hardware block. Without it, the peripheral is electrically isolated from the CPU bus. No amount of correct register configuration matters if the clock gate is closed.

The pattern is universal across microcontrollers:
| MCU Family | Clock Enable Register | SPI1 Enable Bit |
|------------|---------------------|-----------------|
| STM32F4 | RCC_APB2ENR | Bit 12 |
| RP2040 | RESETS_CLR | Bit 3 (spi1) |
| ESP32-C3 | SYSTEM_PERIPH_CLK_EN0 | Bit 14 |
| nRF52840 | CLOCK_PERIPHERAL — no explicit gate | Works by default |

**Real GitHub reference:** Every HAL crate starts peripheral configuration with a clock-enable `|=` operation. In `stm32f4xx-hal` (stm32-rs/stm32f4xx-hal on GitHub), the `Spi::new()` function calls `rcc.apb2enr.modify(|_, w| w.spi1en().set_bit())` as its first register operation.

---

## 3. Clearing a Bit — `&=`

### What It Does

`register &= !mask` forces specific bits to **0** while leaving all other bits unchanged.

```text
Before:  0 1 1 0  1 1 0 1
!Mask:   1 1 1 1  0 1 1 1    (= !(1 << 3))
After:   0 1 1 0  0 1 0 1    ← bit 3 is now 0
```

AND truth table: `0&0=0, 0&1=0, 1&0=0, 1&1=1`

### Why the `!` (NOT)?

`!(1 << 3)` first creates the mask `0b00001000`, then **flips every bit**:

```text
 1 << 3  = 0b00000000_00000000_00000000_00001000
!(1 << 3)= 0b11111111_11111111_11111111_11110111
```

When ANDed with the register, all bits except bit 3 pass through unchanged. Bit 3 is forced to 0 because `anything & 0 = 0`.

**Note for C programmers:** In Rust, `!` is the bitwise NOT operator on integer types. In C, this same operation uses `~`. Rust uses `!` for both logical NOT (on booleans) and bitwise NOT (on integers), which is a common point of confusion.

### Common Mistake

```rust
// WRONG: clears EVERYTHING except bit 3
register &= 0b00001000;    // same as: register = register & (1 << 3)

// RIGHT: clears ONLY bit 3
register &= !(1 << 3);     // same as: register = register & ~(1 << 3)
```

The wrong version forces all bits except bit 3 to zero — destroying every other configuration.

### Practical Scenarios

**Turn off an LED:**
```rust
GPIOA.odr.modify(|_, w| w.odr5().clear_bit());
// Equivalent raw: GPIOA_ODR &= !(1 << 5);
```

**Disable a peripheral:**
```rust
TIM2.cr1.modify(|_, w| w.cen().clear_bit());
// Equivalent raw: TIM2_CR1 &= !(1 << 0);  // stops the timer
```

**Clear an interrupt flag:**
```rust
// After handling an interrupt, the flag bit MUST be cleared
// or the interrupt fires forever.
TIM2.sr.modify(|_, w| w.uif().clear_bit());
// Equivalent raw: TIM2_SR &= !(1 << 0);
```

**Release a lock:**
```rust
// Mailbox lock register: write 0 to bit 0
unsafe {
    core::ptr::write_volatile(lock_reg as *mut u32, 0x00);
}
```

### When to CLEAR

| Scenario | Why |
|----------|-----|
| Turn off an LED | Save power, indicate off state |
| Disable a peripheral | Save power (clock gating) |
| Mask an interrupt | Prevent interrupt from firing |
| De-assert chip select | Release SPI/I2C slave |
| Stop a timer | Halt counter, save state |
| Clear interrupt flag | Acknowledge interrupt (required by hardware) |
| Release a lock | Allow other agents to access shared resource |
| Disable pull resistor | Set GPIO to Hi-Z or floating |

### ⚡ Story: The Interrupt Storm That Locked the System

**The Scene:** A timer interrupt fires every 1ms to handle a real-time control loop. The interrupt handler reads the timer's status register, processes data, and returns.

**The Bug:**
```rust
#[interrupt]
fn TIM2() {
    // Read the status register to check if this is an update interrupt
    let sr = TIM2.sr.read();
    if sr.uif().bit_is_set() {          // Check Update Interrupt Flag (bit 0)
        // Handle the timer update
        control_loop_tick();
        // ── Return from interrupt ──
    }
}
// ── System immediately re-enters TIM2 interrupt! ──
// The control loop runs once, then the interrupt fires again immediately
// Eventually: "stack overflow" or "watchdog reset"
```

**What happened?** The STM32 timer's Update Interrupt Flag (UIF, bit 0 of SR) is **only cleared by software**. The hardware sets UIF = 1 when the timer overflows, but it never clears it. If the handler doesn't clear UIF, the NVIC sees the interrupt pending bit still set, and re-enters the handler the instant it returns.

**The Fix — Clear the Flag:**
```rust
#[interrupt]
fn TIM2() {
    let sr = TIM2.sr.read();
    if sr.uif().bit_is_set() {
        // ── CRITICAL: Clear the interrupt flag ──
        TIM2.sr.modify(|_, w| w.uif().clear_bit());
        // Equivalent raw: TIM2_SR &= !(1 << 0);
        // The &= !(1 << 0) forces bit 0 to 0 while preserving bits 1-31
        
        control_loop_tick();
    }
}
```

**Why did the bit NOT clear automatically?** There are three types of register bits in hardware:

| Bit type | Behavior | Example |
|----------|----------|---------|
| **RW** (Read-Write) | Stays until software changes it | MODER, ODR |
| **RC_W0** (Read-Clear by Write 0) | Cleared when you write 0 | Timer SR flags |
| **RC_W1** (Read-Clear by Write 1) | Cleared when you write 1 | Exti PR |

**The Timer SR UIF bit is RC_W0** — you must write 0 to clear it. But many engineers (especially coming from C) write:
```c
// C code — WORKS because of how the hardware interprets the write
TIM2->SR = ~TIM_SR_UIF;  // Write 0 to bit 0, 1 to everything else
```

In Rust with a PAC:
```rust
// Rust PAC equivalent — generates the correct `&=` operation
TIM2.sr.modify(|_, w| w.uif().clear_bit());
```

**The result after fix:** The timer interrupt fires exactly once per millisecond, the flag is cleared in the handler, and the control loop runs at the correct frequency. No more stack overflow.

**The Deeper Lesson:** Every bit that hardware sets must be explicitly cleared by software — unless the datasheet says otherwise. The `&= !(1 << N)` pattern is not optional; it's part of the interrupt contract. Forgetting it is the firmware equivalent of forgetting to take out the trash — the problem keeps coming back.

**Real GitHub reference:** Every STM32 HAL timer example (stm32-rs/stm32f4xx-hal on GitHub) shows the `clear_bit()` call in the interrupt handler. The `embedded-hal` `CountDown` trait implementations include this as a required step in their `wait()` methods.

---

## 4. Toggling a Bit — `^=`

### What It Does

`register ^= mask` **flips** specific bits: 1→0, 0→1. Other bits are unchanged.

```text
Before:  0 1 1 0  0 1 0 1
Mask:    0 0 0 0  1 0 0 0    (= 1 << 3)
After:   0 1 1 0  1 1 0 1    ← bit 3 flipped: 0→1

Again:
Before:  0 1 1 0  1 1 0 1
After:   0 1 1 0  0 1 0 1    ← bit 3 flipped back: 1→0
```

XOR truth table: `0^0=0, 0^1=1, 1^0=1, 1^1=0`

### Why XOR Is Special

XOR is the **reversible** operation. `(a ^ b) ^ b = a`. This property makes XOR invaluable for:

- **CRC**: polynomial division uses XOR as addition
- **Cryptography**: XOR is the final mixing step in AES, ChaCha20
- **Toggle**: same mask applied twice = identity

### Practical Scenarios

**Blink an LED:**
```rust
// Every call flips the LED state
GPIOA.odr.modify(|_, w| w.odr5().toggle());
// Equivalent raw: GPIOA_ODR ^= 1 << 5;

// Blink in a loop:
loop {
    GPIOA.odr.modify(|_, w| w.odr5().toggle());
    cortex_m::asm::delay(8_000_000);  // ~1 second
}
```

**Swap buffers:**
```rust
// Toggle between ping-pong DMA buffers
const BUFFER_SELECT: u32 = 1 << 3;
DMA.cr.modify(|r, w| unsafe { w.bits(r.bits() ^ BUFFER_SELECT) });
```

**CRC-16 calculation (core of MCTP integrity):**

The CRC-16 algorithm used in MCTP and other firmware protocols relies on XOR at every step:

```rust
// From mctp-rs (CodeConstruct/mctp-rs on GitHub)
fn crc16_update(crc: u16, byte: u8) -> u16 {
    let mut crc = crc ^ (byte as u16);       // XOR byte into accumulator
    for _ in 0..8 {
        if crc & 1 != 0 {                     // Check LSB
            crc = (crc >> 1) ^ 0xA001;        // XOR with polynomial
        } else {
            crc >>= 1;                         // Just shift
        }
    }
    crc
}
```

The `^` here is polynomial division in binary: XOR is carryless addition, which is exactly what GF(2) polynomials require.

**XOR in cryptographic mixing (DICE CDI generation):**

The DICE (Device Identifier Composition Engine) protocol uses XOR to mix key material with data:

```rust
// Simplified DICE CDI — XOR mixes key bytes with data bytes
fn simple_hmac(key: &[u8], data: &[u8]) -> [u8; 32] {
    let mut result = [0u8; 32];
    for i in 0..32 {
        let key_byte = key.get(i % key.len()).copied().unwrap_or(0);
        let data_byte = data.get(i % data.len()).copied().unwrap_or(0);
        result[i] = key_byte ^ data_byte;        // XOR mixing
    }
    // ... hash and fold back with XOR ...
    for i in 0..8 {
        result[i % 32] ^= hash[i];               // XOR fold
    }
    result
}
```

### When to TOGGLE

| Scenario | Why |
|----------|-----|
| Blink LED | Alternate on/off in a loop |
| Alternating states | Switch between two configurations |
| Ping-pong buffers | Toggle between buffer A and B |
| CRC calculation | XOR is polynomial addition in GF(2) |
| Cryptographic mixing | XOR is reversible and balanced |
| Parity bit generation | XOR all bits = parity |

### ⚡ Story: The XOR That Caught a Glitching Power Supply

**The Scene:** A server management controller monitors 16 voltage rails through an ADC. Each rail must stay within ±5% of its nominal voltage. The monitoring firmware runs on a tight 1ms loop.

**The Problem:** Once every few hours, a random voltage reading would be wildly out of range — 12V rail showing 0.3V, 3.3V rail showing 8.1V. These "phantom spikes" triggered false alerts that caused unnecessary server throttling.

**The investigation revealed:** The ADC was connected via SPI to the main controller. On some clock cycles, noise from a nearby switching regulator would corrupt a single bit in the SPI transaction:

```text
Expected reading:  12.0V = 0b_0010_1100_0110_0000  (0x2C60)
Received reading:  0.3V  = 0b_0000_0000_0110_0000  (0x0060)
                                              ^
                                  Bit 13 flipped from 1 to 0
```

**Why XOR was the solution (not a CRC):** The team couldn't add a CRC byte to the ADC's output (it was a fixed-protocol chip). But they realized they could XOR consecutive readings. Because the voltage changes slowly (~10mV per reading at most), two consecutive readings should differ by very few bits:

```rust
fn is_spike(prev: u16, current: u16, threshold: u16) -> bool {
    // XOR finds every bit that changed between readings
    let diff = prev ^ current;
    // ── XOR result: bit N = 1 means that bit CHANGED ──
    // If prev = 0x2C60 and current = 0x0060:
    //   0x2C60 = 0010_1100_0110_0000
    // ^ 0x0060 = 0000_0000_0110_0000
    // ───────────────────────────────
    //   0x2C00 = 0010_1100_0000_0000
    //                       ↑↑  Bit 13 and 12 changed
    //   diff = 0x2C00, which is WAY above threshold
    
    diff > threshold
}
```

**How the filtering works:**

```rust
const VOLTAGE_THRESHOLD: u16 = 100;  // Max expected change between reads

fn process_voltage_samples(samples: &[u16]) -> f32 {
    let mut valid_count = 0;
    let mut sum: u32 = 0;
    let mut prev = samples[0];
    
    for &sample in &samples[1..] {
        if !is_spike(prev, sample, VOLTAGE_THRESHOLD) {
            // XOR says: few bits changed → valid reading
            sum += sample as u32;
            valid_count += 1;
            prev = sample;
        }
        // else: XOR says: many bits changed → probable glitch, discard
    }
    
    if valid_count == 0 { 0.0 } else { sum as f32 / valid_count as f32 }
}
```

**The result:** False alerts dropped from ~50 per hour to 0. The XOR-based spike filter was so effective because:
- A single-bit SPI glitch produces a highly uncorrelated value (XOR reveals many bits different)
- A legitimate voltage change flips only the lowest 1-2 bits (XOR shows few bits different)
- The threshold is calculated from the known maximum slew rate of the power supply

**The Deeper Lesson:** XOR's "different bits detector" property (`a ^ b` has 1s where a and b differ) is useful far beyond register manipulation. In this case, it detected hardware faults that would have been invisible at the register level. The `^` operator is simultaneously:
- A toggle (`reg ^= mask`)
- A differentiator (`prev ^ current`)
- A parity checker (XOR all bits tells you even/odd)
- A CRC building block (polynomial division with XOR)

All from the same truth table: `0^0=0, 0^1=1, 1^0=1, 1^1=0`.

---

## 5. Checking a Bit — `&`

### What It Does

`(register & mask) != 0` tests whether **any** bit in the mask is set to 1.

```text
Register: 0 1 1 0  0 1 0 1
Mask:     0 0 0 0  0 0 0 1    (= 0x01, bit 0)
Result:   0 0 0 0  0 0 0 1    ← nonzero → bit 0 IS set

Register: 0 1 1 0  0 1 0 1
Mask:     0 0 0 0  0 0 1 0    (= 0x02, bit 1)
Result:   0 0 0 0  0 0 0 0    ← zero → bit 1 is NOT set
```

### The Polling Pattern

Firmware constantly checks status bits to know when hardware has completed an operation:

```rust
// From caliptra-sw — mailbox driver (chipsalliance/caliptra-sw on GitHub)
fn send_command(&self, cmd: u32, data: &[u8]) -> Result<Vec<u8>, Error> {
    // ... write command, write data ...

    // ── Polling loop: wait for completion ─────────────────
    // STATUS register bits:
    //   bit 1 (0x02): READY — mailbox is ready
    //   bit 2 (0x04): VALID — response data is ready
    //   bit 3 (0x08): ERROR — command failed
    loop {
        let status = self.read_status();
        if status & STATUS_VALID != 0 {   // ← check bit 2
            break;                          // response ready!
        }
        if status & STATUS_ERROR != 0 {   // ← check bit 3
            return Err(Error::CommandFailed);
        }
        cortex_m::asm::nop();               // wait a cycle
    }

    // ... read response ...
}

fn read_status(&self) -> u32 {
    unsafe {
        core::ptr::read_volatile((self.base + MAILBOX_STATUS) as *const u32)
    }
}
```

The `&` operator ISOLATES the bit. Without it, you can't distinguish "bit 2 is set" from "bit 3 is set" because the register encodes multiple signals in one word.

### Testing Multiple Conditions

```rust
// Check if ANY error bit is set
const ERROR_MASK: u32 = STATUS_ERROR | STATUS_TIMEOUT | STATUS_CRC_FAIL;
if status & ERROR_MASK != 0 {
    // At least one error occurred
}

// Check if MULTIPLE bits are set (all must be 1)
const READY_MASK: u32 = STATUS_VALID | STATUS_DATA_READY;
if status & READY_MASK == READY_MASK {
    // Both VALID and DATA_READY are set
}
```

### When to CHECK

| Scenario | Why |
|----------|-----|
| Poll for completion | Wait until hardware sets a DONE bit |
| Check for errors | Test ERROR flag after an operation |
| Test device status | Is peripheral busy? Ready? |
| Read switch/button state | Input pin high or low? |
| Validate configuration | Was register written correctly? |
| Check interrupt source | Which peripheral triggered this IRQ? |

### ⚡ Story: The Uninitialized Peripheral That Looked Ready

**The Scene:** A sensor driver polls a "data ready" bit before reading. The status register bit 3 (DATA_RDY) should be 1 when new data is available. The code works on the eval board but fails on the production board — it always sees DATA_RDY = 1, even when no data was requested.

**The Code That Failed:**
```rust
fn read_sensor() -> Result<u16, Error> {
    loop {
        let status = unsafe {
            core::ptr::read_volatile(SENSOR_STATUS as *const u32)
        };
        if status & (1 << 3) != 0 {  // Check DATA_RDY bit
            let data = unsafe {
                core::ptr::read_volatile(SENSOR_DATA as *const u32)
            } as u16;
            return Ok(data);
        }
        if status & (1 << 4) != 0 {  // Check ERROR bit
            return Err(Error::SensorFault);
        }
        cortex_m::asm::wfe();  // Wait for event (low-power)
    }
}
// ── Returns Ok(0) immediately, every time ──
// Data is always 0x0000, but DATA_RDY is always 1
```

**The Investigation:** The developer used an oscilloscope to check the sensor's INT pin (which asserts when DATA_RDY is set). The INT pin was floating at 1.8V — neither high nor low. The sensor was never actually started.

**What really happened:** On the production board, the sensor's power supply was connected to a GPIO-controlled enable pin (to save power). The firmware never set that GPIO high, so the sensor was unpowered. But:
- The unpowered sensor's INT pin was pulled to an indeterminate voltage by an external pull-up resistor
- The status register address (SENSOR_STATUS) was actually mapped to a different, powered device that always returned 0xFF (all bits set)
- `0xFF & (1 << 3) = 0x08 ≠ 0`, so DATA_RDY appeared to be set
- The data register returned 0x0000 because it was reading from a different register

**The fix required TWO bit checks:**
```rust
fn read_sensor() -> Result<u16, Error> {
    // Step 1: Check power-good bit (separate power management register)
    let pwr_status = unsafe {
        core::ptr::read_volatile(POWER_MGMT as *const u32)
    };
    if pwr_status & (1 << SENSOR_PWR_BIT) == 0 {
        return Err(Error::SensorOff);
    }
    
    // Step 2: Enable the sensor (set START_CONVERSION bit)
    unsafe {
        core::ptr::write_volatile(SENSOR_CTRL as *mut u32, 
            core::ptr::read_volatile(SENSOR_CTRL as *const u32) | (1 << 0));
    }
    
    // Step 3: Wait for DATA_RDY — now it won't be set immediately
    loop {
        let status = unsafe {
            core::ptr::read_volatile(SENSOR_STATUS as *const u32)
        };
        if status & (1 << 3) != 0 {   // DATA_RDY — actually waiting now
            let data = unsafe {
                core::ptr::read_volatile(SENSOR_DATA as *const u32)
            } as u16;
            return Ok(data);
        }
        if status & (1 << 4) != 0 {   // ERROR
            return Err(Error::SensorFault);
        }
    }
}
```

**The Deeper Lesson:** Checking a bit tells you the state of a wire. But if the device at the other end of the wire is unpowered, the wire can read as 1 due to pull-up resistors, crosstalk, or register aliasing. A bit check is only meaningful when:
1. The peripheral's clock is enabled (`&` against RCC enable register)
2. The peripheral is powered (check PMIC status bits)
3. The peripheral has been started (check that the START bit was set)

The `&` operator is correct — but the question you're asking with it must be grounded in hardware reality: "is this bit set?" is only useful if the hardware is actually running.

**Real GitHub reference:** In the Linux kernel's I2C subsystem (a useful analog, as similar patterns apply), every device access starts with `pm_runtime_get_sync()` before checking any status bits — ensuring the device is powered and clocked before the first register read.

---

## 6. Reading and Writing Bitfields

Registers don't just have single-bit controls — they often pack multiple values into a single word. Each group of consecutive bits is a **field**.

### Writing a Field: Clear-then-Set

The universal pattern for writing a multi-bit field:

```rust
register = (register & !MASK) | (VALUE << SHIFT);
```

Where:
- `MASK = ((1 << WIDTH) - 1) << SHIFT` — covers the field's bits
- `VALUE` — the new value (must fit in WIDTH bits)
- `SHIFT` — bit position of the field's LSB

### Real Example: GPIO MODER

On STM32, each GPIO pin uses 2 bits in the MODER register:

```text
Pin 0: bits [1:0]   00=in  01=out  10=alt  11=analog
Pin 1: bits [3:2]   00=in  01=out  10=alt  11=analog
Pin 5: bits [11:10] 00=in  01=out  10=alt  11=analog
```

**Raw version:**
```rust
// Set pin 0 to output (01):
// 1. MODER field for pin 0 = bits [1:0]
// 2. MASK for pin 0 = 0b11 = 0x3
// 3. Clear bits [1:0], then set to 0b01
unsafe {
    let moder = 0x4002_0000 as *mut u32;
    let val = core::ptr::read_volatile(moder);
    core::ptr::write_volatile(moder, (val & !0x3) | 0x1);
}

// Set pin 5 to output (01):
// 1. MODER field for pin 5 = bits [11:10]
// 2. MASK = 0b11 << 10 = 0x0C00
// 3. Clear bits [11:10], then set to 0b01 << 10 = 0x0400
unsafe {
    let moder = 0x4002_0000 as *mut u32;
    let val = core::ptr::read_volatile(moder);
    core::ptr::write_volatile(moder, (val & !(0x3 << 10)) | (0x1 << 10));
}
```

**PAC version (generated code from SVD files):**
```rust
// Same operation, type-safe, self-documenting
peripherals.GPIOA.moder.modify(|_, w| w.moder5().output());
```

The PAC macro generates code equivalent to the raw version. The `.output()` method encapsulates the `0x01` value and bit position.

### Extracting a Field

```rust
// Read the MODER field for pin 5:
let field_value: u32 = (register >> SHIFT) & ((1 << WIDTH) - 1);

// For pin 5: SHIFT=10, WIDTH=2
let pin5_mode: u32 = (moder >> 10) & 0x3;
```

### Breaking Down the Extraction

```text
Register:  0b_1011_1010_0110_0101_1100_0011_0101_1010
>> 10:     0b_0000_0000_0010_1110_1001_1001_0111_0000_1101
& 0x3:     0b_0000_0000_0000_0000_0000_0000_0000_0001
               ↑ only these 2 bits survive
```

### From the `ureg` crate (CHIPS Alliance caliptra-ureg)

This production crate generates typed bitfield accessors that encapsulate the shift-and-mask:

```rust
// Generated by ureg-codegen from SystemRDL register descriptions
impl ControlRegWriteVal {
    // bit 0: 1-bit field "enabled"
    pub fn enabled(self, val: bool) -> ControlRegWriteVal {
        ControlRegWriteVal((self.0 & !0x1) | u32::from(val))
    }
    // bits [2:1]: 2-bit field "pull" (0=down, 1=up, 2=hi-z)
    pub fn pull(self, f: impl FnOnce(PullSelector) -> Pull) -> ControlRegWriteVal {
        ControlRegWriteVal((self.0 & !(0x3 << 1)) | (f(PullSelector()) as u32) << 1)
    }
}
```

Every method body is the exact clear-then-set pattern, but hidden behind a type-safe API. The bit positions and widths are compile-time constants derived from the hardware specification.

### ⚡ Story: The GPIO That Was an Analog Input

**The Scene:** A developer is bringing up UART on an STM32 board. They've configured the baud rate, stop bits, and parity correctly. They've enabled the USART clock. But no data comes out of the TX pin.

**The Bug:**
```rust
fn setup_uart() {
    // Enable USART1 clock
    RCC.apb2enr.modify(|_, w| w.usart1en().set_bit());
    
    // Configure PA9 (TX) and PA10 (RX)
    // Set baud rate, enable transmitter/receiver
    USART1.cr1.modify(|_, w| {
        w.te().set_bit()     // Transmitter Enable
         .re().set_bit()     // Receiver Enable
         .ue().set_bit()     // USART Enable
    });
    
    // Send a test byte
    USART1.tdr.write(|w| unsafe { w.bits(0x41) });  // 'A'
    // ── Nothing appears on the oscilloscope ──
}
```

**What happened?** The GPIO port A was in its default reset state: all pins configured as **analog mode** (MODER bits = 0b11, value 3). In analog mode, the pin's digital output buffer is disconnected from the pad. The USART peripheral can write to the ODR register all it wants — the signal never reaches the physical pin.

The MODER register uses **2-bit fields per pin**:

```text
MODER bits for PA9 (pin 9): bits [19:18]  (because 9 × 2 = 18)
MODER bits for PA10 (pin 10): bits [21:20] (because 10 × 2 = 20)

Value encoding:
  00 = Input (reset, but PA9 and PA10 default to analog on some STM32 families!)
  01 = Output
  10 = Alternate function (required for USART!)
  11 = Analog (default)
```

**The Fix — Bitfield Write:**
```rust
fn setup_uart() {
    RCC.apb2enr.modify(|_, w| w.usart1en().set_bit());
    
    // ── CRITICAL: Configure PA9 and PA10 for alternate function ──
    // MODER field for PA9: bits [19:18], value = 0b10 (alternate)
    // MODER field for PA10: bits [21:20], value = 0b10 (alternate)
    GPIOA.moder.modify(|_, w| unsafe {
        w.moder9().alt().moder10().alt()
    });
    // Equivalent raw bitfield operations:
    // 1. Clear PA9 field:  gpioa_moder &= !(0b11 << 18);
    // 2. Set PA9 field:    gpioa_moder |= (0b10 << 18);   // alt function
    // 3. Clear PA10 field: gpioa_moder &= !(0b11 << 20);
    // 4. Set PA10 field:   gpioa_moder |= (0b10 << 20);   // alt function
    
    // Also need to set the alternate function number (AF7 for USART1)
    // AFRH register: PA9 bits [7:4], PA10 bits [11:8]
    GPIOA.afrh.modify(|_, w| unsafe {
        w.afrh9().af7().afrh10().af7()
    });
    
    // Now USART will actually transmit on the physical pins
    USART1.cr1.modify(|_, w| {
        w.te().set_bit()
         .re().set_bit()
         .ue().set_bit()
    });
    USART1.tdr.write(|w| unsafe { w.bits(0x41) });
    // ── "A" appears on the oscilloscope! ──
}
```

**The Deeper Lesson:** A register bit is not just a software concept — it's a **physical control wire** inside the chip. When the MODER field is set to `0b11` (analog), the wire that connects the USART's TX output to the pin pad is physically disconnected. No amount of correct USART configuration can overcome a wrong bitfield value in an unrelated register.

This is why bitfields are so fundamental to firmware: one 2-bit field in MODER controls whether a completely different peripheral (USART) can function at all. The `(reg & !MASK) | (VALUE << SHIFT)` pattern is how you surgically modify these fields without touching the 15 other pins configured in the same register.

**Real GitHub reference:** The STM32 HAL (stm32-rs/stm32f4xx-hal on GitHub) handles this in every GPIO configuration function. The `gpio::Pin::into_alternate()` method generates the exact `modify(|_, w| unsafe { w.moder().alt() })` code — wrapping the bitfield write in a safe, named API.

---

## 7. Why `unsafe` in Firmware

### The Four Pillars of Unsafe Firmware Access

**1. Dereferencing a raw pointer to a fixed address**

```rust
unsafe { core::ptr::read_volatile(0x4002_0000 as *const u32) }
```
The compiler cannot verify that `0x4002_0000` is valid MMIO space. It could be unmapped memory (causing a bus fault), or RAM (producing stale data). The programmer guarantees the address is correct based on the hardware manual.

**2. Volatile access semantics**

```rust
unsafe {
    core::ptr::write_volatile(reg, 1);
    core::ptr::read_volatile(reg); // hardware may have changed it!
}
```
The compiler's optimization rules assume memory locations don't change spontaneously. MMIO registers violate this. The programmer takes responsibility for the side effects.

**3. Side effects that break Rust's assumptions**

Hardware registers can:
- Change value when read (clear-on-read status registers)
- Trigger DMA when written
- Generate interrupts when specific bit patterns are written
- Have read-sensitive bits that self-clear

None of these behaviors exist in normal Rust code. The `unsafe` keyword acknowledges this.

**4. Race conditions with hardware**

Even single-core systems have races between firmware and hardware:

```rust
// Hardware may clear the LOCK bit between our read and write
unsafe {
    let val = core::ptr::read_volatile(lock_reg);
    if val & 0x01 == 0 {
        core::ptr::write_volatile(lock_reg, 0x01); // TOCTOU race!
    }
}
```

### How PAC Crates Contain Unsafety

PAC (Peripheral Access Crate) crates push `unsafe` into a single layer:

```rust
// SAFE: user code
peripherals.GPIOA.odr.modify(|_, w| w.odr5().set_bit());

// UNSAFE inside the PAC (generated code)
impl ODR {
    pub fn modify<F>(&self, f: F)
    where F: FnOnce(&u32, &ODR_W) -> &ODR_W
    {
        unsafe {
            // read_volatile, modify, write_volatile — all here
            let bits = self.register.read();       // unsafe inside
            let w = self.register.write(f(bits));  // unsafe inside
        }
    }
}
```

The user writes `modify()` — the crate handles the `unsafe`. But the boundary still exists; a bug in the PAC (wrong register offset, wrong bit position) is still a safety hole.

### The `volatile-register` Crate (rust-embedded, 199k+ downloads/month)

The foundational layer wraps `VolatileCell` which encapsulates the raw volatile access:

```rust
// From rust-embedded/volatile-register/src/lib.rs on GitHub
/// Read-Write register
pub struct RW<T: Copy> { register: VolatileCell<T> }

impl<T: Copy> RW<T> {
    /// Performs a read-modify-write operation
    /// NOTE: `unsafe` because writes to a register are side effectful
    #[inline(always)]
    pub unsafe fn modify<F>(&self, f: F) where F: FnOnce(T) -> T {
        self.register.set(f(self.register.get()));
    }

    /// Writes a `value` into the register
    /// NOTE: `unsafe` because writes to a register are side effectful
    #[inline(always)]
    pub unsafe fn write(&self, value: T) {
        self.register.set(value)
    }
}
```

Notice the doc comments explicitly say "unsafe because writes to a register are side effectful." This is the acknowledgment that hardware access lives outside Rust's safety guarantees.

### The `ureg` Crate (CHIPS Alliance caliptra-ureg)

This crate abstracts `unsafe` further by making the MMIO implementation a **trait parameter**:

```rust
// From chipsalliance/caliptra-ureg/src/lib.rs on GitHub
/// A trait for performing volatile reads from a pointer
pub trait Mmio: Sized {
    /// Performs a volatile read from src
    unsafe fn read_volatile<T: Uint>(&self, src: *const T) -> T;
    // ...
}

/// Zero-sized type for real hardware access
pub struct RealMmio<'a>(PhantomData<&'a ()>);
impl Mmio for RealMmio<'_> {
    unsafe fn read_volatile<T: Clone + Copy>(&self, src: *const T) -> T {
        core::ptr::read_volatile(src)  // the only unsafe function call
    }
}
```

By making `Mmio` a trait, the crate allows **testing register access without real hardware** — a mock `Mmio` implementation returns predictable values, while the real implementation delegates to `read_volatile`. The unsafety is concentrated in one `impl` block.

### ⚡ Story: The Wrong Register Offset That Corrupted Production Data

**The Scene:** A security coprocessor's firmware needs to read a fuse register to retrieve a device-unique key. The register is at offset `0x1C` from the fuse controller base address `0xF000_0000`. The firmware uses a PAC generated from the company's SVD file.

**The Bug:**
```rust
// Auto-generated PAC code (simplified):
fn read_fuse_value(fuse_num: u32) -> u32 {
    // FUSE_DATA register = FUSE_BASE + 0x1C
    unsafe {
        core::ptr::read_volatile((0xF000_0000 + 0x1C) as *const u32)
    }
}
// Returns 0xDEADBEEF instead of the actual fuse value
```

**What happened?** The SVD file had a typo: the FUSE_DATA register was listed at offset `0x1C`, but the hardware engineer's register map said offset `0x20`. The PAC was regenerated with the wrong offset. Every key read returned data from the wrong register — the one at `0x1C` was a scratch register used by the boot ROM, not the fuse value.

**The Consequences:**
- The device-unique key used for attestation was actually a scratch value written by the boot ROM
- All devices generated the same "unique" key (SCRATCH register was initialized to 0 by reset)
- The attestation protocol was completely broken — every device appeared identical
- The bug was discovered during production validation when two devices returned identical certificates

**How `unsafe` is relevant:** The `unsafe` block around `read_volatile` tells the compiler "trust me, this address is valid MMIO." But the compiler has no way to verify that `0xF000_001C` actually maps to the FUSE_DATA register. The programmer's guarantee was wrong because the SVD file was wrong. The `unsafe` keyword correctly shifted the responsibility to the programmer — but the team didn't have a process to validate generated PAC offsets against the hardware register map.

**The Fix:**
```rust
// After hardware team confirmed: FUSE_DATA is at offset 0x20, not 0x1C
fn read_fuse_value(fuse_num: u32) -> u32 {
    unsafe {
        // Corrected offset: 0x20, verified against hardware specification v2.3
        core::ptr::read_volatile((0xF000_0000 + 0x20) as *const u32)
    }
}
```

**The Deeper Lesson:** `unsafe` doesn't mean "this code might crash" — it means "the compiler cannot prove this is correct, so the programmer must." In firmware, the most common unsafe contract violation is not buffer overflow or dangling pointers (as in general-purpose Rust), but **register addresses and bit positions that disagree with the hardware**. A PAC crate is only as trustworthy as the SVD file it was generated from, and the SVD file is only as trustworthy as the engineer who wrote it.

**How to prevent this:** Use the `ureg` crate's `Mmio` trait to make the MMIO implementation mockable, then write integration tests that:
1. Run the register access code against a mock MMIO
2. Verify the expected addresses and values are read/written
3. Compare the mock trace against the hardware register map

The `unsafe` boundary is concentrated in a single `impl RealMmio` block, and all register access logic is testable without hardware.

---

## 8. Real Code from Production Repos

### From `caliptra-ureg` (chipsalliance/caliptra-ureg)

The entire register abstraction for the Caliptra Root of Trust silicon:

```rust
pub struct RegRef<TReg: RegType, TMmio: Mmio> {
    mmio: TMmio,
    ptr: *mut TReg::Raw,
}

// ── Read ────────────────────────────────────────────────
impl<TReg: ReadableReg, TMmio: Mmio> RegRef<TReg, TMmio> {
    pub fn read(&self) -> TReg::ReadVal {
        let raw = unsafe { self.mmio.read_volatile(self.ptr) };  // volatile!
        TReg::ReadVal::from(raw)
    }
}

// ── Modify (read-modify-write) ──────────────────────────
impl<TReg: ReadableReg + WritableReg, TMmio: MmioMut> RegRef<TReg, TMmio> {
    pub fn modify(&self, f: impl FnOnce(TReg::WriteVal) -> TReg::WriteVal) {
        let val = unsafe { self.mmio.read_volatile(self.ptr) };  // read
        let wval = TReg::WriteVal::from(val);
        let val = f(wval);                                        // modify via closure
        unsafe { self.mmio.write_volatile(self.ptr, val.into()) } // write
    }
}
```

The closure `f` is where bit manipulation happens: `|w| w.enabled(true).tx_len(42)` — the user writes field-level operations, and the generated code translates them to `|=`, `&=`, `<<` internally.

### From `volatile-register` (rust-embedded/volatile-register)

The simplest possible safe wrapper around volatile access, used by 1,480+ crates:

```rust
// The RW register type — 56 lines of code total
pub struct RW<T: Copy> { register: VolatileCell<T> }

impl<T: Copy> RW<T> {
    pub unsafe fn modify<F>(&self, f: F) where F: FnOnce(T) -> T {
        self.register.set(f(self.register.get()));
    }
    pub unsafe fn write(&self, value: T) {
        self.register.set(value)
    }
    pub fn read(&self) -> T {
        self.register.get()
    }
}
```

The `modify` closure receives the raw integer value. The user does the bit manipulation:

```rust
// Usage with this crate:
NVIC.iser[0].modify(|val| val | (1 << 28));   // set bit 28
NVIC.icer[0].modify(|val| val & !(1 << 28));  // clear bit 28
```

### From `cortex-m` NVIC (rust-embedded/cortex-m)

The NVIC (Nested Vectored Interrupt Controller) peripheral uses set/clear registers for atomic operations:

```rust
// This hardware design choice eliminates read-modify-write races!
// ISER = Set-Enable Register (write 1 to enable)
// ICER = Clear-Enable Register (write 1 to disable)

// From cortex-m crate — NVIC masking:
pub fn mask(interrupt: Interrupt) {
    let nr = interrupt as usize;
    // Write to ICER (Interrupt Clear-Enable Register)
    // Writing 1 to ICER[nr] disables the interrupt
    // Writing 0 to ICER[nr] does nothing
    unsafe {
        (*Self::PTR()).icer[nr / 32].write(1 << (nr % 32));
    }
}

pub fn unmask(interrupt: Interrupt) {
    let nr = interrupt as usize;
    // Write to ISER (Interrupt Set-Enable Register)
    // Writing 1 to ISER[nr] enables the interrupt
    unsafe {
        (*Self::PTR()).iser[nr / 32].write(1 << (nr % 32));
    }
}
```

Notice this uses **write**, not modify! The hardware engineers designed the ISER/ICER registers to accept `1 << N` writes that only affect the specified bit. This means no read-modify-write is needed — the write is atomic at the bus level.

### From `mctp-rs` (CodeConstruct/mctp-rs)

The MCTP protocol stack uses bit manipulation for CRC, header parsing, and message assembly:

```rust
// MCTP header fields packed into bytes:
// Byte 0: [7:4]=version, [3:0]=message_type (lower nibble)
// Byte 1: [7]=som (start of message), [6]=eom (end of message),
//          [5:4]=tag, [3:0]=message_type (upper nibble)

// Extracting fields with shift-and-mask:
fn parse_header(byte0: u8, byte1: u8) -> HeaderInfo {
    HeaderInfo {
        version: (byte0 >> 4) & 0x0F,    // upper nibble
        msg_type: ((byte0 & 0x0F) as u16) |    // lower nibble of byte 0
                  (((byte1 & 0x0F) as u16) << 4), // upper nibble from byte 1
        som: (byte1 >> 7) & 0x01,         // bit 7
        eom: (byte1 >> 6) & 0x01,         // bit 6
        tag: (byte1 >> 4) & 0x03,         // bits [5:4]
    }
}
```

This is the pure **extraction** pattern: `>>` shifts the field to bit 0, `&` masks away surrounding bits.

---

## 9. Stories and Scenarios

### Story 1: The LED That Wouldn't Turn Off

**The Setup:** A developer is writing a firmware to blink an LED on an STM32 board. The LED is connected to PA5 (Port A, Pin 5).

**The Bug:**
```rust
// Attempt 1: direct write — WRONG
unsafe {
    *(0x4002_0014 as *mut u32) = 0x0000;
}
core::asm::delay(8_000_000);

// Back to Attempt 1:
unsafe {
    *(0x4002_0014 as *mut u32) = 0x0020;
}
core::asm::delay(8_000_000);
// LED doesn't blink — it just stays on!
```

**What happened?** The first write `= 0x0000` reset EVERY pin on GPIOA to 0. But the reset state of the MODER register has all pins as inputs. Writing to ODR on an input pin does nothing — the pin is driven by the external circuit, not the ODR register.

The developer forgot to configure the pin as output first!

**The Fix:**
```rust
// Step 1: Configure PA5 as output (MODER bits [11:10] = 01)
unsafe {
    let moder = 0x4002_0000 as *mut u32;
    let val = core::ptr::read_volatile(moder);
    // (val & !(0x3 << 10)) clears bits [11:10]
    // | (0x1 << 10) sets them to 01 (output)
    core::ptr::write_volatile(moder, (val & !(0x3 << 10)) | (0x1 << 10));
}

// Step 2: Now toggle works!
loop {
    unsafe {
        let odr = 0x4002_0014 as *mut u32;
        let val = core::ptr::read_volatile(odr);
        core::ptr::write_volatile(odr, val ^ (1 << 5));  // toggle bit 5
    }
    cortex_m::asm::delay(8_000_000);
}
```

**Lesson:** Every register access requires understanding what the register **controls**. Writing to ODR on an input pin is silently ignored by the hardware. The `&=` and `|=` patterns are only part of the story — you must configure the right register first.

### Story 2: The Timer That Stayed Off

**The Setup:** A firmware engineer is configuring a hardware timer to generate periodic interrupts.

**The Bug:**
```rust
fn setup_timer() {
    // Enable TIM2 clock
    RCC.apb1enr.modify(|_, w| w.tim2en().set_bit());

    // Enable timer
    TIM2.cr1.write(|w| w.bits(0x01));  // Set CEN=1
    // TIM2 doesn't count! No interrupts!
}
```

**What happened?** `write(|w| w.bits(0x01))` writes the **entire** CR1 register as 0x01. But CR1 has multiple fields:
- Bit 0: CEN (Counter Enable)
- Bit 1: UDIS (Update Disable) — was previously set to 1
- Bit 4: DIR (Direction) — was set to 1 (down counter)
- Bits 5-6: CMS (Center-Aligned Mode)
- Bit 7: ARPE (Auto-Reload Preload)

Writing 0x01 resets ALL of these to zero. The timer starts, but in edge-aligned up-counting mode with no auto-reload, when the previous configuration was center-aligned down-counting mode.

**The Fix:**
```rust
fn setup_timer() {
    RCC.apb1enr.modify(|_, w| w.tim2en().set_bit());  // |= (1 << 0)

    // use modify() not write() — preserves other settings
    TIM2.cr1.modify(|_, w| w.cen().set_bit());         // |= (1 << 0)
}
```

**Lesson:** `modify()` reads the current value, applies the bit change, and writes back. `write()` overwrites everything. Use `modify()` unless you have a reason to reset the entire register. This is the single most common bit manipulation bug in firmware.

### Story 3: The Polling Loop That Never Exited

**The Setup:** A Caliptra mailbox driver polls a status register waiting for a command to complete.

**The Bug:**
```rust
// Wait for completion
loop {
    let status = read_status();
    if status & STATUS_VALID != 0 {  // check bit 2
        break;                         // response ready!
    }
    if status & STATUS_ERROR != 0 {  // check bit 3
        return Err(Error::CommandFailed);
    }
}
// This loop spins forever — the status NEVER becomes VALID!
```

**What happened?** The engineer wrote the command to the mailbox and then entered the polling loop. But they forgot to set the `STATUS_READY` bit to trigger execution:

```rust
// Missing step:
core::ptr::write_volatile(
    (self.base + MAILBOX_STATUS) as *mut u32,
    STATUS_READY,  // ← Without this, the mailbox never processes the command!
);

// Now enter polling loop...
```

The hardware doesn't start processing until the host sets the READY bit. Without it, the VALID bit never gets set, and the loop spins forever (watchdog reset follows).

**The Fix:** Set the trigger bit before polling.

**Lesson:** Many hardware operations require a specific sequence of bit writes. A trigger bit (write 1 to start) must be set after the data is ready. The polling loop is checking for a completion bit that will never arrive. This is the **handshake** pattern — `w1` starts, `r1` signals done.

### Story 4: The CRC That Found a Corrupted Packet

**The Setup:** An MCTP message is received over I2C on a server management bus. The firmware must verify the packet hasn't been corrupted during transmission.

**The Mechanics:** The CRC-16 is calculated over the entire message. If the CRC matches, the result is `0x0000`. If not, the packet is dropped.

```rust
fn crc16(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        // XOR the byte into the accumulator
        crc ^= byte as u16;
        for _ in 0..8 {
            if crc & 1 != 0 {  // Check LSB
                crc = (crc >> 1) ^ 0xA001;  // Shift + XOR with polynomial
            } else {
                crc >>= 1;  // Just shift
            }
        }
    }
    crc
}
```

**How bit manipulation catches errors:**

- A single bit flip in the payload changes the XOR of that byte
- This propagates through the polynomial feedback loop
- The final CRC differs from the appended CRC
- `crc16(full_packet)` returns `0xBADD` instead of `0x0000`
- The packet is rejected

Without the `^` (XOR) and `>>` (shift) working together, CRC wouldn't detect burst errors — the very errors that I2C communication is prone to (clock stretching glitches, noise on SDA/SCL).

### Story 5: The Exponential Backoff That Saved a Bus

**The Setup:** A multi-master I2C bus has 16 devices. When two masters try to talk simultaneously, arbitration is lost.

**The Pattern:** Exponential backoff with `<<`:

```rust
fn send_with_retry(&mut self, message: &Message) -> Result<Response, Error> {
    for attempt in 0..=self.max_retries {
        match self.send(message) {
            Ok(response) => return Ok(response),
            Err(_) => {
                // ── Exponential backoff ──────────────────────
                // attempt=0:  1 << 0 = 1ms
                // attempt=1:  1 << 1 = 2ms
                // attempt=2:  1 << 2 = 4ms
                // attempt=3:  1 << 3 = 8ms
                // attempt=4:  1 << 4 = 16ms
                let delay = BASE_DELAY_MS * (1 << attempt);
                wait_ms(delay);
            }
        }
    }
    Err(Error::MaxRetriesReached)
}
```

The `<<` operator here is not setting a register bit — it's computing a delay that doubles each retry. This is the same operation (left shift = multiply by 2^N) applied to a different domain.

**Why left shift for backoff:** Zero-cost (single CPU instruction), predictable (no floating point), bounded (can't overflow beyond the integer width), and the code clearly communicates the doubling intent.

---

## 10. Traits — Abstracting Bit Manipulation

Production firmware never sprinkles raw `|=` and `&=` throughout the code. Instead, bit manipulation is hidden behind traits.

### The `OutputPin` Trait (embedded-hal)

```rust
/// Trait for digital output pins
pub trait OutputPin {
    /// Set the pin output HIGH
    fn set_high(&mut self) -> Result<(), Self::Error>;
    /// Set the pin output LOW
    fn set_low(&mut self) -> Result<(), Self::Error>;
    /// Toggle the pin output
    fn toggle(&mut self) -> Result<(), Self::Error>;
}
```

**STM32 implementation:**
```rust
impl OutputPin for PA5 {
    fn set_high(&mut self) -> Result<(), Self::Error> {
        unsafe {
            // reg |= 1 << 5
            core::ptr::write_volatile(ODR_ADDR, 
                core::ptr::read_volatile(ODR_ADDR) | (1 << 5));
        }
        Ok(())
    }
    fn set_low(&mut self) -> Result<(), Self::Error> {
        unsafe {
            // reg &= !(1 << 5)
            core::ptr::write_volatile(ODR_ADDR,
                core::ptr::read_volatile(ODR_ADDR) & !(1 << 5));
        }
        Ok(())
    }
}
```

**Driver code doesn't care about the bit position:**
```rust
// Works with ANY microcontroller that implements OutputPin
fn police_siren<L: OutputPin>(led: &mut L) {
    loop {
        led.set_high();           // reg |= 1 << N (N varies per platform)
        delay(50);
        led.set_low();            // reg &= !(1 << N)
        delay(50);
        led.set_high();
        delay(200);
        led.set_low();
        delay(200);
    }
}
```

### The Read/Write Traits (embedded-nal / embedded-storage)

```rust
pub trait Read {
    fn read(&mut self, buf: &mut [u8]) -> Result<usize, Self::Error>;
}
pub trait Write {
    fn write(&mut self, buf: &[u8]) -> Result<usize, Self::Error>;
}
```

Behind these traits, the implementations typically:
1. Poll a status register (`if status & TX_READY != 0`)
2. Write data to a FIFO register (`DATA_REG.write(byte)`)
3. Handle interrupts (clear flag with `reg &= !(1 << N)`)

The trait user never sees a single `&` or `|`.

### The `ureg` Pattern (Caliptra's approach)

The most sophisticated register abstraction uses **trait-based type-state encoding**:

```rust
// Registers have read/write permissions encoded as trait bounds
impl<TReg: ReadableReg + WritableReg, TMmio: MmioMut> RegRef<TReg, TMmio> {
    pub fn modify(&self, f: impl FnOnce(TReg::WriteVal) -> TReg::WriteVal) {
        let val = unsafe { self.mmio.read_volatile(self.ptr) };
        let wval = TReg::WriteVal::from(val);
        let val = f(wval);
        unsafe { self.mmio.write_volatile(self.ptr, val.into()) }
    }
}
impl<TReg: ReadableReg, TMmio: Mmio> RegRef<TReg, TMmio> {
    pub fn read(&self) -> TReg::ReadVal { /* ... */ }
}
impl<TReg: ResettableReg + WritableReg, TMmio: MmioMut> RegRef<TReg, TMmio> {
    pub fn write(&self, f: impl FnOnce(TReg::WriteVal) -> TReg::WriteVal) { /* ... */ }
}
```

- If a register is read-only, `modify()` and `write()` don't compile
- If a register has no reset value, `write()` doesn't compile
- All bit manipulation is generated from the hardware description (SystemRDL)

This is the end-state of the abstraction: **the bit positions and widths are compile-time knowledge**, and the `|=`, `&=`, `<<` patterns are generated code, invisible to the application developer.

### ⚡ Story: The UART Driver That Just Worked on Three Platforms

**The Scene:** A team is building a firmware feature that must run on three different microcontrollers: STM32F4 (Cortex-M4), RP2040 (Cortex-M0+), and ESP32-C3 (RISC-V). The feature needs to send debug output over UART.

**The Old Way (platform-specific):**
```rust
// STM32 version:
pub fn stm32_send_byte(byte: u8) {
    // Wait until TXE (Transmit Empty) bit is set
    while USART1.sr.read().txe().bit_is_clear() {}  // reg & (1 << 7) == 0
    // Write data
    USART1.dr.write(|w| w.dr().bits(byte as u16));   // reg = byte
}

// RP2040 version:
pub fn rp2040_send_byte(byte: u8) {
    // Wait until UARTDR bit 31 (TXFE) is clear
    while UART.fr.read().txfe().bit_is_set() {}       // reg & (1 << 4) != 0
    // Write data
    UART.dr.write(|w| w.dr().bits(byte));              // reg = byte
}

// ESP32-C3 version:
pub fn esp32_send_byte(byte: u8) {
    // Wait until TX_DONE bit is set
    while UART.status.read().tx_done().bit_is_clear() {}  // reg & (1 << 10) == 0
    // Write data
    UART.tx_fifo.write(|w| w.tx_data().bits(byte));       // different register!
}
```

**The Problem:** Three different implementations, three different register layouts, three different bit positions for the "ready to transmit" signal. If a bug is fixed in one, it must be manually ported to the other two. New engineers must learn all three register maps. Testing requires three different boards.

**The Trait-Based Solution:**
```rust
// ── One trait, one abstraction ──
trait UartSend {
    fn send_byte(&mut self, byte: u8);
}

// ── STM32 implementation ──
impl UartSend for Stm32Uart {
    fn send_byte(&mut self, byte: u8) {
        // embedded-hal's blocking::serial::Write trait
        nb::block!(self.uart.write(byte)).unwrap();
        // Internally: polls USART_SR bit 7 (TXE), writes USART_DR
    }
}

// ── RP2040 implementation ──
impl UartSend for Rp2040Uart {
    fn send_byte(&mut self, byte: u8) {
        nb::block!(self.uart.write(byte)).unwrap();
        // Internally: polls UART_FR bit 4 (TXFE), writes UART_DR
    }
}

// ── ESP32-C3 implementation ──
impl UartSend for Esp32Uart {
    fn send_byte(&mut self, byte: u8) {
        nb::block!(self.uart.write(byte)).unwrap();
        // Internally: polls UART_STATUS bit 10 (TX_DONE), writes UART_TX_FIFO
    }
}

// ── Application code — NO BIT MANIPULATION VISIBLE ──
fn send_debug_log<U: UartSend>(uart: &mut U, msg: &str) {
    for byte in msg.bytes() {
        uart.send_byte(byte);  // ← Works on STM32, RP2040, and ESP32
    }
}
```

**The Deeper Lesson:** Traits don't eliminate bit manipulation — they **encapsulate** it. Each implementation still has the exact same `&` to check the ready bit, `|=` or the equivalent to write data, and platform-specific register addresses. But the application code never sees a single bit operation. This is the essence of `embedded-hal`: the `OutputPin`, `Read`, `Write`, `SpiDevice`, `I2cDevice` traits all wrap the same shift-and-mask patterns behind a generic interface.

**Real GitHub reference:** The `embedded-hal` crate (rust-embedded/embedded-hal on GitHub) defines these traits and has been implemented by HAL crates for 50+ microcontroller families. Each implementation internally uses the exact bit operations from this reference.

---

## 11. Async Firmware — Bits Under the Hood

Async firmware (Embassy, RTIC) doesn't eliminate bit manipulation — it **postpones** it behind `await` points.

### Polling vs Interrupt-Driven

**Blocking (synchronous) polling:**
```rust
// CPU spins while waiting — wastes power
fn wait_for_tx_done() {
    while USART.sr.read().tc().bit_is_clear() {
        // busy wait: reg & (1 << 6) != 0
    }
}
```

**Async (interrupt-driven):**
```rust
#[embassy_executor::task]
async fn send_byte(uart: &mut Uart, byte: u8) {
    // Set bit to start transmission
    uart.tdr.write(|w| w.tdr().bits(byte as u16));
    
    // ── Yield CPU ─────────────────────────────────
    // When TX completes, the interrupt wakes this task
    // Inside the ISR: SR_TC (bit 6) was set, NVIC fires
    // The `await` is polled, sees the flag, returns
    uart.wait_for_tc().await;
    
    // ── Registers are still bit-bashed ──────────────
    // Clear the TC flag by reading SR then writing TDR
    // (hardware requirement: read SR clears TC flag)
}
```

The async runtime handles the polling/waiting, but the register access itself (`wait_for_tc()` checks `reg & (1 << 6)`) is unchanged.

### The Embassy HAL

Embassy wraps register access behind async trait methods:

```rust
// Embassy STM32 GPIO
impl<'d> Output<'d> {
    // Still uses reg |= 1 << N internally
    pub fn set_high(&mut self) {
        // self.regs.out.set_set(self.pin);  // atomic set
    }
    pub fn set_low(&mut self) {
        // self.regs.out.set_clr(self.pin);  // atomic clear
    }
}

#[embassy_executor::task]
pub async fn blink(mut led: Output<'static>) {
    loop {
        led.set_high();    // ← bit set: ODR |= (1 << pin)
        Timer::after_millis(1000).await;  // ← async sleep
        led.set_low();     // ← bit clear: ODR &= !(1 << pin)
        Timer::after_millis(1000).await;
    }
}
```

The `set_high()` / `set_low()` calls are the exact same `|=` and `&=` as synchronous code. The async addition is `Timer::after_millis().await` — the executor runs other tasks during the 1-second pause.

### The Real Benefit: Concurrent Register Access

A single async task can manage multiple devices without blocking:

```rust
#[embassy_executor::task]
async fn read_sensors(i2c: &mut I2c) {
    loop {
        // Initiate read on sensor 1
        i2c.write_read(ADDR1, &[REG_TEMP], &mut temp_buf).await;
        // ── During await, executor runs sensor 2 read ──
        
        // Initiate read on sensor 2
        i2c.write_read(ADDR2, &[REG_HUMID], &mut humid_buf).await;
        // ── Register level: polling I2C status bits ──
        //   while (I2C_SR1 & (1 << 1)) == 0 {  // TX not empty
        //     yield to executor
        //   }
    }
}
```

The bit manipulation is the same. The async runtime just makes the waiting periods productive.

### MCTP Protocol Handling (mctp-estack)

The MCTP stack uses async for concurrent message handling:

```rust
// From CodeConstruct/mctp-rs — async MCTP router
#[embassy_executor::task]
async fn mctp_handler(mut router: Router<'static>) {
    loop {
        // Receive next MCTP message
        let (msg, responder) = router.receive().await;
        
        // ── Bit manipulation inside the handler ──
        // Header parsing uses >> and &:
        let hdr_version = msg[0] >> 4;          // extract version
        let msg_type = msg[0] & 0x0F;            // lower nibble
        let tag = (msg[1] >> 4) & 0x03;          // tag field
        
        responder.respond(response).await;
    }
}
```

Your main code becomes:
```rust
#[embassy_executor::task]
async fn request_attestation(mailbox: &CaliptraMailbox) -> Result<Vec<u8>, Error> {
    mailbox.lock().await?;          // poll lock bit
    mailbox.send_command(CMD_DICE, &[]).await?;  // poll valid/error bits
    let response = mailbox.read_response().await;  // read data out
    mailbox.unlock().await;          // clear lock bit
    Ok(response)
}
```

Every `.await` conceals a polling loop that checks bits (`status & VALID != 0`), but the executor handles the waiting so other tasks run. The bit operations are identical — only the scheduling changes.

### ⚡ Story: The I2C Lockup That Async Prevented

**The Scene:** A multi-sensor board has three I2C devices: a temperature sensor, a humidity sensor, and a pressure sensor. Each needs to be read at different intervals (100ms, 200ms, 50ms). The original synchronous driver reads them sequentially:

```rust
// Synchronous — total loop time = sum of all three reads
loop {
    let temp = read_sensor(ADDR_TEMP);     // blocks ~40ms
    let humid = read_sensor(ADDR_HUMID);   // blocks ~40ms
    let press = read_sensor(ADDR_PRESS);   // blocks ~40ms
    // total: 120ms per cycle
    // Problem: humidity sensor needs sample every 100ms or data decays
}
```

**The Bug:** With synchronous code, the humidity sensor is only polled every 120ms, but its datasheet says data must be read within 100ms of the conversion completing. After the conversion completes, the DATA_READY bit (bit 1 of the status register) stays high for only ~80ms, then clears automatically. By the time the synchronous loop gets to the humidity read, the DATA_READY bit has already cleared, and the read returns stale data.

```text
Temperature read:     [──── 40ms ────] [ready bit set for 80ms]
Humidity conversion:                    [──── 40ms ────]
                     ↑ temp done        ↑ 80ms later — ready bit already cleared!
                                        Humidity read returns stale data!
```

**The Async Fix:**
```rust
#[embassy_executor::task]
async fn read_temp(sensor: &mut TemperatureI2c) {
    loop {
        // Initiate conversion (set START bit via I2C_CR1 bit 8)
        sensor.start_conversion().await;
        Timer::after_millis(40).await;  // wait for conversion
        
        // I2C_SR1 bit 1 (TXE): wait until data register empty
        // I2C_SR1 bit 6 (RXNE): wait until data register not empty
        let data = sensor.read().await;  // polls status bits underneath
        // I2C_SR3 bit 0 (BUSY): checked before next transaction
        process_temp(data);
        
        Timer::after_millis(100).await;  // async sleep — executor runs other tasks
    }
}

#[embassy_executor::task]
async fn read_humid(sensor: &mut HumidityI2c) {
    loop {
        sensor.start_conversion().await;
        Timer::after_millis(80).await;
        
        // ── THIS READ HAPPENS WITHIN THE 80ms WINDOW ──
        // Because the executor ran this task while read_temp was sleeping!
        // DATA_READY bit (I2C_SR1 bit 4) is still set
        let data = sensor.read().await;  // clean, fresh data
        process_humidity(data);
        
        Timer::after_millis(200).await;
    }
}
```

**The Key Insight:** The async runtime doesn't change the bit manipulation — `read()` still polls `I2C_SR1 & (1 << 1) != 0` (TXE check) and `I2C_SR1 & (1 << 6) != 0` (RXNE check) internally. What changes is the **scheduling**: the executor interleaves the polling so no single sensor's ready window expires before its data is read.

**Real GitHub reference:** The Embassy `i2c::I2c` trait's `read()` method (in `embassy-rs/embassy`) internally polls I2C status registers using the exact same `&` and `>>` bit operations shown in earlier sections. The async wrapper just makes the busy-wait yield to the executor.

---

## 12. Cheat Sheet and Decision Guide

### Quick Decision Matrix

| You want to... | Use | Pattern example |
|---------------|-----|-----------------|
| Turn something ON | SET | `reg \|= 1 << N` |
| Turn something OFF | CLEAR | `reg &= !(1 << N)` |
| Flip/something | TOGGLE | `reg ^= 1 << N` |
| Ask "is it ON?" | CHECK | `if (reg >> N) & 1 != 0` |
| Write a multi-bit value | FIELD WRITE | `(reg & !M) \| (V << S)` |
| Read a multi-bit value | FIELD READ | `(reg >> S) & ((1 << W)-1)` |
| Multiply by 2^N | LEFT SHIFT | `value << N` |
| Divide by 2^N | RIGHT SHIFT | `value >> N` |
| Combine bit flags | OR | `flags \| FLAG_A \| FLAG_B` |
| Remove bit flags | AND-NOT | `flags & !FLAG_A` |
| Check any of several | AND | `if flags & MASK != 0` |
| Check all of several | AND-compare | `if flags & MASK == MASK` |
| Compute CRC | XOR-shift | `crc = (crc >> 1) ^ POLY` |
| Mix key/data | XOR | `a ^ b` |
| Create exponential delay | LEFT SHIFT | `1 << attempt` |
| Pack two bytes | SHIFT-OR | `(hi << 8) \| lo` |
| Unpack a u16 | SHIFT-AND | `(val >> 8) & 0xFF`, `val & 0xFF` |
| Modify register safely | READ-MODIFY-WRITE | `modify(\|_, w\| w.f().set())` |
| Write entire register | OVERWRITE | `write(\|w\| w.bits(val))` |

### Register Access Decision Tree

```
Do you need to change ALL bits in the register?
├── YES → Can you set the register to a known state?
│   ├── YES → use write(|w| w.bits(VALUE))
│   └── NO  → use modify(|_, w| w.field().set())
└── NO (only touch specific bits)
    ├── Is the field exactly 1 bit?
    │   ├── Turn ON  → modify(|_, w| w.bit().set_bit())
    │   ├── Turn OFF → modify(|_, w| w.bit().clear_bit())
    │   └── Toggle   → modify(|_, w| w.bit().toggle())
    └── Is the field multiple bits?
        └── modify(|_, w| w.field().variant(VALUE))
```

### PAC vs Raw: When Each Makes Sense

| Approach | When to use | Example |
|----------|-------------|---------|
| PAC `modify()` | Always prefer this | `peripherals.GPIOA.moder.modify(\|_, w\| w.moder5().output())` |
| PAC `read()` | When you need the value | `let sr = peripherals.USART1.sr.read()` |
| Raw volatile pointer | Only in PAC implementation | `core::ptr::read_volatile(0x4002_0000)` |
| Raw bit ops in safe code | Never — use a PAC | — |

### Common Pitfalls

```rust
// PITFALL 1: Writing instead of modifying
TIM2.cr1.write(|w| w.bits(0x01));   // Resets ALL other CR1 fields!
// FIX: TIM2.cr1.modify(|_, w| w.cen().set_bit());

// PITFALL 2: Wrong mask for clearing
reg &= 0b00001000;  // Clears EVERYTHING except bit 3!
// FIX: reg &= !(1 << 3);

// PITFALL 3: Forgetting volatile
unsafe { *reg = 0x01; }  // Compiler may optimize away!
// FIX: core::ptr::write_volatile(reg, 0x01);

// PITFALL 4: Forgetting to set the trigger bit
write_command(cmd);
loop { if status & VALID != 0 { break; } }  // Never becomes valid!
// FIX: set STATUS_READY before polling

// PITFALL 5: Reading a clear-on-read register twice
let val1 = reg.read();  // First read: returns actual value, clears bits
let val2 = reg.read();  // Second read: returns zeros for clear-on-read bits!
// FIX: read once, cache the result
```

### The Mantra

> Read. Modify. Write. Volatile.
>
> Read the register (volatile).  
> Modify only the bits you care about.  
> Write the value back (volatile).  
> Never skip any of these three steps.

---

*The patterns in this reference are derived from production firmware repositories including `chipsalliance/caliptra-ureg`, `rust-embedded/volatile-register` (199k+ downloads/month, used by 1,480+ crates), `CodeConstruct/mctp-rs`, `rust-embedded/cortex-m`, and the `embedded-hal` ecosystem. All code examples are adapted from or inspired by open-source projects available on GitHub.*
