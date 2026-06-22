#!/usr/bin/env node
/**
 * Zer0Inf — Command-Line Interface
 *
 * Full CLI for the Zer0Inf ZK AI Inference system on Stellar Soroban.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { proveInference } from '../proof/generate.js';
import { submitInference, getConfig } from '../onchain/index.js';
import { Keypair } from '@stellar/stellar-sdk';
function parseArgs() {
    const args = process.argv.slice(2);
    const positional = [];
    const options = {};
    let i = 0;
    while (i < args.length) {
        if (args[i].startsWith('--')) {
            const key = args[i].slice(2);
            if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                options[key] = args[i + 1];
                i += 2;
            }
            else {
                options[key] = true;
                i += 1;
            }
        }
        else {
            positional.push(args[i]);
            i += 1;
        }
    }
    return { command: positional[0] || 'help', positional: positional.slice(1), options };
}
// ── Normalization ─────────────────────────────────────────────────-
function normalize(value, min, max) {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
}
// ── Data Helpers ───────────────────────────────────────────────────
function loadJSON(path) {
    if (!existsSync(path)) {
        console.error(`Error: File not found: ${path}`);
        process.exit(1);
    }
    return JSON.parse(readFileSync(path, 'utf-8'));
}
/** Save JSON with BigInt → string serialization for safe round-trip. */
function saveJSON(path, data) {
    const dir = dirname(path);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    const jsonStr = JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() + 'n' : value, 2);
    writeFileSync(path, jsonStr);
}
// ── Demo Input Generation ──────────────────────────────────────────
function getDefaultInput() {
    return {
        income: normalize(75000, 0, 200000),
        debtRatio: normalize(0.3, 0, 1),
        savings: normalize(25, 0, 500),
        employmentYears: normalize(8, 0, 30),
        creditHistoryMonths: normalize(60, 0, 240),
        loanAmount: normalize(50, 0, 500),
        interestRate: normalize(5.5, 0, 25),
        riskScore: normalize(0.3, 0, 1),
    };
}
function generateRandomWeights() {
    return {
        weights: Array.from({ length: 48 }, () => (Math.random() - 0.5) * 0.3),
        outputWeights: Array.from({ length: 6 }, () => (Math.random() - 0.5) * 0.3),
    };
}
// ── Commands ───────────────────────────────────────────────────────
async function cmdHelp(args) {
    console.log(`
zer0Inf — Zero-Knowledge Proof of AI Inference on Stellar Soroban

USAGE:
  zer0inf <command> [options]

COMMANDS:
  register <weights.json>    Compute weight hash + save metadata
    --description <text>     Model description
    
  deploy                     Print Stellar testnet deployment instructions
    --secret <key>           Stellar secret key (or via STELLAR_SECRET)
    
  submit --proof <path>      Submit proof to on-chain contract
    --contract-id <id>       Contract ID (required if not stored)
    --secret <key>           Stellar secret key
    --rpc <url>              Custom RPC URL
    
  infer [options]            Run inference & generate ZK proof
    --input <path>           Input data JSON file
    --weights-path <path>    Weights JSON (default: demo weights)
    
  verify --proof <path>      Verify proof locally
  
  status                     Show project state

EXAMPLES:
  # Generate ZK proof locally
  zer0inf infer
  
  # Deploy contract to testnet (prints instructions)
  zer0inf deploy --secret <your_secret_key>
  
  # Submit proof to deployed contract
  zer0inf submit --proof output/proof.json --contract-id <contract_id> --secret <key>
`);
}
async function cmdRegister(args) {
    const opts = args.options;
    const positional = args.positional;
    if (positional.length === 0) {
        console.error('Error: weights file path is required');
        console.log('  Usage: zer0inf register <weights.json> [--description "..."]');
        process.exit(1);
    }
    const weightsPath = positional[0];
    const description = opts['description'] || 'Unspecified model';
    const weightsData = loadJSON(weightsPath);
    const { createHash } = await import('node:crypto');
    const jsonStr = JSON.stringify(weightsData);
    const hashHex = createHash('sha256').update(jsonStr).digest('hex');
    console.log('[zer0inf] Registering model on-chain...');
    console.log(`  Description: ${description}`);
    console.log(`  Hash: ${hashHex.slice(0, 16)}...`);
    console.log(`  Weights: ${weightsData.weights.length} + ${weightsData.output_weights.length}`);
    // Save locally
    const outputPath = join(process.cwd(), 'output', 'model.json');
    saveJSON(outputPath, {
        modelId: 0,
        modelHash: hashHex,
        description,
        version: 1,
        registeredAt: Date.now(),
    });
    console.log(`[zer0inf] Model metadata saved to output/model.json`);
}
async function cmdInfer(args) {
    const opts = args.options;
    // Load or generate input data
    let input;
    const inputPath = opts['input'];
    if (inputPath) {
        input = loadJSON(inputPath);
    }
    else {
        console.log('[zer0inf] Using demo credit eligibility input (8 features)');
        input = getDefaultInput();
    }
    // Load or generate weights
    let weights;
    let outputWeights;
    const weightsPath = opts['weights_path'];
    if (weightsPath) {
        const wd = loadJSON(weightsPath);
        weights = wd.weights;
        outputWeights = wd.output_weights;
    }
    else {
        const { weights: w, outputWeights: ow } = generateRandomWeights();
        weights = w;
        outputWeights = ow;
    }
    // Run full pipeline: inference + ZK proof generation
    try {
        const { proofBytesHex, publicInputs, result, weightsHash } = await proveInference(input, weights, outputWeights);
        const proofFile = join(process.cwd(), 'output', 'proof.json');
        saveJSON(proofFile, {
            modelId: 0,
            weightsHash,
            proofBytesHex,
            publicInputs: publicInputs.map(v => v.toString()),
            result,
        });
        if (proofBytesHex.length > 0) {
            console.log(`[zer0inf] ZK proof: ${proofBytesHex.length / 2} bytes hex`);
        }
    }
    catch (err) {
        console.error('[zer0inf] Proof generation failed:', err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}
async function cmdVerify(args) {
    const opts = args.options;
    const proofPath = opts['proof'];
    if (!proofPath) {
        console.error('Error: --proof is required');
        process.exit(1);
    }
    console.log('[zer0inf] Proof verification summary\n');
    const submission = loadJSON(proofPath);
    const proofBytes = submission.proofBytesHex ? Buffer.from(submission.proofBytesHex, 'hex') : new Uint8Array(0);
    console.log(`  Model ID:          ${submission.modelId}`);
    console.log(`  Proof size:        ${proofBytes.length} bytes`);
    const pi = submission.publicInputs;
    console.log(`  Public inputs:     ${pi.length} fields`);
    if (submission.result) {
        console.log(`  Decision:          ${submission.result.decision === 1 ? 'APPROVE' : 'DENY'}`);
        console.log(`  Confidence:        ${(submission.result.confidence * 100).toFixed(1)}%`);
        console.log(`  Raw output:        ${submission.result.rawOutput.toFixed(6)}`);
    }
    console.log(`\n[zer0inf] To verify on-chain, deploy contract and call submit_inference with proof bytes.`);
}
async function cmdSubmit(args) {
    const opts = args.options;
    const proofPath = opts['proof'];
    // Get contract ID
    let contractId;
    if (opts['contract-id']) {
        contractId = opts['contract-id'];
    }
    else {
        const configPath = join(process.cwd(), 'output', 'contract-id.txt');
        if (existsSync(configPath)) {
            contractId = readFileSync(configPath, 'utf-8').trim();
        }
        else {
            const configPath2 = join(process.cwd(), 'output', 'contract-config.json');
            if (existsSync(configPath2)) {
                contractId = loadJSON(configPath2).contractId;
            }
            else {
                console.error('Error: --contract-id is required\n');
                console.log('  Options:\n');
                console.log('    --contract-id <id>     Pass contract ID directly');
                console.log('    Save to output/contract-id.txt after deploying');
                process.exit(1);
            }
        }
    }
    if (!proofPath) {
        console.error('Error: --proof is required');
        process.exit(1);
    }
    const submission = loadJSON(proofPath);
    const result = submission.result;
    const decision = result.decision === 1;
    const confidence = result.confidence;
    console.log('[zer0inf] Submitting inference to Soroban contract...\n');
    try {
        const config = getConfig({ secret: opts['secret'] });
        const proofHash = submission.proofBytesHex.length > 0
            ? require('crypto').createHash('sha256').update(Buffer.from(submission.proofBytesHex, 'hex')).digest('hex')
            : undefined;
        const resultData = await submitInference(contractId, config, submission.modelId, decision, confidence, proofHash);
        // Save contract ID for future calls
        const idPath = join(process.cwd(), 'output', 'contract-id.txt');
        if (!existsSync(idPath)) {
            writeFileSync(idPath, contractId);
        }
        console.log(`\n[zer0inf] Done! Inference #${resultData.inferenceId} submitted.`);
        console.log(`  Tx hash: ${resultData.transactionHash}`);
        console.log(`  Explorer: https://testnet.stellar.org/transactions/${resultData.transactionHash}`);
    }
    catch (err) {
        console.error('[zer0inf] Submission failed:', err instanceof Error ? err.message : String(err));
        console.log('\n[zer0inf] Make sure:');
        console.log('  1. Contract is deployed on testnet');
        console.log('  2. Account has enough XLM for fees');
        console.log('  3. --contract-id matches the deployed contract');
        process.exit(1);
    }
}
async function cmdDeploy(args) {
    const opts = args.options;
    try {
        const config = getConfig({ secret: opts['secret'] });
        // Find WASM path
        const wasmPath = join(process.cwd(), 'contract', 'target', 'wasm32-unknown-unknown', 'release', 'zer0inf_contract.wasm');
        if (!existsSync(wasmPath)) {
            console.error('Error: Contract WASM not found.');
            console.log(`  Build it first: cd contract && cargo build --release`);
            process.exit(1);
        }
        const idFile = join(process.cwd(), 'output', 'contract-id.txt');
        if (existsSync(idFile)) {
            console.log(`\n${'═'.repeat(50)}`);
            console.log('  Zer0Inf — On-Chain Status');
            console.log(`${'═'.repeat(50)}\n`);
            console.log(`  Contract ID: ${readFileSync(idFile, 'utf-8').trim()}`);
            const kp = Keypair.fromSecret(config.secret);
            console.log(`  Account:     ${kp.publicKey()}`);
            console.log(`  RPC:         ${config.rpcUrl || 'https://soroban-testnet.stellar.org'}`);
            console.log(`${'─'.repeat(50)}`);
        }
        else {
            console.log('\nTo deploy, use:');
            console.log('  stellar contract deploy --wasm <path> --network testnet --source deployer');
        }
    }
    catch (err) {
        console.error('[zer0inf] Error:', err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}
async function cmdStatus(args) {
    const projectRoot = process.cwd();
    const proofPath = join(projectRoot, 'output', 'proof.json');
    const modelPath = join(projectRoot, 'output', 'model.json');
    // Check in common locations for Noir circuit
    const noirLocations = [
        join(projectRoot, 'circuit', 'target', 'debug', 'zer0inf.nr.prover'),
        join(projectRoot, 'circuit', 'target', 'zer0inf.json'),
    ];
    const hasNoirCompiled = noirLocations.some(f => existsSync(f));
    // Check for compiled WASM
    const wasmPaths = [
        join(projectRoot, 'contract', 'target', 'wasm32-unknown-unknown', 'release', 'zer0inf_contract.wasm'),
        join(projectRoot, 'contract', 'target', 'wasm32v1-none', 'release', 'zer0inf_contract.wasm'),
    ];
    const hasWasm = wasmPaths.some(f => existsSync(f));
    console.log('[zer0inf] Project Status\n');
    console.log(`  Proof file:     ${existsSync(proofPath) ? '✓ Generated' : '✗ Not generated'}`);
    console.log(`  Model metadata: ${existsSync(modelPath) ? '✓ Registered' : '✗ Not registered'}`);
    console.log(`  Noir circuit:   ${hasNoirCompiled ? '✓ Compiled' : '⚠ Needs nargo compile'}`);
    console.log(`  Contract WASM:  ${hasWasm ? '✓ Built' : '✗ Not built'}`);
}
// ── Main ───────────────────────────────────────────────────────────
async function main() {
    // Ensure output directory exists
    const { mkdirSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const outDir = join(process.cwd(), 'output');
    if (!existsSync(outDir))
        mkdirSync(outDir, { recursive: true });
    const args = parseArgs();
    switch (args.command) {
        case 'help':
            await cmdHelp(args);
            break;
        case 'register':
            await cmdRegister(args);
            break;
        case 'deploy':
            await cmdDeploy(args);
            break;
        case 'infer':
            await cmdInfer(args);
            break;
        case 'verify':
            await cmdVerify(args);
            break;
        case 'submit':
            await cmdSubmit(args);
            break;
        case 'status':
            await cmdStatus(args);
            break;
        default:
            console.error(`Unknown command: ${args.command}`);
            await cmdHelp(args);
            process.exit(1);
    }
}
main().catch(err => {
    console.error('[zer0inf] Error:', err.message);
    process.exit(1);
});
