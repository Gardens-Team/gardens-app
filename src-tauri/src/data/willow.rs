use std::path::PathBuf;
use std::sync::Arc;

use sled::Db;
use willow::{
    store::sled::SimpleStoreSled,
    identity::keypair::{KeyIdentity, KeyPair},
    path::{NamespaceId, Path, SubspaceId},
    parameters::Parameters,
    store::Store,
    error::Error as WillowError,
};

/// Error types for the Garden Willow operations
#[derive(Debug, thiserror::Error)]
pub enum GardenWillowError {
    #[error("Database error: {0}")]
    Database(#[from] sled::Error),
    
    #[error("Willow error: {0}")]
    Willow(#[from] WillowError),
    
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Invalid key: {0}")]
    InvalidKey(String),
}

/// The main Willow store manager for Gardens
pub struct GardenWillowStore {
    /// The underlying Willow Store implementation
    store: Arc<SimpleStoreSled>,
    /// The default identity for this node
    identity: Arc<KeyIdentity>,
    /// Database path
    db_path: PathBuf,
}

impl GardenWillowStore {
    /// Create a new Willow store with the specified database path and identity
    pub async fn new(
        db_path: PathBuf,
        identity_keypair: Option<KeyPair>,
    ) -> Result<Self, GardenWillowError> {
        // Open the database
        let db = sled::open(&db_path)?;
        
        // Generate or use the provided identity
        let identity = match identity_keypair {
            Some(keypair) => Arc::new(KeyIdentity::from(keypair)),
            None => Arc::new(KeyIdentity::random()),
        };
        
        // Create the Willow store
        let store = Arc::new(SimpleStoreSled::new(db, Parameters::recommended())?);
        
        Ok(Self {
            store,
            identity,
            db_path,
        })
    }
    
    /// Get a reference to the store
    pub fn store(&self) -> Arc<SimpleStoreSled> {
        self.store.clone()
    }
    
    /// Get a reference to the identity
    pub fn identity(&self) -> Arc<KeyIdentity> {
        self.identity.clone()
    }
    
    /// Get the user's subspace ID
    pub fn user_subspace(&self) -> SubspaceId {
        // Generate a stable subspace ID based on the user's identity public key
        SubspaceId::from_bytes(self.identity.public_key().as_bytes())
    }
    
    /// Create a path in the appropriate namespace for messages
    pub fn message_path(&self, recipient_id: &str, thread_id: &str, msg_id: &str) -> Path {
        let ns_id = NamespaceId::from_string("messages");
        Path::from_components(
            ns_id, 
            vec![
                self.identity.to_string().as_str(),
                recipient_id,
                thread_id,
                msg_id,
            ]
        )
    }
    
    /// Create a path for user profiles
    pub fn profile_path(&self, field: &str) -> Path {
        let ns_id = NamespaceId::from_string("profiles");
        Path::from_components(
            ns_id,
            vec![
                self.identity.to_string().as_str(),
                "public",
                field,
            ]
        )
    }
    
    /// Create a path for group/garden data
    pub fn garden_path(&self, garden_id: &str, component: &str) -> Path {
        let ns_id = NamespaceId::from_string("gardens");
        Path::from_components(
            ns_id,
            vec![
                garden_id,
                component,
            ]
        )
    }
    
    /// Close the store and clean up resources
    pub async fn close(self) -> Result<(), GardenWillowError> {
        // Explicitly close sled database
        drop(self.store);
        Ok(())
    }
}

/// Helper function to initialize the Willow store
pub async fn initialize_willow_store(
    app_data_dir: Option<PathBuf>,
) -> Result<Arc<GardenWillowStore>, GardenWillowError> {
    // Define the database path
    let db_path = match app_data_dir {
        Some(dir) => dir.join("gardens_willow.db"),
        None => {
            let mut dir = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".to_string()));
            dir.push(".gardens");
            std::fs::create_dir_all(&dir)?;
            dir.join("gardens_willow.db")
        }
    };
    
    // Create the store
    let store = GardenWillowStore::new(db_path, None).await?;
    
    Ok(Arc::new(store))
}
