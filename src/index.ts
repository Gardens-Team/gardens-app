// src/index.ts
import { fetch } from 'expo/fetch';

export interface Env {
    DB: D1Database;
  }
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  
  export default {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;
  
      // Handle CORS preflight requests
      if (method === "OPTIONS") {
        return new Response(null, {
          headers: corsHeaders
        });
      }
  
      // Run migrations to ensure schema is up to date
      try {
        await ensureSchema(env.DB);
      } catch (error) {
        console.error('Schema migration error:', error);
        // Continue even if migrations fail - will only be an issue for new columns
      }
  
      // API routes
      try {
        // Gardens routes
        if (path.startsWith('/api/gardens')) {
          // Get garden by ID: /api/gardens/:id
          if (path.match(/^\/api\/gardens\/[^\/]+$/) && method === 'GET') {
            const gardenId = path.split('/')[3];
            return await getGardenById(env.DB, gardenId, corsHeaders);
          }
          
          // Get all gardens: /api/gardens
          if (path === '/api/gardens' && method === 'GET') {
            const searchTerm = url.searchParams.get('search') || '';
            const isPrivate = url.searchParams.get('private') === 'true';
            return await getGardens(env.DB, searchTerm, isPrivate, corsHeaders);
          }
          
          // Create garden: /api/gardens
          if (path === '/api/gardens' && method === 'POST') {
            return await createGarden(request, env.DB, corsHeaders);
          }
          
          // Get channels for a garden: /api/gardens/:id/channels
          if (path.match(/^\/api\/gardens\/[^\/]+\/channels$/) && method === 'GET') {
            const gardenId = path.split('/')[3];
            return await getGardenChannels(env.DB, gardenId, corsHeaders);
          }
          
          // Get messages for a garden: /api/gardens/:id/messages
          if (path.match(/^\/api\/gardens\/[^\/]+\/messages$/) && method === 'GET') {
            const gardenId = path.split('/')[3];
            const channelId = url.searchParams.get('channelId');
            return await getGardenMessages(env.DB, gardenId, channelId, corsHeaders);
          }
          
          // Send message to a garden: /api/gardens/:id/messages
          if (path.match(/^\/api\/gardens\/[^\/]+\/messages$/) && method === 'POST') {
            const gardenId = path.split('/')[3];
            return await sendGardenMessage(request, env.DB, gardenId, corsHeaders);
          }
          
          // Garden members routes: /api/gardens/members
          if (path.startsWith('/api/gardens/members')) {
            // Add member: /api/gardens/members
            if (path === '/api/gardens/members' && method === 'POST') {
              return await addGardenMember(request, env.DB, corsHeaders);
            }
            
            // Get garden members: /api/gardens/members/:gardenId
            if (path.match(/^\/api\/gardens\/members\/[^\/]+$/) && method === 'GET') {
              const gardenId = path.split('/')[4];
              return await getGardenMembers(env.DB, gardenId, corsHeaders);
            }
            
            // Remove member: /api/gardens/members/:gardenId/:userId
            if (path.match(/^\/api\/gardens\/members\/[^\/]+\/[^\/]+$/) && method === 'DELETE') {
              const parts = path.split('/');
              const gardenId = parts[4];
              const userId = parts[5];
              return await removeGardenMember(env.DB, gardenId, userId, corsHeaders);
            }
          }
          
          // Pending members routes: /api/gardens/pending
          if (path.startsWith('/api/gardens/pending')) {
            // Request to join: /api/gardens/pending
            if (path === '/api/gardens/pending' && method === 'POST') {
              return await requestToJoinGarden(request, env.DB, corsHeaders);
            }
            
            // Get pending members: /api/gardens/pending/:gardenId
            if (path.match(/^\/api\/gardens\/pending\/[^\/]+$/) && method === 'GET') {
              const gardenId = path.split('/')[4];
              return await getPendingMembers(env.DB, gardenId, corsHeaders);
            }
            
            // Approve/deny request: /api/gardens/pending/:gardenId/:userId
            if (path.match(/^\/api\/gardens\/pending\/[^\/]+\/[^\/]+$/) && method === 'PUT') {
              const parts = path.split('/');
              const gardenId = parts[4];
              const userId = parts[5];
              return await handleMembershipRequest(request, env.DB, gardenId, userId, corsHeaders);
            }
          }
          
          // Banned members routes: /api/gardens/banned
          if (path.startsWith('/api/gardens/banned')) {
            // Ban member: /api/gardens/banned
            if (path === '/api/gardens/banned' && method === 'POST') {
              return await banGardenMember(request, env.DB, corsHeaders);
            }
            
            // Unban member: /api/gardens/banned/:gardenId/:userId
            if (path.match(/^\/api\/gardens\/banned\/[^\/]+\/[^\/]+$/) && method === 'DELETE') {
              const parts = path.split('/');
              const gardenId = parts[4];
              const userId = parts[5];
              return await unbanGardenMember(env.DB, gardenId, userId, corsHeaders);
            }
          }
        }
  
        // Channel-specific routes
        else if (path.startsWith('/api/channels')) {
          // Get channel by ID: /api/channels/:id
          if (path.match(/^\/api\/channels\/[^\/]+$/) && method === 'GET') {
            const channelId = path.split('/')[3];
            return await getChannelById(env.DB, channelId, corsHeaders);
          }
          
          // Create channel: /api/channels
          if (path === '/api/channels' && method === 'POST') {
            return await createChannel(request, env.DB, corsHeaders);
          }
        }
  
        // Route not found
        return new Response(JSON.stringify({ error: 'Route not found' }), {
          status: 404,
          headers: corsHeaders
        });
      } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: (error as Error).message || 'An error occurred' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    },

    // Add the scheduled task handler
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
      // Run cleanup every hour
      if (event.cron === "0 * * * *") {
        const now = Date.now();
        
        try {
          // Directly delete messages that have passed their self-destruct time
          await env.DB.prepare(`
            DELETE FROM messages 
            WHERE self_destruct_enabled = 1 
              AND self_destruct_at <= ?
          `).bind(now).run();
          
          // Log the cleanup operation
          console.log('Successfully cleaned up expired self-destructing messages');
        } catch (error) {
          console.error('Error cleaning up expired messages:', error);
        }
      }
    }
  };
  
  // ----- Garden Handlers -----
  
  async function getGardenById(db: D1Database, gardenId: string, headers: any): Promise<Response> {
    // Get garden details
    const garden = await db.prepare(`
      SELECT * FROM gardens WHERE id = ?
    `).bind(gardenId).first();
    
    if (!garden) {
      return new Response(JSON.stringify({ error: 'Garden not found' }), {
        status: 404,
        headers
      });
    }
    
    // Format data for consistent field naming between client and server
    const formattedGarden = {
      ...garden,
      // Map logoUri from database to logoData for the frontend
      logoData: garden.logoData,
      // Convert tags to array
      tags: garden.tags ? JSON.parse(garden.tags as string) : [],
      // Map other fields with consistent naming
      creatorUsername: garden.creator_username,
      creatorProfilePic: garden.creator_profile_pic,
      oauthEnabled: Boolean(garden.oauth_enabled),
      oauthProviderId: garden.oauth_provider_id,
      oauthClientId: garden.oauth_client_id,
      oauthClientSecret: garden.oauth_client_secret,
      visible: Boolean(garden.visible),
      private: Boolean(garden.is_private)
    };
    
    return new Response(JSON.stringify(formattedGarden), {
      headers
    });
  }
  
  async function getGardens(db: D1Database, searchTerm: string, isPrivate: boolean, headers: any): Promise<Response> {
    let query = `SELECT * FROM gardens WHERE visible = 1`;
    const params: any[] = [];
    
    if (isPrivate) {
      query += ` AND is_private = 1`;
    }
    
    if (searchTerm) {
      query += ` AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)`;
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const { results } = await db.prepare(query).bind(...params).all();
    
    // Format tags from string to array for each garden
    const gardensWithTags = results.map((garden: any) => ({
      ...garden,
      // Map logoUri from database to logoData for the frontend
      logoData: garden.logoData,
      // Convert tags string to array
      tags: garden.tags ? JSON.parse(garden.tags as string) : [],
      // Map other fields with consistent naming
      creatorUsername: garden.creator_username,
      creatorProfilePic: garden.creator_profile_pic,
      oauthEnabled: Boolean(garden.oauth_enabled),
      oauthProviderId: garden.oauth_provider_id,
      oauthClientId: garden.oauth_client_id,
      oauthClientSecret: garden.oauth_client_secret,
      visible: Boolean(garden.visible),
      private: Boolean(garden.is_private)
    }));
    
    return new Response(JSON.stringify(gardensWithTags), { headers });
  }
  
  async function createGarden(request: Request, db: D1Database, headers: any): Promise<Response> {
    try {
      const garden = await request.json() as {
        id: string;
        name: string;
        description?: string;
        logoData?: string;
        coverImageData?: string;
        city: string;
        state: string;
        latitude?: number;
        longitude?: number;
        creator?: string;
        creatorUsername?: string;
        creatorProfilePic?: string;
        creatorPublicKey?: string;
        visible?: boolean;
        private?: boolean;
        oauthEnabled?: boolean;
        oauthProviderId?: string;
        oauthClientId?: string;
        oauthClientSecret?: string;
        tags?: string[];
      };
      
      // Validate required fields
      if (!garden.id || !garden.name || !garden.city || !garden.state) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers
        });
      }

      // Prepare tags for storage (convert array to JSON string)
      const tagsJson = garden.tags ? JSON.stringify(garden.tags) : '[]';
      
      // Current timestamp
      const now = Date.now();
      
      // Determine which logo field to use
      const logoData = garden.logoData;
      
      // Use transaction to ensure both garden and founding membership are created
      await db.batch([
        // Create the garden
        db.prepare(`
          INSERT INTO gardens (
            id, name, description, logoData, coverImageData, city, state, latitude, longitude,
            creator_id, creator_username, creator_profile_pic, visible, is_private,
            oauth_enabled, oauth_provider_id, oauth_client_id, oauth_client_secret,
            tags, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          garden.id,
          garden.name,
          garden.description || '',
          logoData,
          garden.coverImageData || null,
          garden.city,
          garden.state,
          garden.latitude || null,
          garden.longitude || null,
          garden.creator || 'unknown',
          garden.creatorUsername || 'unknown',
          garden.creatorProfilePic || null,
          garden.visible ? 1 : 0,
          garden.private ? 1 : 0,
          garden.oauthEnabled ? 1 : 0,
          garden.oauthProviderId || null,
          garden.oauthClientId || null,
          garden.oauthClientSecret || null,
          tagsJson,
          now,
          now
        ),
        
        // Add the creator as founding member
        db.prepare(`
          INSERT INTO memberships (
            garden_id, user_id, username, public_key, role, 
            banned, muted, kicked, joined_at, banned_at, kicked_at, muted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          garden.id,
          garden.creator || 'unknown',
          garden.creatorUsername || 'unknown',
          garden.creatorPublicKey || '',
          'founder',  // Role is founder
          0,          // Not banned
          0,          // Not muted
          0,          // Not kicked
          now,        // Joined now
          null,       // Never banned
          null,       // Never kicked
          null        // Never muted
        )
      ]);
      
      console.log('Garden and founding membership created for garden ID:', garden.id);
      
      // Get the created garden 
      const createdGarden = await db.prepare(`
        SELECT * FROM gardens WHERE id = ?
      `).bind(garden.id).first();
      
      // If garden creation failed
      if (!createdGarden) {
        return new Response(JSON.stringify({ error: 'Failed to create garden' }), {
          status: 500,
          headers
        });
      }
      
      // Get the founding membership
      const foundingMembership = await db.prepare(`
        SELECT * FROM memberships WHERE garden_id = ? AND role = 'founder'
      `).bind(garden.id).first();
      
      // Format tags from string to array
      const formattedGarden = {
        ...createdGarden,
        tags: createdGarden.tags ? JSON.parse(createdGarden.tags as string) : [],
        founderMembership: foundingMembership ? {
          ...foundingMembership,
          banned: Boolean(foundingMembership.banned),
          muted: Boolean(foundingMembership.muted),
          kicked: Boolean(foundingMembership.kicked)
        } : null
      };
      
      return new Response(JSON.stringify(formattedGarden), {
        status: 201,
        headers
      });
    } catch (error) {
      console.error('Error creating garden:', error);
      return new Response(JSON.stringify({ error: 'Failed to create garden', details: (error as Error).message }), {
        status: 500,
        headers
      });
    }
  }
  
  async function addGardenMember(request: Request, db: D1Database, headers: any): Promise<Response> {
    // Implementation
    return new Response(JSON.stringify({success: true}), { headers });
  }
  
  async function getGardenMembers(db: D1Database, gardenId: string, headers: any): Promise<Response> {
    // Implementation
    return new Response(JSON.stringify([]), { headers });
  }
  
  async function removeGardenMember(db: D1Database, gardenId: string, userId: string, headers: any): Promise<Response> {
    // Implementation
    return new Response(JSON.stringify({success: true}), { headers });
  }
  
  async function requestToJoinGarden(request: Request, db: D1Database, headers: any): Promise<Response> {
    // Implementation
    return new Response(JSON.stringify({success: true}), { headers });
  }
  
  async function getPendingMembers(db: D1Database, gardenId: string, headers: any): Promise<Response> {
    // Implementation
    return new Response(JSON.stringify([]), { headers });
  }
  
  async function handleMembershipRequest(request: Request, db: D1Database, gardenId: string, userId: string, headers: any): Promise<Response> {
    // Implementation
    return new Response(JSON.stringify({success: true}), { headers });
  }
  
  async function banGardenMember(request: Request, db: D1Database, headers: any): Promise<Response> {
    // Implementation
    return new Response(JSON.stringify({success: true}), { headers });
  }
  
  async function unbanGardenMember(db: D1Database, gardenId: string, userId: string, headers: any): Promise<Response> {
    // Implementation
    return new Response(JSON.stringify({success: true}), { headers });
  }

  // ----- Garden Channels API -----

  // Add these new routes inside the if (path.startsWith('/api/gardens')) block
  // Get channels for a garden: /api/gardens/:id/channels
  async function getGardenChannels(db: D1Database, gardenId: string, headers: any): Promise<Response> {
    try {
      const { results } = await db.prepare(`
        SELECT * FROM channels WHERE garden_id = ? 
        ORDER BY is_administrative DESC, name ASC
      `).bind(gardenId).all();
      
      return new Response(JSON.stringify(results), { headers });
    } catch (error) {
      console.error('Error fetching garden channels:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch channels' }), {
        status: 500,
        headers
      });
    }
  }

  // Channel-specific routes
  async function getChannelById(db: D1Database, channelId: string, headers: any): Promise<Response> {
    try {
      const channel = await db.prepare(`
        SELECT * FROM channels WHERE id = ?
      `).bind(channelId).first();
      
      if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel not found' }), {
          status: 404,
          headers
        });
      }
      
      return new Response(JSON.stringify(channel), { headers });
    } catch (error) {
      console.error('Error fetching channel:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch channel' }), {
        status: 500,
        headers
      });
    }
  }

  async function createChannel(request: Request, db: D1Database, headers: any): Promise<Response> {
    try {
      const channel = await request.json() as {
        id: string;
        gardenId: string;
        name: string;
        description?: string;
        isAdministrative?: boolean;
      };
      
      // Validate required fields
      if (!channel.id || !channel.name || !channel.gardenId) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers
        });
      }
      
      // Current timestamp
      const now = Date.now();
      
      // Insert channel
      await db.prepare(`
        INSERT INTO channels (
          id, garden_id, name, description, is_administrative, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        channel.id,
        channel.gardenId,
        channel.name,
        channel.description || null,
        channel.isAdministrative ? 1 : 0,
        now,
        now
      ).run();
      
      // Get the created channel
      const createdChannel = await db.prepare(`
        SELECT * FROM channels WHERE id = ?
      `).bind(channel.id).first();
      
      if (!createdChannel) {
        return new Response(JSON.stringify({ error: 'Failed to create channel' }), {
          status: 500,
          headers
        });
      }
      
      // Format the response
      const formattedChannel = {
        id: createdChannel.id,
        gardenId: createdChannel.garden_id,
        name: createdChannel.name,
        description: createdChannel.description,
        isAdministrative: Boolean(createdChannel.is_administrative),
        createdAt: createdChannel.created_at,
        updatedAt: createdChannel.updated_at
      };
      
      return new Response(JSON.stringify(formattedChannel), {
        status: 201,
        headers
      });
    } catch (error) {
      console.error('Error creating channel:', error);
      return new Response(JSON.stringify({ error: 'Failed to create channel', details: (error as Error).message }), {
        status: 500,
        headers
      });
    }
  }

  // Function to ensure schema is up to date
  async function ensureSchema(db: D1Database) {
    try {
      // Check if channels table exists
      const tableExists = await db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='channels'
      `).first();

      // Create the channels table if it doesn't exist
      if (!tableExists) {
        await db.exec(`
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
          )
        `);
      } else {
        // Check if is_administrative column exists
        const columnExists = await db.prepare(`
          PRAGMA table_info(channels)
        `).all().then((result: any) => {
          const columns = result.results as Array<{name: string}>;
          return columns.some(col => col.name === 'is_administrative');
        });

        // Add the column if it doesn't exist
        if (!columnExists) {
          await db.exec(`
            ALTER TABLE channels ADD COLUMN is_administrative INTEGER NOT NULL DEFAULT 0
          `);
        }
      }
      
      // Check if messages table exists
      const messagesTableExists = await db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='messages'
      `).first();
      
      if (!messagesTableExists) {
        // Create messages table if it doesn't exist
        await db.exec(`
          CREATE TABLE messages (
            id TEXT PRIMARY KEY,
            sender TEXT NOT NULL,
            recipient TEXT,
            garden TEXT,
            channel_id TEXT,
            content TEXT NOT NULL,
            content_type TEXT NOT NULL,
            public_key TEXT,
            sent INTEGER NOT NULL DEFAULT 0,
            delivered INTEGER NOT NULL DEFAULT 0,
            read INTEGER NOT NULL DEFAULT 0,
            self_destruct_enabled INTEGER NOT NULL DEFAULT 0,
            self_destruct_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            reply_to_id TEXT,
            FOREIGN KEY (garden) REFERENCES gardens(id) ON DELETE CASCADE,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
          )
        `);
      } else {
        // Check if public_key column exists in messages table
        const publicKeyExists = await db.prepare(`
          PRAGMA table_info(messages)
        `).all().then((result: any) => {
          const columns = result.results as Array<{name: string}>;
          return columns.some(col => col.name === 'public_key');
        });
        
        // Add the column if it doesn't exist
        if (!publicKeyExists) {
          await db.exec(`
            ALTER TABLE messages ADD COLUMN public_key TEXT
          `);
        }
      }
      
    } catch (error) {
      console.error('Error in schema migration:', error);
      throw error;
    }
  }

  // ----- Message Handlers -----

  async function getGardenMessages(db: D1Database, gardenId: string, channelId: string | null, headers: any): Promise<Response> {
    try {
      let query = `
        SELECT m.id, m.sender, u.username as sender_username, m.garden, m.channel_id, 
               m.public_key, m.content, m.content_type, m.reply_to_id, m.created_at
        FROM messages m 
        LEFT JOIN memberships u ON m.sender = u.user_id AND m.garden = u.garden_id
        WHERE m.garden = ?
      `;
      
      const params: any[] = [gardenId];
      
      // If channelId is provided, filter by it
      if (channelId) {
        query += ` AND m.channel_id = ?`;
        params.push(channelId);
      }
      
      // Order by creation date, newest first
      query += ` ORDER BY m.created_at DESC LIMIT 100`;
      
      const { results } = await db.prepare(query).bind(...params).all();
      
      // Format the messages with only essential fields
      const formattedMessages = results.map((msg: any) => ({
        id: msg.id,
        sender: msg.sender,
        senderUsername: msg.sender_username || 'Unknown',
        garden: msg.garden,
        channelId: msg.channel_id,
        publicKey: msg.public_key,
        content: msg.content,
        contentType: msg.content_type,
        createdAt: msg.created_at,
        replyToId: msg.reply_to_id
      }));
      
      return new Response(JSON.stringify(formattedMessages), { headers });
      
    } catch (error) {
      console.error('Error fetching garden messages:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch messages' }), {
        status: 500,
        headers
      });
    }
  }

  async function sendGardenMessage(request: Request, db: D1Database, gardenId: string, headers: any): Promise<Response> {
    try {
      const messageData = await request.json() as {
        sender: string;
        content: string;
        contentType: string;
        channelId?: string;
        replyToId?: string;
        selfDestructEnabled?: boolean;
        selfDestructAt?: number;
        publicKey?: string;
      };
      
      // Validate required fields
      if (!messageData.sender || !messageData.content || !messageData.contentType) {
        return new Response(JSON.stringify({ error: 'Missing required message fields' }), {
          status: 400,
          headers
        });
      }
      
      // Generate message ID
      const messageId = crypto.randomUUID();
      const now = Date.now();
      
      // Calculate self-destruct time if enabled
      let selfDestructAt = null;
      if (messageData.selfDestructEnabled) {
        // Default to 24 hours if not specified
        const selfDestructDelay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        selfDestructAt = now + selfDestructDelay;
      }
      
      // Insert the message
      await db.prepare(`
        INSERT INTO messages (
          id, sender, garden, channel_id, content, content_type, 
          public_key, self_destruct_enabled, self_destruct_at, 
          sent, created_at, updated_at, reply_to_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        messageId,
        messageData.sender,
        gardenId,
        messageData.channelId || null,
        messageData.content,
        messageData.contentType,
        messageData.publicKey || '',
        messageData.selfDestructEnabled ? 1 : 0,
        selfDestructAt,
        1, // sent = true
        now,
        now,
        messageData.replyToId || null
      ).run();
      
      // Get the created message with only the essential fields
      const message = await db.prepare(`
        SELECT m.id, m.sender, u.username as sender_username, m.garden, m.channel_id,
               m.public_key, m.content, m.content_type, m.reply_to_id, m.created_at
        FROM messages m 
        LEFT JOIN memberships u ON m.sender = u.user_id AND m.garden = u.garden_id
        WHERE m.id = ?
      `).bind(messageId).first();
      
      if (!message) {
        return new Response(JSON.stringify({ error: 'Failed to create message' }), {
          status: 500,
          headers
        });
      }
      
      // Format the message with only essential fields
      const formattedMessage = {
        id: message.id,
        sender: message.sender,
        senderUsername: message.sender_username || 'Unknown',
        garden: message.garden,
        channelId: message.channel_id,
        publicKey: message.public_key,
        content: message.content,
        contentType: message.content_type,
        createdAt: message.created_at,
        replyToId: message.reply_to_id
      };
      
      return new Response(JSON.stringify(formattedMessage), {
        status: 201,
        headers
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      return new Response(JSON.stringify({ error: 'Failed to send message', details: (error as Error).message }), {
        status: 500,
        headers
      });
    }
  }