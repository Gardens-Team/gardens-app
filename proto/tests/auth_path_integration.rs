// Integration tests for auth with path validation
use garden_core::{
    auth::AuthToken,
    identity::{Identity, Capability},
    types::{Path, SubspaceId, Timestamp},
};

use chrono::Utc;
use uuid::Uuid;

// Test that combines path validation with auth tokens for access control
#[test]
fn test_auth_with_path_validation() {
    // Create test identities
    let (alice_identity, alice_signing_key) = Identity::generate_identity();
    let (bob_identity, _) = Identity::generate_identity();
    
    // Create tokens with specific path capabilities
    let now = Utc::now().timestamp();
    let expires_at = now + 3600;
    
    // Alice's token grants access to her own profile paths and group data
    let mut alice_token = AuthToken {
        user_id: alice_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            // Can read/write to her profile
            Capability::ReadMessages(format!("profiles/{}", alice_identity.user_id)),
            Capability::WriteMessages(format!("profiles/{}", alice_identity.user_id)),
            // Can manage a specific group
            Capability::ManageGroup("group-123".to_string()),
            // Can read Bob's public profile
            Capability::ReadMessages(format!("profiles/{}/public", bob_identity.user_id)),
        ],
        signature: None,
        expires_at,
    };
    
    alice_token.sign(&alice_signing_key);
    
    // Bob's token only grants access to his own profile paths
    let mut bob_token = AuthToken {
        user_id: bob_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            // Can read/write to his profile
            Capability::ReadMessages(format!("profiles/{}", bob_identity.user_id)),
            Capability::WriteMessages(format!("profiles/{}", bob_identity.user_id)),
        ],
        signature: None,
        expires_at,
    };
    
    bob_token.sign(&alice_signing_key); // In reality would be signed by Bob's key
    
    // Test if paths are validated correctly with auth tokens
    
    // 1. Alice accessing her own profile
    let alice_profile_path = garden_core::path::generate_profile_path(
        &alice_identity.user_id,
        "displayName",
        true // public
    );
    
    // Convert path to Path type
    let alice_profile_path = Path(alice_profile_path);
    
    // Check if Alice can access her profile path
    assert!(can_access_path(&alice_token, &alice_profile_path, now));
    
    // 2. Alice accessing Bob's public profile
    let bob_public_profile_path = garden_core::path::generate_profile_path(
        &bob_identity.user_id,
        "avatar",
        true // public
    );
    
    // Convert path to Path type
    let bob_public_profile_path = Path(bob_public_profile_path);
    
    // Check if Alice can access Bob's public profile
    assert!(can_access_path(&alice_token, &bob_public_profile_path, now));
    
    // 3. Alice accessing Bob's private profile - should fail
    let bob_private_profile_path = garden_core::path::generate_profile_path(
        &bob_identity.user_id,
        "settings",
        false // private
    );
    
    // Convert path to Path type
    let bob_private_profile_path = Path(bob_private_profile_path);
    
    // Check if Alice cannot access Bob's private profile
    assert!(!can_access_path(&alice_token, &bob_private_profile_path, now));
    
    // 4. Alice accessing group data
    let group_path = garden_core::path::build_path(&["groups", "group-123", "metadata"]);
    let group_path = Path(group_path);
    
    // Check if Alice can access group data (she has ManageGroup capability)
    assert!(can_access_path(&alice_token, &group_path, now));
    
    // 5. Bob cannot access Alice's profile
    let alice_private_path = garden_core::path::generate_profile_path(
        &alice_identity.user_id,
        "settings",
        false // private
    );
    
    // Convert path to Path type
    let alice_private_path = Path(alice_private_path);
    
    // Check if Bob cannot access Alice's private profile
    assert!(!can_access_path(&bob_token, &alice_private_path, now));
    
    // 6. Bob cannot access group data
    assert!(!can_access_path(&bob_token, &group_path, now));
}

// Test path validation with direct message paths
#[test]
fn test_auth_with_direct_message_paths() {
    // Create test identities
    let (alice_identity, alice_signing_key) = Identity::generate_identity();
    let (bob_identity, _) = Identity::generate_identity();
    
    // Create tokens with direct message capabilities
    let now = Utc::now().timestamp();
    let expires_at = now + 3600;
    
    // Alice's token grants access to messages with Bob
    let mut alice_token = AuthToken {
        user_id: alice_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            // Can read/write messages with Bob
            Capability::ReadMessages(format!("messages/{}/{}", alice_identity.user_id, bob_identity.user_id)),
            Capability::WriteMessages(format!("messages/{}/{}", alice_identity.user_id, bob_identity.user_id)),
        ],
        signature: None,
        expires_at,
    };
    
    alice_token.sign(&alice_signing_key);
    
    // Create a direct message path
    let thread_id = "thread-123";
    let msg_id = "msg-456";
    
    // Construct path using the helper function
    let message_path = garden_core::path::generate_direct_message_path(
        &alice_identity.user_id,
        &bob_identity.user_id,
        thread_id,
        msg_id
    );
    
    // Convert to Path type
    let message_path = Path(message_path);
    
    // Check if Alice can access the direct message path
    assert!(can_access_path(&alice_token, &message_path, now));
    
    // Create a token for a different conversation Alice doesn't have access to
    let (charlie_identity, _) = Identity::generate_identity();
    
    // Create a path for a conversation between Bob and Charlie
    let other_message_path = garden_core::path::generate_direct_message_path(
        &bob_identity.user_id,
        &charlie_identity.user_id,
        "other-thread",
        "other-msg"
    );
    
    // Convert to Path type
    let other_message_path = Path(other_message_path);
    
    // Check if Alice cannot access this conversation
    assert!(!can_access_path(&alice_token, &other_message_path, now));
}

// Test path validation with group message paths
#[test]
fn test_auth_with_group_message_paths() {
    // Create test identities
    let (owner_identity, owner_signing_key) = Identity::generate_identity();
    let (member_identity, _) = Identity::generate_identity();
    let (non_member_identity, _) = Identity::generate_identity();
    
    // Set up group ID and message ID
    let group_id = "group-789";
    let msg_id = "msg-321";
    
    // Current time
    let now = Utc::now().timestamp();
    let expires_at = now + 3600;
    
    // Owner's token with group management capability
    let mut owner_token = AuthToken {
        user_id: owner_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            Capability::ManageGroup(group_id.to_string()),
            Capability::ReadMessages(format!("groups/{}", group_id)),
            Capability::WriteMessages(format!("groups/{}", group_id)),
        ],
        signature: None,
        expires_at,
    };
    
    owner_token.sign(&owner_signing_key);
    
    // Member's token with read/write but not manage capability
    let mut member_token = AuthToken {
        user_id: member_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            Capability::ReadMessages(format!("groups/{}", group_id)),
            Capability::WriteMessages(format!("groups/{}", group_id)),
        ],
        signature: None,
        expires_at,
    };
    
    member_token.sign(&owner_signing_key); // In reality would be signed by member's key
    
    // Non-member's token with no group capabilities
    let mut non_member_token = AuthToken {
        user_id: non_member_identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            // No capabilities for this group
        ],
        signature: None,
        expires_at,
    };
    
    non_member_token.sign(&owner_signing_key);
    
    // Create a group message path
    let group_message_path = garden_core::path::generate_group_message_path(group_id, msg_id);
    
    // Convert to Path type
    let group_message_path = Path(group_message_path);
    
    // Check access for each user
    
    // Owner should have access
    assert!(can_access_path(&owner_token, &group_message_path, now));
    
    // Member should have access
    assert!(can_access_path(&member_token, &group_message_path, now));
    
    // Non-member should not have access
    assert!(!can_access_path(&non_member_token, &group_message_path, now));
    
    // Create a group metadata path
    let group_meta_path = garden_core::path::build_path(&["groups", group_id, "metadata"]);
    let group_meta_path = Path(group_meta_path);
    
    // Owner should have access to metadata
    assert!(can_access_path(&owner_token, &group_meta_path, now));
    
    // Member should not have access to metadata (requires ManageGroup)
    assert!(!can_access_path(&member_token, &group_meta_path, now));
}

// Function to check if a token can access a path
fn can_access_path(token: &AuthToken, path: &Path, now: Timestamp) -> bool {
    // Check if token is expired
    if !token.is_valid(now) {
        return false;
    }
    
    // Validate the path
    if !garden_core::path::validate_path(&path.0) {
        return false;
    }
    
    // Split path into components
    let components: Vec<&str> = path.0.split('/').collect();
    
    // Empty path or too short
    if components.len() < 2 {
        return false;
    }
    
    // Check based on path type
    match components[0] {
        "profiles" => {
            let user_id = components[1];
            
            // Check if token belongs to the user
            if token.user_id == user_id {
                return true; // Users always have access to their own profiles
            }
            
            // If trying to access public profile
            if components.len() >= 3 && components[2] == "public" {
                // Check if token has read capability for the user's public profile
                return token.has_capability(
                    &Capability::ReadMessages(format!("profiles/{}/public", user_id))
                ) || token.has_capability(
                    &Capability::ReadMessages(format!("profiles/{}", user_id))
                );
            }
            
            // If trying to access private profile, more strict checks
            return token.has_capability(&Capability::ReadMessages(format!("profiles/{}", user_id)));
        },
        "messages" => {
            // Direct message path should have format "messages/sender_id/recipient_id/..."
            if components.len() < 4 {
                return false;
            }
            
            let sender_id = components[1];
            let recipient_id = components[2];
            
            // Check if token belongs to sender or recipient
            if token.user_id == sender_id || token.user_id == recipient_id {
                return true; // Users always have access to their own messages
            }
            
            // Check for specific read capability
            return token.has_capability(
                &Capability::ReadMessages(format!("messages/{}/{}", sender_id, recipient_id))
            );
        },
        "groups" => {
            if components.len() < 2 {
                return false;
            }
            
            let group_id = components[1];
            
            // Check if path relates to group messages
            if components.len() >= 3 && components[2] == "messages" {
                // Need read capability for group messages
                return token.has_capability(
                    &Capability::ReadMessages(format!("groups/{}", group_id))
                );
            }
            
            // For group metadata and other administrative paths
            return token.has_capability(&Capability::ManageGroup(group_id.to_string()));
        },
        "devices" => {
            if components.len() < 2 {
                return false;
            }
            
            let user_id = components[1];
            
            // Check if token belongs to the user
            if token.user_id == user_id {
                return true; // Users always have access to their own device info
            }
            
            // Device access requires ManageDevice capability
            return token.has_capability(&Capability::ManageDevice(user_id.to_string()));
        },
        _ => {
            // Unknown path type
            return false;
        }
    }
} 