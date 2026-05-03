// gps_test.cpp  –  flash this temporarily to diagnose the NEO-6M
// Replace src/main.cpp contents, flash, open Serial Monitor at 115200
#include <Arduino.h>
#include <HardwareSerial.h>
#include <TinyGPS++.h>

HardwareSerial gpsSerial(2);
TinyGPSPlus    gps;
int count = 0;

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);
  Serial.println("=== NEO-6M test – waiting for fix... ===");
}

void loop() {
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  static uint32_t lastPrint = 0;
  if (millis() - lastPrint < 1000) return;
  lastPrint = millis();

  bool hasFix = gps.location.isValid() && gps.speed.isValid();
  uint8_t sats = gps.satellites.isValid() ? gps.satellites.value() : 0;

  if (!hasFix) {
    Serial.printf("Tries: %d, "
                  "No fix – satellites in view: %d\n", ++count, sats);

  } else {
    Serial.printf(
      "FIX  Lat: %.6f  Lon: %.6f  Speed: %.1f km/h  "
      "Heading: %.1f°  Alt: %.1f m  Sats: %d\n",
      gps.location.lat(), gps.location.lng(),
      gps.speed.kmph(), gps.course.deg(),
      gps.altitude.meters(), sats);
  }
}