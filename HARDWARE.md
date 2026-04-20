# Hårdvara – GPS Speedometer Pulse Emulator

## Inköpslista

> Priserna är ungefärliga (april 2026). AliExpress är billigast men har 3–5 veckors leveranstid.
> Electrokit/Kjell ger snabb leverans inom Sverige till något högre pris.

| # | Komponent | Specifikation | Antal | Ca pris | Sök på |
|---|-----------|---------------|-------|---------|--------|
| 1 | ESP32 dev board | ESP32-WROOM-32 DevKit v1 (38-pin) | 1 | 45–80 kr | AliExpress / Electrokit |
| 2 | GPS-modul | NEO-6M med keramisk patch-antenn | 1 | 40–70 kr | AliExpress / Amazon |
| 3 | Buck converter-modul | MP1584EN eller LM2596-baserad, in 4–28V, ut adj. | 1 | 15–30 kr | AliExpress / Electrokit |
| 4 | NPN-transistor | 2N2222A, BC337 eller S8050 (TO-92) | 1 (köp 10-pack) | 15–25 kr | Electrokit / Kjell |
| 5 | Motstånd 1 kΩ | 1/4W metallfilm | 1 (köp 100-pack) | 15–30 kr | Electrokit / Kjell |
| 6 | Motstånd 10 kΩ | 1/4W metallfilm | 1 (ingår i samma pack) | — | — |
| 7 | Elektrolytkondensator | 100 µF / 16V (eller 25V), radiell | 1 | < 5 kr | Electrokit |
| 8 | Keramisk kondensator | 100 nF (0,1 µF), 50V | 1 | < 5 kr | Electrokit |
| 9 | Perfboard / gällbräda | 5 × 7 cm enkelsidig | 1 | 10–20 kr | Electrokit / Kjell |
| 10 | Dupont-kablar | Hona–hona 20 cm, 10-pack | 1 pack | 20–35 kr | AliExpress / Electrokit |
| 11 | Skarvkabel fordon | Tunna 0,5 mm² med 12V-anslutning (t.ex. Superseal/AMP) | 0,5 m | 20–40 kr | Biltillbehör / Biltema |
| 12 | Gummigrommets | Ø7 mm kabeldragningsgrommet | 3 | 10–20 kr | Biltema / Biltillbehör |
| 13 | M3-skruvar + muttrar | M3 × 10 mm, rostfri | 4 | 5–10 kr | Bauhaus / Biltema |
| 14 | M3-skruvar montering | M3 × 16 mm + brickor (till moped-ram) | 4 | 5–10 kr | Bauhaus / Biltema |
| 15 | Buntband | 100 × 2,5 mm, svart UV-beständig | 10 st | 10–15 kr | Biltema |
| 16 | Krympslang | Ø3 mm och Ø6 mm, sortiment | 0,5 m | 15–25 kr | Electrokit / Biltema |
| 17 | PLA/PETG-filament | 1,75 mm, valfri färg (för 3D-print) | ~80 g | 25–40 kr | 3D-printutskrift med eget filament |

**Beräknad totalkostnad: ~300–500 kr** (exkl. filament och frakt; beroende på butik)

> **Tips:** Motstånd och transistorer köps med fördel i sortimentsaskar om du inte redan har det –
> sparkade på sikt och kostnaden är densamma för ett 100-pack som för lösa.

---

## Komponentlista

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
4. **GPS-fix** – öppet fönster eller utomhus: vänta på fix (blinkande LED på NEO-6M-modul), kontrollera Serial Monitor i PlatformIO (115200 baud)

### BLE-verifiering (med nRF Connect-appen)

1. Ladda ner **nRF Connect** (iOS / Android) – gratis
2. Öppna appen → **Scan** → leta efter `MopedSpeedo` i listan → tryck **Connect**
3. Öppna servicen `4fafc201-…` → tryck på notify-ikonen (pil nedåt) på t.ex. **Speed**-karakteristiken → hastighetsdata börjar strömma (uppdateras 1 Hz)
4. Testa **AUX-output** (GPIO26):
   - Hitta karakteristiken `beb54843-…` (AUX_OUTPUT)
   - Tryck **Write** → välj format `BYTE` → skriv `01` → GPIO26 går HIGH (enhet på)
   - Skriv `00` → GPIO26 går LOW (enhet av)
5. Kontrollera att Serial Monitor i PlatformIO visar `BLE: client connected` och `BLE: AUX output → ON/OFF`
