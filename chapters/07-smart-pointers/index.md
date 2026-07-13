---
layout: chapter
title: "Smart Pointers"
chapter: 7
progress: 44
prev: /chapters/06-closures-iterators/
next: /chapters/08-concurrency/
description: "Understand Rust's smart pointers: Box, Rc, RefCell, and Arc — heap allocation, shared ownership, and interior mutability for firmware."
---

# Smart Pointers

<div class="info-box">
<strong>Why this matters</strong>
<p>Smart pointers manage heap memory and enable patterns impossible with stack variables alone. In firmware, <code>Box</code> allocates dynamic buffers, <code>Rc</code> shares driver instances between modules, and <code>RefCell</code> enables interior mutability for configuration that changes at runtime. Understanding these types is critical for designing flexible embedded architectures.</p>
</div>

## What Are Smart Pointers?

Smart pointers are structs that act like pointers but add behavior:

| Smart Pointer | Purpose | Firmware Use |
|--------------|---------|-------------|
| `Box<T>` | Heap allocation, single owner | Dynamic buffers, trait objects |
| `Rc<T>` | Reference-counted shared ownership | Shared driver instances |
| `Arc<T>` | Atomic reference counting | Thread-safe shared state |
| `RefCell<T>` | Interior mutability (borrow checking at runtime) | Runtime configuration |
| `Cell<T>` | Copy-based interior mutability | Small config values |
| `Cow<T>` | Clone-on-write | Read-mostly data |

## Box\<T\>

`Box<T>` allocates data on the heap and owns it exclusively:

```rust
fn main() {
    // Heap-allocated integer
    let b = Box::new(5);
    println!("b = {}", b);

    // Deref to use like the inner type
    assert_eq!(*b, 5);

    // Box is dropped and memory freed when it goes out of scope
}
```

### When to Use Box

```rust
// 1. Recursive types (infinite size on stack without Box)
enum List {
    Node(i32, Box<List>),
    Nil,
}

// 2. Large data to avoid stack overflow
fn process_large_buffer() {
    let huge = Box::new([0u8; 65536]); // 64KB on heap
    // Process huge buffer...
}

// 3. Trait objects for dynamic dispatch
trait Sensor {
    fn read(&self) -> f64;
}

fn create_sensors() -> Vec<Box<dyn Sensor>> {
    vec![
        Box::new(TemperatureSensor),
        Box::new(PressureSensor),
    ]
}
```

### Box with Enums

```rust
#[derive(Debug)]
enum Command {
    Write { addr: u16, data: Vec<u8> },
    Read { addr: u16, len: u16 },
    Delay(u32),
    Reset,
}

fn build_sequence() -> Vec<Command> {
    vec![
        Command::Reset,
        Command::Delay(100),
        Command::Write { addr: 0x1000, data: vec![0xAA, 0xBB] },
        Command::Read { addr: 0x2000, len: 4 },
    ]
}
```

<div class="playground">
<strong>Interactive Playground</strong>
<pre><code>fn main() {
    let boxed = Box::new(String::from("heap string"));
    println!("Length: {}", boxed.len());
    println!("Content: {}", *boxed);

    // Box enables recursive types
    #[derive(Debug)]
    enum Tree {
        Leaf(i32),
        Branch(Box<Tree>, Box<Tree>),
    }

    let tree = Tree::Branch(
        Box::new(Tree::Leaf(1)),
        Box::new(Tree::Branch(
            Box::new(Tree::Leaf(2)),
            Box::new(Tree::Leaf(3)),
        )),
    );
    println!("{:#?}", tree);
}
</code></pre>
</div>

## Deref Trait

Smart pointers implement `Deref` to behave like their inner type:

```rust
use std::ops::Deref;

struct MyBox<T>(T);

impl<T> MyBox<T> {
    fn new(x: T) -> MyBox<T> {
        MyBox(x)
    }
}

impl<T> Deref for MyBox<T> {
    type Target = T;

    fn deref(&self) -> &T {
        &self.0
    }
}

fn hello(name: &str) {
    println!("Hello, {}!", name);
}

fn main() {
    let name = MyBox::new(String::from("Rust"));

    // Deref coercion: &MyBox<String> → &String → &str
    hello(&name);
}
```

### Deref Coercion Rules

| From | To | Rule |
|------|----|------|
| `&T` | `&U` | `T: Deref<Target=U>` |
| `&mut T` | `&mut U` | `T: DerefMut<Target=U>` |
| `&mut T` | `&U` | `T: Deref<Target=U>` |

This means `&Box<String>` automatically coerces to `&String`, then to `&str`.

## Drop Trait

`Drop` provides cleanup when a value goes out of scope:

```rust
struct Connection {
    id: u32,
    buffer: Vec<u8>,
}

impl Drop for Connection {
    fn drop(&mut self) {
        println!("Closing connection {} ({} bytes in buffer)", self.id, self.buffer.len());
        // Cleanup resources here
    }
}

fn main() {
    let conn = Connection { id: 1, buffer: vec![0; 1024] };
    println!("Using connection {}", conn.id);
    // conn dropped here → Drop::drop called
}
```

### Manual Drop

```rust
use std::mem;

fn main() {
    let conn = Connection { id: 1, buffer: vec![0; 1024] };

    // Early drop — don't wait for scope end
    mem::drop(conn);
    println!("Connection already closed");

    // ❌ Can't use conn here
}
```

## Rc\<T\> — Reference Counting

`Rc<T>` enables multiple owners of the same heap data:

```rust
use std::rc::Rc;

fn main() {
    let shared = Rc::new(vec![1, 2, 3]);
    println!("Count after creation: {}", Rc::strong_count(&shared)); // 1

    let owner1 = Rc::clone(&shared);
    println!("Count after clone: {}", Rc::strong_count(&shared)); // 2

    let owner2 = Rc::clone(&shared);
    println!("Count after second clone: {}", Rc::strong_count(&shared)); // 3

    drop(owner2);
    println!("Count after drop: {}", Rc::strong_count(&shared)); // 2

    // All owners see the same data
    println!("owner1: {:?}", owner1);
    println!("owner2 dropped, shared: {:?}", shared);
}
```

### Rc with Shared Driver State

```rust
use std::rc::Rc;

struct SharedBus {
    transactions: u32,
}

impl SharedBus {
    fn new() -> Rc<Self> {
        Rc::new(Self { transactions: 0 })
    }

    fn transfer(&self) -> bool {
        true // Simplified
    }
}

fn main() {
    let bus = SharedBus::new();

    let sensor_driver = Rc::clone(&bus);
    let display_driver = Rc::clone(&bus);

    // Both drivers share the same bus
    sensor_driver.transfer();
    display_driver.transfer();
}
```

<div class="warning">
<strong>⚠ Rc is NOT thread-safe</strong>
<p><code>Rc</code> uses non-atomic reference counting. For multi-threaded code, use <code>Arc</code> (Atomic Reference Counting) instead.</p>
</div>

## RefCell\<T\> — Interior Mutability

`RefCell<T>` moves borrow checking to runtime, enabling mutation through shared references:

```rust
use std::cell::RefCell;

fn main() {
    let data = RefCell::new(vec![1, 2, 3]);

    // Borrow immutably — returns Ref<T>
    {
        let borrowed = data.borrow();
        println!("Data: {:?}", *borrowed);
    } // Ref dropped here

    // Borrow mutably — returns RefMut<T>
    {
        let mut borrowed = data.borrow_mut();
        borrowed.push(4);
    } // RefMut dropped here

    println!("After mutation: {:?}", data.borrow());
}
```

### RefCell with Shared Configuration

```rust
use std::cell::RefCell;

struct Config {
    data: RefCell<Vec<u8>>,
    settings: RefCell<u32>,
}

impl Config {
    fn new() -> Self {
        Self {
            data: RefCell::new(Vec::new()),
            settings: RefCell::new(0),
        }
    }

    fn push_byte(&self, b: u8) {
        // Can mutate through &self!
        self.data.borrow_mut().push(b);
    }

    fn update_setting(&self, val: u32) {
        *self.settings.borrow_mut() = val;
    }

    fn summary(&self) -> String {
        format!(
            "Config: {} bytes, setting={}",
            self.data.borrow().len(),
            *self.settings.borrow()
        )
    }
}
```

### Runtime Panics on Violation

```rust
let data = RefCell::new(vec![1, 2, 3]);

let borrow1 = data.borrow();
// let borrow2 = data.borrow_mut(); // ❌ PANICS! Already borrowed
// This would panic: "already borrowed: BorrowMutError"
```

<div class="comparison">
<div class="bad">
<strong>❌ Bad — RefCell panic at runtime</strong>
<pre><code>let data = RefCell::new(vec![]);
let b1 = data.borrow();
let b2 = data.borrow_mut(); // PANIC!</code></pre>
</div>

<div class="good">
<strong>✅ Good — Use Mutex for concurrent access</strong>
<pre><code>use std::sync::Mutex;
let data = Mutex::new(vec![]);
let mut b1 = data.lock().unwrap();
// Another thread trying to lock would block, not panic</code></pre>
</div>
</div>

## Cell\<T\>

`Cell<T>` provides interior mutability for `Copy` types without borrowing:

```rust
use std::cell::Cell;

struct Counter {
    value: Cell<u32>,
}

impl Counter {
    fn increment(&self) {
        self.value.set(self.value.get() + 1);
    }

    fn get(&self) -> u32 {
        self.value.get()
    }
}

fn main() {
    let counter = Counter { value: Cell::new(0) };
    counter.increment();
    counter.increment();
    println!("Count: {}", counter.get()); // 2
}
```

| Feature | Cell | RefCell |
|---------|------|---------|
| Works with | `Copy` types only | Any type |
| Mechanism | Copy in/out | Borrow tracking |
| Overhead | Minimal | Runtime borrow checks |
| Panics | Never | On borrow violations |

## Weak References

`Weak<T>` prevents reference cycles that cause memory leaks:

```rust
use std::rc::{Rc, Weak};
use std::cell::RefCell;

struct Node {
    value: i32,
    parent: RefCell<Weak<Node>>,
    children: RefCell<Vec<Rc<Node>>>,
}

fn main() {
    let leaf = Rc::new(Node {
        value: 3,
        parent: RefCell::new(Weak::new()),
        children: RefCell::new(vec![]),
    });

    let branch = Rc::new(Node {
        value: 5,
        parent: RefCell::new(Weak::new()),
        children: RefCell::new(vec![Rc::clone(&leaf)]),
    });

    // Set leaf's parent to branch (weak reference)
    *leaf.parent.borrow_mut() = Rc::downgrade(&branch);

    // Access parent through weak reference
    if let Some(parent) = leaf.parent.borrow().upgrade() {
        println!("Leaf's parent value: {}", parent.value);
    }

    // Drop the branch
    drop(branch);
    // Leaf's parent is now None — no memory leak!
    println!(
        "Parent exists: {}",
        leaf.parent.borrow().upgrade().is_some()
    ); // false
}
```

<div class="playground">
<strong>Interactive Playground</strong>
<pre><code>use std::rc::Rc;
use std::rc::Weak;

fn main() {
    let strong = Rc::new(String::from("shared data"));
    println!("Strong count: {}", Rc::strong_count(&strong));

    let weak = Rc::downgrade(&strong);
    println!("Weak count: {}", Weak::weak_count(&weak));

    // Access through Weak
    if let Some(data) = weak.upgrade() {
        println!("Accessed: {}", data);
    }

    // Drop the strong reference
    drop(strong);

    // Weak no longer valid
    match weak.upgrade() {
        Some(data) => println!("Still alive: {}", data),
        None => println!("Data has been dropped"),
    }
}
</code></pre>
</div>

## Cow\<T\> — Clone on Write

`Cow<T>` avoids unnecessary cloning:

```rust
use std::borrow::Cow;

fn process_name(name: &str) -> Cow<str> {
    if name.contains(' ') {
        // Needs modification — allocate new String
        Cow::Owned(name.replace(' ', "_"))
    } else {
        // No modification — borrow the original
        Cow::Borrowed(name)
    }
}

fn main() {
    let name1 = "Alice";
    let name2 = "Bob Smith";

    let result1 = process_name(name1); // Borrows — zero allocation
    let result2 = process_name(name2); // Allocates new String

    println!("result1: {} (allocated: {})", result1, matches!(result1, Cow::Owned(_)));
    println!("result2: {} (allocated: {})", result2, matches!(result2, Cow::Owned(_)));
}
```

## Arc\<T\> — Atomic Reference Counting

`Arc<T>` is the thread-safe version of `Rc<T>`:

```rust
use std::sync::Arc;
use std::thread;

fn main() {
    let counter = Arc::new(vec![1, 2, 3]);

    let mut handles = vec![];

    for i in 0..3 {
        let data = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            println!("Thread {}: {:?}", i, data);
        }));
    }

    for handle in handles {
        handle.join().unwrap();
    }
}
```

| Type | Thread-safe | Atomic | Use case |
|------|-------------|--------|----------|
| `Rc<T>` | ❌ | No | Single-thread shared ownership |
| `Arc<T>` | ✅ | Yes | Multi-thread shared ownership |

## Memory Management Visualization

```
Stack                          Heap
┌─────────────────┐    ┌──────────────────┐
│ Box<T>           │───▶│ T (data)         │
│ ptr ─────────────┼───▶│                  │
│ (owned)          │    │ (freed on drop)  │
└─────────────────┘    └──────────────────┘

Rc<T> (shared ownership)
┌─────────────────┐    ┌──────────────────┐
│ Rc<T>            │───▶│ strong: 3        │
│ ptr ─────────────┼───▶│ weak: 0          │
│                  │    │ T (data)         │
└─────────────────┘    └──────────────────┘
                             ▲     ▲
┌─────────────────┐          │     │
│ Rc::clone()     │──────────┘     │
│ (increments)    │────────────────┘

RefCell<T> (interior mutability)
┌─────────────────┐
│ RefCell<T>       │
│ borrow_flag: 0   │  0 = not borrowed
│ T (data)         │  positive = borrowed
└─────────────────┘  negative = mutably borrowed
```

## Comparison: Bad vs Good

<div class="comparison">
<div class="bad">
<strong>❌ Bad — Reference cycle with Rc</strong>
<pre><code>use std::rc::Rc;
use std::cell::RefCell;

struct Node {
    next: Option<Rc<RefCell<Node>>>,
}

// Creates a cycle: A → B → A
let a = Rc::new(RefCell::new(Node { next: None }));
let b = Rc::new(RefCell::new(Node { next: Some(Rc::clone(&a)) }));
*a.borrow_mut().next = Some(Rc::clone(&b));
// Memory leak! Neither can be freed.</code></pre>
</div>

<div class="good">
<strong>✅ Good — Break cycle with Weak</strong>
<pre><code>use std::rc::{Rc, Weak};
use std::cell::RefCell;

struct Node {
    next: Option<Rc<RefCell<Node>>>,
    prev: Option<Weak<RefCell<Node>>>,  // Weak breaks the cycle
}

let a = Rc::new(RefCell::new(Node { next: None, prev: None }));
let b = Rc::new(RefCell::new(Node {
    next: Some(Rc::clone(&a)),
    prev: Some(Rc::downgrade(&a)),
}));
// No memory leak!</code></pre>
</div>
</div>

## Quiz

<div class="quiz">
<strong>Quiz 1:</strong> When should you use <code>Box&lt;T&gt;</code> vs <code>Rc&lt;T&gt;</code>?
<div class="answer" data-answer="Box for single ownership; Rc when multiple owners need shared access to the same data">
<p><code>Box</code> gives exclusive ownership — one owner, freed when dropped. <code>Rc</code> enables multiple owners via reference counting — the data is freed when the last Rc is dropped.</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 2:</strong> Why does <code>RefCell</code> panic at runtime instead of compile time?
<div class="answer" data-answer="Because borrow checking is done at runtime, not compile time — this enables interior mutability but trades compile-time safety for flexibility">
<p><code>RefCell</code> defers borrow checking to runtime. This allows you to borrow mutably through a shared reference, but violations are caught at runtime with a panic rather than at compile time.</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 3:</strong> What is the difference between <code>Weak::upgrade()</code> returning <code>Some</code> vs <code>None</code>?
<div class="answer" data-answer="Some means the referenced data is still alive; None means all strong references have been dropped">
<p><code>upgrade()</code> returns <code>Some(Rc&lt;T&gt;)</code> if strong count > 0 (data alive), or <code>None</code> if all strong references have been dropped (data freed).</p>
</div>
</div>

## Exercises

<div class="exercise">
<strong>Exercise 1:</strong> Create a <code>SharedSensor</code> type using <code>Rc&lt;RefCell&lt;T&gt;&gt;</code> that can be cloned and read/mutated by multiple owners.

<details class="solution">
<summary>View Solution</summary>
<pre><code>use std::rc::Rc;
use std::cell::RefCell;

#[derive(Debug)]
struct SensorData {
    temperature: f64,
    calibration: f64,
}

#[derive(Clone)]
struct SharedSensor {
    data: Rc<RefCell<SensorData>>,
}

impl SharedSensor {
    fn new(temp: f64, cal: f64) -> Self {
        Self {
            data: Rc::new(RefCell::new(SensorData {
                temperature: temp,
                calibration: cal,
            })),
        }
    }

    fn read(&self) -> f64 {
        let d = self.data.borrow();
        d.temperature * d.calibration
    }

    fn calibrate(&self, new_cal: f64) {
        self.data.borrow_mut().calibration = new_cal;
    }
}

fn main() {
    let sensor1 = SharedSensor::new(23.5, 1.0);
    let sensor2 = sensor1.clone(); // Shared ownership

    println!("sensor1 reads: {}", sensor1.read());
    sensor2.calibrate(0.95); // Mutate through second owner
    println!("sensor1 reads after cal: {}", sensor1.read()); // Sees change
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 2:</strong> Implement a simple reference-counted <code>BufferPool</code> where multiple consumers can share access to a pool of buffers.

<details class="solution">
<summary>View Solution</summary>
<pre><code>use std::rc::Rc;
use std::cell::RefCell;

struct Buffer {
    id: usize,
    data: Vec<u8>,
}

struct BufferPool {
    buffers: Rc<RefCell<Vec<Buffer>>>,
}

impl BufferPool {
    fn new(count: usize, size: usize) -> Self {
        let buffers = (0..count)
            .map(|i| Buffer { id: i, data: vec![0; size] })
            .collect();
        Self {
            buffers: Rc::new(RefCell::new(buffers)),
        }
    }

    fn acquire(&self) -> Option<Buffer> {
        self.buffers.borrow_mut().pop()
    }

    fn release(&self, buf: Buffer) {
        self.buffers.borrow_mut().push(buf);
    }

    fn available(&self) -> usize {
        self.buffers.borrow().len()
    }
}

impl Clone for BufferPool {
    fn clone(&self) -> Self {
        Self { buffers: Rc::clone(&self.buffers) }
    }
}

fn main() {
    let pool = BufferPool::new(3, 256);
    let pool2 = pool.clone(); // Shared pool

    let buf1 = pool.acquire().unwrap();
    println!("Available after acquire: {}", pool2.available()); // 2

    pool2.release(buf1);
    println!("Available after release: {}", pool.available()); // 3
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 3:</strong> Use <code>Cow&lt;str&gt;</code> to write a function that normalizes sensor names: if the name is already lowercase, borrow it; if not, allocate a lowercase copy.

<details class="solution">
<summary>View Solution</summary>
<pre><code>use std::borrow::Cow;

fn normalize_name(name: &str) -> Cow<str> {
    if name.chars().all(|c| c.is_lowercase() || !c.is_alphabetic()) {
        Cow::Borrowed(name)
    } else {
        Cow::Owned(name.to_lowercase())
    }
}

fn main() {
    let names = vec!["temperature", "PRESSURE", "Humidity", "id"];

    for name in names {
        let normalized = normalize_name(name);
        let allocated = matches!(normalized, Cow::Owned(_));
        println!("{:15} → {:15} (allocated: {})", name, normalized, allocated);
    }
    // temperature     → temperature     (allocated: false)
    // PRESSURE        → pressure        (allocated: true)
    // Humidity        → humidity        (allocated: true)
    // id              → id              (allocated: false)
}
</code></pre>
</details>
</div>

## Summary

- **`Box<T>`** — heap allocation with single ownership.
- **`Deref`** — smart pointers act like their inner type.
- **`Drop`** — automatic cleanup when values go out of scope.
- **`Rc<T>`** — reference-counted shared ownership (single-thread only).
- **`RefCell<T>`** — runtime borrow checking for interior mutability.
- **`Cell<T>`** — copy-based interior mutability for `Copy` types.
- **`Weak<T>`** — prevents reference cycles; `upgrade()` to get `Rc`.
- **`Cow<T>`** — clone-on-write for read-mostly data.
- **`Arc<T>`** — atomic reference counting for threads.
- Use **Weak** to break cycles between Rc-managed data.

---

<div class="navigation">
<a href="/chapters/06-closures-iterators/">← Previous: Closures & Iterators</a>
<a href="/chapters/08-concurrency/">Next: Concurrency →</a>
</div>
