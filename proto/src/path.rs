// Helpers to construct and validate path structures

pub fn build_path(parts: &[&str]) -> String {
    parts.join("/")
}

// Function to validate paths (e.g., checking if they are well-formed or match a pattern)
pub fn validate_path(path: &str) -> bool {
    // Here we could implement specific validation logic, e.g., checking for reserved characters or format.
    !path.is_empty() && !path.contains("..")  // Simple check, could be expanded further
}

// Example helper to generate a direct message path
pub fn generate_direct_message_path(sender_id: &str, recipient_id: &str, thread_id: &str, msg_id: &str) -> String {
    build_path(&["messages", sender_id, recipient_id, thread_id, msg_id])
}

// Example helper to generate a group message path
pub fn generate_group_message_path(group_id: &str, msg_id: &str) -> String {
    build_path(&["groups", group_id, "messages", msg_id])
}

// Example helper to generate a profile path (public or private)
pub fn generate_profile_path(user_id: &str, field_type: &str, is_public: bool) -> String {
    if is_public {
        build_path(&["profiles", user_id, "public", field_type])
    } else {
        build_path(&["profiles", user_id, "private", field_type])
    }
}

// Example helper to generate device key path
pub fn generate_device_key_path(user_id: &str, device_id: &str, key_type: &str) -> String {
    build_path(&["devices", user_id, device_id, "keys", key_type])
}
