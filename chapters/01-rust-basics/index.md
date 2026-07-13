---
layout: chapter
title: "Rust Basics"
chapter: 1
progress: 6
prev: null
next: "/chapters/02-ownership/"
description: "Master the fundamentals of Rust: variables, types, functions, and control flow"
---

## Why Rust for Firmware?

Before diving into code, let's understand why Rust is perfect for firmware development:

| Feature | Benefit | Real-World Impact |
|---------|---------|-------------------|
| **Memory Safety** | No buffer overflows | Prevents security vulnerabilities |
| **Zero-Cost Abstractions** | No runtime overhead | Runs on bare metal |
| **No Undefined Behavior** | Predictable execution | Critical for firmware |
| **Ownership System** | Compile-time memory management | No garbage collector needed |
| **Pattern Matching** | Robust error handling | Handles hardware failures gracefully |
| **Traits** | Hardware abstraction | Write once, run on any hardware |

<div class="info-box success">
  <strong>9elements uses Rust</strong> because it provides C-level performance with modern language features. Their Caliptra and OpenPRoT projects are written in Rust, proving it's production-ready for firmware.
</div>

## 1.1 Setting Up Your Environment

### Step 1: Install Rust

```bash
# Install rustup (Rust's package manager)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Follow the prompts:
# 1) Proceed with installation (default)
# 2) Configure PATH

# Reload your shell
source ~/.cargo/env

# Verify installation
rustc --version
cargo --version
```

### Step 2: Install Essential Tools

```bash
# Code formatter (auto-formats your code)
rustup component add rustfmt

# Linter (finds potential bugs)
rustup component add clippy

# Documentation generator
cargo install cargo-doc

# For embedded development (we'll use in Chapter 9)
rustup target add thumbv7m-none-eabi
```

### Step 3: Configure Your Editor

**VS Code (Recommended):**
1. Install "rust-analyzer" extension
2. Install "Even Better TOML" extension  
3. Install "Error Lens" extension
4. Install "CodeLLDB" for debugging

<div class="collapsible">
  <div class="collapsible-header">Alternative Editors</div>
  <div class="collapsible-body">
    <p><strong>IntelliJ IDEA:</strong> Install the Rust plugin</p>
    <p><strong>Neovim:</strong> Use rust-analyzer with LSP</p>
    <p><strong>Emacs:</strong> Use rustic-mode with rust-analyzer</p>
  </div>
</div>

## 1.2 Hello, World!

Create your first Rust program:

```bash
# Create a new project
cargo new hello-rust
cd hello-rust

# Look at the structure
ls -la
```

Your project structure:
```
hello-rust/
├── Cargo.toml    # Project configuration (like package.json)
├── src/
│   └── main.rs   # Main source file
└── .gitignore
```

### Understanding Cargo.toml

```toml
[package]
name = "hello-rust"      # Project name
version = "0.1.0"        # Version (semver)
edition = "2021"         # Rust edition (2015, 2018, 2021)

[dependencies]
# Add dependencies here
# Example: serde = "1.0"
```

### Your First Code

Open `src/main.rs`:

```rust
// This is the main function - entry point of your program
fn main() {
    // Print to console with newline
    println!("Hello, world!");
    
    // Print with formatting
    let name = "Rust";
    println!("Hello, {}!", name);
    
    // Print with debug formatting
    let numbers = vec![1, 2, 3];
    println!("Numbers: {:?}", numbers);
    
    // Print with pretty debug formatting
    println!("Pretty: {:#?}", numbers);
}
```

Run it:

```bash
cargo run
# Output: Hello, world!
```

<div class="playground">
  <div class="playground-header">
    <span class="title">Interactive Playground</span>
    <div class="actions">
      <button class="btn btn-primary run-btn">▶ Run</button>
    </div>
  </div>
  <div class="playground-body">
    <div class="playground-editor">
      <textarea>fn main() {
    println!("Hello, {}!", "world");
    println!("2 + 2 = {}", 2 + 2);
    println!("Pi is approximately {}", 3.14);
}</textarea>
    </div>
    <div class="playground-output">
      <span class="info">Click "Run" to execute the code</span>
    </div>
  </div>
</div>

## 1.3 Variables and Mutability

### Immutable by Default

```rust
fn main() {
    // Variables are IMMUTABLE by default
    let x = 5;
    println!("x = {}", x);
    
    // x = 6;  // ERROR! Cannot mutate immutable variable
    // Uncomment the line above to see the error
    
    // Use 'mut' for mutable variables
    let mut y = 5;
    println!("y = {}", y);
    
    y = 6;  // OK! Now we can mutate
    println!("y = {}", y);
}
```

### Why Immutable by Default?

<div class="info-box">
  <strong>Safety:</strong> Immutable variables prevent accidental changes. This is crucial in firmware where a wrong value could crash the system. You must explicitly declare mutability with <code>mut</code>.
</div>

### Constants

```rust
// Constants must have type annotation
const MAX_POINTS: u32 = 100_000;
const PI: f64 = 3.14159265358979;

fn main() {
    println!("MAX_POINTS = {}", MAX_POINTS);
    println!("PI = {}", PI);
    
    // Constants can be declared anywhere
    const SECONDS_IN_HOUR: u32 = 3600;
    println!("Seconds in hour: {}", SECONDS_IN_HOUR);
}
```

### Shadowing

```rust
fn main() {
    // Shadowing: create new variable with same name
    let x = 5;
    println!("x = {}", x);  // 5
    
    let x = x + 1;  // Different variable!
    println!("x = {}", x);  // 6
    
    let x = x * 2;  // Different variable again!
    println!("x = {}", x);  // 12
    
    // Shadowing can change types
    let spaces = "   ";      // &str (string)
    let spaces = spaces.len();  // usize (number)
    println!("spaces = {}", spaces);  // 3
    
    // This is different from mut
    // let mut spaces = "   ";
    // spaces = spaces.len();  // ERROR! Can't change type
}
```

## 1.4 Data Types

### Scalar Types

```rust
fn main() {
    // ===== INTEGERS =====
    // i8, i16, i32, i64, i128 (signed)
    // u8, u16, u32, u64, u128 (unsigned)
    // isize, usize (depends on architecture)
    
    let a: i32 = -42;        // 32-bit signed
    let b: u32 = 42;         // 32-bit unsigned
    let c = 100_000;         // Underscore for readability (i32 default)
    
    // Integer literals in different bases
    let decimal = 98_222;      // Decimal
    let hex = 0xff;            // Hexadecimal
    let octal = 0o77;          // Octal
    let binary = 0b1111_0000;  // Binary
    let byte = b'A';           // Byte (u8 only)
    
    println!("a={}, b={}, c={}", a, b, c);
    println!("hex={}, octal={}, binary={}", hex, octal, binary);
    
    // ===== FLOATS =====
    // f32, f64 (f64 is default)
    let x = 2.0;      // f64
    let y: f32 = 3.0;  // f32
    
    println!("x={}, y={}", x, y);
    
    // ===== BOOLEANS =====
    let t = true;
    let f: bool = false;
    
    println!("t={}, f={}", t, f);
    
    // ===== CHARACTERS =====
    // 4 bytes, Unicode
    let c = 'z';
    let z = 'ℤ';
    let heart = '❤';
    let cat = '🐱';
    
    println!("c={}, z={}, heart={}, cat={}", c, z, heart, cat);
}
```

### Type Sizes

<div class="collapsible">
  <div class="collapsible-header">Integer Type Sizes</div>
  <div class="collapsible-body">
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Size</th>
          <th>Range</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>i8</td><td>1 byte</td><td>-128 to 127</td></tr>
        <tr><td>u8</td><td>1 byte</td><td>0 to 255</td></tr>
        <tr><td>i16</td><td>2 bytes</td><td>-32,768 to 32,767</td></tr>
        <tr><td>u16</td><td>2 bytes</td><td>0 to 65,535</td></tr>
        <tr><td>i32</td><td>4 bytes</td><td>-2.1B to 2.1B</td></tr>
        <tr><td>u32</td><td>4 bytes</td><td>0 to 4.2B</td></tr>
        <tr><td>i64</td><td>8 bytes</td><td>±9.2 quintillion</td></tr>
        <tr><td>u64</td><td>8 bytes</td><td>0 to 18.4 quintillion</td></tr>
      </tbody>
    </table>
    <p><strong>Tip:</strong> In firmware, size matters! Use the smallest type that fits your data.</p>
  </div>
</div>

### Compound Types

```rust
fn main() {
    // ===== TUPLES =====
    // Fixed size, can have different types
    let tup: (i32, f64, u8) = (500, 6.4, 1);
    
    // Destructuring
    let (x, y, z) = tup;
    println!("x={}, y={}, z={}", x, y, z);
    
    // Index access
    let five_hundred = tup.0;
    let six_point_four = tup.1;
    let one = tup.2;
    println!("{} {} {}", five_hundred, six_point_four, one);
    
    // ===== ARRAYS =====
    // Fixed size, same type
    let a = [1, 2, 3, 4, 5];
    let first = a[0];
    let second = a[1];
    println!("first={}, second={}", first, second);
    
    // Type annotation
    let b: [i32; 5] = [1, 2, 3, 4, 5];
    
    // Initialize with same value
    let c = [3; 5];  // [3, 3, 3, 3, 3]
    println!("b={:?}", b);
    println!("c={:?}", c);
    
    // Access with index (bounds checking)
    let index = 3;
    let element = a[index];
    println!("Element at index {}: {}", index, element);
}
```

## 1.5 Functions

```rust
// Simple function
fn greet() {
    println!("Hello!");
}

// Function with parameters
fn greet_name(name: &str) {
    println!("Hello, {}!", name);
}

// Function with return value
fn add(a: i32, b: i32) -> i32 {
    a + b  // No semicolon = return value
}

// Function with explicit return
fn multiply(a: i32, b: i32) -> i32 {
    return a * b;  // Explicit return
}

// Function with multiple return values (tuple)
fn swap(a: i32, b: i32) -> (i32, i32) {
    (b, a)
}

// Function with early return
fn divide(a: f64, b: f64) -> Option<f64> {
    if b == 0.0 {
        return None;  // Early return
    }
    Some(a / b)
}

fn main() {
    greet();
    greet_name("Rust");
    
    let sum = add(5, 3);
    let product = multiply(5, 3);
    println!("sum={}, product={}", sum, product);
    
    let (x, y) = swap(1, 2);
    println!("x={}, y={}", x, y);
    
    match divide(10.0, 3.0) {
        Some(result) => println!("10 / 3 = {}", result),
        None => println!("Cannot divide by zero"),
    }
    
    // Statements vs Expressions
    let x = 5;      // Statement (no return)
    let y = {       // Block expression
        let x = 3;
        x + 1       // Returns 4 (no semicolon)
    };
    println!("y={}", y);
}
```

<div class="comparison">
  <div class="bad">
    <div class="label">❌ Wrong</div>
    <pre><code>fn add(a: i32, b: i32) -> i32 {
    a + b;  // Semicolon makes this a statement!
}</code></pre>
  </div>
  <div class="good">
    <div class="label">✅ Correct</div>
    <pre><code>fn add(a: i32, b: i32) -> i32 {
    a + b  // No semicolon = expression (return value)
}</code></pre>
  </div>
</div>

## 1.6 Control Flow

### If Expressions

```rust
fn main() {
    let number = 7;
    
    // Basic if
    if number > 5 {
        println!("greater than five");
    }
    
    // if-else
    if number % 2 == 0 {
        println!("even");
    } else {
        println!("odd");
    }
    
    // if-else if-else
    if number < 5 {
        println!("less than five");
    } else if number < 10 {
        println!("less than ten");
    } else {
        println!("ten or greater");
    }
    
    // if as expression (like ternary in other languages)
    let condition = true;
    let number = if condition { 5 } else { 6 };
    println!("number = {}", number);
    
    // Nested conditions
    let age = 25;
    let has_id = true;
    
    if age >= 21 && has_id {
        println!("Welcome to the club!");
    } else if age >= 18 {
        println!("You need an ID");
    } else {
        println!("Sorry, too young");
    }
}
```

### Loops

```rust
fn main() {
    // ===== LOOP =====
    // Infinite loop (can break with value)
    let mut counter = 0;
    let result = loop {
        counter += 1;
        if counter == 10 {
            break counter * 2;  // Return value from loop
        }
    };
    println!("result = {}", result);  // 20
    
    // ===== WHILE LOOP =====
    let mut number = 3;
    while number != 0 {
        println!("{}!", number);
        number -= 1;
    }
    println!("LIFTOFF!!!");
    
    // ===== FOR LOOP =====
    // Range (exclusive end)
    for i in 1..5 {
        println!("i = {}", i);  // 1, 2, 3, 4
    }
    
    // Range (inclusive end)
    for i in 1..=5 {
        println!("i = {}", i);  // 1, 2, 3, 4, 5
    }
    
    // Iterate over array
    let a = [10, 20, 30, 40, 50];
    for element in a.iter() {
        println!("element = {}", element);
    }
    
    // Reverse range
    for i in (1..4).rev() {
        println!("{}!", i);  // 3, 2, 1
    }
    println!("LIFTOFF!!!");
    
    // ===== LOOP LABELS =====
    // For nested loops
    'outer: loop {
        println!("Entered the outer loop");
        'inner: loop {
            println!("Entered the inner loop");
            break 'outer;  // Break outer loop
        }
        println!("This will never print");
    }
    println!("Exited the outer loop");
}
```

### Match Expressions

```rust
fn main() {
    let number = 3;
    
    // Basic match
    match number {
        1 => println!("one"),
        2 => println!("two"),
        3 => println!("three"),
        _ => println!("something else"),  // Wildcard (like default)
    }
    
    // Match with values
    let x = 5;
    match x {
        1 | 2 => println!("one or two"),  // Multiple patterns
        3..=5 => println!("three through five"),  // Range
        _ => println!("something else"),
    }
    
    // Match with destructuring
    let point = (0, 5);
    match point {
        (0, 0) => println!("origin"),
        (x, 0) => println!("on x-axis at {}", x),
        (0, y) => println!("on y-axis at {}", y),
        (x, y) => println!("at ({}, {})", x, y),
    }
    
    // Match as expression
    let grade = 'B';
    let description = match grade {
        'A' => "Excellent",
        'B' => "Good",
        'C' => "Average",
        'D' => "Below average",
        'F' => "Failing",
        _ => "Invalid grade",
    };
    println!("Grade {}: {}", grade, description);
    
    // Match with guards
    let num = 4;
    match num {
        n if n < 0 => println!("negative"),
        n if n == 0 => println!("zero"),
        n if n % 2 == 0 => println!("{} is positive and even", n),
        n => println!("{} is positive and odd", n),
    }
}
```

## 1.7 Ownership (Preview)

Ownership is Rust's most unique feature. We'll cover it in depth in Chapter 2.

```rust
fn main() {
    // Each value has an owner
    let s1 = String::from("hello");
    let s2 = s1;  // s1 is MOVED to s2
    
    // println!("{}", s1);  // ERROR! s1 is no longer valid
    
    // Clone for explicit deep copy
    let s3 = String::from("hello");
    let s4 = s3.clone();  // Deep copy
    println!("s3 = {}, s4 = {}", s3, s4);  // Both valid
    
    // References (borrowing)
    let s5 = String::from("hello");
    let len = calculate_length(&s5);  // Pass reference
    println!("'{}' has length {}", s5, len);  // s5 still valid
}

fn calculate_length(s: &String) -> usize {
    s.len()
}
```

## 1.8 Real-World Example: Simple Calculator

Let's build something practical:

```rust
use std::io;

fn main() {
    println!("Simple Calculator");
    println!("==================");
    
    // Get first number
    println!("Enter first number:");
    let mut input = String::new();
    io::stdin().read_line(&mut input).expect("Failed to read line");
    let num1: f64 = input.trim().parse().expect("Please enter a number");
    
    // Get operator
    println!("Enter operator (+, -, *, /):");
    let mut operator = String::new();
    io::stdin().read_line(&mut operator).expect("Failed to read line");
    let operator = operator.trim();
    
    // Get second number
    println!("Enter second number:");
    let mut input = String::new();
    io::stdin().read_line(&mut input).expect("Failed to read line");
    let num2: f64 = input.trim().parse().expect("Please enter a number");
    
    // Calculate result
    let result = match operator {
        "+" => num1 + num2,
        "-" => num1 - num2,
        "*" => num1 * num2,
        "/" => {
            if num2 == 0.0 {
                println!("Error: Division by zero!");
                return;
            }
            num1 / num2
        }
        _ => {
            println!("Error: Unknown operator {}", operator);
            return;
        }
    };
    
    println!("{} {} {} = {}", num1, operator, num2, result);
}
```

## 1.9 Exercises

<div class="quiz" data-answer="B" data-explanation="Rust variables are immutable by default for safety. You must use 'mut' to make them mutable.">
  <h4>Quiz 1: What is the default mutability?</h4>
  <div class="quiz-option" data-answer="A">
    <label>A) Mutable</label>
  </div>
  <div class="quiz-option" data-answer="B">
    <label>B) Immutable</label>
  </div>
  <div class="quiz-option" data-answer="C">
    <label>C) Constant</label>
  </div>
  <div class="quiz-option" data-answer="D">
    <label>D) Static</label>
  </div>
  <div class="quiz-feedback"></div>
</div>

<div class="quiz" data-answer="C" data-explanation="The ? operator propagates errors to the caller, making error handling concise and readable.">
  <h4>Quiz 2: What does ? do in error handling?</h4>
  <div class="quiz-option" data-answer="A">
    <label>A) Ignores errors</label>
  </div>
  <div class="quiz-option" data-answer="B">
    <label>B) Panics on error</label>
  </div>
  <div class="quiz-option" data-answer="C">
    <label>C) Propagates error to caller</label>
  </div>
  <div class="quiz-option" data-answer="D">
    <label>D) Returns default value</label>
  </div>
  <div class="quiz-feedback"></div>
</div>

### Exercise 1: Hello Name

```rust
// Create a program that asks for a name and prints a greeting
// Expected output: "Hello, [name]!"

fn main() {
    // Your code here
    // Hint: Use println! with format strings
}
```

<details>
<summary>Click to reveal solution</summary>

```rust
fn main() {
    let name = "Tupã";
    println!("Hello, {}!", name);
}
```
</details>

### Exercise 2: Simple Calculator

```rust
// Create functions for add, subtract, multiply, and divide
// The divide function should handle division by zero

fn add(a: i32, b: i32) -> i32 {
    // Your code here
}

fn subtract(a: i32, b: i32) -> i32 {
    // Your code here
}

fn multiply(a: i32, b: i32) -> i32 {
    // Your code here
}

fn divide(a: f64, b: f64) -> Option<f64> {
    // Your code here
    // Return None if b is 0
}

fn main() {
    println!("5 + 3 = {}", add(5, 3));
    println!("10 - 4 = {}", subtract(10, 4));
    println!("6 * 7 = {}", multiply(6, 7));
    println!("15 / 3 = {:?}", divide(15.0, 3.0));
    println!("10 / 0 = {:?}", divide(10.0, 0.0));
}
```

<details>
<summary>Click to reveal solution</summary>

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn subtract(a: i32, b: i32) -> i32 {
    a - b
}

fn multiply(a: i32, b: i32) -> i32 {
    a * b
}

fn divide(a: f64, b: f64) -> Option<f64> {
    if b == 0.0 {
        None
    } else {
        Some(a / b)
    }
}

fn main() {
    println!("5 + 3 = {}", add(5, 3));
    println!("10 - 4 = {}", subtract(10, 4));
    println!("6 * 7 = {}", multiply(6, 7));
    println!("15 / 3 = {:?}", divide(15.0, 3.0));
    println!("10 / 0 = {:?}", divide(10.0, 0.0));
}
```
</details>

### Exercise 3: Fibonacci

```rust
// Write a function that returns the nth Fibonacci number
// fibonacci(0) = 0
// fibonacci(1) = 1
// fibonacci(2) = 1
// fibonacci(3) = 2
// fibonacci(4) = 3
// fibonacci(5) = 5

fn fibonacci(n: u32) -> u64 {
    // Your code here
}

fn main() {
    for i in 0..=10 {
        println!("fibonacci({}) = {}", i, fibonacci(i));
    }
}
```

<details>
<summary>Click to reveal solution</summary>

```rust
fn fibonacci(n: u32) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => {
            let mut a = 0u64;
            let mut b = 1u64;
            for _ in 2..=n {
                let temp = a + b;
                a = b;
                b = temp;
            }
            b
        }
    }
}

fn main() {
    for i in 0..=10 {
        println!("fibonacci({}) = {}", i, fibonacci(i));
    }
}
```
</details>

## 1.10 Summary

In this chapter, you learned:

- ✅ How to set up a Rust development environment
- ✅ Variables and mutability (`let`, `mut`, `const`)
- ✅ Data types (integers, floats, booleans, characters, tuples, arrays)
- ✅ Functions and return values
- ✅ Control flow (`if`, `loop`, `while`, `for`, `match`)
- ✅ Basic ownership concepts (preview)

<div class="info-box">
  <strong>Next:</strong> <a href="/rust-firmware-wiki/chapters/02-ownership/">Chapter 2: Ownership</a> - Rust's most important feature. Understanding ownership is essential for firmware development.
</div>
