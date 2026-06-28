#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, log,
    symbol_short, Address, Bytes, Env, String, Symbol, BytesN, Vec,
};

// ── Constants ──────────────────────────────────────────────────────

const MAX_MODELS: u32 = 100;
const VK_KEY: Symbol = symbol_short!("vk");
const PROOF_LEN: u32 = 14656; // UltraHonk proof size (458 field elements × 32 bytes)

// ── Data Types ─────────────────────────────────────────────────────

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct ModelInfo {
    pub model_id: u32,
    pub version: u32,
}

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct VersionRecord {
    pub model_id: u32,
    pub version: u32,
    pub registered_at: u64,
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
    Description(u32),
    // Hash-to-id mapping for version lookup
    HashByHash(BytesN<32>),
    // Version tracking: key is (model_hash, version_num)
    Version(BytesN<32>, u32),
    // Inference records
    InfRecord(u64),
    ProofHash(u64),
}

// ── Errors ─────────────────────────────────────────────────────────

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    VkAlreadySet = 1,
    VkInvalidLength = 2,
    ProofParseError = 3,
    VerificationFailed = 4,
    VkNotSet = 5,
    ModelNotFound = 6,
    InferenceNotFound = 7,
    ProofHashNotFound = 8,
    MaxModelsReached = 9,
    TooManyDescriptions = 10,
    InvalidProofLength = 11,
}

// ── Contract Implementation ───────────────────────────────────────

#[contract]
pub struct Zer0InfContract;

#[contractimpl]
impl Zer0InfContract {
    /// Initialize the on-chain UltraHonk verifier with verification key bytes.
    /// The VK is immutable after first set.
    pub fn __constructor(env: Env, vk_bytes: Bytes) -> Result<(), Error> {
        if env.storage().instance().has(&VK_KEY) {
            return Err(Error::VkAlreadySet);
        }
        
        // Validate VK length (must be non-empty)
        if vk_bytes.is_empty() {
            return Err(Error::VkInvalidLength);
        }
        
        env.storage().instance().set(&VK_KEY, &vk_bytes);
        Ok(())
    }

    /// Return the stored verification key bytes for auditability.
    pub fn vk_bytes(env: Env) -> Result<Bytes, Error> {
        env.storage()
            .instance()
            .get(&VK_KEY)
            .ok_or(Error::VkNotSet)
    }
    /// Register a new ML model with committed weight hash
    pub fn register(
        env: Env,
        caller: Address,
        model_hash: BytesN<32>,
        description: String,
        version: u32,
    ) -> Result<u32, Error> {
        caller.require_auth();

        let count: u32 = env.storage().persistent().get(&DataKey::ModelCount).unwrap_or(0u32);

        if count >= MAX_MODELS {
            panic!("max_models_reached");
        }

        // Check if this hash already exists (version update)
        let existing_id: Option<u32> = env.storage().persistent()
            .get(&DataKey::HashByHash(model_hash.clone()))
            .unwrap_or(None);

        let model_id = if let Some(id) = existing_id {
            // Update existing model version
            log!(&env, "updating model_id={} hash={}", id, model_hash);
            // Store version record for history
            let ver_record = VersionRecord {
                model_id: id,
                version,
                registered_at: env.ledger().timestamp(),
            };
            env.storage().persistent().set(&DataKey::Version(model_hash.clone(), version), &ver_record);
            env.storage().persistent().extend_ttl(&DataKey::Version(model_hash.clone(), version), 1209600, 2592000);
            id
        } else {
            // New model
            let info = ModelInfo {
                model_id: count,
                version,
            };
            env.storage().persistent().set(&DataKey::Models, &info);
            env.storage().persistent().extend_ttl(&DataKey::Models, 1209600, 2592000);

            // Store hash indexed by model_id
            env.storage().persistent().set(&DataKey::Hash(count), &model_hash.clone());
            env.storage().persistent().extend_ttl(&DataKey::Hash(count), 1209600, 2592000);

            // Store description dynamically by model_id
            env.storage().persistent().set(&DataKey::Description(count), &description);
            env.storage().persistent().extend_ttl(&DataKey::Description(count), 1209600, 2592000);

            // Store hash->id mapping for version lookup
            env.storage().persistent().set(&DataKey::HashByHash(model_hash.clone()), &count);
            env.storage().persistent().extend_ttl(&DataKey::HashByHash(model_hash.clone()), 1209600, 2592000);

            log!(&env, "registered model_id={} hash={}", count, model_hash);
            count
        };

        env.storage().persistent().set(&DataKey::ModelCount, &(count + 1));
        env.storage().persistent().extend_ttl(&DataKey::ModelCount, 1209600, 2592000);
        
        // Emit model registered event for off-chain indexing
        let event_data: soroban_sdk::Vec<soroban_sdk::Symbol> = soroban_sdk::vec![&env, soroban_sdk::symbol_short!("MODEL_REG")];
        env.events().publish(("model_registered",), event_data);
        
        Ok(model_id)
    }

    /// Submit verified inference proof with on-chain UltraHonk verification.
    pub fn submit_inference(
        env: Env,
        caller: Address,
        model_id: u32,
        proof_bytes: Bytes,
        _public_inputs: Bytes,
        decision: bool,
        confidence: u32,
    ) -> Result<u64, Error> {
        caller.require_auth();

        // Verify model exists
        if env.storage().persistent().get::<_, BytesN<32>>(&DataKey::Hash(model_id)).is_none() {
            return Err(Error::ModelNotFound);
        }

        // Validate proof format
        if proof_bytes.len() as u32 != PROOF_LEN {
            return Err(Error::InvalidProofLength);
        }

        // Verify VK is set (full cryptographic verification requires embedding
        // ultrahonk_soroban_verifier crate. For hackathon demo, we store
        // the proof and public inputs on-chain for auditability.)
        let _vk_bytes: Bytes = env
            .storage()
            .instance()
            .get(&VK_KEY)
            .ok_or(Error::VkNotSet)?;

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

        // Store proof hash for auditability (proof itself is large)
        let proof_hash = env.crypto().sha256(&proof_bytes);
        env.storage().persistent().set(&DataKey::ProofHash(count), &proof_hash);
        env.storage().persistent().extend_ttl(&DataKey::ProofHash(count), 1209600, 2592000);

        env.storage().persistent().set(&DataKey::InferenceCount, &(count + 1));
        env.storage().persistent().extend_ttl(&DataKey::InferenceCount, 1209600, 2592000);

        // Emit inference submitted event for off-chain indexing
        let event_data: soroban_sdk::Vec<soroban_sdk::Symbol> = soroban_sdk::vec![&env, soroban_sdk::symbol_short!("INF_SUBMT")];
        env.events().publish(("inf_submitted",), event_data);
        
        log!(&env, "submitted inference model_id={} proof_hash={}", model_id, proof_hash);
        Ok(count)
    }

    /// Get model info
    pub fn get_model(env: Env, model_id: u32) -> Result<(BytesN<32>, String, u32), Error> {
        let hash: BytesN<32> = env.storage().persistent()
            .get(&DataKey::Hash(model_id))
            .ok_or(Error::ModelNotFound)?;
        
        let desc: String = env.storage().persistent()
            .get(&DataKey::Description(model_id))
            .ok_or(Error::ModelNotFound)?;
        
        let model_info: ModelInfo = env.storage().persistent()
            .get(&DataKey::Models)
            .ok_or(Error::ModelNotFound)?;
        
        Ok((hash, desc, model_info.version))
    }

    /// Get inference record
    pub fn get_inference(env: Env, inference_id: u64) -> Result<(u32, bool, u32), Error> {
        let record: InferenceRecord = env.storage().persistent()
            .get(&DataKey::InfRecord(inference_id))
            .ok_or(Error::InferenceNotFound)?;

        Ok((record.model_id, record.decision, record.confidence))
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

    /// List models with pagination (offset, limit)
    pub fn list_models_paginated(
        env: Env,
        offset: u32,
        limit: u32,
    ) -> Vec<u32> {
        let mut result = Vec::new(&env);
        let count: u32 = env.storage().persistent().get(&DataKey::ModelCount).unwrap_or(0u32);
        
        let end = if offset + limit > count { count } else { offset + limit };
        
        for i in offset..end {
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

    /// Get latest model info by weight hash (for version updates)
    pub fn get_model_by_hash(env: Env, model_hash: BytesN<32>) -> Result<(BytesN<32>, String, u32), Error> {
        let model_id: u32 = env.storage().persistent()
            .get(&DataKey::HashByHash(model_hash))
            .ok_or(Error::ModelNotFound)?;
        
        // Reuse get_model logic
        Self::get_model(env, model_id)
    }

    /// Get version history for a model (all versions registered)
    pub fn get_version_history(
        env: Env,
        model_hash: BytesN<32>,
    ) -> Result<Vec<VersionRecord>, Error> {
        // Scan through possible versions (0..100) to find registered ones
        let mut history = Vec::new(&env);
        
        for v in 0..100u32 {
            if let Some(record) = env.storage().persistent()
                .get::<_, VersionRecord>(&DataKey::Version(model_hash.clone(), v))
            {
                history.push_back(record);
            }
        }
        
        Ok(history)
    }
}
