/**
 * Zer0Inf — On-Chain Integration (Stellar Testnet)
 *
 * Deploy Soroban contract and submit ZK proofs via Stellar SDK v16 + Soroban SDK v27.
 */
export interface OnchainConfig {
    secret: string;
    rpcUrl?: string;
}
export interface SubmitResult {
    transactionHash: string;
    inferenceId: number;
}
export declare function getConfig(opts?: {
    secret?: string;
}): OnchainConfig;
export declare function submitInference(contractId: string, config: OnchainConfig, modelId: number, decision: boolean, confidence: number, proofHash?: string): Promise<SubmitResult>;
/** Get a single inference result */
export declare function getInference(contractId: string, config: OnchainConfig, inferenceId: number): Promise<any>;
/** Get model count */
export declare function getModelCount(contractId: string, config: OnchainConfig): Promise<number>;
