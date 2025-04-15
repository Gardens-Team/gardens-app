// lib/theme/colors.dart
import 'package:flutter/material.dart';

class AppColors {
  // Primary
  static const Color primary = Color(0xFF8E44AD); // Purple
  static const Color onPrimary = Color(0xFFFFFFFF); // White
  
  // Secondary
  static const Color secondary = Color(0xFF2980B9); // Blue
  static const Color onSecondary = Color(0xFFFFFFFF); // White
  
  // Background
  static const Color background = Color(0xFF121212); // Very dark gray
  static const Color onBackground = Color(0xFFFFFFFF); // White
  
  // Surface
  static const Color surface = Color(0xFF1E1E1E); // Dark gray
  static const Color onSurface = Color(0xFFFFFFFF); // White
  
  // Error
  static const Color error = Color(0xFFE74C3C); // Red
  static const Color onError = Color(0xFFFFFFFF); // White
  
  // Additional colors
  static const Color success = Color(0xFF2ECC71); // Green
  static const Color warning = Color(0xFFF39C12); // Orange
  static const Color info = Color(0xFF3498DB); // Light blue
  
  // Transparent black for overlays
  static Color overlay30 = Colors.black.withOpacity(0.3);
  static Color overlay50 = Colors.black.withOpacity(0.5);
  static Color overlay70 = Colors.black.withOpacity(0.7);
}