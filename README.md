# Zer0Inf — Verifiable AI Inference on Stellar

**Zero-knowledge proof that an ML model produced a specific result — without revealing the model weights or user data.**

Prove that an inference was computed correctly by a registered neural network, while keeping both the model parameters and input data completely private. Built on Noir's UltraHonk proof system and deployed on Stellar Soroban.

## How It Works

1. **Model owner** deploys a Soroban contract and registers a hash of their model weights (only the SHA-256 hash is stored on-chain)
2. **User** runs inference on their private data through a Noir circuit that mirrors the neural network architecture
3. **Prover** generates an UltraHonk ZK proof that the inference was computed correctly against those exact weights
4. **Verifier contract** on Stellar checks the proof and stores the result (approve/deny + confidence)

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
| **Circuit** | Noir 1.0.0-beta.22 (UltraHonk proof system) |
| **Prover** | TypeScript + Barretenberg bb.js 6.x |
| **On-chain** | Soroban smart contract (Rust SDK v22) |
| **Blockchain** | Stellar Testnet |
| **CLI** | Node.js 20+ with @stellar/stellar-sdk |

## Neural Network Architecture

Tiny binary classifier for the demo:

```
Input(8) → Hidden(6, ReLU) → Output(1, sigmoid approximation)
```

- **48 hidden weights** + **6 output weights** = 54 parameters total
- Fixed-point arithmetic with 10-bit precision (scale = 1024)
- Matrix multiplication as field operations
- ReLU via Noir's native `max(x, 0)`
- Sigmoid via degree-4 Taylor polynomial approximation in finite field

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

# Run everything end-to-end
npm run demo
```

### Prerequisites

- **Node.js** ≥ 20
- **Noir** — `cargo install --git https://github.com/noir-lang/noir nargo`
- **Stellar CLI** — `npm install -g @stellar/stellar-cli` (for on-chain deployment)
- **Rust toolchain** — `cargo build --release` in the contract directory

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

# Deploy contract to testnet (prints instructions)
node prover/dist/cli/index.js deploy --secret <your_secret_key>

# Submit proof to deployed contract
node prover/dist/cli/index.js submit --proof output/proof.json \
  --contract-id <contract_id> --secret <your_secret_key>

# Help
node prover/dist/cli/index.js help
```

### CLI Workflow

```
  register    →   infer          →   verify        →   submit
  (hash       (ZK proof     (check proof      (deploy contract
  weights)      generation)    structure)        + submit proof)

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
│   ├── src/proof/generate.ts  ← Noir witness + UltraHonk proof gen
│   ├── src/onchain/index.ts   ← Stellar SDK contract interaction
│   └── src/types/index.ts     ← Shared type definitions
│
├── contract/               ← Soroban smart contract (Rust)
│   └── src/lib.rs          ← 7 functions: register, submit_inference, queries
│
├── data/                   ← Demo sample data
│   ├── sample-inference.json  ← Normalized financial features
│   └── sample-weights.json    ← 48 hidden + 6 output weights
│
├── output/                 ← Generated artifacts (proof.json, model.json)
├── package.json            ← Root workspace config
└── tsconfig.json           ← TypeScript base config
```

## Privacy Guarantees

- **Model weights:** Never revealed to anyone. Only a SHA-256 hash is stored on-chain as a commitment
- **User inputs:** Processed entirely locally. Used to generate the proof but never sent anywhere
- **Intermediate computations:** Zero-knowledge — nothing leaked from the UltraHonk proof
- **On-chain data:** Only the inference result (approve/deny + confidence score) is publicly recorded

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
