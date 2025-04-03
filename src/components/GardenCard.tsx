// src/components/GardenCard.tsx
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Garden } from '../models/Garden';

interface GardenCardProps {
  garden: Garden;
}

export function GardenCard({ garden }: GardenCardProps) {
  const router = useRouter();

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/gardens/${garden.id}`)}
    >
      <Image
        source={{ 
          uri: garden.logoData || 
               garden.coverImageData || 
               garden.creatorProfilePic || 
               'https://placehold.co/600x400/png?text=Garden' 
        }}
        style={styles.image}
      />
      <View style={styles.content}>
        <Text style={styles.name}>{garden.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {garden.description}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.location}>
            {garden.city}, {garden.state}
          </Text>
          <View style={styles.tags}>
            {garden.tags?.slice(0, 3).map((tag) => (
              <Text key={tag} style={styles.tag}>
                #{tag}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  location: {
    fontSize: 14,
    color: '#666',
  },
  tags: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    fontSize: 14,
    color: '#0066cc',
  },
});