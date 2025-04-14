use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use willow::entry::{Entry, EntryBuilder};
use willow::path::Path;
use willow::store::Store;

use crate::data::willow::GardenWillowError;

/// Timestamp in milliseconds since UNIX epoch
pub type Timestamp = u64;

/// Get the current timestamp
pub fn current_timestamp() -> Timestamp {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis() as Timestamp
}

/// Message types supported in Gardens
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MessageType {
    Text,
    Media,
    Reply { to_message_id: String },
    Edit { original_message_id: String },
    Delete { message_id: String },
    Reaction { message_id: String, reaction: String },
}

/// Status of friend requests
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RequestStatus {
    Pending,
    Accepted,
    Rejected,
    Cancelled,
}

/// Roles in a garden (group)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GroupRole {
    Owner,
    Admin,
    Member,
    Invited,
}

/// Profile field types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProfileField {
    DisplayName,
    Avatar,
    Bio,
    PublicKey,
    DeviceList,
    Settings,
}

/// Key types used in the application
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum KeyType {
    Identity,
    Messaging,
    GroupAccess,
    DeviceAuth,
}

/// Slash command visibility
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CommandVisibility {
    Public,
    Garden,
    Private,
}

/// Attachment metadata
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AttachmentMetadata {
    pub name: String,
    pub mime_type: String,
    pub size: u64,
    pub thumbnail: Option<Vec<u8>>,
}

/// Reference to an attachment
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AttachmentRef {
    pub hash: String,
    pub encryption_key: Vec<u8>,
    pub metadata: AttachmentMetadata,
}

/// Direct message between users
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectMessage {
    pub sender_id: String,
    pub recipient_id: String,
    pub thread_id: String,
    pub encrypted_content: Vec<u8>,
    pub timestamp: Timestamp,
    pub message_type: MessageType,
    pub attachments: Vec<AttachmentRef>,
}

/// Message in a garden (group)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMessage {
    pub garden_id: String,
    pub sender_id: String,
    pub encrypted_content: Vec<u8>,
    pub timestamp: Timestamp,
    pub message_type: MessageType,
    pub attachments: Vec<AttachmentRef>,
}

/// Friend request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendRequest {
    pub from: String,
    pub to: String,
    pub status: RequestStatus,
    pub timestamp: Timestamp,
}

/// Profile information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub user_id: String,
    pub field_type: ProfileField,
    pub content: Vec<u8>, // Encrypted for private, public for public
    pub timestamp: Timestamp,
}

/// Slash command definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlashCommand {
    pub command: String,
    pub description: Option<String>,
    pub handler_url: String,
    pub visibility: CommandVisibility,
    pub creator_id: String,
    pub garden_id: Option<String>,
    pub timestamp: Timestamp,
    pub bot_token: Option<String>,
}

/// Garden (group) metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GardenMeta {
    pub garden_id: String,
    pub encrypted_meta: Vec<u8>,
    pub timestamp: Timestamp,
    pub topic: String,
}

/// Garden (group) member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GardenMember {
    pub garden_id: String,
    pub user_id: String,
    pub role: GroupRole,
    pub encrypted_key: Vec<u8>,
    pub timestamp: Timestamp,
}

/// Device key information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceKey {
    pub user_id: String,
    pub device_id: String,
    pub key_type: KeyType,
    pub public_key: Vec<u8>,
    pub signature: Vec<u8>,
    pub timestamp: Timestamp,
}

/// Trait for converting schema items to Willow entries
pub trait ToEntry {
    /// Convert to a Willow Entry
    fn to_entry<S: Store>(&self, path: &Path) -> Result<Entry, GardenWillowError>;
}

impl ToEntry for DirectMessage {
    fn to_entry<S: Store>(&self, path: &Path) -> Result<Entry, GardenWillowError> {
        let entry = EntryBuilder::new()
            .with_payload(&serde_json::to_vec(self)?)
            .build();
        
        Ok(entry)
    }
}

impl ToEntry for GroupMessage {
    fn to_entry<S: Store>(&self, path: &Path) -> Result<Entry, GardenWillowError> {
        let entry = EntryBuilder::new()
            .with_payload(&serde_json::to_vec(self)?)
            .build();
        
        Ok(entry)
    }
}

impl ToEntry for FriendRequest {
    fn to_entry<S: Store>(&self, path: &Path) -> Result<Entry, GardenWillowError> {
        let entry = EntryBuilder::new()
            .with_payload(&serde_json::to_vec(self)?)
            .build();
        
        Ok(entry)
    }
}

impl ToEntry for Profile {
    fn to_entry<S: Store>(&self, path: &Path) -> Result<Entry, GardenWillowError> {
        let entry = EntryBuilder::new()
            .with_payload(&serde_json::to_vec(self)?)
            .build();
        
        Ok(entry)
    }
}

impl ToEntry for SlashCommand {
    fn to_entry<S: Store>(&self, path: &Path) -> Result<Entry, GardenWillowError> {
        let entry = EntryBuilder::new()
            .with_payload(&serde_json::to_vec(self)?)
            .build();
        
        Ok(entry)
    }
}

impl ToEntry for GardenMeta {
    fn to_entry<S: Store>(&self, path: &Path) -> Result<Entry, GardenWillowError> {
        let entry = EntryBuilder::new()
            .with_payload(&serde_json::to_vec(self)?)
            .build();
        
        Ok(entry)
    }
}

impl ToEntry for GardenMember {
    fn to_entry<S: Store>(&self, path: &Path) -> Result<Entry, GardenWillowError> {
        let entry = EntryBuilder::new()
            .with_payload(&serde_json::to_vec(self)?)
            .build();
        
        Ok(entry)
    }
}

impl ToEntry for DeviceKey {
    fn to_entry<S: Store>(&self, path: &Path) -> Result<Entry, GardenWillowError> {
        let entry = EntryBuilder::new()
            .with_payload(&serde_json::to_vec(self)?)
            .build();
        
        Ok(entry)
    }
}

/// Helper functions for gardens
pub mod garden {
    /// Generate a standard topic name for a garden
    pub fn garden_topic(garden_id: &str) -> String {
        format!("garden:{}", garden_id)
    }
}
