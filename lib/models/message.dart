// lib/models/message.dart
import 'package:flutter/foundation.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:uuid/uuid.dart';

part 'message.freezed.dart';
part 'message.g.dart';

@freezed
class Message with _$Message {
  const factory Message({
    required String id,
    required String gardenId,
    required String senderDeviceId,
    required Uint8List ciphertext,
    required DateTime timestamp,
    String? decryptedContent, // For UI display after decryption
  }) = _Message;

  factory Message.create({
    required String gardenId,
    required String senderDeviceId,
    required Uint8List ciphertext,
  }) {
    return Message(
      id: const Uuid().v4(),
      gardenId: gardenId,
      senderUserId: senderUserId,
      ciphertext: ciphertext,
      timestamp: DateTime.now(),
    );
  }

  factory Message.fromJson(Map<String, dynamic> json) => _$MessageFromJson(json);
}