// src/main.cpp
// GPS-driven pulse emulator – replaces magnetic wheel sensor
//
// Reads GPS speed via NEO-6M UART and generates digital pulses on a GPIO pin
// at a frequency proportional to wheel rotation speed. An external NPN transistor
// level-shifts the 3.3V pulse to a 12V active-low signal for the speedometer.
//
// Wiring:
//   NEO-6M TX  → ESP32 GPIO16 (UART2 RX)
//   ESP32 GPIO25 → 1kΩ → NPN base (2N2222/BC337)
//   NPN emitter  → GND
//   NPN collector → instrument sensor-pin + 10kΩ pull-up to 12V
//
// Library: mikalhart/TinyGPSPlus (declared in platformio.ini – no manual install needed)

#include <Arduino.h>
#include <HardwareSerial.h>
#include <TinyGPS++.h>

// ── Configuration ──────────────────────────────────────────────────────────────
// Wheel circumference in metres: pi × outer_tyre_diameter_m
// Example: 17" wheel with 100/80-17 tyre → outer diameter ~0.565 m → 1.77 m
const float WHEEL_CIRCUMFERENCE_M = 1.85f;

// Number of pulses per wheel revolution (= number of magnets on the wheel)
const int PULSES_PER_REV = 1;

// GPIO pin connected to the NPN transistor base via 1 kΩ resistor
const int PULSE_OUTPUT_PIN = 25;

// GPS UART pins (UART2)
const int  GPS_RX_PIN = 16;   // ← NEO-6M TX
const int  GPS_TX_PIN = 17;   // → NEO-6M RX (not used, kept for clarity)
const long GPS_BAUD   = 9600;
// ──────────────────────────────────────────────────────────────────────────────

HardwareSerial gpsSerial(2);
TinyGPSPlus    gps;

hw_timer_t   *pulseTimer  = nullptr;
volatile bool timerEnabled = false;

// ISR: toggles output pin at 2× target frequency for 50 % duty cycle
void IRAM_ATTR onTimer() {
  if (timerEnabled) {
    digitalWrite(PULSE_OUTPUT_PIN, !digitalRead(PULSE_OUTPUT_PIN));
  } else {
    digitalWrite(PULSE_OUTPUT_PIN, LOW);
  }
}

// Set pulse output frequency in Hz.
// Passing 0 (or any value < 0.05) stops the pulses and holds the pin LOW.
void setPulseFrequency(float freq_hz) {
  timerAlarmDisable(pulseTimer);

  if (freq_hz < 0.05f) {
    timerEnabled = false;
    digitalWrite(PULSE_OUTPUT_PIN, LOW);
    return;
  }

  // The ISR fires at 2× freq so each two firings complete one full pulse cycle.
  uint64_t half_period_us = (uint64_t)(500000.0f / freq_hz);
  timerRestart(pulseTimer);
  timerAlarmWrite(pulseTimer, half_period_us, /*autoreload=*/true);
  timerEnabled = true;
  timerAlarmEnable(pulseTimer);
}

void setup() {
  Serial.begin(115200);

  // Start GPS UART
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // Pulse output – default LOW (no pulse, transistor off, instrument sees 12V)
  pinMode(PULSE_OUTPUT_PIN, OUTPUT);
  digitalWrite(PULSE_OUTPUT_PIN, LOW);

  // Hardware timer 0, prescaler 80 → 1 µs tick at 80 MHz APB clock
  pulseTimer = timerBegin(0, 80, /*countUp=*/true);
  timerAttachInterrupt(pulseTimer, &onTimer, /*edge=*/true);
  // Initial alarm value (will be overwritten); timer not enabled yet
  timerAlarmWrite(pulseTimer, 100000, true);

  Serial.println("GPS Speedometer starting – waiting for fix...");
}

void loop() {
  // Feed all available GPS bytes to the NMEA parser
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  // Act only when a new speed value has arrived (typically 1 Hz from NEO-6M)
  if (gps.speed.isUpdated()) {
    if (gps.location.isValid() && gps.speed.isValid()) {
      float speed_mps = gps.speed.mps();

      // freq = wheel_revolutions_per_second × pulses_per_rev
      //      = (speed_m/s / circumference_m) × pulses_per_rev
      float freq_hz = (speed_mps / WHEEL_CIRCUMFERENCE_M) * PULSES_PER_REV;
      setPulseFrequency(freq_hz);

      Serial.printf("Speed: %.1f km/h  →  %.2f Hz  (satellites: %d)\n",
                    gps.speed.kmph(), freq_hz, (int)gps.satellites.value());
    } else {
      // No valid fix – stop pulsing so instrument reads 0
      setPulseFrequency(0);
      Serial.print("Waiting for GPS fix...");
      if (gps.satellites.isValid()) {
        Serial.printf("  (satellites in view: %d)\n", (int)gps.satellites.value());
      } else {
        Serial.println();
      }
    }
  }
}
