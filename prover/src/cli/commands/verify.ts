/**
 * Zer0Inf — verify Command
 * 
 * Loads a proof JSON and displays verification summary.
 */

import { Buffer } from 'node:buffer';
import type { CLIArgs } from '../index.js';
import { loadJSON, ProofData } from '../utils.js';

export async function cmdVerify(args: CLIArgs): Promise<void> {
  const opts = args.options;
  const proofPath = opts['proof'] as string;
  if (!proofPath) {
    console.error('Error: --proof is required');
    process.exit(1);
  }

  console.log('[zer0inf] Proof verification summary\n');
  const submission = loadJSON<ProofData>(proofPath);

  const proofBytes = submission.proofBytesHex ? Buffer.from(submission.proofBytesHex, 'hex') : new Uint8Array(0);
  console.log(`  Model ID:          ${submission.modelId}`);
  console.log(`  Proof size:        ${proofBytes.length} bytes`);
  const pi = submission.publicInputs as unknown as string[];
  console.log(`  Public inputs:     ${pi.length} fields`);
  if (submission.result) {
    console.log(`  Decision:          ${submission.result.decision === 1 ? 'APPROVE' : 'DENY'}`);
    console.log(`  Confidence:        ${(submission.result.confidence * 100).toFixed(1)}%`);
    console.log(`  Raw output:        ${submission.result.rawOutput.toFixed(6)}`);
  }
  console.log(`\n[zer0inf] To verify on-chain, deploy contract and call submit_inference with proof bytes.`);
}
