import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import UserStatusIndicator from './UserStatusIndicator';
import Colors from '../../app/constants/Colors';

interface UserAvatarProps {
  userId: string;
  username: string;
  profilePic?: string;
  size?: 'small' | 'medium' | 'large';
  showStatus?: boolean;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  username,
  profilePic,
  size = 'medium',
  showStatus = true
}) => {
  // Size mappings
  const avatarSize = {
    small: 36,
    medium: 48,
    large: 80
  }[size];

  const fontSizes = {
    small: 14,
    medium: 18,
    large: 28
  }[size];

  const statusSize = {
    small: 'small',
    medium: 'medium',
    large: 'large'
  }[size] as 'small' | 'medium' | 'large';

  // Get user's initial for fallback
  const initial = username?.charAt(0)?.toUpperCase() || '?';

  return (
    <View style={styles.container}>
      {profilePic ? (
        <Image
          source={{ uri: profilePic }}
          style={[
            styles.avatar,
            { width: avatarSize, height: avatarSize }
          ]}
        />
      ) : (
        <View
          style={[
            styles.avatarPlaceholder,
            { width: avatarSize, height: avatarSize, backgroundColor: Colors.primary }
          ]}
        >
          <Text style={[styles.initial, { fontSize: fontSizes }]}>
            {initial}
          </Text>
        </View>
      )}
      
      {showStatus && (
        <View style={[
          styles.statusContainer,
          { 
            bottom: size === 'small' ? -2 : -4,
            right: size === 'small' ? -2 : -4
          }
        ]}>
          <UserStatusIndicator userId={userId} size={statusSize} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatar: {
    borderRadius: 100,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
  },
  initial: {
    color: 'white',
    fontWeight: 'bold',
  },
  statusContainer: {
    position: 'absolute',
    zIndex: 1,
    padding: 2,
    backgroundColor: 'white',
    borderRadius: 50,
  }
});

export default UserAvatar; 