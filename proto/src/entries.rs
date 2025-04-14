use serde::{Serialize, Deserialize};
use crate::types::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GardenEntry {
    DirectMessage {
        sender_id: String,
        recipient_id: String,
        thread_id: String,
        subspace_id: SubspaceId,
        encrypted_content: Vec<u8>,
        timestamp: Timestamp,
        message_type: MessageType,
        attachments: Vec<AttachmentRef>,
    },
    GroupMessage {
        group_id: String,
        sender_id: String,
        subspace_id: SubspaceId,
        encrypted_content: Vec<u8>,
        timestamp: Timestamp,
        message_type: MessageType,
        attachments: Vec<AttachmentRef>,
    },
    FriendRequest {
        from: String,
        to: String,
        subspace_id: SubspaceId,
        status: RequestStatus,
        timestamp: Timestamp,
    },
    BlockedUser {
        user_id: Vec<u8>,
        blocked_user: Vec<u8>,
        subspace_id: SubspaceId,
        timestamp: Timestamp,
    },
    MutedUser {
        user_id: Vec<u8>,
        muted_user: Vec<u8>,
        subspace_id: SubspaceId,
        timestamp: Timestamp,
    },
    Profile {
        user_id: String,
        subspace_id: SubspaceId,
        field_type: ProfileField,
        content: Vec<u8>,
        timestamp: Timestamp,
    },
    SlashCommand {
        command: String,
        description: Option<String>,
        handler_url: String,
        visibility: String,
        creator_id: String,
        group_id: Option<String>,
        timestamp: Timestamp,
        bot_token: Option<String>,
    },
    DeviceKey {
        user_id: String,
        device_id: String,
        key_type: KeyType,
        public_key: Vec<u8>,
        signature: Vec<u8>,
        timestamp: Timestamp,
    },
    GroupMeta {
        group_id: String,
        subspace_id: SubspaceId,
        encrypted_meta: Vec<u8>,
        timestamp: Timestamp,
    },
    GroupMember {
        group_id: String,
        user_id: String,
        role: GroupRole,
        encrypted_key: Vec<u8>,
        timestamp: Timestamp,
    },
}