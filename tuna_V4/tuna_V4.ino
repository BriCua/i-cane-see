#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <freertos/semphr.h>

SemaphoreHandle_t i2cMutex;
#define ENABLE_ID_TOKEN
#define ENABLE_DATABASE
#include <FirebaseClient.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Firebase project ID
#define FIREBASE_PROJECT_ID "i-cane-see-be95e"

// Firebase web API key
#define FIREBASE_WEB_API_KEY "AIzaSyAcyFaMEQ9JlLA_wvbS02b06PkpwL8udXk"

// User UID (will be updated from BLE)
String user_uid = "";

// Define Firebase objects
FirebaseApp app;
WiFiClientSecure ssl_client;
AsyncClientClass aClient(ssl_client);
RealtimeDatabase Database;
BLECharacteristic *pCaneStatusCharacteristic;

// Variable to store the ID token
String id_token_str = "";

// Variables to store WiFi credentials
String wifi_ssid;
String wifi_password;

#include <Wire.h>
#include <VL53L0X.h>
#include <time.h>


#define SDA_PIN 33
#define SCL_PIN 32
#define VIBRATION_PIN 16

TwoWire myWire = TwoWire(0);

#define NUM_SENSORS 5
const int xshutPins[NUM_SENSORS] = { 13, 14, 25, 26, 27 };
const uint8_t sensorAddresses[NUM_SENSORS] = { 0x31, 0x32, 0x33, 0x34, 0x35 };
VL53L0X sensors[NUM_SENSORS];


String lastMessage = "";

// BLE Service and Characteristic UUIDs
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define WIFI_SSID_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define WIFI_PASS_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define USER_UID_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26ab"
#define FIREBASE_TOKEN_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26aa"
#define FIREBASE_TOKEN_STATUS_UUID "beb5483e-36e1-4688-b7f5-ea07361b26ac"
#define CANE_STATUS_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26ad"

bool id_token_fully_received = false;

bool deviceConnected = false;

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

class WifiSsidCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      wifi_ssid = pCharacteristic->getValue().c_str();
      Serial.print("SSID: ");
      Serial.println(wifi_ssid);
    }
};

class WifiPassCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      wifi_password = pCharacteristic->getValue().c_str();
      Serial.println("Password received.");
    }
};

class UserUidCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      user_uid = pCharacteristic->getValue().c_str();
      Serial.print("User UID: ");
      Serial.println(user_uid);
    }
};

class IdTokenCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      id_token_str += pCharacteristic->getValue().c_str();
    }
};

class TokenStatusCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = pCharacteristic->getValue().c_str();
      if (value == "START") {
        id_token_str = "";
        id_token_fully_received = false;
        Serial.println("Receiving token...");
      } else if (value == "END") {
        id_token_fully_received = true;
        Serial.println("Token fully received.");
      }
    }
};

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

  // Initialize sensors and vibration motor first
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
    if (!sensors[i].init()) {
      Serial.printf("❌ Gagal init sensor %d\r\n", i + 1);
      // Don't block here, just print an error
    } else {
      sensors[i].setAddress(sensorAddresses[i]);
      configureSensor(sensors[i]);
      sensors[i].startContinuous(100);
    }
  }
  xSemaphoreGive(i2cMutex);
  Serial.println("Sensors initialized. Obstacle detection is active.");

  // Start BLE for provisioning in the background
  Serial.println("Starting BLE for provisioning...");
  BLEDevice::init("I-Cane-See");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);

  BLECharacteristic *pWifiSsidCharacteristic = pService->createCharacteristic(
                                         WIFI_SSID_CHAR_UUID,
                                         BLECharacteristic::PROPERTY_WRITE
                                       );
  pWifiSsidCharacteristic->setCallbacks(new WifiSsidCallbacks());

  BLECharacteristic *pWifiPassCharacteristic = pService->createCharacteristic(
                                         WIFI_PASS_CHAR_UUID,
                                         BLECharacteristic::PROPERTY_WRITE
                                       );
  pWifiPassCharacteristic->setCallbacks(new WifiPassCallbacks());

  BLECharacteristic *pUserUidCharacteristic = pService->createCharacteristic(
                                         USER_UID_CHAR_UUID,
                                         BLECharacteristic::PROPERTY_WRITE
                                       );
  pUserUidCharacteristic->setCallbacks(new UserUidCallbacks());

  BLECharacteristic *pIdTokenCharacteristic = pService->createCharacteristic(
                                         FIREBASE_TOKEN_CHAR_UUID,
                                         BLECharacteristic::PROPERTY_WRITE
                                       );
  pIdTokenCharacteristic->setCallbacks(new IdTokenCallbacks());

  BLECharacteristic *pTokenStatusCharacteristic = pService->createCharacteristic(
                                         FIREBASE_TOKEN_STATUS_UUID,
                                         BLECharacteristic::PROPERTY_WRITE
                                       );
  pTokenStatusCharacteristic->setCallbacks(new TokenStatusCallbacks());

  pCaneStatusCharacteristic = pService->createCharacteristic(
                                         CANE_STATUS_CHAR_UUID,
                                         BLECharacteristic::PROPERTY_READ |
                                         BLECharacteristic::PROPERTY_NOTIFY
                                       );
  pCaneStatusCharacteristic->addDescriptor(new BLE2902());

  pService->start();
  pServer->getAdvertising()->addServiceUUID(SERVICE_UUID);
  pServer->getAdvertising()->start();
  Serial.println("BLE provisioning service started.");
}

// State machine for connectivity
enum State {
  NOT_PROVISIONED,
  PROVISIONED,
  WIFI_CONNECTING,
  WIFI_CONNECTED,
  FIREBASE_INITIALIZING,
  FIREBASE_READY
};
State currentState = NOT_PROVISIONED;

void loop() {
  // --- Part 1: Always-on obstacle detection ---
  float v[NUM_SENSORS];
  xSemaphoreTake(i2cMutex, portMAX_DELAY);
  for (int i = 0; i < NUM_SENSORS; i++) {
    uint16_t mm = sensors[i].readRangeContinuousMillimeters();
    if (sensors[i].timeoutOccurred() || mm == 0 || mm > 8000) {
      v[i] = NAN;
    } else {
      v[i] = mm / 10.0;  // convert to cm
    }
  }
  xSemaphoreGive(i2cMutex);

  String messages[6];
  int cnt = 0;
  bool vibrate = false;

  // Obstacle conditions
  if (!isnan(v[2]) && v[2] < 80.0) {
    messages[cnt++] = "Depan";
    vibrate = true;
  }
  if (!isnan(v[0]) && v[0] < 80.0) {
    messages[cnt++] = "atas";
    vibrate = true;
  }
  if (!isnan(v[1]) && v[1] < 80.0) {
    messages[cnt++] = "depan atas";
    vibrate = true;
  }

  if (!isnan(v[4]) && v[4] < 80.0) {
    messages[cnt++] = "bawah";
    vibrate = true;
  }
  if (!isnan(v[3]) && v[3] < 80.0) {
    messages[cnt++] = "depan bawah";
    vibrate = true;
  }


  // Slope conditions (no double output)
  if (!isnan(v[4]) && v[4] > 150.0) {
    messages[cnt++] = "turunan dalam";
    vibrate = true;
  } else if (!isnan(v[4]) && v[4] > 120.0) {
    messages[cnt++] = "turunan";
    vibrate = true;
  }

  String combined = "";
  for (int i = 0; i < cnt; i++) {
    if (i) combined += " | ";
    combined += messages[i];
  }

  digitalWrite(VIBRATION_PIN, vibrate ? HIGH : LOW);


  // --- Part 2: Non-blocking connectivity and data sending ---
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
        currentState = NOT_PROVISIONED; // Go back to waiting for credentials
      }
      break;

    case WIFI_CONNECTED: {
      pCaneStatusCharacteristic->setValue("Syncing Time...");
      pCaneStatusCharacteristic->notify();
      
      // Synchronize time with NTP server for SSL certificate validation
      configTime(0, 0, "pool.ntp.org", "time.nist.gov");
      time_t now = time(nullptr);
      while (now < 8 * 3600 * 2) { // Wait for time to be set
        delay(500);
        now = time(nullptr);
      }
      
      pCaneStatusCharacteristic->setValue("Initializing Firebase...");
      pCaneStatusCharacteristic->notify();
      
      ssl_client.setInsecure(); // We still set insecure, but time is good practice
      IDToken id_token(FIREBASE_WEB_API_KEY, id_token_str, 3600);
      initializeApp(aClient, app, getAuth(id_token));
      app.getApp(Database);
      Database.url("https://i-cane-see-be95e-default-rtdb.asia-southeast1.firebasedatabase.app");
      currentState = FIREBASE_INITIALIZING;
      break;
    }

    case FIREBASE_INITIALIZING:
      app.loop();
      if (app.ready()) {
        pCaneStatusCharacteristic->setValue("Cane Ready");
        pCaneStatusCharacteristic->notify();
        currentState = FIREBASE_READY;
      } else if (aClient.lastError().code() != 0) {
        pCaneStatusCharacteristic->setValue("Firebase Auth Failed");
        pCaneStatusCharacteristic->notify();
        currentState = NOT_PROVISIONED; // Go back to waiting
      }
      break;

    case FIREBASE_READY:
      app.loop();

      if (combined != lastMessage) {
        String path = "/canes/" + user_uid + "/status";
        Serial.println("Message changed. Attempting to send to Firebase...");
        
        // 1. Write the data
        if (Database.set(aClient, path.c_str(), combined)) {
          Serial.println("-> Firebase.set() reported success.");
          
          // 2. Immediately try to read it back to verify
          Serial.println("-> Verifying write by reading data back...");
          String read_value = Database.get<String>(aClient, path.c_str());

          if (aClient.lastError().code() == 0) {
            Serial.print("-> Verification SUCCESS. Read back: '");
            Serial.print(read_value);
            Serial.println("'");
            if (read_value != combined) {
               Serial.println("!!! Verification WARNING: Read-back value does not match sent value.");
            }
          } else {
            Serial.println("!!! Verification FAILED: get() failed after a successful set().");
            Firebase.printf("-> Error: %s\n", aClient.lastError().message().c_str());
          }

        } else {
          Serial.println("!!! Firebase.set() failed!");
          Firebase.printf("-> Error: %s\n", aClient.lastError().message().c_str());
        }
        lastMessage = combined;
      }

      if (cnt == 0 && lastMessage != "") {
        lastMessage = "";
        String path = "/canes/" + user_uid + "/status";
        Serial.println("No obstacles. Clearing status in Firebase...");
        if (Database.set(aClient, path.c_str(), "")) {
            Serial.println("-> Firebase.set() for clear reported success. Verifying...");
            String read_value = Database.get<String>(aClient, path.c_str());
            if (aClient.lastError().code() == 0) {
              Serial.print("-> Verification SUCCESS. Read back: '");
              Serial.print(read_value);
              Serial.println("'");
            } else {
              Serial.println("!!! Verification FAILED for clear.");
            }
        } else {
            Serial.println("!!! Failed to clear Firebase status!");
        }
      }
      break;
  }

  delay(50);
}
