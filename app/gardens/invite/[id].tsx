import { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Colors from '../../../app/constants/Colors';

const APP_STORE_URL = 'https://apps.apple.com/app/gardens/idXXXXXXXXXX';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.usegardens.app';

export default function WebInviteRedirect() {
  const { id } = useLocalSearchParams();

  useEffect(() => {
    handleRedirect();
  }, [id]);

  const handleRedirect = async () => {
    // Try to open the app with the deep link
    const deepLink = `gardens://gardens/invite/${id}`;
    const universalLink = `https://usegardens.app/gardens/invite/${id}`;

    try {
      // First try the deep link
      const supported = await Linking.canOpenURL(deepLink);
      if (supported) {
        await Linking.openURL(deepLink);
        return;
      }

      // Then try the universal link
      const universalSupported = await Linking.canOpenURL(universalLink);
      if (universalSupported) {
        await Linking.openURL(universalLink);
        return;
      }

      // If neither worked, redirect to app store
      if (Platform.OS === 'ios') {
        window.location.href = APP_STORE_URL;
      } else {
        window.location.href = PLAY_STORE_URL;
      }
    } catch (err) {
      console.error('Error redirecting:', err);
      // Fallback to app store
      if (Platform.OS === 'ios') {
        window.location.href = APP_STORE_URL;
      } else {
        window.location.href = PLAY_STORE_URL;
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Opening Gardens...</Text>
      <Text style={styles.subtitle}>
        If the app doesn't open automatically, please download it from your app store.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.inactive,
    textAlign: 'center',
    maxWidth: 300,
  },
}); 