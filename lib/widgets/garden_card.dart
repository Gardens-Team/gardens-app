// lib/widgets/garden_card.dart
import 'package:flutter/material.dart';
import '../models/garden.dart';

class GardenCard extends StatelessWidget {
  final Garden garden;
  final VoidCallback onTap;

  const GardenCard({
    Key? key,
    required this.garden,
    required this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.0)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16.0),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                garden.name,
                style: theme.textTheme.titleLarge,
              ),
              const SizedBox(height: 8.0),
              Wrap(
                spacing: 8.0,
                children: garden.getTopics().map((topic) {
                  return Chip(
                    label: Text(topic),
                    backgroundColor: theme.colorScheme.surface,
                    labelStyle: TextStyle(color: theme.colorScheme.onSurface),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16.0),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    "Join Garden",
                    style: TextStyle(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: 4.0),
                  Icon(
                    Icons.arrow_forward,
                    size: 16.0,
                    color: theme.colorScheme.primary,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}