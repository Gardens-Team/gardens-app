import 'dart:ffi';
import 'dart:io';
import 'package:ffi/ffi.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

// FFI signature for the core-crypto library
typedef CoreCryptoInitializeFn = Int32 Function(Pointer<Utf8>);
typedef CoreCryptoInitialize = int Function(Pointer<Utf8>);

typedef CreateMlsGroupFn = Pointer<Utf8> Function(Pointer<Utf8>);
typedef CreateMlsGroup = Pointer<Utf8> Function(Pointer<Utf8>);

typedef EncryptMessageFn = Pointer<Utf8> Function(Pointer<Utf8>, Pointer<Utf8>);
typedef EncryptMessage = Pointer<Utf8> Function(Pointer<Utf8>, Pointer<Utf8>);

typedef DecryptMessageFn = Pointer<Utf8> Function(Pointer<Utf8>, Pointer<Utf8>);
typedef DecryptMessage = Pointer<Utf8> Function(Pointer<Utf8>, Pointer<Utf8>);

class CoreCryptoService {
  static final CoreCryptoService _instance = CoreCryptoService._internal();
  factory CoreCryptoService() => _instance;
  
  late final DynamicLibrary _coreCryptoLib;
  late final CoreCryptoInitialize _initialize;
  late final CreateMlsGroup _createMlsGroup;
  late final EncryptMessage _encryptMessage;
  late final DecryptMessage _decryptMessage;
  bool _isInitialized = false;

  CoreCryptoService._internal();

  Future<void> initialize() async {
    if (_isInitialized) return;

    // Load the dynamic library based on platform
    if (Platform.isAndroid) {
      _coreCryptoLib = DynamicLibrary.open('libcore_crypto.so');
    } else if (Platform.isIOS) {
      _coreCryptoLib = DynamicLibrary.process();
    } else if (Platform.isWindows) {
      _coreCryptoLib = DynamicLibrary.open('core_crypto.dll');
    } else if (Platform.isMacOS) {
      _coreCryptoLib = DynamicLibrary.open('libcore_crypto.dylib');
    } else if (Platform.isLinux) {
      _coreCryptoLib = DynamicLibrary.open('libcore_crypto.so');
    } else {
      throw UnsupportedError('Unsupported platform');
    }

    // Get references to the native functions
    _initialize = _coreCryptoLib
        .lookup<NativeFunction<CoreCryptoInitializeFn>>('core_crypto_initialize')
        .asFunction();
        
    _createMlsGroup = _coreCryptoLib
        .lookup<NativeFunction<CreateMlsGroupFn>>('create_mls_group')
        .asFunction();
        
    _encryptMessage = _coreCryptoLib
        .lookup<NativeFunction<EncryptMessageFn>>('encrypt_message')
        .asFunction();
        
    _decryptMessage = _coreCryptoLib
        .lookup<NativeFunction<DecryptMessageFn>>('decrypt_message')
        .asFunction();

    // Initialize the library with storage path
    final directory = await getApplicationDocumentsDirectory();
    final storagePath = '${directory.path}/crypto_storage';
    final result = _initialize(storagePath.toNativeUtf8());
    
    if (result != 0) {
      throw Exception('Failed to initialize core-crypto library');
    }
    
    _isInitialized = true;
  }

  // Create a new MLS group for a garden
  Future<String> createMlsGroup(String gardenId) async {
    if (!_isInitialized) await initialize();
    
    final gardenIdNative = gardenId.toNativeUtf8();
    final resultPointer = _createMlsGroup(gardenIdNative);
    final result = resultPointer.toDartString();
    
    calloc.free(gardenIdNative);
    calloc.free(resultPointer);
    
    return result;
  }

  // Encrypt a message using MLS
  Future<String> encryptMessage(String groupId, String message) async {
    if (!_isInitialized) await initialize();
    
    final groupIdNative = groupId.toNativeUtf8();
    final messageNative = message.toNativeUtf8();
    
    final resultPointer = _encryptMessage(groupIdNative, messageNative);
    final result = resultPointer.toDartString();
    
    calloc.free(groupIdNative);
    calloc.free(messageNative);
    calloc.free(resultPointer);
    
    return result;
  }

  // Decrypt a message using MLS
  Future<String> decryptMessage(String groupId, String encryptedMessage) async {
    if (!_isInitialized) await initialize();
    
    final groupIdNative = groupId.toNativeUtf8();
    final encryptedMessageNative = encryptedMessage.toNativeUtf8();
    
    final resultPointer = _decryptMessage(groupIdNative, encryptedMessageNative);
    final result = resultPointer.toDartString();
    
    calloc.free(groupIdNative);
    calloc.free(encryptedMessageNative);
    calloc.free(resultPointer);
    
    return result;
  }
}