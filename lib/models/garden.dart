// lib/models/garden.dart
import 'package:flutter/foundation.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:uuid/uuid.dart';

part 'garden.freezed.dart';
part 'garden.g.dart';

@freezed
class Garden with _$Garden {
  const factory Garden({
    required String id,
    required String name,
    required String creatorId,
    Uint8List? mlsGroupInfo,
    required DateTime createdAt,
    String? topic1,
    String? topic2,
    String? topic3,
    String? topic4,
    String? topic5,
  }) = _Garden;

  factory Garden.create({
    required String name,
    required String creatorId,
    Uint8List? mlsGroupInfo,
    List<String>? topics,
  }) {
    return Garden(
      id: const Uuid().v4(),
      name: name,
      creatorId: creatorId,
      mlsGroupInfo: mlsGroupInfo,
      createdAt: DateTime.now(),
      topic1: topics?.isNotEmpty == true ? topics![0] : null,
      topic2: topics?.length > 1 ? topics![1] : null,
      topic3: topics?.length > 2 ? topics![2] : null,
      topic4: topics?.length > 3 ? topics![3] : null,
      topic5: topics?.length > 4 ? topics![4] : null,
    );
  }

  List<String> getTopics() {
    return [
      if (topic1 != null) topic1!,
      if (topic2 != null) topic2!,
      if (topic3 != null) topic3!,
      if (topic4 != null) topic4!,
      if (topic5 != null) topic5!,
    ];
  }

  factory Garden.fromJson(Map<String, dynamic> json) => _$GardenFromJson(json);
}