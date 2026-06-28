#!/usr/bin/env node
/**
 * Zer0Inf — Command-Line Interface
 * 
 * Thin dispatcher that routes CLI commands to dedicated modules.
 */

import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Import command modules (loaded dynamically)
import { cmdHelp } from './commands/help.js';
import { cmdRegister } from './commands/register.js';
import { cmdInfer } from './commands/infer.js';
import { cmdVerify } from './commands/verify.js';
import { cmdSubmit } from './commands/submit.js';
import { cmdDeploy } from './commands/deploy.js';
import { cmdStatus } from './commands/status.js';
import { cmdExportVK } from './commands/export-vk.js';

// ── CLI Argument Parsing ───────────────────────────────────────────

export interface CLIArgs {
  command: string;
  positional: string[];
  options: Record<string, string | boolean>;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        options[key] = args[i + 1];
        i += 2;
      } else {
        options[key] = true;
        i += 1;
      }
    } else {
      positional.push(args[i]);
      i += 1;
    }
  }
  return { command: positional[0] || 'help', positional: positional.slice(1), options };
}

// ── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Ensure output directory exists
  const outDir = join(process.cwd(), 'output');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const args = parseArgs();

  switch (args.command) {
    case 'help':     await cmdHelp(args); break;
    case 'register': await cmdRegister(args); break;
    case 'deploy':   await cmdDeploy(args); break;
    case 'infer':    await cmdInfer(args); break;
    case 'verify':   await cmdVerify(args); break;
    case 'submit':   await cmdSubmit(args); break;
    case 'export-vk': await cmdExportVK(args); break;
    case 'status':   await cmdStatus(); break;
    default:
      console.error(`Unknown command: ${args.command}`);
      await cmdHelp(args);
      process.exit(1);
  }
}

main().catch(err => {
  console.error('[zer0inf] Error:', err.message);
  process.exit(1);
});
