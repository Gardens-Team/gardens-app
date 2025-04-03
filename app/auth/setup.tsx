import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useUserStore } from '../contexts/UserStore';
import Colors from '../constants/Colors';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { generateAndStoreKeyPair, getStoredKeyPair } from '../../src/utils/encryption';
import { initDatabase } from '../../src/utils/database';

// Keys for storing registration PIN and biometrics in SecureStore
const REGISTRATION_PIN_KEY = 'gardens_registration_pin';
const REGISTRATION_LOCK_TIMESTAMP = 'gardens_registration_lock_timestamp';
const HAS_CONFIGURED_BIOMETRICS = 'gardens_has_configured_biometrics';
const BIOMETRIC_AUTH_ENABLED = 'gardens_biometric_auth_enabled';
const REGISTRATION_LOCK_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export default function SetupScreen() {
  const setUser = useUserStore(state => state.setUser);
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  const [isSettingUpBiometrics, setIsSettingUpBiometrics] = useState(false);
  
  // Check if device supports biometric authentication
  useEffect(() => {
    const checkBiometricSupport = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricsAvailable(compatible && isEnrolled);
    };
    
    checkBiometricSupport();
  }, []);
  
  const handleUsernameChange = (text: string) => setUsername(text);
  const handlePinChange = (text: string) => setPin(text.replace(/[^0-9]/g, '').slice(0, 6));
  const handleConfirmPinChange = (text: string) => setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, 6));
  
  const handleNext = () => {
    if (username.trim().length < 6) {
      Alert.alert(
        "Invalid Username",
        "Username must be at least 6 characters long."
      );
      return;
    }
    setStep(2);
  };
  
  const handlePinNext = async () => {
    if (pin.length < 4) {
      Alert.alert(
        "Invalid PIN",
        "PIN must be at least 4 digits."
      );
      return;
    }
    
    if (pin !== confirmPin) {
      Alert.alert(
        "PINs Don't Match",
        "Please make sure your PINs match."
      );
      return;
    }
    
    // Store the PIN securely
    try {
      await SecureStore.setItemAsync(REGISTRATION_PIN_KEY, pin);
      // Store the current timestamp for registration lock
      await SecureStore.setItemAsync(REGISTRATION_LOCK_TIMESTAMP, Date.now().toString());
      
      // If biometrics is available, proceed to biometrics setup step
      if (isBiometricsAvailable) {
        setStep(3); // Biometrics setup
      } else {
        setStep(4); // Profile picture if biometrics not available
      }
    } catch (error) {
      console.error('Failed to store PIN:', error);
      Alert.alert(
        "Error",
        "Failed to set up your PIN. Please try again."
      );
    }
  };

  const handleBiometricsNext = async () => {
    if (isSettingUpBiometrics) {
      try {
        // Prompt user to authenticate with biometrics
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify your identity to enable biometric authentication',
          fallbackLabel: 'Use PIN instead',
        });
        
        if (result.success) {
          // Successfully authenticated, enable biometrics
          await SecureStore.setItemAsync(HAS_CONFIGURED_BIOMETRICS, 'true');
          await SecureStore.setItemAsync(BIOMETRIC_AUTH_ENABLED, 'true');
          setStep(4); // Proceed to profile picture
        } else {
          // Authentication failed
          Alert.alert(
            "Authentication Failed",
            "Failed to verify your biometrics. You can set up biometrics later in settings."
          );
          await SecureStore.setItemAsync(BIOMETRIC_AUTH_ENABLED, 'false');
          setStep(4); // Proceed to profile picture
        }
      } catch (error) {
        console.error('Biometric authentication error:', error);
        Alert.alert(
          "Error",
          "An error occurred during biometric setup. You can set up biometrics later in settings."
        );
        await SecureStore.setItemAsync(BIOMETRIC_AUTH_ENABLED, 'false');
        setStep(4); // Proceed to profile picture
      }
    } else {
      // Skip biometrics setup
      await SecureStore.setItemAsync(BIOMETRIC_AUTH_ENABLED, 'false');
      setStep(4); // Proceed to profile picture
    }
  };
  
  const selectProfileImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission Required",
        "You need to grant access to your photos to set a profile picture."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setProfilePic(base64Image);
    }
  };
  
  const handleComplete = async () => {
    try {
      setIsLoading(true);
      
      // Initialize database schema first
      await initDatabase();
      
      // Generate encryption key
      const keyGenerated = await generateAndStoreKeyPair();
      if (!keyGenerated) {
        throw new Error('Failed to generate encryption key');
      }
      
      // Get the generated public key
      const keyPair = await getStoredKeyPair();
      if (!keyPair) {
        throw new Error('Failed to retrieve generated keys');
      }
      
      // Create a local user
      const newUser = {
        id: Crypto.randomUUID(),
        username: username.trim(),
        profilePic: profilePic,
        visible: true,
        publicKey: keyPair.publicKey
      };
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setUser({
        ...newUser,
        profilePic: newUser.profilePic || undefined,
      });
      
      setIsLoading(false);
      router.replace('/home');
    } catch (error) {
      setIsLoading(false);
      Alert.alert(
        "Setup Failed",
        "An error occurred during setup. Please try again."
      );
    }
  };
  
  const skipProfilePic = () => {
    setProfilePic(null);
    handleComplete();
  };

  const renderBiometricSetup = () => {
    return (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Biometric Authentication</Text>
        <Text style={styles.description}>
          Set up fingerprint or face recognition for quick and secure access to your account.
        </Text>
        
        <View style={styles.biometricIconContainer}>
          <Ionicons name="finger-print" size={80} color={Colors.primary} />
        </View>
        
        <Text style={styles.biometricInfo}>
          Enabling biometric authentication allows you to quickly unlock the app using your fingerprint or face recognition, depending on your device.
        </Text>
        
        <View style={styles.biometricButtonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.setupButton]}
            onPress={() => {
              setIsSettingUpBiometrics(true);
              handleBiometricsNext();
            }}
          >
            <Text style={styles.buttonText}>Enable Biometrics</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.skipButton]}
            onPress={() => {
              setIsSettingUpBiometrics(false);
              handleBiometricsNext();
            }}
          >
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {step === 1 ? "Welcome to Gardens" : 
             step === 2 ? "Set Up Security PIN" : 
             step === 3 ? "Set Up Biometrics" :
             "Set Profile Picture"}
          </Text>
          
          <Text style={styles.subtitle}>
            {step === 1 
              ? "A secure messaging platform for organizing political activity" 
              : step === 2
              ? "This PIN protects your account and is required for account recovery"
              : step === 3
              ? "Add an extra layer of security with biometric authentication"
              : "Add a profile picture to help comrades recognize you"}
          </Text>
          
          {step === 1 ? (
            // Step 1: Username Entry
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Your Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter a username"
                placeholderTextColor={Colors.inactive}
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              <TouchableOpacity
                style={[
                  styles.button,
                  { opacity: username.trim().length < 3 ? 0.7 : 1 }
                ]}
                onPress={handleNext}
                disabled={username.trim().length < 3}
              >
                <Text style={styles.buttonText}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : step === 2 ? (
            // Step 2: PIN Setup
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Create a PIN (6 digits)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter a PIN"
                placeholderTextColor={Colors.inactive}
                value={pin}
                onChangeText={handlePinChange}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
              />
              
              <Text style={styles.label}>Confirm PIN</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm your PIN"
                placeholderTextColor={Colors.inactive}
                value={confirmPin}
                onChangeText={handleConfirmPinChange}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
              />
              
              <Text style={styles.pinInfo}>
                Your PIN will be required if you lose access to your device. Without it, you'll need to wait 7 days to regain access.
              </Text>
              
              <TouchableOpacity
                style={[
                  styles.button,
                  { opacity: pin.length < 4 || confirmPin.length < 4 ? 0.7 : 1 }
                ]}
                onPress={handlePinNext}
                disabled={pin.length < 4 || confirmPin.length < 4}
              >
                <Text style={styles.buttonText}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : step === 3 ? (
            // Step 3: Biometric Setup
            renderBiometricSetup()
          ) : (
            // Step 4: Profile Picture
            <View style={styles.profileSetup}>
              <TouchableOpacity
                style={styles.profilePicContainer}
                onPress={selectProfileImage}
              >
                {profilePic ? (
                  <View style={styles.profileImageContainer}>
                    <Image 
                      source={{ uri: profilePic }}
                      style={styles.profileImage}
                    />
                  </View>
                ) : (
                  <View style={styles.placeholderContainer}>
                    <View style={styles.placeholderInner}>
                      <Ionicons name="person-add" size={48} color={Colors.inactive} />
                    </View>
                  </View>
                )}
                
                <View style={styles.cameraIcon}>
                  <Ionicons name="camera" size={20} color={Colors.text} />
                </View>
              </TouchableOpacity>
              
              <Text style={styles.profileHelp}>
                Tap to select a profile image
              </Text>
              
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[styles.button, { opacity: isLoading ? 0.7 : 1 }]}
                  onPress={handleComplete}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.text} />
                  ) : (
                    <Text style={styles.buttonText}>Complete Setup</Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={skipProfilePic}
                  disabled={isLoading}
                >
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.securityInfo}>
            End-to-End Encrypted • No Tracking • No Ads
          </Text>
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
    justifyContent: 'space-between',
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
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.inactive,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  inputContainer: {
    width: '100%',
    marginTop: 20,
  },
  pinInfo: {
    fontSize: 14,
    color: Colors.warning,
    textAlign: 'center',
    marginVertical: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: Colors.inactive,
    marginBottom: 20,
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
    backgroundColor: Colors.primary,
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
  profileSetup: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  profilePicContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 75,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderInner: {
    width: '100%',
    height: '100%',
    borderRadius: 75,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 75,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 75,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
  },
  profileHelp: {
    fontSize: 14,
    color: Colors.inactive,
    marginTop: 15,
    marginBottom: 30,
  },
  buttonGroup: {
    width: '100%',
  },
  skipButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: Colors.inactive,
    textDecorationLine: 'underline',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 50,
  },
  securityInfo: {
    fontSize: 14,
    color: Colors.inactive,
    textAlign: 'center',
  },
  biometricIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 30,
  },
  biometricInfo: {
    fontSize: 14,
    color: Colors.inactive,
    textAlign: 'center',
    marginBottom: 30,
  },
  biometricButtonContainer: {
    width: '100%',
  },
  setupButton: {
    backgroundColor: Colors.primary,
  },
}); 