// lib/models/user.dart
import 'package:flutter/foundation.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:uuid/uuid.dart';

part 'user.freezed.dart';
part 'user.g.dart';

@freezed
class User with _$User {
  const factory User({
    required String id,
    String? displayName,
    Uint8List? profilePic,
    required String bio,
    required DateTime createdAt,
  }) = _User;

  factory User.create({
    String? displayName,
    Uint8List? profilePic,
    required String bio,
  }) {
    return User(
      id: const Uuid().v4(),
      displayName: displayName,
      profilePic: profilePic,
      bio: bio,
      createdAt: DateTime.now(),
    );
  }

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}