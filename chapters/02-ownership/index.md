---
layout: chapter
title: "Ownership"
chapter: 2
progress: 12
prev: "/chapters/01-rust-basics/"
next: "/chapters/03-structs-enums/"
description: "Master Rust's most important feature - ownership, borrowing, and lifetimes"
---

## Why Ownership Matters

<div class="info-box warning">
  <strong>Critical for Firmware:</strong> Ownership is what makes Rust safe for firmware. It prevents memory bugs at compile time without runtime overhead. This is THE feature that makes Rust perfect for Caliptra and OpenPRoT.
</div>

Ownership solves these problems:
- **Use-after-free**: Accessing memory after it's freed
- **Double-free**: Freeing the same memory twice
- **Data races**: Multiple threads accessing the same data
- **Memory leaks**: Forgetting to free memory

## 2.1 The Three Rules of Ownership

Every value in Rust has exactly one **owner**. When the owner goes out of scope, the value is **dropped** (freed).

```rust
fn main() {
    // Rule 1: Each value has exactly one owner
    let s1 = String::from("hello");  // s1 is the owner
    
    // Rule 2: When the owner goes out of scope, value is dropped
    {
        let s2 = String::from("world");  // s2 is the owner
        println!("s2 = {}", s2);
    }  // s2 goes out of scope here, "world" is dropped
    
    // Rule 3: Ownership can be transferred (moved)
    let s3 = String::from("hello");
    let s4 = s3;  // s3 is MOVED to s4
    // println!("{}", s3);  // ERROR! s3 is no longer valid
    println!("s4 = {}", s4);  // s4 is now the owner
}
```

### Visualizing Ownership

```
// Before move:
// s1: ["hello"] → Stack
//       ↓
//      Heap: [hello]

// After move (let s2 = s1):
// s1: [invalid]  ← No longer valid!
// s2: ["hello"] → Stack
//       ↓
//      Heap: [hello]
```

## 2.2 Move Semantics

When you assign a value to another variable, ownership is **moved**:

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;  // s1 is moved to s2
    
    // println!("{}", s1);  // ERROR: value borrowed after move
    
    // Functions also move ownership
    let s3 = String::from("hello");
    takes_ownership(s3);  // s3 is moved into the function
    
    // Return values transfer ownership
    let s4 = gives_ownership();  // s4 gets ownership from function
    println!("s4 = {}", s4);
    
    // Take and return ownership
    let s5 = String::from("hello");
    let s6 = takes_and_gives_back(s5);  // s5 moved, s6 returned
    println!("s6 = {}", s6);
}

fn takes_ownership(s: String) {
    println!("I have: {}", s);
}  // s is dropped here

fn gives_ownership() -> String {
    let s = String::from("hello");
    s  // Return ownership to caller
}

fn takes_and_gives_back(s: String) -> String {
    s  // Return ownership to caller
}
```

### Why Move?

<div class="info-box">
  <strong>Prevents Double-Free:</strong> If both s1 and s2 owned the same heap data, when both go out of scope, the same memory would be freed twice. Moving prevents this by ensuring only one owner at a time.
</div>

## 2.3 Borrowing and References

Borrowing lets you use a value **without taking ownership**. Think of it like lending a book - you can read it, but you don't own it.

### Immutable References

```rust
fn main() {
    let s1 = String::from("hello");
    let len = calculate_length(&s1);  // Borrow s1
    println!("'{}' has length {}", s1, len);  // s1 still valid!
    
    // Multiple immutable references allowed
    let r1 = &s1;
    let r2 = &s1;
    println!("r1 = {}, r2 = {}", r1, r2);
}

fn calculate_length(s: &String) -> usize {
    s.len()
}  // s goes out of scope, but since it doesn't own the value, nothing happens
```

### Mutable References

```rust
fn main() {
    let mut s = String::from("hello");
    change(&mut s);  // Mutable borrow
    println!("s = {}", s);
}

fn change(s: &mut String) {
    s.push_str(", world");
}
```

## 2.4 Borrowing Rules

<div class="info-box error">
  <strong>Important:</strong> Violating these rules causes compile errors. This is how Rust prevents data races at compile time.
</div>

### Rule 1: Only ONE Mutable Reference at a Time

```rust
fn main() {
    let mut s = String::from("hello");
    
    let r1 = &mut s;
    // let r2 = &mut s;  // ERROR! Two mutable references
    
    println!("{}", r1);
}
```

### Rule 2: No Mutable + Immutable References Together

```rust
fn main() {
    let mut s = String::from("hello");
    
    let r1 = &s;      // Immutable reference
    let r2 = &s;      // Another immutable reference - OK!
    // let r3 = &mut s;  // ERROR! Mutable with immutable
    
    println!("r1 = {}, r2 = {}", r1, r2);
    // r1 and r2 go out of scope here
    
    // Now we can create mutable reference
    let r3 = &mut s;  // OK! No immutable references alive
    println!("{}", r3);
}
```

### Rule 3: References Must Always Be Valid

```rust
fn main() {
    let reference_to_nothing = dangle();
}

fn dangle() -> &String {  // ERROR! Returns reference to nothing
    let s = String::from("hello");
    &s  // Returns reference to local variable
}  // s is dropped here, reference is invalid!

// Fix: Return ownership instead
fn no_dangle() -> String {
    let s = String::from("hello");
    s  // Return ownership to caller
}
```

## 2.5 Lifetimes

Lifetimes ensure references are always valid. They're like scopes for references.

### Basic Lifetimes

```rust
// Lifetime annotation syntax: 'a (read as "lifetime a")
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    let string1 = String::from("long string");
    let result;
    {
        let string2 = String::from("xyz");
        result = longest(string1.as_str(), string2.as_str());
        println!("Longest: {}", result);
    }
    // If we tried to use result here, it would error
    // because string2 is dropped
}
```

### Lifetime Elision

Rust has rules that reduce the need for explicit lifetime annotations:

```rust
// These two are equivalent:
fn first_word(s: &str) -> &str { ... }  // Elided
fn first_word<'a>(s: &'a str) -> &'a str { ... }  // Explicit

// Elision rules:
// 1. Each reference parameter gets its own lifetime
// 2. If there's one input lifetime, it's assigned to all outputs
// 3. If there's &self or &mut self, its lifetime is assigned to outputs
```

### Structs with Lifetimes

```rust
// Struct that holds references must have lifetime annotations
struct ImportantExcerpt<'a> {
    part: &'a str,
}

impl<'a> ImportantExcerpt<'a> {
    fn level(&self) -> i32 {
        3
    }
    
    fn announce_and_return_part(&self, announcement: &str) -> &str {
        println!("Attention: {}", announcement);
        self.part
    }
}

fn main() {
    let novel = String::from("Call me Ishmael. Some years ago...");
    let first_sentence;
    {
        let i = novel.split('.').next().expect("Could not find a '.'");
        first_sentence = ImportantExcerpt { part: i };
    }
    println!("First sentence: {}", first_sentence.part);
}
```

## 2.6 The Slice Type

Slices let you reference a contiguous sequence of elements:

```rust
fn main() {
    let s = String::from("hello world");
    
    // String slice
    let hello = &s[0..5];
    let world = &s[6..11];
    println!("{} {}", hello, world);
    
    // Syntactic sugar
    let hello = &s[..5];   // From start
    let world = &s[6..];   // To end
    let whole = &s[..];    // Entire string
    
    // Array slices
    let a = [1, 2, 3, 4, 5];
    let slice = &a[1..3];  // [2, 3]
    println!("slice = {:?}", slice);
}

// Function that works with slices
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    
    for (i, &byte) in bytes.iter().enumerate() {
        if byte == b' ' {
            return &s[0..i];
        }
    }
    
    s
}
```

## 2.7 Real-World Example: String Processing

```rust
fn main() {
    let text = String::from("Hello, World! This is Rust.");
    
    // Get word count without taking ownership
    let count = count_words(&text);
    println!("Word count: {}", count);
    
    // Get longest word without taking ownership
    if let Some(word) = longest_word(&text) {
        println!("Longest word: {}", word);
    }
    
    // Text is still valid here!
    println!("Original: {}", text);
}

fn count_words(text: &str) -> usize {
    text.split_whitespace().count()
}

fn longest_word(text: &str) -> Option<&str> {
    text.split_whitespace()
        .max_by_key(|word| word.len())
}

// Function that modifies without taking ownership
fn remove_punctuation(text: &mut String) {
    text.retain(|c| !c.is_ascii_punctuation());
}

// Function that takes ownership and returns it
fn process_text(mut text: String) -> String {
    text.push_str(" [processed]");
    text
}

fn main() {
    // Original string
    let mut text = String::from("Hello, World!");
    
    // Borrow to count words
    let count = count_words(&text);
    println!("Words: {}", count);
    
    // Mutable borrow to modify
    remove_punctuation(&mut text);
    println!("Without punctuation: {}", text);
    
    // Take ownership, process, return
    let processed = process_text(text);
    // text is no longer valid here
    println!("Processed: {}", processed);
}
```

## 2.8 Ownership in Practice

### Example 1: Vector Processing

```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    
    // Borrow to calculate sum
    let sum = sum_vec(&numbers);
    println!("Sum: {}", sum);
    
    // Borrow to find max
    if let Some(max) = max_vec(&numbers) {
        println!("Max: {}", max);
    }
    
    // Numbers still valid!
    println!("Original: {:?}", numbers);
}

fn sum_vec(v: &[i32]) -> i32 {
    v.iter().sum()
}

fn max_vec(v: &[i32]) -> Option<&i32> {
    v.iter().max()
}
```

### Example 2: User Input Processing

```rust
use std::io;

fn main() {
    let mut input = String::new();
    
    println!("Enter a sentence:");
    io::stdin()
        .read_line(&mut input)
        .expect("Failed to read line");
    
    let input = input.trim();  // Remove newline
    
    // Process without taking ownership
    let word_count = count_words(input);
    let char_count = count_chars(input);
    let has_palindrome = contains_palindrome(input);
    
    println!("Words: {}", word_count);
    println!("Characters: {}", char_count);
    println!("Contains palindrome: {}", has_palindrome);
}

fn count_words(s: &str) -> usize {
    s.split_whitespace().count()
}

fn count_chars(s: &str) -> usize {
    s.chars().count()
}

fn contains_palindrome(s: &str) -> bool {
    s.split_whitespace()
        .any(|word| {
            let chars: Vec<char> = word.chars().collect();
            chars == chars.iter().rev().cloned().collect::<Vec<char>>()
        })
}
```

## 2.9 Common Ownership Patterns

<div class="collapsible">
  <div class="collapsible-header">Pattern 1: Clone When Needed</div>
  <div class="collapsible-body">
    <pre><code>// If you need multiple owners, clone the data
let s1 = String::from("hello");
let s2 = s1.clone();  // Deep copy
println!("s1 = {}, s2 = {}", s1, s2);  // Both valid</code></pre>
  </div>
</div>

<div class="collapsible">
  <div class="collapsible-header">Pattern 2: Return Ownership</div>
  <div class="collapsible-body">
    <pre><code>// If you need to use a value after a function call,
// return it from the function
fn process(mut data: Vec&lt;i32&gt;) -> Vec&lt;i32&gt; {
    // Process data
    data.push(42);
    data  // Return ownership
}

let vec = vec![1, 2, 3];
let vec = process(vec);  // Get ownership back
println!("{:?}", vec);</code></pre>
  </div>
</div>

<div class="collapsible">
  <div class="collapsible-header">Pattern 3: Use References</div>
  <div class="collapsible-body">
    <pre><code>// If you just need to read data, use references
fn print_vec(v: &Vec&lt;i32&gt;) {
    for i in v {
        println!("{}", i);
    }
}

let vec = vec![1, 2, 3];
print_vec(&vec);  // Borrow
println!("{:?}", vec);  // Still valid!</code></pre>
  </div>
</div>

## 2.10 Exercises

<div class="quiz" data-answer="B" data-explanation="When you move a value, the original variable is no longer valid. This prevents double-free bugs.">
  <h4>Quiz 1: What happens when you move a value?</h4>
  <div class="quiz-option" data-answer="A">
    <label>A) Original variable is still valid</label>
  </div>
  <div class="quiz-option" data-answer="B">
    <label>B) Original variable is no longer valid</label>
  </div>
  <div class="quiz-option" data-answer="C">
    <label>C) Value is copied</label>
  </div>
  <div class="quiz-option" data-answer="D">
    <label>D) Value is dropped</label>
  </div>
  <div class="quiz-feedback"></div>
</div>

<div class="quiz" data-answer="C" data-explanation="Only one mutable reference is allowed at a time. This prevents data races at compile time.">
  <h4>Quiz 2: How many mutable references can exist at once?</h4>
  <div class="quiz-option" data-answer="A">
    <label>A) Unlimited</label>
  </div>
  <div class="quiz-option" data-answer="B">
    <label>B) Two</label>
  </div>
  <div class="quiz-option" data-answer="C">
    <label>C) One</label>
  </div>
  <div class="quiz-option" data-answer="D">
    <label>D) Zero</label>
  </div>
  <div class="quiz-feedback"></div>
</div>

### Exercise 1: Fix the Ownership Errors

```rust
// Fix the ownership errors in this code

fn main() {
    let s1 = String::from("hello");
    let s2 = s1;
    println!("s1 = {}, s2 = {}", s1, s2);  // Fix this
}

fn take_and_return(s: String) -> String {
    s
}

fn main() {
    let s = String::from("hello");
    let s2 = take_and_return(s);
    println!("s = {}", s);  // Fix this
}
```

<details>
<summary>Click to reveal solution</summary>

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1.clone();  // Clone instead of move
    println!("s1 = {}, s2 = {}", s1, s2);
}

fn take_and_return(s: String) -> String {
    s
}

fn main() {
    let s = String::from("hello");
    let s2 = take_and_return(s);
    // s is moved, so we can't use it here
    println!("s2 = {}", s2);
}
```
</details>

### Exercise 2: Longest Word

```rust
// Write a function that returns the longest word in a string
// Use references to avoid taking ownership

fn longest_word(s: &str) -> Option<&str> {
    // Your code here
}

fn main() {
    let text = String::from("The quick brown fox jumps");
    match longest_word(&text) {
        Some(word) => println!("Longest: {}", word),
        None => println!("No words found"),
    }
    println!("Original: {}", text);  // Should still work!
}
```

<details>
<summary>Click to reveal solution</summary>

```rust
fn longest_word(s: &str) -> Option<&str> {
    s.split_whitespace()
        .max_by_key(|word| word.len())
}

fn main() {
    let text = String::from("The quick brown fox jumps");
    match longest_word(&text) {
        Some(word) => println!("Longest: {}", word),
        None => println!("No words found"),
    }
    println!("Original: {}", text);
}
```
</details>

### Exercise 3: Word Frequency

```rust
// Write a function that counts word frequency
// Return a reference to the original string's words

fn word_frequency(s: &str) -> Vec<(&str, usize)> {
    // Your code here
    // Hint: Use a HashMap orVec of tuples
}

fn main() {
    let text = "hello world hello rust hello";
    let freq = word_frequency(text);
    for (word, count) in freq {
        println!("{}: {}", word, count);
    }
}
```

<details>
<summary>Click to reveal solution</summary>

```rust
use std::collections::HashMap;

fn word_frequency(s: &str) -> Vec<(&str, usize)> {
    let mut map = HashMap::new();
    for word in s.split_whitespace() {
        *map.entry(word).or_insert(0) += 1;
    }
    map.into_iter().collect()
}

fn main() {
    let text = "hello world hello rust hello";
    let freq = word_frequency(text);
    for (word, count) in freq {
        println!("{}: {}", word, count);
    }
}
```
</details>

## 2.11 Summary

In this chapter, you learned:

- ✅ The three rules of ownership
- ✅ Move semantics
- ✅ Borrowing (immutable and mutable references)
- ✅ Borrowing rules (1 mutable OR many immutable)
- ✅ Lifetimes and lifetime elision
- ✅ Slices
- ✅ Common ownership patterns

<div class="info-box">
  <strong>Next:</strong> <a href="/rust-firmware-wiki/chapters/03-structs-enums/">Chapter 3: Structs & Enums</a> - Learn how to create custom types and use pattern matching.
</div>
