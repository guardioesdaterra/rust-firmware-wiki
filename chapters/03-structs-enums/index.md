---
layout: chapter
title: "Structs & Enums"
chapter: 3
progress: 18
prev: /chapters/02-ownership/
next: /chapters/04-error-handling/
description: "Master Rust's composite types: structs for grouping data, enums for expressing variants, and pattern matching for elegant control flow."
---

# Structs & Enums

<div class="info-box">
<strong>Why this matters</strong>
<p>Structs and enums are the building blocks of every Rust program. In firmware, structs model hardware registers and peripherals, while enums represent state machines and error conditions. Mastering these types is essential for writing clear, safe embedded code.</p>
</div>

## Structs

Structs group related data under a single name. Rust offers three struct flavors: **unit**, **tuple**, and **named-field** structs.

```rust
// Unit struct — no data, useful as a marker type
struct Marker;

// Tuple struct — unnamed fields
struct Color(u8, u8, u8);

// Named-field struct — most common in firmware
struct GpioPin {
    port: u8,
    pin: u8,
    direction: Direction,
}
```

### Creating and Using Structs

```rust
let red = Color(255, 0, 0);
let pin = GpioPin {
    port: 1,
    pin: 5,
    direction: Direction::Output,
};
```

### Field Init Shorthand

When a variable name matches the field name:

```rust
let port = 1;
let pin = 5;
// Shorthand — Rust infers field names from variable names
let gpio = GpioPin {
    port,
    pin,
    direction: Direction::Output,
};
```

### Struct Update Syntax

```rust
let pin2 = GpioPin {
    port: 2,
    ..pin  // copies remaining fields from `pin`
};
```

<div class="warning">
<strong>⚠ Ownership Warning</strong>
<p>The <code>..pin</code> syntax moves fields that don't implement <code>Copy</code>. In the example above, <code>direction</code> is moved into <code>pin2</code>, so <code>pin.direction</code> is no longer accessible.</p>
</div>

## Methods with impl Blocks

Methods are defined inside `impl` blocks. The first parameter is `self`, `&self`, or `&mut self`.

```rust
impl GpioPin {
    // Constructor — associated function (no self)
    fn new(port: u8, pin: u8) -> Self {
        Self {
            port,
            pin,
            direction: Direction::Input,
        }
    }

    // Immutable borrow — read-only access
    fn read(&self) -> bool {
        // Hardware register read simulation
        self.port == 1 && self.pin == 5
    }

    // Mutable borrow — modify the pin
    fn set_output(&mut self) {
        self.direction = Direction::Output;
    }

    // Consuming method — takes ownership
    fn into_port(self) -> u8 {
        self.port
    }
}
```

### Multiple impl Blocks

You can split methods across multiple `impl` blocks — useful for conditional compilation:

```rust
#[cfg(feature = "stm32f4")]
impl GpioPin {
    fn enable_clock(&self) { /* STM32F4-specific */ }
}

#[cfg(feature = "stm32h7")]
impl GpioPin {
    fn enable_clock(&self) { /* STM32H7-specific */ }
}
```

<div class="playground">
<strong>Interactive Playground</strong>
<pre><code>struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn area(&self) -> u32 {
        self.width * self.height
    }

    fn can_hold(&self, other: &Rectangle) -> bool {
        self.width > other.width && self.height > other.height
    }
}

fn main() {
    let rect1 = Rectangle { width: 30, height: 50 };
    let rect2 = Rectangle { width: 10, height: 40 };

    println!("Area: {}", rect1.area());
    println!("Can hold rect2? {}", rect1.can_hold(&rect2));
}
</code></pre>
</div>

## Enums

Enums define a type by enumerating its possible variants. Unlike C enums, Rust variants can carry data.

```rust
enum Direction {
    North,
    South,
    East,
    West,
}

enum IpAddr {
    V4(u8, u8, u8, u8),
    V6(String),
}

enum Message {
    Quit,                       // No data
    Move { x: i32, y: i32 },   // Named fields
    Write(String),              // Single value
    ChangeColor(u8, u8, u8),   // Tuple
}
```

### Enums with Methods

```rust
impl Message {
    fn call(&self) {
        match self {
            Message::Quit => println!("Quitting"),
            Message::Move { x, y } => println!("Moving to ({}, {})", x, y),
            Message::Write(text) => println!("Writing: {}", text),
            Message::ChangeColor(r, g, b) => println!("Color: ({}, {}, {})", r, g, b),
        }
    }
}
```

## Pattern Matching

The `match` expression is Rust's most powerful control flow tool. Every possible variant must be handled.

```rust
let direction = Direction::North;

let dx = match direction {
    Direction::North => 0,
    Direction::South => 0,
    Direction::East  => 1,
    Direction::West  => -1,
};
```

### Matching with Enums Carrying Data

```rust
fn describe_ip(ip: &IpAddr) {
    match ip {
        IpAddr::V4(a, b, c, d) => {
            println!("IPv4: {}.{}.{}.{}", a, b, c, d);
        }
        IpAddr::V6(addr) => {
            println!("IPv6: {}", addr);
        }
    }
}
```

### if let — Matching a Single Pattern

```rust
// When you only care about one variant
if let Message::Write(text) = &msg {
    println!("Text message: {}", text);
}
```

### while let — Loop Until Pattern Fails

```rust
let mut stack = vec![1, 2, 3];

while let Some(top) = stack.pop() {
    println!("Popped: {}", top);
}
```

## Option\<T\>

Rust has no `null`. Instead, `Option<T>` represents the presence or absence of a value:

```rust
enum Option<T> {
    Some(T),
    None,
}
```

```rust
fn find_pin(port: u8, pin: u8) -> Option<GpioPin> {
    if port <= 3 && pin <= 15 {
        Some(GpioPin::new(port, pin))
    } else {
        None
    }
}

// Using Option with match
match find_pin(1, 5) {
    Some(pin) => println!("Found pin on port {}", pin.port),
    None => println!("Invalid pin"),
}

// Using Option methods
let pin = find_pin(1, 5).unwrap_or_else(|| GpioPin::new(0, 0));
```

## Result\<T, E\>

For operations that can fail, `Result<T, E>` is the idiomatic choice:

```rust
fn read_register(addr: u16) -> Result<u32, &'static str> {
    if addr < 0x4000 {
        Ok(0xDEADBEEF)
    } else {
        Err("Invalid register address")
    }
}

// Pattern matching
match read_register(0x1000) {
    Ok(value) => println!("Register value: 0x{:08X}", value),
    Err(e) => println!("Error: {}", e),
}
```

## Derived Traits

Use `#[derive(...)]` to auto-implement common traits:

```rust
#[derive(Debug, Clone, PartialEq)]
struct Sensor {
    id: u8,
    name: String,
    calibration: f64,
}

let s1 = Sensor { id: 1, name: "temp".into(), calibration: 1.0 };
let s2 = s1.clone();           // Clone
println!("{:?}", s1);           // Debug — prints struct with fields
assert_eq!(s1, s2);            // PartialEq — compares all fields
```

### Display Trait (Manual Implementation)

`Display` requires a manual `impl`:

```rust
use std::fmt;

impl fmt::Display for Direction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Direction::North => write!(f, "↑"),
            Direction::South => write!(f, "↓"),
            Direction::East  => write!(f, "→"),
            Direction::West  => write!(f, "←"),
        }
    }
}
```

## Comparison: Bad vs Good

<div class="comparison">
<div class="bad">
<strong>❌ Bad — Using raw tuples for related data</strong>
<pre><code>fn process((x, y, z): (u32, u32, u32)) {
    // What do x, y, z mean? No context!
    println!("x={}, y={}, z={}", x, y, z);
}

process((10, 20, 30)); // Confusing at the call site</code></pre>
</div>

<div class="good">
<strong>✅ Good — Using a named struct</strong>
<pre><code>struct AccelerometerReading {
    x: u32,
    y: u32,
    z: u32,
}

fn process(reading: AccelerometerReading) {
    println!("x={}, y={}, z={}", reading.x, reading.y, reading.z);
}

process(AccelerometerReading { x: 10, y: 20, z: 30 });</code></pre>
</div>
</div>

<div class="comparison">
<div class="bad">
<strong>❌ Bad — Using bool flags for state</strong>
<pre><code>struct Connection {
    is_connected: bool,
    is_authenticated: bool,
    is_encrypted: bool,
    // Missing combinations create invalid states!</code></pre>
</div>

<div class="good">
<strong>✅ Good — Using an enum state machine</strong>
<pre><code>enum ConnectionState {
    Disconnected,
    Connected,
    Authenticated { session_key: [u8; 32] },
    Encrypted { session_key: [u8; 32], cipher: Aes256 },
}</code></pre>
</div>
</div>

## Collapsible: Advanced — Tuple Structs as Newtypes

<div class="collapsible">
<summary><strong>Advanced: Type-Safe IDs with Newtypes</strong></summary>

Newtype pattern wraps a primitive in a tuple struct for type safety:

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
struct DeviceId(u16);

#[derive(Debug, Clone, Copy, PartialEq)]
struct RegisterAddr(u16);

fn read_reg(device: DeviceId, addr: RegisterAddr) -> u32 {
    // Can't accidentally swap device and addr!
    0
}

// This would NOT compile:
// read_reg(addr, device); // wrong types!
```

This prevents entire classes of bugs at zero runtime cost.
</div>

<div class="collapsible">
<summary><strong>Advanced: Enum Variants with Data</strong></summary>

Enums with data are Rust's algebraic data types. In firmware, they model registers with different access modes:

```rust
enum Register {
    ReadOnly(u32),
    WriteOnly(u32),
    ReadWrite { read_val: u32, write_val: u32 },
}

impl Register {
    fn read(&self) -> Option<u32> {
        match self {
            Register::ReadOnly(v) => Some(*v),
            Register::ReadWrite { read_val, .. } => Some(*read_val),
            Register::WriteOnly(_) => None, // Can't read a write-only register
        }
    }
}
```
</div>

## Quiz

<div class="quiz">
<strong>Quiz 1:</strong> What does the <code>..</code> syntax do in struct update?
<div class="answer" data-answer="Copies remaining fields from another struct instance">
<p>It copies/moves remaining fields from another instance. Fields not explicitly set are taken from the source.</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 2:</strong> Why does Rust use <code>Option&lt;T&gt;</code> instead of null pointers?
<div class="answer" data-answer="To make nullability explicit in the type system, eliminating null pointer dereferences at compile time">
<p>Option forces you to handle the "no value" case explicitly. The compiler won't let you use a value without checking if it's Some or None.</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 3:</strong> What is the difference between <code>match</code> and <code>if let</code>?
<div class="answer" data-answer="match must handle all variants; if let handles only one pattern and ignores the rest">
<p><code>match</code> is exhaustive — you must cover every variant. <code>if let</code> is syntactic sugar for matching a single pattern and ignoring all others.</p>
</div>
</div>

## Exercises

<div class="exercise">
<strong>Exercise 1:</strong> Create a <code>Motor</code> struct with fields <code>rpm: u32</code>, <code>direction: Direction</code>, and <code>enabled: bool</code>. Implement a <code>new()</code> constructor and a <code>stop()</code> method.

<details class="solution">
<summary>View Solution</summary>
<pre><code>#[derive(Debug)]
struct Motor {
    rpm: u32,
    direction: Direction,
    enabled: bool,
}

impl Motor {
    fn new(rpm: u32, direction: Direction) -> Self {
        Self { rpm, direction, enabled: true }
    }

    fn stop(&mut self) {
        self.enabled = false;
        self.rpm = 0;
    }
}

fn main() {
    let mut motor = Motor::new(1500, Direction::North);
    println!("Motor: {:?}", motor);
    motor.stop();
    println!("After stop: {:?}", motor);
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 2:</strong> Define an <code>InterruptReason</code> enum with variants: <code>Timer(u32)</code>, <code>UartRx(u8)</code>, <code>GpioEdge { pin: u8, rising: bool }</code>. Implement <code>Display</code> for it.

<details class="solution">
<summary>View Solution</summary>
<pre><code>use std::fmt;

#[derive(Debug)]
enum InterruptReason {
    Timer(u32),
    UartRx(u8),
    GpioEdge { pin: u8, rising: bool },
}

impl fmt::Display for InterruptReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            InterruptReason::Timer(ch) => write!(f, "Timer channel {}", ch),
            InterruptReason::UartRx(byte) => write!(f, "UART received 0x{:02X}", byte),
            InterruptReason::GpioEdge { pin, rising } => {
                let edge = if *rising { "rising" } else { "falling" };
                write!(f, "GPIO pin {} {} edge", pin, edge)
            }
        }
    }
}

fn main() {
    let reasons = vec![
        InterruptReason::Timer(1),
        InterruptReason::UartRx(0x41),
        InterruptReason::GpioEdge { pin: 3, rising: true },
    ];
    for r in &reasons {
        println!("{}", r);
    }
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 3:</strong> Write a function <code>safe_divide(a: f64, b: f64) -> Option&lt;f64&gt;</code> that returns <code>None</code> if <code>b</code> is zero. Then use <code>map</code> to double the result.

<details class="solution">
<summary>View Solution</summary>
<pre><code>fn safe_divide(a: f64, b: f64) -> Option<f64> {
    if b == 0.0 {
        None
    } else {
        Some(a / b)
    }
}

fn main() {
    let result = safe_divide(10.0, 3.0).map(|v| v * 2.0);
    println!("Doubled: {:?}", result); // Some(6.666...)

    let result = safe_divide(10.0, 0.0).map(|v| v * 2.0);
    println!("Div by zero: {:?}", result); // None
}
</code></pre>
</details>
</div>

## Summary

- **Structs** group related data — prefer named fields for clarity.
- **Enums** model types with multiple variants; they can carry data per variant.
- **`impl` blocks** define methods and associated functions.
- **Pattern matching** with `match` is exhaustive and powerful.
- **`Option<T>`** replaces null with compile-time safety.
- **`Result<T, E>`** is the standard for fallible operations.
- **Derived traits** (`Debug`, `Clone`, `PartialEq`) save boilerplate.
- **Display** must be implemented manually for custom formatting.

---

<div class="navigation">
<a href="/chapters/04-error-handling/">Next: Error Handling →</a>
</div>
