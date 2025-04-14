// Integration tests for Auth functionality with other components
use std::time::Duration;

use garden_core::{
    auth::AuthToken,
    identity::{Identity, Device, Capability},
    p2p::{GardenConfig, GardenClient, create_garden_client, Topic},
    types::{Timestamp, SubspaceId},
    entries::GardenEntry,
};

use p2panda_core::identity::PrivateKey;
use ed25519_dalek::{SigningKey, VerifyingKey};
use chrono::Utc;

// Test AuthToken creation, signing, and verification
#[tokio::test]
async fn test_auth_token_lifecycle() {
    // Generate a new identity
    let (identity, signing_key) = Identity::generate_identity();
    let device_id = uuid::Uuid::new_v4().to_string();
    
    // Create a set of capabilities
    let capabilities = vec![
        Capability::ReadMessages("*".to_string()),
        Capability::WriteMessages("inbox".to_string()),
        Capability::CreateInvites,
    ];
    
    // Create current timestamp and expiry time
    let now = Utc::now().timestamp();
    let expires_at = now + 3600; // 1 hour from now
    
    // Create and sign auth token
    let mut token = AuthToken {
        user_id: identity.user_id.clone(),
        device_id: device_id.clone(),
        capabilities: capabilities.clone(),
        signature: None,
        expires_at,
    };
    
    // Sign the token
    token.sign(&signing_key);
    
    // Verify token has a signature now
    assert!(token.signature.is_some());
    
    // Create verifying key from identity's public key
    let public_key_bytes: [u8; 32] = identity.public_key.clone().try_into()
        .expect("Invalid public key length");
    let verifying_key = VerifyingKey::from_bytes(&public_key_bytes)
        .expect("Invalid public key");
    
    // Verify the token
    assert!(token.verify(&verifying_key));
    assert!(token.is_valid(now));
    assert!(!token.is_valid(now + 7200)); // Should be invalid after expiry
    
    // Verify capabilities
    assert!(token.has_capability(&Capability::ReadMessages("*".to_string())));
    assert!(token.has_capability(&Capability::WriteMessages("inbox".to_string())));
    assert!(token.has_capability(&Capability::CreateInvites));
    assert!(!token.has_capability(&Capability::AdminAccess));
}

// Test auth token validation with entries
#[tokio::test]
async fn test_auth_with_entries() {
    // Generate a new identity
    let (identity, signing_key) = Identity::generate_identity();
    let device_id = uuid::Uuid::new_v4().to_string();
    
    // Create auth token with specific capabilities
    let group_id = "test-group-123";
    let capabilities = vec![
        Capability::WriteMessages("inbox".to_string()),
        Capability::ManageGroup(group_id.to_string()),
    ];
    
    let now = Utc::now().timestamp();
    let expires_at = now + 3600;
    
    let mut token = AuthToken {
        user_id: identity.user_id.clone(),
        device_id: device_id.clone(),
        capabilities: capabilities.clone(),
        signature: None,
        expires_at,
    };
    
    // Sign the token
    token.sign(&signing_key);
    
    // Test token against different entry types
    let subspace_id = SubspaceId("test-subspace".to_string());
    
    // Test with GroupMessage entry - should have access
    let group_message = GardenEntry::GroupMessage {
        group_id: group_id.to_string(),
        sender_id: identity.user_id.clone(),
        subspace_id: subspace_id.clone(),
        encrypted_content: vec![1, 2, 3],
        timestamp: now,
        message_type: garden_core::types::MessageType::Text,
        attachments: vec![],
    };
    
    // Test with direct message entry - should have access
    let direct_message = GardenEntry::DirectMessage {
        sender_id: identity.user_id.clone(),
        recipient_id: "other-user".to_string(),
        thread_id: "thread-1".to_string(),
        subspace_id: subspace_id.clone(),
        encrypted_content: vec![1, 2, 3],
        timestamp: now,
        message_type: garden_core::types::MessageType::Text,
        attachments: vec![],
    };
    
    // This test would typically call a function that checks if the token authorizes operations
    // on these entries. Since we don't have a direct function for this in the codebase,
    // we'll just verify the capabilities exist that would be required.
    
    // For GroupMessage, we check if token has ManageGroup capability
    assert!(token.has_capability(&Capability::ManageGroup(group_id.to_string())));
    
    // For DirectMessage, we check if token has WriteMessages capability
    assert!(token.has_capability(&Capability::WriteMessages("inbox".to_string())));
}

// Test integrating auth with P2P client
#[tokio::test]
async fn test_auth_with_p2p() {
    // Generate a new identity
    let (identity, signing_key) = Identity::generate_identity();
    let device_id = uuid::Uuid::new_v4().to_string();
    
    // Create a set of capabilities
    let capabilities = vec![
        Capability::ReadMessages("*".to_string()),
        Capability::WriteMessages("*".to_string()),
    ];
    
    // Create auth token
    let now = Utc::now().timestamp();
    let expires_at = now + 3600;
    
    let mut token = AuthToken {
        user_id: identity.user_id.clone(),
        device_id: device_id.clone(),
        capabilities: capabilities.clone(),
        signature: None,
        expires_at,
    };
    
    // Sign the token
    token.sign(&signing_key);
    
    // Create P2P client configuration with the identity
    let config = GardenConfig {
        discovery_timeout: Duration::from_secs(5),
        connection_timeout: Duration::from_secs(5),
        user_identity: Some(identity.clone()),
        ..Default::default()
    };
    
    // Create and initialize P2P client
    let client = create_garden_client(config).await.expect("Failed to create client");
    
    // Create a test topic for sending a message
    let test_topic = Topic::new("garden/test/auth");
    
    // Subscribe to the topic
    client.subscribe(test_topic.clone()).await.expect("Failed to subscribe");
    
    // Simulate sending a message with auth token attached
    // In a real implementation, you would validate the token before allowing sending
    // We'll just check that the token is valid
    assert!(token.is_valid(now));
    
    // Send a message including the token for authorization
    let message_with_auth = format!("{{\"auth\":{:?},\"content\":\"Hello World\"}}", token);
    client.send_message(&test_topic, message_with_auth.as_bytes()).await
        .expect("Failed to send message");
    
    // Normally we would listen for this message and validate the token
    // Since we can't easily do that in this test, we'll just verify token properties
    
    // Clean up
    client.unsubscribe(&test_topic).await.expect("Failed to unsubscribe");
    client.shutdown().await.expect("Failed to shut down client");
}

// Test token with created encrypted group
#[tokio::test]
async fn test_auth_with_encrypted_group() {
    // Generate a new identity
    let (identity, signing_key) = Identity::generate_identity();
    let device_id = uuid::Uuid::new_v4().to_string();
    
    // Create a group ID
    let group_id = "test-encrypted-group-123";
    
    // Create capabilities including group management
    let capabilities = vec![
        Capability::ManageGroup(group_id.to_string()),
    ];
    
    // Create auth token
    let now = Utc::now().timestamp();
    let expires_at = now + 3600;
    
    let mut token = AuthToken {
        user_id: identity.user_id.clone(),
        device_id: device_id.clone(),
        capabilities: capabilities.clone(),
        signature: None,
        expires_at,
    };
    
    // Sign the token
    token.sign(&signing_key);
    
    // Create P2P client with the identity
    let config = GardenConfig {
        user_identity: Some(identity.clone()),
        ..Default::default()
    };
    
    // Create and initialize P2P client
    let client = create_garden_client(config).await.expect("Failed to create client");
    
    // Initialize group encryption
    client.initialize_group_encryption().await.expect("Failed to initialize group encryption");
    
    // Create an encrypted group - validate token first
    assert!(token.has_capability(&Capability::ManageGroup(group_id.to_string())));
    
    let key_package = client.create_encrypted_group(group_id).await.expect("Failed to create group");
    
    // Ensure key package is valid
    assert!(!key_package.is_empty());
    
    // Create second client to join the group
    let (identity2, _) = Identity::generate_identity();
    let config2 = GardenConfig {
        user_identity: Some(identity2.clone()),
        ..Default::default()
    };
    
    let client2 = create_garden_client(config2).await.expect("Failed to create second client");
    client2.initialize_group_encryption().await.expect("Failed to initialize group encryption");
    
    // Create capabilities for the second client
    let capabilities2 = vec![
        Capability::ReadMessages(format!("group:{}", group_id)),
        Capability::WriteMessages(format!("group:{}", group_id)),
    ];
    
    let mut token2 = AuthToken {
        user_id: identity2.user_id.clone(),
        device_id: uuid::Uuid::new_v4().to_string(),
        capabilities: capabilities2,
        signature: None,
        expires_at,
    };
    
    // Sign the second token
    token2.sign(&signing_key); // In reality would be signed by a group admin
    
    // Join the group - validate token first
    assert!(token2.has_capability(&Capability::ReadMessages(format!("group:{}", group_id))));
    assert!(token2.has_capability(&Capability::WriteMessages(format!("group:{}", group_id))));
    
    client2.join_encrypted_group(group_id, key_package).await.expect("Failed to join group");
    
    // Send encrypted message from both clients
    let message1 = b"Hello from client 1";
    let message2 = b"Hello from client 2";
    
    client.send_encrypted_group_message(group_id, message1).await.expect("Failed to send message 1");
    client2.send_encrypted_group_message(group_id, message2).await.expect("Failed to send message 2");
    
    // Clean up
    client.shutdown().await.expect("Failed to shut down client");
    client2.shutdown().await.expect("Failed to shut down client2");
} 