# Hårdvara – GPS Speedometer Pulse Emulator

## Komponentlista

| # | Komponent | Specifikation | Antal |
|---|-----------|---------------|-------|
| 1 | ESP32 dev board | ESP32-WROOM-32 DevKit v1 | 1 |
| 2 | GPS-modul | NEO-6M med keramisk antenn | 1 |
| 3 | Buck converter | MP1584EN eller LM2596-baserad, 12V→5V | 1 |
| 4 | NPN-transistor | 2N2222 / BC337 / S8050 | 1 |
| 5 | Motstånd | 1 kΩ (basmotstånd) | 1 |
| 6 | Motstånd | 10 kΩ (pull-up till 12V) | 1 |
| 7 | Elektrolytkondensator | 100 µF / 16V (bulk-cap på 12V-ingång) | 1 |
| 8 | Keramisk kondensator | 100 nF (bypass nära ESP32 VIN) | 1 |
| 9 | Anslutningskablar | Dupont eller lödda skarvar | — |

---

## Kopplingsschema

```
FORDON 12V GND ──────────────────────────────────────── GND (gemensam)
FORDON 12V +  ──────┬────────────────────────────────── 12V-rail
                    │
              [100µF ║ 100nF till GND]  (glättning)
                    │
             ┌──────┴───────┐
             │ Buck converter│   ← ställ till 5.0V (mät med multimeter!)
             │   12V → 5V   │
             └──────┬───────┘
                    │ 5V
           ┌────────┴─────────┐
           │                  │
      ESP32 VIN           NEO-6M VCC
      (onboard AMS1117         │
       ger 3.3V till chip)  NEO-6M GND ──── GND
                            NEO-6M TX  ──── ESP32 GPIO16 (UART2 RX)


ESP32 GPIO25 ──── 1 kΩ ──── NPN-bas (2N2222)
                             NPN-emitter ──── GND
                             NPN-kollektor ── Instrument sensor-pin
                                             │
                                        10 kΩ pull-up
                                             │
                                            12V-rail
```

### Transistorlogik (aktiv-låg puls till instrument)

| GPIO25 | Transistor | Instrument sensor-pin |
|--------|------------|-----------------------|
| LOW    | Av (stängt)| 12V (vila)            |
| HIGH   | På (leder) | ~0V (puls)            |

---

## Spänningsförsörjning – detaljer

**Varför buck converter och inte linjärregulator (7805)?**
- 12V → 5V vid 200 mA ger 7V × 0,2A = **1,4 W** värmeutveckling i en 7805 → kräver kylfläns
- En MP1584/LM2596-baserad buck-modul har ~85–90% verkningsgrad → nästintill ingen värme

**Inställning:**
1. Koppla 12V till buck-modulens ingång
2. Mät utspänning med multimeter
3. Vrid potentiometern tills utspänningen är **5,0 V**
4. Koppla sedan ESP32 och GPS-modul

---

## Montering – tips

1. Ställ alltid in buck-modulen till rätt spänning **innan** ESP32 kopplas in.
2. Placera GPS-antenn med fri sikt mot himlen – undvik metallhölje direkt ovanpå.
3. Använd gemensam GND för fordon, buck-modul, ESP32, GPS och transistor.
4. Skydda kretsen i en plastlåda mot fukt och vibrationer.
5. Fäst kablar så att de inte kan vibrera loss – använd buntband eller kabelbindning.

---

## Konfiguration i koden

Justera konstanterna i `mopedspeedometer.ino` för ditt hjul:

| Konstant | Standardvärde | Beskrivning |
|----------|--------------|-------------|
| `WHEEL_CIRCUMFERENCE_M` | `1.85` | Hjulomkrets i meter: `π × däckdiameter_m` |
| `PULSES_PER_REV` | `1` | Antal pulser per hjulvarv (antal magneter) |

**Beräkna hjulomkrets:**
- Mät däckets ytterdiameter i meter, t.ex. 0,565 m
- Omkrets = π × 0,565 ≈ **1,77 m**
- Alternativt: rulla hjulet ett varv på marken och mät sträckan

**Frekvensexempel:**

| Hastighet | Hjulomkrets | Pulsfrekvens |
|-----------|-------------|--------------|
| 30 km/h   | 1,85 m      | ~4,5 Hz      |
| 50 km/h   | 1,85 m      | ~7,5 Hz      |
| 80 km/h   | 1,85 m      | ~12,0 Hz     |

---

## Verifiering innan montering på moped

1. **Frekvenscheck** – mät GPIO25 med oscilloskop eller logikanalysatorn:
   - Vid 50 km/h och 1,85 m omkrets → förväntat **~7,5 Hz** (halvperiod ~67 ms)
2. **Transistorsteget** – verifiera med multimeter att sensor-pinnen på instrumentet:
   - Är ~12V vid GPIO25 LOW (vila)
   - Dras till ~0V vid GPIO25 HIGH (puls)
3. **Strömförbrukning** – mät total strömförbrukning på 12V-ingång: förväntat **< 200 mA**
4. **GPS-fix** – öppet fönster eller utomhus: vänta på fix (blinkande LED på NEO-6M-modul), kontrollera Serial Monitor i Arduino IDE
