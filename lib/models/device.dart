// lib/models/device.dart
import 'package:flutter/foundation.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:uuid/uuid.dart';

part 'device.freezed.dart';
part 'device.g.dart';

@freezed
class Device with _$Device {
  const factory Device({
    required String id,
    required String identityId,
    required Uint8List credential,
    required DateTime createdAt,
  }) = _Device;

  factory Device.create({
    required String identityId,
    required Uint8List credential,
  }) {
    return Device(
      id: const Uuid().v4(),
      identityId: identityId,
      credential: credential,
      createdAt: DateTime.now(),
    );
  }

  factory Device.fromJson(Map<String, dynamic> json) => _$DeviceFromJson(json);
}