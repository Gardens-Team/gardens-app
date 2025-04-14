// Tests for group encryption functionality
use std::time::Duration;

use garden_core::{
    identity::Identity,
    p2p::{GardenConfig, create_garden_client},
};

#[tokio::test]
async fn test_group_encryption_lifecycle() {
    // Create test identities
    let (alice_id, _) = Identity::generate_identity();
    let (bob_id, _) = Identity::generate_identity();
    let (charlie_id, _) = Identity::generate_identity();
    
    // Set up clients with short timeouts for testing
    let mut alice_config = GardenConfig::default();
    alice_config.user_identity = Some(alice_id.clone());
    alice_config.discovery_timeout = Duration::from_millis(500);
    
    let mut bob_config = GardenConfig::default();
    bob_config.user_identity = Some(bob_id.clone());
    bob_config.discovery_timeout = Duration::from_millis(500);
    
    let mut charlie_config = GardenConfig::default();
    charlie_config.user_identity = Some(charlie_id.clone());
    charlie_config.discovery_timeout = Duration::from_millis(500);
    
    // Create and initialize clients
    let alice_client = create_garden_client(alice_config).await.unwrap();
    alice_client.initialize_group_encryption().await.unwrap();
    
    let bob_client = create_garden_client(bob_config).await.unwrap();
    bob_client.initialize_group_encryption().await.unwrap();
    
    let charlie_client = create_garden_client(charlie_config).await.unwrap();
    charlie_client.initialize_group_encryption().await.unwrap();
    
    // Test group creation
    let group_id = "test-encryption-group";
    let key_bytes = alice_client.create_encrypted_group(group_id).await.unwrap();
    
    // Verify key bytes contain the group ID (this is how our mock implementation works)
    assert_eq!(String::from_utf8(key_bytes.clone()).unwrap(), group_id);
    
    // Test joining group
    bob_client.join_encrypted_group(group_id, key_bytes.clone()).await.unwrap();
    charlie_client.join_encrypted_group(group_id, key_bytes).await.unwrap();
    
    // Subscribe to group topic
    let group_topic = alice_client.create_group_message_topic(group_id);
    alice_client.subscribe(group_topic.clone()).await.unwrap();
    bob_client.subscribe(group_topic.clone()).await.unwrap();
    charlie_client.subscribe(group_topic.clone()).await.unwrap();
    
    // Test sending encrypted messages
    let test_messages = [
        (b"Message 1 from Alice".to_vec(), &alice_client),
        (b"Message 2 from Bob".to_vec(), &bob_client),
        (b"Message 3 from Charlie".to_vec(), &charlie_client),
    ];
    
    for (message, sender) in &test_messages {
        sender.send_encrypted_group_message(group_id, message).await.unwrap();
    }
    
    // Give some time for message processing
    tokio::time::sleep(Duration::from_millis(200)).await;
    
    // Process events
    alice_client.process_events().await.unwrap();
    bob_client.process_events().await.unwrap();
    charlie_client.process_events().await.unwrap();
    
    // Test decryption with mock encrypted data
    for (message, _) in &test_messages {
        // Create mock encrypted message
        let mut encrypted = b"ENCRYPTED:".to_vec();
        encrypted.extend_from_slice(&message);
        
        // Verify each client can decrypt
        let decrypted_alice = alice_client.receive_encrypted_group_message(group_id, &encrypted).await.unwrap();
        let decrypted_bob = bob_client.receive_encrypted_group_message(group_id, &encrypted).await.unwrap();
        let decrypted_charlie = charlie_client.receive_encrypted_group_message(group_id, &encrypted).await.unwrap();
        
        assert_eq!(decrypted_alice, *message);
        assert_eq!(decrypted_bob, *message);
        assert_eq!(decrypted_charlie, *message);
    }
    
    // Clean up
    alice_client.shutdown().await.unwrap();
    bob_client.shutdown().await.unwrap();
    charlie_client.shutdown().await.unwrap();
}

#[tokio::test]
async fn test_group_topic_management() {
    // Create test identity
    let (identity, _) = Identity::generate_identity();
    
    // Configure client
    let mut config = GardenConfig::default();
    config.user_identity = Some(identity.clone());
    
    // Create and initialize client
    let client = create_garden_client(config).await.unwrap();
    
    // Test topic format
    let group_id = "test-group-123";
    let topic = client.create_group_message_topic(group_id);
    
    assert_eq!(topic.name(), "garden/group/test-group-123");
    
    // Test subscribing to topic
    client.subscribe(topic.clone()).await.unwrap();
    
    // Test multiple group topics
    let group_ids = ["group1", "group2", "group3"];
    let mut topics = Vec::new();
    
    for id in &group_ids {
        let topic = client.create_group_message_topic(id);
        topics.push(topic.clone());
        client.subscribe(topic).await.unwrap();
    }
    
    // Verify topics
    assert_eq!(topics.len(), 3);
    assert_eq!(topics[0].name(), "garden/group/group1");
    assert_eq!(topics[1].name(), "garden/group/group2");
    assert_eq!(topics[2].name(), "garden/group/group3");
    
    // Clean up
    client.shutdown().await.unwrap();
}

#[tokio::test]
async fn test_encrypted_message_serialization() {
    // Create test identities
    let (alice_id, _) = Identity::generate_identity();
    let (bob_id, _) = Identity::generate_identity();
    
    // Configure clients
    let mut alice_config = GardenConfig::default();
    alice_config.user_identity = Some(alice_id.clone());
    
    let mut bob_config = GardenConfig::default();
    bob_config.user_identity = Some(bob_id.clone());
    
    // Create and initialize clients
    let alice_client = create_garden_client(alice_config).await.unwrap();
    alice_client.initialize_group_encryption().await.unwrap();
    
    let bob_client = create_garden_client(bob_config).await.unwrap();
    bob_client.initialize_group_encryption().await.unwrap();
    
    // Alice creates a group
    let group_id = "serialization-test-group";
    let key_bytes = alice_client.create_encrypted_group(group_id).await.unwrap();
    
    // Bob joins the group
    bob_client.join_encrypted_group(group_id, key_bytes).await.unwrap();
    
    // Test message serialization
    let original_message = b"This is a test of encrypted message serialization";
    
    // In a real scenario, we'd send this through the network, but for testing,
    // we'll simulate the encryption/decryption process
    
    // Create a mock encrypted message with our known format
    let mut encrypted = b"ENCRYPTED:".to_vec();
    encrypted.extend_from_slice(original_message);
    
    // Decrypt with both clients
    let alice_decrypted = alice_client.receive_encrypted_group_message(group_id, &encrypted).await.unwrap();
    let bob_decrypted = bob_client.receive_encrypted_group_message(group_id, &encrypted).await.unwrap();
    
    // Verify decryption
    assert_eq!(alice_decrypted, original_message);
    assert_eq!(bob_decrypted, original_message);
    
    // Test error handling - invalid encrypted format
    let invalid_encrypted = b"INVALID_PREFIX:message".to_vec();
    let result = alice_client.receive_encrypted_group_message(group_id, &invalid_encrypted).await;
    assert!(result.is_err());
    
    // Clean up
    alice_client.shutdown().await.unwrap();
    bob_client.shutdown().await.unwrap();
} 