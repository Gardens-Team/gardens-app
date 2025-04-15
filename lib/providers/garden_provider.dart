// lib/providers/garden_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/garden.dart';
import '../services/database_service.dart';
import '../services/crypto_service.dart';
import '../services/auth_service.dart';

final gardenListProvider = FutureProvider.autoDispose<List<Garden>>((ref) async {
  final databaseService = ref.read(databaseServiceProvider);
  final authState = ref.watch(authStateProvider);
  
  if (authState.user == null) return [];
  
  return databaseService.getUserGardens(authState.user!.id);
});

final discoverGardensProvider = FutureProvider.family<List<Garden>, List<String>>((ref, topics) async {
  final databaseService = ref.read(databaseServiceProvider);
  return databaseService.getGardensByTopics(topics);
});

final gardenProvider = FutureProvider.family<Garden?, String>((ref, gardenId) async {
  final gardens = await ref.watch(gardenListProvider.future);
  return gardens.firstWhere((garden) => garden.id == gardenId, orElse: () => null);
});

final gardenNotifierProvider = StateNotifierProvider<GardenNotifier, AsyncValue<void>>((ref) {
  final databaseService = ref.read(databaseServiceProvider);
  final cryptoService = ref.read(cryptoServiceProvider);
  final authService = ref.read(authServiceProvider);
  
  return GardenNotifier(databaseService, cryptoService, authService);
});

class GardenNotifier extends StateNotifier<AsyncValue<void>> {
  final CloudflareD1Service _databaseService;
  final CoreCryptoService _cryptoService;
  final AuthService _authService;

  GardenNotifier(
    this._databaseService,
    this._cryptoService,
    this._authService,
  ) : super(const AsyncValue.data(null));

  Future<Garden?> createGarden({
    required String name,
    required List<String> topics,
  }) async {
    state = const AsyncValue.loading();
    try {
      final user = _authService.currentUser;
      final deviceId = _authService.deviceId;
      
      if (user == null || deviceId == null) {
        throw Exception('User not authenticated');
      }
      
      // Create MLS group
      final mlsGroupInfo = await _cryptoService.createMlsGroup(name);
      
      // Create garden
      final garden = Garden.create(
        name: name,
        creatorId: user.id,
        mlsGroupInfo: Uint8List.fromList(mlsGroupInfo.codeUnits),
        topics: topics,
      );
      
      // Save to database
      final createdGarden = await _databaseService.createGarden(garden);
      
      // Add creator as first member
      await _databaseService.addMemberToGarden(createdGarden.id, deviceId);
      
      state = const AsyncValue.data(null);
      return createdGarden;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return null;
    }
  }

  Future<bool> joinGarden(String gardenId) async {
    state = const AsyncValue.loading();
    try {
      final deviceId = _authService.deviceId;
      
      if (deviceId == null) {
        throw Exception('User not authenticated');
      }
      
      await _databaseService.addMemberToGarden(gardenId, deviceId);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }
}