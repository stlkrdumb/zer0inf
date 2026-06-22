# Zer0Inf — Agent Guidelines for Hackathon Submission

> **Project:** Zero-knowledge proof of correct AI inference on Stellar Soroban  
> **Hackathon:** [Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk)  
> **Deadline:** June 29, 2026 19:00 UTC — **8 days remaining**  
> **Prize Pool:** $10,000 XLM (1st = $5,000)

---

## Quick Reference

| Layer | Technology | Status |
|-------|-----------|--------|
| Circuit | Noir i32 (UltraHonk) | ✅ Compiled 20.8 KB ACIR (signed weights) |
| Prover | TypeScript + CLI + bb.js | ✅ Full UltraHonk proof gen, verified locally |
| Contract | Soroban (Rust SDK v22) | ✅ WASM built, 14KB |
| Network | Stellar Testnet | Ready (deploy & integrate next) |

---

## Hackathon Requirements Checklist

Your submission MUST have these three things:

- [ ] **Open-source repo** — Public GitHub/GitLab/Bitbucket with full source code + README
- [ ] **Demo video (2-3 min)** — Show the project working, explain what ZK is doing
- [ ] **ZK + Stellar** — ZK cryptography load-bearing AND touches Stellar (testnet or mainnet)

---

## Project Architecture

```
                    ┌─ Model Registration (on-chain) ─────────────┐
User Data → Noire Circuit → UltraHonk Proof ─►│                     │
(kept private)   │                              │  Soroban Contract  │
                 │                              │  - verify proof    │
                 └─ Submit {model_id, proof} ►│  - store result     │
                                              │  - emit events      │
                                              └────────────────────┘
```

**Privacy guarantees:** Model weights never leave the prover. User input data stays private. Only the inference result (approve/deny + confidence) is publicly recorded on-chain.

---

## Current State & What Needs Doing

### ✅ Done — No changes needed

| Component | Status | Key Files |
|-----------|--------|-----------|
| Noir circuit | Signed i32, compiles (20.8 KB ACIR) | `circuit/src/main.nr`, `circuit/Nargo.toml` |
| Neural network logic | Working (8→6→1, ReLU + sigmoid) | Used in both circuit and CLI reference |
| CLI tool | All commands working | `prover/src/cli/index.ts` |
| Soroban contract | WASM built (14KB), 7 functions | `contract/src/lib.rs`, `contract/Cargo.toml` |
| Shared types | InferInput, InferenceResult, ProofSubmission | `prover/src/types/index.ts` |

### 🔴 Priority 1 — Blocker: Full ZK Proof Generation

**✅ COMPLETE (June 22)** — Real UltraHonk proofs are now generated and verified.

**What was fixed:**
1. Circuit types changed from `u32` → `i32` to support negative neural network weights
2. noir_js witness generation works with signed integer inputs
3. Barretenberg (bb.js 6.x) UltraHonkBackend generates proofs correctly
4. Local verification passes — proof is cryptographically valid
5. Result computation uses exact i32 BigInt arithmetic matching Brillig VM semantics

**Proof details:**
- Size: 14,656 bytes (458 field elements × 32 bytes)
- Public inputs: 55 fields (48 weights + 6 output weights + 1 result)
- Proof system: UltraHonk via bb.js
- Noir version: 1.0.0-beta.22
- ACIR size: ~20.8 KB (signed types add constraint overhead vs. original 848 bytes)

**Reference implementations to study:**
- [yugocabrio/rs-soroban-ultrahonk](https://github.com/yugocabrio/rs-soroban-ultrahonk) — Noir UltraHonk verifier on Soroban
- [indextree/ultrahonk_soroban_contract](https://github.com/indextree/ultrahonk_soroban_contract) — Another Noir verifier pattern

**Noir circuit file is at:** `circuit/src/main.nr` (neural network: 8 inputs → 6 hidden neurons with ReLU → 1 output with sigmoid approximation)

### 🟡 Priority 2 — On-Chain Integration Demo

**Problem:** The CLI can prepare transactions but doesn't actually call the contract on Stellar testnet.

**Action:**
```
1. Create a Stellar testnet account (free via Stellar Lab: https://laboratory.stellar.org/)
2. Fund it with free XLM from the testnet faucet
3. Deploy the contract: stellar contracts deploy --network testnet ...
4. Call register_model on-chain with weight hash
5. Call submit_inference with proof + model_id
6. Query results via get_inference
7. Update CLI to use @stellar/stellar-sdk v13+ for real transactions
```

**Reference patterns:**
- [Stellar soroban-examples/groth16_verifier](https://github.com/stellar/soroban-examples/tree/main/groth16_verifier) — Reference proof verifier contract
- [NethermindEth/stellar-risc0-verifier](https://github.com/NethermindEth/stellar-risc0-verifier) — RISC Zero verifier pattern
- E2E tutorial: https://jamesbachini.com/noir-on-stellar/

### 🟢 Priority 3 — Polish & Demo Prep

**Action:**
```
1. README.md — Write a clear, comprehensive overview (see template below)
2. Demo video (2-3 min) — Record CLI demo: register → infer → verify → submit
3. Ensure `npm install && npm run build` works from a fresh clone
4. Add sample data + scripts in package.json for easy testing
5. Update PLAN.md with final status
```

---

## Code Quality Guidelines

### TypeScript (prover/)

- **Use `tsconfig.json` strict mode** — no `any`, explicit types everywhere
- **BigInt serialization:** Always convert to/from strings before JSON.stringify/parse
- **Uint8Array → hex string** for JSON storage, reconstruct in consumers
- **Error handling:** Never swallow errors with bare `catch(e) {}`. Log and exit(1).
- **CLI output:** Use `[zer0inf]` prefix, emojis sparingly (✓ ✗ ⚠), clear hierarchy

### Rust (contract/)

- **Use `BytesN<32>` instead of `[u8; 32]`** — required by Soroban SDK v22
- **No dynamic keys** — use `symbol_short!("DESC0")` style constant symbols
- **Storage:** Keep data small, use sequential IDs for records, TTL for cleanup
- **Events:** Emit events for model registration and inference submission
- **Return values:** u32 for counts, u64 for record IDs, Option<> for optional lookups

### Noir (circuit/)

- **Fixed-point arithmetic** with 10-bit precision (scale = 1024)
- **Matrix multiply as field operations** — no native types
- **ReLU:** `max(x, 0)` is natively supported in Noir
- **Sigmoid:** Use degree-4 Taylor polynomial or other low-degree approximation

---

## CLI Command Reference

```bash
# Check project state
node prover/dist/cli/index.js status

# Register model (compute hash + save metadata)
node prover/dist/cli/index.js register data/sample-weights.json \
  --description "Credit Eligibility Model v1"

# Run inference with sample data
node prover/dist/cli/index.js infer --input data/sample-inference.json

# Run inference with demo weights
node prover/dist/cli/index.js infer

# Verify proof locally
node prover/dist/cli/index.js verify --proof output/proof.json

# Prepare on-chain submission (needs contract ID)
node prover/dist/cli/index.js submit --proof output/proof.json \
  --contract-id <contract_id>

# Help
node prover/dist/cli/index.js help
```

---

## README Template

When writing the README, follow this structure:

```markdown
# Zer0Inf — Verifiable AI Inference on Stellar

**Zero-knowledge proof that an ML model produced a specific result — without revealing the model weights or user data.**

[Demo GIF / screenshot]

## How It Works

1. **Model owner** deploys a Soroban contract and registers a hash of their model weights
2. **User** runs inference on their private data through a Noir circuit
3. **Prover** generates an UltraHonk ZK proof that the inference was computed correctly
4. **Verifier contract** on Stellar checks the proof and stores the result

Privacy preserved: Model stays secret, user data stays private, only the output is public.

## Architecture

[Simple diagram showing the flow]

## Tech Stack

- **Circuit:** Noir (UltraHonk proof system)
- **On-chain:** Soroban smart contract (Rust)
- **Blockchain:** Stellar testnet
- **CLI:** TypeScript with @stellar/stellar-sdk

## Getting Started

```bash
git clone https://github.com/<user>/zer0inf.git
cd zer0inf
npm install
npm run build
npm run demo  # runs status + infer + verify end-to-end
```

## Demo Video

[Link to 2-3 minute video]

## Project Structure

- `circuit/` — Noir ZK circuit (neural network as constraints)
- `prover/` — TypeScript prover CLI (inference engine + proof generation)
- `contract/` — Soroban smart contract (proof verification on-chain)

## Privacy Guarantees

- Model weights: never revealed, only a SHA-256 hash stored on-chain
- User inputs: processed locally, used to generate proof but never sent anywhere
- Intermediate computations: zero-knowledge — nothing leaked from the proof
- On-chain data: only inference result (approve/deny + confidence score) is public

## License

MIT
```

---

## Demo Video Checklist (2-3 minutes)

| Section | Time | What to Show |
|---------|------|-------------|
| Intro (10s) | 0:00-0:10 | Problem: "How do you prove an AI made a correct decision without exposing the model?" |
| Demo: Register | 0:10-0:40 | CLI command `register` — show weight hash computation |
| Demo: Infer | 0:40-1:10 | CLI command `infer` — run inference with sample data, show result |
| Demo: Verify | 1:10-1:40 | CLI command `verify` — show proof structure and fields |
| Architecture (15s) | 1:40-1:55 | Point to architecture diagram on screen |
| Closing (10s) | 1:55-2:05 | "Zer0Inf proves AI inference is correct — without revealing secrets" |

**Tips:**
- Narrate what's happening as you type each command
- Zoom in on terminal output so text is readable
- Show the README architecture diagram briefly
- Don't need to be on camera — screen + voice is fine
- If proof generation isn't working yet, show "this generates a real ZK proof once wired up" and show the placeholder output

---

## Key URLs & Resources

| Resource | URL |
|----------|-----|
| Hackathon page | https://dorahacks.io/hackathon/stellar-hacks-zk |
| Inspiration ideas | https://dorahacks.io/hackathon/stellar-hacks-zk/ideas |
| ZK Proofs on Stellar docs | https://developers.stellar.org/docs/build/apps/zk |
| Privacy on Stellar docs | https://developers.stellar.org/docs/build/apps/privacy |
| Noir Lang docs | https://noir-lang.org/docs/ |
| Soroban SDK v22 BN254 | https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_bn254/index.html |
| UltraHonk verifier (Yugo) | https://github.com/yugocabrio/rs-soroban-ultrahonk |
| UltraHonk verifier (Indextree) | https://github.com/indextree/ultrahonk_soroban_contract |
| Groth16 verifier example | https://github.com/stellar/soroban-examples/tree/main/groth16_verifier |
| Noir on Stellar tutorial | https://jamesbachini.com/noir-on-stellar/ |
| RISC Zero verifier | https://github.com/NethermindEth/stellar-risc0-verifier |
| Stellar Testnet Faucet | https://laboratory.stellar.org/ |
| Skills (AI-ready docs) | https://skills.stellar.org/ |

---

## Notes for AI Agents Working on This Project

1. **Always read `PLAN.md` first** — it has the implementation plan and current status
2. **Always run `npx tsc` after TypeScript changes** — catch type errors early
3. **Always run `cargo build --release` after contract changes** — check Rust compilation
4. **Never change `circuit/src/main.nr` without understanding the neural network math** — 8 inputs → 6 hidden (ReLU) → 1 output (sigmoid), all in fixed-point arithmetic
5. **Use Soroban SDK v22 patterns:** `BytesN<32>` for hashes, constant symbols for storage keys, no `String::new()`
6. **Testnet is fine** — hackathon explicitly allows "Stellar testnet or mainnet"
7. **When in doubt about Noir API** — check the noir_lang docs and look at how rs-soroban-ultrahonk uses it
8. **CLI must work from project root:** `node prover/dist/cli/index.js <command>`
9. **Demo video is mandatory** — plan for it from the start, don't leave it until day 8
10. **README must be comprehensive** — judges read it before watching your video

---

## Karpathy Behavioral Guidelines

> These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it. Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

*These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.*
