---
layout: chapter
title: "Error Handling"
chapter: 4
progress: 25
prev: /chapters/03-structs-enums/
next: /chapters/05-generics-traits/
description: "Learn Rust's robust error handling model: Result, Option, the ? operator, custom error types, and idiomatic patterns for firmware."
---

# Error Handling

<div class="info-box">
<strong>Why this matters</strong>
<p>Firmware encounters constant failure modes: hardware timeouts, invalid register reads, bus errors, and unexpected states. Rust's error handling forces you to address every failure explicitly — no silent crashes, no unchecked null pointers. This chapter teaches you to handle errors gracefully and propagate them cleanly through your call stack.</p>
</div>

## Panic vs Result

Rust has two error mechanisms:

| Mechanism | Use Case | Recoverable? |
|-----------|----------|-------------|
| `panic!` | Programming bugs, invariant violations | No — thread unwinds/aborts |
| `Result<T, E>` | Expected runtime failures | Yes — caller decides |

```rust
// Panic — for bugs, not for runtime errors
fn divide_by_zero() {
    let x: i32 = 1 / 0; // Panics at runtime
}

// Result — for expected failures
fn divide(a: i32, b: i32) -> Result<i32, &'static str> {
    if b == 0 {
        Err("Division by zero")
    } else {
        Ok(a / b)
    }
}
```

<div class="warning">
<strong>⚠ Firmware Rule</strong>
<p>In embedded firmware, <code>panic!</code> should be reserved for truly unrecoverable states. Always prefer <code>Result</code> for operations that talk to hardware. A panicked firmware board is a brick until reset.</p>
</div>

## The ? Operator

The `?` operator propagates errors automatically, keeping code clean:

```rust
fn read_sensor() -> Result<u16, IoError> {
    let bus = I2cBus::open(1)?;            // Returns early on Err
    let raw = bus.read_register(0x40)?;    // Returns early on Err
    Ok(raw)
}
```

Without `?`, you'd write:

```rust
fn read_sensor() -> Result<u16, IoError> {
    let bus = match I2cBus::open(1) {
        Ok(b) => b,
        Err(e) => return Err(e),
    };
    let raw = match bus.read_register(0x40) {
        Ok(r) => r,
        Err(e) => return Err(e),
    };
    Ok(raw)
}
```

### ? with Option

`?` works with `Option` too, converting `None` to `Err` in a `Result` context:

```rust
fn find_first_active_pin(pins: &[GpioPin]) -> Result<&GpioPin, &'static str> {
    let pin = pins.iter().find(|p| p.is_active())?; // None becomes Err
    Ok(pin)
}
```

<div class="playground">
<strong>Interactive Playground</strong>
<pre><code>fn first_even(numbers: &[i32]) -> Option<i32> {
    let first = numbers.iter().find(|&&n| n % 2 == 0)?;
    Some(*first)
}

fn main() {
    let nums = vec![1, 3, 4, 7, 8];
    println!("{:?}", first_even(&nums)); // Some(4)

    let odd = vec![1, 3, 5];
    println!("{:?}", first_even(&odd));  // None
}
</code></pre>
</div>

## Custom Error Types

Real firmware needs structured errors. Define enums for your error domains:

```rust
use std::fmt;

#[derive(Debug)]
enum CommError {
    Timeout,
    Nack,
    BusBusy,
    InvalidAddress(u16),
    CrcMismatch { expected: u16, actual: u16 },
}

impl fmt::Display for CommError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CommError::Timeout => write!(f, "Communication timed out"),
            CommError::Nack => write!(f, "Device sent NACK"),
            CommError::BusBusy => write!(f, "Bus is busy"),
            CommError::InvalidAddress(addr) => write!(f, "Invalid address: 0x{:04X}", addr),
            CommError::CrcMismatch { expected, actual } => {
                write!(f, "CRC mismatch: expected 0x{:04X}, got 0x{:04X}", expected, actual)
            }
        }
    }
}
```

## The From Trait for Error Conversion

Implement `From` to convert between error types, enabling `?` to work seamlessly:

```rust
#[derive(Debug)]
enum SensorError {
    Io(CommError),
    Calibration(f64),
    OutOfRange,
}

impl From<CommError> for SensorError {
    fn from(e: CommError) -> Self {
        SensorError::Io(e)
    }
}

fn read_temperature() -> Result<f64, SensorError> {
    let bus = I2cBus::open(1).map_err(SensorError::Io)?;
    let raw = bus.read_register(0x40).map_err(SensorError::Io)?;
    let temp = (raw as f64) * 0.0625;

    if temp < -40.0 || temp > 125.0 {
        return Err(SensorError::OutOfRange);
    }
    Ok(temp)
}
```

## Error Propagation Patterns

### Early Return Pattern

```rust
fn process_data(buf: &[u8]) -> Result<u32, &'static str> {
    if buf.is_empty() {
        return Err("Empty buffer");
    }

    let header = buf.first().ok_or("No header")?;

    if *header != 0xAA {
        return Err("Invalid header byte");
    }

    Ok(u32::from_be_bytes([
        buf.get(1).copied().ok_or("Missing byte 1")?,
        buf.get(2).copied().ok_or("Missing byte 2")?,
        buf.get(3).copied().ok_or("Missing byte 3")?,
        buf.get(4).copied().ok_or("Missing byte 4")?,
    ]))
}
```

### Combining Multiple Results

```rust
fn configure_device() -> Result<(), &'static str> {
    // Run multiple operations, propagating the first error
    init_clock()?;
    configure_pins()?;
    enable_peripheral()?;
    Ok(())
}
```

### Collecting Errors

```rust
fn validate_config(config: &Config) -> Result<(), Vec<&'static str>> {
    let errors: Vec<&'static str> = [
        if config.clock_hz == 0 { Some("Clock speed cannot be 0") } else { None },
        if config.buffer_size > 4096 { Some("Buffer too large") } else { None },
        if config.timeout_ms == 0 { Some("Timeout cannot be 0") } else { None },
    ].into_iter().flatten().collect();

    if errors.is_empty() { Ok(()) } else { Err(errors) }
}
```

## Unwrap and Expect

Use these for prototyping or when failure is truly impossible:

```rust
// unwrap — panics with generic message on None/Err
let value = some_option.unwrap();

// expect — panics with custom message
let value = some_option.expect("Value must exist after initialization");

// In tests — perfectly acceptable
#[test]
fn test_divide() {
    let result = divide(10, 2).unwrap();
    assert_eq!(result, 5);
}
```

## Comparison: Bad vs Good

<div class="comparison">
<div class="bad">
<strong>❌ Bad — Panicking on expected failures</strong>
<pre><code>fn read_adc(channel: u8) -> u16 {
    let value = spi_transfer(channel).unwrap(); // PANICS on bus error!
    value
}</code></pre>
</div>

<div class="good">
<strong>✅ Good — Returning Result</strong>
<pre><code>fn read_adc(channel: u8) -> Result<u16, SpiError> {
    let value = spi_transfer(channel)?;
    Ok(value)
}</code></pre>
</div>
</div>

<div class="comparison">
<div class="bad">
<strong>❌ Bad — Swallowing errors silently</strong>
<pre><code>fn send_data(buf: &[u8]) {
    let _ = spi.write(buf); // Ignores the error!
    // Caller has no idea data was lost</code></pre>
</div>

<div class="good">
<strong>✅ Good — Handling or propagating</strong>
<pre><code>fn send_data(buf: &[u8]) -> Result<(), SpiError> {
    spi.write(buf)?;
    Ok(())
    // OR handle specifically:
    // match spi.write(buf) {
    //     Ok(_) => { /* log success */ }
    //     Err(SpiError::Timeout) => { /* retry logic */ }
    //     Err(e) => return Err(e),
    // }
}</code></pre>
</div>
</div>

## Collapsible: Advanced — Error Handling Crates

<div class="collapsible">
<summary><strong>Advanced: thiserror and anyhow</strong></summary>

**thiserror** — Derive `Error` for custom error types with minimal boilerplate:

```rust
use thiserror::Error;

#[derive(Error, Debug)]
enum FirmwareError {
    #[error("I2C timeout on bus {0}")]
    I2cTimeout(u8),

    #[error("Invalid calibration value: {0}")]
    BadCalibration(f64),

    #[error("Sensor not found at address 0x{0:X}")]
    NotFound(u16),
}
```

**anyhow** — Quick prototyping with boxed dynamic errors:

```rust
use anyhow::{Result, Context};

fn init() -> Result<()> {
    let config = std::fs::read_to_string("config.toml")
        .context("Failed to read config file")?;

    let parsed: Config = toml::from_str(&config)
        .context("Failed to parse config")?;

    Ok(())
}
```

For firmware, prefer `thiserror` for library code and `anyhow` for application/binary code.
</div>

<div class="collapsible">
<summary><strong>Advanced: Error Context Chains</strong></summary>

Build rich error chains for debugging:

```rust
#[derive(Error, Debug)]
enum PipelineError {
    #[error("Stage '{stage}' failed")]
    StageFailed {
        stage: String,
        #[source]
        cause: Box<dyn std::error::Error>,
    },
}

fn process() -> Result<(), PipelineError> {
    let data = read_sensor()
        .map_err(|e| PipelineError::StageFailed {
            stage: "read".into(),
            cause: Box::new(e),
        })?;

    Ok(())
}
```
</div>

## Quiz

<div class="quiz">
<strong>Quiz 1:</strong> When should you use <code>panic!</code> vs <code>Result</code>?
<div class="answer" data-answer="panic for programming bugs and invariant violations; Result for expected runtime failures">
<p>Use <code>panic!</code> for bugs: index out of bounds, failed assertions, broken invariants. Use <code>Result</code> for expected failures: I/O errors, invalid input, network timeouts.</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 2:</strong> What does the <code>?</code> operator do?
<div class="answer" data-answer="If the Result is Ok, unwraps the value; if Err, returns early from the function with that error">
<p>The <code>?</code> operator unwraps <code>Ok(value)</code> or returns <code>Err(e)</code> from the enclosing function. It also calls <code>From::from</code> to convert error types if needed.</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 3:</strong> Why implement the <code>From</code> trait on error types?
<div class="answer" data-answer="To enable automatic error conversion with the ? operator between different error types">
<p>When <code>From&lt;A&gt; for B</code> is implemented, <code>?</code> on a <code>Result&lt;_, A&gt;</code> in a function returning <code>Result&lt;_, B&gt;</code> auto-converts the error.</p>
</div>
</div>

## Exercises

<div class="exercise">
<strong>Exercise 1:</strong> Define a <code>FirmwareError</code> enum with variants for <code>IoTimeout</code>, <code>CrcError</code>, and <code>InvalidConfig(String)</code>. Implement <code>Display</code> and <code>std::error::Error</code> for it.

<details class="solution">
<summary>View Solution</summary>
<pre><code>use std::fmt;

#[derive(Debug)]
enum FirmwareError {
    IoTimeout,
    CrcError,
    InvalidConfig(String),
}

impl fmt::Display for FirmwareError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FirmwareError::IoTimeout => write!(f, "I/O timeout"),
            FirmwareError::CrcError => write!(f, "CRC check failed"),
            FirmwareError::InvalidConfig(msg) => write!(f, "Invalid config: {}", msg),
        }
    }
}

impl std::error::Error for FirmwareError {}

fn main() {
    let err = FirmwareError::InvalidConfig("missing clock".into());
    println!("Error: {}", err);
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 2:</strong> Write a function <code>parse_header(buf: &[u8]) -> Result&lt;(u8, u16), &amp;str&gt;</code> that reads a 1-byte type and 2-byte length from a buffer. Return an error if the buffer is too short.

<details class="solution">
<summary>View Solution</summary>
<pre><code>fn parse_header(buf: &[u8]) -> Result<(u8, u16), &'static str> {
    if buf.len() < 3 {
        return Err("Buffer too short for header");
    }

    let msg_type = buf[0];
    let length = u16::from_be_bytes([buf[1], buf[2]]);

    Ok((msg_type, length))
}

fn main() {
    let valid = [0x01, 0x00, 0x0A];
    let invalid = [0x01];

    println!("{:?}", parse_header(&valid));  // Ok((1, 10))
    println!("{:?}", parse_header(&invalid)); // Err("Buffer too short for header")
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 3:</strong> Refactor this code to use the <code>?</code> operator instead of nested match:

```rust
fn process() -> Result<u32, &'static str> {
    match read_sensor() {
        Ok(raw) => match calibrate(raw) {
            Ok(calibrated) => Ok(calibrated),
            Err(e) => Err(e),
        },
        Err(e) => Err(e),
    }
}
```

<details class="solution">
<summary>View Solution</summary>
<pre><code>fn process() -> Result<u32, &'static str> {
    let raw = read_sensor()?;
    let calibrated = calibrate(raw)?;
    Ok(calibrated)
}
</code></pre>
</details>
</div>

## Summary

- **`panic!`** for bugs; **`Result`** for expected failures.
- The **`?` operator** propagates errors and converts types via `From`.
- Define **custom error enums** with `Display` for readable messages.
- Implement **`From`** for automatic error conversion between types.
- **`unwrap`/`expect`** are acceptable in tests and prototyping.
- Use **thiserror** for library error types, **anyhow** for applications.
- Never silently swallow errors — always handle or propagate them.

---

<div class="navigation">
<a href="/chapters/03-structs-enums/">← Previous: Structs & Enums</a>
<a href="/chapters/05-generics-traits/">Next: Generics & Traits →</a>
</div>
