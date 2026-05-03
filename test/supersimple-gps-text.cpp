// gps_test.cpp  –  flash this temporarily to diagnose the NEO-6M
// Replace src/main.cpp contents, flash, open Serial Monitor at 115200
#include <Arduino.h>
#include <HardwareSerial.h>

HardwareSerial gpsSerial(2);   // UART2

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);  // RX=GPIO16, TX=GPIO17
  Serial.println("=== NEO-6M raw NMEA test ===");
}

void loop() {
  while (gpsSerial.available()) {
    Serial.write(gpsSerial.read());  // forward every byte raw to USB serial
  }
}