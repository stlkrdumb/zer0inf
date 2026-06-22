# Zer0Inf — Project Plan & Progress

> **Zero-knowledge proof of correct AI inference on Stellar Soroban**
>
> Prove that a result was produced by a specific ML model without revealing
> the model's weights, your input data, or any intermediate computations.

---

## Architecture Overview

```
┌─────────────── Model Registration (on-chain) ───────────────┐
│                                                              │
│  Model Owner → Compute weight hash → Deploy Soroban contract │
│                 Store {model_hash, version, description}      │
│                                                              │
├──────────────── Inference + Proof Generation (off-chain) ────┤
│                                                              │
│  User Data (private) → Noir Circuit (AI model) → UltraHonk  │
│                          produces proof π                    │
│                                                              │
├────────────── Verification (on-chain) ───────────────────────┤
│                                                              │
│  Submit {proof, model_id} → Soroban verifier contract        │
│          ↓                                                   │
│  Check: model exists + proof valid + output correct          │
│          ↓                                                   │
│  Store result, emit event                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Circuit language | Noir (ZK DSL) |
| Prover backend | UltraHonk / Barretenberg |
| On-chain contract | Soroban (Rust) |
| Blockchain | Stellar Testnet |
| CLI tooling | TypeScript (Node.js) |
| Future web UI | React + TypeScript |

### Project Structure

```
zer0inf/
├── PLAN.md                 ← You are here
├── README.md               ← Project overview & usage
├── package.json            ← Root workspace config
├── tsconfig.json           ← TS base config
│
├── circuit/                ← Noir AI model circuits
│   └── src/
│       └── main.nr         ← Neural network as ZK circuit
│
├── prover/                 ← TypeScript prover + CLI
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── cli/            ← Command-line interface
│       │   └── index.ts    ← Entry point (register, infer, verify)
│       ├── proof/          ← Proof generation logic
│       │   ├── generate.ts ← Run Noir compiler + UltraHonk prover
│       │   └── types.ts    ← Proof data structures
│       └── types/          ← Shared type definitions
│           └── index.ts    ← InferRequest, ModelRegistration, etc.
│
└── contract/               ← Soroban smart contract (Rust)
    ├── Cargo.toml
    └── src/
        ├── lib.rs          ← Contract entry points
        ├── model.rs        ← Model registration & storage
        └── verifier.rs     ← Proof verification logic
```

---

## Implementation Plan

### Phase 1 — Circuit (Days 1-2)
- [ ] **Day 1:** Implement tiny neural network in Noir
  - [ ] Define model architecture: input(8) → hidden(6, ReLU) → output(1, sigmoid)
  - [ ] Implement matrix multiplication as field operations
  - [ ] Implement polynomial approximations for ReLU and sigmoid
  - [ ] Compile circuit successfully with `nargo compile`
  - [ ] Write unit tests inside the circuit
- [ ] **Day 2:** Generate proving/verifying keys
  - [ ] Run `nargo prove` to generate ProvingKey.bin
  - [ ] Extract VerifyingKey for on-chain deployment

### Phase 2 — Prover (Days 3-4)
- [ ] **Day 3:** Set up UltraHonk proof generation
  - [ ] Initialize TypeScript prover package
  - [ ] Wire up Noir compiler from CLI (`@noir-lang/noir_js`)
  - [ ] Implement proof generation function
  - [ ] Test with known inputs → verify output matches manual computation
- [ ] **Day 4:** Connect to Stellar
  - [ ] Set up Stellar SDK client (testnet)
  - [ ] Implement model registration call
  - [ ] Implement verification submission call
  - [ ] End-to-end test: register model → infer → submit proof → verify on-chain

### Phase 3 — Contract (Days 4-5)
- [ ] **Day 4:** Build Soroban verifier contract
  - [ ] Scaffold Rust contract with `stellar-cli`
  - [ ] Implement `register_model` — store model hash + metadata
  - [ ] Implement `verify_inference` — verify UltraHonk proof
  - [ ] Implement `get_result` — query past verifications
- [ ] **Day 5:** Test contract
  - [ ] Unit tests for all contract functions
  - [ ] Integration test with local Stellar network
  - [ ] Deploy to testnet

### Phase 4 — Polish & Demo (Days 6-8)
- [ ] **Day 6:** CLI polish
  - [ ] Clean command-line interface
  - [ ] Add helpful error messages
  - [ ] README with usage examples
- [ ] **Day 7:** Demo video
  - [ ] Record end-to-end demo: register → infer → verify
  - [ ] Show architecture diagrams
  - [ ] Explain ZK privacy guarantees
- [ ] **Day 8:** Buffer + submission
  - [ ] Fix any issues
  - [ ] Ensure fresh clone builds and works
  - [ ] Submit to hackathon

---

## Current Status

**Started: June 21, 2026**
**Deadline: June 29, 2026 (8 days)**
**Current Phase: Day 1+ — All foundations complete, CLI functional**

---

### ✅ Completed (June 21)

#### Phase 1 — Circuit
- [x] Noir circuit implemented with neural network (8 inputs → 6 hidden → 1 output)
- [x] Fixed-point arithmetic (10-bit, scale=1024)
- [x] Matrix multiplication as field operations
- [x] Circuit compiles: `nargo compile` → 848 bytes ACIR
- [x] Demo weights: 48 hidden + 6 output = 54 parameters

#### Phase 2 — Prover + CLI
- [x] TypeScript prover package scaffolded (`prover/`)
- [x] Neural network inference engine (reference implementation)
- [x] Shared type definitions (InferInput, InferenceResult, ProofSubmission, etc.)
- [x] Full CLI tool with working commands:
  - `register <weights.json>` — Compute weight hash + save metadata
  - `infer` — Run inference, generate proof data (55 public inputs)
  - `verify --proof` — Display and verify proof locally
  - `submit --proof --contract-id` — Prepare on-chain submission
  - `status` — Check project state (circuit, contract, outputs)
- [x] Proof data serialization with BigInt support (JSON-safe)

#### Phase 3 — Contract (Rust/Soroban)
- [x] Soroban smart contract compiled successfully
- [x] WASM output: 14KB (`zer0inf_contract.wasm`)
- [x] 7 exported functions: register, submit_inference, get_model, get_inference, list_models, get_model_count
- [x] Storage via BytesN<32> hashes and sequential records
- [x] Persistent storage with TTL management (1209600→2592000 ledgers)

#### Phase 4 — CLI Polish
- [x] Clean help system with examples
- [x] Proper error handling (file not found, missing required args)
- [x] Demo input generation (8 credit eligibility features)
- [x] Status dashboard showing all build artifacts

---

### 🔄 Remaining Tasks
- [x] Wire up `@noir-lang/noir_js` + `@aztec/bb.js` for real proof generation
  - Circuit types: signed i32 (supports negative weights)
  - noir_js executes witness → Barretenberg generates UltraHonk proof
  - Local verification passes on every run
  - Proof size: 14,656 bytes (458 field elements)

#### Phase 3 — On-Chain Integration ✅ COMPLETE
- [x] Real UltraHonk proofs submitted on-chain via SDK v16
- [x] Contract interactions verified: register, submit_inference, get_inference, get_model_count

---

### ⏳ Remaining — Hackathon Submission

#### Phase 4 — Demo Video & Polish
- [ ] Record demo video (2-3 min): show end-to-end flow
  - Register model → run inference → generate ZK proof → submit on-chain
- [ ] Verify `README.md` is comprehensive and up-to-date
- [ ] Ensure fresh clone builds: `npm install && npm run build`
- [ ] Submit to hackathon (DoraHacks: Stellar Hacks: Real-World ZK)

---

---

### Recent Changes (June 22)

| Change | Before | After |
|--------|--------|-------|
| Circuit types | `u32` (unsigned) | `i32` (signed) |
| ACIR size | ~848 bytes | 20,788 bytes |
| Proof size | 0 bytes (stub) | 14,656 bytes |
| Noir version | beta.9 | beta.22 |
| bb.js version | — | 6.x (UltraHonkBackend) |
| Local verification | N/A | ✓ Passes every run |

**Why circuit grew:** Signed i32 types require more constraint overhead in Brillig VM compared to raw unsigned u32. The neural network logic is identical — same 8→6→1 architecture, ReLU + sigmoid approximation.

---

### ✅ Updated: June 22 (Full End-to-End Pipeline Complete)

#### Phase 2 — UltraHonk Integration ✅ COMPLETE
- [x] Real UltraHonk proofs generated and verified locally (every run)
- [x] `npm run demo` — full end-to-end: register → infer → verify → status
- [x] TypeScript strict build clean (no errors, no warnings)
- [x] CLI imports cleaned (removed unused `registerModel`, `buildDeployCommand`)
- [x] Rust contract builds with zero warnings

#### Phase 3 — On-Chain Integration ✅ COMPLETE
- [x] `stellar-cli` upgraded to v27.0.0 (Protocol 27 compatibility)
- [x] Contract rebuilt with Soroban SDK v27 (`27.0.0-rc.1`)
- [x] Contract deployed to Stellar Testnet: `CCATLOJE5E4D5LKSD5ZVVGNLIK42CMOY2DJ65MRF7PFRBKEUAPHQ4B2X`
- [x] TypeScript bindings generated from contract ABI (`prover/src/client/`)
- [x] On-chain model registration works (2 models registered)
- [x] On-chain inference submission works with UltraHonk proof
- [x] Real ZK proof submitted: TX hash `8a50360577a...` (proof verified on-chain)
- [x] Generated Client class handles all contract methods with proper types
- [x] Correct stellar key in `.env` for SDK integration

#### Phase 4 — Polish ✅ COMPLETE
- [x] Comprehensive README.md with architecture, CLI reference, privacy guarantees
- [x] Clean build from scratch: `npm install && npm run build && cd circuit && nargo compile`
- [x] Demo script: `npm run demo` works end-to-end
- [ ] **Remaining:** Demo video (2-3 min) — record CLI demo flow
  - Intro (10s): Problem statement
  - Register (30s): Show hash computation
  - Infer (30s): Run inference + proof generation
  - Verify (30s): Show proof structure
  - Architecture (15s): Point to diagram
  - Closing (10s): Summary statement

---

## Notes & Decisions

- **Model choice:** Tiny binary classifier (~20 parameters) for the demo
- **Demo scenario:** Confidential credit eligibility prediction
- **Input features:** income, debt_ratio, savings, employment_years, credit_history_months, loan_amount, interest_rate, risk_score
- **Output:** Binary (0 = deny, 1 = approve) + confidence score
- **Activation approximations:** ReLU via `max(x, 0)`, sigmoid via degree-4 Taylor polynomial in finite field
- **Noir version:** Latest stable from `@noir-lang/noir_js`
- **Proof system:** UltraHonk (compatible with existing Soroban verifier at `rs-soroban-ultrahonk`)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Noir circuit too slow / bloated | High | Keep model tiny (~20 params), use low-degree polynomials |
| UltraHonk integration issues on Stellar | Medium | `rs-soroban-ultrahonk` already exists as reference; study it first |
| Polynomial approximation doesn't converge | High | Use well-known approximations, test offline before circuit |
| Time runs out for contract testing | Low | Start contract code in parallel with prover if needed |
