import { User } from '../models/User';
import { Garden } from '../models/Garden';
import { executeSql, executeSqlWrite } from '../utils/database';
import * as Crypto from 'expo-crypto';
import { getPublicKeyForSharing } from '../utils/encryption';

/**
 * Get a user by ID
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const rows = await executeSql<any>(
      `SELECT * FROM users WHERE id = ?`,
      [userId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    const user = rows[0];
    return {
      id: user.id as string,
      username: user.username as string,
      publicKey: user.public_key as string,
      profilePic: user.profile_pic as string || undefined,
      visible: !!user.visible,
      createdAt: new Date(user.created_at as number),
      updatedAt: new Date(user.updated_at as number)
    };
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    throw error;
  }
};

/**
 * Get mutual gardens between two users
 */
export const getUserMutualGardens = async (userId1: string, userId2: string): Promise<Garden[]> => {
  try {
    const rows = await executeSql<any>(
      `SELECT g.* FROM gardens g
            JOIN garden_members m1 ON g.id = m1.garden_id
            JOIN garden_members m2 ON g.id = m2.garden_id
            WHERE m1.user_id = ? AND m1.status = 'active'
            AND m2.user_id = ? AND m2.status = 'active'
            ORDER BY g.updated_at DESC`,
      [userId1, userId2]
    );
    
    if (rows.length === 0) {
      return [];
    }
    
    // Process each garden
    return rows.map((row: any) => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      city: row.city as string || '',
      state: row.state as string || '',
      coverImage: row.cover_image as string || '',
      creator: row.creator_id as string,
      creatorUsername: row.creator_username as string,
      creatorProfilePic: row.creator_profile_pic as string || '',
      visible: true,
      private: !!row.is_private,
      oauthEnabled: !!row.oauth_enabled,
      oauthProviderId: row.oauth_provider_id as string || undefined,
      oauthClientId: row.oauth_client_id as string || undefined,
      oauthClientSecret: row.oauth_client_secret as string || undefined,
      memberCount: 0, // Default value
      createdAt: new Date(row.created_at as number),
      updatedAt: new Date(row.updated_at as number)
    }));
  } catch (error) {
    console.error('Error fetching mutual gardens:', error);
    // Return empty array as fallback
    return [];
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<{ username: string; profilePic: string; visible: boolean }>
): Promise<User> => {
  try {
    const now = Date.now();
    const setValues: string[] = [];
    const args: any[] = [];
    
    if (updates.username !== undefined) {
      setValues.push('username = ?');
      args.push(updates.username);
    }
    
    if (updates.profilePic !== undefined) {
      setValues.push('profile_pic = ?');
      args.push(updates.profilePic);
    }
    
    if (updates.visible !== undefined) {
      setValues.push('visible = ?');
      args.push(updates.visible ? 1 : 0);
    }
    
    setValues.push('updated_at = ?');
    args.push(now);
    
    // Add userId at the end for WHERE clause
    args.push(userId);
    
    if (setValues.length > 1) { // at least one real update, plus updated_at
      await executeSqlWrite(
        `UPDATE users SET ${setValues.join(', ')} WHERE id = ?`,
        args
      );
    }
    
    // Fetch the updated user
    return await getUserById(userId) as User;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Search for users
 */
export const searchUsers = async (query: string): Promise<User[]> => {
  try {
    const rows = await executeSql<any>(
      `SELECT * FROM users WHERE username LIKE ? LIMIT 20`,
      [`%${query}%`]
    );
    
    return rows.map((user: any) => ({
      id: user.id as string,
      username: user.username as string,
      profilePic: user.profile_pic as string || undefined,
      publicKey: user.public_key as string,
      visible: !!user.visible,
      createdAt: new Date(user.created_at as number),
      updatedAt: new Date(user.updated_at as number)
    }));
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

/**
 * Create a new user
 */
export const createUser = async (username: string, profilePic?: string): Promise<User> => {
  try {
    const userId = Crypto.randomUUID();
    const now = Date.now();
    const publicKey = await getPublicKeyForSharing();
    
    await executeSqlWrite(
      `INSERT INTO users (id, username, profile_pic, public_key, visible, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, profilePic || null, publicKey, 1, now, now]
    );
    
    const newUser: User = {
      id: userId,
      username,
      profilePic,
      publicKey: publicKey as string,
      visible: true,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
    
    return newUser;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Get all users (for testing/admin purposes)
 */
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const rows = await executeSql<any>(
      `SELECT * FROM users ORDER BY username`
    );
    
    return rows.map((user: any) => ({
      id: user.id as string,
      username: user.username as string,
      publicKey: user.public_key as string,
      profilePic: user.profile_pic as string || undefined,
      visible: !!user.visible,
      createdAt: new Date(user.created_at as number),
      updatedAt: new Date(user.updated_at as number)
    }));
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
};

/**
 * Delete a user account
 */
export const deleteUser = async (userId: string): Promise<boolean> => {
  try {
    await executeSqlWrite(
      `DELETE FROM users WHERE id = ?`,
      [userId]
    );
    
    // Delete related data
    await executeSqlWrite(
      `DELETE FROM messages WHERE sender = ? OR recipient = ?`,
      [userId, userId]
    );
    
    await executeSqlWrite(
      `DELETE FROM chats WHERE user_id_1 = ? OR user_id_2 = ?`,
      [userId, userId]
    );
    
    // Delete from gardens, garden_members, etc. would go here
    
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}; 