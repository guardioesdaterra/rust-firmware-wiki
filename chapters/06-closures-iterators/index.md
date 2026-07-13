---
layout: chapter
title: "Closures & Iterators"
chapter: 6
progress: 37
prev: /chapters/05-generics-traits/
next: /chapters/07-smart-pointers/
description: "Master closures and iterators for expressive, functional-style firmware code with zero-cost abstractions."
---

# Closures & Iterators

<div class="info-box">
<strong>Why this matters</strong>
<p>Closures and iterators let you express complex data transformations concisely. In firmware, you'll use them for processing sensor streams, filtering interrupt events, and building configuration pipelines. Rust's closures are zero-cost — they compile to the same machine code as hand-written loops.</p>
</div>

## Closures

Closures are anonymous functions that can capture variables from their environment.

```rust
fn main() {
    let x = 10;
    let add = |a| a + x;  // Captures x from environment
    println!("{}", add(5)); // 15
}
```

### Closure Syntax Variants

```rust
// Full type annotation
let add = |a: i32, b: i32| -> i32 { a + b };

// Type inference — compiler deduces types
let add = |a, b| a + b;

// Single expression — no braces needed
let double = |x| x * 2;

// No arguments
let greet = || println!("Hello!");
```

## Capturing Modes

Closures capture variables in three ways, determined automatically:

```rust
fn main() {
    let name = String::from("sensor");

    // 1. Borrow immutably (Fn)
    let greet = || println!("Hello, {}", name);
    greet();
    println!("Name still available: {}", name); // ✅

    // 2. Borrow mutably (FnMut)
    let mut count = 0;
    let mut increment = || {
        count += 1;
        println!("Count: {}", count);
    };
    increment(); // Count: 1
    increment(); // Count: 2
    // name is no longer borrowed here

    // 3. Move ownership (FnOnce)
    let data = vec![1, 2, 3];
    let consume = move || {
        println!("Consumed: {:?}", data);
        // data is moved into this closure
    };
    consume();
    // println!("{:?}", data); // ❌ data is moved
}
```

## Fn, FnMut, FnOnce Traits

These traits form a hierarchy:

```
FnOnce  ←  FnMut  ←  Fn
(can move)  (can mutate)  (can only read)
```

```rust
// Fn — immutable access, can be called multiple times
fn call_fn(f: impl Fn()) {
    f();
    f(); // ✅ Can call repeatedly
}

// FnMut — mutable access, can be called multiple times
fn call_fn_mut(mut f: impl FnMut()) {
    f();
    f(); // ✅ Can call repeatedly
}

// FnOnce — takes ownership, can only be called once
fn call_fn_once(f: impl FnOnce()) {
    f();
    // f(); // ❌ Cannot call again
}

fn main() {
    let msg = "hello";

    // Fn closure
    call_fn(|| println!("{}", msg));

    // FnMut closure
    let mut items = vec![];
    call_fn_mut(|| items.push(1));

    // FnOnce closure
    let data = vec![1, 2, 3];
    call_fn_once(move || println!("{:?}", data));
}
```

<div class="playground">
<strong>Interactive Playground</strong>
<pre><code>fn apply_and_print<F>(value: i32, op: F) -> i32
where
    F: Fn(i32) -> i32,
{
    let result = op(value);
    println!("{} → {}", value, result);
    result
}

fn main() {
    let doubled = apply_and_print(5, |x| x * 2);    // 5 → 10
    let squared = apply_and_print(4, |x| x * x);    // 4 → 16
    let add_ten = apply_and_print(7, |x| x + 10);   // 7 → 17
}
</code></pre>
</div>

## Iterator Trait

The `Iterator` trait requires one method:

```rust
trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
    // ... many provided methods
}
```

### Creating Iterators

```rust
// From a collection
let v = vec![1, 2, 3];
let iter = v.iter();          // &i32
let iter = v.into_iter();    // i32 (consumes vec)
let iter = v.iter_mut();     // &mut i32

// From ranges
let iter = 0..10;            // Exclusive end
let iter = 0..=10;           // Inclusive end

// From slices
let iter = [1, 2, 3].iter();
```

### Manual Iterator Implementation

```rust
struct Fibonacci {
    a: u64,
    b: u64,
}

impl Fibonacci {
    fn new() -> Self {
        Self { a: 0, b: 1 }
    }
}

impl Iterator for Fibonacci {
    type Item = u64;

    fn next(&mut self) -> Option<Self::Item> {
        let current = self.a;
        let next = self.a + self.b;
        self.a = self.b;
        self.b = next;
        Some(current) // Infinite iterator
    }
}

fn main() {
    let fibs: Vec<u64> = Fibonacci::new().take(10).collect();
    println!("{:?}", fibs); // [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
}
```

## Iterator Adapters

Adapters transform iterators lazily — nothing happens until consumed:

```rust
fn main() {
    let data = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // map — transform each element
    let doubled: Vec<_> = data.iter().map(|x| x * 2).collect();
    println!("Doubled: {:?}", doubled);

    // filter — keep elements matching predicate
    let evens: Vec<_> = data.iter().filter(|&&x| x % 2 == 0).collect();
    println!("Evens: {:?}", evens);

    // filter_map — filter + map in one step
    let parsed: Vec<i32> = ["1", "two", "3", "four"]
        .iter()
        .filter_map(|s| s.parse().ok())
        .collect();
    println!("Parsed: {:?}", parsed);

    // enumerate — add index
    for (i, val) in data.iter().enumerate() {
        println!("  [{}] = {}", i, val);
    }

    // take / skip
    let first_three: Vec<_> = data.iter().take(3).collect();
    let skip_three: Vec<_> = data.iter().skip(3).collect();
    println!("First 3: {:?}", first_three);
    println!("Skip 3: {:?}", skip_three);

    // zip — combine two iterators
    let names = vec!["temp", "press", "humid"];
    let values = vec![23.5, 1013.0, 65.0];
    let readings: Vec<_> = names.iter().zip(values.iter()).collect();
    println!("Readings: {:?}", readings);

    // chain — concatenate iterators
    let a = vec![1, 2];
    let b = vec![3, 4];
    let combined: Vec<_> = a.iter().chain(b.iter()).collect();
    println!("Chained: {:?}", combined);
}
```

## fold — The Universal Accumulator

```rust
fn main() {
    let nums = vec![1, 2, 3, 4, 5];

    // Sum
    let sum: i32 = nums.iter().fold(0, |acc, &x| acc + x);
    println!("Sum: {}", sum); // 15

    // Find maximum
    let max: &i32 = nums.iter().fold(&nums[0], |acc, &x| {
        if x > *acc { &x } else { acc }
    });
    println!("Max: {}", max);

    // Build a string
    let csv: String = nums.iter()
        .map(|x| x.to_string())
        .fold(String::new(), |acc, s| {
            if acc.is_empty() { s } else { format!("{},{}", acc, s) }
        });
    println!("CSV: {}", csv);
}
```

## collect — Flexible Collection

`collect` can build different types:

```rust
use std::collections::HashMap;

fn main() {
    let pairs = vec![("a", 1), ("b", 2), ("c", 3)];

    // Collect into HashMap
    let map: HashMap<_, _> = pairs.into_iter().collect();
    println!("{:?}", map);

    // Collect into Result — fails if any element errors
    let strings = vec!["1", "2", "three"];
    let parsed: Result<Vec<i32>, _> = strings.iter()
        .map(|s| s.parse::<i32>())
        .collect();
    println!("All parsed: {:?}", parsed); // Err(...)

    // Collect into Option — None if any is None
    let inputs = vec![Some(1), Some(2), None];
    let all: Option<Vec<_>> = inputs.into_iter().collect();
    println!("All present: {:?}", all); // None
}
```

## Functional Patterns for Firmware

```rust
// Process a stream of sensor readings
fn process_readings(raw: &[u16]) -> Vec<f64> {
    raw.iter()
        .enumerate()
        .filter(|(i, _)| i % 2 == 0)           // Every other reading
        .map(|(_, &val)| val as f64 * 0.0625)   // Convert to Celsius
        .filter(|&t| t > -40.0 && t < 125.0)    // Valid range
        .collect()
}

// Running average
fn running_average(data: &[f64], window: usize) -> Vec<f64> {
    data.windows(window)
        .map(|w| w.iter().sum::<f64>() / window as f64)
        .collect()
}

// Debounce a stream of bool values
fn debounce_stream(stream: &[bool], min_high: usize) -> Vec<bool> {
    let mut result = Vec::new();
    let mut count = 0;

    for &val in stream {
        if val {
            count += 1;
            if count >= min_high && result.last() != Some(&true) {
                result.push(true);
            }
        } else {
            count = 0;
            if result.last() == Some(&true) {
                result.push(false);
            }
        }
    }
    result
}
```

## Comparison: Bad vs Good

<div class="comparison">
<div class="bad">
<strong>❌ Bad — Manual loops for simple transformations</strong>
<pre><code>let mut results = Vec::new();
for i in 0..data.len() {
    if data[i].is_valid {
        let converted = data[i].value as f64 * 0.1;
        if converted > 0.0 {
            results.push(converted);
        }
    }
}</code></pre>
</div>

<div class="good">
<strong>✅ Good — Iterator chain</strong>
<pre><code>let results: Vec<f64> = data.iter()
    .filter(|d| d.is_valid)
    .map(|d| d.value as f64 * 0.1)
    .filter(|&v| v > 0.0)
    .collect();</code></pre>
</div>
</div>

<div class="comparison">
<div class="bad">
<strong>❌ Bad — Allocating intermediate collections</strong>
<pre><code>let doubled: Vec<_> = data.iter().map(|x| x * 2).collect();
let evens: Vec<_> = doubled.iter().filter(|x| x % 2 == 0).collect();
// Two allocations, one unnecessary</code></pre>
</div>

<div class="good">
<strong>✅ Good — Lazy chaining (zero intermediate allocations)</strong>
<pre><code>let evens: Vec<_> = data.iter()
    .map(|x| x * 2)
    .filter(|x| x % 2 == 0)
    .collect(); // Single allocation</code></pre>
</div>
</div>

## Collapsible: Advanced — Custom Iterator with Lifetime

<div class="collapsible">
<summary><strong>Advanced: Parsing Iterator</strong></summary>

```rust
struct PacketParser<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> PacketParser<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 0 }
    }
}

impl<'a> Iterator for PacketParser<'a> {
    type Item = &'a [u8];

    fn next(&mut self) -> Option<Self::Item> {
        if self.pos >= self.data.len() {
            return None;
        }

        let len = self.data[self.pos] as usize;
        self.pos += 1;

        if self.pos + len > self.data.len() {
            return None;
        }

        let packet = &self.data[self.pos..self.pos + len];
        self.pos += len;
        Some(packet)
    }
}
```
</div>

<div class="collapsible">
<summary><strong>Advanced: Performance — Zero-Cost Iterator Chains</strong></summary>

Rust's iterator chains are optimized to the same code as hand-written loops:

```rust
// This iterator chain:
let sum: i32 = (0..1000)
    .filter(|x| x % 2 == 0)
    .map(|x| x * x)
    .sum();

// Compiles to equivalent of:
let mut sum = 0;
for x in 0..1000 {
    if x % 2 == 0 {
        sum += x * x;
    }
}
```

The compiler inlines all closures and eliminates intermediate allocations. No heap allocation occurs — the iterator processes values on the stack.
</div>

## Quiz

<div class="quiz">
<strong>Quiz 1:</strong> What is the difference between <code>Fn</code>, <code>FnMut</code>, and <code>FnOnce</code>?
<div class="answer" data-answer="Fn borrows immutably; FnMut borrows mutably; FnOnce takes ownership and can only be called once">
<p><code>Fn</code> captures variables by immutable reference — can be called repeatedly. <code>FnMut</code> captures by mutable reference — can be called repeatedly but modifies captured state. <code>FnOnce</code> captures by move — consumes captured values and can only be called once.</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 2:</strong> Why are iterator adapters lazy?
<div class="answer" data-answer="They only process elements when consumed by a terminal operation like collect, fold, or sum">
<p>Lazy evaluation means no work is done until a consumer requests values. This avoids unnecessary computation and intermediate allocations. <code>map</code> and <code>filter</code> build a pipeline; <code>collect</code> or <code>fold</code> execute it.</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 3:</strong> When does a closure become <code>FnOnce</code> vs <code>FnMut</code>?
<div class="answer" data-answer="When it moves a captured value out of its scope, it becomes FnOnce; when it only mutates, it's FnMut">
<p>A closure is <code>FnOnce</code> if it moves a captured value out of its environment (e.g., passes it to a function that takes ownership). It's <code>FnMut</code> if it mutates captured variables. It's <code>Fn</code> if it only reads them.</p>
</div>
</div>

## Exercises

<div class="exercise">
<strong>Exercise 1:</strong> Write a closure that takes a <code>&str</code> and returns the number of vowels. Use it with a vector of words to create a vowel count map.

<details class="solution">
<summary>View Solution</summary>
<pre><code>use std::collections::HashMap;

fn main() {
    let count_vowels = |s: &str| -> usize {
        s.chars()
            .filter(|c| matches!(c, 'a' | 'e' | 'i' | 'o' | 'u' | 'A' | 'E' | 'I' | 'O' | 'U'))
            .count()
    };

    let words = vec!["hello", "world", "rust", "aeiou", "xyz"];
    let counts: HashMap<&str, usize> = words.iter()
        .map(|&w| (w, count_vowels(w)))
        .collect();

    println!("{:?}", counts);
    // {"hello": 2, "world": 1, "rust": 1, "aeiou": 5, "xyz": 0}
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 2:</strong> Implement a <code>Fibonacci</code> iterator that yields the first N Fibonacci numbers. Use it with <code>take</code> and <code>collect</code>.

<details class="solution">
<summary>View Solution</summary>
<pre><code>struct Fibonacci {
    a: u64,
    b: u64,
    count: usize,
    max: usize,
}

impl Fibonacci {
    fn new(max: usize) -> Self {
        Self { a: 0, b: 1, count: 0, max }
    }
}

impl Iterator for Fibonacci {
    type Item = u64;

    fn next(&mut self) -> Option<Self::Item> {
        if self.count >= self.max {
            return None;
        }
        let current = self.a;
        let next = self.a + self.b;
        self.a = self.b;
        self.b = next;
        self.count += 1;
        Some(current)
    }
}

fn main() {
    let fibs: Vec<u64> = Fibonacci::new(15).collect();
    println!("{:?}", fibs);
    // [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377]
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 3:</strong> Given a vector of <code>(u8, f64)</code> sensor readings <code>(channel, value)</code>, use iterators to compute the average value per channel.

<details class="solution">
<summary>View Solution</summary>
<pre><code>use std::collections::HashMap;

fn main() {
    let readings = vec![
        (0, 23.5), (1, 65.0), (0, 24.1),
        (1, 63.8), (0, 22.9), (1, 66.2),
    ];

    let mut sums: HashMap<u8, f64> = HashMap::new();
    let mut counts: HashMap<u8, usize> = HashMap::new();

    for (ch, val) in &readings {
        *sums.entry(*ch).or_insert(0.0) += val;
        *counts.entry(*ch).or_insert(0) += 1;
    }

    let averages: HashMap<u8, f64> = sums.iter()
        .map(|(&ch, &sum)| {
            let avg = sum / counts[&ch] as f64;
            (ch, (avg * 100.0).round() / 100.0)
        })
        .collect();

    println!("{:?}", averages);
    // {0: 23.5, 1: 65.0}
}
</code></pre>
</details>
</div>

## Summary

- **Closures** capture environment variables — `Fn`, `FnMut`, `FnOnce` indicate capture mode.
- **`move` closures** take ownership of captured variables.
- **Iterators** implement the `Iterator` trait with `next()` returning `Option<Item>`.
- **Adapters** (`map`, `filter`, `enumerate`, `zip`) transform iterators lazily.
- **Consumers** (`collect`, `fold`, `sum`, `count`) execute the iterator chain.
- Iterator chains are **zero-cost** — they compile to efficient loops with no allocations.
- **Custom iterators** implement `Iterator` for your own types.
- Prefer iterator chains over manual loops for clarity and performance.

---

<div class="navigation">
<a href="/chapters/05-generics-traits/">← Previous: Generics & Traits</a>
<a href="/chapters/07-smart-pointers/">Next: Smart Pointers →</a>
</div>
