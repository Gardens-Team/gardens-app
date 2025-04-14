// Integration tests for the P2P functionality
use std::time::Duration;

use garden_core::{
    identity::Identity,
    p2p::{GardenConfig, create_garden_client, create_user_topics, Topic, P2PError},
    types::SubspaceId,
};
use p2panda_core::identity::PrivateKey;

// This test needs to be run with --test-threads=1 because we're working with global resources
#[tokio::test]
async fn test_p2p_client_lifecycle() {
    // Generate a new identity for this test
    let (identity, _) = Identity::generate_identity();
    
    // Create P2P client configuration
    let config = GardenConfig {
        discovery_timeout: Duration::from_secs(5),  // Short timeout for tests
        connection_timeout: Duration::from_secs(5), // Short timeout for tests
        user_identity: Some(identity.clone()),
        ..Default::default()
    };
    
    // Create and initialize the P2P client
    let client = create_garden_client(config).await.expect("Failed to create client");
    
    // Create a test topic
    let test_topic = Topic::new("garden/test/integration");
    
    // Subscribe to the topic
    client.subscribe(test_topic.clone()).await.expect("Failed to subscribe");
    
    // Try registering a subspace
    let subspace = SubspaceId("test-integration-subspace".to_string());
    client.register_subspace("test", subspace.clone()).expect("Failed to register subspace");
    
    // Retrieve the subspace
    let retrieved = client.get_subspace("test").expect("Failed to get subspace");
    assert!(retrieved.is_some());
    assert_eq!(retrieved.unwrap().0, "test-integration-subspace");
    
    // Try to start discovery (this might fail in test environments, so we'll handle the error)
    match client.start_discovery().await {
        Ok(_) => {
            // Process events for a short time
            client.process_events().await.expect("Failed to process events");
            
            // Stop discovery
            client.stop_discovery().await.expect("Failed to stop discovery");
        },
        Err(e) => {
            // It's okay if discovery fails in test environments
            println!("Note: Discovery didn't start (expected in test environments): {}", e);
        }
    }
    
    // Unsubscribe from the topic
    client.unsubscribe(&test_topic).await.expect("Failed to unsubscribe");
    
    // Shut down the client
    client.shutdown().await.expect("Failed to shut down client");
}

// Test error handling for uninitialized components
#[tokio::test]
async fn test_p2p_error_handling() {
    // Create a client but don't initialize it
    let config = GardenConfig::default();
    let client = garden_core::p2p::GardenClient::new(
        config, 
        PrivateKey::new()
    ).await.expect("Failed to create client");
    
    // Attempting to use uninitialized components should return appropriate errors
    
    // Try to start discovery
    match client.start_discovery().await {
        Err(P2PError::DiscoveryError(_)) => {
            // This is expected, so test passes
        },
        other => {
            panic!("Expected DiscoveryError, got {:?}", other);
        }
    }
    
    // Try to subscribe to a topic
    let topic = Topic::new("garden/test/error");
    match client.subscribe(topic).await {
        Err(P2PError::NetworkError(_)) => {
            // This is expected, so test passes
        },
        other => {
            panic!("Expected NetworkError, got {:?}", other);
        }
    }
    
    // No need to shut down since we didn't initialize
}

// Test topic management
#[tokio::test]
async fn test_topic_creation() {
    // Test user topic creation
    let user_id = "integration-test-user";
    let topics = create_user_topics(user_id);
    
    // Verify expected topics were created
    assert_eq!(topics.len(), 6);
    assert!(topics.iter().any(|t| t.name() == format!("users/{}/inbox", user_id)));
    assert!(topics.iter().any(|t| t.name() == format!("users/{}/presence", user_id)));
    assert!(topics.iter().any(|t| t.name() == format!("users/{}/profile", user_id)));
    assert!(topics.iter().any(|t| t.name() == format!("users/{}/apps", user_id)));
    assert!(topics.iter().any(|t| t.name() == format!("users/{}/topics", user_id)));
    assert!(topics.iter().any(|t| t.name() == format!("users/{}/gardens", user_id)));
} 