import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import { useUserStore } from './UserStore';
import { Alert } from 'react-native';
import * as PresenceService from '../../src/services/PresenceService';

// Keys for secure storage
const HAS_CONFIGURED_BIOMETRICS = 'gardens_has_configured_biometrics';
const BIOMETRIC_AUTH_ENABLED = 'gardens_biometric_auth_enabled';

interface AuthContextType {
  isBiometricsAvailable: boolean;
  isBiometricsEnabled: boolean;
  isLoading: boolean;
  authenticateWithBiometrics: () => Promise<boolean>;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<boolean>;
  bypassBiometrics: () => void;
  lockStatus: 'unlocked' | 'locked';
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lockStatus, setLockStatus] = useState<'unlocked' | 'locked'>('locked');
  
  const router = useRouter();
  const segments = useSegments();
  const user = useUserStore(state => state.user);
  const logout = useUserStore(state => state.logout);
  const setUser = useUserStore(state => state.setUser);

  // Check biometrics availability and status
  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        // Check if hardware supports biometrics
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricsAvailable(compatible && isEnrolled);
        
        // Check if user has enabled biometrics for the app
        const enabled = await SecureStore.getItemAsync(BIOMETRIC_AUTH_ENABLED);
        setIsBiometricsEnabled(enabled === 'true');
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking biometrics:', error);
        setIsBiometricsAvailable(false);
        setIsBiometricsEnabled(false);
        setIsLoading(false);
      }
    };
    
    checkBiometrics();
  }, []);

  // Handle route protection
  useEffect(() => {
    if (isLoading) return;

    // Safe way to access segments by converting to Array first
    const segmentsArray = Array.from(segments);
    const inAuthGroup = segmentsArray.length > 0 && segmentsArray[0] === 'auth';
    const secondSegment = segmentsArray.length > 1 ? segmentsArray[1] : null;
    
    console.log('Navigation check:', { 
      user: !!user, 
      inAuthGroup, 
      secondSegment, 
      isBiometricsEnabled, 
      lockStatus 
    });
    
    // Handle routing based on auth status
    if (!user && !inAuthGroup) {
      // No user, redirect to auth
      console.log('Redirecting to setup (no user)');
      router.replace('/auth/setup');
    } else if (user && lockStatus === 'locked') {
      // User exists and app is locked - verify biometrics or pin
      if (isBiometricsEnabled) {
        // If biometrics enabled, use biometric verification
        if (!inAuthGroup || (inAuthGroup && secondSegment !== 'verify')) {
          console.log('Redirecting to verify with biometrics (locked)');
          router.replace('/auth/verify');
        }
      } else {
        // If no biometrics, still need to verify with PIN
        if (!inAuthGroup || (inAuthGroup && secondSegment !== 'verify')) {
          console.log('Redirecting to verify with PIN (locked)');
          router.replace('/auth/verify');
        }
      }
    } else if (user && lockStatus === 'unlocked') {
      // User exists and unlocked - go to main app
      if (inAuthGroup && secondSegment !== 'verify') {
        console.log('Redirecting to home (unlocked)');
        router.replace('/');
      }
    }
  }, [user, segments, lockStatus, isBiometricsEnabled, isLoading]);

  // Initialize presence service when user logs in
  useEffect(() => {
    if (user && lockStatus === 'unlocked') {
      // Connect to presence service when user is logged in and app is unlocked
      PresenceService.initializePresence(user.id)
        .catch(error => console.error('Failed to connect to presence service:', error));
    }
    
    return () => {
      // Disconnect when component unmounts
      if (user) {
        PresenceService.cleanupPresence();
      }
    };
  }, [user, lockStatus]);

  const authenticateWithBiometrics = async (): Promise<boolean> => {
    if (!isBiometricsAvailable) {
      Alert.alert('Biometrics Unavailable', 'Your device does not support biometric authentication or you haven\'t set it up.');
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Gardens',
        fallbackLabel: 'Use PIN instead',
      });

      if (result.success) {
        setLockStatus('unlocked');
        return true;
      } else {
        console.log('Authentication failed:', result);
        return false;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  };

  const enableBiometrics = async (): Promise<boolean> => {
    if (!isBiometricsAvailable) {
      Alert.alert('Biometrics Unavailable', 'Your device does not support biometric authentication or you haven\'t set it up.');
      return false;
    }

    try {
      // First, check if user can authenticate
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to enable biometric authentication',
        fallbackLabel: 'Use PIN instead',
      });

      if (result.success) {
        await SecureStore.setItemAsync(HAS_CONFIGURED_BIOMETRICS, 'true');
        await SecureStore.setItemAsync(BIOMETRIC_AUTH_ENABLED, 'true');
        setIsBiometricsEnabled(true);
        setLockStatus('unlocked');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error enabling biometrics:', error);
      return false;
    }
  };

  const disableBiometrics = async (): Promise<boolean> => {
    try {
      // First, check if user can authenticate
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to disable biometric authentication',
        fallbackLabel: 'Use PIN instead',
      });

      if (result.success) {
        await SecureStore.setItemAsync(BIOMETRIC_AUTH_ENABLED, 'false');
        setIsBiometricsEnabled(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error disabling biometrics:', error);
      return false;
    }
  };

  const bypassBiometrics = () => {
    // Used for testing or when biometrics fails but PIN auth succeeds
    console.log('Bypassing biometrics authentication');
    setLockStatus('unlocked');
    // Ensure the state update propagates
    setTimeout(() => {
      console.log('Lock status after bypass:', 'unlocked');
    }, 100);
  };

  const handleLogout = async () => {
    try {
      // Disconnect from presence service first
      PresenceService.cleanupPresence();
      
      // Then perform the regular logout
      logout();
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isBiometricsAvailable,
        isBiometricsEnabled,
        isLoading,
        authenticateWithBiometrics,
        enableBiometrics,
        disableBiometrics,
        bypassBiometrics,
        lockStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Add default export for the AuthProvider
export default AuthProvider; 