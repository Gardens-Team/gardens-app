pub mod willow;
pub mod schema;
pub mod migrations;

use std::path::PathBuf;
use std::sync::Arc;

use willow;
use serde_json;
use thiserror;

use self::willow::{GardenWillowStore, initialize_willow_store, GardenWillowError};
use self::migrations::{MigrationManager, register_migrations};

/// Core data manager for Gardens
pub struct GardenDataManager {
    /// The Willow store instance
    willow_store: Arc<GardenWillowStore>,
}

impl GardenDataManager {
    /// Initialize the data manager with the given app data directory
    pub async fn initialize(
        app_data_dir: Option<PathBuf>,
    ) -> Result<Self, GardenWillowError> {
        // Initialize the Willow store
        let willow_store = initialize_willow_store(app_data_dir).await?;
        
        // Run migrations
        let mut migration_manager = MigrationManager::new(willow_store.clone());
        register_migrations(&mut migration_manager);
        migration_manager.run_migrations().await?;
        
        Ok(Self {
            willow_store,
        })
    }
    
    /// Get a reference to the Willow store
    pub fn willow_store(&self) -> Arc<GardenWillowStore> {
        self.willow_store.clone()
    }
    
    /// Close the data manager and clean up resources
    pub async fn close(self) -> Result<(), GardenWillowError> {
        Arc::try_unwrap(self.willow_store)
            .map_err(|_| GardenWillowError::Willow(willow::error::Error::Store(
                "Failed to unwrap store Arc".into()
            )))
            .and_then(|store| {
                tokio::spawn(async move {
                    store.close().await
                });
                Ok(())
            })
    }
} 