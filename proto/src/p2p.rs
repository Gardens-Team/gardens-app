// garden-core/src/p2p.rs
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

// Import the specific correct types from p2panda crates
use p2panda_core::{
    identity::PrivateKey,
    hash::Hash,
};

use p2panda_discovery::{
    mdns::LocalDiscovery,
};

use p2panda_net::{
    Network,
    NetworkBuilder,
    NetworkId,
    TopicId,
    ToNetwork,
};

use p2panda_sync::{
    TopicQuery,
};

// Remove the unused import
// use p2panda_group;

use crate::identity::{Identity, Device};
use crate::types::{SubspaceId, NamespaceId};
use thiserror::Error;
use serde::{Serialize, Deserialize};
use futures_util::FutureExt;
use tokio::time;

// Error type for P2P operations
#[derive(Error, Debug)]
pub enum P2PError {
    #[error("Failed to initialize P2P network: {0}")]
    InitializationError(String),

    #[error("Peer discovery error: {0}")]
    DiscoveryError(String),

    #[error("Network connection error: {0}")]
    NetworkError(String),

    #[error("Synchronization error: {0}")]
    SyncError(String),

    #[error("Identity error: {0}")]
    IdentityError(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Group error: {0}")]
    GroupError(String),
}

// Result type for P2P operations
pub type P2PResult<T> = Result<T, P2PError>;

// Topic wrapper for subscription management
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Topic(String);

impl Topic {
    pub fn new(name: &str) -> Self {
        Topic(name.to_string())
    }

    pub fn name(&self) -> &str {
        &self.0
    }

    pub fn as_bytes(&self) -> Vec<u8> {
        self.0.as_bytes().to_vec()
    }
}

// Implement TopicId and TopicQuery for our Topic struct
impl TopicId for Topic {
    fn id(&self) -> [u8; 32] {
        // Create a hash of the topic name to use as the ID
        let hash = Hash::new(self.0.as_bytes());
        hash.into()
    }
}

impl TopicQuery for Topic {}

// Garden P2P Configuration
#[derive(Debug, Clone)]
pub struct GardenConfig {
    // Network settings
    pub discovery_timeout: Duration,
    pub connection_timeout: Duration,
    pub max_connections: usize,
    
    // App-specific settings
    pub user_identity: Option<Identity>,
    pub device: Option<Device>,
    pub namespaces: HashMap<String, NamespaceId>,
    pub data_directory: String,
}

impl Default for GardenConfig {
    fn default() -> Self {
        GardenConfig {
            discovery_timeout: Duration::from_secs(30),
            connection_timeout: Duration::from_secs(10),
            max_connections: 50,
            user_identity: None,
            device: None,
            namespaces: HashMap::new(),
            data_directory: "./garden-data".to_string(),
        }
    }
}

// Connection state for a peer
#[derive(Debug, Clone)]
pub struct PeerConnection {
    pub peer_id: String,
    pub topics: Vec<Topic>,
    pub last_seen: std::time::Instant,
    pub is_active: bool,
}

// Mock implementations for p2panda-group functionality
// These would be replaced with actual implementations when the real API is available
#[derive(Debug, Clone)]
struct MockGroup {
    #[allow(dead_code)]
    id: String,
    #[allow(dead_code)]
    members: Vec<String>,
}

#[derive(Debug, Clone)]
struct MockGroupSession {
    #[allow(dead_code)]
    group_id: String,
}

// Garden P2P Client
pub struct GardenClient {
    // P2Panda core components
    network: Option<Network<Topic>>,
    private_key: PrivateKey,
    
    // Garden-specific state
    pub config: GardenConfig, // Used to store configuration for reference
    connections: Arc<Mutex<HashMap<String, PeerConnection>>>,
    subscribed_topics: Arc<Mutex<Vec<Topic>>>,
    user_subspaces: Arc<Mutex<HashMap<String, SubspaceId>>>,
    
    // Group messaging state - using mock implementations until actual API is available
    groups: Arc<Mutex<HashMap<String, MockGroup>>>,
    group_sessions: Arc<Mutex<HashMap<String, MockGroupSession>>>,
}

impl GardenClient {
    /// Create a new Garden P2P client with the given configuration
    pub async fn new(config: GardenConfig, private_key: PrivateKey) -> P2PResult<Self> {
        Ok(GardenClient {
            network: None,
            private_key,
            config,
            connections: Arc::new(Mutex::new(HashMap::new())),
            subscribed_topics: Arc::new(Mutex::new(Vec::new())),
            user_subspaces: Arc::new(Mutex::new(HashMap::new())),
            groups: Arc::new(Mutex::new(HashMap::new())),
            group_sessions: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Initialize the P2P network components
    pub async fn initialize(&mut self) -> P2PResult<()> {
        // Create a unique network ID
        let network_id: NetworkId = [1; 32];
        
        // Create local discovery service
        let local_discovery = LocalDiscovery::new();
        
        // Build the network
        let network = NetworkBuilder::new(network_id)
            .private_key(self.private_key.clone())
            .discovery(local_discovery)
            .build()
            .await
            .map_err(|e| P2PError::InitializationError(format!("Failed to build network: {}", e)))?;
            
        self.network = Some(network);

        Ok(())
    }

    /// Start discovering peers
    pub async fn start_discovery(&self) -> P2PResult<()> {
        // p2panda-net's discovery is automatically started when building the network
        // This method is kept for API compatibility
        if self.network.is_some() {
            Ok(())
        } else {
            Err(P2PError::DiscoveryError("Network not initialized".to_string()))
        }
    }

    /// Stop discovering peers
    pub async fn stop_discovery(&self) -> P2PResult<()> {
        // p2panda-net doesn't provide a direct way to stop discovery
        // This method is kept for API compatibility
        if self.network.is_some() {
            Ok(())
        } else {
            Err(P2PError::DiscoveryError("Network not initialized".to_string()))
        }
    }

    /// Subscribe to a topic
    pub async fn subscribe(&self, topic: Topic) -> P2PResult<()> {
        if let Some(network) = &self.network {
            // Subscribe to the topic using p2panda-net's API
            let (_tx, _rx, _ready) = network.subscribe(topic.clone())
                .await
                .map_err(|e| P2PError::NetworkError(format!("Failed to subscribe to topic: {}", e)))?;
            
            // Add to our list of subscribed topics
            let mut topics = self.subscribed_topics.lock()
                .map_err(|_| P2PError::NetworkError("Failed to lock subscribed topics".to_string()))?;
            
            topics.push(topic);
            Ok(())
        } else {
            Err(P2PError::NetworkError("Network not initialized".to_string()))
        }
    }

    /// Unsubscribe from a topic
    pub async fn unsubscribe(&self, topic: &Topic) -> P2PResult<()> {
        if let Some(_network) = &self.network {
            // p2panda-net doesn't provide a direct way to unsubscribe
            // Instead, we'll just remove it from our tracking
            let mut topics = self.subscribed_topics.lock()
                .map_err(|_| P2PError::NetworkError("Failed to lock subscribed topics".to_string()))?;
            
            topics.retain(|t| t != topic);
            Ok(())
        } else {
            Err(P2PError::NetworkError("Network not initialized".to_string()))
        }
    }

    /// Connect to a peer
    pub async fn connect_to_peer(&self, peer_id: &str) -> P2PResult<()> {
        // p2panda-net automatically manages connections to peers
        // This is kept for API compatibility
        if self.network.is_some() {
            // Track the connection in our state
            let mut connections = self.connections.lock()
                .map_err(|_| P2PError::NetworkError("Failed to lock connections".to_string()))?;
            
            connections.insert(
                peer_id.to_string(),
                PeerConnection {
                    peer_id: peer_id.to_string(),
                    topics: Vec::new(),
                    last_seen: std::time::Instant::now(),
                    is_active: true,
                },
            );
            
            Ok(())
        } else {
            Err(P2PError::NetworkError("Network not initialized".to_string()))
        }
    }

    /// Disconnect from a peer
    pub async fn disconnect_from_peer(&self, peer_id: &str) -> P2PResult<()> {
        // p2panda-net manages connections automatically
        // This is kept for API compatibility
        if self.network.is_some() {
            // Update connection tracking
            let mut connections = self.connections.lock()
                .map_err(|_| P2PError::NetworkError("Failed to lock connections".to_string()))?;
            
            if let Some(conn) = connections.get_mut(peer_id) {
                conn.is_active = false;
            }
            
            Ok(())
        } else {
            Err(P2PError::NetworkError("Network not initialized".to_string()))
        }
    }

    /// Send a message on a topic
    pub async fn send_message(&self, topic: &Topic, message: &[u8]) -> P2PResult<()> {
        if let Some(network) = &self.network {
            // Get the topic stream
            let (tx, _rx, _ready) = network.subscribe(topic.clone())
                .await
                .map_err(|e| P2PError::NetworkError(format!("Failed to get topic stream: {}", e)))?;
            
            // Send the message wrapped in ToNetwork::Message
            tx.send(ToNetwork::Message { bytes: message.to_vec() })
                .await
                .map_err(|e| P2PError::NetworkError(format!("Failed to send message: {}", e)))?;
                
            Ok(())
        } else {
            Err(P2PError::NetworkError("Network not initialized".to_string()))
        }
    }

    /// Process P2P events
    pub async fn process_events(&self) -> P2PResult<()> {
        if let Some(network) = &self.network {
            // Get network events
            let mut events = network.events()
                .await
                .map_err(|e| P2PError::NetworkError(format!("Failed to get network events: {}", e)))?;
            
            // Process events differently - broadcast receivers don't have try_next
            // We'll use a non-blocking receive with a timeout
            let event_future = events.recv().fuse();
            let timeout = time::sleep(Duration::from_millis(10)).fuse();
            
            tokio::select! {
                event = event_future => {
                    if let Ok(event) = event {
                        println!("Network event: {:?}", event);
                    }
                }
                _ = timeout => {
                    // Timeout, no events available
                }
            }
            
            Ok(())
        } else {
            Err(P2PError::NetworkError("Network not initialized".to_string()))
        }
    }

    /// Create a direct message topic
    pub fn create_direct_message_topic(&self, recipient_id: &str) -> Topic {
        let topic_name = format!("garden/dm/{}", recipient_id);
        Topic::new(&topic_name)
    }

    /// Create a group message topic
    pub fn create_group_message_topic(&self, group_id: &str) -> Topic {
        let topic_name = format!("garden/group/{}", group_id);
        Topic::new(&topic_name)
    }

    /// Register a new subspace
    pub fn register_subspace(&self, name: &str, subspace: SubspaceId) -> P2PResult<()> {
        let mut subspaces = self.user_subspaces.lock()
            .map_err(|_| P2PError::StorageError("Failed to lock subspaces".to_string()))?;
        
        subspaces.insert(name.to_string(), subspace);
        Ok(())
    }

    /// Get a subspace by name
    pub fn get_subspace(&self, name: &str) -> P2PResult<Option<SubspaceId>> {
        let subspaces = self.user_subspaces.lock()
            .map_err(|_| P2PError::StorageError("Failed to lock subspaces".to_string()))?;
        
        Ok(subspaces.get(name).cloned())
    }

    /// Clean up resources
    pub async fn shutdown(&self) -> P2PResult<()> {
        // p2panda-net doesn't provide explicit shutdown methods
        // We'll just set all connections to inactive
        let mut connections = self.connections.lock()
            .map_err(|_| P2PError::NetworkError("Failed to lock connections".to_string()))?;
        
        for (_, conn) in connections.iter_mut() {
            conn.is_active = false;
        }

        Ok(())
    }

    /// Initialize group encryption - placeholder until actual API is known
    pub async fn initialize_group_encryption(&self) -> P2PResult<()> {
        // No special initialization needed with our mock implementation
        Ok(())
    }

    /// Create an encrypted group - using mock implementation
    pub async fn create_encrypted_group(&self, group_id: &str) -> P2PResult<Vec<u8>> {
        // Create a mock group
        let group = MockGroup {
            id: group_id.to_string(),
            members: vec![format!("creator-{}", self.private_key.clone())],
        };
        
        // Store the group
        let mut groups = self.groups.lock()
            .map_err(|_| P2PError::StorageError("Failed to lock groups".to_string()))?;
        groups.insert(group_id.to_string(), group.clone());
        
        // Create a session for this group
        let session = MockGroupSession {
            group_id: group_id.to_string(),
        };
        
        // Store the session
        let mut sessions = self.group_sessions.lock()
            .map_err(|_| P2PError::StorageError("Failed to lock group sessions".to_string()))?;
        sessions.insert(group_id.to_string(), session);
        
        // Return a mock key package (serialized group ID for now)
        Ok(group_id.as_bytes().to_vec())
    }

    /// Join an encrypted group - using mock implementation
    pub async fn join_encrypted_group(&self, group_id: &str, key_package: Vec<u8>) -> P2PResult<()> {
        // Verify the key package (should contain the group ID)
        let pkg_group_id = String::from_utf8(key_package.clone())
            .map_err(|_| P2PError::GroupError("Invalid key package".to_string()))?;
        
        if pkg_group_id != group_id {
            return Err(P2PError::GroupError("Key package doesn't match group ID".to_string()));
        }
        
        // Create a mock group for this member
        let group = MockGroup {
            id: group_id.to_string(),
            members: vec![format!("member-{}", self.private_key.clone())],
        };
        
        // Store the group
        let mut groups = self.groups.lock()
            .map_err(|_| P2PError::StorageError("Failed to lock groups".to_string()))?;
        groups.insert(group_id.to_string(), group);
        
        // Create a session for this group
        let session = MockGroupSession {
            group_id: group_id.to_string(),
        };
        
        // Store the session
        let mut sessions = self.group_sessions.lock()
            .map_err(|_| P2PError::StorageError("Failed to lock group sessions".to_string()))?;
        sessions.insert(group_id.to_string(), session);
        
        Ok(())
    }

    /// Send an encrypted group message - using mock implementation
    pub async fn send_encrypted_group_message(&self, group_id: &str, content: &[u8]) -> P2PResult<()> {
        // Get the group session
        let sessions = self.group_sessions.lock()
            .map_err(|_| P2PError::StorageError("Failed to lock group sessions".to_string()))?;
        
        // Just check if the session exists
        if !sessions.contains_key(group_id) {
            return Err(P2PError::GroupError("Group session not found".to_string()));
        }
        
        // Mock encryption - prepend "ENCRYPTED:" to the message
        let mut encrypted = b"ENCRYPTED:".to_vec();
        encrypted.extend_from_slice(content);
        
        // Send the encrypted message to the group topic
        let topic = self.create_group_message_topic(group_id);
        self.send_message(&topic, &encrypted).await?;
        
        Ok(())
    }

    /// Receive and decrypt a group message - using mock implementation
    pub async fn receive_encrypted_group_message(&self, group_id: &str, encrypted: &[u8]) -> P2PResult<Vec<u8>> {
        // Get the group session
        let sessions = self.group_sessions.lock()
            .map_err(|_| P2PError::StorageError("Failed to lock group sessions".to_string()))?;
        
        // Just check if the session exists
        if !sessions.contains_key(group_id) {
            return Err(P2PError::GroupError("Group session not found".to_string()));
        }
        
        // Mock decryption - remove "ENCRYPTED:" prefix
        if encrypted.len() < 10 || &encrypted[0..10] != b"ENCRYPTED:" {
            return Err(P2PError::GroupError("Invalid encrypted message format".to_string()));
        }
        
        Ok(encrypted[10..].to_vec())
    }
}

// Helper function to create a garden client with a new keypair
pub async fn create_garden_client(config: GardenConfig) -> P2PResult<GardenClient> {
    // Generate a new private key for this client
    let private_key = PrivateKey::new();
    
    // Create and initialize the client
    let mut client = GardenClient::new(config, private_key).await?;
    client.initialize().await?;
    
    Ok(client)
}

// Helper function to create standard garden topics for a user
pub fn create_user_topics(user_id: &str) -> Vec<Topic> {
    vec![
        // Personal inbox topic
        Topic::new(&format!("users/{}/inbox", user_id)),
        Topic::new(&format!("users/{}/presence", user_id)),
        Topic::new(&format!("users/{}/profile", user_id)),
        Topic::new(&format!("users/{}/apps", user_id)),
        Topic::new(&format!("users/{}/topics", user_id)),
        Topic::new(&format!("users/{}/gardens", user_id)),
    ]
}

// Helper function to create garden topics
pub fn create_garden_topics(garden_id: &str) -> Vec<Topic> {
    vec![
        Topic::new(&format!("garden/{}/messages", garden_id)),
        Topic::new(&format!("garden/{}/presence", garden_id)),
        Topic::new(&format!("garden/{}/files", garden_id)),
        Topic::new(&format!("garden/{}/members", garden_id)),
        Topic::new(&format!("garden/{}/commands", garden_id)),
        Topic::new(&format!("garden/{}/topics", garden_id)),
    ]
}

// Tests module
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_garden_config_default() {
        let config = GardenConfig::default();
        
        assert_eq!(config.discovery_timeout, Duration::from_secs(30));
        assert_eq!(config.connection_timeout, Duration::from_secs(10));
        assert_eq!(config.max_connections, 50);
        assert!(config.user_identity.is_none());
        assert!(config.device.is_none());
        assert!(config.namespaces.is_empty());
        assert_eq!(config.data_directory, "./garden-data");
    }

    #[test]
    fn test_create_user_topics() {
        let user_id = "test-user-123";
        let topics = create_user_topics(user_id);
        
        assert_eq!(topics.len(), 6);
        
        // Check topic names
        assert_eq!(topics[0].name(), "users/test-user-123/inbox");
        assert_eq!(topics[1].name(), "users/test-user-123/presence");
        assert_eq!(topics[2].name(), "users/test-user-123/profile");
        assert_eq!(topics[3].name(), "users/test-user-123/apps");
        assert_eq!(topics[4].name(), "users/test-user-123/topics");
        assert_eq!(topics[5].name(), "users/test-user-123/gardens");
    }

    #[test]
    fn test_message_topic_creation() {
        // Create client with minimum configuration
        let private_key = PrivateKey::new();
        let config = GardenConfig::default();
        
        // We're not initializing the client, just testing the topic creation methods
        let client = GardenClient {
            network: None,
            private_key,
            config,
            connections: Arc::new(Mutex::new(HashMap::new())),
            subscribed_topics: Arc::new(Mutex::new(Vec::new())),
            user_subspaces: Arc::new(Mutex::new(HashMap::new())),
            groups: Arc::new(Mutex::new(HashMap::new())),
            group_sessions: Arc::new(Mutex::new(HashMap::new())),
        };
        
        // Test direct message topic creation
        let dm_topic = client.create_direct_message_topic("user123");
        assert_eq!(dm_topic.name(), "garden/dm/user123");
        
        // Test group message topic creation
        let group_topic = client.create_group_message_topic("group456");
        assert_eq!(group_topic.name(), "garden/group/group456");
    }

    #[test]
    fn test_subspace_registration() {
        // Create client with minimum configuration
        let private_key = PrivateKey::new();
        let config = GardenConfig::default();
        
        let client = GardenClient {
            network: None,
            private_key,
            config,
            connections: Arc::new(Mutex::new(HashMap::new())),
            subscribed_topics: Arc::new(Mutex::new(Vec::new())),
            user_subspaces: Arc::new(Mutex::new(HashMap::new())),
            groups: Arc::new(Mutex::new(HashMap::new())),
            group_sessions: Arc::new(Mutex::new(HashMap::new())),
        };
        
        // Register a test subspace
        let subspace = SubspaceId("test-subspace".to_string());
        client.register_subspace("personal", subspace.clone()).unwrap();
        
        // Verify we can retrieve it
        let retrieved = client.get_subspace("personal").unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().0, "test-subspace");
        
        // Verify non-existent subspace returns None
        let non_existent = client.get_subspace("non-existent").unwrap();
        assert!(non_existent.is_none());
    }

    #[test]
    fn test_p2p_error_display() {
        // Test error display formatting
        let init_error = P2PError::InitializationError("Failed to initialize".to_string());
        assert_eq!(init_error.to_string(), "Failed to initialize P2P network: Failed to initialize");
        
        let discovery_error = P2PError::DiscoveryError("Peer not found".to_string());
        assert_eq!(discovery_error.to_string(), "Peer discovery error: Peer not found");
        
        let network_error = P2PError::NetworkError("Connection failed".to_string());
        assert_eq!(network_error.to_string(), "Network connection error: Connection failed");
    }

    // Group messaging tests with mock implementations
    #[tokio::test]
    async fn test_group_encryption() {
        // Create test identity
        let (identity, _) = Identity::generate_identity();
        
        // Set up client
        let mut config = GardenConfig::default();
        config.user_identity = Some(identity.clone());
        
        // Create and initialize client
        let client = create_garden_client(config).await.unwrap();
        client.initialize_group_encryption().await.unwrap();
        
        // Create a test group
        let group_id = "test-encrypted-group";
        let key_package = client.create_encrypted_group(group_id).await.unwrap();
        
        // Test group creation
        assert_eq!(String::from_utf8(key_package.clone()).unwrap(), group_id);
        
        // Test message encryption
        let test_message = b"Test encrypted message";
        client.send_encrypted_group_message(group_id, test_message).await.unwrap();
        
        // Test message decryption with a mock encrypted message
        let mock_encrypted = {
            let mut data = b"ENCRYPTED:".to_vec();
            data.extend_from_slice(test_message);
            data
        };
        
        let decrypted = client.receive_encrypted_group_message(group_id, &mock_encrypted).await.unwrap();
        assert_eq!(decrypted, test_message);
    }
}
