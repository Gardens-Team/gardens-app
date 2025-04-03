import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Keys for AsyncStorage
const LAST_ACTIVE_KEY = 'gardens_last_active';
const SCREEN_LOCK_ENABLED_KEY = 'gardens_screen_lock_enabled';
const SCREEN_LOCK_DISABLED_SCREENS_KEY = 'gardens_screen_lock_disabled_screens';

// Timeout period in milliseconds (5 minutes)
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

// Check if fingerprint authentication is available
export const isFingerprintAvailable = async (): Promise<boolean> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch (error) {
    console.error('Error checking fingerprint availability:', error);
    return false;
  }
};

// Authenticate with fingerprint
export const authenticateWithFingerprint = async (): Promise<boolean> => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to continue',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
    
    if (result.success) {
      // Update last active time after successful authentication
      await updateLastActiveTime();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error during fingerprint authentication:', error);
    return false;
  }
};

// Update last active timestamp
export const updateLastActiveTime = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error updating last active time:', error);
  }
};

// Check if authentication is required
export const requiresAuthentication = async (screenName: string): Promise<boolean> => {
  try {
    // Get last active timestamp
    const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
    if (!lastActiveStr) return true;
    
    const lastActive = parseInt(lastActiveStr, 10);
    const currentTime = Date.now();
    const timeSinceLastActive = currentTime - lastActive;
    
    // If more than 5 minutes have passed, require authentication
    if (timeSinceLastActive > INACTIVITY_TIMEOUT) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking authentication requirement:', error);
    return true; // Require authentication on error
  }
};

// Set screen lock enabled/disabled
export const setScreenLockEnabled = async (enabled: boolean): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(SCREEN_LOCK_ENABLED_KEY, enabled.toString());
    return true;
  } catch (error) {
    console.error('Error setting screen lock:', error);
    return false;
  }
};

// Check if screen lock is enabled
export const isScreenLockEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await AsyncStorage.getItem(SCREEN_LOCK_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    console.error('Error checking screen lock status:', error);
    return false;
  }
};

// Set screens where screen lock is disabled
export const setScreenLockDisabledScreens = async (screens: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SCREEN_LOCK_DISABLED_SCREENS_KEY, JSON.stringify(screens));
  } catch (error) {
    console.error('Error setting screen lock disabled screens:', error);
  }
};

// Get screens where screen lock is disabled
export const getScreenLockDisabledScreens = async (): Promise<string[]> => {
  try {
    const screens = await AsyncStorage.getItem(SCREEN_LOCK_DISABLED_SCREENS_KEY);
    return screens ? JSON.parse(screens) : [];
  } catch (error) {
    console.error('Error getting screen lock disabled screens:', error);
    return [];
  }
}; 