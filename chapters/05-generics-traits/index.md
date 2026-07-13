---
layout: chapter
title: "Generics & Traits"
chapter: 5
progress: 31
prev: /chapters/04-error-handling/
next: /chapters/06-closures-iterators/
description: "Write reusable, type-safe firmware code with generics and traits — the foundation of Rust's zero-cost abstractions."
---

# Generics & Traits

<div class="info-box">
<strong>Why this matters</strong>
<p>In firmware, you often work with multiple hardware variants through the same interface. A UART driver might support USART1, USART2, USART3 — all with identical logic. Generics let you write this logic once, while traits define the contract each implementation must fulfill. This is how HAL crates achieve hardware abstraction without runtime overhead.</p>
</div>

## Generic Functions

Generic functions accept type parameters, enabling code reuse:

```rust
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in &list[1..] {
        if item > largest {
            largest = item;
        }
    }
    largest
}

fn main() {
    let numbers = vec![34, 50, 25, 100, 65];
    println!("Largest: {}", largest(&numbers)); // 100

    let chars = vec!['y', 'm', 'a', 'q'];
    println!("Largest: {}", largest(&chars)); // 'y'
}
```

### Multiple Type Parameters

```rust
fn swap<T>(a: T, b: T) -> (T, T) {
    (b, a)
}

fn pair<T, U>(first: T, second: U) -> (T, U) {
    (first, second)
}
```

## Generic Structs

```rust
#[derive(Debug)]
struct Buffer<T> {
    data: Vec<T>,
    read_pos: usize,
    write_pos: usize,
}

impl<T> Buffer<T> {
    fn new() -> Self {
        Self {
            data: Vec::new(),
            read_pos: 0,
            write_pos: 0,
        }
    }
}

// Only available when T implements Display
impl<T: std::fmt::Display> Buffer<T> {
    fn print_all(&self) {
        for item in &self.data {
            println!("{}", item);
        }
    }
}

impl<T: Copy> Buffer<T> {
    fn peek(&self) -> Option<T> {
        self.data.get(self.read_pos).copied()
    }
}
```

## Traits

Traits define shared behavior — like interfaces in other languages:

```rust
trait Sensor {
    fn read_raw(&self) -> u16;
    fn read_calibrated(&self) -> f64;
    fn name(&self) -> &str;
}

struct TemperatureSensor {
    id: u8,
    offset: f64,
}

struct PressureSensor {
    id: u8,
    scale_factor: f64,
}

impl Sensor for TemperatureSensor {
    fn read_raw(&self) -> u16 {
        // Hardware read simulation
        1024
    }

    fn read_calibrated(&self) -> f64 {
        self.read_raw() as f64 * 0.0625 + self.offset
    }

    fn name(&self) -> &str {
        "Temperature"
    }
}

impl Sensor for PressureSensor {
    fn read_raw(&self) -> u16 {
        2048
    }

    fn read_calibrated(&self) -> f64 {
        self.read_raw() as f64 * self.scale_factor
    }

    fn name(&self) -> &str {
        "Pressure"
    }
}
```

### Default Implementations

```rust
trait Describable {
    fn describe(&self) -> String;

    // Default implementation — can be overridden
    fn short_desc(&self) -> String {
        format!("{} (no details)", self.describe())
    }
}
```

## Trait Bounds

Constrain generics with trait bounds:

```rust
// Inline bounds
fn process<T: Sensor + std::fmt::Debug>(sensor: &T) {
    println!("{}: {:?}", sensor.name(), sensor.read_raw());
}

// where clause — cleaner for complex bounds
fn complex_function<T, U>(t: T, u: U) -> String
where
    T: Sensor + Clone,
    U: std::fmt::Display + PartialEq,
{
    format!("{} - {}", t.name(), u)
}

// Impl trait — shorthand for function arguments
fn print_sensor(sensor: &impl Sensor) {
    println!("{}: {}", sensor.name(), sensor.read_calibrated());
}

// Trait bound syntax (equivalent to impl Trait)
fn print_sensor_v2<T: Sensor>(sensor: &T) {
    println!("{}: {}", sensor.name(), sensor.read_calibrated());
}
```

## Associated Types

Associated types fix a trait's output type per implementation:

```rust
trait Hal {
    type Pin;
    type Clock;

    fn configure_pin(&self, pin: Self::Pin) -> Result<(), &'static str>;
    fn set_clock(&self, clock: Self::Clock);
}

struct Stm32f4Hal {
    // ...
}

struct Stm32h7Hal {
    // ...
}

impl Hal for Stm32f4Hal {
    type Pin = u8;        // STM32F4 uses simple pin numbers
    type Clock = u32;     // Clock speed in Hz

    fn configure_pin(&self, pin: u8) -> Result<(), &'static str> {
        println!("Configuring F4 pin {}", pin);
        Ok(())
    }

    fn set_clock(&self, clock: u32) {
        println!("Setting F4 clock to {} Hz", clock);
    }
}

impl Hal for Stm32h7Hal {
    type Pin = (u8, u8);  // STM32H7 uses (port, pin) tuples
    type Clock = f64;      // Clock speed in MHz

    fn configure_pin(&self, pin: (u8, u8)) -> Result<(), &'static str> {
        println!("Configuring H7 pin ({}, {})", pin.0, pin.1);
        Ok(())
    }

    fn set_clock(&self, clock: f64) {
        println!("Setting H7 clock to {} MHz", clock);
    }
}
```

<div class="playground">
<strong>Interactive Playground</strong>
<pre><code>trait Drawable {
    fn draw(&self);
}

struct Circle { radius: f64 }
struct Square { side: f64 }

impl Drawable for Circle {
    fn draw(&self) { println!("Drawing circle r={}", self.radius); }
}

impl Drawable for Square {
    fn draw(&self) { println!("Drawing square s={}", self.side); }
}

fn draw_all(shapes: &[&dyn Drawable]) {
    for shape in shapes {
        shape.draw();
    }
}

fn main() {
    let c = Circle { radius: 5.0 };
    let s = Square { side: 3.0 };
    draw_all(&[&c, &s]);
}
</code></pre>
</div>

## Trait Objects (Dynamic Dispatch)

Trait objects use `dyn Trait` for runtime polymorphism:

```rust
fn process_sensors(sensors: &[Box<dyn Sensor>]) {
    for sensor in sensors {
        println!("{}: {}", sensor.name(), sensor.read_calibrated());
    }
}

// Creating trait objects
let sensors: Vec<Box<dyn Sensor>> = vec![
    Box::new(TemperatureSensor { id: 1, offset: 0.5 }),
    Box::new(PressureSensor { id: 2, scale_factor: 0.1 }),
];

process_sensors(&sensors);
```

### dyn vs Static Dispatch

<div class="comparison">
<div class="bad">
<strong>Static Dispatch (monomorphized)</strong>
<pre><code>// Compiler generates separate code for each T
fn process<T: Sensor>(sensor: &T) {
    println!("{}", sensor.read_calibrated());
}
// process(&temp_sensor);  → generates process_TemperatureSensor
// process(&press_sensor); → generates process_PressureSensor</code></pre>
</div>

<div class="good">
<strong>Dynamic Dispatch (vtable lookup)</strong>
<pre><code>// One function, runtime vtable lookup
fn process(sensor: &dyn Sensor) {
    println!("{}", sensor.read_calibrated());
}
// Single machine code, slight overhead from vtable indirection</code></pre>
</div>
</div>

| Aspect | Static (`impl Trait`) | Dynamic (`dyn Trait`) |
|--------|----------------------|----------------------|
| Performance | Zero-cost inlining | Vtable indirection |
| Code size | Monomorphized (larger) | Single copy (smaller) |
| Binary size | Can bloat | Compact |
| Flexibility | Fixed at compile time | Runtime polymorphism |

## Orphan Rules

You can implement a trait for a type only if:
- The trait is defined in your crate, OR
- The type is defined in your crate

```rust
// ✅ Allowed — your trait on any type
trait MyTrait { fn do_something(&self); }
impl MyTrait for u32 { /* ... */ }

// ✅ Allowed — standard trait on your type
impl std::fmt::Display for MyStruct { /* ... */ }

// ❌ NOT allowed — foreign trait on foreign type
// impl std::fmt::Display for Vec<u8> { /* ... */ }
```

### Newtype Pattern to Bypass Orphan Rules

```rust
struct MyVec(Vec<u8>);

impl std::fmt::Display for MyVec {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{} bytes]", self.0.len())
    }
}
```

## Common Traits

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct Register {
    address: u16,
    value: u32,
}

// Display — custom formatting
impl std::fmt::Display for Register {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Reg(0x{:04X} = 0x{:08X})", self.address, self.value)
    }
}

// Default — provide default values
impl Default for Register {
    fn default() -> Self {
        Self { address: 0, value: 0 }
    }
}
```

| Trait | Purpose | Common Use |
|-------|---------|------------|
| `Display` | User-facing formatting | `println!("{}", x)` |
| `Debug` | Developer debugging | `println!("{:?}", x)` |
| `Clone` | Deep copy | `let y = x.clone()` |
| `Copy` | Bitwise copy (stack only) | `let y = x;` (no move) |
| `PartialEq` | Equality comparison | `x == y` |
| `Eq` | Total equality (reflexive) | Marker trait |
| `PartialOrd` | Ordering comparison | `x < y` |
| `Ord` | Total ordering | Sorting |
| `Hash` | Hashing | HashMap keys |
| `Default` | Default values | `T::default()` |
| `From`/`Into` | Type conversion | `T::from(x)`, `x.into()` |
| `Deref` | Smart pointer deref | Automatic references |

## Real-World Firmware Example

```rust
trait Transfer {
    type Error;

    fn read(&mut self, addr: u8, buf: &mut [u8]) -> Result<(), Self::Error>;
    fn write(&mut self, addr: u8, data: &[u8]) -> Result<(), Self::Error>;
}

struct I2cBus { /* ... */ }
struct SpiBus { /* ... */ }

impl Transfer for I2cBus {
    type Error = I2cError;

    fn read(&mut self, addr: u8, buf: &mut [u8]) -> Result<(), I2cError> {
        // I2C read implementation
        Ok(())
    }

    fn write(&mut self, addr: u8, data: &[u8]) -> Result<(), I2cError> {
        Ok(())
    }
}

// Generic sensor driver — works with ANY transfer bus
struct Driver<T: Transfer> {
    bus: T,
    address: u8,
}

impl<T: Transfer> Driver<T> {
    fn read_register(&mut self, reg: u8) -> Result<u8, T::Error> {
        let mut buf = [0u8; 1];
        self.bus.read(reg, &mut buf)?;
        Ok(buf[0])
    }
}
```

## Quiz

<div class="quiz">
<strong>Quiz 1:</strong> What is the difference between <code>impl Trait</code> and <code>dyn Trait</code>?
<div class="answer" data-answer="impl Trait uses static dispatch (monomorphization); dyn Trait uses dynamic dispatch (vtable)">
<p><code>impl Trait</code> resolves at compile time — the compiler generates specialized code for each concrete type (zero-cost). <code>dyn Trait</code> resolves at runtime through a vtable pointer (slight overhead, but smaller binaries and runtime polymorphism).</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 2:</strong> Why do orphan rules exist?
<div class="answer" data-answer="To prevent conflicting trait implementations across crates and maintain coherence">
<p>Orphan rules prevent two crates from implementing the same trait for the same type, which would create ambiguous behavior. They ensure each trait implementation is unique across the entire dependency graph.</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 3:</strong> When should you use associated types vs generic parameters on a trait?
<div class="answer" data-answer="Associated types when there's one obvious implementation per type; generics when you need multiple implementations with different type parameters">
<p>Use associated types when the relationship is fixed (e.g., a HAL has one Pin type). Use generic parameters when you need multiple implementations with different type combinations (e.g., <code>Converter&lt;From, To&gt;</code>).</p>
</div>
</div>

## Exercises

<div class="exercise">
<strong>Exercise 1:</strong> Create a <code>Measurable</code> trait with a method <code>measure(&self) -> f64</code>. Implement it for two structs: <code>TemperatureSensor</code> and <code>HumiditySensor</code>. Write a generic function that finds the highest measurement from a slice.

<details class="solution">
<summary>View Solution</summary>
<pre><code>trait Measurable {
    fn measure(&self) -> f64;
    fn label(&self) -> &str;
}

struct TemperatureSensor { celsius: f64 }
struct HumiditySensor { percent: f64 }

impl Measurable for TemperatureSensor {
    fn measure(&self) -> f64 { self.celsius }
    fn label(&self) -> &str { "Temperature" }
}

impl Measurable for HumiditySensor {
    fn measure(&self) -> f64 { self.percent }
    fn label(&self) -> &str { "Humidity" }
}

fn highest<T: Measurable>(items: &[T]) -> &T {
    items.iter()
        .max_by(|a, b| a.measure().partial_cmp(&b.measure()).unwrap())
        .unwrap()
}

fn main() {
    let sensors: Vec<Box<dyn Measurable>> = vec![
        Box::new(TemperatureSensor { celsius: 23.5 }),
        Box::new(HumiditySensor { percent: 65.0 }),
    ];

    let top = highest(&sensors);
    println!("Highest: {} = {}", top.label(), top.measure());
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 2:</strong> Define a <code>Hal</code> trait with an associated type <code>Error</code> and a method <code>init(&mut self) -> Result&lt;(), Self::Error&gt;</code>. Implement it for two mock HALs.

<details class="solution">
<summary>View Solution</summary>
<pre><code>trait Hal {
    type Error: std::fmt::Display;

    fn init(&mut self) -> Result<(), Self::Error>;
}

struct HalV1;
struct HalV2;

#[derive(Debug)]
struct V1Error;

impl std::fmt::Display for V1Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "V1 initialization failed")
    }
}

#[derive(Debug)]
enum V2Error {
    ClockFailed,
    GpioFailed,
}

impl std::fmt::Display for V2Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            V2Error::ClockFailed => write!(f, "V2 clock init failed"),
            V2Error::GpioFailed => write!(f, "V2 GPIO init failed"),
        }
    }
}

impl Hal for HalV1 {
    type Error = V1Error;

    fn init(&mut self) -> Result<(), V1Error> {
        println!("HalV1 initialized");
        Ok(())
    }
}

impl Hal for HalV2 {
    type Error = V2Error;

    fn init(&mut self) -> Result<(), V2Error> {
        println!("HalV2 initialized");
        Ok(())
    }
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 3:</strong> Create a generic <code>RingBuffer&lt;T, const N: usize&gt;</code> struct with methods <code>push</code>, <code>pop</code>, and <code>is_empty</code>. Add a bound that requires <code>T: Default + Copy</code>.

<details class="solution">
<summary>View Solution</summary>
<pre><code>#[derive(Debug)]
struct RingBuffer<T: Default + Copy, const N: usize> {
    buf: [T; N],
    head: usize,
    tail: usize,
    len: usize,
}

impl<T: Default + Copy, const N: usize> RingBuffer<T, N> {
    fn new() -> Self {
        Self {
            buf: [T::default(); N],
            head: 0,
            tail: 0,
            len: 0,
        }
    }

    fn push(&mut self, item: T) -> bool {
        if self.len == N {
            return false; // Full
        }
        self.buf[self.tail] = item;
        self.tail = (self.tail + 1) % N;
        self.len += 1;
        true
    }

    fn pop(&mut self) -> Option<T> {
        if self.len == 0 {
            return None;
        }
        let item = self.buf[self.head];
        self.head = (self.head + 1) % N;
        self.len -= 1;
        Some(item)
    }

    fn is_empty(&self) -> bool {
        self.len == 0
    }
}

fn main() {
    let mut rb = RingBuffer::<u8, 4>::new();
    rb.push(1);
    rb.push(2);
    rb.push(3);

    while let Some(val) = rb.pop() {
        println!("Popped: {}", val);
    }
    println!("Empty: {}", rb.is_empty());
}
</code></pre>
</details>
</div>

## Summary

- **Generic functions** accept type parameters for code reuse.
- **Generic structs** hold data of any type, with conditional impls.
- **Traits** define shared behavior — like interfaces.
- **Trait bounds** (`T: Trait`) constrain generics.
- **`where` clauses** improve readability for complex bounds.
- **Associated types** fix a trait's output type per implementation.
- **`dyn Trait`** enables runtime polymorphism via vtable (dynamic dispatch).
- **`impl Trait`** enables compile-time polymorphism (static dispatch).
- **Orphan rules** ensure coherent trait implementations across crates.
- Master **Display, Debug, Clone, Copy, PartialEq** — you'll use them everywhere.

---

<div class="navigation">
<a href="/chapters/04-error-handling/">← Previous: Error Handling</a>
<a href="/chapters/06-closures-iterators/">Next: Closures & Iterators →</a>
</div>
