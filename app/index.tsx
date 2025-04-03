import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { initDatabase } from '../src/utils/database';
import { generateAndStoreKeyPair, getStoredKeyPair } from '../src/utils/encryption';
import { useUserStore } from './contexts/UserStore';

export default function Index() {
  const user = useUserStore(state => state.user);

  useEffect(() => {
    // Initialize database and encryption
    const init = async () => {
      try {
        // Initialize database
        await initDatabase();
        console.log('Database initialized successfully');
        
        // Initialize encryption keys if needed
        const existingKeys = await getStoredKeyPair();
        if (!existingKeys) {
          await generateAndStoreKeyPair();
          console.log('Encryption keys generated successfully');
        } else {
          console.log('Encryption keys already exist');
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    init();
  }, []);

  return <Redirect href="/home" />;
}