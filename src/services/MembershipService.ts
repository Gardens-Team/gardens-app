import { Membership } from '../models/Memberships';
import { executeSql, executeSqlWrite } from '../utils/database';
import * as Crypto from 'expo-crypto';

/**
 * Get all members of a garden
 * @param gardenId Garden ID to get members for
 * @param includeBanned Whether to include banned members (default: false)
 */
export const getGardenMembers = async (
  gardenId: string, 
  includeBanned: boolean = false
): Promise<Membership[]> => {
  try {
    const query = includeBanned
      ? `SELECT * FROM memberships WHERE garden_id = ? AND kicked = 0 ORDER BY role, username`
      : `SELECT * FROM memberships WHERE garden_id = ? AND kicked = 0 AND banned = 0 ORDER BY role, username`;
    
    const rows = await executeSql<any>(query, [gardenId]);
    
    return rows.map((row: any) => ({
      gardenId: row.garden_id,
      userId: row.user_id,
      username: row.username,
      publicKey: row.public_key,
      profilePic: row.profile_pic || '',
      role: row.role,
      joinedAt: new Date(row.joined_at),
      banned: !!row.banned,
      muted: !!row.muted,
      kicked: !!row.kicked,
      bannedAt: row.banned_at ? new Date(row.banned_at) : new Date(0),
      mutedAt: row.muted_at ? new Date(row.muted_at) : new Date(0),
      kickedAt: row.kicked_at ? new Date(row.kicked_at) : new Date(0)
    }));
  } catch (error) {
    console.error('Error fetching garden members:', error);
    return [];
  }
};

/**
 * Add a new member to a garden
 */
export const addMember = async (
  membership: Omit<Membership, 'joinedAt' | 'bannedAt' | 'mutedAt' | 'kickedAt'>
): Promise<Membership> => {
  try {
    const now = Date.now();
    
    await executeSqlWrite(
      `INSERT INTO memberships (
        garden_id, user_id, username, public_key, profile_pic, role,
        banned, muted, kicked, joined_at, banned_at, muted_at, kicked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
      [
        membership.gardenId,
        membership.userId,
        membership.username,
        membership.publicKey,
        membership.profilePic || null,
        membership.role,
        membership.banned ? 1 : 0,
        membership.muted ? 1 : 0,
        membership.kicked ? 1 : 0,
        now
      ]
    );
    
    // Increment member count in gardens table
    await executeSqlWrite(
      `UPDATE gardens SET member_count = member_count + 1, updated_at = ? WHERE id = ?`,
      [now, membership.gardenId]
    );
    
    return {
      ...membership,
      joinedAt: new Date(now),
      bannedAt: new Date(0),
      mutedAt: new Date(0),
      kickedAt: new Date(0)
    };
  } catch (error) {
    console.error('Error adding garden member:', error);
    throw error;
  }
};

/**
 * Update a member's role
 */
export const updateMemberRole = async (
  gardenId: string,
  userId: string,
  role: string
): Promise<boolean> => {
  try {
    const now = Date.now();
    
    await executeSqlWrite(
      `UPDATE memberships SET role = ?, updated_at = ? WHERE garden_id = ? AND user_id = ?`,
      [role, now, gardenId, userId]
    );
    
    return true;
  } catch (error) {
    console.error('Error updating member role:', error);
    return false;
  }
};

/**
 * Remove a member from a garden
 */
export const removeMember = async (gardenId: string, userId: string): Promise<boolean> => {
  try {
    const now = Date.now();
    
    // First check if the member exists
    const rows = await executeSql<{ count: number }>(
      `SELECT COUNT(*) as count FROM memberships WHERE garden_id = ? AND user_id = ?`,
      [gardenId, userId]
    );
    
    if (rows[0].count === 0) {
      return false; // Member doesn't exist
    }
    
    // Delete the member
    await executeSqlWrite(
      `DELETE FROM memberships WHERE garden_id = ? AND user_id = ?`,
      [gardenId, userId]
    );
    
    // Decrement member count in gardens table
    await executeSqlWrite(
      `UPDATE gardens SET member_count = member_count - 1, updated_at = ? WHERE id = ?`,
      [now, gardenId]
    );
    
    return true;
  } catch (error) {
    console.error('Error removing garden member:', error);
    return false;
  }
};

/**
 * Ban a member from a garden
 */
export const banMember = async (gardenId: string, userId: string): Promise<boolean> => {
  try {
    const now = Date.now();
    
    await executeSqlWrite(
      `UPDATE memberships SET banned = 1, banned_at = ? WHERE garden_id = ? AND user_id = ?`,
      [now, gardenId, userId]
    );
    
    return true;
  } catch (error) {
    console.error('Error banning garden member:', error);
    return false;
  }
};

/**
 * Unban a member from a garden
 */
export const unbanMember = async (gardenId: string, userId: string): Promise<boolean> => {
  try {
    await executeSqlWrite(
      `UPDATE memberships SET banned = 0, banned_at = NULL WHERE garden_id = ? AND user_id = ?`,
      [gardenId, userId]
    );
    
    return true;
  } catch (error) {
    console.error('Error unbanning garden member:', error);
    return false;
  }
};

/**
 * Mute a member in a garden
 */
export const muteMember = async (gardenId: string, userId: string): Promise<boolean> => {
  try {
    const now = Date.now();
    
    await executeSqlWrite(
      `UPDATE memberships SET muted = 1, muted_at = ? WHERE garden_id = ? AND user_id = ?`,
      [now, gardenId, userId]
    );
    
    return true;
  } catch (error) {
    console.error('Error muting garden member:', error);
    return false;
  }
};

/**
 * Unmute a member in a garden
 */
export const unmuteMember = async (gardenId: string, userId: string): Promise<boolean> => {
  try {
    await executeSqlWrite(
      `UPDATE memberships SET muted = 0, muted_at = NULL WHERE garden_id = ? AND user_id = ?`,
      [gardenId, userId]
    );
    
    return true;
  } catch (error) {
    console.error('Error unmuting garden member:', error);
    return false;
  }
};

/**
 * Kick a member from a garden
 */
export const kickMember = async (gardenId: string, userId: string): Promise<boolean> => {
  try {
    const now = Date.now();
    
    await executeSqlWrite(
      `UPDATE memberships SET kicked = 1, kicked_at = ? WHERE garden_id = ? AND user_id = ?`,
      [now, gardenId, userId]
    );
    
    // Decrement member count in gardens table
    await executeSqlWrite(
      `UPDATE gardens SET member_count = member_count - 1, updated_at = ? WHERE id = ?`,
      [now, gardenId]
    );
    
    return true;
  } catch (error) {
    console.error('Error kicking garden member:', error);
    return false;
  }
};

/**
 * Check if a user is a member of a garden
 */
export const isGardenMember = async (gardenId: string, userId: string): Promise<boolean> => {
  try {
    const rows = await executeSql<{ count: number }>(
      `SELECT COUNT(*) as count FROM memberships 
       WHERE garden_id = ? AND user_id = ? AND kicked = 0 AND banned = 0`,
      [gardenId, userId]
    );
    
    return rows[0].count > 0;
  } catch (error) {
    console.error('Error checking garden membership:', error);
    return false;
  }
};

/**
 * Get a member's role in a garden
 */
export const getMemberRole = async (gardenId: string, userId: string): Promise<string | null> => {
  try {
    const rows = await executeSql<{ role: string }>(
      `SELECT role FROM memberships WHERE garden_id = ? AND user_id = ? AND kicked = 0`,
      [gardenId, userId]
    );
    
    return rows.length > 0 ? rows[0].role : null;
  } catch (error) {
    console.error('Error getting member role:', error);
    return null;
  }
};

/**
 * Get all gardens a user is a member of
 */
export const getUserGardens = async (userId: string): Promise<string[]> => {
  try {
    const rows = await executeSql<{ garden_id: string }>(
      `SELECT garden_id FROM memberships WHERE user_id = ? AND kicked = 0 AND banned = 0`,
      [userId]
    );
    
    return rows.map(row => row.garden_id);
  } catch (error) {
    console.error('Error getting user gardens:', error);
    return [];
  }
}; 