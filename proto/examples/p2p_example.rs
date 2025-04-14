// Examples of using the Garden P2P functionality
use std::time::Duration;
use tokio;

use garden_core::{
    identity::Identity,
    p2p::{GardenConfig, create_garden_client},
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    
    println!("Initializing Garden P2P with Group Encryption...");
    
    // Create two identities for demonstration
    let (alice_identity, _) = Identity::generate_identity();
    let (bob_identity, _) = Identity::generate_identity();
    
    println!("Created identities:");
    println!("Alice ID: {}", alice_identity.user_id);
    println!("Bob ID: {}", bob_identity.user_id);
    
    // Configure Alice's client
    let mut alice_config = GardenConfig::default();
    alice_config.user_identity = Some(alice_identity.clone());
    
    // Create and initialize Alice's client
    println!("\nInitializing Alice's client...");
    let alice_client = create_garden_client(alice_config).await?;
    alice_client.initialize_group_encryption().await?;
    
    // Configure Bob's client
    let mut bob_config = GardenConfig::default();
    bob_config.user_identity = Some(bob_identity.clone());
    
    // Create and initialize Bob's client
    println!("Initializing Bob's client...");
    let bob_client = create_garden_client(bob_config).await?;
    bob_client.initialize_group_encryption().await?;
    
    // Alice creates an encrypted group
    println!("\nAlice creating encrypted group...");
    let group_id = "test-group-1";
    let key_bytes = alice_client.create_encrypted_group(group_id).await?;
    println!("✓ Group created successfully");
    println!("  Key package size: {} bytes", key_bytes.len());
    
    // Bob joins the group using the key package
    println!("Bob joining the group...");
    bob_client.join_encrypted_group(group_id, key_bytes).await?;
    println!("✓ Bob joined the group successfully");
    
    // Alice subscribes to group messages
    let group_topic = alice_client.create_group_message_topic(group_id);
    println!("\nAlice subscribing to group topic: {}", group_topic.name());
    alice_client.subscribe(group_topic.clone()).await?;
    
    // Bob subscribes to group messages
    println!("Bob subscribing to group topic: {}", group_topic.name());
    bob_client.subscribe(group_topic.clone()).await?;
    
    // Send encrypted messages
    println!("\nTesting encrypted group messaging...");
    
    // Alice sends a message
    let alice_message = b"Hello from Alice! This message is encrypted using p2panda-group.";
    println!("Alice sending: {}", std::str::from_utf8(alice_message)?);
    alice_client.send_encrypted_group_message(group_id, alice_message).await?;
    println!("✓ Message sent");
    
    // Bob sends a message
    let bob_message = b"Hello from Bob! I've received your encrypted message.";
    println!("Bob sending: {}", std::str::from_utf8(bob_message)?);
    bob_client.send_encrypted_group_message(group_id, bob_message).await?;
    println!("✓ Message sent");
    
    // Process events and messages
    println!("\nProcessing events for 5 seconds to allow message delivery...");
    let start = std::time::Instant::now();
    
    while start.elapsed() < Duration::from_secs(5) {
        // Process events for both clients
        alice_client.process_events().await?;
        bob_client.process_events().await?;
        
        // Short sleep to avoid CPU spinning
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    
    println!("\nIn a real application, we would now see the following:");
    println!("1. Alice would receive Bob's encrypted message");
    println!("2. Alice would decrypt the message using her group session");
    println!("3. Bob would receive Alice's encrypted message");
    println!("4. Bob would decrypt the message using his group session");
    
    // Clean up resources
    println!("\nShutting down clients...");
    alice_client.shutdown().await?;
    bob_client.shutdown().await?;
    
    println!("Example completed successfully!");
    Ok(())
} 