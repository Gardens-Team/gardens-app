// garden-core/src/identity.rs
use serde::{Serialize, Deserialize};
use crate::types::{Timestamp};
use ed25519_dalek::SigningKey;
use rand::{rngs::OsRng, RngCore};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub user_id: String,
    pub public_key: Vec<u8>,
    pub signature: Vec<u8>,
    pub created_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub device_id: String,
    pub public_key: Vec<u8>,
    pub signature: Vec<u8>,
    pub capabilities: Vec<Capability>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Capability {
    ReadMessages(String),
    WriteMessages(String),
    ManageGroup(String),
    ManageDevice(String),
    CreateInvites,
    AdminAccess,
}


impl Identity {
    // Generate a new Identity with a key pair
    pub fn generate_identity() -> (Self, SigningKey) {
        // Generate random bytes for the key
        let mut secret_key_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut secret_key_bytes);
        
        // Create SigningKey from random bytes
        let signing_key = SigningKey::from_bytes(&secret_key_bytes);
        let verifying_key = signing_key.verifying_key();
        
        let identity = Identity {
            user_id: uuid::Uuid::new_v4().to_string(),
            public_key: verifying_key.to_bytes().to_vec(),
            signature: Vec::new(), // We'll sign the identity later if necessary
            created_at: chrono::Utc::now().timestamp(),
        };
        (identity, signing_key)
    }
}