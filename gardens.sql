   DROP TABLE IF EXISTS gardens;
   DROP TABLE IF EXISTS requests;
   DROP TABLE IF EXISTS memberships;
   DROP TABLE IF EXISTS messages;
   DROP TABLE IF EXISTS channels;
   DROP TABLE IF EXISTS lockdowns;
   DROP TABLE IF EXISTS slow_modes;
   -- Gardens table
   CREATE TABLE gardens (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT,
     logoData BLOB,
     coverImageData BLOB,
     city TEXT NOT NULL,
     state TEXT NOT NULL,
     latitude REAL NULL,
     longitude REAL NULL,
     creator_id TEXT NOT NULL,
     creator_username TEXT NOT NULL,
     creator_profile_pic TEXT,
     visible INTEGER NOT NULL DEFAULT 1,
     is_private INTEGER NOT NULL DEFAULT 0,
     oauth_enabled INTEGER NOT NULL DEFAULT 0,
     oauth_provider_id TEXT,
     oauth_client_id TEXT,
     oauth_client_secret TEXT,
     tags TEXT, -- JSON array of strings
     member_count INTEGER DEFAULT 0,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );

-- Garden members table
CREATE TABLE requests (
  garden_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NULL,
  PRIMARY KEY (garden_id, user_id),
  FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE
);
   -- Garden members table
CREATE TABLE memberships (
  garden_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  public_key TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('member', 'moderator', 'admin', 'founder')),
  banned INTEGER NOT NULL DEFAULT 0, -- SQLite boolean (0 = false, 1 = true)
  muted INTEGER NOT NULL DEFAULT 0, -- SQLite boolean (0 = false, 1 = true)
  kicked INTEGER NOT NULL DEFAULT 0, -- SQLite boolean (0 = false, 1 = true)
  joined_at INTEGER NOT NULL,
  banned_at INTEGER NULL,
  kicked_at INTEGER NULL,
  muted_at INTEGER NULL,
  PRIMARY KEY (garden_id, user_id),
  FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  recipient TEXT,
  garden TEXT,
  channel_id TEXT REFERENCES channels(id),
  content TEXT NOT NULL, -- encrypted content
  content_type TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  public_key TEXT NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  read INTEGER NOT NULL DEFAULT 0,
  self_destruct_enabled INTEGER NOT NULL DEFAULT 0,
  self_destruct_at INTEGER, -- timestamp when message should be deleted
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  reply_to_id TEXT,   
  FOREIGN KEY(reply_to_id) REFERENCES messages(id)
);

-- Add Channels table
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  garden_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_administrative INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE
);

-- Add Channels table
CREATE TABLE lockdowns (
  id TEXT PRIMARY KEY,
  garden_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE slow_modes (
  id TEXT PRIMARY KEY,
  garden_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  delay INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);