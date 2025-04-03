import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Image, ScrollView, Alert } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useUserStore } from '../../contexts/UserStore';
import Colors from '../../constants/Colors';
import { isFingerprintAvailable, setScreenLockEnabled, isScreenLockEnabled } from '../../../src/utils/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useUserStore(state => state.user);
  const updateProfile = useUserStore(state => state.updateProfile);
  const logout = useUserStore(state => state.logout);
  
  const [isVisible, setIsVisible] = useState(user?.visible || false);
  const [screenLockEnabled, setScreenLockEnabledState] = useState(false);
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false);
  
  useEffect(() => {
    // Check if fingerprint is available
    const checkBiometrics = async () => {
      const available = await isFingerprintAvailable();
      setFingerprintAvailable(available);
      
      // Get current screen lock setting
      const enabled = await isScreenLockEnabled();
      setScreenLockEnabledState(enabled);
    };
    
    checkBiometrics();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      "Logout Confirmation",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: () => {
          logout();
          router.replace('/auth/setup');
        }}
      ]
    );
  };

  const toggleVisibility = () => {
    const newVisibility = !isVisible;
    setIsVisible(newVisibility);
    updateProfile({ visible: newVisibility });
  };
  
  const toggleScreenLock = async () => {
    if (!fingerprintAvailable && !screenLockEnabled) {
      Alert.alert(
        "Fingerprint Not Available",
        "Your device does not have fingerprint authentication set up. Please set up fingerprint in your device settings first."
      );
      return;
    }
    
    const newValue = !screenLockEnabled;
    const success = await setScreenLockEnabled(newValue);
    
    if (success) {
      setScreenLockEnabledState(newValue);
    } else {
      Alert.alert(
        "Error",
        "Failed to update screen lock setting."
      );
    }
  };

  const selectProfileImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to grant access to your photos to change your profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      updateProfile({ profilePic: base64Image });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>
      
      <View style={styles.profileSection}>
        <TouchableOpacity style={styles.avatarContainer} onPress={selectProfileImage}>
          {user?.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{user?.username?.charAt(0) || '?'}</Text>
            </View>
          )}
          <View style={styles.editIconContainer}>
            <Ionicons name="camera" size={16} color={Colors.text} />
          </View>
        </TouchableOpacity>
        
        <Text style={styles.username}>{user?.username || 'Comrade'}</Text>
        <Text style={styles.userId}>ID: {user?.id || 'Not set'}</Text>
      </View>
      
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Settings</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="eye-outline" size={24} color={Colors.text} style={styles.settingIcon} />
            <Text style={styles.settingText}>Visibility</Text>
          </View>
          <Switch
            value={isVisible}
            onValueChange={toggleVisibility}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.text}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="finger-print" size={24} color={Colors.text} style={styles.settingIcon} />
            <Text style={styles.settingText}>Screen Lock</Text>
          </View>
          <Switch
            value={screenLockEnabled}
            onValueChange={toggleScreenLock}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.text}
            disabled={!fingerprintAvailable && !screenLockEnabled}
          />
        </View>
        
        <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/settings/encryption')}>
          <View style={styles.settingInfo}>
            <MaterialIcons name="security" size={24} color={Colors.text} style={styles.settingIcon} />
            <Text style={styles.settingText}>Encryption Settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/settings/notifications')}>
          <View style={styles.settingInfo}>
            <Ionicons name="notifications-outline" size={24} color={Colors.text} style={styles.settingIcon} />
            <Text style={styles.settingText}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/settings/privacy')}>
          <View style={styles.settingInfo}>
            <Ionicons name="lock-closed-outline" size={24} color={Colors.text} style={styles.settingIcon} />
            <Text style={styles.settingText}>Privacy</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/about/security')}>
          <View style={styles.settingInfo}>
            <MaterialIcons name="shield" size={24} color={Colors.text} style={styles.settingIcon} />
            <Text style={styles.settingText}>Security Information</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/about/principles')}>
          <View style={styles.settingInfo}>
            <MaterialIcons name="flag" size={24} color={Colors.text} style={styles.settingIcon} />
            <Text style={styles.settingText}>Our Principles</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
      
      <View style={styles.versionInfo}>
        <Text style={styles.versionText}>Gardens v1.0.0</Text>
        <Text style={styles.versionText}>End-to-End Encrypted</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.text,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.secondary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  userId: {
    fontSize: 14,
    color: Colors.inactive,
  },
  settingsSection: {
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 15,
  },
  settingText: {
    fontSize: 16,
    color: Colors.text,
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 30,
    backgroundColor: Colors.danger,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionInfo: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  versionText: {
    fontSize: 14,
    color: Colors.inactive,
    marginBottom: 5,
  },
}); 