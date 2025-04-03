import React, { useEffect } from 'react';
import { initializePresence, cleanupPresence } from '../services/PresenceService';

interface PresenceInitializerProps {
  userId: string;
  children: React.ReactNode;
}

/**
 * This component initializes presence monitoring for the current user
 * when the app starts up. It's intended to be mounted once at app root.
 */
export const PresenceInitializer: React.FC<PresenceInitializerProps> = ({ userId, children }) => {
  // Initialize presence when component mounts
  useEffect(() => {
    if (!userId) return;
    
    // Initialize presence
    initializePresence(userId);
    
    // Cleanup when component unmounts
    return () => {
      cleanupPresence();
    };
  }, [userId]);
  
  // Return children to render
  return <>{children}</>;
}; 