import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Define SQLite types based on Expo SQLite
interface SQLiteTransaction {
  executeSql: (
    sqlStatement: string,
    args?: any[],
    success?: (transaction: SQLiteTransaction, resultSet: SQLiteResultSet) => void,
    error?: (transaction: SQLiteTransaction, error: Error) => boolean
  ) => void;
}

interface SQLiteResultSet {
  insertId?: number;
  rowsAffected: number;
  rows: {
    length: number;
    item: (index: number) => any;
  };
}

/**
 * Get the database file path for iOS and Android
 */
export const getDatabasePath = async (): Promise<string> => {
  const dbName = 'gardens.db';
  
  if (Platform.OS === 'ios') {
    const documentDir = FileSystem.documentDirectory;
    const dirInfo = await FileSystem.getInfoAsync(`${documentDir}SQLite`);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(`${documentDir}SQLite`);
    }
    
    return `${documentDir}SQLite/${dbName}`;
  }
  
  // For Android, the SQLite.openDatabase function handles the path
  return dbName;
};

// Database instance cache
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Get the SQLite database instance, creating it if it doesn't exist
 */
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db !== null) return db;
  
  // Use openDatabaseAsync from Expo SQLite - new API
  db = await SQLite.openDatabaseAsync('gardens.db');
  
  return db;
};

/**
 * Initialize the database schema
 */
export const initDatabase = async (): Promise<void> => {
  const db = await getDatabase();
  
  // Use the new withExclusiveTransactionAsync method instead of transaction
  await db.execAsync(`
    -- Meta table for app settings
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY, 
      value TEXT NOT NULL
    );

    -- Users table for local user data and encryption keys
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      profile_pic TEXT,
      visible INTEGER NOT NULL DEFAULT 1,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      bio TEXT,
      location TEXT,
      email TEXT,
      phone TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- User presence table for local caching
    CREATE TABLE IF NOT EXISTS user_presence (
      user_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      last_active INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);
  
  console.log('Local database schema initialized successfully');
};

/**
 * Execute a SQL query with parameters
 */
export const executeSql = async <T>(
  sql: string,
  params: any[] = []
): Promise<T[]> => {
  const db = await getDatabase();
  return await db.getAllAsync(sql, params);
};

/**
 * Execute a SQL query that modifies data (insert, update, delete)
 */
export const executeSqlWrite = async (
  sql: string,
  params: any[] = []
): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(sql, params);
};

/**
 * Execute multiple SQL statements in a single transaction
 */
export const executeBatch = async (
  statements: { sql: string; params: any[] }[]
): Promise<void> => {
  const db = await getDatabase();
  
  await db.withExclusiveTransactionAsync(async () => {
    for (const { sql, params } of statements) {
      await db.runAsync(sql, params);
    }
  });
};

/**
 * Gets the current database size
 */
export const getDatabaseSize = async (): Promise<number> => {
  try {
    const path = await getDatabasePath();
    const fileInfo = await FileSystem.getInfoAsync(path);
    return fileInfo.exists ? fileInfo.size : 0;
  } catch (error) {
    console.error('Error getting database size:', error);
    return 0;
  }
};

/**
 * Clear all data from the database (for testing or account deletion)
 */
export const clearDatabase = async (): Promise<boolean> => {
  try {
    await executeBatch([
      { sql: 'DROP TABLE IF EXISTS user_presence', params: [] },
      { sql: 'DROP TABLE IF EXISTS users', params: [] },
      { sql: 'DROP TABLE IF EXISTS meta', params: [] }
    ]);
    
    // Reinitialize the database schema
    await initDatabase();
    
    return true;
  } catch (error) {
    console.error('Error clearing database:', error);
    return false;
  }
}; 