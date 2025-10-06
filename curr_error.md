C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino: In function 'void handle_network()':
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino:199:26: error: 'lastSentObstacleCount' was not declared in this scope
  199 |     if (obstacleCount != lastSentObstacleCount) {
      |                          ^~~~~~~~~~~~~~~~~~~~~
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino:204:33: error: 'lastSentObstacleCodes' was not declared in this scope
  204 |         if (obstacleCodes[i] != lastSentObstacleCodes[i]) {
      |                                 ^~~~~~~~~~~~~~~~~~~~~
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino:214:7: error: 'lastSentObstacleCount' was not declared in this scope
  214 |       lastSentObstacleCount = obstacleCount;
      |       ^~~~~~~~~~~~~~~~~~~~~
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino:216:9: error: 'lastSentObstacleCodes' was not declared in this scope
  216 |         lastSentObstacleCodes[i] = obstacleCodes[i];
      |         ^~~~~~~~~~~~~~~~~~~~~
C:\Users\Bri\Documents\i-cane-see\tuna_V4\tuna_V4.ino:219:7: error: 'json_array' was not declared in this scope; did you mean 'd_array'?
  219 |       json_array.clear();
      |       ^~~~~~~~~~
      |       d_array
Multiple libraries were found for "SD.h"
  Used: C:\Users\Bri\AppData\Local\Arduino15\packages\esp32\hardware\esp32\3.3.0\libraries\SD
  Not used: C:\Users\Bri\AppData\Local\Arduino15\libraries\SD
exit status 1

Compilation error: 'lastSentObstacleCount' was not declared in this scope