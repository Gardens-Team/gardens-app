import 'package:local_auth/local_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';
import '../models/user.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;

  final LocalAuthentication _localAuth = LocalAuthentication();
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  final Uuid _uuid = const Uuid();
  
  User? _currentUser;
  String? _deviceId;
  bool _isAuthenticated = false;

  AuthService._internal();

  // Check if biometrics are available
  Future<bool> canUseBiometrics() async {
    final canAuthenticateWithBiometrics = await _localAuth.canCheckBiometrics;
    final canAuthenticate = canAuthenticateWithBiometrics || await _localAuth.isDeviceSupported();
    return canAuthenticate;
  }

  // Authenticate with biometrics
  Future<bool> authenticateWithBiometrics() async {
    try {
      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Authenticate to access Gardens',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false,
        ),
      );

      _isAuthenticated = authenticated;
      return authenticated;
    } catch (e) {
      print('Error authenticating: $e');
      return false;
    }
  }

  // Check if user exists (already registered)
  Future<bool> isUserRegistered() async {
    final userId = await _secureStorage.read(key: 'userId');
    return userId != null;
  }

  // Register a new user and device
  Future<User> registerUser({
    required String displayName,
    required String bio,
    String? profilePic,
  }) async {
    final userId = 'identity:${_uuid.v4()}';
    _deviceId = _uuid.v7();
    
    final newUser = User(
      id: userId,
      displayName: displayName,
      bio: bio,
      profilePic: profilePic,
      createdAt: DateTime.now(),
    );
    
    // Save user ID to secure storage
    await _secureStorage.write(key: 'userId', value: userId);
    await _secureStorage.write(key: 'deviceId', value: _deviceId);
    
    _currentUser = newUser;
    _isAuthenticated = true;
    
    return newUser;
  }

  // Load user data from secure storage
  Future<User?> loadUser() async {
    if (_currentUser != null) return _currentUser;
    
    final userId = await _secureStorage.read(key: 'userId');
    _deviceId = await _secureStorage.read(key: 'deviceId');
    
    if (userId == null) return null;
    
    // Load user from database
    // In a real app, you would fetch user data from your database
    // Here, we're just returning a placeholder
    _currentUser = User(
      id: userId,
      displayName: 'User',
      bio: 'App user',
      createdAt: DateTime.now(),
    );
    
    return _currentUser;
  }

  // Get current user
  User? get currentUser => _currentUser;
  
  // Get device ID
  String? get deviceId => _deviceId;
  
  // Check if authenticated
  bool get isAuthenticated => _isAuthenticated;
  
  // Logout
  Future<void> logout() async {
    _isAuthenticated = false;
    _currentUser = null;
  }
}