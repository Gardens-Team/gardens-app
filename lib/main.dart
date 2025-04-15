import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:gardens/screens/auth/biometric_auth_screen.dart';
import 'package:gardens/screens/onboarding/welcome_screen.dart';
import 'package:gardens/services/auth_service.dart';
import 'package:gardens/services/crypto_service.dart';
import 'package:gardens/services/database_service.dart';
import 'package:gardens/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize services
  final authService = AuthService();
  final coreCryptoService = CoreCryptoService();
  await coreCryptoService.initialize();
  
  // Initialize database service with Cloudflare D1 credentials
  final databaseService = CloudflareD1Service();
  await databaseService.initialize(
    apiUrl: 'https://your-cloudflare-worker-url.workers.dev',
    apiToken: 'your-api-token',
  );
  
  runApp(
    ProviderScope(
      child: GardensApp(),
    ),
  );
}

// Providers
final authServiceProvider = Provider<AuthService>((ref) => AuthService());
final cryptoServiceProvider = Provider<CoreCryptoService>((ref) => CoreCryptoService());
final databaseServiceProvider = Provider<CloudflareD1Service>((ref) => CloudflareD1Service());

class GardensApp extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'Gardens',
      theme: AppTheme.darkTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.dark, // Always use dark theme based on mockups
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en', ''), // English
      ],
      home: FutureBuilder<bool>(
        future: _checkAuthStatus(ref),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          
          final isRegistered = snapshot.data ?? false;
          if (isRegistered) {
            return const BiometricAuthScreen();
          } else {
            return const WelcomeScreen();
          }
        },
      ),
    );
  }
  
  Future<bool> _checkAuthStatus(WidgetRef ref) async {
    final authService = ref.read(authServiceProvider);
    return await authService.isUserRegistered();
  }
}