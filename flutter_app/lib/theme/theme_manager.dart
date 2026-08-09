import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

enum AppThemeType {
  botanicalMinimalist,
  tamagotchiGarden,
  cyberBotanical,
}

// Provider for current theme setting
final themeTypeProvider = StateProvider<AppThemeType>((ref) => AppThemeType.botanicalMinimalist);
final themeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.light);

// Provider for theme configuration based on selected Type
final appThemeProvider = Provider<AppTheme>((ref) {
  final type = ref.watch(themeTypeProvider);
  switch (type) {
    case AppThemeType.botanicalMinimalist:
      return BotanicalMinimalistTheme();
    case AppThemeType.tamagotchiGarden:
      return TamagotchiGardenTheme();
    case AppThemeType.cyberBotanical:
      return CyberBotanicalTheme();
  }
});

abstract class AppTheme {
  ThemeData get lightTheme;
  ThemeData get darkTheme;
}

class BotanicalMinimalistTheme implements AppTheme {
  @override
  ThemeData get lightTheme => ThemeData(
    primaryColor: const Color(0xFF6B8E23), // Sage Green
    scaffoldBackgroundColor: const Color(0xFFFAF9F6), // Warm Cream
    colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6B8E23)),
    textTheme: GoogleFonts.loraTextTheme(), // Serif
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      iconTheme: IconThemeData(color: Colors.black87),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFFE2725B), // Terracotta
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
    ),
  );

  @override
  ThemeData get darkTheme => lightTheme; // Optionally implement native dark variants
}

class TamagotchiGardenTheme implements AppTheme {
  @override
  ThemeData get lightTheme => ThemeData(
    primaryColor: const Color(0xFF98FB98), // Pastel Green
    scaffoldBackgroundColor: const Color(0xFFFFFACD), // Sunny Yellow
    colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF98FB98)),
    textTheme: GoogleFonts.nunitoTextTheme(), // Friendly rounded font
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      iconTheme: IconThemeData(color: Colors.black87),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFFFF69B4), // Hot pink accents
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(40)),
        side: const BorderSide(color: Colors.black, width: 2), // Thick borders
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
    ),
    cardTheme: CardTheme(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: Colors.black, width: 2),
      ),
    ),
  );

  @override
  ThemeData get darkTheme => lightTheme;
}

class CyberBotanicalTheme implements AppTheme {
  @override
  ThemeData get lightTheme => ThemeData(
    brightness: Brightness.dark,
    primaryColor: const Color(0xFF39FF14), // Neon Green
    scaffoldBackgroundColor: const Color(0xFF000000), // Pitch Black
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(0xFF39FF14),
      brightness: Brightness.dark,
    ).copyWith(secondary: const Color(0xFF8A2BE2)), // Electric Violet
    textTheme: GoogleFonts.firaCodeTextTheme(ThemeData.dark().textTheme), // Monospace
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      iconTheme: IconThemeData(color: Color(0xFF39FF14)),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.transparent,
        foregroundColor: const Color(0xFF39FF14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(0),
          side: const BorderSide(color: Color(0xFF39FF14), width: 2),
        ),
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
    ),
  );

  @override
  ThemeData get darkTheme => lightTheme;
}
