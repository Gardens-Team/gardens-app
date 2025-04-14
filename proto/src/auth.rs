// garden-core/src/auth.rs
use crate::identity::Capability;
use serde::{Serialize, Deserialize};
use crate::types::Timestamp;
use ed25519_dalek::{SigningKey, VerifyingKey, Signature, Signer, Verifier};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub user_id: String,
    pub device_id: String,
    pub capabilities: Vec<Capability>,
    pub signature: Option<Vec<u8>>,  // Signature is now optional (to be added later)
    pub expires_at: Timestamp,
}

impl AuthToken {
    pub fn is_valid(&self, now: Timestamp) -> bool {
        self.expires_at > now
    }

    pub fn has_capability(&self, required: &Capability) -> bool {
        // Direct match first
        if self.capabilities.contains(required) {
            return true;
        }
        
        // Check for wildcard capabilities
        match required {
            Capability::ReadMessages(target) => {
                // Check if user has wildcard read access
                self.capabilities.iter().any(|cap| {
                    if let Capability::ReadMessages(pattern) = cap {
                        pattern == "*" || pattern == target
                    } else {
                        false
                    }
                })
            },
            Capability::WriteMessages(target) => {
                // Check if user has wildcard write access
                self.capabilities.iter().any(|cap| {
                    if let Capability::WriteMessages(pattern) = cap {
                        pattern == "*" || pattern == target
                    } else {
                        false
                    }
                })
            },
            Capability::ManageGroup(target) => {
                // Check if user has wildcard group management
                self.capabilities.iter().any(|cap| {
                    if let Capability::ManageGroup(pattern) = cap {
                        pattern == "*" || pattern == target
                    } else {
                        false
                    }
                })
            },
            Capability::ManageDevice(target) => {
                // Check if user has wildcard device management
                self.capabilities.iter().any(|cap| {
                    if let Capability::ManageDevice(pattern) = cap {
                        pattern == "*" || pattern == target
                    } else {
                        false
                    }
                })
            },
            // For capabilities without parameters, we already checked with contains
            _ => false,
        }
    }

    // Sign the AuthToken with a private key
    pub fn sign(&mut self, signing_key: &SigningKey) {
        // Create a temporary copy without the signature for serialization
        let mut token_for_signing = self.clone();
        token_for_signing.signature = None;
        
        // Serialize the AuthToken, excluding the signature
        let token_data = bincode::serialize(&token_for_signing).expect("Failed to serialize AuthToken");
        
        // Create the signature
        let signature = signing_key.sign(&token_data);

        // Store the signature
        self.signature = Some(signature.to_bytes().to_vec());
    }

    // Verify the AuthToken's signature with the public key
    pub fn verify(&self, verifying_key: &VerifyingKey) -> bool {
        if let Some(signature_bytes) = &self.signature {
            // Create a clone of the token without the signature for consistent serialization
            let mut token_for_verification = self.clone();
            token_for_verification.signature = None;
            
            // Serialize the AuthToken excluding the signature
            let token_data = bincode::serialize(&token_for_verification).expect("Failed to serialize AuthToken");
            
            // Convert the signature back from bytes
            let signature_array: [u8; 64] = match signature_bytes.as_slice().try_into() {
                Ok(array) => array,
                Err(_) => return false,
            };
            
            // Create signature from bytes - this returns a Signature directly, not a Result
            let signature = Signature::from_bytes(&signature_array);
            
            // Verify the signature using the public key
            verifying_key.verify(&token_data, &signature).is_ok()
        } else {
            false
        }
    }
}

