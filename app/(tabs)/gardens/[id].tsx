import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserStore } from '../../../app/contexts/UserStore';
import * as GardenService from '../../../src/services/GardenService';
import * as ChannelService from '../../../src/services/ChannelService';
import { Garden } from '../../../src/models/Garden';
import { Channel } from '../../../src/models/Channel';
import CreateChannelModal from '../../../src/components/CreateChannelModal';

// Custom channel interface with last message info
interface ChannelWithLastMessage {
  id: string;
  name: string;
  description?: string;
  gardenId: string;
  isAdministrative: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: {
    content: string;
    sender: string;
    senderName: string;
    createdAt: Date;
  };
}

export default function GardenChannelsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const gardenId = params.id;
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const [garden, setGarden] = useState<Garden | null>(null);
  const [channels, setChannels] = useState<ChannelWithLastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateChannelModalVisible, setIsCreateChannelModalVisible] = useState(false);

  const loadData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      // Fetch real garden data
      if (!gardenId) {
        throw new Error('Garden ID is missing');
      }
      
      // Get garden details
      const gardenData = await GardenService.getGardenById(gardenId);
      if (!gardenData) {
        throw new Error('Garden not found');
      }
      setGarden(gardenData);
      
      // Get garden channels from ChannelService
      const channelsData = await ChannelService.getGardenChannels(gardenId);
      
      // Convert to ChannelWithLastMessage (no last message yet, will be implemented later)
      const channelsWithLastMessage: ChannelWithLastMessage[] = channelsData.map(channel => ({
        ...channel,
        lastMessage: undefined
      }));
      
      setChannels(channelsWithLastMessage);
      
    } catch (err) {
      console.error('Error loading garden data:', err);
      setError('Failed to load garden data. Pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [gardenId, user?.id]);
  
  const onRefresh = () => loadData(true);

  const navigateToChannel = (channel: ChannelWithLastMessage) => {
    router.push({
      pathname: `/gardens/channel/[id]`,
      params: { id: channel.id, gardenId: gardenId }
    });
  };

  const handleCreateChannel = (channel: Channel) => {
    setIsCreateChannelModalVisible(false);
    // Add the newly created channel to the channels list
    setChannels(prevChannels => [
      {
        ...channel,
        lastMessage: undefined
      },
      ...prevChannels
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Garden Header - Always show this */}
      <View style={styles.gardenHeader}>
        <View style={styles.gardenDetails}>
          <Image 
            source={{ uri: garden?.logoData || 'https://via.placeholder.com/60' }} 
            style={styles.gardenLogo} 
          />
          <View style={styles.gardenInfo}>
            <Text style={styles.gardenName}>{garden?.name || 'Garden'}</Text>
            <Text style={styles.gardenDescription}>{garden?.description || 'Loading details...'}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => router.push(`/gardens/${gardenId}/settings`)}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#666" />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading channels...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => loadData()}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={() => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Channels</Text>
            </View>
          )}
          renderItem={({ item: channel }) => (
            <TouchableOpacity 
              style={styles.channelItem}
              onPress={() => navigateToChannel(channel)}
            >
              <View style={styles.channelIconContainer}>
                {channel.isAdministrative ? (
                  <MaterialCommunityIcons name="bullhorn" size={24} color="#4CAF50" />
                ) : (
                  <Ionicons name="chatbubble-ellipses" size={24} color="#4CAF50" />
                )}
              </View>
              
              <View style={styles.channelContent}>
                <View style={styles.channelHeader}>
                  <Text style={styles.channelName}>{channel.name}</Text>
                  {channel.lastMessage && (
                    <Text style={styles.messageTime}>
                      {formatTimeAgo(channel.lastMessage.createdAt)}
                    </Text>
                  )}
                </View>
                
                {channel.lastMessage ? (
                  <View style={styles.messagePreview}>
                    <Text style={styles.messageSender}>
                      {channel.lastMessage.sender === user?.id ? 'You: ' : `${channel.lastMessage.senderName}: `}
                    </Text>
                    <Text style={styles.messageText} numberOfLines={1}>
                      {channel.lastMessage.content}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.noMessages}>No messages yet</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListFooterComponent={() => (
            <>
              {channels.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubbles-outline" size={60} color="#ccc" style={styles.emptyIcon} />
                  <Text style={styles.emptyText}>No channels yet</Text>
                  <Text style={styles.emptySubtext}>Create your first channel to start conversations</Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.createChannelButton}
                onPress={() => setIsCreateChannelModalVisible(true)}
              >
                <Ionicons name="add-circle" size={22} color="#fff" />
                <Text style={styles.createChannelText}>Create new channel</Text>
              </TouchableOpacity>
            </>
          )}
        />
      )}

      {/* Create Channel Modal */}
      <CreateChannelModal 
        visible={isCreateChannelModalVisible}
        onClose={() => setIsCreateChannelModalVisible(false)}
        onSuccess={handleCreateChannel}
        gardenId={gardenId || ''}
      />
    </View>
  );
}

// Helper function to format time
function formatTimeAgo(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  
  return `${Math.floor(diffDays / 7)}w`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  gardenHeader: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gardenDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gardenLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e0e0',
  },
  gardenInfo: {
    marginLeft: 16,
    flex: 1,
  },
  gardenName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  gardenDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  settingsButton: {
    padding: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  channelItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  channelIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelContent: {
    flex: 1,
    marginLeft: 16,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  channelName: {
    fontSize: 17,
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 12,
    color: '#888',
  },
  messagePreview: {
    flexDirection: 'row',
  },
  messageSender: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  messageText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  noMessages: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  createChannelButton: {
    margin: 16,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 24,
  },
  createChannelText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});