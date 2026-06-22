/**
 * Zer0Inf — Neural Network Math Characterization Tests
 *
 * Validates the core inference math (matrix multiply, ReLU, sigmoid)
 * against known-good expected values. These are pure-function tests
 * that do NOT require network access or noir_js WASM loading.
 *
 * Run: npm run test --workspace=zer0inf-prover
 */

import { runInference } from '../proof/generate.js';
import type { InferInput } from '../types/index.js';

// Demo credit eligibility weights from data/sample-weights.json
const demoWeights = [
  0.25, -0.10, 0.30, 0.15, 0.20, -0.05, 0.10, 0.35,
  -0.15, 0.40, 0.05, 0.20, -0.10, 0.30, 0.15, -0.20,
  0.35, 0.10, 0.25, -0.15, 0.05, 0.20, 0.30, 0.10,
  -0.05, 0.35, 0.15, 0.25, -0.10, 0.05, 0.20, 0.40,
  0.30, -0.10, 0.15, 0.25, 0.35, -0.05, 0.10, 0.20,
  0.20, 0.15, 0.30, 0.05, -0.10, 0.40, 0.10, 0.25,
];

const demoOutputWeights = [0.35, 0.20, -0.15, 0.30, 0.10, 0.25];

// Normalized demo input (same normalization as CLI)
const demoInput: InferInput = {
  income: 75000 / 200000,              // 0.375
  debtRatio: 0.3 / 1,                  // 0.3
  savings: 25 / 500,                   // 0.05
  employmentYears: 8 / 30,             // 0.2667
  creditHistoryMonths: 60 / 240,       // 0.25
  loanAmount: 50 / 500,                // 0.1
  interestRate: 5.5 / 25,              // 0.22
  riskScore: 0.3 / 1,                  // 0.3
};

describe('runInference', () => {
  test('demo credit eligibility model — APPROVE with ~56.7% confidence', () => {
    const result = runInference(demoInput, demoWeights, demoOutputWeights);

    expect(result.decision).toBe(1);       // Approve (rawOutput >= 0.5)
    expect(typeof result.rawOutput).toBe('number');
    expect(typeof result.confidence).toBe('number');

    // Computed manually: pre-activation = 0.270467, sigmoid = 0.567207
    expect(result.rawOutput).toBeCloseTo(0.567207, 4);
    // confidence = rawOutput for approve decision (>= 0.5)
    expect(result.confidence).toBeCloseTo(0.5672, 3);
  });

  test('all-zero input — always outputs 0.5 (sigmoid baseline)', () => {
    const zeroInput: InferInput = {
      income: 0, debtRatio: 0, savings: 0, employmentYears: 0,
      creditHistoryMonths: 0, loanAmount: 0, interestRate: 0, riskScore: 0,
    };

    const result = runInference(zeroInput, demoWeights, demoOutputWeights);

    // With all-zero inputs, hidden layer is [0,0,0,0,0,0], outputSum = 0, sigmoid(0) = 0.5
    expect(result.rawOutput).toBeCloseTo(0.500000, 6);
    expect(result.decision).toBe(1);       // 0.5 >= 0.5 → APPROVE (tie-break)
    expect(result.confidence).toBeCloseTo(0.5, 6);
  });

  test('all-ones input — strong positive signal, higher confidence', () => {
    const onesInput: InferInput = {
      income: 1, debtRatio: 1, savings: 1, employmentYears: 1,
      creditHistoryMonths: 1, loanAmount: 1, interestRate: 1, riskScore: 1,
    };

    const result = runInference(onesInput, demoWeights, demoOutputWeights);

    // All ones → positive weights dominate → sigmoid pushes toward 1
    expect(result.rawOutput).toBeGreaterThan(0.5);
    expect(result.decision).toBe(1);
    // Pre-computed: rawOutput ≈ 0.768969
    expect(result.rawOutput).toBeCloseTo(0.768969, 4);
    expect(result.confidence).toBeCloseTo(0.7690, 2);
  });

  test('negative weights produce ReLU zero in hidden layer', () => {
    // Weights chosen so that neuron 0 gets a strongly negative pre-activation
    const negWeights = [
      -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5,  // neuron 0: heavily negative
      -0.3, -0.3, -0.3, -0.3, -0.3, -0.3, -0.3, -0.3,  // neuron 1: negative
      0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1,           // neuron 2: positive
      0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,           // neuron 3: zero
      0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2,           // neuron 4: positive
      -0.4, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,          // neuron 5: mixed
    ];

    const result = runInference(demoInput, negWeights, [0.1, 0.1, 0.3, 0.2, 0.4, -0.5]);

    // ReLU clamping: neuron 0 hidden should be 0 (negative pre-activation)
    // neuron 2 and 4 should be positive, neuron 3 = 0, neuron 5 ~0
    expect(result.decision).toBe(1);  // Still approve due to hidden[2]=0.262 * 0.3 + hidden[4]=0.321 * 0.4

    // confidence should be moderate (weighted combination of a few active neurons)
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
