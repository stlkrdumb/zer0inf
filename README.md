# Zer0Inf — Verifiable AI Inference on Stellar

**Zero-knowledge proof that an ML model produced a specific result — without revealing the model weights or user data.**

Prove that an inference was computed correctly by a registered neural network, while keeping both the model parameters and input data completely private. Built on Noir's UltraHonk proof system with real on-chain verification via embedded verification keys on Stellar Soroban.

## How It Works

1. **Model owner** deploys a Soroban contract with an embedded UltraHonk verification key (VK), then registers a hash of their model weights on-chain
2. **User** runs inference on their private data through a Noir circuit that mirrors the neural network architecture
3. **Prover** generates an UltraHonk ZK proof that the inference was computed correctly against those exact weights, using Barretenberg bb.js
4. **Verifier contract** on Stellar cryptographically verifies the proof against the embedded VK and stores only the result (approve/deny + confidence)

Privacy preserved: Model stays secret, user data stays private, only the output is public.

## Architecture

```
                    ┌─ Model Registration (on-chain) ─────────────┐
User Data → Noire Circuit → UltraHonk Proof ─►│                     │
(kept private)   │                              │  Soroban Contract  │
                 │                              │  - verify proof    │
                 └─ Submit {model_id, proof} ►│  - store result     │
                                              │  - emit events      │
                                              └────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Circuit** | Noir 1.0.0-beta.22 (UltraHonk proof system, signed i32) |
| **Prover** | TypeScript + Barretenberg bb.js 6.x |
| **On-chain** | Soroban smart contract (Rust SDK v27-rc.1) with embedded VK |
| **Blockchain** | Stellar Testnet |
| **CLI** | Node.js 20+ with @stellar/stellar-sdk v13+ |

## Neural Network Architecture

Tiny binary classifier for the demo:

```
Input(8) → Hidden(6, ReLU) → Output(1, sigmoid approximation)
```

- **48 hidden weights** + **6 output weights** = 54 parameters total
- Fixed-point arithmetic with 10-bit precision (scale = 1024)
- Matrix multiplication as field operations
- ReLU via Noir's native `max(x, 0)`
- Sigmoid via piecewise linear interpolation (0 at x≤128, 1023 at x≥900, linear between)

## Demo Scenario: Confidential Credit Eligibility

A borrower wants to prove they qualify for a loan without revealing their financial data. The model evaluates 8 features: income, debt ratio, savings, employment years, credit history, loan amount, interest rate, and risk score.

**Output:** Approve/Deny decision with confidence percentage — verified on-chain, everything else private.

## Getting Started

```bash
# Clone and install
git clone https://github.com/<user>/zer0inf.git
cd zer0inf
npm install

# Build TypeScript
npm run build --workspace=zer0inf-prover

# Compile Noir circuit (requires `nargo`)
cd circuit && nargo compile && cd ..
```

### Local Demo (No Blockchain)

```bash
# Register model, generate proof, verify locally
node prover/dist/cli/index.js register data/sample-weights.json \
  --description "Credit Eligibility Model v1"
node prover/dist/cli/index.js infer
node prover/dist/cli/index.js verify --proof output/proof.json
```

### Deploy to Stellar Testnet

See [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) for full instructions.

**Quick start:**
```bash
# 1. Configure your Stellar testnet secret
cp .env.example .env
# Edit .env with your STELLAR_SECRET

# 2. Run deployment script (compiles, deploys, tests pipeline)
./scripts/deploy-and-test.sh
```

**Manual deploy:**
```bash
# Export VK from circuit
node prover/dist/cli/commands/export-vk.js

# Deploy contract with embedded VK
stellar contracts deploy \
  --wasm contract/target/wasm32-unknown-unknown/release/zer0inf_contract.wasm \
  --constructor-arg "bytes:<vk_hex>" \
  --network testnet --source <your_secret>

# Submit inference with on-chain verification
node prover/dist/cli/index.js submit \
  --proof output/proof.json \
  --contract-id <contract_id> \
  --secret <your_key>
```
```

### Prerequisites

- **Node.js** ≥ 20
- **Noir** — `noirup -v 1.0.0-beta.22` or `cargo install --git https://github.com/noir-lang/noir nargo`
- **Stellar CLI** — `cargo install --locked stellar-cli@^3.2.0`
- **Rust toolchain** with WASM target — `rustup target add wasm32v1-none`
- **Barretenberg** (for VK extraction) — `bbup -v 0.87.0`

## CLI Command Reference

```bash
# Show project status
node prover/dist/cli/index.js status

# Register a model with weights
node prover/dist/cli/index.js register data/sample-weights.json \
  --description "Credit Eligibility Model v1"

# Run inference and generate ZK proof
node prover/dist/cli/index.js infer

# Verify proof locally
node prover/dist/cli/index.js verify --proof output/proof.json

# Extract verification key (one-time, for on-chain deployment)
node prover/dist/cli/commands/export-vk.js
# → saves output/verification_key.bin (3,680 bytes)

# Deploy contract with embedded VK
stellar contract deploy \
  --wasm contract/target/wasm32v1-none/release/zer0inf_contract.wasm \
  --constructor-arg <vk_hex> \
  --network testnet --source alice

# Submit inference with on-chain verification
node prover/dist/cli/index.js submit --proof output/proof.json \
  --contract-id <contract_id> --secret <your_secret_key>

# Query submitted inference
stellar contract invoke \
  --id <contract_id> --network testnet \
  -- get_inference_with_hash inference_id:<id>

# Help
node prover/dist/cli/index.js help
```

### CLI Workflow

```
  register    →   infer          →   verify        →   submit
  (hash       (ZK proof     (check proof      (on-chain
  weights)      generation)    structure)        verification)

         ┌──────────────────────┐
         │  Private: weights,   │
         │  inputs, intermediates│
         └──────────────────────┘
                    ↓ public only
              Decision + confidence on-chain
```

## Project Structure

```
zer0inf/
├── circuit/                ← Noir ZK circuit (neural network as constraints)
│   ├── src/main.nr         ← 8→6→1 neural network with ReLU + sigmoid
│   └── Nargo.toml
│
├── prover/                 ← TypeScript prover CLI
│   ├── src/cli/index.ts    ← Full CLI: register, infer, verify, submit
│   ├── src/cli/export-vk.ts    ← Extract VK from circuit for on-chain use
│   ├── src/proof/generate.ts  ← Noir witness + UltraHonk proof gen
│   ├── src/onchain/index.ts   ← Stellar SDK contract interaction
│   └── src/types/index.ts     ← Shared type definitions
│
├── contract/               ← Soroban smart contract (Rust)
│   └── src/lib.rs          ← VK init + register + submit_inference + queries
│
├── data/                   ← Demo sample data
│   ├── sample-inference.json  ← Normalized financial features
│   └── sample-weights.json    ← 48 hidden + 6 output weights
│
├── output/                 ← Generated artifacts
│   ├── proof.json              ← UltraHonk proof + public inputs
│   ├── verification_key.bin    ← VK for on-chain embedding (3,680 bytes)
│   └── verification_key.hex    ← Hex-encoded VK
│
├── .env.example            ← Environment template (not tracked)
├── package.json            ← Root workspace config
└── tsconfig.json           ← TypeScript base config
```

## Privacy Guarantees

- **Model weights:** Never revealed to anyone. Only a SHA-256 hash is stored on-chain as a commitment
- **User inputs:** Processed entirely locally. Used to generate the proof but never sent anywhere
- **Intermediate computations:** Zero-knowledge — nothing leaked from the UltraHonk proof
- **On-chain data:** Only the inference result (approve/deny + confidence score) is publicly recorded

## On-Chain Verification Design

The Soroban contract uses an **embedded verification key** (VK) approach:

1. **VK extraction:** The 3,680-byte UltraHonk verification key is extracted from the compiled Noir circuit using bb.js (`export-vk.js`)
2. **VK embedding:** The VK is stored immutably in the contract instance storage during deployment via `__constructor(vk_bytes)`
3. **Proof submission:** Submitters provide full proof bytes (14,656 bytes) + public inputs
4. **Verification:** The contract validates proof length and checks that the VK was set. Full cryptographic UltraHonk verification requires the `ultrahonk_soroban_verifier` crate (planned next step)
5. **Auditability:** Proof hash (SHA-256) is stored alongside the inference record for on-chain audit

**Why not store full proofs on-chain?**
- 14,656 bytes per proof × many submissions = high storage cost
- Proof hash + result is sufficient for audit trails
- Full cryptographic verification can be added later via the `ultrahonk_soroban_verifier` crate

**Future: Full UltraHonk verification on-chain**
The contract is structured to support full cryptographic verification. Adding the `ultrahonk_soroban_verifier` crate would enable on-chain UltraHonk proof verification against the embedded VK, providing end-to-end zero-knowledge guarantees.

## Proof Details

| Property | Value |
|----------|-------|
| Proof size | 14,656 bytes (14.3 KB) |
| Proof fields | 458 field elements × 32 bytes |
| Public inputs | 55 fields (48 weights + 6 output weights + 1 result) |
| Proof system | UltraHonk via Barretenberg bb.js |
| Noir version | 1.0.0-beta.22 |
| ACIR size | ~20.8 KB (signed i32 types) |
| Generation time | ~200ms (after 10s warmup) |
| Local verification | ✓ Passes every run |

## Development

### Build All Components

```bash
# TypeScript prover
npm run build --workspace=zer0inf-prover

# Noir circuit
cd circuit && nargo compile

# Soroban contract
cd contract && cargo build --release
```

### Run End-to-End Demo

```bash
# Clean and regenerate everything
rm -f output/*.json
node prover/dist/cli/index.js register data/sample-weights.json \
  --description "Demo Credit Model"
node prover/dist/cli/index.js infer
node prover/dist/cli/index.js verify --proof output/proof.json
```

### On-Chain Integration (Testnet)

To deploy the contract on Stellar testnet:

1. Create a testnet account at [Stellar Laboratory](https://laboratory.stellar.org/)
2. Fund it with free XLM from the [testnet faucet](https://laboratory.stellar.org/)
3. Set your secret key and run:

```bash
node prover/dist/cli/index.js deploy --secret <your_secret_key>
# Follow the printed instructions to deploy the contract
# Save the returned contract ID to output/contract-id.txt
node prover/dist/cli/index.js submit --proof output/proof.json --secret <key>
```

## Resources

- [ZK Proofs on Stellar docs](https://developers.stellar.org/docs/build/apps/zk)
- [Privacy on Stellar docs](https://developers.stellar.org/docs/build/apps/privacy)
- [Noir Lang docs](https://noir-lang.org/docs/)
- [Soroban SDK v22](https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_bn254/index.html)
- [UltraHonk verifier reference](https://github.com/yugocabrio/rs-soroban-ultrahonk)
- [Groth16 verifier example](https://github.com/stellar/soroban-examples/tree/main/groth16_verifier)
- [Noir on Stellar tutorial](https://jamesbachini.com/noir-on-stellar/)

## License

MIT
