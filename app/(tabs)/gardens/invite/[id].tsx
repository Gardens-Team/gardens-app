import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as GardenService from '../../../../src/services/GardenService';
import { useUserStore } from '../../../../app/contexts/UserStore';
import Colors from '../../../constants/Colors';

export default function GardenInviteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const user = useUserStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleInviteLink();
  }, [id, user]);

  const handleInviteLink = async () => {
    if (!id || !user) {
      setError('Invalid invite link or not logged in');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const garden = await GardenService.getGardenById(id as string);
      
      if (!garden) {
        setError('Garden not found');
        return;
      }

      // Try to join the garden
      const success = await GardenService.joinGarden(
        garden.id,
        user.id,
        user.username,
        user.publicKey,
        user.profilePic
      );

      if (success) {
        // Redirect to the garden page
        router.replace(`/gardens/${garden.id}`);
      } else {
        setError('Failed to join garden');
      }
    } catch (err) {
      console.error('Error handling invite:', err);
      setError('Failed to process invite');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Processing invite...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error || '#ff0000',
    textAlign: 'center',
  },
});
