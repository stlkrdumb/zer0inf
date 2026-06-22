import {Spec, AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions} from '@stellar/stellar-sdk/contract';
import {Address} from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

export interface Client {
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
   * Submit verified inference proof
   */
  submit_inference({ caller, model_id, proof_hash, decision, confidence }: { caller: string | Address; model_id: number; proof_hash: Buffer; decision: boolean; confidence: number }, options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
}

export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new Spec(["AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACAAAAAAAAAAAAAAACk1vZGVsQ291bnQAAAAAAAAAAAAAAAAADkluZmVyZW5jZUNvdW50AAAAAAAAAAAAAAAAAAZNb2RlbHMAAAAAAAEAAAAAAAAABEhhc2gAAAABAAAABAAAAAAAAAAAAAAABURlc2MwAAAAAAAAAAAAAAAAAAAFRGVzYzEAAAAAAAAAAAAAAAAAAAVEZXNjMgAAAAAAAAEAAAAAAAAACUluZlJlY29yZAAAAAAAAAEAAAAG", "AAAAAQAAAAAAAAAAAAAACU1vZGVsSW5mbwAAAAAAAAIAAAAAAAAACG1vZGVsX2lkAAAABAAAAAAAAAAHdmVyc2lvbgAAAAAE", "AAAAAQAAAAAAAAAAAAAAD0luZmVyZW5jZVJlY29yZAAAAAAEAAAAAAAAAApjb25maWRlbmNlAAAAAAAEAAAAAAAAAAhkZWNpc2lvbgAAAAEAAAAAAAAADGluZmVyZW5jZV9pZAAAAAYAAAAAAAAACG1vZGVsX2lkAAAABA==", "AAAAAAAAADJSZWdpc3RlciBhIG5ldyBNTCBtb2RlbCB3aXRoIGNvbW1pdHRlZCB3ZWlnaHQgaGFzaAAAAAAACHJlZ2lzdGVyAAAABAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAptb2RlbF9oYXNoAAAAAAPuAAAAIAAAAAAAAAALZGVzY3JpcHRpb24AAAAAEAAAAAAAAAAHdmVyc2lvbgAAAAAEAAAAAQAAAAQ=", "AAAAAAAAAA5HZXQgbW9kZWwgaW5mbwAAAAAACWdldF9tb2RlbAAAAAAAAAEAAAAAAAAACG1vZGVsX2lkAAAABAAAAAEAAAPtAAAAAwAAA+4AAAAgAAAAEAAAAAQ=", "AAAAAAAAABpMaXN0IGFsbCByZWdpc3RlcmVkIG1vZGVscwAAAAAAC2xpc3RfbW9kZWxzAAAAAAAAAAABAAAD6gAAAAQ=", "AAAAAAAAABRHZXQgaW5mZXJlbmNlIHJlY29yZAAAAA1nZXRfaW5mZXJlbmNlAAAAAAAAAQAAAAAAAAAMaW5mZXJlbmNlX2lkAAAABgAAAAEAAAPtAAAAAwAAAAQAAAABAAAABA==", "AAAAAAAAABpHZXQgcmVnaXN0ZXJlZCBtb2RlbCBjb3VudAAAAAAAD2dldF9tb2RlbF9jb3VudAAAAAAAAAAAAQAAAAQ=", "AAAAAAAAAB9TdWJtaXQgdmVyaWZpZWQgaW5mZXJlbmNlIHByb29mAAAAABBzdWJtaXRfaW5mZXJlbmNlAAAABQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAhtb2RlbF9pZAAAAAQAAAAAAAAACnByb29mX2hhc2gAAAAAA+4AAAAgAAAAAAAAAAhkZWNpc2lvbgAAAAEAAAAAAAAACmNvbmZpZGVuY2UAAAAAAAQAAAABAAAABg=="]),
      options
    );
  }

   static deploy<T = Client>(options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { wasmHash: Buffer | string; salt?: Buffer | Uint8Array; format?: "hex" | "base64"; address?: string; }): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options);
  }
  public readonly fromJSON = {
    register : this.txFromJSON<number>,  get_model : this.txFromJSON<[Buffer, string, number]>,  list_models : this.txFromJSON<Array<number>>,  get_inference : this.txFromJSON<[number, boolean, number]>,  get_model_count : this.txFromJSON<number>,  submit_inference : this.txFromJSON<bigint>
  };
}