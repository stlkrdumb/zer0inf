/**
 * Zer0Inf — deploy Command
 * 
 * Prints deployment instructions or shows current on-chain status.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';
import type { CLIArgs } from '../index.js';
import { getConfig } from '../../onchain/index.js';
import { DEFAULT_RPC_URL } from '../../types/index.js';

export async function cmdDeploy(args: CLIArgs): Promise<void> {
  const opts = args.options;

  try {
    const config = getConfig({ secret: opts['secret'] as string });
    
    // Find WASM path
    let wasmPath = join(process.cwd(), 'contract', 'target', 'wasm32v1-none', 'release', 'zer0inf_contract.wasm');
    if (!existsSync(wasmPath)) {
      wasmPath = join(process.cwd(), 'contract', 'target', 'wasm32-unknown-unknown', 'release', 'zer0inf_contract.wasm');
    }
    
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
      console.log(`  RPC:         ${config.rpcUrl || DEFAULT_RPC_URL}`);
      console.log(`${'─'.repeat(50)}`);
    } else {
      console.log('\nTo deploy, use:');
      console.log('  stellar contract deploy --wasm <path> --network testnet --source deployer');
    }

  } catch (err) {
    console.error('[zer0inf] Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
