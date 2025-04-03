import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import { generateAndStoreKeyPair } from '../../src/utils/encryption';

// Keys for secure storage
const REGISTRATION_PIN_KEY = 'gardens_registration_pin';
const REGISTRATION_LOCK_TIMESTAMP = 'gardens_registration_lock_timestamp';
const REGISTRATION_LOCK_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export default function RecoveryScreen() {
  const router = useRouter();
  
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState<number | null>(null);
  const [timerText, setTimerText] = useState('');
  
  useEffect(() => {
    checkRegistrationLock();
    
    // Set up interval to update timer
    const interval = setInterval(() => {
      checkRegistrationLock();
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);
  
  const checkRegistrationLock = async () => {
    try {
      const lockTimestampStr = await SecureStore.getItemAsync(REGISTRATION_LOCK_TIMESTAMP);
      
      if (!lockTimestampStr) {
        // No registration lock timestamp, user can recover immediately
        setLockTimeRemaining(0);
        return;
      }
      
      const lockTimestamp = parseInt(lockTimestampStr, 10);
      const currentTime = Date.now();
      const timePassed = currentTime - lockTimestamp;
      
      if (timePassed >= REGISTRATION_LOCK_PERIOD) {
        // Registration lock period has passed
        setLockTimeRemaining(0);
      } else {
        // Still within lock period
        const remaining = REGISTRATION_LOCK_PERIOD - timePassed;
        setLockTimeRemaining(remaining);
        updateTimerText(remaining);
      }
    } catch (error) {
      console.error('Failed to check registration lock:', error);
      // Default to showing PIN entry
      setLockTimeRemaining(0);
    }
  };
  
  const updateTimerText = (timeInMs: number) => {
    const days = Math.floor(timeInMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeInMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((timeInMs % (60 * 60 * 1000)) / (60 * 1000));
    
    setTimerText(`${days}d ${hours}h ${minutes}m`);
  };
  
  const handlePinChange = (text: string) => {
    setPin(text.replace(/[^0-9]/g, '').slice(0, 6));
  };
  
  const verifyPin = async () => {
    if (pin.length < 4) {
      Alert.alert('Invalid PIN', 'Please enter a valid PIN (at least 4 digits).');
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('Verifying recovery PIN...');
      const storedPin = await SecureStore.getItemAsync(REGISTRATION_PIN_KEY);
      
      if (pin === storedPin) {
        console.log('Recovery PIN verified');
        // PIN verified, reset encryption key
        await generateAndStoreKeyPair();
        // Update registration lock timestamp
        await SecureStore.setItemAsync(REGISTRATION_LOCK_TIMESTAMP, Date.now().toString());
        
        setIsLoading(false);
        router.replace('/auth/setup');
      } else {
        console.log('Recovery PIN verification failed');
        setIsLoading(false);
        Alert.alert('Incorrect PIN', 'The PIN you entered is incorrect. Please try again.');
      }
    } catch (error) {
      console.error('Failed to verify PIN:', error);
      setIsLoading(false);
      Alert.alert('Error', 'An error occurred while verifying your PIN. Please try again.');
    }
  };
  
  const handleTimeout = async () => {
    // Allow recovery after timeout
    try {
      // Reset encryption key
      await generateAndStoreKeyPair();
      // Reset registration lock
      await SecureStore.deleteItemAsync(REGISTRATION_PIN_KEY);
      await SecureStore.deleteItemAsync(REGISTRATION_LOCK_TIMESTAMP);
      
      router.replace('/auth/setup');
    } catch (error) {
      console.error('Failed to reset account:', error);
      Alert.alert('Error', 'An error occurred during account recovery. Please try again.');
    }
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Account Recovery</Text>
          
          {lockTimeRemaining === null ? (
            <ActivityIndicator size="large" color={Colors.primary} />
          ) : lockTimeRemaining > 0 ? (
            // Within lock period
            <View style={styles.lockContainer}>
              <Ionicons name="time-outline" size={60} color={Colors.primary} />
              <Text style={styles.subtitle}>
                Registration lock is active
              </Text>
              <Text style={styles.lockInfo}>
                You need to wait until the lock period expires:
              </Text>
              <Text style={styles.timerText}>{timerText}</Text>
              <Text style={styles.lockHelp}>
                This security feature protects your account. If you remember your PIN, you can bypass this waiting period.
              </Text>
              
              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.line} />
              </View>
              
              <Text style={styles.label}>Enter PIN to bypass waiting period</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your PIN"
                placeholderTextColor={Colors.inactive}
                value={pin}
                onChangeText={handlePinChange}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
              />
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: Colors.primary }]}
                onPress={verifyPin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.text} />
                ) : (
                  <Text style={styles.buttonText}>Verify PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // Lock period expired
            <View style={styles.recoveryContainer}>
              <Ionicons name="shield-checkmark-outline" size={60} color={Colors.primary} />
              <Text style={styles.subtitle}>
                Recover your account
              </Text>
              <Text style={styles.lockInfo}>
                You can recover your account using your PIN or proceed without it.
              </Text>
              
              <Text style={styles.label}>Enter PIN</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your PIN"
                placeholderTextColor={Colors.inactive}
                value={pin}
                onChangeText={handlePinChange}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
              />
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: Colors.primary }]}
                onPress={verifyPin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.text} />
                ) : (
                  <Text style={styles.buttonText}>Verify PIN</Text>
                )}
              </TouchableOpacity>
              
              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.line} />
              </View>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: Colors.secondary || '#666' }]}
                onPress={handleTimeout}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>Recover Without PIN</Text>
              </TouchableOpacity>
              
              <Text style={styles.warningText}>
                Note: Recovering without your PIN will reset your account. Your previous messages will not be accessible.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingTop: 70,
    paddingBottom: 30,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 30,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginVertical: 15,
  },
  lockContainer: {
    width: '100%',
    alignItems: 'center',
    padding: 15,
  },
  recoveryContainer: {
    width: '100%',
    alignItems: 'center',
    padding: 15,
  },
  lockInfo: {
    fontSize: 16,
    color: Colors.inactive,
    textAlign: 'center',
    marginBottom: 15,
  },
  timerText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: Colors.primary,
    marginVertical: 20,
  },
  lockHelp: {
    fontSize: 14,
    color: Colors.inactive,
    textAlign: 'center',
    marginVertical: 15,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 25,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  orText: {
    color: Colors.inactive,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 20,
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  warningText: {
    fontSize: 14,
    color: Colors.warning || '#FFA500',
    textAlign: 'center',
    marginTop: 20,
  },
}); 