lib/
  ├── main.dart                     # Main entry point
  ├── app.dart                      # App configuration
  ├── theme/                        # App theme configuration
  │   ├── app_theme.dart
  │   └── colors.dart
  ├── models/                       # Data models
  │   ├── user.dart
  │   ├── garden.dart
  │   ├── message.dart
  │   ├── topic.dart
  │   └── device.dart
  ├── services/                     # Backend services
  │   ├── auth_service.dart         # Authentication including biometrics
  │   ├── database_service.dart     # Cloudflare D1 API integration
  │   ├── crypto_service.dart       # MLS integration via FFI
  │   ├── topic_service.dart        # Topic management
  │   └── qr_service.dart           # QR code generation
  ├── screens/                      # UI screens
  │   ├── auth/
  │   │   ├── biometric_auth_screen.dart
  │   │   └── signup_screen.dart
  │   ├── profile/
  │   │   ├── profile_screen.dart
  │   │   └── edit_profile_screen.dart
  │   ├── discovery/
  │   │   └── discover_screen.dart
  │   ├── garden/
  │   │   ├── garden_detail_screen.dart
  │   │   ├── create_garden_screen.dart
  │   │   └── garden_chat_screen.dart
  │   ├── onboarding/
  │   │   ├── welcome_screen.dart
  │   │   └── topic_selection_screen.dart
  │   └── settings/
  │       └── settings_screen.dart
  ├── widgets/                      # Reusable widgets
  │   ├── garden_card.dart
  │   ├── user_avatar.dart
  │   ├── chat_message.dart
  │   ├── topic_selector.dart
  │   └── qr_invite.dart
  ├── providers/                    # State management with Riverpod
  │   ├── auth_provider.dart
  │   ├── user_provider.dart
  │   ├── garden_provider.dart
  │   └── message_provider.dart
  └── utils/                        # Utility functions
      ├── constants.dart
      ├── extensions.dart
      └── ffi_helpers.dart          # Helpers for FFI