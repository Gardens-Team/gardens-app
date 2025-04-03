import { Channel } from '../models/Channel';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';

// Get the API URL for the worker
const getApiUrl = async (): Promise<string> => {
  return Constants.expoConfig?.extra?.WORKER_URL || 'https://gardens-api.crashoutpatterns.workers.dev';
};

// Helper for fetch with timeout
const fetchWithTimeout = async (
  resource: string,
  options: RequestInit = {},
  timeout = 8000
): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(id);
  return response;
};

/**
 * Get all channels for a garden
 */
export const getGardenChannels = async (gardenId: string): Promise<Channel[]> => {
  try {
    const baseUrl = await getApiUrl();
    const response = await fetchWithTimeout(`${baseUrl}/api/gardens/${gardenId}/channels`);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Server response:', error);
      return [];
    }
    
    const data = await response.json() as Array<{
      id: string;
      garden_id: string;
      name: string;
      description: string | null;
      is_administrative: number;
      created_at: number;
      updated_at: number;
    }>;
    
    return data.map((item): Channel => ({
      id: item.id,
      gardenId: item.garden_id,
      name: item.name,
      description: item.description || undefined,
      isAdministrative: Boolean(item.is_administrative),
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }));
  } catch (error) {
    console.error('Error fetching garden channels:', error);
    return [];
  }
};

/**
 * Get a channel by ID
 */
export const getChannelById = async (channelId: string): Promise<Channel | null> => {
  try {
    const baseUrl = await getApiUrl();
    const response = await fetchWithTimeout(`${baseUrl}/api/channels/${channelId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.text();
      console.error('Server response:', error);
      return null;
    }
    
    const item = await response.json() as {
      id: string;
      garden_id: string;
      name: string;
      description: string | null;
      is_administrative: number;
      created_at: number;
      updated_at: number;
    };
    
    return {
      id: item.id,
      gardenId: item.garden_id,
      name: item.name,
      description: item.description || undefined,
      isAdministrative: Boolean(item.is_administrative),
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    };
  } catch (error) {
    console.error('Error fetching channel:', error);
    return null;
  }
};

/**
 * Create a new channel in a garden
 */
export const createChannel = async (channel: Omit<Channel, 'id' | 'createdAt' | 'updatedAt'>): Promise<Channel> => {
  try {
    const channelId = Crypto.randomUUID();
    const baseUrl = await getApiUrl();
    
    const payload = {
      id: channelId,
      gardenId: channel.gardenId,
      name: channel.name,
      description: channel.description || '',
      isAdministrative: channel.isAdministrative || false
    };
    
    const response = await fetchWithTimeout(`${baseUrl}/api/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Server response:', error);
      throw new Error('Failed to create channel');
    }
    
    const createdChannel = await response.json() as Channel;
    return createdChannel;
  } catch (error) {
    console.error('Error creating channel:', error);
    throw error;
  }
}; 