/**
 * Zer0Inf — Shared Type Definitions
 *
 * Data structures for model registration, inference requests,
 * proofs, and Stellar contract interactions.
 */
/**
 * Architecture for our demo classifier:
 * Input(8) → Hidden(6, ReLU) → Output(1, sigmoid)
 */
export const DEMO_CONFIG = {
    inputSize: 8,
    hiddenSize: 6,
    outputSize: 1,
    numWeights: 48, // 6 * 8
    numBiases: 0, // biases omitted for simplicity in v1
};
export const TESTNET = {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
};
