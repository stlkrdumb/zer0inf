# Plan: P0 + P1 Improvements — Zer0Inf Codebase

**Goal:** Fix all structural, reliability, and DX issues before demo video / hackathon submission.  
**Scope:** 10 findings (5 P0 + 5 P1) → 6 implementation tasks.  
**Effort:** ~2-3 hours total (can run in parallel where possible).  
**Risk Level:** Low — all changes are refactors, renames, and additions. No circuit/contract logic changes.

---

## Execution Order & Dependencies

```
Phase A (instant) ──→ Phase B (foundation) ──→ Phase C (refactors) ──→ Phase D (finalize)
   #9 gitkeep            #5 tests                  #6 CLI split          #3 README fix
#1 output dir           #4 backup cleanup         #7 RPC centralize     #10 build artifacts
   #2 client rename       (foundation for C)       #8 path robustness    (verification)
```

**Order rationale:** Fix directory structure and naming first (#1, #9, #2), then add tests for safety (#5), then refactor code with test coverage as guardrails (#6, #7, #8), then clean up artifacts (#3, #10).

---

## Task 1 — Consolidate Output Directory [P0]

**Problem:** Two output directories exist:
- `output/` at project root — contains `proof.json`, `model.json`, `contract-id.txt` (used by CLI)
- `prover/output/` — contains `proof.json` only (referenced in .gitignore but never written to)

CLI writes to `output/` but `.gitignore` references `prover/output/*`. Confusing duplication.

**Current Code Locations:**
- `prover/src/cli/index.ts` — uses `OUTPUT_DIR = './output'`
- `.gitignore:30-34` — lists `prover/output/*.json` etc. (wrong directory)
- No code writes to `prover/output/`

### Steps

1. **Update .gitignore** — remove `prover/output/*` lines, ensure root `output/*` is covered.  
   Remove these lines from `.gitignore`:
   ```
   prover/output/*.json
   prover/output/contract-id.txt
   prover/output/model.json
   prover/output/proof.json
   prover/output/contract-config.json
   ```
   Add these instead:
   ```
   output/*.json
   output/*.txt
   ```

2. **Remove `prover/output/` directory** — it's empty/dead code:
   ```bash
   rm -rf prover/output
   ```

3. **Update any remaining references** — grep for `prover/output` in source:
   ```bash
   grep -rn "prover/output" prover/src contract/src 2>/dev/null
   ```
   If any found, change to relative paths from `prover/` → `'../output'`.

4. **Verify** — run demo end-to-end:
   ```bash
   rm -f output/*.json && node prover/dist/cli/index.js infer && ls output/proof.json
   ```

### Acceptance Criteria
- No code references `prover/output/` directory
- `.gitignore` excludes `output/*` (all JSON and txt files)
- CLI writes to `output/` at project root — single canonical location
- Demo `rm -f output/*.json && npm run demo` works cleanly

### Risk: None  
Pure configuration + directory cleanup. No code logic changes.

---

## Task 2 — Rename Client Package [P0]

**Problem:** Root package is `zer0inf@0.1.0`. Nested client package at `prover/src/client/package.json` is also named `zer0inf@0.0.1`. Same name in one repo causes npm confusion.

### Steps

1. **Update `prover/src/client/package.json` name field:**
   ```json
   {
     "name": "@zer0inf/contract-client",
     "version": "0.0.1",
     ...
   }
   ```

2. **If client is imported anywhere:** Check for imports:
   ```bash
   grep -rn "@zer0inf" prover/src --include='*.ts' 2>/dev/null || echo "(none)"
   ```

3. **Update root `package.json` scripts** if there's a build step referencing the client:
   ```bash
   grep -n "client" package.json
   ```

4. **Update README.md** — any reference to the client package name:
   ```bash
   grep -n "zer0inf.*client\|client/package" README.md
   ```

### Acceptance Criteria
- Root package: `zer0inf@0.1.0`
- Client package: `@zer0inf/contract-client@0.0.1` (no conflict)
- `npm install` from project root completes without warnings

### Risk: Very Low  
Only a name change in `package.json`. No behavioral impact.

---

## Task 3 — Fix Client README [P0]

**Problem:** `prover/src/client/README.md` says "Generated Files: src/contract.ts" but the actual file is `src/client.ts`. One wrong filename.

### Steps

1. **Open and fix one line in `prover/src/client/README.md`:**
   ```diff
   - - `src/contract.ts` - Client implementation
   + - `src/client.ts` - Client implementation
   ```

2. **Verify the Usage section** — imports use `./src` which resolves to `src/index.ts`. That is correct. Keep as-is.

### Acceptance Criteria
- All file paths in README are correct (verified against actual directory)
- No incorrect filenames in documentation

### Risk: None  
One-line documentation fix.

---

## Task 4 — Remove Stale Circuit Backup [P0]

**Problem:** `circuit/src/main.nr.bak` exists and differs from current `main.nr`. It's a stale backup that clutters the source tree.

### Steps

1. **Verify current circuit compiles before deletion:**
   ```bash
   cd circuit && nargo check 2>&1 | tail -3; echo "Exit: $?"
   ```

2. **Confirm it differs:**
   ```bash
   diff -q main.nr main.nr.bak
   # Expected: Files differ
   ```

3. **Delete the backup:**
   ```bash
   rm circuit/src/main.nr.bak
   ```

### Acceptance Criteria
- `circuit/src/main.nr` compiles successfully
- `circuit/src/main.nr.bak` no longer exists
- Not present in next git diff

### Risk: Very Low  
Deletion of a backup file. Circuit compiles first as confirmation.

---

## Task 5 — Add Characterization Tests [P0]

**Problem:** Zero test files exist. Neural network math, proof generation, and contract encoding paths have no regression guardrails. Adding tests before refactoring (Task 6) prevents regressions.

Vitest `^3.0.0` is already installed with `"test": "vitest run"` script in `prover/package.json`.

### Target Functions to Test

| File | Function | What it does | Testable? |
|------|----------|-------------|-----------|
| `prover/src/types/index.ts` | `runInference(input, weights)` | Core neural network math (matrix multiply + ReLU + sigmoid) | YES — pure function |
| `prover/src/types/index.ts` | `toFixed(value, decimals)` | Fixed-point rounding helper (uses Math.round + scale) | YES — pure function |

### Steps

1. **Create test file:** `prover/src/__tests__/types.test.ts`

2. **Run inference once to capture expected values, then hardcode them:**
   ```bash
   rm -f output/proof.json && node prover/dist/cli/index.js infer 2>&1 | grep -E "confidence|decision|rawOutput"
   ```
   Use the exact numbers from this output in test assertions.

3. **Write three test cases:**
   - **Demo weights test:** Run with sample credit model weights + sample inputs, assert `decision`, `confidence`, and `rawOutput` match captured values
   - **ReLU boundary test:** Feed input that produces negative pre-activation, verify hidden layer outputs 0 for those neurons
   - **Edge case test:** All-zero inputs should produce known output (bias-driven), all-ones should be within expected range

4. **Verify tests run:**
   ```bash
   npm run test --workspace=zer0inf-prover
   ```

### Acceptance Criteria
- `npm run test --workspace=zer0inf-prover` runs and all tests pass
- Tests cover `runInference()` with at least 3 scenarios (demo weights, ReLU boundary, edge case)
- Tests do NOT require network access or noir_js WASM loading
- Test file is under `prover/src/__tests__/` (not mixed with src/)

### Risk: Low  
Pure test additions. No production code changes.

---

## Task 6 — Split CLI into Modules [P1]

**Problem:** `prover/src/cli/index.ts` is 447 lines handling arg parsing, 7 commands, all formatting in one file. Hard to maintain, test, or extend.

### New Structure

```
prover/src/cli/
├── index.ts              ← ~30-50 lines: arg dispatch + main() entry point
├── utils.ts              ← ~30-40 lines: helpers (formatResult, colorize)
└── commands/
    ├── register.ts       ← ~60 lines: model registration flow
    ├── infer.ts          ← ~50 lines: inference execution
    ├── verify.ts         ← ~40 lines: proof verification
    ├── submit.ts         ← ~60 lines: on-chain submission
    └── status.ts         ← ~40 lines: project status display
```

### Steps

1. **Extract `utils.ts`** — move formatting helpers to a shared utility file.

2. **Extract command handlers** — each command becomes a function:
   ```typescript
   // prover/src/cli/commands/register.ts
   export async function cmdRegister(weightsFile: string, description: string): Promise<void>
   ```

3. **Rewrite `index.ts`** to be a dispatcher:
   ```typescript
   const commands: Record<string, () => Promise<any>> = {
     register: () => import('./commands/register.js').then(m => m.cmdRegister),
     infer:    () => import('./commands/infer.js').then(m => m.cmdInfer),
     verify:   () => import('./commands/verify.js').then(m => m.cmdVerify),
     submit:   () => import('./commands/submit.js').then(m => m.cmdSubmit),
     status:   () => import('./commands/status.js').then(m => m.cmdStatus),
   };
   ```

4. **Preserve behavior** — every existing CLI command must work identically. Verify:
   ```bash
   node prover/dist/cli/index.js register data/sample-weights.json --description "Test"
   node prover/dist/cli/index.js infer
   node prover/dist/cli/index.js verify --proof output/proof.json
   node prover/dist/cli/index.js status
   ```

5. **Verify with demo script:**
   ```bash
   rm -f output/*.json && npm run demo
   ```

### Acceptance Criteria
- `index.ts` reduced from 447 lines to <=60 lines
- Each command file is <=80 lines (self-contained)
- All existing CLI commands work identically (verified via `npm run demo`)
- No broken imports after build (`npx tsc --noEmit` passes)

### Risk: Medium  
Refactoring existing code. Mitigated by Task 5 (tests). Demo script serves as integration test.

---

## Task 7 — Centralize RPC URLs [P1]

**Problem:** Soroban Testnet URL `'https://soroban-testnet.stellar.org'` and Horizon URL are hardcoded in 4+ locations:
- `prover/src/types/index.ts:111-112` (defaults constant)
- `prover/src/onchain/index.ts:58` (default fallback)
- `prover/src/onchain/index.ts:76` (config load fallback)
- `prover/src/cli/index.ts:344,379` (console output)

### Steps

1. **Define a single source of truth in `prover/src/types/index.ts`:**
   ```typescript
   export const STELLAR_CONFIG = {
     TESTNET: {
       rpcUrl: 'https://soroban-testnet.stellar.org',
       horizonUrl: 'https://testnet.stellar.org',
     },
   } as const;

   export const DEFAULT_RPC_URL = STELLAR_CONFIG.TESTNET.rpcUrl;
   export const DEFAULT_HORIZON_URL = STELLAR_CONFIG.TESTNET.horizonUrl;
   ```

2. **Update `prover/src/onchain/index.ts`:**
   - Import `STELLAR_CONFIG` and `DEFAULT_*` from `../types/index.js`
   - Replace all hardcoded `'https://soroban-testnet.stellar.org'` with `DEFAULT_RPC_URL`
   - Replace `Networks.TESTNET` constant usage (if any) to use from config

3. **Update `prover/src/cli/index.ts` console output:**
   - Replace hardcoded Horizon URLs with `DEFAULT_HORIZON_URL`

4. **Verify** — grep to confirm all references go through the config:
   ```bash
   grep -rn "soroban-testnet.stellar.org" prover/src --include='*.ts'
   # Should only find types/index.ts (the definition) and usage via constants
   ```

### Acceptance Criteria
- Soroban RPC URL appears ONCE as a literal (in `types/index.ts` STELLAR_CONFIG)
- All other files reference it via `DEFAULT_RPC_URL` or `STELLAR_CONFIG.TESTNET.rpcUrl`
- Adding a new network (mainnet, sandbox) only requires editing `types/index.ts`
- CLI still works: `npm run demo` succeeds

### Risk: Very Low  
Constant extraction. No behavioral change — same URLs, just centralized.

---

## Task 8 — Make Path Resolution Robust [P1]

**Problem:** `prover/src/proof/generate.ts:20-25` uses fragile 3-level path navigation:
```typescript
const __dirname = dirname(new URL(import.meta.url).pathname);
const projectRoot = resolvePath(__dirname, '..', '..');  // Goes to project root
```
If `generate.ts` moves (e.g., to `cli/commands/` during Task 6), all paths break silently.

### Steps

1. **Add `getProjectRoot()` function in `prover/src/proof/generate.ts`:**
   ```typescript
   import { existsSync, join, dirname } from 'node:fs';
   import { dirname as pathDirname, resolve as resolvePath } from 'node:path';

   function getProjectRoot(): string {
     // Priority 1: env var (set by npm scripts or CI)
     if (process.env.ZER0INF_ROOT) return process.env.ZER0INF_ROOT;

     // Priority 2: import.meta.dirname (Node 24+ available here)
     if (import.meta.url) {
       const srcDir = dirname(new URL(import.meta.url).pathname);
       const root = resolvePath(srcDir, '..', '..');
       if (existsSync(join(root, 'circuit', 'Nargo.toml'))) return root;
     }

     // Priority 3: fallback to CWD
     return process.cwd();
   }
   ```

2. **Replace existing path resolution** with `getProjectRoot()` call.

3. **Add validation guard:**
   ```typescript
   const acirPath = join(PROJECT_ROOT, 'circuit', 'target', ...);
   if (!existsSync(acirPath)) {
     console.error(`[zer0inf] Circuit ACIR not found: ${acirPath}`);
     process.exit(1);
   }
   ```

4. **Test from different working directories:**
   ```bash
   node prover/dist/cli/index.js infer              # from project root
   ZER0INF_ROOT=/run/media/rai/VenomRX/Dev/zer0inf node prover/dist/cli/index.js infer  # explicit
   ```

### Acceptance Criteria
- `generate.ts` can relocate to `cli/commands/` without path breaks
- Path validation fails fast with clear error message (not silent crash)
- Works when run from any working directory
- Demo script passes

### Risk: Low  
Path resolution is a utility pattern. Adding env var fallback + validation makes it safer.

---

## Task 9 — Add .gitkeep Files [P1]

**Problem:** `output/` directory has no `.gitkeep`. Git won't create it on fresh clone.

### Steps

1. **Create the file:**
   ```bash
   touch output/.gitkeep
   ```

2. **Commit it** (in Session 1 with other quick fixes).

### Acceptance Criteria
- `output/.gitkeep` exists and is tracked by git
- Fresh clone preserves `output/` directory

### Risk: None  
Single file addition.

---

## Task 10 — Remove Build Artifacts from Source Tree [P1]

**Problem:** `.js` and `.d.ts` files are committed alongside `.ts` source files (8 total):
```
prover/src/cli/index.js              prover/src/onchain/index.js
prover/src/cli/index.d.ts            prover/src/onchain/index.d.ts
prover/src/proof/generate.js         prover/src/proof/generate.d.ts
prover/src/types/index.js            prover/src/types/index.d.ts
```

Build output belongs in `dist/`, not mixed with source.

### Steps

1. **Remove from git index (keep local copies for dev):**
   ```bash
   cd prover/src
   git rm --cached cli/*.js cli/*.d.ts \
                  onchain/*.js onchain/*.d.ts \
                  proof/*.js proof/*.d.ts \
                  types/*.js types/*.d.ts 2>/dev/null || true
   ```

2. **Update `.gitignore`** — after Task 1 removes `prover/output/` lines, add:
   ```diff
   # Build output
   + prover/dist/
   + prover/src/*.js
   + prover/src/*.d.ts
   + prover/src/**/*.js
   + prover/src/**/*.d.ts
   dist/
   circuit/target/
   ```

3. **Rebuild to verify dist/ output still works:**
   ```bash
   cd /run/media/rai/VenomRX/Dev/zer0inf && npm run build
   ```

4. **Verify clean state:**
   ```bash
   git status  # No uncommitted .js/.d.ts in src/ directories
   ls prover/src/cli/*.js prover/src/onchain/*.js  # Should show "No such file"
   ls prover/dist/cli/*.js  prover/dist/onchain/*.js  # Should exist
   ```

### Acceptance Criteria
- No `.js` or `.d.ts` files exist directly in any `src/` directory
- All compiled output is only under `prover/dist/`
- `git status` shows clean removal
- `npm run build` regenerates `prover/dist/` correctly
- Demo script works after rebuild

### Risk: Low  
Deleting committed artifacts. Rebuild verification catches any issues.

---

## Summary Table

| # | Priority | Task | Effort | Risk | Depends On |
|---|----------|------|--------|------|------------|
| 1 | P0 | Consolidate output directory | 20 min | None | — |
| 2 | P0 | Rename client package | 10 min | Very Low | — |
| 3 | P0 | Fix client README (1 filename) | 5 min | None | — |
| 4 | P0 | Remove stale backup | 5 min | Very Low | — |
| 5 | P0 | Add characterization tests | 60-90 min | Low | — |
| 6 | P1 | Split CLI into modules | 30-60 min | Medium | #5 |
| 7 | P1 | Centralize RPC URLs | 20 min | Very Low | #5 |
| 8 | P1 | Make path resolution robust | 20 min | Low | #5, #6 |
| 9 | P1 | Add .gitkeep files | 5 min | None | — |
| 10| P1 | Remove build artifacts from source | 30 min | Low | — |
| **Total** | | | **~2-3 hours** | | |

---

## Execution Plan (Step-by-Step)

### Session 1 (30 min): Quick Wins + Foundation

```bash
# Task 9: Add .gitkeep
touch output/.gitkeep

# Task 4: Remove backup
rm circuit/src/main.nr.bak

# Task 1: Consolidate output
#   - Edit .gitignore: remove prover/output/* lines, add output/* lines
#   - Delete prover/output/ directory

# Task 2: Rename client package
#   - Edit prover/src/client/package.json: name -> "@zer0inf/contract-client"

# Verify nothing broke:
npm run build

# Commit:
git add -A && git commit -m "fix: clean up project structure (P0 quick fixes)"
```

### Session 2 (90 min): Tests + Build Cleanup

```bash
# Task 5: Add characterization tests
#   - Create prover/src/__tests__/types.test.ts
#   - Capture expected values from demo run
#   - Write 3 test cases (demo, ReLU boundary, edge case)
#   - Run: npm run test --workspace=zer0inf-prover

# Task 10: Remove build artifacts
#   - git rm --cached prover/src/**/*.js prover/src/**/*.d.ts
#   - Add patterns to .gitignore
#   - Rebuild: npm run build
#   - Verify: node prover/dist/cli/index.js infer

# Commit:
git add -A && git commit -m "test: add characterization tests for neural network math"
```

### Session 3 (60 min): Code Refactoring

```bash
# Task 7: Centralize RPC URLs
#   - Edit prover/src/types/index.ts -> add STELLAR_CONFIG constant
#   - Update onchain/index.ts to use constants
#   - Update cli/index.ts console output

# Task 8: Robust path resolution
#   - Add getProjectRoot() helper to generate.ts
#   - Add validation guard for ACIR existence

# Task 6: Split CLI (do this last -- refactors the most code)
#   - Create commands/register.ts, infer.ts, verify.ts, submit.ts, status.ts
#   - Rewrite index.ts to dispatch
#   - Verify: npm run demo

# Task 3: Fix README (1 line change)

# Commit:
git add -A && git commit -m "refactor: split CLI modules, centralize RPC config, improve path resolution"
```

### Final Verification (15 min)

```bash
# Full clean build + demo
rm -rf prover/dist contract/target/wasm32-unknown-unknown/release
cd prover && npm install && cd ..
npm run build
npm run demo  # end-to-end regression test

# Type check
cd prover && npx tsc --noEmit && cd ..

# Test suite
npm run test --workspace=zer0inf-prover

# Git status
git status
```

---

## Notes for AI Agent Executing This Plan

1. **Always verify with `npm run demo` after each session** — it's the integration test
2. **Do Task 5 (tests) before Task 6 (CLI split)** — tests are your safety net
3. **Task 7 is safest** — just constant extraction, no behavior change
4. **When splitting CLI (Task 6), preserve exact output format** — judges will see this in demo video
5. **Do NOT modify circuit code, contract code, or proof generation logic** — only refactor organization and configuration
6. **If any command breaks after a refactor, revert that session's changes before proceeding**
7. **Commit at natural breakpoints** (end of each session) for easy rollback
