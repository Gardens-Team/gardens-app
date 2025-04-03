import { Message, MessageContentType } from '../models/Message';
import { User } from '../models/User';
import { executeSql, executeSqlWrite } from '../utils/database';
import * as Crypto from 'expo-crypto';
import { 
  encryptMessage, 
  decryptMessage, 
  EncryptedMessage,
  getStoredKeyPair
} from '../utils/encryption';
import Constants from 'expo-constants';
import { fetch } from 'expo/fetch';

const WORKER_URL = Constants.expoConfig?.extra?.WORKER_URL || 'https://gardens-api.jdbohrman.workers.dev';

const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Accept-Encoding': 'identity'
};

// Default timeout for fetch requests
const FETCH_TIMEOUT = 8000;

// Helper for fetch with timeout
const fetchWithTimeout = async (
  resource: string,
  options: RequestInit = {},
  timeout = FETCH_TIMEOUT
): Promise<any> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
    body: options.body || undefined
  });
  clearTimeout(id);
  return response;
};

/**
 * Get messages for a direct conversation or garden
 */
export const getMessages = async (
  userId: string, 
  recipientId?: string, 
  gardenId?: string,
  channelId?: string
): Promise<Message[]> => {
  try {
    let query = '';
    let params: any[] = [];
    
    if (recipientId) {
      // Direct conversation query
      query = `
        SELECT * FROM messages 
        WHERE ((sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?))
        AND garden IS NULL
        ORDER BY created_at ASC
      `;
      params = [userId, recipientId, recipientId, userId];
    } else if (gardenId && channelId) {
      // Channel conversation query
      query = `
        SELECT * FROM messages 
        WHERE garden = ? AND channel_id = ?
        ORDER BY created_at ASC
      `;
      params = [gardenId, channelId];
    } else if (gardenId) {
      // Garden-wide conversation query (messages not in any channel)
      query = `
        SELECT * FROM messages 
        WHERE garden = ? AND channel_id IS NULL
        ORDER BY created_at ASC
      `;
      params = [gardenId];
    } else {
      throw new Error('Either recipientId or gardenId must be provided');
    }
    
    const rows = await executeSql<any>(query, params);
    
    // Convert rows to Message objects
    const messages = rows.map((row: any): Message => ({
      id: row.id,
      sender: row.sender,
      recipient: row.recipient || undefined,
      garden: row.garden || undefined,
      channel: row.channel || undefined,
      content: row.content, // Encrypted content, will be decrypted later
      contentType: row.content_type,
      sent: !!row.sent,
      delivered: !!row.delivered,
      read: !!row.read,
      selfDestructEnabled: !!row.self_destruct_enabled,
      selfDestructAt: row.self_destruct_at ? new Date(row.self_destruct_at) : new Date(0),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      replyToId: row.reply_to_id || undefined
    }));
    
    // Mark retrieved messages as delivered if they're sent to the current user
    const undeliveredIds = messages
      .filter(msg => msg.recipient === userId && !msg.delivered)
      .map(msg => msg.id);
    
    if (undeliveredIds.length > 0) {
      await markMessagesAsDelivered(undeliveredIds);
    }
    
    return messages;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
};

/**
 * Send a message (direct or garden)
 */
export const sendMessage = async (
  message: Omit<Message, 'id' | 'createdAt' | 'updatedAt' >
): Promise<Message> => {
  try {
    const now = Date.now();
    const messageId = Crypto.randomUUID();
    
    // Get sender's public key - either from memberships or directly from local storage
    let publicKey: string | null = null;
    let recipientPublicKey: string | null = null;
    
    if (message.garden) {
      // Garden message - get public key from memberships table
      const memberRows = await executeSql<{ public_key: string }>(
        'SELECT public_key FROM memberships WHERE garden_id = ? AND user_id = ?',
        [message.garden, message.sender]
      );
      
      if (!memberRows.length) {
        throw new Error('Sender is not a member of this garden');
      }
      
      publicKey = memberRows[0].public_key;
      recipientPublicKey = publicKey; // For garden messages, we use the sender's public key
    } else if (message.recipient) {
      // Direct message - get recipient's public key from their memberships
      const recipientRows = await executeSql<{ public_key: string }>(
        'SELECT public_key FROM memberships WHERE user_id = ? LIMIT 1',
        [message.recipient]
      );
      
      if (!recipientRows.length) {
        throw new Error('Recipient public key not found');
      }
      
      recipientPublicKey = recipientRows[0].public_key;
      
      // Get sender's public key
      const senderRows = await executeSql<{ public_key: string }>(
        'SELECT public_key FROM memberships WHERE user_id = ? LIMIT 1',
        [message.sender]
      );
      
      if (senderRows.length) {
        publicKey = senderRows[0].public_key;
      } else {
        throw new Error('Sender public key not found');
      }
    } else {
      throw new Error('Message must have either recipient or garden');
    }
    
    if (!publicKey || !recipientPublicKey) {
      throw new Error('Failed to retrieve public keys');
    }
    
    // Encrypt the message content using the recipient's public key
    const encryptedMessage = await encryptMessage(message.content, recipientPublicKey);
    if (!encryptedMessage) {
      throw new Error('Failed to encrypt message content');
    }
    
    // Handle self-destruct settings
    const selfDestructAt = message.selfDestructEnabled && message.selfDestructAt 
      ? message.selfDestructAt.getTime() 
      : null;
    
    // Insert the encrypted message into local database
    await executeSqlWrite(
      `INSERT INTO messages (
        id, sender, recipient, garden, channel_id, content, content_type, 
        sent, public_key, delivered, read, self_destruct_enabled, 
        self_destruct_at, created_at, updated_at, reply_to_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        messageId,
        message.sender,
        message.recipient || null,
        message.garden || null,
        message.channel || null,
        encryptedMessage.encryptedContent,
        message.contentType,
        0, // Not sent yet
        publicKey,
        0, // Not delivered yet
        0, // Not read yet
        message.selfDestructEnabled ? 1 : 0,
        selfDestructAt,
        now,
        now,
        message.replyToId || null
      ]
    );
    
    // Return message with appropriate channel info
    return {
      id: messageId,
      sender: message.sender,
      recipient: message.recipient,
      garden: message.garden,
      channel: message.channel,
      content: message.content, // Return the original content for display
      contentType: message.contentType,
      sent: false,
      delivered: false,
      read: false,
      selfDestructEnabled: message.selfDestructEnabled || false,
      selfDestructAt: message.selfDestructAt || new Date(0),
      createdAt: new Date(now),
      updatedAt: new Date(now),
      replyToId: message.replyToId
    };
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (messageIds: string[]): Promise<boolean> => {
  try {
    if (messageIds.length === 0) return true;
    
    const now = Date.now();
    const placeholders = messageIds.map(() => '?').join(',');
    
    await executeSqlWrite(
      `UPDATE messages SET read = 1, updated_at = ? WHERE id IN (${placeholders})`,
      [now, ...messageIds]
    );

    return true;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return false;
  }
};

/**
 * Delete a message (soft deletion)
 */
export const deleteMessage = async (messageId: string): Promise<boolean> => {
  try {
    await executeSqlWrite(
      `DELETE FROM messages WHERE id = ?`,
      [messageId]
    );
    return true;
  } catch (error) {
    console.error('Error deleting message:', error);
    return false;
  }
};

/**
 * Process self-destructing messages that need to be deleted
 * Call this periodically to clean up expired messages
 */
export const processSelfDestructingMessages = async (): Promise<number> => {
  try {
    const now = Date.now();
    
    // Get messages that need to be deleted
    const messagesToDelete = await executeSql<{ id: string }>(
      `SELECT id FROM messages 
       WHERE self_destruct_enabled = 1 
       AND self_destruct_at <= ?`,
      [now]
    );
    
    const messageIds = messagesToDelete.map(msg => msg.id);
    
    if (messageIds.length === 0) {
      return 0;
    }
    
    // Mark them as deleted
    const placeholders = messageIds.map(() => '?').join(',');
    await executeSqlWrite(
      `DELETE FROM messages WHERE id IN (${placeholders})`,
      [...messageIds]
    );
    
    return messageIds.length;
  } catch (error) {
    console.error('Error processing self-destructing messages:', error);
    return 0;
  }
};

/**
 * Get messages with decryption
 */
export const getDecryptedMessages = async (userId: string, recipientId?: string, gardenId?: string): Promise<Message[]> => {
  try {
    const messages = await getMessages(userId, recipientId, gardenId);
    
    // Process each message for decryption
    const decryptedMessages = await Promise.all(
      messages.map(async (message) => {
        try {
          // Create an EncryptedMessage object for the decryption utility
          const encryptedMessage: EncryptedMessage = {
            id: message.id,
            senderPublicKey: message.sender,
            encryptedContent: message.content,
            timestamp: message.createdAt.getTime()
          };
          
          // Decrypt the message content
          const decryptedContent = await decryptMessage(encryptedMessage);
          
          // If decryption succeeded, return message with decrypted content
          if (decryptedContent) {
            return {
              ...message,
              content: decryptedContent
            };
          }
          
          // If decryption failed, return the original message
          console.warn(`Could not decrypt message ${message.id}`);
          return message;
        } catch (error) {
          console.error(`Error decrypting message ${message.id}:`, error);
          return message;
        }
      })
    );
    
    return decryptedMessages;
  } catch (error) {
    console.error('Error getting decrypted messages:', error);
    throw error;
  }
};

/**
 * Get chats for the current user
 */
export const getUserChats = async (userId: string): Promise<{
  chatId: string;
  recipient: User;
  lastMessage: Message | null;
  unreadCount: number;
}[]> => {
  try {
    // Get a list of unique users this user has exchanged messages with
    const chatPartnerRows = await executeSql<{other_user: string}>(
      `SELECT DISTINCT 
        CASE 
          WHEN sender = ? THEN recipient
          ELSE sender
        END as other_user
      FROM messages
      WHERE (sender = ? OR recipient = ?) 
        AND recipient IS NOT NULL 
        AND garden IS NULL`,
      [userId, userId, userId]
    );
    
    // For each chat partner, get the chat details
    const chats = await Promise.all(chatPartnerRows.map(async (row) => {
      const otherUserId = row.other_user;
      
      // Skip null values that might occur
      if (!otherUserId) return null;
      
      // Generate a consistent chat ID
      const participants = [userId, otherUserId].sort();
      const chatId = `${participants[0]}_${participants[1]}`;
      
      // Get recipient user info
      const userRows = await executeSql<any>(
        `SELECT * FROM users WHERE id = ?`,
        [otherUserId]
      );
      
      let recipient: User = {
        id: otherUserId,
        username: 'Unknown User',
        visible: true,
        publicKey: ''
      };
      
      if (userRows.length > 0) {
        const user = userRows[0];
        recipient = {
          id: user.id as string,
          username: user.username as string,
          profilePic: user.profile_pic as string || undefined,
          publicKey: user.public_key as string,
          visible: !!user.visible,
          createdAt: new Date(user.created_at as number),
          updatedAt: new Date(user.updated_at as number)
        };
      }
      
      // Get the last message
      const lastMessageRows = await executeSql<any>(
        `SELECT * FROM messages 
          WHERE ((sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?))
          ORDER BY created_at DESC LIMIT 1`,
        [userId, otherUserId, otherUserId, userId]
      );
      
      let lastMessage: Message | null = null;
      if (lastMessageRows.length > 0) {
        const msg = lastMessageRows[0];
        lastMessage = {
          id: msg.id as string,
          sender: msg.sender as string,
          recipient: msg.recipient as string || undefined,
          garden: msg.garden as string || undefined,
          content: msg.content as string,
          contentType: msg.content_type as MessageContentType,
          sent: !!msg.sent,
          delivered: !!msg.delivered,
          selfDestructEnabled: !!msg.self_destruct_enabled,
          selfDestructAt: msg.self_destruct_at ? new Date(msg.self_destruct_at as number) : new Date(0),
          read: !!msg.read,
          createdAt: new Date(msg.created_at as number),
          updatedAt: new Date(msg.updated_at as number),
          replyToId: msg.reply_to_id as string || undefined
        };
      }
      
      // Count unread messages
      const unreadCountResult = await executeSql<{count: number}>(
        `SELECT COUNT(*) as count FROM messages 
          WHERE recipient = ? AND sender = ? AND read = 0`,
        [userId, otherUserId]
      );
      
      const unreadCount = unreadCountResult[0]?.count || 0;
      
      return {
        chatId,
        recipient,
        lastMessage,
        unreadCount
      };
    }));
    
    // Filter out null entries and sort by last message time (most recent first)
    return chats.filter(chat => chat !== null).sort((a, b) => {
      const timeA = a?.lastMessage?.createdAt?.getTime() || 0;
      const timeB = b?.lastMessage?.createdAt?.getTime() || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.error('Error fetching user chats:', error);
    throw error;
  }
};

/**
 * Create a new chat with a user (or ensure message records exist)
 * In this schema, a "chat" is just a convention based on message sender/recipient
 */
export const createChat = async (userId: string, recipientId: string): Promise<string> => {
  try {
    // Generate a consistent chat ID regardless of who initiated
    const participants = [userId, recipientId].sort();
    const chatId = `${participants[0]}_${participants[1]}`;
    
    // Since we don't have a chats table, we just need to check if we can 
    // retrieve user info. The actual "chat" will be created when the first
    // message is sent.
    const userRows = await executeSql<any>(
      `SELECT id FROM users WHERE id = ?`,
      [recipientId]
    );
    
    if (userRows.length === 0) {
      throw new Error('Recipient user not found');
    }
    
    return chatId;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
};

/**
 * Mark messages as delivered
 */
export const markMessagesAsDelivered = async (messageIds: string[]): Promise<boolean> => {
  if (messageIds.length === 0) return true;
  
  try {
    const now = Date.now();
    
    // Generate placeholders for SQL query
    const placeholders = messageIds.map(() => '?').join(',');
    
    await executeSqlWrite(
      `UPDATE messages SET delivered = 1, updated_at = ? WHERE id IN (${placeholders})`,
      [now, ...messageIds]
    );
    
    return true;
  } catch (error) {
    console.error('Error marking messages as delivered:', error);
    return false;
  }
};

/**
 * Get all unsent messages
 */
export const getUnsentMessages = async (): Promise<Message[]> => {
  try {
    const rows = await executeSql<any>(
      `SELECT * FROM messages WHERE sent = 0 ORDER BY created_at ASC`
    );
    
    return rows.map((row: any) => ({
      id: row.id as string,
      sender: row.sender as string,
      recipient: row.recipient as string || undefined,
      garden: row.garden as string || undefined,
      content: row.content as string,
      contentType: row.content_type as MessageContentType || 'text',
      encrypted: !!row.encrypted,
      sent: !!row.sent,
      selfDestructEnabled: !!row.self_destruct_enabled,
      selfDestructAt: row.self_destruct_at ? new Date(row.self_destruct_at as number) : new Date(0),
      delivered: !!row.delivered,
      read: !!row.read,
      createdAt: new Date(row.created_at as number),
      updatedAt: new Date(row.updated_at as number),
    }));
  } catch (error) {
    console.error('Error getting unsent messages:', error);
    return [];
  }
};

// Helper to get user's public key from database
async function getUserPublicKey(userId: string): Promise<string | null> {
  const rows = await executeSql<{public_key: string}>(
    `SELECT public_key FROM users WHERE id = ?`,
    [userId]
  );
  
  return rows.length > 0 ? rows[0].public_key : null;
}

// Add this helper function
function calculateSelfDestructTimestamp(now: number, duration: '5m' | '30m' | '1h' | '1d' | '1w'): number {
  const durations = {
    '5m': 5 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000
  };
  return now + durations[duration];
}

/**
 * Get messages for a garden from the server API
 */
export const getGardenMessages = async (
  gardenId: string,
  channelId?: string
): Promise<Message[]> => {
  try {
    // Build the URL with optional channelId parameter
    let url = `${WORKER_URL}/api/gardens/${gardenId}/messages`;
    if (channelId) {
      url += `?channelId=${encodeURIComponent(channelId)}`;
    }
    
    // Fetch messages from server
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: DEFAULT_HEADERS
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response error:', errorText);
      return [];
    }
    
    const messagesData = await response.json() as Array<{
      id: string;
      sender: string;
      senderUsername?: string;
      garden?: string;
      channelId?: string;
      publicKey?: string;
      content: string;
      contentType: string;
      createdAt: number;
      replyToId?: string;
    }>;
    
    // Get user's keypair for decryption
    const userKeypair = await getStoredKeyPair();
    if (!userKeypair) {
      console.error('No encryption keys available');
      return [];
    }
    
    // Process and decrypt each message
    const processedMessages = await Promise.all(
      messagesData.map(async (msg) => {
        let decryptedContent = msg.content;
        
        // Try to decrypt if we have the sender's public key
        if (msg.publicKey) {
          try {
            // For decryption, we need to reconstruct the encrypted message format
            const encryptedMsg: EncryptedMessage = {
              id: msg.id,
              senderPublicKey: msg.publicKey,
              encryptedContent: msg.content,
              timestamp: msg.createdAt
            };
            
            const decrypted = await decryptMessage(encryptedMsg);
            if (decrypted) {
              decryptedContent = decrypted;
            }
          } catch (error) {
            console.warn(`Could not decrypt message ${msg.id}:`, error);
            // Use the encrypted content as fallback
          }
        }
        
        // Convert to Message object with decrypted content
        return {
          id: msg.id,
          sender: msg.sender,
          senderUsername: msg.senderUsername,
          garden: msg.garden,
          channel: msg.channelId,
          content: decryptedContent,
          contentType: msg.contentType as MessageContentType,
          // Set default values for required Message fields
          sent: true,
          delivered: true,
          read: false,
          selfDestructEnabled: false,
          selfDestructAt: new Date(0),
          createdAt: new Date(msg.createdAt),
          updatedAt: new Date(),
          replyToId: msg.replyToId
        };
      })
    );
    
    return processedMessages;
    
  } catch (error) {
    console.error('Error fetching garden messages from API:', error);
    return [];
  }
};

/**
 * Send a message to a garden/channel via the server API
 */
export const sendGardenMessage = async (
  gardenId: string,
  message: {
    sender: string;
    content: string;
    contentType: MessageContentType;
    channelId?: string;
    replyToId?: string;
    selfDestructEnabled?: boolean;
    selfDestructAt?: Date;
    publicKey?: string;
  }
): Promise<Message | null> => {
  try {
    const url = `${WORKER_URL}/api/gardens/${gardenId}/messages`;
    
    // Get user's public key for encryption
    const keyPair = await getStoredKeyPair();
    if (!keyPair) {
      throw new Error('No encryption keys available. Please set up encryption first.');
    }
    
    // For garden messages, we'll encrypt with the sender's own public key
    // This allows all garden members to decrypt with the sender's public key
    const encryptedMessage = await encryptMessage(message.content, keyPair.publicKey);
    if (!encryptedMessage) {
      throw new Error('Failed to encrypt message');
    }
    
    // Prepare payload with encrypted content
    const payload = {
      sender: message.sender,
      content: encryptedMessage.encryptedContent, // Send the encrypted content
      contentType: message.contentType,
      channelId: message.channelId,
      replyToId: message.replyToId,
      selfDestructEnabled: message.selfDestructEnabled || false,
      selfDestructAt: message.selfDestructAt?.getTime(),
      publicKey: keyPair.publicKey // Include sender's public key for decryption
    };
    
    // Send message to server
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error sending garden message:', errorText);
      return null;
    }
    
    const msgData = await response.json() as {
      id: string;
      sender: string;
      senderUsername?: string;
      garden?: string;
      channelId?: string;
      publicKey?: string;
      content: string;
      contentType: string;
      createdAt: number;
      replyToId?: string;
    };
    
    // Return a message object with the original unencrypted content for local display
    return {
      id: msgData.id,
      sender: msgData.sender,
      senderUsername: msgData.senderUsername,
      garden: msgData.garden,
      channel: msgData.channelId,
      content: message.content, // Use original content for local display
      contentType: msgData.contentType as MessageContentType,
      // Set default values for required Message fields
      sent: true,
      delivered: true,
      read: false,
      selfDestructEnabled: false,
      selfDestructAt: new Date(0),
      createdAt: new Date(msgData.createdAt),
      updatedAt: new Date(),
      replyToId: msgData.replyToId
    };
    
  } catch (error) {
    console.error('Error sending garden message to API:', error);
    return null;
  }
};

export async function sendDirectMessage(
  senderId: string,
  recipientUsername: string,
  content: string,
  contentType: MessageContentType = MessageContentType.TEXT,
  publicKey?: string,
  selfDestructEnabled: boolean = false,
  selfDestructAt?: number
): Promise<Message> {
  try {
    const response = await fetch(`${WORKER_URL}/api/messages/direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: senderId,
        recipientUsername,
        content,
        contentType,
        publicKey,
        selfDestructEnabled,
        selfDestructAt
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send direct message');
    }

    return response.json();
  } catch (error) {
    console.error('Error sending direct message:', error);
    throw error;
  }
}

export async function getDirectMessages(
  userId: string,
  otherUsername?: string,
  limit: number = 50,
  before?: number
): Promise<Message[]> {
  try {
    let url = `${WORKER_URL}/api/messages/direct/${userId}`;
    if (otherUsername) {
      url += `?with=${otherUsername}`;
    }
    if (limit) {
      url += `${otherUsername ? '&' : '?'}limit=${limit}`;
    }
    if (before) {
      url += `${otherUsername || limit ? '&' : '?'}before=${before}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch direct messages');
    }

    const messages = await response.json();
    return messages.map((msg: any) => ({
      ...msg,
      createdAt: new Date(msg.createdAt),
      updatedAt: new Date(msg.updatedAt),
      selfDestructAt: msg.selfDestructAt ? new Date(msg.selfDestructAt) : undefined
    }));
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    throw error;
  }
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  try {
    const response = await fetch(`${WORKER_URL}/api/messages/${messageId}/read`, {
      method: 'PUT',
    });

    if (!response.ok) {
      throw new Error('Failed to mark message as read');
    }
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw error;
  }
} 