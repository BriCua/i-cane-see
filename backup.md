#define ENABLE_ID_TOKEN
#define ENABLE_DATABASE
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <freertos/semphr.h>
#include <FirebaseClient.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <VL53L0X.h>
#include <time.h>

// --- Config ---
#define FIREBASE_PROJECT_ID "i-cane-see-be95e"
#define FIREBASE_WEB_API_KEY "AIzaSyCsO1JUdMeoIe-BJgxg_vLVIgPe3kAyPsQ"



// --- Globals ---
FirebaseApp app;
WiFiClientSecure ssl_client;
AsyncClientClass aClient(ssl_client);
RealtimeDatabase Database;
BLECharacteristic *pCaneStatusCharacteristic;
SemaphoreHandle_t i2cMutex;

String user_uid = "";
String id_token_str = "";
String wifi_ssid;
String wifi_password;
String lastMessage = "";
bool id_token_fully_received = false;
bool deviceConnected = false;

// --- BLE ---
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define WIFI_SSID_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define WIFI_PASS_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define USER_UID_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26ab"
#define FIREBASE_TOKEN_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26aa"
#define FIREBASE_TOKEN_STATUS_UUID "beb5483e-36e1-4688-b7f5-ea07361b26ac"
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
class IdTokenCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    id_token_str += pCharacteristic->getValue().c_str();
  }
};
class TokenStatusCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String value = pCharacteristic->getValue().c_str();
    if (value == "START") {
      id_token_str = "";
      id_token_fully_received = false;
      Serial.println("Receiving token... (START signal)");
    } else if (value == "END") {
      if (id_token_str.length() > 0) {
        id_token_fully_received = true;
        Serial.print("Token fully received. Length: ");
        Serial.println(id_token_str.length());
      } else {
        Serial.println("!!! Token END signal received, but token string is empty. Retrying...");
        id_token_fully_received = false;
      }
    }
  }
};



// --- Sensors ---
#define SDA_PIN 33
#define SCL_PIN 32
#define VIBRATION_PIN 16
TwoWire myWire = TwoWire(1);  // Use I2C Port 1
#define NUM_SENSORS 5
const int xshutPins[NUM_SENSORS] = { 13, 14, 25, 26, 27 };
const uint8_t sensorAddresses[NUM_SENSORS] = { 0x31, 0x32, 0x33, 0x34, 0x35 };
VL53L0X sensors[NUM_SENSORS];

void configureSensor(VL53L0X &sensor) {
  sensor.setMeasurementTimingBudget(100000);
  sensor.setSignalRateLimit(0.15);
  sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodPreRange, 18);
  sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodFinalRange, 14);
  sensor.setTimeout(500);
}

void setup() {
  Serial.begin(115200);
  // i2cMutex = xSemaphoreCreateMutex();

  // 1. Initialize sensors and vibration motor first
  /*
  pinMode(VIBRATION_PIN, OUTPUT);
  digitalWrite(VIBRATION_PIN, LOW);

  // shutdown all VL53L0X
  for (int i = 0; i < NUM_SENSORS; i++) {
    pinMode(xshutPins[i], OUTPUT);
    digitalWrite(xshutPins[i], LOW);
  }
  delay(100);

  // init I2C on custom pins
  myWire.begin(SDA_PIN, SCL_PIN);

  // init each sensor one by one
  xSemaphoreTake(i2cMutex, portMAX_DELAY);
  for (int i = 0; i < NUM_SENSORS; i++) {
    digitalWrite(xshutPins[i], HIGH);
    delay(50);
    sensors[i].setBus(&myWire);
    if (sensors[i].init()) {
      sensors[i].setAddress(sensorAddresses[i]);
      configureSensor(sensors[i]);
      sensors[i].startContinuous(100);
    } else {
      Serial.printf("Sensor %d init failed\n", i);
    }
  }
  xSemaphoreGive(i2cMutex);
  Serial.println("Sensors initialized. Obstacle detection is active.");
  */

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
  BLECharacteristic *pIdToken = pService->createCharacteristic(FIREBASE_TOKEN_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
  pIdToken->setCallbacks(new IdTokenCallbacks());
  BLECharacteristic *pTokenStatus = pService->createCharacteristic(FIREBASE_TOKEN_STATUS_UUID, BLECharacteristic::PROPERTY_WRITE);
  pTokenStatus->setCallbacks(new TokenStatusCallbacks());
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
             FIREBASE_READY };
State currentState = NOT_PROVISIONED;

void loop() {
  // Part 1: Always-on obstacle detection
  /*
  float v[NUM_SENSORS];
  xSemaphoreTake(i2cMutex, portMAX_DELAY);
  for (int i = 0; i < NUM_SENSORS; i++) { v[i] = sensors[i].readRangeContinuousMillimeters() / 10.0; }
  xSemaphoreGive(i2cMutex);
  
  String combined = "";
  bool vibrate = false;
  // Obstacle conditions
  if (!isnan(v[2]) && v[2] < 80.0) { combined += "Depan "; vibrate = true; }
  if (!isnan(v[0]) && v[0] < 80.0) { combined += "Atas "; vibrate = true; }
  if (!isnan(v[1]) && v[1] < 80.0) { combined += "Depan Atas "; vibrate = true; }
  if (!isnan(v[4]) && v[4] < 80.0) { combined += "Bawah "; vibrate = true; }
  if (!isnan(v[3]) && v[3] < 80.0) { combined += "Depan Bawah "; vibrate = true; }
  // Slope conditions
  if (!isnan(v[4]) && v[4] > 150.0) { combined += "Turunan Dalam "; vibrate = true; }
  else if (!isnan(v[4]) && v[4] > 120.0) { combined += "Turunan "; vibrate = true; }

  digitalWrite(VIBRATION_PIN, vibrate ? HIGH : LOW);
  */

  // Part 2: Connectivity State Machine
  switch (currentState) {
    case NOT_PROVISIONED:
      if (wifi_ssid.length() > 0 && wifi_password.length() > 0 && user_uid.length() > 0 && id_token_fully_received) {
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
        pCaneStatusCharacteristic->setValue("Syncing Time...");
        pCaneStatusCharacteristic->notify();
        configTime(0, 0, "pool.ntp.org", "time.nist.gov");
        time_t now = time(nullptr);
        while (now < 8 * 3600 * 2) {
          delay(500);
          now = time(nullptr);
        }
        pCaneStatusCharacteristic->setValue("Initializing Firebase...");
        pCaneStatusCharacteristic->notify();
              ssl_client.setInsecure();        IDToken id_token(FIREBASE_WEB_API_KEY, id_token_str, 3600);
        initializeApp(aClient, app, getAuth(id_token));
        app.getApp(Database);
        Database.url("https://i-cane-see-be95e-default-rtdb.asia-southeast1.firebasedatabase.app");
        currentState = FIREBASE_INITIALIZING;
        break;
      }
    case FIREBASE_INITIALIZING:
      app.loop();
      if (app.ready()) {
        // Stop BLE advertising to save power and resources
        BLEDevice::getAdvertising()->stop();
        Serial.println("BLE Advertising stopped.");

        pCaneStatusCharacteristic->setValue("Cane Ready");
        pCaneStatusCharacteristic->notify();
        currentState = FIREBASE_READY;
      } else if (aClient.lastError().code() != 0) {
        pCaneStatusCharacteristic->setValue("Firebase Auth Failed");
        pCaneStatusCharacteristic->notify();
        currentState = NOT_PROVISIONED;
      }
      break;
    case FIREBASE_READY:
      app.loop();
      Serial.println("Firebase READY state entered. Attempting test write/read...");
      {
        String testPath = "/canes/" + user_uid + "/connectivity_test";
        String testValue = "Cane connected at " + String(millis());
        if (Database.set(aClient, testPath.c_str(), testValue)) {
          Serial.println("-> Firebase test write SUCCESS.");
          String read_value = Database.get<String>(aClient, testPath.c_str());
          if (aClient.lastError().code() == 0) {
            Serial.print("-> Verification SUCCESS. Read back: '");
            Serial.print(read_value);
            Serial.println("' ");
            if (read_value != testValue) {
              Serial.println("!!! Verification WARNING: Read-back value does not match sent value.");
            }
          } else {
            Serial.println("!!! Firebase test read FAILED.");
            Firebase.printf("-> Error: %s\n", aClient.lastError().message().c_str());
          }
        } else {
          Serial.println("!!! Firebase test write FAILED.");
          Firebase.printf("-> Error: %s\n", aClient.lastError().message().c_str());
        }
      }
      break;
  }
  delay(500);
}