import {Spec, AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions} from '@stellar/stellar-sdk/contract';
import {Address} from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

export interface Client {
  /**
   * Initialize the on-chain UltraHonk verifier with verification key bytes.
   */
  __constructor({ vk_bytes }: { vk_bytes: Buffer }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  /**
   * Return the stored verification key bytes for auditability.
   */
  vk_bytes(options?: MethodOptions): Promise<AssembledTransaction<Buffer>>;
  /**
   * Register a new ML model with committed weight hash
   */
  register({ caller, model_hash, description, version }: { caller: string | Address; model_hash: Buffer; description: string; version: number }, options?: MethodOptions): Promise<AssembledTransaction<number>>;
  /**
   * Get model info
   */
  get_model({ model_id }: { model_id: number }, options?: MethodOptions): Promise<AssembledTransaction<[Buffer, string, number]>>;
  /**
   * List all registered models
   */
  list_models(options?: MethodOptions): Promise<AssembledTransaction<Array<number>>>;
  /**
   * Get inference record
   */
  get_inference({ inference_id }: { inference_id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<[number, boolean, number]>>;
  /**
   * Get registered model count
   */
  get_model_count(options?: MethodOptions): Promise<AssembledTransaction<number>>;
  /**
   * Submit verified inference proof with on-chain UltraHonk verification.
   */
  submit_inference({ caller, model_id, proof_bytes, public_inputs, decision, confidence }: { caller: string | Address; model_id: number; proof_bytes: Buffer; public_inputs: Buffer; decision: boolean; confidence: number }, options?: MethodOptions): Promise<AssembledTransaction<number>>;
  /**
   * Get inference record with proof hash
   */
  get_inference_with_hash({ inference_id }: { inference_id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<[number, boolean, number, Buffer]>>;
}

export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new Spec([]),
      options
    );
  }

   static deploy<T = Client>(options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { wasmHash: Buffer | string; salt?: Buffer | Uint8Array; format?: "hex" | "base64"; address?: string; }): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options);
  }
  public readonly fromJSON = {
    __constructor : this.txFromJSON<void>,  vk_bytes : this.txFromJSON<Buffer>,  register : this.txFromJSON<number>,  get_model : this.txFromJSON<[Buffer, string, number]>,  list_models : this.txFromJSON<Array<number>>,  get_inference : this.txFromJSON<[number, boolean, number]>,  get_model_count : this.txFromJSON<number>,  submit_inference : this.txFromJSON<number>,  get_inference_with_hash : this.txFromJSON<[number, boolean, number, Buffer]>
  };
}
