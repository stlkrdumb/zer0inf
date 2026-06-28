/**
 * Zer0Inf — export-vk Command
 * 
 * Extracts the UltraHonk verification key from the Noir circuit using bb.js.
 * Saves to output/verification_key.bin and output/verification_key.hex
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import crypto from 'node:crypto';
import type { CLIArgs } from '../index.js';

// Resolve project root (same logic as generate.ts)
function getProjectRoot(): string {
  const modDir = dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
  const candidate = join(modDir, '../..', '..');
  if (existsSync(join(candidate, 'circuit', 'Nargo.toml'))) {
    return candidate;
  }
  return process.cwd();
}

export async function cmdExportVK(args: CLIArgs): Promise<void> {
  const PROJECT_ROOT = getProjectRoot();
  const CIRCUIT_DIR = join(PROJECT_ROOT, 'circuit');
  const TARGET_DIR = join(CIRCUIT_DIR, 'target');
  const OUTPUT_DIR = join(PROJECT_ROOT, 'output');

  console.log('[zer0inf] Extracting UltraHonk verification key...');

  // Load compiled circuit
  const acirPath = join(TARGET_DIR, 'zer0inf.json');
  if (!existsSync(acirPath)) {
    console.error('[zer0inf] Circuit not compiled. Run: cd circuit && nargo compile');
    process.exit(1);
  }

  const rawCircuit = JSON.parse(readFileSync(acirPath, 'utf-8'));

  // Import bb.js
  console.log('[zer0inf] Initializing Barretenberg...');
  const bb = await import('@aztec/bb.js');
  const Barretenberg = bb.Barretenberg;
  const UltraHonkBackend = bb.UltraHonkBackend;

  const barretenbergAPI = await Barretenberg.new();
  const backend = new UltraHonkBackend(rawCircuit.bytecode, barretenbergAPI as any);

  // Extract verification key
  console.log('[zer0inf] Getting verification key...');
  const vk = await backend.getVerificationKey();
  
  if (!vk || vk.length === 0) {
    console.error('[zer0inf] Failed to extract VK — empty result');
    process.exit(1);
  }

  console.log(`[zer0inf] VK extracted: ${vk.length} bytes`);

  // Save VK to output
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const vkPath = join(OUTPUT_DIR, 'verification_key.bin');
  writeFileSync(vkPath, Buffer.from(vk));
  
  // Also save as hex for easy embedding
  const vkHex = Buffer.from(vk).toString('hex');
  const vkHexPath = join(OUTPUT_DIR, 'verification_key.hex');
  writeFileSync(vkHexPath, vkHex);

  console.log(`[zer0inf] VK saved to output/verification_key.bin (${vk.length} bytes)`);
  console.log(`[zer0inf] VK hex saved to output/verification_key.hex`);
  console.log(`[zer0inf] VK hash: ${crypto.createHash('sha256').update(Buffer.from(vk)).digest('hex').slice(0, 16)}...`);
  console.log(`[zer0inf] First 32 bytes (hex): ${vkHex.slice(0, 64)}`);
}
