---
layout: default
title: "All Exercises"
---

# All Exercises

A comprehensive list of all exercises from the Rust Firmware Wiki, organized by chapter.

## Difficulty Levels

- **Beginner** (15-30 min) — Basic concepts, straightforward implementation
- **Intermediate** (30-60 min) — Requires understanding of multiple concepts
- **Advanced** (1-2 hours) — Complex implementation, multiple interacting components

---

## Chapter 9: Embedded Rust

### Exercise 1: GPIO Configuration
- **Difficulty:** Beginner
- **Time:** 20 min
- **Description:** Write a function that configures three GPIO pins (PA0, PA1, PA2) as outputs using the STM32 HAL.

### Exercise 2: Timer Interrupt
- **Difficulty:** Intermediate
- **Time:** 45 min
- **Description:** Write an interrupt handler that toggles an LED every time Timer 2 overflows.

### Exercise 3: SPI Communication
- **Difficulty:** Intermediate
- **Time:** 40 min
- **Description:** Write a function that sends a 4-byte command over SPI to a peripheral device.

---

## Chapter 10: no_std Rust

### Exercise 1: no_std Conversion
- **Difficulty:** Beginner
- **Time:** 25 min
- **Description:** Convert std Rust code to no_std by removing OS-dependent features.

### Exercise 2: Custom Panic Handler
- **Difficulty:** Intermediate
- **Time:** 35 min
- **Description:** Write a panic handler that blinks an LED in SOS pattern before halting.

### Exercise 3: Memory-Safe Buffer
- **Difficulty:** Advanced
- **Time:** 60 min
- **Description:** Implement a fixed-size ring buffer safe for main and interrupt contexts.

---

## Chapter 11: Firmware Protocols

### Exercise 1: Message Parser
- **Difficulty:** Intermediate
- **Time:** 40 min
- **Description:** Write a struct that parses an MCTP message header with validation.

### Exercise 2: Protocol Handler
- **Difficulty:** Intermediate
- **Time:** 45 min
- **Description:** Implement a trait-based protocol handler for different message types.

### Exercise 3: Error Recovery
- **Difficulty:** Advanced
- **Time:** 50 min
- **Description:** Implement retry logic with exponential backoff for protocol messages.

---

## Chapter 12: MCTP Deep Dive

### Exercise 1: MCTP Message Builder
- **Difficulty:** Intermediate
- **Time:** 40 min
- **Description:** Implement a builder pattern for constructing MCTP messages.

### Exercise 2: Transport Abstraction
- **Difficulty:** Intermediate
- **Time:** 45 min
- **Description:** Define a trait for MCTP transport with mock implementation for testing.

### Exercise 3: Error Recovery
- **Difficulty:** Advanced
- **Time:** 55 min
- **Description:** Implement retry mechanism with exponential backoff for MCTP sending.

---

## Chapter 13: SPDM & DICE

### Exercise 1: DICE Certificate Generation
- **Difficulty:** Advanced
- **Time:** 60 min
- **Description:** Implement a function that generates a DICE certificate given CDI and TCB info.

### Exercise 2: PCR Extension
- **Difficulty:** Intermediate
- **Time:** 40 min
- **Description:** Implement a PCR bank that supports extending measurements and reading values.

### Exercise 3: SPDM Challenge Response
- **Difficulty:** Advanced
- **Time:** 65 min
- **Description:** Implement a SPDM responder that handles CHALLENGE requests.

---

## Chapter 14: Caliptra

### Exercise 1: Mailbox Command
- **Difficulty:** Intermediate
- **Time:** 45 min
- **Description:** Implement a function that sends GET_MEASUREMENTS command through Caliptra mailbox.

### Exercise 2: Certificate Validation
- **Difficulty:** Advanced
- **Time:** 55 min
- **Description:** Implement a function that validates a DICE certificate chain from leaf to root.

### Exercise 3: Key Derivation
- **Difficulty:** Intermediate
- **Time:** 40 min
- **Description:** Implement Caliptra's key derivation function for signing, attestation, and encryption keys.

---

## Chapter 15: OpenPRoT

### Exercise 1: Hubris Task
- **Difficulty:** Advanced
- **Time:** 60 min
- **Description:** Create a Hubris task that monitors system temperature and triggers alerts.

### Exercise 2: HAL Implementation
- **Difficulty:** Intermediate
- **Time:** 50 min
- **Description:** Implement the Flash trait for a simulated flash device using RAM.

### Exercise 3: IPC Messages
- **Difficulty:** Advanced
- **Time:** 65 min
- **Description:** Design a complete IPC message protocol for firmware update operations.

---

## Chapter 16: Portfolio Projects

### Exercise 1: Portfolio README
- **Difficulty:** Beginner
- **Time:** 30 min
- **Description:** Write a comprehensive README for your firmware portfolio.

### Exercise 2: CI Pipeline
- **Difficulty:** Intermediate
- **Time:** 45 min
- **Description:** Design a complete CI pipeline for a firmware project.

### Exercise 3: Project Description
- **Difficulty:** Beginner
- **Time:** 25 min
- **Description:** Write a compelling 200-word project description highlighting technical decisions.

---

## Summary

| Chapter | Exercises | Total Time |
|---------|-----------|------------|
| Embedded Rust | 3 | ~105 min |
| no_std Rust | 3 | ~120 min |
| Firmware Protocols | 3 | ~135 min |
| MCTP Deep Dive | 3 | ~140 min |
| SPDM & DICE | 3 | ~165 min |
| Caliptra | 3 | ~140 min |
| OpenPRoT | 3 | ~175 min |
| Portfolio Projects | 3 | ~100 min |
| **Total** | **24** | **~1080 min (~18 hours)** |

## Tips for Completing Exercises

1. **Start with the basics** — Complete beginner exercises before advanced
2. **Read the chapter first** — Understand concepts before implementing
3. **Test your code** — Write tests for each exercise
4. **Compare solutions** — Review provided solutions after attempting
5. **Modify and extend** — Add features beyond the requirements
6. **Document your work** — Write comments explaining your approach
