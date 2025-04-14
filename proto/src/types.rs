// garden-core/src/types.rs
use serde::{Serialize, Deserialize};
use std::cmp::{PartialEq, Eq, PartialOrd, Ord};
use std::hash::Hash;

pub type Timestamp = i64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    Text,
    Media,
    Reply { to_message_id: String },
    Edit { original_message_id: String },
    Delete { message_id: String },
    Reaction { message_id: String, reaction: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProfileField {
    DisplayName,
    Avatar,
    Bio,
    PublicKey,
    DeviceList,
    Settings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RequestStatus {
    Pending,
    Accepted,
    Rejected,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KeyType {
    Identity,
    Messaging,
    GroupAccess,
    DeviceAuth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GroupRole {
    Owner,
    Admin,
    Member,
    Invited,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentRef {
    pub hash: String,
    pub encryption_key: Vec<u8>,
    pub metadata: AttachmentMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentMetadata {
    pub name: String,
    pub mime_type: String,
    pub size: u64,
    pub thumbnail: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubspaceId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamespaceId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Path(pub String);
