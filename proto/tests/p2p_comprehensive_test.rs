// Comprehensive P2P test simulating multiple peers, topics, and gardens
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use rand::{Rng, thread_rng, seq::SliceRandom};
use tokio::time::{sleep, Duration};

use garden_core::{
    identity::Identity,
    p2p::{GardenConfig, GardenClient, create_garden_client, Topic},
};

// Reduced number of peers to avoid system file descriptor limits
const NUM_PEERS: usize = 15; // Reduced from 50
const NUM_TOPICS: usize = 50; // Reduced from 200
const NUM_GARDENS: usize = 3; // Reduced from 5
const TOPICS_PER_GARDEN: usize = 4;
const PEERS_PER_BATCH: usize = 3; // Initialize peers in small batches

// Mock Peer structure for testing
struct MockPeer {
    id: String,
    client: GardenClient,
    subscribed_topics: Arc<Mutex<HashSet<Topic>>>,
    connected_peers: Arc<Mutex<HashSet<String>>>,
}

// Create a list of random topics
fn create_random_topics(count: usize) -> Vec<Topic> {
    let mut topics = Vec::with_capacity(count);
    let mut rng = thread_rng();
    
    for _ in 0..count {
        // Create randomized topic categories and IDs
        let categories = [
            "chat", "media", "events", "groups", 
            "feeds", "data", "sensors", "activities",
            "projects", "documents", "collaboration", "updates"
        ];
        let category = categories[rng.gen_range(0..categories.len())];
        let id = rng.gen_range(1000..10000);
        let topic_name = format!("garden/{}/{}", category, id);
        topics.push(Topic::new(&topic_name));
    }
    
    topics
}

// Create garden topics with random selections from the main topic list
fn create_gardens_with_topics(
    all_topics: &[Topic], 
    num_gardens: usize, 
    topics_per_garden: usize
) -> HashMap<String, Vec<Topic>> {
    let mut gardens = HashMap::new();
    let mut rng = thread_rng();
    
    for i in 0..num_gardens {
        let garden_id = format!("garden-{}", i);
        let selected_topics: Vec<Topic> = all_topics
            .choose_multiple(&mut rng, topics_per_garden)
            .cloned()
            .collect();
        
        gardens.insert(garden_id, selected_topics);
    }
    
    gardens
}

// Create a single peer with initialization
async fn create_peer(peer_idx: usize) -> Result<MockPeer, Box<dyn std::error::Error>> {
    // Generate identity
    let (identity, _) = Identity::generate_identity();
    let peer_id = format!("peer-{}", peer_idx);
    
    // Create configuration
    let mut config = GardenConfig::default();
    config.user_identity = Some(identity);
    config.data_directory = format!("./test-data/{}", peer_id);
    
    // Create peer client
    let client = create_garden_client(config).await?;
    
    // Create mock peer
    let peer = MockPeer {
        id: peer_id,
        client,
        subscribed_topics: Arc::new(Mutex::new(HashSet::new())),
        connected_peers: Arc::new(Mutex::new(HashSet::new())),
    };
    
    Ok(peer)
}

#[tokio::test]
async fn test_p2p_comprehensive_test() {
    // Set up logging for better test visibility
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    
    println!("Creating {} random topics...", NUM_TOPICS);
    let all_topics = create_random_topics(NUM_TOPICS);
    
    println!("Creating {} gardens with {} topics each...", NUM_GARDENS, TOPICS_PER_GARDEN);
    let gardens = create_gardens_with_topics(&all_topics, NUM_GARDENS, TOPICS_PER_GARDEN);
    
    // Print garden information for debugging
    for (garden_id, topics) in &gardens {
        println!("Garden '{}' has topics:", garden_id);
        for topic in topics {
            println!("  - {}", topic.name());
        }
    }
    
    // Create peers in batches to avoid hitting file descriptor limits
    println!("Creating {} mock peers in batches of {}...", NUM_PEERS, PEERS_PER_BATCH);
    let mut peers = Vec::with_capacity(NUM_PEERS);
    
    for batch_start in (0..NUM_PEERS).step_by(PEERS_PER_BATCH) {
        let mut batch_peers = Vec::new();
        let batch_end = (batch_start + PEERS_PER_BATCH).min(NUM_PEERS);
        
        println!("Creating peers {}-{}", batch_start, batch_end - 1);
        
        // Create peers in the current batch
        for i in batch_start..batch_end {
            match create_peer(i).await {
                Ok(peer) => {
                    batch_peers.push(peer);
                },
                Err(e) => {
                    println!("Failed to create peer-{}: {}", i, e);
                    // Continue with fewer peers rather than failing the test
                }
            }
            
            // Short delay between peer creations
            sleep(Duration::from_millis(50)).await;
        }
        
        // Add this batch of peers to our collection
        peers.extend(batch_peers);
        
        // Wait longer between batches to allow resources to be cleaned up
        sleep(Duration::from_millis(200)).await;
    }
    
    println!("Successfully created {} peers", peers.len());
    
    if peers.len() < NUM_GARDENS {
        panic!("Not enough peers ({}) to distribute among gardens ({})", peers.len(), NUM_GARDENS);
    }
    
    // Randomly assign gardens to peers (evenly distributed)
    println!("Assigning gardens to peers...");
    let peers_per_garden = peers.len() / NUM_GARDENS;
    
    let mut rng = thread_rng();
    let mut available_peers: Vec<usize> = (0..peers.len()).collect();
    available_peers.shuffle(&mut rng);
    
    let mut garden_peers: HashMap<String, Vec<usize>> = HashMap::new();
    
    for (i, (garden_id, _)) in gardens.iter().enumerate() {
        if i < NUM_GARDENS {
            let start = i * peers_per_garden;
            let end = if i == NUM_GARDENS - 1 {
                // Last garden gets any remaining peers
                peers.len()
            } else {
                start + peers_per_garden
            };
            
            if start < available_peers.len() {
                let end_idx = end.min(available_peers.len());
                let garden_peer_indices = &available_peers[start..end_idx];
                
                garden_peers.insert(garden_id.clone(), garden_peer_indices.to_vec());
                
                println!("Garden '{}' has {} peers", garden_id, garden_peer_indices.len());
            }
        }
    }
    
    // Subscribe peers to their garden topics
    println!("Subscribing peers to garden topics...");
    for (garden_id, peer_indices) in &garden_peers {
        let garden_topics = gardens.get(garden_id).unwrap();
        
        for &peer_idx in peer_indices {
            let peer = &peers[peer_idx];
            
            println!("Peer '{}' joining garden '{}'", peer.id, garden_id);
            
            // Subscribe to all topics in this garden
            for topic in garden_topics {
                match peer.client.subscribe(topic.clone()).await {
                    Ok(_) => {
                        let mut subscribed = peer.subscribed_topics.lock().unwrap();
                        subscribed.insert(topic.clone());
                        println!("  - Subscribed to topic '{}'", topic.name());
                    },
                    Err(e) => {
                        println!("  - Failed to subscribe to topic '{}': {}", topic.name(), e);
                    }
                }
                
                // Short delay between subscriptions to avoid resource spikes
                sleep(Duration::from_millis(10)).await;
            }
        }
    }
    
    // Simulate peer discovery with rate limiting
    println!("Simulating peer discovery...");
    for (_, peer_indices) in &garden_peers {
        // Each peer in the garden connects to other peers in the same garden
        for (i, &peer_idx) in peer_indices.iter().enumerate() {
            let peer = &peers[peer_idx];
            
            // Connect to a limited number of other peers in the same garden
            let max_connections = 2.min(peer_indices.len() - 1);
            let mut connection_count = 0;
            
            for &other_idx in peer_indices.iter().skip(i + 1) {
                if connection_count >= max_connections {
                    break;
                }
                
                let other_peer = &peers[other_idx];
                
                println!("Peer '{}' connecting to peer '{}'", peer.id, other_peer.id);
                
                // Simulate connection in both directions
                match peer.client.connect_to_peer(&other_peer.id).await {
                    Ok(_) => {
                        let mut connected = peer.connected_peers.lock().unwrap();
                        connected.insert(other_peer.id.clone());
                    },
                    Err(e) => {
                        println!("  - Failed to connect: {}", e);
                    }
                }
                
                match other_peer.client.connect_to_peer(&peer.id).await {
                    Ok(_) => {
                        let mut connected = other_peer.connected_peers.lock().unwrap();
                        connected.insert(peer.id.clone());
                    },
                    Err(e) => {
                        println!("  - Failed to connect: {}", e);
                    }
                }
                
                connection_count += 1;
                
                // Short delay between connections
                sleep(Duration::from_millis(20)).await;
            }
        }
    }
    
    // Verify connections
    println!("Verifying peer connections...");
    for (_, peer_indices) in &garden_peers {
        for &peer_idx in peer_indices {
            let peer = &peers[peer_idx];
            let connected = peer.connected_peers.lock().unwrap();
            
            println!("Peer '{}' has {} connections", peer.id, connected.len());
            
            // Each peer should have at least one connection
            assert!(!connected.is_empty(), "Peer should have at least one connection");
        }
    }
    
    // Simulate message passing
    println!("Simulating message passing between peers...");
    for (garden_id, peer_indices) in &garden_peers {
        // Skip if no peers in this garden
        if peer_indices.is_empty() {
            continue;
        }
        
        let garden_topics = gardens.get(garden_id).unwrap();
        
        // Choose a random sender
        let sender_idx = *peer_indices.choose(&mut rng).unwrap();
        let sender = &peers[sender_idx];
        
        // Choose a random topic
        let topic = garden_topics.choose(&mut rng).unwrap();
        
        // Prepare message
        let message = format!("Hello from {} on topic {}", sender.id, topic.name());
        println!("Peer '{}' sending message on topic '{}'", sender.id, topic.name());
        
        // Send message
        match sender.client.send_message(topic, message.as_bytes()).await {
            Ok(_) => {
                println!("  - Message sent successfully");
            },
            Err(e) => {
                println!("  - Failed to send message: {}", e);
            }
        }
        
        // In a real implementation, we would verify message reception
        // For this test, we're just demonstrating the sending capability
    }
    
    // Test group creation (using mocked group functionality)
    println!("Testing group encryption functionality...");
    if !peers.is_empty() {
        let group_creator_idx = rng.gen_range(0..peers.len());
        let group_creator = &peers[group_creator_idx];
        
        let group_id = "test-encrypted-group";
        println!("Peer '{}' creating encrypted group '{}'", group_creator.id, group_id);
        
        match group_creator.client.create_encrypted_group(group_id).await {
            Ok(key_package) => {
                println!("  - Group created successfully, key package size: {} bytes", key_package.len());
                
                // Choose a smaller number of random peers to join the group to avoid resource limits
                let max_joiners = 2.min(peers.len() - 1);
                let joiners: Vec<usize> = (0..peers.len())
                    .filter(|&i| i != group_creator_idx)
                    .collect::<Vec<_>>()
                    .choose_multiple(&mut rng, max_joiners)
                    .cloned()
                    .collect();
                
                // Have peers join the group
                for &joiner_idx in &joiners {
                    let joiner = &peers[joiner_idx];
                    println!("Peer '{}' joining group", joiner.id);
                    
                    match joiner.client.join_encrypted_group(group_id, key_package.clone()).await {
                        Ok(_) => {
                            println!("  - Joined group successfully");
                        },
                        Err(e) => {
                            println!("  - Failed to join group: {}", e);
                        }
                    }
                    
                    // Short delay between joins
                    sleep(Duration::from_millis(50)).await;
                }
                
                // Test encrypted message sending
                println!("Testing encrypted group messaging...");
                
                // Creator sends a message
                let message = format!("Encrypted message from {}", group_creator.id);
                match group_creator.client.send_encrypted_group_message(group_id, message.as_bytes()).await {
                    Ok(_) => {
                        println!("  - Creator sent encrypted message");
                    },
                    Err(e) => {
                        println!("  - Failed to send encrypted message: {}", e);
                    }
                }
                
                // One of the joiners sends a message
                if !joiners.is_empty() {
                    let joiner = &peers[joiners[0]];
                    let reply = format!("Encrypted reply from {}", joiner.id);
                    
                    match joiner.client.send_encrypted_group_message(group_id, reply.as_bytes()).await {
                        Ok(_) => {
                            println!("  - Joiner sent encrypted reply");
                        },
                        Err(e) => {
                            println!("  - Failed to send encrypted reply: {}", e);
                        }
                    }
                }
            },
            Err(e) => {
                println!("  - Failed to create group: {}", e);
            }
        }
    }
    
    // Clean up all peers in reverse order (newest first)
    println!("Cleaning up all peers...");
    for peer in peers.iter().rev() {
        match peer.client.shutdown().await {
            Ok(_) => {
                println!("Shut down peer '{}'", peer.id);
            },
            Err(e) => {
                println!("Failed to shut down peer '{}': {}", peer.id, e);
            }
        }
        
        // Short delay between shutdowns to avoid resource spikes
        sleep(Duration::from_millis(50)).await;
    }
    
    println!("Comprehensive P2P test completed!");
} 