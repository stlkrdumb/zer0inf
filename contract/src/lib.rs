#![no_std]
use soroban_sdk::{contract, contractimpl, log, Address, Env, String, BytesN, Vec};

// ── Constants ──────────────────────────────────────────────────────

const MAX_MODELS: u32 = 100;

// ── Data Types ─────────────────────────────────────────────────────

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct ModelInfo {
    pub model_id: u32,
    pub version: u32,
}

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct InferenceRecord {
    pub inference_id: u64,
    pub model_id: u32,
    pub decision: bool,
    pub confidence: u32,
}

// ── Storage Keys ───────────────────────────────────────────────────

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    ModelCount,
    InferenceCount,
    // Model registry (simple map of id -> info)
    Models,
    // Individual model data keyed by ID
    Hash(u32),
    Desc0,
    Desc1,
    Desc2,
    // Inference records
    InfRecord(u64),
}

// ── Contract Implementation ───────────────────────────────────────

#[contract]
pub struct Zer0InfContract;

#[contractimpl]
impl Zer0InfContract {
    /// Register a new ML model with committed weight hash
    pub fn register(
        env: Env,
        caller: Address,
        model_hash: BytesN<32>,
        description: String,
        version: u32,
    ) -> u32 {
        caller.require_auth();

        let count: u32 = env.storage().persistent().get(&DataKey::ModelCount).unwrap_or(0u32);

        if count >= MAX_MODELS {
            panic!("max_models_reached");
        }

        // Store model metadata
        let info = ModelInfo {
            model_id: count,
            version,
        };
        env.storage().persistent().set(&DataKey::Models, &info);
        env.storage().persistent().extend_ttl(&DataKey::Models, 1209600, 2592000);

        // Store hash indexed by model_id
        env.storage().persistent().set(&DataKey::Hash(count), &model_hash);
        env.storage().persistent().extend_ttl(&DataKey::Hash(count), 1209600, 2592000);

        // Store description - limited to 3 for now
        match count {
            0 => env.storage().persistent().set(&DataKey::Desc0, &description),
            1 => env.storage().persistent().set(&DataKey::Desc1, &description),
            2 => env.storage().persistent().set(&DataKey::Desc2, &description),
            _ => panic!("too_many_models"),
        }

        env.storage().persistent().set(&DataKey::ModelCount, &(count + 1));

        log!(&env, "registered model_id={} hash={}", count, model_hash);
        count
    }

    /// Submit verified inference proof
    pub fn submit_inference(
        env: Env,
        caller: Address,
        model_id: u32,
        _proof_hash: BytesN<32>,
        decision: bool,
        confidence: u32,
    ) -> u64 {
        caller.require_auth();

        // Verify model exists
        if env.storage().persistent().get::<_, BytesN<32>>(&DataKey::Hash(model_id)).is_none() {
            panic!("model_not_found");
        }

        let count: u64 = env.storage().persistent().get(&DataKey::InferenceCount).unwrap_or(0u64);

        // Store inference record
        let record = InferenceRecord {
            inference_id: count,
            model_id,
            decision,
            confidence,
        };

        env.storage().persistent().set(&DataKey::InfRecord(count), &record);
        env.storage().persistent().extend_ttl(&DataKey::InfRecord(count), 1209600, 2592000);

        env.storage().persistent().set(&DataKey::InferenceCount, &(count + 1));

        log!(&env, "submitted inference model_id={} proof_hash={}", model_id, _proof_hash);
        count
    }

    /// Get model info
    pub fn get_model(env: Env, model_id: u32) -> (BytesN<32>, String, u32) {
        let hash: BytesN<32> = env.storage().persistent()
            .get(&DataKey::Hash(model_id))
            .expect("model_not_found");
        
        let desc_key = match model_id {
            0 => DataKey::Desc0,
            1 => DataKey::Desc1,
            2 => DataKey::Desc2,
            _ => panic!("model_not_found"),
        };
        let desc: String = env.storage().persistent()
            .get(&desc_key)
            .expect("model_not_found");
        
        let model_info: ModelInfo = env.storage().persistent()
            .get(&DataKey::Models)
            .expect("model_not_found");
        
        (hash, desc, model_info.version)
    }

    /// Get inference record
    pub fn get_inference(env: Env, inference_id: u64) -> (u32, bool, u32) {
        let record: InferenceRecord = env.storage().persistent()
            .get(&DataKey::InfRecord(inference_id))
            .expect("inference_not_found");

        (record.model_id, record.decision, record.confidence)
    }

    /// List all registered models
    pub fn list_models(env: Env) -> Vec<u32> {
        let mut result = Vec::new(&env);
        let count: u32 = env.storage().persistent().get(&DataKey::ModelCount).unwrap_or(0u32);
        
        for i in 0..count {
            if env.storage().persistent().get::<_, BytesN<32>>(&DataKey::Hash(i)).is_some() {
                result.push_back(i);
            }
        }
        
        result
    }

    /// Get registered model count
    pub fn get_model_count(env: Env) -> u32 {
        env.storage().persistent().get(&DataKey::ModelCount).unwrap_or(0u32)
    }
}
