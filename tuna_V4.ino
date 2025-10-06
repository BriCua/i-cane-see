#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <VL53L0X.h>

// --- User Configuration ---
#define API_KEY "AIzaSyBzRVVPbtqRIHaA7rUJOSK0qIyBsLPmvjU"
#define DATABASE_URL "https://i-cane-see-reborned-default-rtdb.firebaseio.com/"
#define DATABASE_SECRET "I8Zr1bApB54xB7MEuYYl0xtvoJEQ9Yl0Vcqi08lc"

// --- Globals ---
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
BLECharacteristic *pCaneStatusCharacteristic;
FirebaseJsonArray json_array; // Global JSON array to reduce memory fragmentation

// Obstacle Data
#define MAX_OBSTACLES 10
int obstacleCodes[MAX_OBSTACLES];
int obstacleCount = 0;
int lastSentObstacleCodes[MAX_OBSTACLES];
int lastSentObstacleCount = -1; // -1 to force initial send

String user_uid = "";
String wifi_ssid;
String wifi_password;
bool deviceConnected = false;

// Timers
unsigned long lastSensorRead = 0;
unsigned long lastNetworkUpdate = 0;

// Settings
bool g_soundEnabled = true;
bool g_vibrationEnabled = true;

// --- BLE ---
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define WIFI_SSID_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define WIFI_PASS_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define USER_UID_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26ab"
#define CANE_STATUS_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26ad"

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) { deviceConnected = true; };
  void onDisconnect(BLEServer *pServer) { deviceConnected = false; }
};

class WifiSsidCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    wifi_ssid = pCharacteristic->getValue().c_str();
    Serial.print("SSID: ");
    Serial.println(wifi_ssid);
  }
};

class WifiPassCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    wifi_password = pCharacteristic->getValue().c_str();
    Serial.println("Password received.");
  }
};

class UserUidCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    user_uid = pCharacteristic->getValue().c_str();
    Serial.print("User UID: ");
    Serial.println(user_uid);
  }
};

// --- Sensors ---
#define SDA_PIN 33
#define SCL_PIN 32
#define VIBRATION_PIN 16
TwoWire myWire = TwoWire(1);
#define NUM_SENSORS 5
const int xshutPins[NUM_SENSORS] = {13, 14, 25, 26, 27};
const uint8_t sensorAddresses[NUM_SENSORS] = {0x31, 0x32, 0x33, 0x34, 0x35};
VL53L0X sensors[NUM_SENSORS];
bool sensor_online[NUM_SENSORS] = {false};

void configureSensor(VL53L0X &sensor) {
  sensor.setMeasurementTimingBudget(100000);
  sensor.setSignalRateLimit(0.1);
  sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodPreRange, 14);
  sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodFinalRange, 10);
  sensor.setTimeout(200);
}

void initialize_sensors() {
  Serial.println("Initializing sensors...");
  pinMode(VIBRATION_PIN, OUTPUT);
  digitalWrite(VIBRATION_PIN, LOW);

  for (int i = 0; i < NUM_SENSORS; i++) {
    pinMode(xshutPins[i], OUTPUT);
    digitalWrite(xshutPins[i], LOW);
  }
  delay(100);

  myWire.begin(SDA_PIN, SCL_PIN);

  for (int i = 0; i < NUM_SENSORS; i++) {
    digitalWrite(xshutPins[i], HIGH);
    delay(50);
    sensors[i].setBus(&myWire);
    if (sensors[i].init()) {
      sensors[i].setAddress(sensorAddresses[i]);
      configureSensor(sensors[i]);
      sensors[i].startContinuous(100);
      sensor_online[i] = true;
    } else {
      Serial.printf("Sensor %d init failed\n", i);
    }
  }
  Serial.println("Sensors initialized.");
}

void setup() {
  Serial.begin(115200);

  initialize_sensors();

  BLEDevice::init("I-Cane-See");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  BLECharacteristic *pWifiSsid = pService->createCharacteristic(WIFI_SSID_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
  pWifiSsid->setCallbacks(new WifiSsidCallbacks());
  BLECharacteristic *pWifiPass = pService->createCharacteristic(WIFI_PASS_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
  pWifiPass->setCallbacks(new WifiPassCallbacks());
  BLECharacteristic *pUserUid = pService->createCharacteristic(USER_UID_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
  pUserUid->setCallbacks(new UserUidCallbacks());
  pCaneStatusCharacteristic = pService->createCharacteristic(CANE_STATUS_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCaneStatusCharacteristic->addDescriptor(new BLE2902());
  pService->start();
  pServer->getAdvertising()->addServiceUUID(SERVICE_UUID);
  pServer->getAdvertising()->start();
  Serial.println("BLE provisioning service started.");
}

// --- State Machine ---
enum State { NOT_PROVISIONED, PROVISIONED, WIFI_CONNECTING, WIFI_CONNECTED, FIREBASE_INITIALIZING, FIREBASE_READY, DEVICE_ACTIVE };
State currentState = NOT_PROVISIONED;

void handle_sensors() {
  int localObstacleCount = 0;
  int localObstacleCodes[MAX_OBSTACLES];
  bool obstacleDetected = false;

  auto addObstacle = [&](int code) {
    if (localObstacleCount < MAX_OBSTACLES) {
      localObstacleCodes[localObstacleCount++] = code;
      obstacleDetected = true;
    }
  };

  float v[NUM_SENSORS];
  for (int i = 0; i < NUM_SENSORS; i++) {
    if (sensor_online[i]) {
      v[i] = sensors[i].readRangeContinuousMillimeters() / 10.0;
    } else {
      v[i] = NAN;
    }
  }

  if (!isnan(v[2]) && v[2] < 80.0) { addObstacle(2); } // Depan
  if (!isnan(v[0]) && v[0] < 80.0) { addObstacle(0); } // Atas
  if (!isnan(v[1]) && v[1] < 80.0) { addObstacle(1); } // Depan Atas
  if (!isnan(v[4]) && v[4] < 80.0) { addObstacle(4); } // Bawah
  if (!isnan(v[3]) && v[3] < 80.0) { addObstacle(3); } // Depan Bawah
  if (!isnan(v[4]) && v[4] > 150.0) { addObstacle(5); } // Turunan Dalam
  else if (!isnan(v[4]) && v[4] > 120.0) { addObstacle(6); } // Turunan

  bool shouldActivateFeedback = obstacleDetected && (g_soundEnabled || g_vibrationEnabled);
  digitalWrite(VIBRATION_PIN, shouldActivateFeedback ? HIGH : LOW);

  obstacleCount = localObstacleCount;
  for (int i = 0; i < localObstacleCount; i++) {
    obstacleCodes[i] = localObstacleCodes[i];
  }
}

void handle_network() {
  if (!Firebase.ready() || user_uid.length() == 0) return;

  unsigned long now = millis();

  // Send obstacle status only if it has changed
  if (now - lastNetworkUpdate > 500) { // Check for changes every 500ms
    lastNetworkUpdate = now;

    bool changed = false;
    if (obstacleCount != lastSentObstacleCount) {
      changed = true;
    } else {
      for (int i = 0; i < obstacleCount; i++) {
        if (obstacleCodes[i] != lastSentObstacleCodes[i]) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      lastSentObstacleCount = obstacleCount;
      for (int i = 0; i < obstacleCount; i++) {
        lastSentObstacleCodes[i] = obstacleCodes[i];
      }

      json_array.clear();
      for (int i = 0; i < obstacleCount; i++) {
        json_array.add(obstacleCodes[i]);
      }
      
      String path = "/canes/" + user_uid + "/status";
      if (json_array.size() > 0) {
        Firebase.RTDB.setArray(&fbdo, path, &json_array);
      } else {
        Firebase.RTDB.deleteNode(&fbdo, path);
      }
    }
  }
}

void loop() {
  // Always handle sensors if they are initialized
  unsigned long now = millis();
  if (now - lastSensorRead > 100) { // Read sensors every 100ms
    lastSensorRead = now;
    handle_sensors();
  }

  // Handle connectivity state machine and network operations
  switch (currentState) {
    case NOT_PROVISIONED:
      if (wifi_ssid.length() > 0 && wifi_password.length() > 0 && user_uid.length() > 0) {
        pCaneStatusCharacteristic->setValue("Credentials Received");
        pCaneStatusCharacteristic->notify();
        currentState = PROVISIONED;
      }
      break;
    case PROVISIONED:
      pCaneStatusCharacteristic->setValue("Connecting to WiFi...");
      pCaneStatusCharacteristic->notify();
      WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());
      currentState = WIFI_CONNECTING;
      break;
    case WIFI_CONNECTING:
      if (WiFi.status() == WL_CONNECTED) {
        pCaneStatusCharacteristic->setValue("WiFi Connected");
        pCaneStatusCharacteristic->notify();
        currentState = WIFI_CONNECTED;
      } else if (WiFi.status() == WL_CONNECT_FAILED || WiFi.status() == WL_CONNECTION_LOST || WiFi.status() == WL_NO_SSID_AVAIL) {
        pCaneStatusCharacteristic->setValue("WiFi Connection Failed");
        pCaneStatusCharacteristic->notify();
        currentState = NOT_PROVISIONED;
      }
      break;
    case WIFI_CONNECTED: {
      pCaneStatusCharacteristic->setValue("Initializing Firebase...");
      pCaneStatusCharacteristic->notify();
      config.api_key = API_KEY;
      config.database_url = DATABASE_URL;
      config.signer.tokens.legacy_token = DATABASE_SECRET;
      Firebase.begin(&config, &auth);
      Firebase.reconnectWiFi(true);
      currentState = FIREBASE_INITIALIZING;
      break;
    }
    case FIREBASE_INITIALIZING:
      if (Firebase.ready()) {
        pCaneStatusCharacteristic->setValue("Cane Ready");
        pCaneStatusCharacteristic->notify();
        currentState = FIREBASE_READY;
      }
      break;
    case FIREBASE_READY: {
      if (deviceConnected) {
         BLEDevice::getAdvertising()->stop();
         Serial.println("BLE Advertising stopped.");
      }
      
      // Fetch settings ONCE on initialization
      Serial.println("Firebase ready. Fetching initial settings...");
      String settingsPath = "/canes/" + user_uid + "/settings";
      if (Firebase.RTDB.getJSON(&fbdo, settingsPath)) {
        if (fbdo.dataType() == "json") {
          FirebaseJson &json = fbdo.jsonObject();
          FirebaseJsonData result;
          if (json.get(result, "enableSound")) {
            if (result.type == "boolean") g_soundEnabled = result.boolValue;
          }
          if (json.get(result, "enableVibration")) {
            if (result.type == "boolean") g_vibrationEnabled = result.boolValue;
          }
          Serial.println("Settings loaded.");
        }
      } else {
        Serial.println("Could not fetch settings, using defaults.");
      }

      Serial.println("Device is active.");
      currentState = DEVICE_ACTIVE;
      break;
    }
    case DEVICE_ACTIVE: {
      handle_network();
      break;
    }
  }
}