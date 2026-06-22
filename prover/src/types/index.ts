/**
 * Zer0Inf — Shared Type Definitions
 *
 * Data structures for model registration, inference requests,
 * proofs, and Stellar contract interactions.
 */

// ── Model Registration ─────────────────────────────────────────────

export interface ModelRegistration {
  /** Unique model ID assigned by the Soroban contract */
  modelId: number;
  /** SHA-256 hash of model weights (commitment on-chain) */
  modelHash: string;
  /** Human-readable description of the model */
  description: string;
  /** Model version for tracking updates */
  version: number;
  /** Registered timestamp */
  registeredAt: number;
}

// ── Neural Network Architecture ────────────────────────────────────

export interface NNConfig {
  inputSize: number;
  hiddenSize: number;
  outputSize: number;
  numWeights: number;
  numBiases: number;
}

/**
 * Architecture for our demo classifier:
 * Input(8) → Hidden(6, ReLU) → Output(1, sigmoid)
 */
export const DEMO_CONFIG: NNConfig = {
  inputSize: 8,
  hiddenSize: 6,
  outputSize: 1,
  numWeights: 48,        // 6 * 8
  numBiases: 0,           // biases omitted for simplicity in v1
};

// ── Inference Input ────────────────────────────────────────────────

/**
 * Financial data fields used in the demo credit eligibility model.
 * All values are normalized to [0, 1] range before inference.
 */
export interface InferInput {
  /** Monthly income (normalized: 0-1 range) */
  income: number;
  /** Debt-to-income ratio (0-1) */
  debtRatio: number;
  /** Savings balance in thousands (normalized: 0-1) */
  savings: number;
  /** Years of employment (normalized: 0-1, cap at 30 years) */
  employmentYears: number;
  /** Months of credit history (normalized: 0-1, cap at 240 months) */
  creditHistoryMonths: number;
  /** Loan amount requested in thousands (normalized: 0-1, cap at $500k) */
  loanAmount: number;
  /** Interest rate offered (normalized: 0-1, range 0-25%) */
  interestRate: number;
  /** Risk assessment score from other sources (normalized: 0-1) */
  riskScore: number;
}

// ── Inference Result ───────────────────────────────────────────────

export interface InferenceResult {
  /** Raw output of the neural network (before thresholding) */
  rawOutput: number;
  /** Binary decision: 1 = approve, 0 = deny */
  decision: number;
  /** Confidence score [0, 1] */
  confidence: number;
}

// ── Proof Data ─────────────────────────────────────────────────────

/**
 * A complete proof submission to the Soroban verifier contract.
 */
export interface ProofSubmission {
  /** Model ID that was used for inference */
  modelId: number;
  /** Serialized UltraHonk proof bytes */
  proofBytes: Uint8Array;
  /** Public inputs array (model hash commitment + result, etc.) */
  publicInputs: bigint[];
  /** The inference result (optional — can be kept private) */
  result?: InferenceResult;
}

// ── Stellar Configuration ──────────────────────────────────────────

export interface StellarConfig {
  /** Network RPC URL */
  rpcUrl: string;
  /** Horizon API URL */
  horizonUrl: string;
  /** Network passphrase (testnet or futurenet) */
  networkPassphrase: string;
  /** Soroban contract ID for the Zer0Inf verifier */
  contractId?: string;
}

export const TESTNET: StellarConfig = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
};
