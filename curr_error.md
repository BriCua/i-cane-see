C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino:21:1: error: 'PCharacteristic' does not name a type; did you mean 'BLECharacteristic'?
   21 | PCharacteristic *pCaneStatusCharacteristic;
      | ^~~~~~~~~~~~~~~
      | BLECharacteristic
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino: In function 'void setup()':
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino:162:3: error: 'pCaneStatusCharacteristic' was not declared in this scope; did you mean 'BLERemoteCharacteristic'?
  162 |   pCaneStatusCharacteristic = pService->createCharacteristic(CANE_STATUS_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
      |   ^~~~~~~~~~~~~~~~~~~~~~~~~
      |   BLERemoteCharacteristic
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino: In function 'void loop()':
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino:224:9: error: 'pCaneStatusCharacteristic' was not declared in this scope; did you mean 'BLERemoteCharacteristic'?
  224 |         pCaneStatusCharacteristic->setValue("Credentials Received");
      |         ^~~~~~~~~~~~~~~~~~~~~~~~~
      |         BLERemoteCharacteristic
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino:230:7: error: 'pCaneStatusCharacteristic' was not declared in this scope; did you mean 'BLERemoteCharacteristic'?
  230 |       pCaneStatusCharacteristic->setValue("Connecting to WiFi...");
      |       ^~~~~~~~~~~~~~~~~~~~~~~~~
      |       BLERemoteCharacteristic
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino:261:20: error: 'struct firebase_auth_signin_token_t' has no member named 'id_token'
  261 |         auth.token.id_token = id_token_str;  // Use ID token for auth
      |                    ^~~~~~~~
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino:277:62: error: 'class Firebase_ESP_Client' has no member named 'errorReason'
  277 |         Serial.printf("Firebase Auth Failed: %s\n", Firebase.errorReason().c_str());
      |                                                              ^~~~~~~~~~~
Multiple libraries were found for "SD.h"
  Used: C:\Users\Bri\AppData\Local\Arduino15\packages\esp32\hardware\esp32\3.3.0\libraries\SD
  Not used: C:\Users\Bri\AppData\Local\Arduino15\libraries\SD
exit status 1

Compilation error: 'PCharacteristic' does not name a type; did you mean 'BLECharacteristic'?