![](./assets/cover.png)

# Gardens: Secure Messaging App

Gardens is a React Native application built with Expo for secure, end-to-end encrypted 1:1 messaging and group communication. It focuses on providing a platform for any time of organizating and communization without questions asked.

## Features

- **End-to-End Encryption**: All messages are encrypted on the device before transmission
- **Secure User Profiles**: Create a profile with minimal required information
- **Messaging**: Chat securely with other comrades
- **Discover** (Coming Soon): Find and join gardens to communicate with people with similar interests

## Tech Stack

- **React Native** with **Expo**: Cross-platform mobile development
- **TypeScript**: For type-safe code
- **Expo Router**: For navigation
- **Zustand**: For state management
- **Cloudflare D1**: For persistant data storage
- **Crypto Libraries**: For encryption and security

## Project Structure

```
nerves/
├── app/                    # Main application code
│   ├── auth/               # Authentication screens
│   ├── components/         # Reusable UI components
│   ├── constants/          # App constants
│   ├── contexts/           # React contexts
│   ├── hooks/              # Custom React hooks
│   ├── models/             # Data models
│   ├── screens/            # Screen components
│   ├── utils/              # Utility functions
│   └── index.tsx           # App entry point
├── assets/                 # Static assets
└── ...config files
```

## Data Models

### Local Storage (SQLite)

#### Users
- id: string (Primary Key)
- username: string
- profile_pic: string (optional)
- visible: boolean
- public_key: string
- private_key: string
- bio: string (optional)
- location: string (optional)
- email: string (optional)
- phone: string (optional)
- created_at: number (timestamp)
- updated_at: number (timestamp)

#### User Presence
- user_id: string (Primary Key)
- status: string
- last_active: number (timestamp)
- timestamp: number (timestamp)

### Cloud Storage (Cloudflare D1)

#### Gardens
- id: string (Primary Key)
- name: string
- description: string (optional)
- logoData: BLOB (optional)
- coverImageData: BLOB (optional)
- city: string
- state: string
- latitude: number (optional)
- longitude: number (optional)
- creator_id: string
- creator_username: string
- creator_profile_pic: string
- visible: boolean
- is_private: boolean
- oauth_enabled: boolean
- oauth_provider_id: string (optional)
- oauth_client_id: string (optional)
- oauth_client_secret: string (optional)
- tags: string (JSON array)
- member_count: number
- created_at: number (timestamp)
- updated_at: number (timestamp)

#### Channels
- id: string (Primary Key)
- garden_id: string (Foreign Key)
- name: string
- description: string (optional)
- is_default: boolean
- is_administrative: boolean
- created_at: number (timestamp)
- updated_at: number (timestamp)

#### Messages
- id: string (Primary Key)
- sender: string
- recipient: string (optional)
- garden: string (optional)
- channel_id: string (optional, Foreign Key)
- content: string (encrypted)
- content_type: string (enum: text, image, video, audio, file, system)
- sent: boolean
- public_key: string
- delivered: boolean
- read: boolean
- self_destruct_enabled: boolean
- self_destruct_at: number (timestamp, optional)
- created_at: number (timestamp)
- updated_at: number (timestamp)
- reply_to_id: string (optional, Foreign Key)

#### Memberships
- garden_id: string (Composite Primary Key)
- user_id: string (Composite Primary Key)
- username: string
- public_key: string
- role: string (enum: member, moderator, admin, founder)
- banned: boolean
- muted: boolean
- kicked: boolean
- joined_at: number (timestamp)
- banned_at: number (timestamp, optional)
- kicked_at: number (timestamp, optional)
- muted_at: number (timestamp, optional)

#### Requests
- garden_id: string (Composite Primary Key)
- user_id: string (Composite Primary Key)
- username: string
- message: string (optional)

#### Moderation Features
- Lockdowns: Channel-specific lockdowns
- Slow Modes: Channel-specific message rate limiting

## Database Architecture

The application uses a hybrid database approach:

1. **Local Storage (SQLite)**
   - Handles user data, encryption keys, and presence information
   - Optimized for offline-first functionality
   - Manages local caching and state

2. **Cloud Storage (Cloudflare D1)**
   - Stores encrypted messages and garden data
   - Handles user relationships and permissions
   - Manages moderation features

### Security Features
- End-to-end encryption for all messages
- Public/private key pairs for user authentication
- Role-based access control for garden management
- Self-destructing messages
- Channel-specific moderation tools

## Getting Started

### Prerequisites

- Node.js
- Yarn or npm
- Expo CLI
- iOS Simulator or Android Emulator

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/nerves.git
cd nerves
```

2. Install dependencies
```bash
yarn install
```

3. Start the development server
```bash
yarn start
```

### Development

The app is built using the Expo ecosystem with expo-router for navigation. It follows a feature-based organization structure where related components, hooks, and utilities are grouped together.

#### Key Directories

- **app/**: Contains the main application code organized by feature
- **app/components/**: Reusable UI components
- **app/contexts/**: React contexts for state management
- **app/utils/**: Utility functions, including encryption

## Security Notes

- This app implements end-to-end encryption for all messages
- No message data is stored on servers unencrypted
- User profiles can be set to invisible mode
- All connections are encrypted using TLS

## License

This project is licensed under the GPL-3.0 License. 