// lib/providers/message_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/message.dart';
import '../services/database_service.dart';
import '../services/crypto_service.dart';
import '../services/auth_service.dart';

final messagesProvider = StreamProvider.family<List<Message>, String>((ref, gardenId) {
  final messageNotifier = ref.watch(messageNotifierProvider.notifier);
  return messageNotifier.getMessagesStream(gardenId);
});

final messageNotifierProvider = StateNotifierProvider<MessageNotifier, AsyncValue<void>>((ref) {
  final databaseService = ref.read(databaseServiceProvider);
  final cryptoService = ref.read(cryptoServiceProvider);
  final authService = ref.read(authServiceProvider);
  
  return MessageNotifier(databaseService, cryptoService, authService);
});

class MessageNotifier extends StateNotifier<AsyncValue<void>> {
  final CloudflareD1Service _databaseService;
  final CoreCryptoService _cryptoService;
  final AuthService _authService;
  
  // In-memory cache of messages per garden
  final Map<String, List<Message>> _messagesCache = {};
  final Map<String, Stream<List<Message>>> _messageStreams = {};

  MessageNotifier(
    this._databaseService,
    this._cryptoService,
    this._authService,
  ) : super(const AsyncValue.data(null));

  Stream<List<Message>> getMessagesStream(String gardenId) {
    // Create or return existing stream
    if (_messageStreams.containsKey(gardenId)) {
      return _messageStreams[gardenId]!;
    }
    
    // Initialize cache if needed
    if (!_messagesCache.containsKey(gardenId)) {
      _messagesCache[gardenId] = [];
      _loadMessages(gardenId);
    }
    
    // Create a stream controller
    final controller = StreamController<List<Message>>.broadcast();
    
    // Add initial data
    controller.add(_messagesCache[gardenId] ?? []);
    
    _messageStreams[gardenId] = controller.stream;
    return controller.stream;
  }

  Future<void> _loadMessages(String gardenId) async {
    try {
      final messages = await _databaseService.getGardenMessages(gardenId);
      
      // Decrypt messages
      for (final message in messages) {
        try {
          final decrypted = await _cryptoService.decryptMessage(
            gardenId,
            message.ciphertext.toString(),
          );
          message.decryptedContent = decrypted;
        } catch (e) {
          print('Failed to decrypt message: $e');
        }
      }
      
      _messagesCache[gardenId] = messages;
      
      // Notify listeners
      if (_messageStreams.containsKey(gardenId)) {
        final controller = _messageStreams[gardenId] as StreamController<List<Message>>;
        controller.add(messages);
      }
    } catch (e) {
      print('Error loading messages: $e');
    }
  }

  Future<void> sendMessage(String gardenId, String content) async {
    state = const AsyncValue.loading();
    try {
      final deviceId = _authService.deviceId;
      
      if (deviceId == null) {
        throw Exception('User not authenticated');
      }
      
      // Encrypt message with MLS
      final encrypted = await _cryptoService.encryptMessage(gardenId, content);
      final encryptedBytes = Uint8List.fromList(encrypted.codeUnits);
      
      // Create message
      final message = Message.create(
        gardenId: gardenId,
        senderDeviceId: deviceId,
        ciphertext: encryptedBytes,
      );
      
      // Add to cache immediately for responsive UI
      message.decryptedContent = content; // We know the content since we just created it
      _messagesCache[gardenId] = [message, ..._messagesCache[gardenId] ?? []];
      
      // Notify listeners
      if (_messageStreams.containsKey(gardenId)) {
        final controller = _messageStreams[gardenId] as StreamController<List<Message>>;
        controller.add(_messagesCache[gardenId] ?? []);
      }
      
      // Save to database
      await _databaseService.saveMessage(message);
      
      state = const AsyncValue.data(null);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }
}