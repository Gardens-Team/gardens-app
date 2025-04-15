DROP TABLE users
DROP TABLE gardens


-- Identity table: tracks basic identity references (can be anonymous)
CREATE TABLE users (
  id TEXT PRIMARY KEY,            -- e.g. "identity:alice" or UUID
  display_name TEXT,              -- optional alias
  profile_pic BLOB,
  bio TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Devices registered to identities (MLS clients)
CREATE TABLE apps (
  id TEXT PRIMARY KEY,            -- device ID (e.g. UUIDv7)
  garden_id TEXT NOT NULL,      -- foreign key to identities
  url TEXT NOT NULL,
  token TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT NOT NULL, -- Identity of the group admin who added the application

  FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE CASCADE
);
-- Garden = group chat (MLS group)
CREATE TABLE gardens (
  id TEXT PRIMARY KEY,            -- group ID (e.g. UUID)
  name TEXT NOT NULL,
  creator_id TEXT NOT NULL,       -- identity who created the group
  mls_group_info BLOB,            -- optional: serialized MLS group info (encrypted)
  created_at TEXT DEFAULT (datetime('now')),
  topic_1 TEXT,
  topic_2 TEXT,
  topic_3 TEXT,
  topic_4 TEXT,
  topic_5 TEXT,
  FOREIGN KEY (creator_id) REFERENCES identities(id)
);

-- Posts made in a garden
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  garden_id TEXT NOT NULL,  
  poster_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE,
  FOREIGN KEY (poster_id) REFERENCES identities(id) ON DELETE CASCADE
);

-- Devices participating in a garden
CREATE TABLE memberships (
  id TEXT NOT NULL,
  garden_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  joined_at TEXT DEFAULT (datetime('now')),

  PRIMARY KEY (garden_id, device_id),
  FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Encrypted message entries
CREATE TABLE entries (
  id TEXT PRIMARY KEY,            -- entry ID (e.g. UUIDv7)
  garden_id TEXT NOT NULL,
  sender_device_id TEXT NOT NULL, -- device that sent the message
  ciphertext BLOB NOT NULL,       -- encrypted MLS message
  timestamp TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- 1:1 encrypted conversations (optional)
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,        -- sender identity
  recipient_id TEXT NOT NULL,     -- recipient identity
  ciphertext BLOB NOT NULL,
  timestamp TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (sender_id) REFERENCES identities(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES identities(id) ON DELETE CASCADE
);