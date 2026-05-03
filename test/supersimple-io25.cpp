#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  pinMode(25, OUTPUT);
  Serial.println("IO25 toggle test – 1 s on / 1 s off");
}

void loop() {
  digitalWrite(25, HIGH);
  Serial.println("IO25 HIGH");
  delay(1000);
  digitalWrite(25, LOW);
  Serial.println("IO25 LOW");
  delay(1000);
}
