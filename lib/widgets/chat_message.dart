// lib/widgets/chat_message.dart
import 'package:flutter/material.dart';
import '../models/message.dart';

class ChatMessageWidget extends StatelessWidget {
  final Message message;
  final bool isCurrentUser;
  final String senderName;

  const ChatMessageWidget({
    Key? key,
    required this.message,
    required this.isCurrentUser,
    required this.senderName,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Align(
      alignment: isCurrentUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        margin: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
        padding: const EdgeInsets.all(12.0),
        decoration: BoxDecoration(
          color: isCurrentUser ? theme.colorScheme.primary : theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(16.0),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!isCurrentUser)
              Padding(
                padding: const EdgeInsets.only(bottom: 4.0),
                child: Text(
                  senderName,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: isCurrentUser ? theme.colorScheme.onPrimary : theme.colorScheme.primary,
                    fontSize: 12.0,
                  ),
                ),
              ),
            Text(
              message.decryptedContent ?? 'Unable to decrypt message',
              style: TextStyle(
                color: isCurrentUser ? theme.colorScheme.onPrimary : theme.colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 4.0),
            Align(
              alignment: Alignment.bottomRight,
              child: Text(
                _formatTimestamp(message.timestamp),
                style: TextStyle(
                  fontSize: 10.0,
                  color: isCurrentUser ? theme.colorScheme.onPrimary.withOpacity(0.7) : theme.colorScheme.onSurface.withOpacity(0.7),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  String _formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final messageDay = DateTime(timestamp.year, timestamp.month, timestamp.day);
    
    if (messageDay == today) {
      return '${timestamp.hour.toString().padLeft(2, '0')}:${timestamp.minute.toString().padLeft(2, '0')}';
    } else {
      return '${timestamp.day}/${timestamp.month} ${timestamp.hour.toString().padLeft(2, '0')}:${timestamp.minute.toString().padLeft(2, '0')}';
    }
  }
}