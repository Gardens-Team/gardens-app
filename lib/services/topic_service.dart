import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/topic.dart';

class TopicService {
  static final TopicService _instance = TopicService._internal();
  factory TopicService() => _instance;

  List<Topic> _allTopics = [];
  List<String> _userSelectedTopicIds = [];
  
  TopicService._internal();

  // Load all available topics
  Future<List<Topic>> loadAllTopics() async {
    if (_allTopics.isNotEmpty) return _allTopics;
    
    try {
      // Load topics from a JSON file in assets
      final String jsonString = await rootBundle.loadString('assets/topics.json');
      final List<dynamic> jsonList = json.decode(jsonString);
      
      _allTopics = jsonList.map((json) => Topic.fromJson(json)).toList();
      return _allTopics;
    } catch (e) {
      print('Error loading topics: $e');
      // Provide some sample topics in case we can't load from asset
      _allTopics = [
        Topic(id: '1', name: 'Technology', category: 'Interests', description: 'Tech discussions'),
        Topic(id: '2', name: 'Privacy', category: 'Interests', description: 'Privacy topics'),
        Topic(id: '3', name: 'Books', category: 'Interests', description: 'Book discussions'),
        Topic(id: '4', name: 'Food', category: 'Interests', description: 'Food and cooking'),
        Topic(id: '5', name: 'Travel', category: 'Interests', description: 'Travel discussions'),
        // Add more sample topics...
      ];
      return _allTopics;
    }
  }

  // Get user selected topics
  Future<List<String>> getUserSelectedTopicIds() async {
    if (_userSelectedTopicIds.isNotEmpty) return _userSelectedTopicIds;
    
    final prefs = await SharedPreferences.getInstance();
    _userSelectedTopicIds = prefs.getStringList('selectedTopics') ?? [];
    return _userSelectedTopicIds;
  }

  // Get user selected topics as Topic objects
  Future<List<Topic>> getUserSelectedTopics() async {
    final topicIds = await getUserSelectedTopicIds();
    await loadAllTopics(); // Ensure topics are loaded
    
    return _allTopics.where((topic) => topicIds.contains(topic.id)).toList();
  }

  // Save user selected topics
  Future<void> saveUserSelectedTopics(List<String> topicIds) async {
    _userSelectedTopicIds = topicIds;
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('selectedTopics', topicIds);
  }

  // Search topics by name
  Future<List<Topic>> searchTopics(String query) async {
    await loadAllTopics(); // Ensure topics are loaded
    
    if (query.isEmpty) return _allTopics;
    
    final lowercaseQuery = query.toLowerCase();
    return _allTopics.where((topic) => 
      topic.name.toLowerCase().contains(lowercaseQuery) ||
      (topic.description?.toLowerCase().contains(lowercaseQuery) ?? false)
    ).toList();
  }

  // Get topics by category
  Future<Map<String, List<Topic>>> getTopicsByCategory() async {
    await loadAllTopics(); // Ensure topics are loaded
    
    final Map<String, List<Topic>> categorizedTopics = {};
    
    for (final topic in _allTopics) {
      if (!categorizedTopics.containsKey(topic.category)) {
        categorizedTopics[topic.category] = [];
      }
      categorizedTopics[topic.category]!.add(topic);
    }
    
    return categorizedTopics;
  }
}