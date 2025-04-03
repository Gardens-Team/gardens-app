import * as SecureStore from 'expo-secure-store';
import { 
  crypto_box_keypair,
  to_base64,
  from_base64,
  crypto_box_PUBLICKEYBYTES,
  crypto_box_SECRETKEYBYTES,
  crypto_box_seal,
  crypto_box_seal_open,
  randombytes_buf
} from 'react-native-libsodium';

// Keys for storing encryption keys in SecureStore
const PRIVATE_KEY_STORAGE_KEY = 'gardens_private_key';
const PUBLIC_KEY_STORAGE_KEY = 'gardens_public_key';

// Type definitions
export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface EncryptedMessage {
  id: string;
  senderPublicKey: string;
  encryptedContent: string;
  timestamp: number;
}

/**
 * Generate a new keypair and store it securely
 */
export const generateAndStoreKeyPair = async (): Promise<boolean> => {
  try {
    // Generate key pair using libsodium
    const keyPair = crypto_box_keypair();
    
    // Convert to base64 strings for storage
    const publicKeyBase64 = to_base64(keyPair.publicKey);
    const privateKeyBase64 = to_base64(keyPair.privateKey);
    
    // Store in secure storage
    await SecureStore.setItemAsync(PUBLIC_KEY_STORAGE_KEY, publicKeyBase64);
    await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE_KEY, privateKeyBase64);
    
    return true;
  } catch (error) {
    console.error('Error generating or storing key pair:', error);
    return false;
  }
};

/**
 * Retrieve the stored keypair
 */
export const getStoredKeyPair = async (): Promise<KeyPair | null> => {
  try {
    const publicKeyBase64 = await SecureStore.getItemAsync(PUBLIC_KEY_STORAGE_KEY);
    const privateKeyBase64 = await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_KEY);
    
    if (!publicKeyBase64 || !privateKeyBase64) {
      return null;
    }
    
    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64
    };
  } catch (error) {
    console.error('Error retrieving key pair:', error);
    return null;
  }
};

/**
 * Generate a message ID
 */
export const generateId = (): string => {
  const randomBytes = randombytes_buf(16);
  return to_base64(randomBytes);
};

/**
 * Encrypt a message using sealed box
 */
export const encryptMessage = async (
  message: string,
  recipientPublicKeyBase64: string
): Promise<EncryptedMessage | null> => {
  try {
    // Get sender's keypair
    const senderKeypair = await getStoredKeyPair();
    if (!senderKeypair) {
      console.error('No sender keypair found');
      return null;
    }
    
    // Convert recipient's public key from base64
    const recipientPublicKey = from_base64(recipientPublicKeyBase64);
    
    // Encrypt the message using sealed box
    const messageBytes = new TextEncoder().encode(message);
    const encryptedBytes = crypto_box_seal(messageBytes, recipientPublicKey);
    const encryptedBase64 = to_base64(encryptedBytes);
    
    return {
      id: generateId(),
      senderPublicKey: senderKeypair.publicKey,
      encryptedContent: encryptedBase64,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Failed to encrypt message:', error);
    return null;
  }
};

/**
 * Decrypt a message using sealed box
 */
export const decryptMessage = async (
  encryptedMessage: EncryptedMessage
): Promise<string | null> => {
  try {
    // Get recipient's keypair
    const recipientKeypair = await getStoredKeyPair();
    if (!recipientKeypair) {
      console.error('No recipient keypair found');
      return null;
    }
    
    // Convert keys from base64
    const privateKey = from_base64(recipientKeypair.privateKey);
    const publicKey = from_base64(recipientKeypair.publicKey);
    
    // Convert encrypted content from base64
    const encryptedBytes = from_base64(encryptedMessage.encryptedContent);
    
    // Decrypt the message
    const decryptedBytes = crypto_box_seal_open(
      encryptedBytes,
      publicKey,
      privateKey
    );
    
    // Convert decrypted bytes to string
    return new TextDecoder().decode(decryptedBytes);
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    return null;
  }
};

/**
 * Exchange public keys via QR code or deep link
 * Returns a string that can be used to create a QR code or deep link
 */
export const getPublicKeyForSharing = async (): Promise<string | null> => {
  const keypair = await getStoredKeyPair();
  return keypair?.publicKey || null;
};

/**
 * Import someone else's public key 
 * This would be called when scanning a QR code or opening a deep link
 */
export const importPublicKey = (publicKeyBase64: string): { id: string, publicKey: string } => {
  // In a real app, you'd want to validate the key format
  return {
    id: publicKeyBase64.substring(0, 8), // Use part of the key as an ID
    publicKey: publicKeyBase64
  };
};