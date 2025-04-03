export interface Membership {
  gardenId: string;
  userId: string;
  username: string;
  publicKey: string;
  profilePic: string;
  role: string;
  joinedAt: Date;
  banned: boolean;
  muted: boolean;
  kicked: boolean;
  bannedAt: Date;
  mutedAt: Date;
  kickedAt: Date;
}