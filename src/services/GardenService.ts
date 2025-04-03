// src/services/GardenService.ts
import { Garden as DiscoverGarden, Garden } from '../models/Garden';
import { Message, MessageContentType } from '../models/Message';
import Constants from 'expo-constants';
import { fetch } from 'expo/fetch';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

const WORKER_URL = Constants.expoConfig?.extra?.WORKER_URL || 'https://gardens-api.jdbohrman.workers.dev';

const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Accept-Encoding': 'identity'
};

const DEFAULT_TIMEOUT = 15000; // 15 seconds

async function getApiUrl() {
  return WORKER_URL;
}

async function fetchWithTimeout(url: string, options: any = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error?.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

async function getBase64FromUri(uri: string): Promise<string> {
  try {
    console.log('Getting base64 from URI:', uri);
    
    // For data URIs that are already in base64 format
    if (uri.startsWith('data:')) {
      console.log('URI is a data URI, extracting base64 part');
      const base64Match = uri.match(/;base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Invalid data URI format');
      }
      return base64Match[1];
    }
    
    let localUri = uri;
    
    // For remote URLs, download first to a local file
    if (uri.startsWith('http')) {
      console.log('Downloading remote URI to local file');
      const tempFilePath = FileSystem.documentDirectory + 'temp_image_' + Date.now();
      const downloadResult = await FileSystem.downloadAsync(uri, tempFilePath);
      
      if (downloadResult.status !== 200) {
        throw new Error(`Failed to download image, status: ${downloadResult.status}`);
      }
      
      localUri = downloadResult.uri;
      console.log('Downloaded to local path:', localUri);
    }
    
    // For local files, read directly
    console.log('Reading file as base64:', localUri);
    try {
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (!fileInfo.exists) {
        throw new Error(`File does not exist: ${localUri}`);
      }
      
      console.log('File exists, size:', fileInfo.size);
      
      // Use readAsStringAsync with Base64 encoding
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      console.log('Successfully read file as base64, length:', base64.length);
      return base64;
    } catch (readError) {
      console.error('Error reading file:', readError);
      throw readError;
    }
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

export async function createGarden(gardenData: Omit<Garden, 'id' | 'createdAt' | 'updatedAt' | 'members' | 'pendingMembers' | 'bannedMembers' | 'messages'> & { 
  logoData?: string | null,
  creator?: string,
  creatorUsername?: string,
  creatorProfilePic?: string,
  creatorPublicKey?: string
}): Promise<Garden> {
  try {
    // Extract logo and creator data from the input
    const { logoData, creator, creatorUsername, creatorProfilePic, creatorPublicKey, ...restData } = gardenData;
    
    // Generate garden ID client-side
    const gardenId = Crypto.randomUUID();
    
    let base64Logo = null;
    let logoImageData = null;
    
    // If we have a logo, convert it to base64
    if (logoData) {
      try {
        console.log('Processing logo from URI:', logoData);
        base64Logo = await getBase64FromUri(logoData);
        console.log('Successfully converted image to base64');
        
        // Check if the base64 data is too large (most APIs have a ~10MB limit)
        if (base64Logo.length > 5000000) { // ~5MB limit for base64 data
          console.warn('Base64 image is too large:', base64Logo.length, 'bytes. Truncating...');
          // For now, we'll just truncate it as a fallback
          base64Logo = base64Logo.substring(0, 5000000);
        }
        
        // Create the full data URI
        const fileExtension = logoData?.split('.').pop() || 'jpeg';
        logoImageData = `data:image/${fileExtension};base64,${base64Logo}`;
        
        console.log('Base64 image size:', base64Logo.length, 'bytes');
      } catch (error) {
        console.error('Error processing logo:', error);
        // Continue without the logo if there's an error
        base64Logo = null;
        logoImageData = null;
      }
    }
    
    // Create the request body - match field names expected by the backend
    const requestBody = {
      ...restData,
      id: gardenId,
      logoData: logoImageData,
      city: restData.city || '',
      state: restData.state || '',
      visible: restData.visible !== false, // default to true
      private: restData.private === true,  // default to false
      // Add creator information for founding membership
      creator: creator || '',
      creatorUsername: creatorUsername || '',
      creatorProfilePic: creatorProfilePic || '',
      creatorPublicKey: creatorPublicKey || ''
    };
    
    console.log('Sending create garden request to API:', `${WORKER_URL}/api/gardens`);
    console.log('Garden data:', {
      ...requestBody,
      // Don't log the full base64 string
      logoData: base64Logo ? `[base64 data - ${base64Logo.length} bytes]` : null
    });
    
    // Create garden with pre-generated ID and include base64 image directly
    let response;
    try {
      response = await fetchWithTimeout(`${WORKER_URL}/api/gardens`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: DEFAULT_HEADERS
      });
      
      console.log('API response status:', response.status);
    } catch (fetchError: any) {
      console.error('Network error during API request:', fetchError);
      throw new Error(`Network error: ${fetchError.message}`);
    }
    
    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not read error response';
      }
      
      console.error('Server error response:', errorText);
      throw new Error(`Failed to create garden: ${errorText}`);
    }
    
    // Parse garden response
    let garden;
    try {
      garden = await response.json();
      if (garden && garden.id) {
        console.log('Successfully created garden with ID:', garden.id);
        
        // Check if we received a founding membership
        if (garden.founderMembership) {
          console.log('Garden includes founding membership');
        }
      } else {
        console.warn('Garden created but response was incomplete:', garden);
        // Use our local data as fallback
        garden = { 
          id: gardenId, 
          ...restData,
          logoData: logoImageData,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
    } catch (e) {
      console.warn('Could not parse garden response as JSON:', e);
      garden = { 
        id: gardenId, 
        ...restData,
        logoData: logoImageData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    return garden;
  } catch (error) {
    console.error('Error creating garden:', error);
    throw error;
  }
}

export interface GardenMembership {
  garden_id: string;
  user_id: string;
  username: string;
  public_key: string;
  profile_pic?: string;
  role: 'member' | 'moderator' | 'admin' | 'founder';
  banned: boolean;
  muted: boolean;
  kicked: boolean;
  joined_at: Date;
  banned_at?: Date;
  kicked_at?: Date;
  muted_at?: Date;
}

export async function getDiscoverGardens(searchTerm?: string): Promise<DiscoverGarden[]> {
  try {
    const baseUrl = await getApiUrl();
    const url = new URL(`${baseUrl}/api/gardens`);
    if (searchTerm) {
      url.searchParams.set('search', searchTerm);
    }
    
    console.log('Fetching gardens from:', url.toString());
    
    const response = await fetchWithTimeout(url.toString());
    if (!response.ok) {
      const error = await response.text();
      console.error('Server response:', error);
      throw new Error(`Failed to fetch gardens: ${error}`);
    }

    const gardens = await response.json() as DiscoverGarden[];
    return gardens.map((garden: DiscoverGarden) => ({
      id: garden.id,
      name: garden.name,
      description: garden.description,
      logoData: garden.logoData,
      creator: garden.creator,
      creatorUsername: garden.creatorUsername,
      creatorProfilePic: garden.creatorProfilePic,
      coverImageData: garden.coverImageData,
      city: garden.city,
      state: garden.state,
      latitude: garden.latitude,
      longitude: garden.longitude,
      tags: garden.tags,
      visible: Boolean(garden.visible),
      private: Boolean(garden.private),
      oauthEnabled: garden.oauthEnabled,
      oauthProviderId: garden.oauthProviderId,
      oauthClientId: garden.oauthClientId,
      oauthClientSecret: garden.oauthClientSecret,
      createdAt: new Date(garden.createdAt),
      updatedAt: new Date(garden.updatedAt),
      memberCount: garden.memberCount || 0
    }));
  } catch (error) {
    console.error('Error fetching gardens:', error);
    throw error;
  }
}

export async function getGardenMembers(gardenId: string): Promise<GardenMembership[]> {
  try {
    const baseUrl = await getApiUrl();
    const response = await fetchWithTimeout(`${baseUrl}/api/gardens/${gardenId}/members`);
    if (!response.ok) return [];
    
    const members = await response.json();
    return members.map((member: any) => ({
      ...member,
      banned: Boolean(member.banned),
      muted: Boolean(member.muted),
      kicked: Boolean(member.kicked),
      joined_at: new Date(member.joined_at),
      banned_at: member.banned_at ? new Date(member.banned_at) : undefined,
      kicked_at: member.kicked_at ? new Date(member.kicked_at) : undefined,
      muted_at: member.muted_at ? new Date(member.muted_at) : undefined
    }));
  } catch (error) {
    console.error('Error fetching garden members:', error);
    return [];
  }
}

export async function updateMemberStatus(
  gardenId: string, 
  userId: string, 
  status: { 
    banned?: boolean; 
    muted?: boolean; 
    kicked?: boolean; 
    role?: 'member' | 'moderator' | 'admin' | 'founder'
  }
): Promise<boolean> {
  try {
    const baseUrl = await getApiUrl();
    const response = await fetchWithTimeout(`${baseUrl}/api/gardens/${gardenId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(status)
    });
    return response.ok;
  } catch (error) {
    console.error('Error updating member status:', error);
    return false;
  }
}

export async function approveMember(gardenId: string, requesterId: string, approverId: string): Promise<boolean> {
  try {
    const baseUrl = await getApiUrl();
    const response = await fetchWithTimeout(`${baseUrl}/api/gardens/pending/${gardenId}/${requesterId}`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'approve', approverId })
    });
    return response.ok;
  } catch (error) {
    console.error('Error approving member:', error);
    return false;
  }
}

export async function rejectMember(gardenId: string, requesterId: string, rejecterId: string): Promise<boolean> {
  try {
    const baseUrl = await getApiUrl();
    const response = await fetchWithTimeout(`${baseUrl}/api/gardens/pending/${gardenId}/${requesterId}`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'deny', rejecterId })
    });
    return response.ok;
  } catch (error) {
    console.error('Error rejecting member:', error);
    return false;
  }
}

export async function sendWelcomeMessage(gardenId: string, userId: string): Promise<void> {
  try {
    const baseUrl = await getApiUrl();
    await fetchWithTimeout(`${baseUrl}/api/gardens/members/${gardenId}/${userId}/welcome`, {
      method: 'POST'
    });
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }
}

export async function getGardenById(id: string): Promise<Garden | null> {
  try {
    const baseUrl = await getApiUrl();
    const response = await fetchWithTimeout(`${baseUrl}/api/gardens/${id}`);
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Error fetching garden:', error);
    return null;
  }
}

export async function getGardenMessages(gardenId: string): Promise<Message[]> {
  try {
    const baseUrl = await getApiUrl();
    const response = await fetchWithTimeout(`${baseUrl}/api/gardens/${gardenId}/messages`);
    if (!response.ok) {
      const error = await response.text();
      console.error('Server response:', error);
      return [];
    }
    const data = (await response.json()) as Array<{
      id: string;
      sender: string;
      content: string;
      contentType: MessageContentType;
      selfDestruct: {
        enabled: boolean;
        duration: '5m' | '30m' | '1h' | '1d' | '1w';
      };
      createdAt: string;
      updatedAt: string;
    }>;
    return data.map((msg): Message => ({
      id: msg.id,
      sender: msg.sender,
      content: msg.content,
      contentType: msg.contentType,
      sent: true,
      delivered: true,
      read: false,
      selfDestructEnabled: msg.selfDestruct.enabled,
      selfDestructAt: new Date(msg.selfDestruct.duration),
      createdAt: new Date(msg.createdAt),
      updatedAt: new Date(msg.updatedAt),
      garden: gardenId
    }));
  } catch (error) {
    console.error('Error fetching garden messages:', error);
    return [];
  }
}

export async function sendGardenMessage(gardenId: string, message: Partial<Message>): Promise<Message> {
  try {
    const baseUrl = await getApiUrl();
    const response = await fetchWithTimeout(`${baseUrl}/api/gardens/${gardenId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message)
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('Server response:', error);
      throw new Error(`Failed to send message: ${error}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error sending garden message:', error);
    throw error;
  }
}

export async function joinGarden(
  gardenId: string, 
  userId: string, 
  username: string, 
  publicKey: string,
  profilePic?: string
): Promise<boolean> {
  try {
    const baseUrl = await getApiUrl();
    const response = await fetchWithTimeout(`${baseUrl}/api/gardens/${gardenId}/join`, {
      method: 'POST',
      body: JSON.stringify({ 
        userId, 
        username, 
        publicKey,
        profilePic 
      })
    });
    return response.ok;
  } catch (error) {
    console.error('Error joining garden:', error);
    return false;
  }
}

export function generateInviteLink(gardenId: string, type: 'universal' | 'app' = 'universal'): string {
  if (type === 'universal') {
    // Universal link (works on web and opens app if installed)
    return `https://usegardens.app/gardens/invite/${gardenId}`;
  } else {
    // Deep link (opens app directly)
    return `gardens://gardens/invite/${gardenId}`;
  }
}