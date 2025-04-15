// lib/services/topic_service.dart
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/topic.dart';

class TopicService {
  static final TopicService _instance = TopicService._internal();
  factory TopicService() => _instance;
  
  List<Topic>? _cachedTopics;
  
  TopicService._internal();
  
  Future<List<Topic>> getAllTopics() async {
    if (_cachedTopics != null) {
      return _cachedTopics!;
    }
    
    // First try to load from local cache
    final prefs = await SharedPreferences.getInstance();
    final cachedData = prefs.getString('topics_cache');
    
    if (cachedData != null) {
      try {
        final List<dynamic> topicsJson = jsonDecode(cachedData);
        _cachedTopics = topicsJson.map((json) => Topic.fromJson(json)).toList();
        return _cachedTopics!;
      } catch (e) {
        // Cache is invalid, continue to load from assets
      }
    }
    
    // Load the predefined topics from asset
    try {
      final String data = await rootBundle.loadString('assets/data/topics.json');
      final List<dynamic> topicsJson = jsonDecode(data);
      _cachedTopics = topicsJson.map((json) => Topic.fromJson(json)).toList();
      
      // Cache for future use
      await prefs.setString('topics_cache', data);
      
      return _cachedTopics!;
    } catch (e) {
      // If loading from assets fails, return hardcoded list of example topics
      _cachedTopics = _getDefaultTopics();
      return _cachedTopics!;
    }
  }
  
  List<Topic> _getDefaultTopics() {
    // This would be replaced with a more comprehensive list
    return [
      // General interest topics
      const Topic(id: '1', name: 'Movies', category: TopicCategory.arts),
      const Topic(id: '2', name: 'Books', category: TopicCategory.arts),
      const Topic(id: '3', name: 'Programming', category: TopicCategory.technology),
      const Topic(id: '4', name: 'Cooking', category: TopicCategory.lifestyle),
      const Topic(id: '5', name: 'Travel', category: TopicCategory.lifestyle),
      
      // Science topics
      const Topic(id: '6', name: 'Astronomy', category: TopicCategory.science),
      const Topic(id: '7', name: 'Quantum Physics', category: TopicCategory.science),
      const Topic(id: '8', name: 'Genetics', category: TopicCategory.science),
      
      // Philosophy topics
      const Topic(id: '9', name: 'Existentialism', category: TopicCategory.philosophy),
      const Topic(id: '10', name: 'Ethics', category: TopicCategory.philosophy),
      
      // Politics topics
      const Topic(id: '11', name: 'Democracy', category: TopicCategory.politics),
      const Topic(id: '12', name: 'Anarchism', category: TopicCategory.politics),
      const Topic(id: '13', name: 'Socialism', category: TopicCategory.politics),
      
      // Subculture topics
      const Topic(id: '14', name: 'LGBTQ+', category: TopicCategory.subculture),
      const Topic(id: '15', name: 'Gaming', category: TopicCategory.subculture),
      
      // Taboo topics
      const Topic(id: '16', name: 'ABDL', category: TopicCategory.taboo, 
          description: 'Adult Baby/Diaper Lover community discussions'),
      const Topic(id: '17', name: 'Kink', category: TopicCategory.taboo),
      const Topic(id: '18', name: 'Alternative Sexuality', category: TopicCategory.taboo),
      
      // Other topics
      const Topic(id: '19', name: 'Paranormal', category: TopicCategory.other),
      const Topic(id: '20', name: 'Conspiracy Theories', category: TopicCategory.other),
    ];
  }
  
  Future<List<Topic>> searchTopics(String query) async {
    final allTopics = await getAllTopics();
    final lowercaseQuery = query.toLowerCase();
    
    return allTopics.where((topic) => 
      topic.name.toLowerCase().contains(lowercaseQuery) ||
      (topic.description?.toLowerCase().contains(lowercaseQuery) ?? false)
    ).toList();
  }
  
  Future<List<Topic>> getTopicsByCategory(TopicCategory category) async {
    final allTopics = await getAllTopics();
    return allTopics.where((topic) => topic.category == category).toList();
  }
}