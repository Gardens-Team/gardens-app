// Integration tests for auth and capabilities working together
use garden_core::{
    auth::AuthToken,
    identity::{Identity, Capability},
    entries::GardenEntry,
    types::{SubspaceId, Timestamp, MessageType},
};

use ed25519_dalek::{SigningKey, VerifyingKey};
use chrono::Utc;
use uuid::Uuid;

// Custom error handling for auth-based requests
#[derive(Debug)]
enum AuthError {
    InvalidToken,
    TokenExpired,
    InsufficientCapabilities,
    IdentityMismatch,
    Other(String),
}

// Access control service that uses auth tokens and capabilities to validate operations
struct AccessControlService;

impl AccessControlService {
    // Check if a token has access to an entry
    fn can_access_entry(token: &AuthToken, entry: &GardenEntry, now: Timestamp) -> Result<bool, AuthError> {
        // Check if token is valid
        if !token.is_valid(now) {
            return Err(AuthError::TokenExpired);
        }
        
        // Check capabilities based on entry type
        match entry {
            GardenEntry::DirectMessage { sender_id, recipient_id, .. } => {
                // Check if token belongs to sender or recipient
                if &token.user_id != sender_id && &token.user_id != recipient_id {
                    // User must have read capability for recipient's messages
                    let read_cap = Capability::ReadMessages(recipient_id.clone());
                    if !token.has_capability(&read_cap) {
                        return Err(AuthError::InsufficientCapabilities);
                    }
                }
                Ok(true)
            },
            GardenEntry::GroupMessage { group_id, .. } => {
                // Check if token has read capability for this group
                let read_group_cap = Capability::ReadMessages(format!("group:{}", group_id));
                if !token.has_capability(&read_group_cap) {
                    // Check for general group management capability
                    let manage_group_cap = Capability::ManageGroup(group_id.clone());
                    if !token.has_capability(&manage_group_cap) {
                        return Err(AuthError::InsufficientCapabilities);
                    }
                }
                Ok(true)
            },
            GardenEntry::Profile { user_id, field_type, .. } => {
                // If not own profile, must have explicit read access
                if &token.user_id != user_id {
                    let read_profile_cap = Capability::ReadMessages(format!("profile:{}", user_id));
                    if !token.has_capability(&read_profile_cap) {
                        return Err(AuthError::InsufficientCapabilities);
                    }
                }
                Ok(true)
            },
            GardenEntry::GroupMeta { group_id, .. } | 
            GardenEntry::GroupMember { group_id, .. } => {
                // Must have group management capability
                let manage_group_cap = Capability::ManageGroup(group_id.clone());
                if !token.has_capability(&manage_group_cap) {
                    return Err(AuthError::InsufficientCapabilities);
                }
                Ok(true)
            },
            _ => {
                // Default case - implement specific rules for other entry types as needed
                Ok(true)
            }
        }
    }
    
    // Check if a token can create an entry
    fn can_create_entry(token: &AuthToken, entry: &GardenEntry, now: Timestamp) -> Result<bool, AuthError> {
        // Check if token is valid
        if !token.is_valid(now) {
            return Err(AuthError::TokenExpired);
        }
        
        // Check capabilities based on entry type
        match entry {
            GardenEntry::DirectMessage { sender_id, .. } => {
                // Must be the sender
                if &token.user_id != sender_id {
                    return Err(AuthError::IdentityMismatch);
                }
                
                // Must have write capability
                let write_cap = Capability::WriteMessages("inbox".to_string());
                if !token.has_capability(&write_cap) {
                    return Err(AuthError::InsufficientCapabilities);
                }
                
                Ok(true)
            },
            GardenEntry::GroupMessage { group_id, sender_id, .. } => {
                // Must be the sender
                if &token.user_id != sender_id {
                    return Err(AuthError::IdentityMismatch);
                }
                
                // Must have write capability for this group
                let write_group_cap = Capability::WriteMessages(format!("group:{}", group_id));
                if !token.has_capability(&write_group_cap) {
                    return Err(AuthError::InsufficientCapabilities);
                }
                
                Ok(true)
            },
            GardenEntry::GroupMeta { group_id, .. } => {
                // Must have group management capability
                let manage_group_cap = Capability::ManageGroup(group_id.clone());
                if !token.has_capability(&manage_group_cap) {
                    return Err(AuthError::InsufficientCapabilities);
                }
                
                Ok(true)
            },
            GardenEntry::GroupMember { group_id, .. } => {
                // Must have group management capability
                let manage_group_cap = Capability::ManageGroup(group_id.clone());
                if !token.has_capability(&manage_group_cap) {
                    return Err(AuthError::InsufficientCapabilities);
                }
                
                Ok(true)
            },
            _ => {
                // Default case - implement specific rules for other entry types as needed
                Ok(true)
            }
        }
    }
}

// Test authorization with capabilities for direct messages
#[test]
fn test_direct_message_authorization() {
    // Generate identities
    let (alice_identity, alice_signing_key) = Identity::generate_identity();
    let (bob_identity, _) = Identity::generate_identity();
    
    let now = Utc::now().timestamp();
    let expires_at = now + 3600;
    
    // Create Alice's token with write capability
    let mut alice_token = AuthToken {
        user_id: alice_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            Capability::WriteMessages("inbox".to_string()),
            Capability::ReadMessages("inbox".to_string()),
        ],
        signature: None,
        expires_at,
    };
    
    alice_token.sign(&alice_signing_key);
    
    // Create Bob's token with read capability for Alice's messages
    let mut bob_token = AuthToken {
        user_id: bob_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            Capability::ReadMessages(alice_identity.user_id.clone()),
        ],
        signature: None,
        expires_at,
    };
    
    bob_token.sign(&alice_signing_key); // In reality would be signed by its own key
    
    // Create a direct message from Alice to Bob
    let subspace_id = SubspaceId("test-subspace".to_string());
    let direct_message = GardenEntry::DirectMessage {
        sender_id: alice_identity.user_id.clone(),
        recipient_id: bob_identity.user_id.clone(),
        thread_id: "thread-1".to_string(),
        subspace_id,
        encrypted_content: vec![1, 2, 3],
        timestamp: now,
        message_type: MessageType::Text,
        attachments: vec![],
    };
    
    // Test if Alice can create the message
    let alice_can_create = AccessControlService::can_create_entry(&alice_token, &direct_message, now);
    assert!(alice_can_create.is_ok());
    assert!(alice_can_create.unwrap());
    
    // Test if Bob can access the message
    let bob_can_access = AccessControlService::can_access_entry(&bob_token, &direct_message, now);
    assert!(bob_can_access.is_ok());
    assert!(bob_can_access.unwrap());
    
    // Create a token for a third user without specific permissions
    let (charlie_identity, charlie_signing_key) = Identity::generate_identity();
    let mut charlie_token = AuthToken {
        user_id: charlie_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            // No specific capabilities for Alice or Bob's messages
            Capability::WriteMessages("inbox".to_string()),
        ],
        signature: None,
        expires_at,
    };
    
    charlie_token.sign(&charlie_signing_key);
    
    // Charlie should not be able to create a message as Alice
    let fake_message = GardenEntry::DirectMessage {
        sender_id: alice_identity.user_id.clone(), // Trying to impersonate Alice
        recipient_id: bob_identity.user_id.clone(),
        thread_id: "thread-1".to_string(),
        subspace_id: SubspaceId("test-subspace".to_string()),
        encrypted_content: vec![1, 2, 3],
        timestamp: now,
        message_type: MessageType::Text,
        attachments: vec![],
    };
    
    let charlie_fake_create = AccessControlService::can_create_entry(&charlie_token, &fake_message, now);
    assert!(charlie_fake_create.is_err());
    
    // Charlie should not be able to access the message between Alice and Bob
    let charlie_access = AccessControlService::can_access_entry(&charlie_token, &direct_message, now);
    assert!(charlie_access.is_err());
}

// Test authorization with capabilities for group messages
#[test]
fn test_group_message_authorization() {
    // Generate identities
    let (owner_identity, owner_signing_key) = Identity::generate_identity();
    let (member_identity, _) = Identity::generate_identity();
    let (non_member_identity, _) = Identity::generate_identity();
    
    let now = Utc::now().timestamp();
    let expires_at = now + 3600;
    let group_id = "test-group-456";
    
    // Create owner's token with management capability
    let mut owner_token = AuthToken {
        user_id: owner_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            Capability::ManageGroup(group_id.to_string()),
            Capability::WriteMessages(format!("group:{}", group_id)),
            Capability::ReadMessages(format!("group:{}", group_id)),
        ],
        signature: None,
        expires_at,
    };
    
    owner_token.sign(&owner_signing_key);
    
    // Create member's token with read/write capabilities
    let mut member_token = AuthToken {
        user_id: member_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            Capability::WriteMessages(format!("group:{}", group_id)),
            Capability::ReadMessages(format!("group:{}", group_id)),
        ],
        signature: None,
        expires_at,
    };
    
    member_token.sign(&owner_signing_key); // In reality would be signed by the group admin
    
    // Create non-member's token without group capabilities
    let mut non_member_token = AuthToken {
        user_id: non_member_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            // No capabilities for this group
            Capability::WriteMessages("inbox".to_string()),
        ],
        signature: None,
        expires_at,
    };
    
    non_member_token.sign(&owner_signing_key);
    
    // Create a group message from the owner
    let subspace_id = SubspaceId("test-group-subspace".to_string());
    let group_message = GardenEntry::GroupMessage {
        group_id: group_id.to_string(),
        sender_id: owner_identity.user_id.clone(),
        subspace_id: subspace_id.clone(),
        encrypted_content: vec![1, 2, 3],
        timestamp: now,
        message_type: MessageType::Text,
        attachments: vec![],
    };
    
    // Test if owner can create and access the message
    let owner_can_create = AccessControlService::can_create_entry(&owner_token, &group_message, now);
    assert!(owner_can_create.is_ok());
    assert!(owner_can_create.unwrap());
    
    let owner_can_access = AccessControlService::can_access_entry(&owner_token, &group_message, now);
    assert!(owner_can_access.is_ok());
    assert!(owner_can_access.unwrap());
    
    // Create a group message from a member
    let member_message = GardenEntry::GroupMessage {
        group_id: group_id.to_string(),
        sender_id: member_identity.user_id.clone(),
        subspace_id,
        encrypted_content: vec![1, 2, 3],
        timestamp: now,
        message_type: MessageType::Text,
        attachments: vec![],
    };
    
    // Test if member can create and access the message
    let member_can_create = AccessControlService::can_create_entry(&member_token, &member_message, now);
    assert!(member_can_create.is_ok());
    assert!(member_can_create.unwrap());
    
    let member_can_access_owner = AccessControlService::can_access_entry(&member_token, &group_message, now);
    assert!(member_can_access_owner.is_ok());
    assert!(member_can_access_owner.unwrap());
    
    // Test if non-member cannot create or access group messages
    let non_member_fake_message = GardenEntry::GroupMessage {
        group_id: group_id.to_string(),
        sender_id: non_member_identity.user_id.clone(),
        subspace_id: SubspaceId("test-group-subspace".to_string()),
        encrypted_content: vec![1, 2, 3],
        timestamp: now,
        message_type: MessageType::Text,
        attachments: vec![],
    };
    
    let non_member_create = AccessControlService::can_create_entry(&non_member_token, &non_member_fake_message, now);
    assert!(non_member_create.is_err());
    
    let non_member_access = AccessControlService::can_access_entry(&non_member_token, &group_message, now);
    assert!(non_member_access.is_err());
    
    // Test group management actions
    let group_meta = GardenEntry::GroupMeta {
        group_id: group_id.to_string(),
        subspace_id: SubspaceId("test-group-subspace".to_string()),
        encrypted_meta: vec![1, 2, 3],
        timestamp: now,
    };
    
    // Owner should be able to manage group metadata
    let owner_manage_meta = AccessControlService::can_create_entry(&owner_token, &group_meta, now);
    assert!(owner_manage_meta.is_ok());
    assert!(owner_manage_meta.unwrap());
    
    // Member should not be able to manage group metadata (no ManageGroup capability)
    let member_manage_meta = AccessControlService::can_create_entry(&member_token, &group_meta, now);
    assert!(member_manage_meta.is_err());
}

// Test expired token behavior
#[test]
fn test_token_expiry() {
    // Generate identity
    let (identity, signing_key) = Identity::generate_identity();
    
    let now = Utc::now().timestamp();
    let expired_at = now - 3600; // Token expired an hour ago
    
    // Create an expired token
    let mut expired_token = AuthToken {
        user_id: identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            Capability::ReadMessages("*".to_string()),
            Capability::WriteMessages("*".to_string()),
        ],
        signature: None,
        expires_at: expired_at,
    };
    
    expired_token.sign(&signing_key);
    
    // Create a test entry
    let entry = GardenEntry::DirectMessage {
        sender_id: identity.user_id.clone(),
        recipient_id: "other-user".to_string(),
        thread_id: "thread-1".to_string(),
        subspace_id: SubspaceId("test-subspace".to_string()),
        encrypted_content: vec![1, 2, 3],
        timestamp: now,
        message_type: MessageType::Text,
        attachments: vec![],
    };
    
    // Test that expired token fails for access and creation
    let access_result = AccessControlService::can_access_entry(&expired_token, &entry, now);
    assert!(access_result.is_err());
    
    let create_result = AccessControlService::can_create_entry(&expired_token, &entry, now);
    assert!(create_result.is_err());
    
    // Check that the error is specifically a token expiry error
    match access_result {
        Err(AuthError::TokenExpired) => {}, // Expected
        _ => panic!("Expected TokenExpired error, got {:?}", access_result),
    }
} 