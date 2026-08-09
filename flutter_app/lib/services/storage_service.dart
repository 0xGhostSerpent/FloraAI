class StorageService {
  static Future<void> init() async {
    // Initialize Hive boxes and preferences
  }

  static bool hasOnboarded() {
    return false; // Implement SharedPreferences or Hive
  }

  static void setOnboarded(bool val) {
    // Set onboarded
  }

  static int getStreak() {
    return 1;
  }

  static DateTime? getTrialStartDate() {
    return DateTime.now().subtract(const Duration(days: 0));
  }

  static void setTrialStartDate(DateTime date) {
    // Set date
  }

  static bool isPremium() {
    return false; // Check revenue cat / local storage
  }

  static void setPremium(bool val) {
    // set premium
  }
}
