// lib/models/topic.dart
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'topic.freezed.dart';
part 'topic.g.dart';

enum TopicCategory {
  general,
  technology,
  arts,
  science,
  lifestyle,
  politics,
  philosophy,
  religion,
  subculture,
  taboo,
  other
}

@freezed
class Topic with _$Topic {
  const factory Topic({
    required String id,
    required String name,
    required TopicCategory category,
    String? description,
  }) = _Topic;

  factory Topic.fromJson(Map<String, dynamic> json) => _$TopicFromJson(json);
}