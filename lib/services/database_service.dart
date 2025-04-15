import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import '../models/garden.dart';
import '../models/message.dart';

class CloudflareD1Service {
  static final CloudflareD1Service _instance = CloudflareD1Service._internal();
  factory CloudflareD1Service() => _instance;

  late final String _apiUrl;
  late final String _apiToken;
  bool _isInitialized = false;
  
  CloudflareD1Service._internal();

  Future<void> initialize({required String apiUrl, required String apiToken}) async {
    _apiUrl = apiUrl;
    _apiToken = apiToken;
    _isInitialized = true;
  }

  Future<Map<String, dynamic>> _executeQuery(String query, [Map<String, dynamic>? params]) async {
    if (!_isInitialized) {
      throw Exception('Database service not initialized');
    }

    final response = await http.post(
      Uri.parse('$_apiUrl/query'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $_apiToken',
      },
      body: jsonEncode({
        'query': query,
        'params': params,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to execute query: ${response.body}');
    }
  }

  // User methods
  Future<User> createUser(User user) async {
    final result = await _executeQuery(
      'INSERT INTO users (id, display_name, profile_pic, bio) VALUES (?, ?, ?, ?) RETURNING *',
      {
        '1': user.id,
        '2': user.displayName,
        '3': user.profilePic,
        '4': user.bio,
      },
    );

    return User.fromJson(result['results'][0]);
  }

  Future<User?> getUserById(String userId) async {
    final result = await _executeQuery(
      'SELECT * FROM users WHERE id = ?',
      {'1': userId},
    );

    if (result['results'].isEmpty) {
      return null;
    }

    return User.fromJson(result['results'][0]);
  }

  // Garden methods
  Future<Garden> createGarden(Garden garden) async {
    final result = await _executeQuery(
      '''
      INSERT INTO gardens (id, name, creator_id, mls_group_info, topic_1, topic_2, topic_3, topic_4, topic_5) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
      ''',
      {
        '1': garden.id,
        '2': garden.name,
        '3': garden.creatorId,
        '4': garden.mlsGroupInfo,
        '5': garden.topics.length > 0 ? garden.topics[0] : null,
        '6': garden.topics.length > 1 ? garden.topics[1] : null,
        '7': garden.topics.length > 2 ? garden.topics[2] : null,
        '8': garden.topics.length > 3 ? garden.topics[3] : null,
        '9': garden.topics.length > 4 ? garden.topics[4] : null,
      },
    );

    return Garden.fromJson(result['results'][0]);
  }

  Future<List<Garden>> getGardensByTopics(List<String> topics) async {
    // We need to build a dynamic query based on topics
    String query = '''
      SELECT * FROM gardens 
      WHERE topic_1 IN (${List.filled(topics.length, '?').join(', ')})
      OR topic_2 IN (${List.filled(topics.length, '?').join(', ')})
      OR topic_3 IN (${List.filled(topics.length, '?').join(', ')})
      OR topic_4 IN (${List.filled(topics.length, '?').join(', ')})
      OR topic_5 IN (${List.filled(topics.length, '?').join(', ')})
    ''';

    Map<String, dynamic> params = {};
    int paramIndex = 1;
    
    for (int i = 0; i < 5; i++) {
      for (int j = 0; j < topics.length; j++) {
        params['${paramIndex++}'] = topics[j];
      }
    }

    final result = await _executeQuery(query, params);
    return result['results'].map<Garden>((json) => Garden.fromJson(json)).toList();
  }

  Future<List<Garden>> getUserGardens(String userId) async {
    final result = await _executeQuery(
      '''
      SELECT g.* FROM gardens g
      JOIN memberships m ON g.id = m.garden_id
      JOIN devices d ON m.device_id = d.id
      WHERE d.identity_id = ?
      ''',
      {'1': userId},
    );

    return result['results'].map<Garden>((json) => Garden.fromJson(json)).toList();
  }

  // Message methods
  Future<void> saveMessage(Message message) async {
    await _executeQuery(
      '''
      INSERT INTO entries (id, garden_id, sender_device_id, ciphertext)
      VALUES (?, ?, ?, ?)
      ''',
      {
        '1': message.id,
        '2': message.gardenId,
        '3': message.senderId,
        '4': message.encryptedContent,
      },
    );
  }

  Future<List<Message>> getGardenMessages(String gardenId) async {
    final result = await _executeQuery(
      '''
      SELECT e.*, u.display_name as sender_name FROM entries e
      JOIN devices d ON e.sender_device_id = d.id
      JOIN users u ON d.identity_id = u.id
      WHERE e.garden_id = ?
      ORDER BY e.timestamp DESC
      LIMIT 100
      ''',
      {'1': gardenId},
    );

    return result['results'].map<Message>((json) => Message.fromJson(json)).toList();
  }

  // Membership methods
  Future<void> addMemberToGarden(String gardenId, String deviceId) async {
    await _executeQuery(
      'INSERT INTO memberships (garden_id, device_id) VALUES (?, ?)',
      {'1': gardenId, '2': deviceId},
    );
  }

  Future<List<String>> getGardenMembers(String gardenId) async {
    final result = await _executeQuery(
      '''
      SELECT u.id, u.display_name FROM users u
      JOIN devices d ON u.id = d.identity_id
      JOIN memberships m ON d.id = m.device_id
      WHERE m.garden_id = ?
      ''',
      {'1': gardenId},
    );

    return result['results'].map<String>((json) => json['id'].toString()).toList();
  }
}