---
layout: chapter
title: "Concurrency"
chapter: 8
progress: 50
prev: /chapters/07-smart-pointers/
next: /chapters/09-embedded-rust/
description: "Master Rust's concurrency primitives: threads, channels, locks, async/await, and fearless concurrency patterns for firmware."
---

# Concurrency

<div class="info-box">
<strong>Why this matters</strong>
<p>Firmware is inherently concurrent — sensor polling, communication protocols, display updates, and motor control all happen simultaneously. Rust's ownership system makes concurrent code fearless: data races are caught at compile time. This chapter covers threads, channels, shared state, and async/await for responsive firmware architectures.</p>
</div>

## Threads

Rust uses OS threads (or platform threads in no_std):

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let handle = thread::spawn(|| {
        for i in 1..=5 {
            println!("Spawned thread: {}", i);
            thread::sleep(Duration::from_millis(100));
        }
    });

    for i in 1..=3 {
        println!("Main thread: {}", i);
        thread::sleep(Duration::from_millis(150));
    }

    handle.join().unwrap(); // Wait for spawned thread to finish
}
```

### move Closures

Threads take ownership of their data with `move`:

```rust
use std::thread;

fn main() {
    let data = vec![1, 2, 3, 4, 5];

    // Must move data into the thread
    let handle = thread::spawn(move || {
        println!("Data in thread: {:?}", data);
        data.iter().sum::<i32>()
    });

    // println!("{:?}", data); // ❌ data moved to thread

    let sum = handle.join().unwrap();
    println!("Sum: {}", sum);
}
```

<div class="playground">
<strong>Interactive Playground</strong>
<pre><code>use std::thread;

fn main() {
    let mut handles = vec![];

    for id in 0..4 {
        let handle = thread::spawn(move || {
            format!("Thread {} completed", id)
        });
        handles.push(handle);
    }

    let results: Vec<String> = handles.into_iter()
        .map(|h| h.join().unwrap())
        .collect();

    for result in results {
        println!("{}", result);
    }
}
</code></pre>
</div>

## Channels

Channels provide message-passing concurrency — one thread sends, another receives:

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    // Producer thread
    thread::spawn(move || {
        let messages = vec!["hello", "from", "thread"];
        for msg in messages {
            tx.send(msg).unwrap();
            thread::sleep(std::time::Duration::from_millis(100));
        }
    });

    // Consumer — receives until sender is dropped
    for received in rx {
        println!("Got: {}", received);
    }
}
```

### Multiple Producers

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    for i in 0..3 {
        let tx_clone = tx.clone();
        thread::spawn(move || {
            let msg = format!("Message from thread {}", i);
            tx_clone.send(msg).unwrap();
        });
    }

    drop(tx); // Drop original sender so channel closes

    for msg in rx {
        println!("Received: {}", msg);
    }
}
```

### Channels for Firmware Patterns

```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

#[derive(Debug)]
enum SensorEvent {
    Temperature(f64),
    Pressure(f64),
    Alert(String),
}

fn sensor_poller(tx: mpsc::Sender<SensorEvent>) {
    loop {
        // Simulate reading sensors
        let temp = 23.5 + rand_offset();
        tx.send(SensorEvent::Temperature(temp)).unwrap();

        if temp > 30.0 {
            tx.send(SensorEvent::Alert("High temperature!".into())).unwrap();
        }

        thread::sleep(Duration::from_millis(500));
    }
}

fn event_handler(rx: mpsc::Receiver<SensorEvent>) {
    for event in rx {
        match event {
            SensorEvent::Temperature(t) => println!("Temp: {:.1}°C", t),
            SensorEvent::Pressure(p) => println!("Pressure: {:.1} hPa", p),
            SensorEvent::Alert(msg) => println!("ALERT: {}", msg),
        }
    }
}

fn rand_offset() -> f64 {
    // Simplified random
    0.0
}
```

## Mutex\<T\> — Mutual Exclusion

`Mutex<T>` ensures only one thread accesses data at a time:

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            let mut num = counter.lock().unwrap();
            *num += 1;
        }));
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Final count: {}", *counter.lock().unwrap()); // 10
}
```

### Mutex with Channels

```rust
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

fn main() {
    let buffer = Arc::new(Mutex::new(Vec::new()));
    let (tx, rx) = mpsc::channel();

    // Writer thread
    let buf = Arc::clone(&buffer);
    let writer = thread::spawn(move || {
        for i in 0..10 {
            buf.lock().unwrap().push(i);
            tx.send(()).unwrap();
        }
    });

    // Reader thread
    let reader = thread::spawn(move || {
        for _ in 0..10 {
            rx.recv().unwrap();
            let data = buffer.lock().unwrap();
            println!("Buffer: {:?}", *data);
        }
    });

    writer.join().unwrap();
    reader.join().unwrap();
}
```

<div class="warning">
<strong>⚠ Deadlock Warning</strong>
<p>Never hold a Mutex lock while calling code that might lock another Mutex in a different order. This can cause deadlock — two threads waiting for each other's locks forever.</p>
</div>

## RwLock\<T\>

`RwLock<T>` allows multiple readers OR one writer (but not both):

```rust
use std::sync::{Arc, RwLock};
use std::thread;

fn main() {
    let config = Arc::new(RwLock::new(vec![1, 2, 3]));
    let mut handles = vec![];

    // Multiple readers
    for i in 0..3 {
        let config = Arc::clone(&config);
        handles.push(thread::spawn(move || {
            let data = config.read().unwrap();
            println!("Reader {}: {:?}", i, *data);
        }));
    }

    // One writer
    let config = Arc::clone(&config);
    handles.push(thread::spawn(move || {
        let mut data = config.write().unwrap();
        data.push(4);
        println!("Writer added 4");
    }));

    for handle in handles {
        handle.join().unwrap();
    }
}
```

| Lock | Readers | Writers | Use case |
|------|---------|---------|----------|
| `Mutex` | 1 total access | 1 total access | Simple mutual exclusion |
| `RwLock` | Multiple | 1 exclusive | Read-heavy workloads |

## Send and Sync Traits

These marker traits determine if a type can be shared across threads:

```rust
// Send — value can be transferred to another thread
// Sync — reference can be shared between threads

// Both are auto-implemented by the compiler
// Manual implementation is unsafe

// Examples:
// i32: Send + Sync (primitive)
// String: Send + Sync (heap data with no interior mutability)
// Rc<T>: !Send + !Sync (non-atomic reference count)
// Arc<T>: Send + Sync (atomic reference count)
// Mutex<T>: Send + Sync (provides synchronization)
// RefCell<T>: Send + !Sync (runtime borrow checking, not thread-safe)
```

<div class="collapsible">
<summary><strong>Send/Sync Implementation Rules</strong></summary>

```
Type                    Send    Sync
─────────────────────  ──────  ──────
i32, f64                ✅      ✅
String                  ✅      ✅
Vec<T>                  T:Send  T:Sync
Box<T>                  T:Send  T:Sync
Rc<T>                   ❌      ❌
Arc<T>                  T:Send+Sync  T:Send+Sync
Mutex<T>                T:Send  ✅
RefCell<T>              T:Send  ❌
Cell<T>                 T:Copy  ❌
```

To make a type both Send and Sync, use `Arc<Mutex<T>>` or `Arc<RwLock<T>>`.
</div>

## async/await

Async Rust enables concurrent I/O without dedicated threads:

```rust
use std::time::Duration;

async fn read_sensor(id: u8) -> f64 {
    // Simulate async I/O
    // In real firmware, this might await an interrupt
    23.5 + id as f64
}

async fn process_readings() {
    let temp = read_sensor(1).await;
    let pressure = read_sensor(2).await;
    println!("Temp: {}, Pressure: {}", temp, pressure);
}
```

### Futures

Every `async fn` returns a `Future`:

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

struct SimpleFuture {
    value: Option<u32>,
}

impl Future for SimpleFuture {
    type Output = u32;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        if let Some(val) = self.value.take() {
            Poll::Ready(val)
        } else {
            cx.waker().wake_by_ref();
            Poll::Pending
        }
    }
}
```

### Tokio Basics

```rust
// use tokio; // In real projects, add tokio as a dependency

async fn sensor_task(id: u8) {
    println!("Starting sensor {}", id);
    // tokio::time::sleep(Duration::from_millis(100)).await;
    println!("Sensor {} done", id);
}

async fn network_task() {
    println!("Network task running");
    // In real code: fetch data from server
}

// async fn main() {
//     tokio::join!(
//         sensor_task(1),
//         sensor_task(2),
//         network_task(),
//     );
// }
```

<div class="playground">
<strong>Interactive Playground — Async Concepts</strong>
<pre><code>use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

struct Delay {
    polls: u32,
    max_polls: u32,
}

impl Delay {
    fn new(ms: u32) -> Self {
        Self { polls: 0, max_polls: ms / 10 }
    }
}

impl Future for Delay {
    type Output = String;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        self.polls += 1;
        if self.polls >= self.max_polls {
            Poll::Ready(format!("Delayed {} polls", self.polls))
        } else {
            cx.waker().wake_by_ref();
            Poll::Pending
        }
    }
}

fn main() {
    // Simplified async demonstration
    let mut future = Delay::new(30);
    // In real async, the executor would poll this
    // For demonstration, we poll manually
    let waker = std::task::Waker::noop();
    let mut cx = std::task::Context::from_waker(&waker);

    loop {
        match Pin::new(&mut future).poll(&mut cx) {
            Poll::Ready(msg) => {
                println!("{}", msg);
                break;
            }
            Poll::Pending => {
                println!("Not ready yet...");
            }
        }
    }
}
</code></pre>
</div>

## Concurrent Patterns

### Fan-Out / Fan-In

```rust
use std::sync::mpsc;
use std::thread;

fn fan_out_fan_in(data: Vec<i32>, worker_count: usize) -> Vec<i32> {
    let (tx, rx) = mpsc::channel();
    let chunk_size = (data.len() + worker_count - 1) / worker_count;

    // Fan out — distribute work
    for chunk in data.chunks(chunk_size) {
        let tx = tx.clone();
        let chunk = chunk.to_vec();
        thread::spawn(move || {
            let result: Vec<i32> = chunk.iter().map(|x| x * 2).collect();
            tx.send(result).unwrap();
        });
    }
    drop(tx);

    // Fan in — collect results
    rx.into_iter().flatten().collect()
}

fn main() {
    let data: Vec<i32> = (0..100).collect();
    let result = fan_out_fan_in(data, 4);
    println!("Processed {} items", result.len());
}
```

### Producer-Consumer with Bounded Channel

```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

fn producer_consumer() {
    let (tx, rx) = mpsc::sync_channel(5); // Bounded buffer

    // Producer
    thread::spawn(move || {
        for i in 0..20 {
            tx.send(i).unwrap();
            println!("Produced: {}", i);
            thread::sleep(Duration::from_millis(50));
        }
    });

    // Consumer
    for received in rx {
        println!("  Consumed: {}", received);
        thread::sleep(Duration::from_millis(100)); // Slower consumer
    }
}
```

### Shared State with Arc\<Mutex\>

```rust
use std::sync::{Arc, Mutex};
use std::thread;

struct SharedState {
    sensor_readings: Vec<f64>,
    alarm_active: bool,
}

fn shared_state_example() {
    let state = Arc::new(Mutex::new(SharedState {
        sensor_readings: Vec::new(),
        alarm_active: false,
    }));

    let mut handles = vec![];

    // Sensor reader thread
    let state_clone = Arc::clone(&state);
    handles.push(thread::spawn(move || {
        for i in 0..10 {
            let mut s = state_clone.lock().unwrap();
            let reading = 20.0 + i as f64;
            s.sensor_readings.push(reading);
            if reading > 28.0 {
                s.alarm_active = true;
            }
        }
    }));

    // Monitor thread
    let state_clone = Arc::clone(&state);
    handles.push(thread::spawn(move || {
        for _ in 0..10 {
            let s = state_clone.lock().unwrap();
            if s.alarm_active {
                println!("ALARM! Readings: {:?}", s.sensor_readings);
            }
            drop(s); // Explicitly release lock
            thread::sleep(std::time::Duration::from_millis(20));
        }
    }));

    for h in handles {
        h.join().unwrap();
    }
}
```

## Real-World Concurrency Example

```rust
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::Duration;

enum ControlMessage {
    SetSpeed(u16),
    Stop,
    Status,
}

struct MotorController {
    speed: u16,
    running: bool,
}

impl MotorController {
    fn new() -> Self {
        Self { speed: 0, running: false }
    }

    fn handle_message(&mut self, msg: ControlMessage) -> String {
        match msg {
            ControlMessage::SetSpeed(s) => {
                self.speed = s;
                self.running = true;
                format!("Speed set to {}", s)
            }
            ControlMessage::Stop => {
                self.running = false;
                self.speed = 0;
                "Motor stopped".into()
            }
            ControlMessage::Status => {
                format!("Speed: {}, Running: {}", self.speed, self.running)
            }
        }
    }
}

fn motor_thread(rx: mpsc::Receiver<ControlMessage>) {
    let mut controller = MotorController::new();

    for msg in rx {
        let response = controller.handle_message(msg);
        println!("[Motor] {}", response);
    }
}

fn main() {
    let (tx, rx) = mpsc::channel();

    let motor_handle = thread::spawn(move || motor_thread(rx));

    // Send commands
    tx.send(ControlMessage::SetSpeed(1500)).unwrap();
    tx.send(ControlMessage::Status).unwrap();
    tx.send(ControlMessage::SetSpeed(2000)).unwrap();
    tx.send(ControlMessage::Stop).unwrap();

    drop(tx);
    motor_handle.join().unwrap();
}
```

## Comparison: Bad vs Good

<div class="comparison">
<div class="bad">
<strong>❌ Bad — Shared mutable state without synchronization</strong>
<pre><code>// NOT POSSIBLE in Rust — compiler prevents this
use std::thread;

let mut data = vec![];

let handle = thread::spawn(|| {
    data.push(1); // ❌ Can't move mutable ref into thread
});

data.push(2); // ❌ Can't use data here either</code></pre>
</div>

<div class="good">
<strong>✅ Good — Proper synchronization with Arc&lt;Mutex&gt;</strong>
<pre><code>use std::sync::{Arc, Mutex};
use std::thread;

let data = Arc::new(Mutex::new(vec![]));

let data_clone = Arc::clone(&data);
let handle = thread::spawn(move || {
    data_clone.lock().unwrap().push(1);
});

data.lock().unwrap().push(2);
handle.join().unwrap();

println!("{:?}", data.lock().unwrap()); // [1, 2]</code></pre>
</div>
</div>

<div class="comparison">
<div class="bad">
<strong>❌ Bad — Holding lock across .await</strong>
<pre><code>// BAD — lock held across await point
async fn process(state: Arc<Mutex<State>>) {
    let mut s = state.lock().unwrap();
    some_async_op().await; // ❌ Lock held here!
    s.value += 1;
}</code></pre>
</div>

<div class="good">
<strong>✅ Good — Minimize lock scope</strong>
<pre><code>// GOOD — release lock before await
async fn process(state: Arc<Mutex<State>>) {
    let result = {
        let mut s = state.lock().unwrap();
        s.value += 1;
        s.value
    }; // Lock dropped here
    some_async_op().await; // ✅ No lock held
}</code></pre>
</div>
</div>

## Quiz

<div class="quiz">
<strong>Quiz 1:</strong> Why must closures passed to <code>thread::spawn</code> use <code>move</code>?
<div class="answer" data-answer="The spawned thread may outlive the current scope, so it must own its data; move transfers ownership into the thread">
<p>Spawned threads can outlive the function that created them. Without <code>move</code>, the closure would borrow data that might be dropped before the thread finishes. <code>move</code> transfers ownership, ensuring the thread owns its data.</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 2:</strong> What is the difference between <code>mpsc::channel</code> and <code>mpsc::sync_channel</code>?
<div class="answer" data-answer="channel is unbounded (async); sync_channel is bounded (blocks when full)">
<p><code>channel</code> creates an unbounded channel — senders never block. <code>sync_channel(n)</code> creates a bounded channel with capacity n — senders block when the buffer is full, providing backpressure.</p>
</div>
</div>

<div class="quiz">
<strong>Quiz 3:</strong> When should you use <code>Arc&lt;Mutex&lt;T&gt;&gt;</code> vs channels?
<div class="answer" data-answer="Arc&lt;Mutex&gt; for shared state accessed by multiple threads; channels for message passing between producer/consumer pairs">
<p><code>Arc&lt;Mutex&lt;T&gt;&gt;</code> is best when multiple threads need to read/write shared state. Channels are best for producer-consumer patterns where data flows in one direction.</p>
</div>
</div>

## Exercises

<div class="exercise">
<strong>Exercise 1:</strong> Create a thread pool of 4 workers that process a vector of numbers in parallel. Each worker should double its assigned numbers. Collect all results.

<details class="solution">
<summary>View Solution</summary>
<pre><code>use std::sync::mpsc;
use std::thread;

fn parallel_double(data: Vec<i32>, workers: usize) -> Vec<i32> {
    let (tx, rx) = mpsc::channel();
    let chunk_size = (data.len() + workers - 1) / workers;

    for chunk in data.chunks(chunk_size) {
        let tx = tx.clone();
        let chunk = chunk.to_vec();
        thread::spawn(move || {
            let doubled: Vec<i32> = chunk.iter().map(|x| x * 2).collect();
            tx.send(doubled).unwrap();
        });
    }

    drop(tx);
    rx.into_iter().flatten().collect()
}

fn main() {
    let data: Vec<i32> = (1..=20).collect();
    let result = parallel_double(data, 4);
    println!("Result: {:?}", result);
    assert_eq!(result.len(), 20);
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 2:</strong> Implement a thread-safe counter using <code>Arc&lt;Mutex&lt;u64&gt;&gt;</code> with two threads: one incrementing, one decrementing. Report the final value.

<details class="solution">
<summary>View Solution</summary>
<pre><code>use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0u64));

    let c1 = Arc::clone(&counter);
    let inc = thread::spawn(move || {
        for _ in 0..1000 {
            *c1.lock().unwrap() += 1;
        }
    });

    let c2 = Arc::clone(&counter);
    let dec = thread::spawn(move || {
        for _ in 0..500 {
            *c2.lock().unwrap() -= 1;
        }
    });

    inc.join().unwrap();
    dec.join().unwrap();

    println!("Final: {}", *counter.lock().unwrap()); // 500
}
</code></pre>
</details>
</div>

<div class="exercise">
<strong>Exercise 3:</strong> Design a sensor monitoring system with 3 sensor threads sending readings via channels to a central logger thread that prints alerts when values exceed thresholds.

<details class="solution">
<summary>View Solution</summary>
<pre><code>use std::sync::mpsc;
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone)]
struct Reading {
    sensor_id: u8,
    value: f64,
    unit: String,
}

fn sensor_thread(id: u8, tx: mpsc::Sender<Reading>, unit: &str) {
    let mut value = 20.0;
    loop {
        value += (id as f64 - 2.0) * 0.5; // Different drift per sensor
        let reading = Reading {
            sensor_id: id,
            value,
            unit: unit.to_string(),
        };
        if tx.send(reading).is_err() { break; }
        thread::sleep(Duration::from_millis(200));
    }
}

fn logger_thread(rx: mpsc::Receiver<Reading>) {
    for reading in rx {
        let alert = if reading.value > 30.0 || reading.value < 10.0 {
            " ⚠ ALERT"
        } else {
            ""
        };

        println!(
            "Sensor {} ({}): {:.1}{}{}",
            reading.sensor_id, reading.unit, reading.value, reading.unit, alert
        );
    }
}

fn main() {
    let (tx, rx) = mpsc::channel();

    let sensors = vec![
        (0, "°C", 20.0),
        (1, "hPa", 1013.0),
        (2, "%RH", 50.0),
    ];

    let mut handles = vec![];
    for (id, unit, _start) in sensors {
        let tx = tx.clone();
        handles.push(thread::spawn(move || sensor_thread(id, tx, unit)));
    }

    drop(tx);

    let logger = thread::spawn(move || logger_thread(rx));

    // Let it run for a bit (in real code, use a signal handler)
    thread::sleep(Duration::from_secs(1));
    // In production, send a stop signal instead of dropping

    for h in handles {
        h.join().unwrap();
    }
    logger.join().unwrap();
}
</code></pre>
</details>
</div>

## Summary

- **Threads** run code concurrently — use `move` to transfer ownership.
- **Channels** (`mpsc`) enable message passing between threads.
- **`Mutex<T>`** provides mutual exclusion — one writer at a time.
- **`RwLock<T>`** allows multiple readers or one writer.
- **`Arc<T>`** enables shared ownership across threads (atomic).
- **`Send`/`Sync`** are marker traits enforced by the compiler.
- **`async/await`** enables concurrent I/O without dedicated threads.
- **`Future`** represents a value that will be available later.
- Prefer **channels** for producer-consumer; **`Arc<Mutex>`** for shared state.
- Always **minimize lock scope** — release locks before `.await` or long operations.

---

<div class="navigation">
<a href="/chapters/07-smart-pointers/">← Previous: Smart Pointers</a>
<a href="/chapters/09-embedded-rust/">Next: Embedded Rust →</a>
</div>
