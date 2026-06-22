/**
 * Zer0Inf — On-Chain Integration (Stellar Testnet)
 *
 * Deploy Soroban contract and submit ZK proofs via Stellar SDK v16 + Soroban SDK v27.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { Keypair, Account, Networks, BASE_FEE, } from '@stellar/stellar-sdk';
import { rpc } from '@stellar/stellar-sdk';
// ── Constants ────────────────────────────────────────────────
const TESTNET_RPC = 'https://soroban-testnet.stellar.org';
const TESTNET_HORIZON = 'https://horizon-testnet.stellar.org';
const TESTNET_PASSPHRASE = Networks.TESTNET;
// ── Helpers ──────────────────────────────────────────────────
async function fetchAccount(publicKey) {
    const resp = await fetch(`${TESTNET_HORIZON}/accounts/${publicKey}`);
    if (!resp.ok)
        throw new Error(`Horizon error ${resp.status}: not found`);
    const data = await resp.json();
    return new Account(publicKey, data.sequence);
}
// ── Config ───────────────────────────────────────────────────
function loadEnv() {
    const envPath = join(process.cwd(), '.env');
    if (existsSync(envPath)) {
        const raw = readFileSync(envPath, 'utf-8');
        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1)
                continue;
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            process.env[key] = value;
        }
    }
}
export function getConfig(opts) {
    loadEnv();
    const secret = opts?.secret || process.env.STELLAR_SECRET || '';
    if (!secret) {
        throw new Error('No Stellar secret key provided. Use --secret or set STELLAR_SECRET.');
    }
    return {
        secret,
        rpcUrl: process.env.STELLAR_RPC || TESTNET_RPC,
    };
}
// ── Submit Inference via Contract Client (SDK v16 + SDK v27) ─
export async function submitInference(contractId, config, modelId, decision, confidence, proofHash) {
    const server = new rpc.Server(config.rpcUrl || TESTNET_RPC);
    const kp = Keypair.fromSecret(config.secret);
    const sourceAddress = kp.publicKey();
    console.log(`[zer0inf] Account: ${sourceAddress}`);
    console.log(`[zer0inf] Contract: ${contractId}`);
    console.log(`[zer0inf] Method:   submit_inference`);
    console.log(`[zer0inf] Model ID: ${modelId}, Decision: ${decision ? 'APPROVE' : 'DENY'}, Confidence: ${(confidence * 100).toFixed(1)}%`);
    // Fetch account sequence
    const sourceAccount = await fetchAccount(sourceAddress);
    // Get contract spec
    const { Contract, Address, nativeToScVal, ScInt } = require('@stellar/stellar-sdk');
    const signTransaction = Contract.basicNodeSigner(kp, TESTNET_PASSPHRASE);
    // Build the client
    const client = await Contract.Client.from({
        contractId,
        rpcUrl: config.rpcUrl || TESTNET_RPC,
        networkPassphrase: TESTNET_PASSPHRASE,
        publicKey: sourceAddress,
        signTransaction,
    });
    // Build arguments matching contract ABI
    const confidenceU32 = Math.round(confidence * 1000);
    const args = {
        modelId: new ScInt(Number(modelId)).toI32(),
        proofHash: Buffer.from(proofHash || crypto.randomBytes(32)),
        decision: decision,
        confidence: new ScInt(confidenceU32).toU32(),
    };
    // Build transaction
    const tx = await client.submit_inference(args, {
        fee: BASE_FEE,
        buildOnly: true,
    });
    // Sign and send
    const sentTx = await tx.signAndSend();
    console.log(`[zer0inf] ✓ Transaction confirmed!`);
    console.log(`[zer0inf] Tx hash: ${sentTx.hash}`);
    // Save contract ID for future use
    const idPath = join(process.cwd(), 'output', 'contract-id.txt');
    if (!existsSync(idPath)) {
        require('fs').writeFileSync(idPath, contractId);
    }
    return {
        transactionHash: sentTx.hash,
        inferenceId: modelId,
    };
}
// ── Query Contract Methods ───────────────────────────────────
/** Get a single inference result */
export async function getInference(contractId, config, inferenceId) {
    const server = new rpc.Server(config.rpcUrl || TESTNET_RPC);
    const { Contract, ScInt } = require('@stellar/stellar-sdk');
    const client = await Contract.Client.from({
        contractId,
        rpcUrl: config.rpcUrl || TESTNET_RPC,
        networkPassphrase: TESTNET_PASSPHRASE,
    });
    const result = await client.get_inference({ id: new ScInt(inferenceId).toU64() }, { simulateOnly: true });
    return result.result;
}
/** Get model count */
export async function getModelCount(contractId, config) {
    const { Contract, ScInt } = require('@stellar/stellar-sdk');
    const client = await Contract.Client.from({
        contractId,
        rpcUrl: config.rpcUrl || TESTNET_RPC,
        networkPassphrase: TESTNET_PASSPHRASE,
    });
    const result = await client.get_model_count(undefined, { simulateOnly: true });
    return Number(result.result?.val ?? 0);
}
