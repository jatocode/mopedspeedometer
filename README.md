# Tänkte bygga en hastighetsmätare av esp32 + gps som fejkar magnetdata

# GATT problem:

Rotorsaken till alla problemen var att ESP32 BLE-tjänsten skapades med för få GATT-handles (15 default) — den sjätte karakteristiken (AUX) registrerades aldrig, vilket fick hela GATT-discovery att fallera med "Not supported".

