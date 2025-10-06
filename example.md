#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <VL53L0X.h>
#include <freertos/semphr.h>

// --- User Configuration ---
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define API_KEY "AIzaSyBzRVVPbtqRIHaA7rUJOSK0qIyBsLPmvjU"
#define DATABASE_URL "https://i-cane-see-reborned-default-rtdb.firebaseio.com/"
#define DATABASE_SECRET "I8Zr1bApB54xB7MEuYYl0xtvoJEQ9Yl0Vcqi08lc"

// --- Globals ---
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
BLECharacteristic *pCaneStatusCharacteristic;
SemaphoreHandle_t i2cMutex;

String user_uid = "";
String wifi_ssid;
String wifi_password;
bool deviceConnected = false;

// --- BLE ---
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define WIFI_SSID_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define WIFI_PASS_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define USER_UID_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26ab"
#define CANE_STATUS_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26ad"

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
  };
  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
  }
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
const int xshutPins[NUM_SENSORS] = { 13, 14, 25, 26, 27 };
const uint8_t sensorAddresses[NUM_SENSORS] = { 0x31, 0x32, 0x33, 0x34, 0x35 };
VL53L0X sensors[NUM_SENSORS];
bool sensor_online[NUM_SENSORS] = {false};

void configureSensor(VL53L0X &sensor) {
  sensor.setMeasurementTimingBudget(100000);
  sensor.setSignalRateLimit(0.15);
  sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodPreRange, 18);
  sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodFinalRange, 14);
  sensor.setTimeout(500);
}

void setup() {
  Serial.begin(115200);
  i2cMutex = xSemaphoreCreateMutex();

  // Sensor initialization is now done in the FIREBASE_READY state

  // 2. Start BLE for provisioning
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
enum State { NOT_PROVISIONED,
             PROVISIONED,
             WIFI_CONNECTING,
             WIFI_CONNECTED,
             FIREBASE_INITIALIZING,
             FIREBASE_READY,
             DEVICE_ACTIVE };
State currentState = NOT_PROVISIONED;

void loop() {
  // Part 2: Connectivity State Machine
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
    case WIFI_CONNECTED:
      {
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
    case FIREBASE_READY:
      {
        // Stop BLE advertising to save power
        BLEDevice::getAdvertising()->stop();
        Serial.println("BLE Advertising stopped.");

        // Initialize sensors
        Serial.println("Initializing sensors...");
        pinMode(VIBRATION_PIN, OUTPUT);
        digitalWrite(VIBRATION_PIN, LOW);

        for (int i = 0; i < NUM_SENSORS; i++) {
          pinMode(xshutPins[i], OUTPUT);
          digitalWrite(xshutPins[i], LOW);
        }
        delay(100);

        myWire.begin(SDA_PIN, SCL_PIN);

        xSemaphoreTake(i2cMutex, portMAX_DELAY);
        for (int i = 0; i < NUM_SENSORS; i++) {
          Serial.printf("Initializing sensor %d...\n", i);
          digitalWrite(xshutPins[i], HIGH);
          delay(50);
          
          Serial.printf("  - Setting bus for sensor %d\n", i);
          sensors[i].setBus(&myWire);
          
          Serial.printf("  - Initializing sensor %d\n", i);
          if (sensors[i].init()) {
            Serial.printf("  - Sensor %d initialized\n", i);
            sensors[i].setAddress(sensorAddresses[i]);
            configureSensor(sensors[i]);
            sensors[i].startContinuous(100);
            sensor_online[i] = true;
            Serial.printf("  - Sensor %d configured and started\n", i);
          } else {
            Serial.printf("  - Sensor %d init failed, skipping\n", i);
          }
        }
        xSemaphoreGive(i2cMutex);
        Serial.println("Sensors initialized. Obstacle detection is active.");
        
        currentState = DEVICE_ACTIVE;
        break;
      }
    case DEVICE_ACTIVE:
      {
        // Part 1: Always-on obstacle detection
        float v[NUM_SENSORS];
        xSemaphoreTake(i2cMutex, portMAX_DELAY);
        for (int i = 0; i < NUM_SENSORS; i++) {
          if (!sensor_online[i]) {
            v[i] = NAN;
            continue;
          }
          v[i] = sensors[i].readRangeContinuousMillimeters() / 10.0;
        }
        xSemaphoreGive(i2cMutex);
        
        FirebaseJsonArray json_array;
        bool vibrate = false;

        if (!isnan(v[2]) && v[2] < 80.0) { json_array.add(2); vibrate = true; } // Depan
        if (!isnan(v[0]) && v[0] < 80.0) { json_array.add(0); vibrate = true; } // Atas
        if (!isnan(v[1]) && v[1] < 80.0) { json_array.add(1); vibrate = true; } // Depan Atas
        if (!isnan(v[4]) && v[4] < 80.0) { json_array.add(4); vibrate = true; } // Bawah
        if (!isnan(v[3]) && v[3] < 80.0) { json_array.add(3); vibrate = true; } // Depan Bawah
        
        if (!isnan(v[4]) && v[4] > 150.0) { json_array.add(5); vibrate = true; } // Turunan Dalam
        else if (!isnan(v[4]) && v[4] > 120.0) { json_array.add(6); vibrate = true; } // Turunan

        digitalWrite(VIBRATION_PIN, vibrate ? HIGH : LOW);

        if (Firebase.ready()) {
          String path = "/canes/" + user_uid + "/status";
          if (json_array.size() > 0) {
            if (Firebase.RTDB.setArray(&fbdo, path, &json_array)) {
              Serial.println("-> SUCCESS");
            } else {
              Serial.printf("-> FAILED: %s\n", fbdo.errorReason().c_str());
            }
          } else {
            // Delete the status node when there are no obstacles
            if (Firebase.RTDB.deleteNode(&fbdo, path)) {
              Serial.println("-> CLEARED STATUS");
            } else {
              Serial.printf("-> FAILED TO CLEAR: %s\n", fbdo.errorReason().c_str());
            }
          }
        }
        delay(500); // Add a 2-second delay
        break;
      }
  }
  delay(500);
}