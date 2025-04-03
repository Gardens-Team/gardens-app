import { AppState, AppStateStatus } from 'react-native';
import { executeSql, executeSqlWrite } from '../utils/database';
import * as Crypto from 'expo-crypto';

// Time window for considering a user as "online" in milliseconds (5 minutes)
const ONLINE_THRESHOLD = 5 * 60 * 1000;

// The different presence statuses
export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  OFFLINE = 'offline'
}

// Presence data model
export interface Presence {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
}

// Map of user IDs to event handlers for tracking presence changes
const presenceListeners: Map<string, Set<(presence: Presence) => void>> = new Map();

// Cache of known presences to avoid unnecessary DB queries
const presenceCache: Map<string, Presence> = new Map();

// UUID used to identify this app instance
const appInstanceId = Crypto.randomUUID();

// Current logged-in user ID
let currentUserId: string | null = null;

// Track if presence system has been initialized
let isInitialized = false;

// Track app state
let currentAppState: AppStateStatus = 'active';

// Store the subscription for later cleanup
let appStateSubscription: any = null;

/**
 * Handle app state changes to update presence accordingly
 */
const handleAppStateChange = (nextAppState: AppStateStatus) => {
  // Ignore if no current user or same state
  if (!currentUserId || nextAppState === currentAppState) {
    currentAppState = nextAppState;
    return;
  }

  const prevAppState = currentAppState;
  currentAppState = nextAppState;

  // Update presence based on app state transitions
  if (nextAppState === 'active') {
    // App came to foreground, set to online
    updateUserStatus(currentUserId, PresenceStatus.ONLINE)
      .catch(err => console.error('Failed to update presence on app active:', err));
  } else if (prevAppState === 'active' && (nextAppState === 'background' || nextAppState === 'inactive')) {
    // App went to background, set to away
    updateUserStatus(currentUserId, PresenceStatus.AWAY)
      .catch(err => console.error('Failed to update presence on app background:', err));
  }
};

/**
 * Initialize the presence service and start listening for app state changes
 */
export const initializePresence = async (userId: string): Promise<void> => {
  if (isInitialized && userId === currentUserId) {
    return;
  }

  try {
    currentUserId = userId;
    
    // Set initial presence
    await updateUserStatus(userId, PresenceStatus.ONLINE);

    // Start listening for app state changes if not already
    if (!isInitialized) {
      // Use the correct API based on React Native version
      appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
      isInitialized = true;
    }

    console.log('Presence service initialized for user:', userId);
  } catch (error) {
    console.error('Failed to initialize presence service:', error);
    throw error;
  }
};

/**
 * Clean up presence service when logging out
 */
export const cleanupPresence = async (): Promise<void> => {
  if (!isInitialized || !currentUserId) {
    return;
  }

  try {
    // Set to offline before cleanup
    await updateUserStatus(currentUserId, PresenceStatus.OFFLINE);
    
    // Remove app state listener
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
    
    // Clear caches
    presenceCache.clear();
    presenceListeners.clear();
    
    currentUserId = null;
    isInitialized = false;
    
    console.log('Presence service cleaned up');
  } catch (error) {
    console.error('Failed to cleanup presence service:', error);
    throw error;
  }
};

/**
 * Update a user's presence status
 */
export const updateUserStatus = async (
  userId: string,
  status: PresenceStatus
): Promise<boolean> => {
  try {
    const now = Date.now();
    await executeSqlWrite(
      `INSERT OR REPLACE INTO user_presence (user_id, status, last_active, timestamp) 
       VALUES (?, ?, ?, ?)`,
      [userId, status, now, now]
    );
    return true;
  } catch (error) {
    console.error('Error updating presence for user', userId, error);
    return false;
  }
};

/**
 * Record user activity to extend online status
 */
export const recordUserActivity = async (userId: string): Promise<void> => {
  if (userId !== currentUserId) {
    return;
  }
  
  try {
    const now = Date.now();
    await executeSqlWrite(
      `UPDATE presence SET last_seen = ?, timestamp = ? WHERE user_id = ?`,
      [now, now, userId]
    );
    
    // Update cache if exists
    const cachedPresence = presenceCache.get(userId);
    if (cachedPresence) {
      cachedPresence.lastSeen = new Date(now);
      
      // If user was away/offline, set back to online
      if (cachedPresence.status !== PresenceStatus.ONLINE) {
        await updateUserStatus(userId, PresenceStatus.ONLINE);
      }
    }
  } catch (error) {
    console.error(`Error recording activity for user ${userId}:`, error);
  }
};

/**
 * Get the current status of a user
 */
export const getUserStatus = async (userId: string): Promise<Presence | null> => {
  try {
    const results = await executeSql<{ status: string; last_active: number }>(
      'SELECT status, last_active FROM user_presence WHERE user_id = ?',
      [userId]
    );
    
    if (!results[0]) {
      return {
        userId,
        status: PresenceStatus.OFFLINE,
        lastSeen: new Date()
      };
    }

    return {
      userId,
      status: results[0].status as PresenceStatus,
      lastSeen: new Date(results[0].last_active)
    };
  } catch (error) {
    console.error('Error getting user status:', error);
    return null;
  }
};

/**
 * Get statuses for multiple users
 */
export const getMultipleStatuses = async (userIds: string[]): Promise<Map<string, Presence>> => {
  const result = new Map<string, Presence>();
  
  if (userIds.length === 0) {
    return result;
  }
  
  // Create placeholder parameters for SQL query
  const placeholders = userIds.map(() => '?').join(',');
  
  try {
    const rows = await executeSql<{ user_id: string; status: string; last_seen: number; timestamp: number }>(
      `SELECT * FROM presence WHERE user_id IN (${placeholders})`,
      userIds
    );
    
    const now = Date.now();
    
    // Process results
    for (const row of rows) {
      const lastSeen = new Date(row.last_seen);
      
      // Determine effective status based on last seen time
      let effectiveStatus = row.status as PresenceStatus;
      if (effectiveStatus === PresenceStatus.ONLINE) {
        const timeSinceLastSeen = now - row.last_seen;
        if (timeSinceLastSeen > ONLINE_THRESHOLD) {
          effectiveStatus = PresenceStatus.OFFLINE;
        }
      }
      
      const presence: Presence = {
        userId: row.user_id,
        status: effectiveStatus,
        lastSeen
      };
      
      result.set(row.user_id, presence);
      presenceCache.set(row.user_id, presence);
    }
    
    return result;
  } catch (error) {
    console.error('Error getting multiple statuses:', error);
    return result;
  }
};

/**
 * Get all online users
 */
export const getOnlineUsers = async (): Promise<Presence[]> => {
  try {
    const now = Date.now();
    const onlineThreshold = now - ONLINE_THRESHOLD;
    
    const rows = await executeSql<{ user_id: string; status: string; last_seen: number; timestamp: number }>(
      `SELECT * FROM presence 
       WHERE status = ? AND last_seen >= ?`,
      [PresenceStatus.ONLINE, onlineThreshold]
    );
    
    return rows.map(row => {
      const presence: Presence = {
        userId: row.user_id,
        status: PresenceStatus.ONLINE,
        lastSeen: new Date(row.last_seen)
      };
      
      presenceCache.set(row.user_id, presence);
      return presence;
    });
  } catch (error) {
    console.error('Error getting online users:', error);
    return [];
  }
};

/**
 * Watch for presence changes for specific users
 */
export const watchUsers = (
  userIds: string[],
  callback: (presence: Presence) => void
): () => void => {
  // Generate a listener ID for this callback
  const listenerId = Crypto.randomUUID();
  
  // Add listeners for each user
  for (const userId of userIds) {
    let userListeners = presenceListeners.get(userId);
    if (!userListeners) {
      userListeners = new Set();
      presenceListeners.set(userId, userListeners);
    }
    userListeners.add(callback);
    
    // Fetch initial status
    getUserStatus(userId)
      .then(presence => {
        if (presence) {
          callback(presence);
        }
      })
      .catch(err => console.error(`Error getting initial status for ${userId}:`, err));
  }
  
  // Return cleanup function
  return () => {
    for (const userId of userIds) {
      const userListeners = presenceListeners.get(userId);
      if (userListeners) {
        userListeners.delete(callback);
        if (userListeners.size === 0) {
          presenceListeners.delete(userId);
        }
      }
    }
  };
};

/**
 * Notify listeners of presence changes
 */
const notifyPresenceChange = (userId: string, presence: Presence): void => {
  const listeners = presenceListeners.get(userId);
  if (listeners) {
    listeners.forEach(callback => {
      try {
        callback(presence);
      } catch (err) {
        console.error('Error in presence listener callback:', err);
      }
    });
  }
};

/**
 * Run periodic cleanup of old presence data (call this occasionally)
 */
export const cleanupStalePresence = async (): Promise<void> => {
  try {
    const now = Date.now();
    const staleThreshold = now - (24 * 60 * 60 * 1000); // 24 hours
    
    await executeSqlWrite(
      `UPDATE presence 
       SET status = ? 
       WHERE status IN (?, ?) AND last_seen < ?`,
      [PresenceStatus.OFFLINE, PresenceStatus.ONLINE, PresenceStatus.AWAY, staleThreshold]
    );
    
    // Clear cache of stale entries
    for (const [userId, presence] of presenceCache.entries()) {
      const lastSeenTime = presence.lastSeen.getTime();
      if (lastSeenTime < staleThreshold) {
        presenceCache.delete(userId);
      }
    }
  } catch (error) {
    console.error('Error cleaning up stale presence data:', error);
  }
};

// Schedule periodic cleanup every hour
setInterval(cleanupStalePresence, 60 * 60 * 1000); 