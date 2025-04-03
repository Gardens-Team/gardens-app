import { Message } from "./Message";
import { User } from "./User";
import { Channel } from "./Channel";

export interface Member {
  id: string;
  username: string;
  profilePic: string;
  role: MemberRole;
  joinedAt: Date;
}

export interface Garden {
  id: string;
  name: string;
  description: string;
  logoData?: string;
  latitude?: number;
  longitude?: number;
  city: string;
  state: string;
  coverImage?: string;
  coverImageData?: string;
  creator: string;
  creatorUsername: string;
  creatorProfilePic: string;
  visible: boolean;
  private?: boolean;
  oauthEnabled: boolean;
  oauthProviderId?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  memberCount?: number;
  channelCount?: number; // New property for channel count
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  channels?: Channel[]; // Optional property to store channels when needed
}

export enum MemberRole {
  MEMBER = 'member',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  FOUNDER = 'founder', // Original creator, can't be removed
}