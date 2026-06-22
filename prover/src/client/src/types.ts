

    /**
 * Union: DataKey
 */
 export type DataKey =
  { tag: "ModelCount"; values: void } |
  { tag: "InferenceCount"; values: void } |
  { tag: "Models"; values: void } |
  { tag: "Hash"; values: readonly [number] } |
  { tag: "Desc0"; values: void } |
  { tag: "Desc1"; values: void } |
  { tag: "Desc2"; values: void } |
  { tag: "InfRecord"; values: readonly [bigint] };

/**
 * Struct: ModelInfo
 */
export interface ModelInfo {
  model_id: number;
  version: number;
}

/**
 * Struct: InferenceRecord
 */
export interface InferenceRecord {
  confidence: number;
  decision: boolean;
  inference_id: bigint;
  model_id: number;
}
    