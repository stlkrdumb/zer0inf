/**
 * Zer0Inf — ZK Proof Generation (noir_js + Barretenberg)
 *
 * Uses @noir-lang/noir_js for witness execution and
 * @aztec/bb.js (Barretenberg) for UltraHonk proof generation.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
// resolveProjectRoot(): Find project root by going up from this module.
// generate.ts compiles to prover/dist/proof/generate.js → need 3 levels up for project root
function resolvePath(relative) {
    const modDir = dirname(new URL(import.meta.url).pathname);
    // Go up: proof → dist → prover → project (3 levels)
    return join(modDir, '../..', relative);
}
const PROOF_DIR = dirname(new URL(import.meta.url).pathname);
// Resolve a module path from the prover root (where node_modules lives)
// PROOF_DIR = prover/dist/proof → go up 2 levels to prover/ then append pkg
function modPath(pkg) {
    return join(PROOF_DIR, '../..', pkg);
}
// Convert a relative package path to a file:// URL for dynamic import
function modUrl(pkg) {
    return pathToFileURL(join(PROOF_DIR, '../..', pkg)).href;
}
const PROJECT_ROOT = resolvePath('..');
const PROVER_NODE_MODULES = join(PROJECT_ROOT, 'prover', 'node_modules');
const CIRCUIT_DIR = join(PROJECT_ROOT, 'circuit');
const TARGET_DIR = join(CIRCUIT_DIR, 'target');
const OUTPUT_DIR = join(PROJECT_ROOT, 'output');
import { DEMO_CONFIG } from '../types/index.js';
// ── Fixed-Point Math ───────────────────────────────────────────────
const FIX_BITS = 10;
const FIX_SCALE = 1 << FIX_BITS;
// Circuit uses signed i32 for all weights/inputs. Negative values are
// valid and handled natively by Noir's Brillig VM (2's complement).
export function toFixed(val) {
    return BigInt(Math.round(val * FIX_SCALE));
}
// ── Neural Network Inference (reference) ───────────────────────────
export function runInference(input, weights, outputWeights) {
    const raw = [
        input.income, input.debtRatio, input.savings, input.employmentYears,
        input.creditHistoryMonths, input.loanAmount, input.interestRate, input.riskScore,
    ];
    const hidden = [];
    for (let i = 0; i < DEMO_CONFIG.hiddenSize; i++) {
        let sum = 0;
        for (let j = 0; j < DEMO_CONFIG.inputSize; j++) {
            sum += weights[i * DEMO_CONFIG.inputSize + j] * raw[j];
        }
        hidden.push(Math.max(0, sum));
    }
    let outputSum = 0;
    for (let i = 0; i < DEMO_CONFIG.hiddenSize; i++) {
        outputSum += outputWeights[i] * hidden[i];
    }
    const rawOutput = 1 / (1 + Math.exp(-outputSum));
    const decision = rawOutput >= 0.5 ? 1 : 0;
    const confidence = decision === 1 ? rawOutput : 1 - rawOutput;
    return { rawOutput, decision, confidence };
}
// ── Compilation Check ──────────────────────────────────────────────
async function ensureCompiled(nargoBin) {
    const acirPath = join(TARGET_DIR, 'zer0inf.json');
    if (!existsSync(acirPath)) {
        console.log('[zer0inf] Circuit not compiled. Running nargo compile...');
        const { execFileSync } = await import('node:child_process');
        const target = nargoBin || (existsSync(join(process.env.HOME || '', '.cargo/bin/nargo'))
            ? join(process.env.HOME, '.cargo/bin/nargo')
            : 'nargo');
        try {
            execFileSync(target, ['compile'], { cwd: CIRCUIT_DIR, stdio: 'inherit' });
        }
        catch {
            throw new Error('Failed to compile circuit. Run: cd circuit && nargo compile');
        }
    }
}
// ── Proof Generation ───────────────────────────────────────────────
/**
 * Generate an UltraHonk ZK proof via noir_js + Barretenberg.
 *
 * Flow:
 *   1. Load compiled Noir circuit JSON
 *   2. Build & execute witness → verify constraints
 *   3. Generate UltraHonk proof using Barretenberg backend
 *   4. Verify proof locally
 */
export async function generateProof(input, weights, outputWeights, result) {
    await ensureCompiled();
    // Load circuit
    const circuitPath = join(TARGET_DIR, 'zer0inf.json');
    const rawCircuit = JSON.parse(readFileSync(circuitPath, 'utf-8'));
    // Import noir_js — it auto-initializes WASM modules at load time.
    // @noir-lang/acvm_js/main → ./nodejs/acvm_js.js (auto-loads .wasm)
    // @noir-lang/noirc_abi/main → ./nodejs/noirc_abi_wasm.js (auto-loads .wasm)
    console.log('[zer0inf] Initializing noir_js...');
    const { Noir } = await import(modUrl('node_modules/@noir-lang/noir_js/lib/index.mjs'));
    const noir = new Noir(rawCircuit);
    const raw = [
        input.income, input.debtRatio, input.savings, input.employmentYears,
        input.creditHistoryMonths, input.loanAmount, input.interestRate, input.riskScore,
    ];
    const fixedWeights = weights.map(toFixed);
    const fixedOutputWeights = outputWeights.map(toFixed);
    const witnessInputs = {};
    // Hidden layer weights (w0–w47)
    for (let i = 0; i < 48; i++) {
        witnessInputs[`w${i}`] = fixedWeights[i].toString();
    }
    // Output layer weights (ov0–ov5)
    for (let i = 0; i < 6; i++) {
        witnessInputs[`ov${i}`] = fixedOutputWeights[i].toString();
    }
    // Private: user financial data — normalize to [0, 1023] range
    // The Noir circuit expects inputs in this fixed-point range.
    const normalized = [
        Math.round((raw[0] / 500000) * 1023), // income
        Math.round((raw[1] / 100) * 1023), // debt_ratio
        Math.round((raw[2] / 500000) * 1023), // savings
        Math.round((raw[3] / 2000) * 1023), // employmentYears
        Math.round((raw[4] / 3600) * 1023), // creditHistoryMonths
        Math.round((raw[5] / 1000000) * 1023), // loanAmount
        Math.round((raw[6] / 20) * 1023), // interestRate
        Math.round((raw[7] / 850) * 1023), // riskScore
    ].map(v => Math.max(0, Math.min(1023, v)));
    witnessInputs.income = String(normalized[0]);
    witnessInputs.debt_ratio = String(normalized[1]);
    witnessInputs.savings = String(normalized[2]);
    witnessInputs.employment = String(normalized[3]);
    witnessInputs.credit_hist = String(normalized[4]);
    witnessInputs.loan_amt = String(normalized[5]);
    witnessInputs.interest = String(normalized[6]);
    witnessInputs.risk_score = String(normalized[7]);
    // Compute the result using exact i32 integer arithmetic to match Brillig VM.
    // This MUST produce the same value as compute_inference in Noir.
    const hiddenInt = [];
    for (let layer = 0; layer < 6; layer++) {
        let sum = 0n;
        for (let j = 0; j < 8; j++) {
            const wi = fixedWeights[layer * 8 + j];
            const xi = BigInt(normalized[j]);
            // i32 multiplication with truncating division (Brillig semantics)
            sum += (wi * xi) / BigInt(FIX_SCALE);
        }
        // ReLU
        const relu = sum > 0n ? (sum > 1023n ? 1023n : sum) : 0n;
        hiddenInt.push(relu);
    }
    // Output layer: (ov * hidden) / 1024
    let outputSum = 0n;
    for (let i = 0; i < 6; i++) {
        const wi = fixedOutputWeights[i];
        outputSum += (wi * hiddenInt[i]) / BigInt(FIX_SCALE);
    }
    // Clamp [0, 1023]
    outputSum = outputSum > 1023n ? 1023n : (outputSum < 0n ? 0n : outputSum);
    // Sigmoid approximation (degree-4 Taylor / piecewise)
    let resultInt;
    if (outputSum >= 900n) {
        resultInt = 1023n;
    }
    else if (outputSum <= 128n) {
        resultInt = 0n;
    }
    else {
        const range = 900n - 128n;
        const diff = outputSum - 128n;
        resultInt = (diff * 1023n) / range;
    }
    // Public: inference result (must match Noir's compute_inference output)
    witnessInputs.result = resultInt.toString();
    console.log('[zer0inf] Generating witness...');
    const { witness } = await noir.execute(witnessInputs);
    console.log('[zer0inf] Witness generated ✓');
    // Barretenberg backend for UltraHonk
    console.log('[zer0inf] Initializing Barretenberg (≈10s)...');
    // bb.js is hoisted to root workspace node_modules
    const bb = await import('@aztec/bb.js');
    const Barretenberg = bb.Barretenberg;
    const UltraHonkBackend = bb.UltraHonkBackend;
    const barretenbergAPI = await Barretenberg.new();
    const backend = new UltraHonkBackend(rawCircuit.bytecode, barretenbergAPI);
    console.log('[zer0inf] Generating UltraHonk proof...');
    const t0 = Date.now();
    const { proof, publicInputs } = await backend.generateProof(witness);
    console.log(`[zer0inf] Proof generated: ${(proof.length / 1024).toFixed(1)} KB in ${Date.now() - t0}ms`);
    // bb.js returns { proof: Uint8Array, publicInputs: string[] }
    // The proof is 458 field elements × 32 bytes = ~14.5 KB
    console.log('[zer0inf] Proof fields:', proof.length / 32);
    console.log('[zer0inf] Public inputs from proof:', publicInputs.length);
    // Verify the proof locally using bb.js
    console.log('[zer0inf] Verifying locally...');
    // bb.js verifyProof needs: proof (flat bytes), publicInputs (hex strings)
    const proofData = { proof, publicInputs: publicInputs };
    const valid = await backend.verifyProof(proofData);
    console.log(`[zer0inf] Proof valid: ${valid ? '✓' : '✗'}`);
    if (!valid) {
        throw new Error('UltraHonk proof failed local verification!');
    }
    // Public inputs: weights (48) + output weights (6) + result (1) = 55 fields
    return {
        proofBytes: new Uint8Array(proof),
        publicInputs: [...fixedWeights, ...fixedOutputWeights, resultInt],
    };
}
// ── Full Pipeline ──────────────────────────────────────────────────
export async function proveInference(input, weights, outputWeights) {
    await ensureCompiled();
    const result = runInference(input, weights, outputWeights);
    const weightsJson = JSON.stringify({ weights, output_weights: outputWeights });
    const weightsHash = crypto.createHash('sha256').update(weightsJson).digest('hex');
    console.log(`[zer0inf] Inference: ${result.decision === 1 ? 'APPROVE' : 'DENY'} (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
    console.log(`[zer0inf] Weight hash: ${weightsHash.slice(0, 16)}...`);
    try {
        const proof = await generateProof(input, weights, outputWeights, result);
        mkdirSync(OUTPUT_DIR, { recursive: true });
        const proofJson = {
            modelId: 0,
            weightsHash,
            proofBytesHex: Buffer.from(proof.proofBytes).toString('hex'),
            publicInputs: proof.publicInputs.map(v => v.toString()),
            result,
            generatedAt: new Date().toISOString(),
        };
        writeFileSync(join(OUTPUT_DIR, 'proof.json'), JSON.stringify(proofJson, null, 2));
        console.log(`[zer0inf] Proof saved to output/proof.json (${(proof.proofBytes.length / 1024).toFixed(1)} KB)`);
        return {
            proofBytesHex: Buffer.from(proof.proofBytes).toString('hex'),
            publicInputs: proof.publicInputs,
            result,
            weightsHash,
        };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('ENOENT') || msg.includes('not found')) {
            console.error('[zer0inf] Missing dependency: npm install @noir-lang/noir_js @aztec/bb.js');
            process.exit(1);
        }
        // Fallback: save inference result without proof
        const fw = weights.map(toFixed);
        const fo = outputWeights.map(toFixed);
        const fr = [toFixed(result.rawOutput)];
        console.log(`[zer0inf] Proof failed: ${msg}`);
        console.log(`[zer0inf] Saving inference result locally as fallback.`);
        mkdirSync(OUTPUT_DIR, { recursive: true });
        writeFileSync(join(OUTPUT_DIR, 'proof.json'), JSON.stringify({
            modelId: 0, weightsHash, proofBytesHex: '',
            publicInputs: [...fw, ...fo, ...fr].map(v => v.toString()),
            result, generatedAt: new Date().toISOString(),
            note: 'Placeholder — full ZK proof requires noir_js + bb.js',
        }, null, 2));
        return {
            proofBytesHex: '',
            publicInputs: [...fw, ...fo, ...fr],
            result,
            weightsHash,
        };
    }
}
