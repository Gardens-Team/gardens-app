// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{App, AppHandle, Manager, State};
use tauri::async_runtime::spawn;
use std::sync::Arc;
use tokio::sync::Mutex;

// Import our data module
pub mod data;
pub mod p2p;
pub mod crypto;

use crate::data::GardenDataManager;

// Application state
pub struct GardenState {
    data_manager: Arc<Mutex<Option<GardenDataManager>>>,
}

// Initialize application state
fn initialize_state(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    // Get the app data directory
    let app_handle = app.handle();
    let app_dir = app_handle.path().app_data_dir()?;
    
    // Create the app data directory if it doesn't exist
    std::fs::create_dir_all(&app_dir)?;
    
    // Initialize the state
    let state = GardenState {
        data_manager: Arc::new(Mutex::new(None)),
    };
    
    // Register the state
    app.manage(state);
    
    // Start the data manager initialization in a background task
    let app_handle_clone = app_handle.clone();
    spawn(async move {
        match GardenDataManager::initialize(Some(app_dir)).await {
            Ok(manager) => {
                // Store the manager in the state
                let state: State<GardenState> = app_handle_clone.state();
                let mut data_manager = state.data_manager.lock().await;
                *data_manager = Some(manager);
                
                println!("Gardens data manager initialized successfully");
            },
            Err(err) => {
                eprintln!("Failed to initialize Gardens data manager: {:?}", err);
                // TODO: Handle initialization failure
            }
        }
    });
    
    Ok(())
}

// Tauri commands
#[tauri::command]
async fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt::try_init();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(initialize_state)
        .invoke_handler(tauri::generate_handler![greet])
        .build()
        .expect("Error while running tauri application")
        .run(|_app_handle, event| match event {
            tauri::RunEvent::Exit => {
                // Clean up when the application exits
                // This is needed because tauri::async_runtime outlives the App
                // and we need to make sure resources are cleaned up properly
            },
            _ => {}
        });
}
