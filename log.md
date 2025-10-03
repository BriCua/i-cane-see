#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <FirebaseClient.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#include <Wire.h>
#include <VL53L0X.h>

// ========== Pins ==========
#define SDA_PIN        33
#define SCL_PIN        32
#define VIBRATION_PIN  16
TwoWire myWire = TwoWire(0);

// ========== Sensors ==========
#define NUM_SENSORS 5
const int xshutPins[NUM_SENSORS] = {13, 14, 25, 26, 27};
const uint8_t sensorAddresses[NUM_SENSORS] = {0x31,0x32,0x33,0x34,0x35};
VL53L0X sensors[NUM_SENSORS];

// ========== BLE UUIDs ==========
#define SERVICE_UUID              "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define WIFI_SSID_CHAR_UUID       "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define WIFI_PASS_CHAR_UUID       "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define USER_UID_CHAR_UUID        "beb5483e-36e1-4688-b7f5-ea07361b26ab"
#define FIREBASE_TOKEN_CHAR_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26aa"
#define CANE_STATUS_CHAR_UUID     "beb5483e-36e1-4688-b7f5-ea07361b26ad"

BLECharacteristic *pCaneStatusCharacteristic;

// ========== Firebase ==========
#define FIREBASE_PROJECT_ID "i-cane-see-be95e"
#define FIREBASE_WEB_API_KEY "AIzaSyCsO1JUdMeoIe-BJgxg_vLVIgPe3kAyPsQ"

FirebaseApp app;
WiFiClientSecure ssl_client;
DefaultNetwork aClient(ssl_client);
RealtimeDatabase Database;

String wifi_ssid, wifi_password, user_uid, id_token_str;
bool id_token_ready = false;
String lastMessage = "";

// ========== Sensor config ==========
void configureSensor(VL53L0X &sensor) {
  sensor.setMeasurementTimingBudget(100000);
  sensor.setSignalRateLimit(0.15);
  sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodPreRange, 18);
  sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodFinalRange, 14);
  sensor.setTimeout(500);
}

// ========== BLE Callbacks ==========
class WifiSsidCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    wifi_ssid = pCharacteristic->getValue().c_str();
    Serial.print("SSID: "); Serial.println(wifi_ssid);
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
    Serial.print("User UID: "); Serial.println(user_uid);
  }
};
class IdTokenCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    id_token_str = pCharacteristic->getValue().c_str();
    id_token_ready = true;
    Serial.println("Token received.");
  }
};

// ========== State machine ==========
enum State { NOT_PROVISIONED, WIFI_CONNECTING, WIFI_CONNECTED, FIREBASE_READY };
State currentState = NOT_PROVISIONED;

// ========== Setup ==========
void setup() {
  Serial.begin(115200);

  pinMode(VIBRATION_PIN, OUTPUT);
  digitalWrite(VIBRATION_PIN, LOW);

  // shutdown all VL53L0X
  for (int i = 0; i < NUM_SENSORS; i++) {
    pinMode(xshutPins[i], OUTPUT);
    digitalWrite(xshutPins[i], LOW);
  }
  delay(100);

  myWire.begin(SDA_PIN, SCL_PIN);

  // init sensors
  for (int i = 0; i < NUM_SENSORS; i++) {
    digitalWrite(xshutPins[i], HIGH);
    delay(50);
    sensors[i].setBus(&myWire);
    if (!sensors[i].init()) {
      Serial.printf("Sensor %d failed!\n", i);
    } else {
      sensors[i].setAddress(sensorAddresses[i]);
      configureSensor(sensors[i]);
      sensors[i].startContinuous(100);
    }
  }

  // BLE provisioning
  BLEDevice::init("I-Cane-See");
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(SERVICE_UUID);

  BLECharacteristic *pWifiSsid = pService->createCharacteristic(WIFI_SSID_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
  pWifiSsid->setCallbacks(new WifiSsidCallbacks());

  BLECharacteristic *pWifiPass = pService->createCharacteristic(WIFI_PASS_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
  pWifiPass->setCallbacks(new WifiPassCallbacks());

  BLECharacteristic *pUserUid = pService->createCharacteristic(USER_UID_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
  pUserUid->setCallbacks(new UserUidCallbacks());

  BLECharacteristic *pIdToken = pService->createCharacteristic(FIREBASE_TOKEN_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
  pIdToken->setCallbacks(new IdTokenCallbacks());

  pCaneStatusCharacteristic = pService->createCharacteristic(CANE_STATUS_CHAR_UUID,
                                    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCaneStatusCharacteristic->addDescriptor(new BLE2902());

  pService->start();
  pServer->getAdvertising()->addServiceUUID(SERVICE_UUID);
  pServer->getAdvertising()->start();

  Serial.println("BLE Provisioning started...");
}

// ========== Loop ==========
void loop() {
  switch (currentState) {
    case NOT_PROVISIONED:
      if (wifi_ssid.length() && wifi_password.length() && user_uid.length() && id_token_ready) {
        WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());
        pCaneStatusCharacteristic->setValue("Connecting WiFi...");
        pCaneStatusCharacteristic->notify();
        currentState = WIFI_CONNECTING;
      }
      break;

    case WIFI_CONNECTING:
      if (WiFi.status() == WL_CONNECTED) {
        pCaneStatusCharacteristic->setValue("WiFi Connected");
        pCaneStatusCharacteristic->notify();
        ssl_client.setInsecure();
        {
          IDToken id_token(FIREBASE_WEB_API_KEY, id_token_str, 3600);
          initializeApp(aClient, app, getAuth(id_token));
          app.getApp(Database);
          Database.url("https://i-cane-see-be95e-default-rtdb.asia-southeast1.firebasedatabase.app");
        }
        currentState = FIREBASE_READY;
      }
      break;

    case FIREBASE_READY: {
      app.loop();

      // === sensor reading ===
      float v[NUM_SENSORS];
      for (int i = 0; i < NUM_SENSORS; i++) {
        uint16_t mm = sensors[i].readRangeContinuousMillimeters();
        if (sensors[i].timeoutOccurred() || mm == 0 || mm > 8000) v[i] = NAN;
        else v[i] = mm / 10.0;
      }

      String combined = "";
      bool vibrate = false;
      if (!isnan(v[2]) && v[2] < 80.0) { combined += "Depan "; vibrate = true; }
      if (!isnan(v[0]) && v[0] < 80.0) { combined += "Atas "; vibrate = true; }
      if (!isnan(v[4]) && v[4] < 80.0) { combined += "Bawah "; vibrate = true; }

      digitalWrite(VIBRATION_PIN, vibrate ? HIGH : LOW);

      if (combined != lastMessage) {
        String path = "/canes/" + user_uid + "/status";
        if (Database.set(aClient, path.c_str(), combined)) {
          Serial.println("Sent to Firebase: " + combined);
        } else {
          Serial.printf("Firebase error: %s\n", aClient.lastError().message().c_str());
        }
        lastMessage = combined;
      }
      break;
    }
  }

  delay(200);
}
