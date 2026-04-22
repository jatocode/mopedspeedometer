// src/main.cpp
// GPS-driven pulse emulator – replaces magnetic wheel sensor
// + BLE GATT server for live telemetry and remote toggle output
//
// Wiring:
//   NEO-6M TX   → ESP32 GPIO16 (UART2 RX)
//   ESP32 GPIO25 → 1kΩ → NPN base  → instrument pulse (12V active-low)
//   ESP32 GPIO26 → transistor/relay → toggleable aux output
//
// BLE Service UUID : 4fafc201-1fb5-459e-8fcc-c5c9c331914b
// Characteristics:
//   SPEED_KMH   (notify, float32 little-endian, km/h)
//   HEADING     (notify, float32, degrees)
//   ALTITUDE    (notify, float32, metres)
//   SATELLITES  (notify, uint8)
//   FIX_STATUS  (notify, uint8  0=no fix 1=fix)
//   AUX_OUTPUT  (read/write, uint8  0=off 1=on)  – controls GPIO26
//
// Libraries:
//   mikalhart/TinyGPSPlus  (platformio.ini)
//   BLE / WiFi / ArduinoOTA (built-in ESP32 Arduino Core, no extra dep)
//
// OTA:
//   After first USB flash the board is reachable as 'moped-speedo' on the LAN.
//   In PlatformIO: Upload → select 'moped-speedo.local' as upload target.
//   WiFi credentials live in include/secrets.h (gitignored).

#include <Arduino.h>
#include <HardwareSerial.h>
#include <TinyGPS++.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>   // CCCD descriptor – enables client notifications
#include <WiFi.h>
#include <ArduinoOTA.h>
#include "secrets.h"   // #define WIFI_SSID / WIFI_PASSWORD (gitignored)

// ── Configuration ──────────────────────────────────────────────────────────────
const float WHEEL_CIRCUMFERENCE_M = 1.85f;
const int   PULSES_PER_REV        = 1;

const int   PULSE_OUTPUT_PIN = 25;   // → NPN base, instrument pulse
const int   AUX_OUTPUT_PIN   = 26;   // → transistor/relay, toggleable aux
const int   STATUS_LED_PIN   = 5;    // built-in LED, mirrors AUX state

const int   GPS_RX_PIN = 16;
const int   GPS_TX_PIN = 17;
const long  GPS_BAUD   = 9600;

constexpr char DEVICE_NAME[]     = "MopedSpeedo";
constexpr char SERVICE_UUID[]    = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
constexpr char CHR_SPEED[]       = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
constexpr char CHR_HEADING[]     = "beb5483f-36e1-4688-b7f5-ea07361b26a8";
constexpr char CHR_ALTITUDE[]    = "beb54840-36e1-4688-b7f5-ea07361b26a8";
constexpr char CHR_SATELLITES[]  = "beb54841-36e1-4688-b7f5-ea07361b26a8";
constexpr char CHR_FIX_STATUS[]  = "beb54842-36e1-4688-b7f5-ea07361b26a8";
constexpr char CHR_AUX_OUTPUT[]  = "beb54843-36e1-4688-b7f5-ea07361b26a8";
// ──────────────────────────────────────────────────────────────────────────────

HardwareSerial gpsSerial(2);
TinyGPSPlus    gps;

hw_timer_t   *pulseTimer  = nullptr;
volatile bool timerEnabled = false;

// BLE handles
BLEServer          *bleServer    = nullptr;
BLECharacteristic  *chrSpeed     = nullptr;
BLECharacteristic  *chrHeading   = nullptr;
BLECharacteristic  *chrAltitude  = nullptr;
BLECharacteristic  *chrSats      = nullptr;
BLECharacteristic  *chrFixStatus = nullptr;
BLECharacteristic  *chrAux       = nullptr;
bool                bleConnected = false;

// ── BLE server callbacks ───────────────────────────────────────────────────────
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *)    override { bleConnected = true;  Serial.println("BLE: client connected"); }
  void onDisconnect(BLEServer *s) override {
    bleConnected = false;
    Serial.println("BLE: client disconnected – restarting advertising");
    s->startAdvertising();
  }
};

// ── AUX write callback ─────────────────────────────────────────────────────────
class AuxWriteCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    uint8_t val = c->getValue().length() ? c->getValue()[0] : 0;
    val = val ? 1 : 0;                          // sanitise to 0 or 1
    digitalWrite(AUX_OUTPUT_PIN, val);
    digitalWrite(STATUS_LED_PIN, !val);         // active-low LED: invert AUX state
    c->setValue(&val, 1);                       // echo back confirmed state
    Serial.printf("BLE: AUX output → %s\n", val ? "ON" : "OFF");
  }
};

// ── Pulse timer ISR ────────────────────────────────────────────────────────────
void IRAM_ATTR onTimer() {
  if (timerEnabled) {
    digitalWrite(PULSE_OUTPUT_PIN, !digitalRead(PULSE_OUTPUT_PIN));
  } else {
    digitalWrite(PULSE_OUTPUT_PIN, LOW);
  }
}

void setPulseFrequency(float freq_hz) {
  timerAlarmDisable(pulseTimer);
  if (freq_hz < 0.05f) {
    timerEnabled = false;
    digitalWrite(PULSE_OUTPUT_PIN, LOW);
    return;
  }
  uint64_t half_period_us = (uint64_t)(500000.0f / freq_hz);
  timerRestart(pulseTimer);
  timerAlarmWrite(pulseTimer, half_period_us, true);
  timerEnabled = true;
  timerAlarmEnable(pulseTimer);
}

// ── Helper: write float to a notify characteristic ────────────────────────────
void notifyFloat(BLECharacteristic *c, float val) {
  c->setValue(reinterpret_cast<uint8_t *>(&val), sizeof(val));
  if (bleConnected) c->notify();
}

void notifyUint8(BLECharacteristic *c, uint8_t val) {
  c->setValue(&val, 1);
  if (bleConnected) c->notify();
}

// ── BLE setup helper ───────────────────────────────────────────────────────────
BLECharacteristic *makeNotify(BLEService *svc, const char *uuid) {
  BLECharacteristic *c = svc->createCharacteristic(
      uuid, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  c->addDescriptor(new BLE2902());
  return c;
}

void setupBLE() {
  BLEDevice::init(DEVICE_NAME);
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  // 6 characteristics × 3 handles each (decl + value + CCCD) + 1 service = 19
  // Default is 15 which is too small – use 30 for headroom.
  BLEService *svc = bleServer->createService(BLEUUID(SERVICE_UUID), 30);

  chrSpeed    = makeNotify(svc, CHR_SPEED);
  chrHeading  = makeNotify(svc, CHR_HEADING);
  chrAltitude = makeNotify(svc, CHR_ALTITUDE);
  chrSats     = makeNotify(svc, CHR_SATELLITES);
  chrFixStatus = makeNotify(svc, CHR_FIX_STATUS);

  // AUX: read + write + notify
  chrAux = svc->createCharacteristic(
      CHR_AUX_OUTPUT,
      BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_WRITE |
      BLECharacteristic::PROPERTY_NOTIFY);
  chrAux->addDescriptor(new BLE2902());
  chrAux->setCallbacks(new AuxWriteCallback());
  uint8_t off = 0;
  chrAux->setValue(&off, 1);

  svc->start();

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.printf("BLE: advertising as '%s'\n", DEVICE_NAME);
}

// ── WiFi + OTA setup ──────────────────────────────────────────────────────────
void setupWiFiOTA() {
  Serial.printf("WiFi: connecting to '%s'", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Non-blocking: try for up to 10 s, continue without OTA on failure
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) {
    delay(250);
    Serial.print('.');
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nWiFi: not connected – OTA disabled");
    return;
  }

  Serial.printf("\nWiFi: connected  IP %s\n", WiFi.localIP().toString().c_str());

  ArduinoOTA.setHostname("moped-speedo");
  ArduinoOTA.onStart([]()  { Serial.println("OTA: start"); });
  ArduinoOTA.onEnd([]()    { Serial.println("\nOTA: done"); });
  ArduinoOTA.onProgress([](unsigned int done, unsigned int total) {
    Serial.printf("OTA: %u%%\r", done * 100 / total);
  });
  ArduinoOTA.onError([](ota_error_t e) {
    Serial.printf("OTA error [%u]\n", e);
  });
  ArduinoOTA.begin();
  Serial.println("OTA: ready – hostname 'moped-speedo'");
}

// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  pinMode(PULSE_OUTPUT_PIN, OUTPUT);
  digitalWrite(PULSE_OUTPUT_PIN, LOW);

  pinMode(AUX_OUTPUT_PIN, OUTPUT);
  digitalWrite(AUX_OUTPUT_PIN, LOW);

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  pulseTimer = timerBegin(0, 80, true);
  timerAttachInterrupt(pulseTimer, &onTimer, true);
  timerAlarmWrite(pulseTimer, 100000, true);

  setupBLE();
  setupWiFiOTA();

  Serial.println("GPS Speedometer starting – waiting for fix...");
}

void loop() {
  ArduinoOTA.handle();   // must be called every loop iteration
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  if (gps.speed.isUpdated()) {
    bool hasFix = gps.location.isValid() && gps.speed.isValid();

    float speedKmh  = hasFix ? gps.speed.kmph()    : 0.0f;
    float heading   = hasFix ? gps.course.deg()    : 0.0f;
    float altitude  = hasFix ? (float)gps.altitude.meters() : 0.0f;
    uint8_t sats    = gps.satellites.isValid() ? (uint8_t)gps.satellites.value() : 0;
    uint8_t fixSt   = hasFix ? 1 : 0;

    // Pulse output
    if (hasFix) {
      float freq_hz = (gps.speed.mps() / WHEEL_CIRCUMFERENCE_M) * PULSES_PER_REV;
      setPulseFrequency(freq_hz);
      Serial.printf("Speed: %.1f km/h  Hdg: %.0f°  Alt: %.0fm  Sats: %d  → %.2f Hz\n",
                    speedKmh, heading, altitude, sats, freq_hz);
    } else {
      setPulseFrequency(0);
      Serial.printf("No fix  (sats: %d)\n", sats);
    }

    // BLE notifications
    notifyFloat(chrSpeed,    speedKmh);
    notifyFloat(chrHeading,  heading);
    notifyFloat(chrAltitude, altitude);
    notifyUint8(chrSats,     sats);
    notifyUint8(chrFixStatus, fixSt);
  }
}
