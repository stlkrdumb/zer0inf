/**
 * Zer0Inf — submit Command
 * 
 * Submits a proof to the Soroban contract on Stellar testnet.
 */


import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';
import type { CLIArgs } from '../index.js';
import { loadJSON, ProofData } from '../utils.js';
import { submitInference, getConfig } from '../../onchain/index.js';
import { DEFAULT_HORIZON_URL } from '../../types/index.js';

export async function cmdSubmit(args: CLIArgs): Promise<void> {
  const opts = args.options;
  const proofPath = opts['proof'] as string;

  // Get contract ID
  let contractId: string;
  if (opts['contract-id']) {
    contractId = opts['contract-id'] as string;
  } else {
    const configPath = join(process.cwd(), 'output', 'contract-id.txt');
    if (existsSync(configPath)) {
      contractId = readFileSync(configPath, 'utf-8').trim();
    } else {
      const configPath2 = join(process.cwd(), 'output', 'contract-config.json');
      if (existsSync(configPath2)) {
        contractId = loadJSON<{ contractId: string }>(configPath2).contractId;
      } else {
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

  const submission: ProofData = loadJSON(proofPath);
  const result = submission.result!;
  const decision = Number(result.decision) !== 0;
  // Confidence: contract expects u32 (e.g. 501 = 50.1%), convert if float
  const confidenceVal = typeof result.confidence === 'number'
    ? Math.round(result.confidence * 1000)
    : Number(result.confidence);

  console.log('[zer0inf] Submitting inference to Soroban contract...\n');

  // Reconstruct proof bytes and public inputs from saved data
  const proofBytes = submission.proofBytesHex.length > 0
    ? Buffer.from(submission.proofBytesHex, 'hex')
    : Buffer.alloc(0);
  
  // Convert public inputs to byte representation
  const publicInputValues = (submission.publicInputs || []).map((v: any) => {
    // Handle both BigInt and number types from JSON
    const val = typeof v === 'bigint' ? v : BigInt(v);
    return Number(val & 0xffn); // Pack lowest byte
  });
  const publicInputs = Buffer.from(publicInputValues);

  try {
    const resultData = await submitInference({
      secret: opts['secret'] as string,
      contractId,
    }, submission.modelId, proofBytes, publicInputs, decision, confidenceVal);

    // Save contract ID for future calls
    const idPath = join(process.cwd(), 'output', 'contract-id.txt');
    if (!existsSync(idPath)) {
      writeFileSync(idPath, contractId);
    }

    console.log(`\n[zer0inf] Done! Inference #${resultData.inferenceId} submitted.`);
    console.log(`  Tx hash: ${resultData.transactionHash}`);
    console.log(`  Explorer: ${DEFAULT_HORIZON_URL}/transactions/${resultData.transactionHash}`);

  } catch (err) {
    console.error('[zer0inf] Submission failed:', err instanceof Error ? err.message : String(err));
    console.log('\n[zer0inf] Make sure:');
    console.log('  1. Contract is deployed on testnet');
    console.log('  2. Account has enough XLM for fees');
    console.log('  3. --contract-id matches the deployed contract');
    process.exit(1);
  }
}

