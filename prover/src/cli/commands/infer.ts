/**
 * Zer0Inf — infer Command
 * 
 * Runs inference (load/generate weights + input), generates ZK proof, saves result.
 */

import { join } from 'node:path';
import type { CLIArgs } from '../index.js';
import { loadJSON, saveJSON, getDefaultInput, generateRandomWeights, ProofData } from '../utils.js';
import type { InferInput } from '../../types/index.js';
import { proveInference } from '../../proof/generate.js';

export async function cmdInfer(args: CLIArgs): Promise<void> {
  const opts = args.options;

  // Load or generate input data
  let input: InferInput;
  const inputPath = opts['input'] as string;
  if (inputPath) {
    input = loadJSON<InferInput>(inputPath);
  } else {
    console.log('[zer0inf] Using demo credit eligibility input (8 features)');
    input = getDefaultInput();
  }

  // Load or generate weights
  let weights: number[];
  let outputWeights: number[];
  const weightsPath = (opts['weights'] || opts['weights_path']) as string;
  if (weightsPath) {
    const wd = loadJSON<{ weights: number[]; output_weights: number[] }>(weightsPath);
    weights = wd.weights;
    outputWeights = wd.output_weights;
    console.log(`[zer0inf] Loaded weights from ${weightsPath}`);
  } else {
    const { weights: w, outputWeights: ow } = generateRandomWeights();
    weights = w;
    outputWeights = ow;
    console.log(`[zer0inf] Using random weights (results will vary)`);
  }

  // Run full pipeline: inference + ZK proof generation
  try {
    const { proofBytesHex, publicInputs, result, weightsHash } = await proveInference(input, weights, outputWeights);

    const proofFile = join(process.cwd(), 'output', 'proof.json');
    saveJSON(proofFile, {
      modelId: 0,
      weightsHash,
      proofBytesHex,
      publicInputs,
      result,
    });

    if (proofBytesHex.length > 0) {
      console.log(`[zer0inf] ZK proof: ${proofBytesHex.length / 2} bytes hex`);
    }
  } catch (err) {
    console.error('[zer0inf] Proof generation failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
