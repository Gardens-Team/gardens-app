import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useUserStore } from '../contexts/UserStore';
import Colors from '../constants/Colors';
import * as SecureStore from 'expo-secure-store';

const REGISTRATION_PIN_KEY = 'gardens_registration_pin';

export default function VerifyScreen() {
  const { isBiometricsAvailable, authenticateWithBiometrics, bypassBiometrics } = useAuth();
  const user = useUserStore(state => state.user);
  const logout = useUserStore(state => state.logout);
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState('');
  
  useEffect(() => {
    console.log('VerifyScreen mounted, biometrics available:', isBiometricsAvailable);
    // Attempt biometric auth when the screen loads
    if (isBiometricsAvailable && !pinMode) {
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        handleBiometricAuth();
      }, 500);
    }
  }, []);  // Only run once on component mount
  
  const handleBiometricAuth = async () => {
    setIsVerifying(true);
    const success = await authenticateWithBiometrics();
    setIsVerifying(false);
    
    if (success) {
      // Authentication successful, navigation handled by AuthContext
      console.log('Biometric authentication successful');
    } else {
      // Authentication failed
      console.log('Biometric authentication failed');
    }
  };
  
  const handlePinVerification = async () => {
    if (pin.length < 4) {
      Alert.alert('Invalid PIN', 'PIN must be at least 4 digits');
      return;
    }
    
    setIsVerifying(true);
    try {
      console.log('Verifying PIN...');
      const storedPin = await SecureStore.getItemAsync(REGISTRATION_PIN_KEY);
      console.log('Stored PIN exists:', !!storedPin);
      
      if (storedPin === pin) {
        console.log('PIN verification successful');
        // PIN is correct, bypass biometrics
        bypassBiometrics();
        setIsVerifying(false);
        // Explicitly navigate to home since auth context might be delayed
        setTimeout(() => {
          router.replace('../(tabs)/home');
        }, 500);
      } else {
        console.log('PIN verification failed');
        setIsVerifying(false);
        Alert.alert('Incorrect PIN', 'The PIN you entered is incorrect. Please try again.');
        setPin('');
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      setIsVerifying(false);
      Alert.alert('Error', 'Failed to verify PIN. Please try again.');
    }
  };
  
  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };
  
  const handleDeletePin = () => {
    setPin(prev => prev.slice(0, -1));
  };
  
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/auth/setup');
          },
        },
      ]
    );
  };
  
  const renderPinDots = () => {
    return (
      <View style={styles.pinDotsContainer}>
        {[...Array(6)].map((_, index) => (
          <View 
            key={index} 
            style={[
              styles.pinDot, 
              index < pin.length ? styles.pinDotFilled : {}
            ]} 
          />
        ))}
      </View>
    );
  };
  
  const renderPinPad = () => {
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'];
    
    return (
      <View style={styles.pinPadContainer}>
        {digits.map((digit, index) => {
          if (digit === '') {
            return <View key={index} style={styles.pinButton} />;
          }
          
          if (digit === 'delete') {
            return (
              <TouchableOpacity
                key={index}
                style={styles.pinButton}
                onPress={handleDeletePin}
              >
                <Ionicons name="backspace-outline" size={24} color={Colors.text} />
              </TouchableOpacity>
            );
          }
          
          return (
            <TouchableOpacity
              key={index}
              style={styles.pinButton}
              onPress={() => handlePinInput(digit)}
            >
              <Text style={styles.pinButtonText}>{digit}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back</Text>
        {user?.username && (
          <Text style={styles.username}>{user.username}</Text>
        )}
      </View>
      
      <View style={styles.profileContainer}>
        {user?.profilePic ? (
          <Image
            source={{ uri: user.profilePic }}
            style={styles.profileImage}
          />
        ) : (
          <View style={styles.profilePlaceholder}>
            <Ionicons name="person" size={48} color={Colors.inactive} />
          </View>
        )}
      </View>
      
      {!pinMode ? (
        <View style={styles.biometricContainer}>
          <Text style={styles.verifyText}>
            Verify your identity to continue
          </Text>
          
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricAuth}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Ionicons name="finger-print" size={64} color={Colors.primary} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setPinMode(true)}
          >
            <Text style={styles.switchButtonText}>
              Use PIN Instead
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pinContainer}>
          <Text style={styles.verifyText}>
            Enter your PIN
          </Text>
          
          {renderPinDots()}
          
          {renderPinPad()}
          
          <TouchableOpacity
            style={[
              styles.verifyButton,
              pin.length < 4 && { opacity: 0.5 }
            ]}
            onPress={handlePinVerification}
            disabled={pin.length < 4 || isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <Text style={styles.verifyButtonText}>Verify</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setPin('');
              setPinMode(false);
            }}
          >
            <Text style={styles.switchButtonText}>
              Use Biometrics Instead
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutButtonText}>
          Logout
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 25,
    paddingTop: 70,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  username: {
    fontSize: 18,
    color: Colors.inactive,
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricContainer: {
    alignItems: 'center',
  },
  verifyText: {
    fontSize: 16,
    color: Colors.inactive,
    marginBottom: 20,
    textAlign: 'center',
  },
  biometricButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  switchButton: {
    marginTop: 20,
  },
  switchButtonText: {
    fontSize: 16,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  pinContainer: {
    alignItems: 'center',
  },
  pinDotsContainer: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  pinDot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: Colors.card,
    marginHorizontal: 5,
  },
  pinDotFilled: {
    backgroundColor: Colors.primary,
  },
  pinPadContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '80%',
    maxWidth: 300,
  },
  pinButton: {
    width: '30%',
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  pinButtonText: {
    fontSize: 28,
    fontWeight: '500',
    color: Colors.text,
  },
  verifyButton: {
    width: '80%',
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  logoutButton: {
    marginTop: 'auto',
    marginBottom: 30,
    alignSelf: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    color: Colors.danger,
  },
}); 