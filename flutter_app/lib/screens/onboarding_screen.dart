import 'package:flutter/material.dart';
import '../../services/storage_service.dart';
import 'home_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  bool _agreedToDisclaimer = false;

  void _completeOnboarding() {
    if (_agreedToDisclaimer) {
      StorageService.setOnboarded(true);
      // Generate trial start date
      StorageService.setTrialStartDate(DateTime.now());
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.eco, size: 80, color: Colors.green),
              const SizedBox(height: 24),
              Text(
                'Flora AI',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Your intelligent botanical companion. Manage your garden, track streaks, and chat with your plants.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.withOpacity(0.3)),
                ),
                child: Column(
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.shield, color: Colors.green),
                        SizedBox(width: 8),
                        Text('AI Liability Disclaimer', style: TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Flora AI provides plant identification and care suggestions through artificial intelligence. Information provided is for educational purposes only.\n\nDo not ingest or handle any unidentified plants. The developer assumes no liability for AI hallucinations or inaccuracies.',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Checkbox(
                          value: _agreedToDisclaimer,
                          onChanged: (val) {
                            setState(() {
                              _agreedToDisclaimer = val ?? false;
                            });
                          },
                        ),
                        const Expanded(
                          child: Text('I agree and understand the risks.', style: TextStyle(fontSize: 12)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _agreedToDisclaimer ? _completeOnboarding : null,
                  child: const Text('Get Started (Start 7-Day Trial)'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
