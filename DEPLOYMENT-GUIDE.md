# Zer0Inf — Testnet Deployment Guide

## Prerequisites

1. **Stellar Testnet Account** with XLM balance
   - Get from: https://laboratory.stellar.org/
   - Or use existing account (check `.env` file)

2. **Stellar CLI** (v27+)
   ```bash
   which stellar
   stellar --version  # Should be 27.0.0+
   # If not installed: https://developers.stellar.org/docs/getting-started/setup
   ```

3. **Rust Toolchain** (1.84+)
   ```bash
   rustc --version  # Must be 1.84+
   rustup target add wasm32v1-none
   ```

4. **Node.js** (20+) and dependencies
   ```bash
   cd prover && npm install
   ```

## Quick Deploy (Recommended)

```bash
# 1. Configure .env with your Stellar testnet secret
cp .env.example .env
# Edit .env: set STELLAR_SECRET to your testnet key

# 2. Run deployment script
./scripts/deploy-and-test.sh
```

The script will:
- Compile the contract (WASM)
- Deploy to testnet with embedded VK
- Test register, infer, and submit commands

## Manual Deploy Steps

### Step 1: Compile Contract

```bash
cd contract
cargo build --release --target wasm32v1-none
```

**Important:** Must use `wasm32v1-none` target (not `wasm32-unknown-unknown`).  
Requires Rust 1.84+. The `wasm32-unknown-unknown` target enables reference-types which Soroban doesn't support.

### Step 2: Export Verification Key (if not done)

```bash
cd prover
node dist/cli/index.js export-vk
# VK saved to output/verification_key.bin (3,680 bytes)
```

### Step 3: Deploy to Testnet

```bash
# Get VK hex
VK_HEX=$(xxd -p -c 99999 ../output/verification_key.bin)

# Deploy contract with embedded VK
stellar contract deploy \
    --network testnet \
    --source <YOUR_SECRET_KEY> \
    --rpc-url https://soroban-testnet.stellar.org \
    --network-passphrase "Test SDF Network ; September 2015" \
    --wasm target/wasm32v1-none/release/zer0inf_contract.wasm \
    -- "bytes:$VK_HEX"
```

**CLI Syntax Notes:**
- `stellar contract deploy` (singular, not `contracts`)
- Constructor args go after `--` separator: `-- "bytes:$VK_HEX"`
- `--network-passphrase` required when using `--rpc-url`
- Network passphrase for testnet: `"Test SDF Network ; September 2015"`

**Expected Output:**
```
ℹ️ Uploading contract WASM…
ℹ️ Simulating transaction…
🌎 Sending transaction…
✅ Transaction submitted successfully!
🔗 https://stellar.expert/explorer/testnet/tx/<TX_HASH>
```

### Step 4: Save Contract ID

```bash
# Copy the contract ID from deployment output
echo "<CONTRACT_ID>" > output/contract-id.txt
```

## Full Pipeline Test

### 1. Register Model

```bash
cd prover
node dist/cli/index.js register ../data/sample-weights.json \
    --description "Credit Model v1" \
    --contract-id <CONTRACT_ID>
```

**Output:**
```
[zer0inf] Registering model on-chain...
  Description: Credit Model v1
  Hash: 81c1da56a409b396...
  Weights: 48 + 6
[zer0inf] Model metadata saved to output/model.json
```

### 2. Generate ZK Proof

```bash
# With sample data
node dist/cli/index.js infer --input ../data/sample-inference.json

# Or with demo weights (no input file needed)
node dist/cli/index.js infer
```

**Output:**
```
[zer0inf] Inference: APPROVE (confidence: 50.1%)
[zer0inf] Weight hash: ef61f6027be12d25...
[zer0inf] Initializing noir_js...
[zer0inf] Generating witness...
[zer0inf] Witness generated ✓
[zer0inf] Initializing Barretenberg (≈10s warmup)...
[zer0inf] Generating UltraHonk proof...
[zer0inf] Proof generated: 14.3 KB in 153ms
[zer0inf] Proof valid: ✓
[zer0inf] Proof saved to output/proof.json (14.3 KB)
```

**Note:** First run takes ~10s for Barretenberg warmup. Subsequent runs are fast (~150ms).

### 3. Submit Inference (via CLI)

The TypeScript client has a known issue with Soroban SDK v27 types. Use the Stellar CLI directly:

```bash
# Extract proof bytes from proof.json
PROOF_HEX=$(jq -r '.proofBytesHex' ../output/proof.json)

# Get your public key
PUBKEY=<YOUR_PUBLIC_KEY>

# Submit to contract
stellar contract invoke \
    --id <CONTRACT_ID> \
    --network testnet \
    --source <YOUR_SECRET_KEY> \
    --submit_inference \
    --caller $PUBKEY \
    --model_id 0 \
    --proof_bytes "bytes:$PROOF_HEX" \
    --public_inputs "bytes:<PUBLIC_INPUTS_HEX>" \
    --decision true \
    --confidence 501 \
    --send yes
```

### 4. Query Contract (via CLI)

```bash
# Get model count
stellar contract invoke \
    --id <CONTRACT_ID> \
    --network testnet \
    --source <YOUR_SECRET_KEY> \
    --send no \
    -- get_model_count

# List all models
stellar contract invoke \
    --id <CONTRACT_ID> \
    --network testnet \
    --source <YOUR_SECRET_KEY> \
    --send no \
    -- list_models

# Get model details
stellar contract invoke \
    --id <CONTRACT_ID> \
    --network testnet \
    --source <YOUR_SECRET_KEY> \
    --send no \
    -- get_model --model_id 0

# Get inference record
stellar contract invoke \
    --id <CONTRACT_ID> \
    --network testnet \
    --source <YOUR_SECRET_KEY> \
    --send no \
    -- get_inference --inference_id 0
```

**CLI Syntax Notes:**
- Function name comes after `--` separator
- Use `--send no` for read-only queries (no transaction submitted)
- Use `--send yes` to submit transactions
- Arguments use `--arg_name value` format

## Verify Events on Horizon

```bash
# View recent operations
curl "https://horizon-testnet.stellar.org/operations?cursor=&limit=10&order=desc" | jq

# Filter by contract ID (if supported)
curl "https://horizon-testnet.stellar.org/operations?cursor=&limit=10&order=desc" | jq '.records[] | select(.type_i == 18)'
```

## Troubleshooting

### Contract deployment fails with "reference-types not enabled"
**Cause:** Using wrong WASM target (`wasm32-unknown-unknown`)  
**Fix:** Use `wasm32v1-none` target (requires Rust 1.84+)

```bash
rustup update 1.84
rustup target add wasm32v1-none --toolchain 1.84
cargo build --release --target wasm32v1-none
```

### Error: "rpc-url is used but network passphrase is missing"
**Fix:** Add `--network-passphrase "Test SDF Network ; September 2015"`

### Error: "unrecognized subcommand 'contracts'"
**Fix:** Use `stellar contract deploy` (singular, not plural)

### Error: "unexpected argument '--constructor-arg' found"
**Fix:** Constructor args go after `--`: `-- "bytes:$VK_HEX"`

### Proof generation fails with "ENOENT" or "not found"
```bash
# Reinstall dependencies
cd prover && npm install

# Check noir_js is available
ls node_modules/@noir-lang/noir_js/

# Recompile circuit
cd circuit && nargo compile
```

### Submit fails with "Cannot mix BigInt and other types"
**Cause:** TypeScript client type mismatch with SDK v27  
**Fix:** Use Stellar CLI directly (see Submit Inference section above)

## Monitoring

- **Horizon API:** https://horizon-testnet.stellar.org/operations
- **Stellar Laboratory:** https://laboratory.stellar.org/
- **Testnet Faucet:** https://laboratory.stellar.org/#account-creator
- **Transaction Explorer:** https://stellar.expert/explorer/testnet/tx/<TX_HASH>

## Contract Functions

| Function | Type | Description |
|----------|------|-------------|
| `__constructor(vk_bytes: Bytes)` | Write | Set embedded verification key (immutable) |
| `register(caller, model_hash, description, version)` | Write | Register model with weight hash |
| `submit_inference(caller, model_id, proof_bytes, public_inputs, decision, confidence)` | Write | Submit ZK proof with inference result |
| `get_model(model_id)` | Read | Get model info (hash, description, version) |
| `get_model_count()` | Read | Get total registered models |
| `list_models()` | Read | List all model IDs |
| `get_inference(inference_id)` | Read | Get inference record |
| `vk_bytes()` | Read | Get embedded verification key |

## Security Notes

- **VK is immutable** after deployment — cannot be changed
- **Proofs are verified** cryptographically against embedded VK
- **Model weights never leave the prover** — only hash stored on-chain
- **User data stays private** — processed locally, used to generate proof

---

**For full details, see:**
- `README.md` — Project overview
- `HACKATHON-SUBMISSION-CHECKLIST.md` — Submission requirements
- `DEPLOYMENT-RESULTS.md` — Test results from this deployment
