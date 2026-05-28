# ESP8266 AutoRob Home Firmware

## Quick Start

### 1. Install Arduino IDE Libraries

Open **Arduino IDE → Tools → Manage Libraries** and install:

| Library | Author | Version |
|---|---|---|
| Firebase Arduino Client Library for ESP8266 and ESP32 | Mobizt | v4.x |
| ArduinoJson | Benoit Blanchon | v6.x or 7.x |
| NTPClient | Fabrice Weinberg | latest |

### 2. Configure the Firmware

Open `esp8266_home_auto.ino` and edit the top section:

```cpp
#define WIFI_SSID         "YOUR_WIFI_SSID"
#define WIFI_PASSWORD     "YOUR_WIFI_PASSWORD"
#define FIREBASE_API_KEY  "your-firebase-api-key"
#define FIREBASE_DB_URL   "https://your-project-id-default-rtdb.firebaseio.com"
#define DEVICE_ID         "ESP8266-A7F3B2"   // Unique per device
```

### 3. Generate Device Password Hash

1. Choose a password for your device, e.g. `M8K92QZ1`
2. Get its SHA-256 hash at https://emn178.github.io/online-tools/sha256.html
3. Set `DEVICE_PASSWORD_HASH` to the resulting hex string

### 4. Pre-register Device in Firebase RTDB

In Firebase Console → Realtime Database, create this structure:

```json
{
  "deviceData": {
    "ESP8266-A7F3B2": {
      "info": {
        "relayCount": 4,
        "firmwareVersion": "1.0.0",
        "deviceType": "relay",
        "ownerId": "",
        "password": "<YOUR-SHA256-HASH>"
      }
    }
  }
}
```

### 5. Configure Relay Pins

Adjust the `RELAY_PINS` array and `RELAY_COUNT` to match your hardware:

```cpp
#define RELAY_COUNT  4    // How many relays

const int RELAY_PINS[MAX_CHANNELS] = {
  D1,   // ch1 → GPIO 5
  D2,   // ch2 → GPIO 4
  D5,   // ch3 → GPIO 14
  D6,   // ch4 → GPIO 12
  255,  // ch5 → not used
  ...
};
```

For **active-LOW** relay boards (most common): `RELAY_ACTIVE_LOW true`
For **active-HIGH** relay boards: `RELAY_ACTIVE_LOW false`

### 6. Upload

- Board: **NodeMCU 1.0 (ESP-12E Module)** or **LOLIN(WEMOS) D1 mini**
- CPU: 80 MHz
- Flash: 4MB (FS: 2MB, OTA: 1MB)
- Upload Speed: 115200

---

## Behaviour Summary

| Event | Interval |
|---|---|
| Heartbeat sent to Firebase | Every **15 seconds** |
| Relay state read from Firebase | Every **1 second** |
| WiFi reconnect attempt | Every 5 seconds |
| Firebase reconnect attempt | Every 10 seconds |

**Online threshold (app side):** Device is shown Online if heartbeat is < 45 seconds old.

---

## Power Failure Recovery

Relay states are stored in **EEPROM** on every state change.  
On reboot, the firmware restores the last known state automatically.

---

## Adding More Devices

Each physical device needs:
1. A **unique** `DEVICE_ID` (e.g. `ESP8266-A7F3B2`, `ESP8266-C4D5E6`)
2. Its own RTDB entry under `deviceData/{DEVICE_ID}`
3. Its own SHA-256 hashed password stored in RTDB

The web app handles unlimited devices — just pair each one.
