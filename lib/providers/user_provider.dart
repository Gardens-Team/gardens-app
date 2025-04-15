// lib/providers/user_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/database_service.dart';

final userProvider = FutureProvider.family<User?, String>((ref, userId) async {
  final databaseService = ref.read(databaseServiceProvider);
  return databaseService.getUserById(userId);
});

final userNotifierProvider = StateNotifierProvider<UserNotifier, AsyncValue<void>>((ref) {
  final databaseService = ref.read(databaseServiceProvider);
  return UserNotifier(databaseService);
});

class UserNotifier extends StateNotifier<AsyncValue<void>> {
  final CloudflareD1Service _databaseService;

  UserNotifier(this._databaseService) : super(const AsyncValue.data(null));

  Future<User?> updateUser(User user) async {
    state = const AsyncValue.loading();
    try {
      // Update user in database
      // Note: You might need to add this method to the database service
      // For now, we'll assume it exists
      final updatedUser = await _databaseService.updateUser(user);
      state = const AsyncValue.data(null);
      return updatedUser;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return null;
    }
  }
}