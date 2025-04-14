// Full integration test combining all components
use std::time::Duration;

use garden_core::{
    auth::AuthToken,
    identity::{Identity, Capability},
    p2p::{GardenConfig, create_garden_client, Topic},
    types::{SubspaceId, Path, MessageType, Timestamp},
    entries::GardenEntry,
};

use p2panda_core::identity::PrivateKey;
use ed25519_dalek::{SigningKey, VerifyingKey};
use chrono::Utc;
use uuid::Uuid;
use tokio::time;

// Helper to create a standard user with identity, token, and P2P client
async fn create_test_user(
    capabilities: Vec<Capability>,
    signing_key: Option<&SigningKey>
) -> (Identity, SigningKey, AuthToken, garden_core::p2p::GardenClient) {
    // Generate identity
    let (identity, signing_key_owned) = Identity::generate_identity();
    let signing_key_ref = signing_key.unwrap_or(&signing_key_owned);
    
    // Create auth token
    let now = Utc::now().timestamp();
    let expires_at = now + 3600;
    
    let mut token = AuthToken {
        user_id: identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities,
        signature: None,
        expires_at,
    };
    
    // Sign token
    token.sign(signing_key_ref);
    
    // Create P2P client
    let config = GardenConfig {
        discovery_timeout: Duration::from_secs(5),
        connection_timeout: Duration::from_secs(5),
        user_identity: Some(identity.clone()),
        ..Default::default()
    };
    
    let client = create_garden_client(config).await.expect("Failed to create client");
    
    (identity, signing_key_owned, token, client)
}

// Full integration test simulating a group chat scenario
#[tokio::test]
async fn test_group_chat_scenario() {
    // 1. Create admin user with full capabilities
    let admin_capabilities = vec![
        Capability::CreateInvites,
        Capability::AdminAccess,
    ];
    
    let (admin_identity, admin_signing_key, admin_token, admin_client) = 
        create_test_user(admin_capabilities, None).await;
    
    // Create a group ID
    let group_id = "garden-test-group";
    
    // Add group management capability for admin
    let mut admin_token = admin_token;
    admin_token.capabilities.push(Capability::ManageGroup(group_id.to_string()));
    admin_token.sign(&admin_signing_key);
    
    // 2. Create member 1 with limited capabilities
    let member1_capabilities = vec![
        Capability::ReadMessages(format!("groups/{}", group_id)),
        Capability::WriteMessages(format!("groups/{}", group_id)),
    ];
    
    let (member1_identity, member1_signing_key, member1_token, member1_client) = 
        create_test_user(member1_capabilities, Some(&admin_signing_key)).await;
    
    // 3. Create member 2 with limited capabilities
    let member2_capabilities = vec![
        Capability::ReadMessages(format!("groups/{}", group_id)),
        Capability::WriteMessages(format!("groups/{}", group_id)),
    ];
    
    let (member2_identity, member2_signing_key, member2_token, member2_client) = 
        create_test_user(member2_capabilities, Some(&admin_signing_key)).await;
    
    // 4. Initialize group encryption for all clients
    admin_client.initialize_group_encryption().await.expect("Failed to initialize admin encryption");
    member1_client.initialize_group_encryption().await.expect("Failed to initialize member1 encryption");
    member2_client.initialize_group_encryption().await.expect("Failed to initialize member2 encryption");
    
    // 5. Admin creates encrypted group
    let key_package = admin_client.create_encrypted_group(group_id).await
        .expect("Failed to create encrypted group");
    
    // 6. Members join the group
    member1_client.join_encrypted_group(group_id, key_package.clone()).await
        .expect("Member 1 failed to join group");
    
    member2_client.join_encrypted_group(group_id, key_package.clone()).await
        .expect("Member 2 failed to join group");
    
    // 7. Set up subscriptions to group topic for all users
    let group_topic = Topic::new(&format!("garden/group/{}", group_id));
    
    admin_client.subscribe(group_topic.clone()).await.expect("Admin failed to subscribe");
    member1_client.subscribe(group_topic.clone()).await.expect("Member 1 failed to subscribe");
    member2_client.subscribe(group_topic.clone()).await.expect("Member 2 failed to subscribe");
    
    // 8. Create test subspace
    let subspace_id = SubspaceId("test-integration-subspace".to_string());
    admin_client.register_subspace("group-data", subspace_id.clone())
        .expect("Failed to register subspace");
    
    // 9. Create an entry for a group message from member 1
    let now = Utc::now().timestamp();
    
    let member1_message = GardenEntry::GroupMessage {
        group_id: group_id.to_string(),
        sender_id: member1_identity.user_id.clone(),
        subspace_id: subspace_id.clone(),
        encrypted_content: b"Hello from Member 1!".to_vec(),
        timestamp: now,
        message_type: MessageType::Text,
        attachments: vec![],
    };
    
    // 10. Verify that member 1's token authorizes them to create this message
    assert!(member1_token.has_capability(&Capability::WriteMessages(format!("groups/{}", group_id))));
    
    // 11. Send an encrypted message from member 1
    let message1_content = b"Hello from Member 1!";
    member1_client.send_encrypted_group_message(group_id, message1_content).await
        .expect("Member 1 failed to send message");
    
    // 12. Send an encrypted message from member 2
    let message2_content = b"Hello from Member 2!";
    member2_client.send_encrypted_group_message(group_id, message2_content).await
        .expect("Member 2 failed to send message");
    
    // 13. Admin updates group metadata
    let meta_path = garden_core::path::build_path(&["groups", group_id, "metadata"]);
    
    // Verify admin has the capability to manage the group
    assert!(admin_token.has_capability(&Capability::ManageGroup(group_id.to_string())));
    
    // Create group metadata entry
    let group_meta = GardenEntry::GroupMeta {
        group_id: group_id.to_string(),
        subspace_id: subspace_id.clone(),
        encrypted_meta: b"{\"name\":\"Test Group\",\"description\":\"A group for integration testing\"}".to_vec(),
        timestamp: now,
    };
    
    // Create a direct message between admin and member1
    let dm_topic = admin_client.create_direct_message_topic(&member1_identity.user_id);
    
    admin_client.subscribe(dm_topic.clone()).await.expect("Admin failed to subscribe to DM");
    member1_client.subscribe(dm_topic.clone()).await.expect("Member 1 failed to subscribe to DM");
    
    // Send direct message
    let dm_content = b"Private message from admin to member 1";
    admin_client.send_message(&dm_topic, dm_content).await
        .expect("Admin failed to send direct message");
    
    // Clean up
    admin_client.shutdown().await.expect("Failed to shut down admin client");
    member1_client.shutdown().await.expect("Failed to shut down member1 client");
    member2_client.shutdown().await.expect("Failed to shut down member2 client");
}

// Test token delegation and capability inheritance
#[tokio::test]
async fn test_token_delegation() {
    // 1. Create a root admin user
    let root_capabilities = vec![
        Capability::AdminAccess,
        Capability::CreateInvites,
    ];
    
    let (root_identity, root_signing_key, root_token, mut root_client) = 
        create_test_user(root_capabilities, None).await;
    
    // 2. Create an intermediate admin with delegated capabilities
    let intermediate_capabilities = vec![
        Capability::CreateInvites,
        // Limited admin access
        Capability::ManageGroup("*".to_string()),
    ];
    
    let (intermediate_identity, intermediate_signing_key, intermediate_token, mut intermediate_client) = 
        create_test_user(intermediate_capabilities, Some(&root_signing_key)).await;
    
    // 3. Create an end user with capabilities delegated by intermediate admin
    let group_id = "delegated-group";
    let end_user_capabilities = vec![
        Capability::ReadMessages(format!("groups/{}", group_id)),
        Capability::WriteMessages(format!("groups/{}", group_id)),
    ];
    
    let (end_user_identity, end_user_signing_key, end_user_token, mut end_user_client) = 
        create_test_user(end_user_capabilities, Some(&intermediate_signing_key)).await;
    
    // Initialize all clients
    root_client.initialize().await.expect("Failed to initialize root client");
    intermediate_client.initialize().await.expect("Failed to initialize intermediate client");
    end_user_client.initialize().await.expect("Failed to initialize end user client");
    
    // Verify token chain and capabilities
    
    // Root can do everything
    assert!(root_token.has_capability(&Capability::AdminAccess));
    
    // Intermediate can create invites and manage any group
    assert!(intermediate_token.has_capability(&Capability::CreateInvites));
    assert!(intermediate_token.has_capability(&Capability::ManageGroup("any-group".to_string())));
    
    // Intermediate cannot perform general admin functions
    assert!(!intermediate_token.has_capability(&Capability::AdminAccess));
    
    // End user can only read/write in the specific group
    assert!(end_user_token.has_capability(&Capability::ReadMessages(format!("groups/{}", group_id))));
    assert!(end_user_token.has_capability(&Capability::WriteMessages(format!("groups/{}", group_id))));
    
    // End user cannot create invites or manage groups
    assert!(!end_user_token.has_capability(&Capability::CreateInvites));
    assert!(!end_user_token.has_capability(&Capability::ManageGroup(group_id.to_string())));
    
    // Clean up
    root_client.shutdown().await.expect("Failed to shut down root client");
    intermediate_client.shutdown().await.expect("Failed to shut down intermediate client");
    end_user_client.shutdown().await.expect("Failed to shut down end user client");
}

// Test real-world auth flows with token expiry and refresh
#[tokio::test]
async fn test_token_lifecycle() {
    // 1. Create a user with a short-lived token
    let (identity, signing_key, _) = {
        // Generate identity
        let (identity, signing_key) = Identity::generate_identity();
        
        // Create capabilities
        let capabilities = vec![
            Capability::ReadMessages("inbox".to_string()),
            Capability::WriteMessages("inbox".to_string()),
        ];
        
        // Create short-lived token (5 seconds)
        let now = Utc::now().timestamp();
        let expires_at = now + 5; // 5 seconds
        
        let mut token = AuthToken {
            user_id: identity.user_id.clone(),
            device_id: Uuid::new_v4().to_string(),
            capabilities,
            signature: None,
            expires_at,
        };
        
        // Sign token
        token.sign(&signing_key);
        
        (identity, signing_key, token)
    };
    
    // 2. Create P2P client
    let config = GardenConfig {
        user_identity: Some(identity.clone()),
        ..Default::default()
    };
    
    let client = create_garden_client(config).await.expect("Failed to create client");
    
    // 3. Create a topic and subscribe
    let topic = Topic::new("garden/test/auth_refresh");
    client.subscribe(topic.clone()).await.expect("Failed to subscribe");
    
    // 4. Generate a new token with longer expiry
    let now = Utc::now().timestamp();
    let expires_at = now + 3600; // 1 hour
    
    let mut refreshed_token = AuthToken {
        user_id: identity.user_id.clone(),
        device_id: Uuid::new_v4().to_string(),
        capabilities: vec![
            Capability::ReadMessages("inbox".to_string()),
            Capability::WriteMessages("inbox".to_string()),
            // Additional capability
            Capability::CreateInvites,
        ],
        signature: None,
        expires_at,
    };
    
    // Sign refreshed token
    refreshed_token.sign(&signing_key);
    
    // 5. Wait for the original token to expire
    time::sleep(Duration::from_secs(6)).await;
    
    // 6. Verify the refreshed token is valid
    assert!(refreshed_token.is_valid(Utc::now().timestamp()));
    
    // 7. Verify the new capability was added
    assert!(refreshed_token.has_capability(&Capability::CreateInvites));
    
    // 8. Clean up
    client.shutdown().await.expect("Failed to shut down client");
} 