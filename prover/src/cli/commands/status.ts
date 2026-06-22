/**
 * Zer0Inf — status Command
 * 
 * Shows project state: proof file, model metadata, circuit compilation, WASM build.
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';

export async function cmdStatus(): Promise<void> {
  const projectRoot = process.cwd();
  const proofPath = join(projectRoot, 'output', 'proof.json');
  const modelPath = join(projectRoot, 'output', 'model.json');
  
  // Check in common locations for Noir circuit
  const noirLocations = [
    join(projectRoot, 'circuit', 'target', 'debug', 'zer0inf.nr.prover'),
    join(projectRoot, 'circuit', 'target', 'zer0inf.json'),
  ];
  const hasNoirCompiled = noirLocations.some(f => existsSync(f));
  
  // Check for compiled WASM
  const wasmPaths = [
    join(projectRoot, 'contract', 'target', 'wasm32-unknown-unknown', 'release', 'zer0inf_contract.wasm'),
    join(projectRoot, 'contract', 'target', 'wasm32v1-none', 'release', 'zer0inf_contract.wasm'),
  ];
  const hasWasm = wasmPaths.some(f => existsSync(f));

  console.log('[zer0inf] Project Status\n');
  console.log(`  Proof file:     ${existsSync(proofPath) ? '✓ Generated' : '✗ Not generated'}`);
  console.log(`  Model metadata: ${existsSync(modelPath) ? '✓ Registered' : '✗ Not registered'}`);
  console.log(`  Noir circuit:   ${hasNoirCompiled ? '✓ Compiled' : '⚠ Needs nargo compile'}`);
  console.log(`  Contract WASM:  ${hasWasm ? '✓ Built' : '✗ Not built'}`);
}
