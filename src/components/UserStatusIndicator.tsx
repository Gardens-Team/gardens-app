import React from 'react';
import { View, StyleSheet } from 'react-native';
import { usePresence } from '../contexts/PresenceContext';
import { UserStatus } from '../services/PresenceService';

interface UserStatusIndicatorProps {
  userId: string;
  size?: 'small' | 'medium' | 'large';
}

export const UserStatusIndicator: React.FC<UserStatusIndicatorProps> = ({ 
  userId, 
  size = 'medium' 
}) => {
  const { getUserStatus } = usePresence();
  const status = getUserStatus(userId);

  if (!status) return null;

  const indicatorSize = {
    small: 8,
    medium: 12,
    large: 16
  }[size];

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'online':
        return '#4CAF50'; // Green
      case 'away':
        return '#FFC107'; // Yellow/Amber
      case 'offline':
        return '#9E9E9E'; // Grey
      default:
        return '#9E9E9E'; // Grey
    }
  };

  return (
    <View 
      style={[
        styles.indicator, 
        { 
          width: indicatorSize, 
          height: indicatorSize, 
          backgroundColor: getStatusColor(status) 
        }
      ]} 
    />
  );
};

const styles = StyleSheet.create({
  indicator: {
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: 'white',
  }
});

export default UserStatusIndicator; 