#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <time.h>

// --- Config ---

#define FIREBASE_HOST "i-cane-see-be95e-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_API_KEY "AIzaSyAcyFaMEQ9JlLA_wvbS02b06PkpwL8udXk"
#define WIFI_SSID "BRIBER"
#define WIFI_PASSWORD "Matahari123"
#define USER_UID "TEST_USER"

// --- Globals ---

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

void setup() {
  Serial.begin(115200);

  // --- 1. WiFi Connection (Blocking) ---

  Serial.print("Connecting to WiFi: ");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected.");

  // --- 2. NTP Time Sync (Blocking) ---

  Serial.println("Syncing Time...");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) { // Wait for time to be set
    delay(500);
    now = time(nullptr);
  }
  Serial.println("Time Synced.");

  // --- 3. Firebase Initialization (Blocking) ---

  Serial.println("Initializing Firebase...");
  config.host = FIREBASE_HOST;
  config.api_key = FIREBASE_API_KEY;
  auth.user.uid = USER_UID;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // --- 4. Firebase Connectivity Test (Blocking) ---

  Serial.println("Performing Firebase connectivity test...");
  String testPath = "/canes/" + String(USER_UID) + "/connectivity_test";
  String testValue = "Cane connected at " + String(millis());

  if (Firebase.setString(fbdo, testPath, testValue)) {
    Serial.println("-> Firebase test write SUCCESS.");
  } else {
    Serial.println("!!! Firebase test write FAILED. Halting.");
    Serial.println(fbdo.errorReason());
    while(true) delay(100); // Halt
  }

  Serial.println("Firebase connectivity test passed.");
}

void loop() {
  delay(100);
}
