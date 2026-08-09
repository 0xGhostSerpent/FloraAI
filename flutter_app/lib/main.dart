import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'theme/theme_manager.dart';
import 'screens/onboarding_screen.dart';
import 'screens/home_screen.dart';
import 'services/storage_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Local DB (Hive)
  await Hive.initFlutter();
  await StorageService.init();

  runApp(
    const ProviderScope(
      child: FloraApp(),
    ),
  );
}

class FloraApp extends ConsumerWidget {
  const FloraApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeProvider);
    final appTheme = ref.watch(appThemeProvider);

    return MaterialApp(
      title: 'Flora AI',
      debugShowCheckedModeBanner: false,
      theme: appTheme.lightTheme,
      darkTheme: appTheme.darkTheme,
      themeMode: themeMode,
      home: const InitialRouteHandler(),
    );
  }
}

class InitialRouteHandler extends ConsumerWidget {
  const InitialRouteHandler({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Check if onboarding is complete and if paywall is required
    final hasOnboarded = StorageService.hasOnboarded();
    
    if (!hasOnboarded) {
      return const OnboardingScreen();
    }
    
    return const HomeScreen();
  }
}
