import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/storage_service.dart';
import 'scanner_screen.dart';
import 'paywall_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _streak = 0;

  @override
  void initState() {
    super.initState();
    _streak = StorageService.getStreak();
    // Check trial
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkSubscriptionStatus();
    });
  }

  void _checkSubscriptionStatus() {
    final isPremium = StorageService.isPremium();
    final trialDate = StorageService.getTrialStartDate();
    if (!isPremium && trialDate != null) {
      final daysDiff = DateTime.now().difference(trialDate).inDays;
      if (daysDiff > 7) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const PaywallScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Garden'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: Row(
              children: [
                const Icon(Icons.local_fire_department, color: Colors.orange),
                const SizedBox(width: 4),
                Text('$_streak', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              // Navigate to Settings
            },
          ),
        ],
      ),
      body: const Center(
        child: Text('Garden List Empty - Local DB Integration Pending'),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const ScannerScreen()),
          );
        },
        icon: const Icon(Icons.camera_alt),
        label: const Text('Scan Plant'),
      ),
    );
  }
}
