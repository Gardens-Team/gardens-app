import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  PresenceStatus,
  Presence,
  getUserStatus,
  getMultipleStatuses,
  getOnlineUsers,
  watchUsers as watchUsersService,
} from '../services/PresenceService';

// Context interface
interface PresenceContextType {
  watchUsers: (userIds: string[]) => () => void;
  getUserPresence: (userId: string) => Presence | null;
  getOnlineUserIds: () => string[];
  onlineUsers: string[];
  presenceMap: Map<string, Presence>;
}

// Create the context with default values
const PresenceContext = createContext<PresenceContextType>({
  watchUsers: () => () => {},
  getUserPresence: () => null,
  getOnlineUserIds: () => [],
  onlineUsers: [],
  presenceMap: new Map(),
});

// Provider props
interface PresenceProviderProps {
  children: ReactNode;
  initialUserIds?: string[];
}

/**
 * Provider component that makes presence data available to any child component
 */
export const PresenceProvider: React.FC<PresenceProviderProps> = ({
  children,
  initialUserIds = [],
}) => {
  // Cache of presence data
  const [presenceMap, setPresenceMap] = useState<Map<string, Presence>>(new Map());
  const [watchedUsers, setWatchedUsers] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  
  // Set up initial watched users
  useEffect(() => {
    if (initialUserIds.length > 0) {
      watchUsers(initialUserIds);
    }
  }, []);
  
  // Refresh online users periodically
  useEffect(() => {
    const refreshOnlineUsers = async () => {
      try {
        const users = await getOnlineUsers();
        setOnlineUsers(users.map(user => user.userId));
      } catch (error) {
        console.error('Failed to refresh online users:', error);
      }
    };
    
    // Initial load
    refreshOnlineUsers();
    
    // Set up interval
    const interval = setInterval(refreshOnlineUsers, 60 * 1000); // Every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // Watch specific users for status updates
  const watchUsers = useCallback((userIds: string[]) => {
    // Filter out users we're already watching
    const newUserIds = userIds.filter(id => !watchedUsers.has(id));
    
    if (newUserIds.length === 0) {
      // Return a no-op cleanup function if no new users to watch
      return () => {};
    }
    
    // Update watched users set
    const updatedWatchedUsers = new Set(watchedUsers);
    newUserIds.forEach(id => updatedWatchedUsers.add(id));
    setWatchedUsers(updatedWatchedUsers);
    
    // Set up watching
    const handlePresenceUpdate = (presence: Presence) => {
      setPresenceMap(prevMap => {
        const newMap = new Map(prevMap);
        newMap.set(presence.userId, presence);
        return newMap;
      });
      
      // Update online users list if needed
      if (presence.status === PresenceStatus.ONLINE) {
        setOnlineUsers(prev => {
          if (!prev.includes(presence.userId)) {
            return [...prev, presence.userId];
          }
          return prev;
        });
      } else {
        // User is AWAY or OFFLINE
        setOnlineUsers(prev => prev.filter(id => id !== presence.userId));
      }
    };
    
    // Initialize with current status data
    getMultipleStatuses(newUserIds).then(statusMap => {
      setPresenceMap(prevMap => {
        const newMap = new Map(prevMap);
        statusMap.forEach((presence, userId) => {
          newMap.set(userId, presence);
        });
        return newMap;
      });
    });
    
    // Start watching
    const cleanup = watchUsersService(newUserIds, handlePresenceUpdate);
    
    // Return function to stop watching
    return () => {
      cleanup();
      
      // Remove these users from our watching set
      const remainingWatchedUsers = new Set(watchedUsers);
      newUserIds.forEach(id => remainingWatchedUsers.delete(id));
      setWatchedUsers(remainingWatchedUsers);
    };
  }, [watchedUsers]);
  
  // Get presence for a specific user
  const getUserPresence = useCallback((userId: string) => {
    return presenceMap.get(userId) || null;
  }, [presenceMap]);
  
  // Get array of online user IDs
  const getOnlineUserIds = useCallback(() => {
    return onlineUsers;
  }, [onlineUsers]);
  
  // Create the context value
  const contextValue: PresenceContextType = {
    watchUsers,
    getUserPresence,
    getOnlineUserIds,
    onlineUsers,
    presenceMap,
  };
  
  return (
    <PresenceContext.Provider value={contextValue}>
      {children}
    </PresenceContext.Provider>
  );
};

/**
 * Hook to use presence functionality in components
 */
export const usePresence = () => useContext(PresenceContext); 