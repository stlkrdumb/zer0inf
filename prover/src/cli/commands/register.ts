/**
 * Zer0Inf — register Command
 * 
 * Loads a weights JSON, computes SHA-256 hash, saves metadata.
 * Optionally registers on-chain if --secret is provided.
 */

import { join } from 'node:path';
import type { CLIArgs } from '../index.js';
import { loadJSON, saveJSON } from '../utils.js';
import { submitInference, getConfig } from '../../onchain/index.js';
import { ProofData } from '../utils.js';

export async function cmdRegister(args: CLIArgs): Promise<void> {
  const opts = args.options;
  const positional = args.positional as string[];

  if (positional.length === 0) {
    console.error('Error: weights file path is required');
    console.log('  Usage: zer0inf register <weights.json> [--description "..."]');
    process.exit(1);
  }

  const weightsPath = positional[0];
  const description = opts['description'] as string || 'Unspecified model';

  const weightsData = loadJSON<{ weights: number[]; output_weights: number[] }>(weightsPath);
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

  // Also register on-chain if a secret is provided
  if (opts['secret']) {
    try {
      const { registerModel } = await import('../../onchain/index.js');
      const config = getConfig({ secret: opts['secret'] as string });
      const modelHashBuf = Buffer.from(hashHex, 'hex');
      const regResult = await registerModel(config, modelHashBuf, description);
      console.log(`[zer0inf] On-chain registration tx: ${regResult.txHash}`);
      // Update model.json with on-chain model ID
      const updated = loadJSON<{ modelId?: number }>(outputPath);
      if (updated.modelId === undefined) {
        saveJSON(outputPath, { ...updated, modelId: 1 });
      }
    } catch (err) {
      console.error('[zer0inf] On-chain registration failed:', err instanceof Error ? err.message : String(err));
      console.log('[zer0inf] Model metadata was saved locally. Try again with --secret.');
    }
  }

  console.log(`\n[zer0inf] To submit inference, run:`);
  console.log(`  zer0infer infer --weights <weights.json>`);
  console.log(`  zer0infer verify`);
  console.log(`  zer0infer submit --contract-id <contract_id>`);
}
