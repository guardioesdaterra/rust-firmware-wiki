---
layout: chapter
title: "SPDM & DICE"
chapter: 13
progress: 81
prev: /chapters/12-mctp/
next: /chapters/14-caliptra/
---

# SPDM & DICE

{% include callout.html type="info" title="Why this matters for 9elements" content="SPDM and DICE are the cornerstone of platform trust at 9elements. We implement DICE for Caliptra's attestation flow and use SPDM for secure device authentication. Understanding these protocols is critical for building firmware that proves its identity and integrity to the rest of the platform." %}

## Overview

**SPDM (Security Protocol and Data Model)** and **DICE (Device Identifier Composition Engine)** work together to establish platform trust:

- **SPDM** handles authentication and key exchange between devices
- **DICE** creates a hardware-rooted chain of trust through measured boot

Together, they enable:
- **Device attestation** — proving a device's identity and firmware state
- **Secure communication** — encrypted channels between authenticated components
- **Firmware integrity** — verifying that firmware hasn't been tampered with

## SPDM Protocol

SPDM is defined in the DMTF specification DSP0274. It provides mutual authentication and key establishment.

### SPDM Handshake Flow

```text
┌───────────────────────┐     ┌───────────────────────┐
│      Requester        │     │       Responder        │
│    (Authenticator)    │     │     (Device being      │
│                       │     │      authenticated)    │
└───────────┬───────────┘     └───────────┬───────────┘
            │                             │
            │  1. GET_VERSION             │
            │────────────────────────────>│
            │                             │
            │  VERSION                    │
            │<────────────────────────────│
            │                             │
            │  2. GET_CAPABILITIES        │
            │────────────────────────────>│
            │                             │
            │  CAPABILITIES               │
            │<────────────────────────────│
            │                             │
            │  3. NEGOTIATE_ALGORITHMS    │
            │────────────────────────────>│
            │                             │
            │  ALGORITHMS                 │
            │<────────────────────────────│
            │                             │
            │  4. GET_DIGESTS             │
            │────────────────────────────>│
            │                             │
            │  DIGESTS                    │
            │<────────────────────────────│
            │                             │
            │  5. GET_CERTIFICATE         │
            │────────────────────────────>│
            │                             │
            │  CERTIFICATE                │
            │<────────────────────────────│
            │                             │
            │  6. CHALLENGE               │
            │────────────────────────────>│
            │                             │
            │  CHALLENGE_AUTH             │
            │<────────────────────────────│
            │                             │
            │  7. FINISH                  │
            │────────────────────────────>│
            │                             │
            │  FINISH_ACK                 │
            │<────────────────────────────│
            │                             │
            │  === Secure Channel ===     │
            │                             │
```

### SPDM Version Negotiation

```rust
#[repr(C, packed)]
struct SpdmVersionRequest {
    spdm_header: SpdmHeader,
    version_number_entry_count: u8,
    version_number_entry: [SpdmVersionNumber; 1],
}

#[repr(C, packed)]
struct SpdmVersionResponse {
    spdm_header: SpdmHeader,
    version_number_entry_count: u8,
    version_number_entry: [SpdmVersionNumber; 2],
}

#[repr(C, packed)]
struct SpdmVersionNumber {
    major_version: u8,
    minor_version: u8,
    update_version: u8,
    alpha: u8,
    firmware_version: [u8; 2],
}

// SPDM Header
#[repr(C, packed)]
struct SpdmHeader {
    spdm_version: u8,
    request_response_code: u8,
    param1: u8,
    param2: u8,
}

// Request/Response codes
const SPDM_REQUEST_GET_VERSION: u8 = 0x84;
const SPDM_RESPONSE_VERSION: u8 = 0x84;
```

### SPDM Capabilities

```rust
#[repr(C, packed)]
struct SpdmCapabilities {
    spdm_header: SpdmHeader,
    ct_exponent: u8,
    flags: u32,  // Capability flags
    data_transfer_size: u16,
    max_spdm_msg_size: u16,
}

// Capability flags
const CAP_FLAG_CERT_CAP: u32 = 0x00000008;
const CAP_FLAG_CHAL_CAP: u32 = 0x00000020;
const CAP_FLAG_ENCRYPT_CAP: u32 = 0x00004000;
const CAP_FLAG_MAC_CAP: u32 = 0x00008000;
const CAP_FLAG_MUTUAL_AUTH_CAP: u32 = 0x00080000;
```

### SPDM Algorithms

```rust
#[repr(C, packed)]
struct SpdmAlgorithmRequest {
    spdm_header: SpdmHeader,
    supported_algorithm_struct_count: u16,
    algorithm.support_hash: u32,
    algorithm.support_asym: u32,
    algorithm.dhe_named_group: u32,
    algorithm.aead_cipher_suite: u32,
}

#[repr(C, packed)]
struct SpdmAlgorithmResponse {
    spdm_header: SpdmHeader,
    algorithm_struct_count: u16,
    algorithm.support_hash: u32,
    algorithm.support_asym: u32,
    algorithm.dhe_named_group: u32,
    algorithm.aead_cipher_suite: u32,
}

// Hash algorithms
const SPDM_ALGO_HASH_SHA256: u32 = 0x00000002;
const SPDM_ALGO_HASH_SHA384: u32 = 0x00000004;
const SPDM_ALGO_HASH_SHA512: u32 = 0x00000008;

// Asymmetric algorithms
const SPDM_ALGO_ASYM_RSA_PSS_2048: u32 = 0x00000010;
const SPDM_ALGO_ASYM_RSA_PSS_4096: u32 = 0x00000020;
const SPDM_ALGO_ASYM_ECDSA_P256: u32 = 0x00000200;
const SPDM_ALGO_ASYM_ECDSA_P384: u32 = 0x00000400;
```

### SPDM Challenge

```rust
#[repr(C, packed)]
struct SpdmChallengeRequest {
    spdm_header: SpdmHeader,
    slot_id: u8,
    reserved: u8,
    nonce: [u8; 32],  // Random nonce
}

#[repr(C, packed)]
struct SpdmChallengeResponse {
    spdm_header: SpdmHeader,
    slot_id: u8,
    reserved: u8,
    nonce: [u8; 32],  // Responder nonce
    opaque_data_length: u16,
    signature_length: u16,
    signature: [u8; 256],  // ECDSA signature
    opaque_data: [u8; 0],  // Variable length
}
```

## DICE Overview

DICE is a hardware-rooted attestation mechanism defined by the Trusted Computing Group (TCG).

### DICE Chain of Trust

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Hardware Root of Trust                        │
│                    (Device Unique Secret)                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         ROM Layer                                │
│                    Measures FMC Firmware                         │
│                    Creates CDI_1 = HMAC(DICE_input, CDI_0)       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    First Mutable Code (FMC)                      │
│                    Measures Runtime Firmware                     │
│                    Creates CDI_2 = HMAC(DICE_input, CDI_1)       │
│                    Issues Certificate_1                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Runtime Firmware                            │
│                    Measures Applications                         │
│                    Creates CDI_3 = HMAC(DICE_input, CDI_2)       │
│                    Issues Certificate_2                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│                    Verifies Certificate Chain                    │
│                    Establishes Trust                             │
└─────────────────────────────────────────────────────────────────┘
```

### DICE TCB Info

```rust
#[repr(C, packed)]
struct DiceTcbInfo {
    // Version information
    version: u32,
    // SVN (Security Version Number)
    svn: u32,
    // Vendor ID
    vendor_id: [u8; 16],
    // Vendor info
    vendor_info: [u8; 16],
    // Flags
    flags: u32,
}

impl DiceTcbInfo {
    fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&self.version.to_le_bytes());
        bytes.extend_from_slice(&self.svn.to_le_bytes());
        bytes.extend_from_slice(&self.vendor_id);
        bytes.extend_from_slice(&self.vendor_info);
        bytes.extend_from_slice(&self.flags.to_le_bytes());
        bytes
    }
}
```

### DICE Certificate

```rust
#[repr(C, packed)]
struct DiceCertificate {
    // Certificate header
    header: DiceCertHeader,
    // TCB info
    tcb_info: DiceTcbInfo,
    // Key material
    public_key: [u8; 32],  // ECDSA P-256 public key
    // Signature
    signature: [u8; 64],   // ECDSA P-256 signature
}

#[repr(C, packed)]
struct DiceCertHeader {
    magic: [u8; 4],        // "DIC0"
    version: u16,
    cert_type: u8,         // 0=device, 1=intermediate, 2=root
    length: u16,
}
```

### CDI (Compound Device Identifier)

```rust
// CDI generation using HMAC-SHA256
fn generate_cdi(
    dice_input: &[u8],
    current_cdi: &[u8],
) -> [u8; 32] {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    type HmacSha256 = Hmac<Sha256>;

    let mut mac = HmacSha256::new_from_slice(current_cdi)
        .expect("HMAC can take key of any size");
    mac.update(dice_input);
    let result = mac.finalize();
    
    let mut new_cdi = [0u8; 32];
    new_cdi.copy_from_slice(&result.into_bytes());
    new_cdi
}

// DICE input structure
struct DiceInput {
    // Measurements of the next layer
    measurements: Vec<u8>,
    // TCB info of the next layer
    tcb_info: DiceTcbInfo,
    // Mode (ROM, FMC, Runtime)
    mode: DiceMode,
}
```

## Attestation Flow

### Complete Attestation Process

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Platform Boot Sequence                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. ROM Stage                                                     │
│     ├── Read device unique secret (CDI_0)                        │
│     ├── Measure FMC code hash                                    │
│     ├── Generate CDI_1 = HMAC(CDI_0, measurements)               │
│     └── Hand off to FMC                                          │
│                                                                   │
│  2. FMC Stage                                                     │
│     ├── Derive signing key from CDI_1                            │
│     ├── Generate certificate for CDI_1                           │
│     ├── Measure Runtime code hash                                │
│     ├── Generate CDI_2 = HMAC(CDI_1, measurements)               │
│     └── Hand off to Runtime                                      │
│                                                                   │
│  3. Runtime Stage                                                 │
│     ├── Derive signing key from CDI_2                            │
│     ├── Generate certificate for CDI_2                           │
│     ├── Listen for SPDM requests                                 │
│     └── Respond to attestation challenges                        │
│                                                                   │
│  4. Verification                                                  │
│     ├── Verifier sends SPDM GET_CERTIFICATE                      │
│     ├── Device sends certificate chain                           │
│     ├── Verifier validates certificate chain                     │
│     ├── Verifier sends SPDM CHALLENGE                            │
│     ├── Device signs challenge with device key                   │
│     └── Verifier validates signature                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Attestation Implementation

```rust
struct AttestationService {
    cdi: [u8; 32],
    cert_chain: Vec<DiceCertificate>,
}

impl AttestationService {
    fn new(cdi: [u8; 32]) -> Self {
        AttestationService {
            cdi,
            cert_chain: Vec::new(),
        }
    }

    fn generate_attestation_report(
        &self,
        nonce: &[u8],
    ) -> Result<AttestationReport, AttestationError> {
        // Get device measurements
        let measurements = self.get_measurements();

        // Create report
        let report = AttestationReport {
            measurements,
            tcb_info: self.get_tcb_info(),
            nonce: nonce.to_vec(),
            certificate_chain: self.cert_chain.clone(),
        };

        // Sign the report
        let signing_key = self.derive_signing_key()?;
        let signature = signing_key.sign(&report.to_bytes())?;

        Ok(AttestationReport {
            signature,
            ..report
        })
    }

    fn derive_signing_key(&self) -> Result<SigningKey, AttestationError> {
        // Derive key from CDI using HKDF
        let hkdf = Hkdf::<Sha256>::new(Some(b"dice-signing"), &self.cdi);
        let mut key_material = [0u8; 32];
        hkdf.expand(b"signing-key", &mut key_material)
            .map_err(|_| AttestationError::KeyDerivationFailed)?;

        Ok(SigningKey::from_bytes(&key_material)?)
    }

    fn get_measurements(&self) -> Vec<Measurement> {
        // Read PCR (Platform Configuration Register) values
        vec![
            Measurement {
                index: 0,
                value: self.measure_rom(),
            },
            Measurement {
                index: 1,
                value: self.measure_fmc(),
            },
            Measurement {
                index: 2,
                value: self.measure_runtime(),
            },
        ]
    }
}
```

## Measured Boot

Measured boot records the hash of each firmware component as it loads.

### PCR (Platform Configuration Registers)

```rust
pub struct PcrBank {
    registers: [Pcr; 8],  // Typical: 8 PCR registers
}

pub struct Pcr {
    index: u8,
    digest: [u8; 32],  // SHA-256 hash
}

impl PcrBank {
    pub fn new() -> Self {
        PcrBank {
            registers: core::array::from_fn(|i| Pcr {
                index: i as u8,
                digest: [0u8; 32],
            }),
        }
    }

    pub fn extend(&mut self, index: usize, data: &[u8]) -> Result<(), PcrError> {
        if index >= self.registers.len() {
            return Err(PcrError::InvalidIndex);
        }

        let pcr = &mut self.registers[index];

        // PCR extend: new_value = SHA256(old_value || new_data)
        let mut hasher = Sha256::new();
        hasher.update(pcr.digest);
        hasher.update(data);
        pcr.digest = hasher.finalize().into();

        Ok(())
    }

    pub fn read(&self, index: usize) -> Result<[u8; 32], PcrError> {
        if index >= self.registers.len() {
            return Err(PcrError::InvalidIndex);
        }
        Ok(self.registers[index].digest)
    }
}

// Example: Extend PCR with firmware hash
fn measure_boot_stage(pcr_bank: &mut PcrBank, stage_name: &str, code: &[u8]) {
    let hash = Sha256::digest(code);
    pcr_bank.extend(0, hash.as_slice()).unwrap();
    println!("Measured {}: {:02x?}", stage_name, hash);
}
```

### Firmware Measurement Example

```rust
fn measured_boot_flow() {
    let mut pcr_bank = PcrBank::new();

    // Stage 1: ROM (immutable)
    let rom_code = include_bytes!("rom.bin");
    let rom_hash = Sha256::digest(rom_code);
    pcr_bank.extend(0, rom_hash.as_slice()).unwrap();
    println!("ROM hash: {:02x?}", rom_hash);

    // Stage 2: FMC
    let fmc_code = load_fmc_from_flash();
    let fmc_hash = Sha256::digest(&fmc_code);
    pcr_bank.extend(1, fmc_hash.as_slice()).unwrap();
    println!("FMC hash: {:02x?}", fmc_hash);

    // Stage 3: Runtime
    let runtime_code = load_runtime_from_flash();
    let runtime_hash = Sha256::digest(&runtime_code);
    pcr_bank.extend(2, runtime_hash.as_slice()).unwrap();
    println!("Runtime hash: {:02x?}", runtime_hash);

    // Stage 4: Application
    let app_code = load_application();
    let app_hash = Sha256::digest(&app_code);
    pcr_bank.extend(3, app_hash.as_slice()).unwrap();
    println!("App hash: {:02x?}", app_hash);

    // Generate attestation report
    let report = AttestationReport {
        pcr_values: [
            pcr_bank.read(0).unwrap(),
            pcr_bank.read(1).unwrap(),
            pcr_bank.read(2).unwrap(),
            pcr_bank.read(3).unwrap(),
        ],
        timestamp: get_timestamp(),
    };

    println!("Attestation report generated");
    println!("PCR0 (ROM):    {:02x?}", report.pcr_values[0]);
    println!("PCR1 (FMC):    {:02x?}", report.pcr_values[1]);
    println!("PCR2 (Runtime):{:02x?}", report.pcr_values[2]);
    println!("PCR3 (App):    {:02x?}", report.pcr_values[3]);
}
```

## DICE Chain Visualization

### Complete Certificate Chain

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Root Certificate (Root of Trust)              │
├─────────────────────────────────────────────────────────────────┤
│  Subject: Root CA                                               │
│  Issuer: Self-signed                                            │
│  Validity: Permanent                                            │
│  Public Key: ECDSA P-256                                        │
│  Serial: 0                                                      │
│  Extensions: Basic Constraints: CA:TRUE                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Signs
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Intermediate Certificate (FMC)               │
├─────────────────────────────────────────────────────────────────┤
│  Subject: FMC (EID: 1)                                         │
│  Issuer: Root CA                                                │
│  Validity: Boot session                                         │
│  Public Key: ECDSA P-256                                        │
│  Serial: 1                                                      │
│  Extensions:                                                    │
│    - DiceTcbInfo: SVN=1, VendorID="Caliptra"                   │
│    - Measurements: FMC code hash                                │
│  Signature: ECDSA-P256(Root_Priv, TCB_Info || Pub_Key)         │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Signs
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Leaf Certificate (Runtime)                   │
├─────────────────────────────────────────────────────────────────┤
│  Subject: Runtime (EID: 2)                                      │
│  Issuer: FMC                                                    │
│  Validity: Boot session                                         │
│  Public Key: ECDSA P-256                                        │
│  Serial: 2                                                      │
│  Extensions:                                                    │
│    - DiceTcbInfo: SVN=2, VendorID="Caliptra"                   │
│    - Measurements: Runtime code hash                            │
│  Signature: ECDSA-P256(FMC_Priv, TCB_Info || Pub_Key)          │
└─────────────────────────────────────────────────────────────────┘
```

## SPDM Challenge Diagram

### Mutual Authentication with SPDM + DICE

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Verifier                                 │
│                    (Platform Owner/Cloud)                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
            ┌───────────────────┴───────────────────┐
            │                                       │
            │  1. SPDM GET_VERSION                  │
            │  2. SPDM GET_CAPABILITIES              │
            │  3. SPDM NEGOTIATE_ALGORITHMS          │
            │  4. SPDM GET_CERTIFICATE (Slot 0)      │
            │     └─> Receives DICE cert chain       │
            │  5. Validate certificate chain         │
            │     └─> Root -> FMC -> Runtime          │
            │  6. SPDM CHALLENGE                     │
            │     └─> Random nonce                   │
            │  7. Device signs nonce with CDI key    │
            │  8. Verify signature                   │
            │     └─> Trust established!             │
            │                                       │
            └───────────────────┬───────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Device (with DICE)                            │
├─────────────────────────────────────────────────────────────────┤
│  Hardware Root of Trust                                          │
│  └─> CDI_0 (Device Unique Secret)                               │
│       └─> ROM measures FMC, generates CDI_1                     │
│            └─> FMC measures Runtime, generates CDI_2             │
│                 └─> Runtime provides SPDM responder              │
│                      └─> Signs challenges with CDI_2 key         │
└─────────────────────────────────────────────────────────────────┘
```

{% include callout.html type="warning" title="Certificate Validation is Critical" content="Always validate the entire certificate chain from leaf to root. A single compromised certificate breaks the entire trust chain. Implement certificate pinning for known-good roots." %}

<details>
<summary>Advanced: SPDM Session Encryption</summary>

```rust
// After mutual authentication, establish encrypted session
fn establish_secure_session(
    spdm_context: &mut SpdmContext,
    dhe_algorithm: u32,
) -> Result<SecureSession, SpdmError> {
    // Generate ephemeral key pair
    let private_key = EcdhP256::generate_key()?;
    let public_key = private_key.public_key();

    // Send KEY_EXCHANGE
    let key_exchange = SpdmKeyExchangeRequest {
        header: spdm_context.build_header(SPDM_REQUEST_KEY_EXCHANGE),
        measurement_summary_hash_type: 0x00, // All measurements
        slot_id: 0,
        randomness: generate_random(32)?,
        public_key: public_key.to_bytes(),
    };

    let response = spdm_context.send_request(&key_exchange)?;

    // Compute shared secret
    let shared_secret = private_key.diffie_hellman(&response.public_key)?;

    // Derive session keys
    let session_keys = derive_session_keys(
        &shared_secret,
        &key_exchange.randomness,
        &response.randomness,
    )?;

    Ok(SecureSession {
        encryption_key: session_keys.0,
        mac_key: session_keys.1,
        sequence_number: 0,
    })
}
```

</details>

## Quiz

<div class="quiz" data-answer="DICE creates a chain of trust by measuring each firmware layer and generating CDIs using HMAC">
<strong>Q1:</strong> How does DICE establish a chain of trust?

<details>
<summary>Answer</summary>
DICE creates a chain of trust by measuring each firmware layer and generating CDIs (Compound Device Identifiers) using HMAC. Each layer measures the next, creating CDI_n = HMAC(DICE_input, CDI_{n-1}), and issues a certificate signed by the previous CDI.
</details>
</div>

<div class="quiz" data-answer="SPDM uses GET_CERTIFICATE to retrieve the device's certificate chain and CHALLENGE to verify device identity through signature">
<strong>Q2:</strong> How does SPDM verify device identity?

<details>
<summary>Answer</summary>
SPDM uses GET_CERTIFICATE to retrieve the device's certificate chain and CHALLENGE to verify device identity through signature. The device signs a random nonce with its private key, and the verifier validates the signature against the certificate chain.
</details>
</div>

<div class="quiz" data-answer="Measured boot extends PCRs with the hash of each firmware component, creating a tamper-evident log of the boot sequence">
<strong>Q3:</strong> What is the purpose of measured boot?

<details>
<summary>Answer</summary>
Measured boot extends PCRs (Platform Configuration Registers) with the hash of each firmware component, creating a tamper-evident log of the boot sequence. Any modification to firmware will change the PCR values, making tampering detectable.
</details>
</div>

## Exercises

<div class="exercise">
<h3>Exercise 1: DICE Certificate Generation</h3>
<p>Implement a function that generates a DICE certificate given the CDI, TCB info, and public key.</p>

<details>
<summary>Solution</summary>

```rust
use sha2::{Sha256, Digest};
use p256::ecdsa::{SigningKey, Signature};

fn generate_dice_certificate(
    cdi: &[u8; 32],
    tcb_info: &DiceTcbInfo,
    public_key: &[u8; 64],  // ECDSA P-256 public key (uncompressed)
) -> Result<DiceCertificate, DiceError> {
    // 1. Create TCB info bytes
    let tcb_bytes = tcb_info.to_bytes();

    // 2. Create certificate content (without signature)
    let mut cert_content = Vec::new();
    cert_content.extend_from_slice(&tcb_bytes);
    cert_content.extend_from_slice(public_key);

    // 3. Hash the content
    let content_hash = Sha256::digest(&cert_content);

    // 4. Derive signing key from CDI
    let signing_key = derive_signing_key(cdi, b"dice-cert-sign")?;

    // 5. Sign the hash
    let signature = signing_key.sign(&content_hash)?;

    // 6. Assemble certificate
    let cert = DiceCertificate {
        header: DiceCertHeader {
            magic: *b"DIC0",
            version: 1,
            cert_type: 0,  // Device certificate
            length: (cert_content.len() + 64) as u16,
        },
        tcb_info: tcb_info.clone(),
        public_key: *public_key,
        signature: signature.to_bytes().into(),
    };

    Ok(cert)
}

fn derive_signing_key(
    cdi: &[u8; 32],
    context: &[u8],
) -> Result<SigningKey, DiceError> {
    use hkdf::Hkdf;

    let hkdf = Hkdf::<Sha256>::new(Some(context), cdi);
    let mut key_material = [0u8; 32];
    hkdf.expand(b"dice-signing-key", &mut key_material)
        .map_err(|_| DiceError::KeyDerivationFailed)?;

    Ok(SigningKey::from_bytes(&key_material)
        .map_err(|_| DiceError::InvalidKey)?)
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 2: PCR Extension</h3>
<p>Implement a PCR bank that supports extending measurements and reading current values.</p>

<details>
<summary>Solution</summary>

```rust
use sha2::{Sha256, Digest};

pub struct PcrBank {
    pcrs: Vec<Pcr>,
}

struct Pcr {
    index: usize,
    value: [u8; 32],
}

impl PcrBank {
    pub fn new(num_pcrs: usize) -> Self {
        PcrBank {
            pcrs: (0..num_pcrs).map(|i| Pcr {
                index: i,
                value: [0u8; 32],
            }).collect(),
        }
    }

    pub fn extend(&mut self, index: usize, data: &[u8]) -> Result<(), PcrError> {
        if index >= self.pcrs.len() {
            return Err(PcrError::InvalidIndex);
        }

        let pcr = &mut self.pcrs[index];

        // PCR extend: new = SHA256(old || data)
        let mut hasher = Sha256::new();
        hasher.update(pcr.value);
        hasher.update(data);
        pcr.value = hasher.finalize().into();

        Ok(())
    }

    pub fn read(&self, index: usize) -> Result<[u8; 32], PcrError> {
        if index >= self.pcrs.len() {
            return Err(PcrError::InvalidIndex);
        }
        Ok(self.pcrs[index].value)
    }

    pub fn reset(&mut self, index: usize) -> Result<(), PcrError> {
        if index >= self.pcrs.len() {
            return Err(PcrError::InvalidIndex);
        }
        self.pcrs[index].value = [0u8; 32];
        Ok(())
    }

    pub fn extend_and_verify(
        &mut self,
        index: usize,
        data: &[u8],
    ) -> Result<[u8; 32], PcrError> {
        let original = self.read(index)?;
        self.extend(index, data)?;
        let new_value = self.read(index)?;

        // Verify extension changed the value
        if original == new_value && !data.is_empty() {
            return Err(PcrError::ExtensionFailed);
        }

        Ok(new_value)
    }
}

// Test the PCR bank
#[test]
fn test_pcr_extend() {
    let mut bank = PcrBank::new(8);

    // First extension should change from zeros
    let hash1 = Sha256::digest(b"layer1");
    bank.extend(0, &hash1).unwrap();
    let val1 = bank.read(0).unwrap();
    assert_ne!(val1, [0u8; 32]);

    // Second extension should change value
    let hash2 = Sha256::digest(b"layer2");
    bank.extend(0, &hash2).unwrap();
    let val2 = bank.read(0).unwrap();
    assert_ne!(val1, val2);
}
```

</details>
</div>

<div class="exercise">
<h3>Exercise 3: SPDM Challenge Response</h3>
<p>Implement a SPDM responder that handles CHALLENGE requests by signing with the device key.</p>

<details>
<summary>Solution</summary>

```rust
use p256::ecdsa::{SigningKey, Signature};

struct SpdmResponder {
    device_key: SigningKey,
    certificate_chain: Vec<DiceCertificate>,
}

impl SpdmResponder {
    fn new(device_key: SigningKey, cert_chain: Vec<DiceCertificate>) -> Self {
        SpdmResponder {
            device_key,
            certificate_chain: cert_chain,
        }
    }

    fn handle_challenge(
        &self,
        request: &SpdmChallengeRequest,
    ) -> Result<SpdmChallengeResponse, SpdmError> {
        // 1. Validate request
        if request.nonce.len() != 32 {
            return Err(SpdmError::InvalidNonce);
        }

        // 2. Generate responder nonce
        let mut responder_nonce = [0u8; 32];
        getrandom(&mut responder_nonce)
            .map_err(|_| SpdmError::RandomFailed)?;

        // 3. Create challenge data
        let mut challenge_data = Vec::new();
        challenge_data.extend_from_slice(&request.nonce);
        challenge_data.extend_from_slice(&responder_nonce);

        // 4. Sign the challenge
        let signature = self.device_key.sign(&challenge_data);

        // 5. Create opaque data
        let opaque_data = self.create_opaque_data();

        // 6. Build response
        Ok(SpdmChallengeResponse {
            header: SpdmHeader {
                spdm_version: 0x12,
                request_response_code: SPDM_RESPONSE_CHALLENGE_AUTH,
                param1: 0,
                param2: 0,
            },
            slot_id: request.slot_id,
            reserved: 0,
            nonce: responder_nonce,
            opaque_data_length: opaque_data.len() as u16,
            signature_length: signature.to_bytes().len() as u16,
            signature: signature.to_bytes().into(),
            opaque_data,
        })
    }

    fn create_opaque_data(&self) -> Vec<u8> {
        // Opaque data contains version info, capabilities, etc.
        let mut opaque = Vec::new();
        opaque.extend_from_slice(&0x0001u16.to_le_bytes()); // Opaque data format version
        opaque.extend_from_slice(&[0x00; 4]); // Reserved
        opaque
    }
}
```

</details>
</div>

## Summary

In this chapter, you learned:

- **SPDM** provides device authentication through version negotiation, capability exchange, and challenge-response
- **DICE** creates a hardware-rooted chain of trust through measured boot
- **CDI (Compound Device Identifier)** is derived at each boot layer using HMAC
- **Measured boot** extends PCRs with firmware hashes for tamper evidence
- **Certificate chains** bind measurements to cryptographic identities
- **SPDM challenges** verify device identity through signature verification
- **Session encryption** establishes secure communication after authentication

In the next chapter, we'll explore Caliptra — 9elements' Open Source Root of Trust implementation that uses these protocols.

<div class="chapter-nav">
<a href="{{ page.prev }}" class="btn">← Previous: MCTP Deep Dive</a>
<a href="{{ page.next }}" class="btn">Next: Caliptra →</a>
</div>
