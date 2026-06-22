/**
 * Zer0Inf — ZK Proof Generation (noir_js + Barretenberg)
 *
 * Uses @noir-lang/noir_js for witness execution and
 * @aztec/bb.js (Barretenberg) for UltraHonk proof generation.
 */
import type { InferInput, InferenceResult } from '../types/index.js';
export declare function toFixed(val: number): bigint;
export declare function runInference(input: InferInput, weights: number[], outputWeights: number[]): InferenceResult;
/**
 * Generate an UltraHonk ZK proof via noir_js + Barretenberg.
 *
 * Flow:
 *   1. Load compiled Noir circuit JSON
 *   2. Build & execute witness → verify constraints
 *   3. Generate UltraHonk proof using Barretenberg backend
 *   4. Verify proof locally
 */
export declare function generateProof(input: InferInput, weights: number[], outputWeights: number[], result: InferenceResult): Promise<{
    proofBytes: Uint8Array;
    publicInputs: bigint[];
}>;
export declare function proveInference(input: InferInput, weights: number[], outputWeights: number[]): Promise<{
    proofBytesHex: string;
    publicInputs: bigint[];
    result: InferenceResult;
    weightsHash: string;
}>;
