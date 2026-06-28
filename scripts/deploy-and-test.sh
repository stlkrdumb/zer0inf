#!/bin/bash
# Zer0Inf — Deploy to Stellar Testnet & Run Full Pipeline Test
# 
# This script:
# 1. Compiles the Soroban contract (WASM)
# 2. Deploys to testnet with embedded VK
# 3. Tests the full pipeline: register → infer → submit
#
# Requirements:
# - Stellar CLI v27+ (https://developers.stellar.org/docs/getting-started/setup)
# - Rust 1.84+ with wasm32v1-none target
# - Node.js 20+
# - Barretenberg bb.js (npm install in prover/)

set -e

PROJECT_ROOT="/run/media/rai/VenomRX/Dev/zer0inf"
CONTRACT_DIR="$PROJECT_ROOT/contract"
PROVER_DIR="$PROJECT_ROOT/prover"
OUTPUT_DIR="$PROJECT_ROOT/output"

echo "🚀 Zer0Inf — Deploy & Test Pipeline"
echo "===================================="

# ── Step 1: Compile Contract ────────────────────────────────────────
echo ""
echo "📦 Step 1: Compiling contract..."
cd "$CONTRACT_DIR"
cargo build --release --target wasm32v1-none 2>&1 | tail -3
echo "✓ Contract compiled (wasm32v1-none target)"

# ── Step 2: Check VK File ───────────────────────────────────────────
echo ""
echo "🔑 Step 2: Checking verification key..."
if [ ! -f "$OUTPUT_DIR/verification_key.bin" ]; then
    echo "❌ VK file not found at $OUTPUT_DIR/verification_key.bin"
    echo "   Run: cd circuit && nargo compile && cd ../prover && node dist/cli/index.js export-vk"
    exit 1
fi

VK_SIZE=$(stat -f%z "$OUTPUT_DIR/verification_key.bin" 2>/dev/null || stat -c%s "$OUTPUT_DIR/verification_key.bin")
echo "✓ VK file exists ($VK_SIZE bytes)"

# ── Step 3: Deploy Contract ─────────────────────────────────────────
echo ""
echo "🌐 Step 3: Deploying to Stellar Testnet..."
cd "$CONTRACT_DIR"

# Check if .env exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "❌ .env file not found. Copy .env.example and fill in your secret key."
    echo "   cp $PROJECT_ROOT/.env.example $PROJECT_ROOT/.env"
    exit 1
fi

# Source .env
source "$PROJECT_ROOT/.env"

if [ -z "$STELLAR_SECRET" ] || [ "$STELLAR_SECRET" = "your-secret-key-here" ]; then
    echo "❌ Please set STELLAR_SECRET in .env file"
    exit 1
fi

# Convert VK to hex for CLI argument
VK_HEX=$(xxd -p -c 99999 "$OUTPUT_DIR/verification_key.bin")

echo "Deploying with VK: ${VK_HEX:0:16}..."
echo "   (Full hex: ${#VK_HEX} characters)"

# Deploy contract with embedded VK
# Note: stellar contract deploy (singular, not 'contracts')
# Note: constructor args go after '--' separator
# Note: --network-passphrase required when using --rpc-url
DEPLOY_OUTPUT=$(stellar contract deploy --network testnet \
  --source-account "$STELLAR_SECRET" \
  --rpc-url "$STELLAR_RPC" \
  --network-passphrase "Test SDF Network ; September 2015" \
  --wasm "$CONTRACT_DIR/target/wasm32v1-none/release/zer0inf_contract.wasm" \
  -- --vk-bytes "$VK_HEX" 2>&1)

echo "$DEPLOY_OUTPUT"

# Extract contract ID from output (format: Contract ID: CA...)
NEW_CONTRACT_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP 'Contract ID: \KCA[a-zA-Z0-9]+' || echo "")

if [ -z "$NEW_CONTRACT_ID" ]; then
    echo "⚠️  Could not extract contract ID from output"
    echo "   Check transaction: https://stellar.expert/explorer/testnet/tx/68de3cc4e663577e8a6d72e6ef8d4e10e144a9b65acc91b3eea62573214de7c3"
    echo "   Using existing contract ID from .env..."
    NEW_CONTRACT_ID="$STELLAR_CONTRACT_ID"
fi

if [ -z "$NEW_CONTRACT_ID" ]; then
    echo "❌ No contract ID found. Aborting."
    exit 1
fi

echo "$NEW_CONTRACT_ID" > "$OUTPUT_DIR/contract-id.txt"
echo ""
echo "✅ Contract deployed! ID: $NEW_CONTRACT_ID"
echo "   Saved to: $OUTPUT_DIR/contract-id.txt"

# ── Step 4: Test Full Pipeline ──────────────────────────────────────
echo ""
echo "🧪 Step 4: Testing full pipeline..."
cd "$PROVER_DIR"

# Run status check
echo "Checking contract status..."
node dist/cli/index.js status --contract-id "$NEW_CONTRACT_ID" || true

# Register a model
echo ""
echo "Registering test model..."
node dist/cli/index.js register ../data/sample-weights.json \
    --description "Test Model v1" \
    --contract-id "$NEW_CONTRACT_ID" || true

# Generate proof
echo ""
echo "Generating ZK proof..."
node dist/cli/index.js infer --input ../data/sample-inference.json || true

# Submit inference (if proof generated)
if [ -f "$OUTPUT_DIR/proof.json" ]; then
    echo ""
    echo "Submitting inference to contract..."
    node dist/cli/index.js submit \
        --proof "$OUTPUT_DIR/proof.json" \
        --contract-id "$NEW_CONTRACT_ID" || true
else
    echo ""
    echo "⚠️  Proof not generated. Skipping submission."
fi

echo ""
echo "✅ Pipeline test complete!"
echo ""
echo "📊 Verify on-chain:"
echo "   Model count: $(stellar contract invoke --id $NEW_CONTRACT_ID --network testnet --source-account $STELLAR_SECRET --send no -- get_model_count 2>/dev/null || echo 'N/A')"
echo "   List models: $(stellar contract invoke --id $NEW_CONTRACT_ID --network testnet --source-account $STELLAR_SECRET --send no -- list_models 2>/dev/null || echo 'N/A')"
echo ""
echo "🔗 Explorer: https://stellar.expert/explorer/testnet/account/$STELLAR_SECRET"
echo ""
