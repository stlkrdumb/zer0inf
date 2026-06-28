/**
 * Zer0Inf — On-Chain Integration (Stellar Testnet)
 * 
 * Uses generated TypeScript bindings from the Soroban contract.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { Networks, Keypair, contract } from '@stellar/stellar-sdk';
import { DEFAULT_RPC_URL, DEFAULT_HORIZON_URL, STELLAR_NETWORKS } from '../types/index.js';

// ── Types ────────────────────────────────────────────────────

export interface OnchainConfig {
  secret: string;
  contractId?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
}

export interface SubmitResult {
  transactionHash: string;
  inferenceId: number;
}

export interface ModelInfo {
  modelHash: string;
  description: string;
  version: number;
}

// ── Helpers ──────────────────────────────────────────────────

function loadEnv(): void {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  }
}

export function getConfig(opts?: {
  secret?: string;
  contractId?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
}): OnchainConfig {
  loadEnv();
  const secret = opts?.secret || process.env.STELLAR_SECRET || '';
  if (!secret) {
    throw new Error(
      '[zer0inf] Missing Stellar secret key.\n' +
      '  Set STELLAR_SECRET in .env or pass --secret <key>.\n' +
      '  Get a testnet key: https://laboratory.stellar.org/'
    );
  }
  return {
    secret,
    contractId: opts?.contractId || process.env.STELLAR_CONTRACT_ID || '',
    rpcUrl: opts?.rpcUrl || process.env.STELLAR_RPC || DEFAULT_RPC_URL,
    networkPassphrase: opts?.networkPassphrase || STELLAR_NETWORKS.TESTNET.networkPassphrase,
  };
}

// ── Client Factory ───────────────────────────────────────────

/**
 * Create a typed contract client from the generated bindings.
 * Follows the SDK pattern: basicNodeSigner + Client with proper types.
 */
async function createClient(config: OnchainConfig) {
  const { Client } = await import('../client/src/index.js');
  const kp = Keypair.fromSecret(config.secret);
  const networkPassphrase = config.networkPassphrase || Networks.TESTNET;
  const { signTransaction } = contract.basicNodeSigner(kp, networkPassphrase);

  return new Client({
    contractId: config.contractId!,
    networkPassphrase,
    rpcUrl: config.rpcUrl || DEFAULT_RPC_URL,
    publicKey: kp.publicKey(),
    signTransaction,
  });
}

// ── Register Model ───────────────────────────────────────────

export async function registerModel(
  config: OnchainConfig,
  modelHash: Buffer,
  description: string,
  version: number = 1,
): Promise<{ hash: string; txHash?: string }> {
  const client = await createClient(config);

  console.log(`[zer0inf] Registering model #1...`);

  const callerAddress = Keypair.fromSecret(config.secret).publicKey();

  // Preview with simulation
  const tx = await client.register({
    caller: callerAddress,
    model_hash: modelHash,
    description,
    version,
  });

  console.log(`[zer0inf] Simulation result: ${tx.result}`);

  // Sign and send
  const sent = await tx.signAndSend();
  console.log(`[zer0inf] ✓ Model registered!`);
  const txHash = sent.sendTransactionResponse?.hash || '';
  console.log(`[zer0inf] Tx hash: ${txHash}`);
  console.log(`[zer0inf] Explorer: ${DEFAULT_HORIZON_URL}/transactions/${txHash}`);

  // Save contract ID
  const idPath = join(process.cwd(), 'output', 'contract-id.txt');
  if (!existsSync(idPath)) {
    writeFileSync(idPath, config.contractId!);
  }

  return { hash: modelHash.toString('hex'), txHash };
}

// ── Submit Inference ─────────────────────────────────────────

export async function submitInference(
  config: OnchainConfig,
  modelId: number,
  proofBytes: Buffer,
  publicInputs: Buffer,
  decision: boolean,
  confidence: number,
): Promise<SubmitResult> {
  const client = await createClient(config);

  console.log(`[zer0inf] Submitting inference to Soroban contract...`);
  const submitKp = Keypair.fromSecret(config.secret);
  console.log(`[zer0inf] Account: ${submitKp.publicKey()}`);
  console.log(`[zer0inf] Contract: ${config.contractId}`);
  console.log(`[zer0inf] Model ID: ${modelId}, Decision: ${decision ? 'APPROVE' : 'DENY'}, Confidence: ${(confidence / 10).toFixed(1)}%`);

  // Preview with simulation
  const tx = await client.submit_inference({
    caller: submitKp.publicKey(),
    model_id: modelId,
    proof_bytes: proofBytes,
    public_inputs: publicInputs,
    decision,
    confidence,
  });

  console.log(`[zer0inf] Simulation result: ${tx.result}`);

  // Sign and send
  const sent = await tx.signAndSend();
  console.log(`[zer0inf] ✓ Transaction confirmed!`);
  const submitTxHash = sent.sendTransactionResponse?.hash || '';
  console.log(`[zer0inf] Tx hash: ${submitTxHash}`);
  console.log(`[zer0inf] Explorer: ${DEFAULT_HORIZON_URL}/transactions/${submitTxHash}`);

  // Save contract ID for future use
  const idPath = join(process.cwd(), 'output', 'contract-id.txt');
  if (!existsSync(idPath) && config.contractId) {
    writeFileSync(idPath, config.contractId);
  }

  return {
    transactionHash: submitTxHash,
    inferenceId: modelId,
  };
}

// ── Query Methods ────────────────────────────────────────────

export async function getModelCount(config: OnchainConfig): Promise<number> {
  const client = await createClient(config);
  const tx = await client.get_model_count();
  return Number(tx.result);
}

export async function getModelInfo(
  config: OnchainConfig,
  modelId: number,
): Promise<ModelInfo> {
  const client = await createClient(config);
  const tx = await client.get_model({ model_id: modelId });
  const [hash, desc, version] = tx.result as [Buffer, string, number];
  return {
    modelHash: hash.toString('hex'),
    description: desc,
    version,
  };
}

export async function getInference(
  config: OnchainConfig,
  inferenceId: number,
): Promise<{ inferenceId: number; decision: boolean; confidence: number }> {
  const client = await createClient(config);
  const tx = await client.get_inference({ inference_id: BigInt(inferenceId) });
  const [id, decision, confidence] = tx.result as [number, boolean, number];
  return { inferenceId: id, decision, confidence };
}

export async function listModels(config: OnchainConfig): Promise<number[]> {
  const client = await createClient(config);
  const tx = await client.list_models();
  return (tx.result as number[]).sort((a, b) => a - b);
}
