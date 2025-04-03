import { Request } from '../models/Requests';
import { executeSql, executeSqlWrite } from '../utils/database';
import { addMember } from './MembershipService';
import * as Crypto from 'expo-crypto';

/**
 * Create a new join request for a garden
 */
export const createJoinRequest = async (request: Request): Promise<boolean> => {
  try {
    await executeSqlWrite(
      `INSERT INTO requests (garden_id, user_id, username, message)
       VALUES (?, ?, ?, ?)`,
      [request.gardenId, request.userId, request.username, request.message || null]
    );
    
    return true;
  } catch (error) {
    console.error('Error creating join request:', error);
    return false;
  }
};

/**
 * Get all join requests for a garden
 */
export const getGardenRequests = async (gardenId: string): Promise<Request[]> => {
  try {
    const rows = await executeSql<any>(
      `SELECT * FROM requests WHERE garden_id = ?`,
      [gardenId]
    );
    
    return rows.map((row: any) => ({
      gardenId: row.garden_id,
      userId: row.user_id,
      username: row.username,
      message: row.message || undefined
    }));
  } catch (error) {
    console.error('Error fetching garden requests:', error);
    return [];
  }
};

/**
 * Get all pending requests by a user
 */
export const getUserPendingRequests = async (userId: string): Promise<Request[]> => {
  try {
    const rows = await executeSql<any>(
      `SELECT * FROM requests WHERE user_id = ?`,
      [userId]
    );
    
    return rows.map((row: any) => ({
      gardenId: row.garden_id,
      userId: row.user_id,
      username: row.username,
      message: row.message || undefined
    }));
  } catch (error) {
    console.error('Error fetching user pending requests:', error);
    return [];
  }
};

/**
 * Check if a request exists
 */
export const checkRequestExists = async (gardenId: string, userId: string): Promise<boolean> => {
  try {
    const rows = await executeSql<{ count: number }>(
      `SELECT COUNT(*) as count FROM requests WHERE garden_id = ? AND user_id = ?`,
      [gardenId, userId]
    );
    
    return rows[0].count > 0;
  } catch (error) {
    console.error('Error checking request existence:', error);
    return false;
  }
};

/**
 * Approve a join request
 */
export const approveRequest = async (
  gardenId: string, 
  userId: string, 
  userDetails: { 
    username: string, 
    publicKey: string, 
    profilePic?: string 
  }
): Promise<boolean> => {
  try {
    // First check if the request exists
    const requestExists = await checkRequestExists(gardenId, userId);
    if (!requestExists) {
      console.error('Request does not exist');
      return false;
    }
    
    // Begin a transaction to ensure data consistency
    // Add the member
    await addMember({
      gardenId,
      userId,
      username: userDetails.username,
      publicKey: userDetails.publicKey,
      profilePic: userDetails.profilePic || '',
      role: 'member',
      banned: false,
      muted: false,
      kicked: false
    });
    
    // Delete the request
    await executeSqlWrite(
      `DELETE FROM requests WHERE garden_id = ? AND user_id = ?`,
      [gardenId, userId]
    );
    
    return true;
  } catch (error) {
    console.error('Error approving join request:', error);
    return false;
  }
};

/**
 * Reject a join request
 */
export const rejectRequest = async (gardenId: string, userId: string): Promise<boolean> => {
  try {
    // First check if the request exists
    const requestExists = await checkRequestExists(gardenId, userId);
    if (!requestExists) {
      console.error('Request does not exist');
      return false;
    }
    
    // Delete the request
    await executeSqlWrite(
      `DELETE FROM requests WHERE garden_id = ? AND user_id = ?`,
      [gardenId, userId]
    );
    
    return true;
  } catch (error) {
    console.error('Error rejecting join request:', error);
    return false;
  }
};

/**
 * Get the count of pending requests for a garden
 */
export const getGardenRequestCount = async (gardenId: string): Promise<number> => {
  try {
    const rows = await executeSql<{ count: number }>(
      `SELECT COUNT(*) as count FROM requests WHERE garden_id = ?`,
      [gardenId]
    );
    
    return rows[0].count;
  } catch (error) {
    console.error('Error getting garden request count:', error);
    return 0;
  }
};

/**
 * Batch approve multiple requests
 */
export const batchApproveRequests = async (
  gardenId: string,
  userIds: string[],
  userDetailsMap: { [userId: string]: { username: string, publicKey: string, profilePic?: string } }
): Promise<boolean> => {
  try {
    if (userIds.length === 0) return true;
    
    // Process each request
    for (const userId of userIds) {
      const userDetails = userDetailsMap[userId];
      if (!userDetails) {
        console.error(`User details not provided for user ID: ${userId}`);
        continue;
      }
      
      await approveRequest(gardenId, userId, userDetails);
    }
    
    return true;
  } catch (error) {
    console.error('Error batch approving requests:', error);
    return false;
  }
};

/**
 * Batch reject multiple requests
 */
export const batchRejectRequests = async (gardenId: string, userIds: string[]): Promise<boolean> => {
  try {
    if (userIds.length === 0) return true;
    
    // Use a single SQL query for better performance
    const placeholders = userIds.map(() => '?').join(',');
    await executeSqlWrite(
      `DELETE FROM requests WHERE garden_id = ? AND user_id IN (${placeholders})`,
      [gardenId, ...userIds]
    );
    
    return true;
  } catch (error) {
    console.error('Error batch rejecting requests:', error);
    return false;
  }
}; 