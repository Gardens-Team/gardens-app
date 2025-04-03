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

### Users (Local)
- id: string
- username: string
- profile_pic: string (optional)
- visible: boolean

### Encrypted Messages (Cloudflare D1)
- id: string
- sender: string
- recipient: string (for direct messages)
- garden: string (for group messages)
- content: string (encrypted)

### Gardens (Cloudflare D1)
- id: string
- visible: boolean
- logo: string
- latitude
- longitude

### Channels

### Timeouts

### Lockdowns

### Slowmodes

### Memberships

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