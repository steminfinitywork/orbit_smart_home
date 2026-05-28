/*
 * ═══════════════════════════════════════════════════════════════
 *  Stem Infinity — NodeMCU (ESP8266) 2-Channel Firmware
 *  Version: 1.0.0
 * ═══════════════════════════════════════════════════════════════
 *
 *  HARDWARE:
 *  ─────────────────────────────────────────────────────────────
 *  Board     : NodeMCU 1.0 (ESP-12E) / Wemos D1 Mini
 *  Channel 1 : Relay on D1  → GPIO  5  (RELAY_ACTIVE_LOW = true)
 *  Channel 2 : Relay on D2  → GPIO  4
 *  Status LED: WiFi/Firebase → D4  → GPIO  2  (built-in blue LED
 *               ⚠ GPIO2 / D4 is active-LOW on NodeMCU boards.
 *                 If using an EXTERNAL LED on D4, set
 *                 STATUS_LED_ACTIVE_LOW = false below.)
 *               • Slow blink (1 s)  → WiFi not connected
 *               • Fast blink (200ms)→ Firebase not ready
 *               • Solid ON          → Fully connected & ready
 *  LED Ch1   : Indication   → D5  → GPIO 14  (ON when ch1 is ON)
 *  LED Ch2   : Indication   → D6  → GPIO 12  (ON when ch2 is ON)
 *
 *  NodeMCU D-pin → GPIO map (for reference):
 *  D0=16, D1=5, D2=4, D3=0, D4=2, D5=14, D6=12, D7=13, D8=15
 *
 *  REQUIRED LIBRARIES (Install via Arduino Library Manager):
 *  ─────────────────────────────────────────────────────────────
 *  1. Firebase Arduino Client Library for ESP8266 and ESP32
 *     by Mobizt (v4.x) — Search: "Firebase ESP Client"
 *  2. ArduinoJson (v6.x or 7.x)
 *  3. NTPClient by Fabrice Weinberg
 *  4. WiFiUdp (built-in with ESP8266 core)
 *
 *  BOARD SETTINGS (Arduino IDE):
 *  Board      : NodeMCU 1.0 (ESP-12E Module)
 *  CPU Freq   : 80 MHz
 *  Flash Size : 4MB (FS:2MB OTA:~1019KB)
 *  Upload Spd : 115200
 *
 * ═══════════════════════════════════════════════════════════════
 */

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include <EEPROM.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// ─── User Configuration ──────────────────────────────────────────────────────

#define WIFI_SSID         "IOTDEVICE"
#define WIFI_PASSWORD     "12345678"

// Firebase project config (copy from .env)
#define FIREBASE_API_KEY  "AIzaSyBGLqqtTbqX3EURUwY0iplcBm0Ryah2I5M"
#define FIREBASE_DB_URL   "https://orbit-d9271-default-rtdb.asia-southeast1.firebasedatabase.app"

// This device's unique credentials (must match Firebase RTDB key)
#define DEVICE_ID         "NODEMCU-2CH-000001"

// SHA-256 of device password "A1B2C3"
// Web app: user types "A1B2C3" → app computes sha256 → matches this value
// Generate at: https://emn178.github.io/online-tools/sha256.html
#define DEVICE_PASSWORD_HASH "91e45b9dc41b1b0cf5576ae64ebaeb1b649771ead2d68df705c91ead989433b5"

// ─── Pin Definitions ─────────────────────────────────────────────────────────
//
//  Using NodeMCU D-pin aliases (defined by the ESP8266 Arduino core):
//
//  D1 (GPIO  5) — Relay Channel 1
//  D2 (GPIO  4) — Relay Channel 2
//  D4 (GPIO  2) — Status LED (built-in blue LED on NodeMCU / also GPIO2)
//  D5 (GPIO 14) — Indication LED for Channel 1
//  D6 (GPIO 12) — Indication LED for Channel 2

#define PIN_RELAY_CH1     D1   // GPIO  5  — relay for channel 1
#define PIN_RELAY_CH2     D2   // GPIO  4  — relay for channel 2
#define PIN_STATUS_LED    D4   // GPIO  2  — system status LED
#define PIN_LED_CH1       D5   // GPIO 14  — indication LED for channel 1
#define PIN_LED_CH2       D6   // GPIO 12  — indication LED for channel 2

// ─── LED Polarity ────────────────────────────────────────────────────────────
//
// D4 (GPIO2) on NodeMCU boards drives the built-in BLUE LED which is
// active-LOW (LED ON when pin is LOW). Set to true to match this default.
// If you wire an external LED on D4 with anode → D4 → resistor → GND,
// change this to false.

#define STATUS_LED_ACTIVE_LOW   true

// Indication LEDs on D5/D6 are assumed active-HIGH (standard wiring).
// Change to true if wiring them active-LOW.
#define INDIC_LED_ACTIVE_LOW    false

// ─── Relay Configuration ─────────────────────────────────────────────────────

// true  = relay module is active-LOW (most common opto-isolated boards)
// false = relay module is active-HIGH
#define RELAY_ACTIVE_LOW  true

#define RELAY_COUNT       2
#define MAX_CHANNELS      2

// Relay GPIO pin array (index 0 = ch1, index 1 = ch2)
const int RELAY_PINS[MAX_CHANNELS] = {
  PIN_RELAY_CH1,   // ch1 — D1
  PIN_RELAY_CH2,   // ch2 — D2
};

// Indication LED pin array (index 0 = LED for ch1, index 1 = LED for ch2)
const int LED_PINS[MAX_CHANNELS] = {
  PIN_LED_CH1,     // D5 — mirrors ch1 relay state
  PIN_LED_CH2,     // D6 — mirrors ch2 relay state
};

#define DEVICE_TYPE   "relay"
#define FIRMWARE_VER  "1.0.0"

// ─── Timing Configuration ────────────────────────────────────────────────────

#define HEARTBEAT_INTERVAL_MS   15000   // Send heartbeat every 15 s
#define FIREBASE_POLL_MS        1000    // Read relay states every 1 s
#define WIFI_RECONNECT_MS       5000    // WiFi reconnect attempt interval
#define FIREBASE_RECONNECT_MS   10000   // Firebase reconnect attempt interval

// Status LED blink periods (ms)
#define BLINK_SLOW_MS           1000    // WiFi not connected
#define BLINK_FAST_MS           200     // Firebase not ready

// ─── EEPROM Layout ───────────────────────────────────────────────────────────
// Byte 0    : magic number (0xAB = valid data present)
// Bytes 1-2 : relay states (one byte per channel, 0=OFF 1=ON)

#define EEPROM_MAGIC    0xAB
#define EEPROM_SIZE     (1 + MAX_CHANNELS)

// ─── Firebase Objects ─────────────────────────────────────────────────────────

FirebaseData fbdo;
FirebaseData heartbeatFbdo;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

bool isAnonymousSignedIn = false; // tracks if anonymous sign-up succeeded

// ─── NTP Client ──────────────────────────────────────────────────────────────

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 0, 60000);

// ─── State ───────────────────────────────────────────────────────────────────

bool relayStates[MAX_CHANNELS]  = { false, false };
unsigned long lastHeartbeat     = 0;
unsigned long lastFirebasePoll  = 0;
unsigned long lastWifiCheck     = 0;
unsigned long lastFirebaseCheck = 0;
unsigned long lastStatusBlink   = 0;
bool statusLedOn                = false;
bool firebaseReady              = false;

// Firebase RTDB paths
String basePath;
String channelsPath;

// ─── EEPROM Helpers ──────────────────────────────────────────────────────────

void saveStatesToEEPROM() {
  EEPROM.write(0, EEPROM_MAGIC);
  for (int i = 0; i < RELAY_COUNT; i++) {
    EEPROM.write(1 + i, relayStates[i] ? 1 : 0);
  }
  EEPROM.commit();
  Serial.println("[EEPROM] States saved");
}

bool loadStatesFromEEPROM() {
  if (EEPROM.read(0) != EEPROM_MAGIC) return false;
  for (int i = 0; i < RELAY_COUNT; i++) {
    relayStates[i] = (EEPROM.read(1 + i) == 1);
  }
  return true;
}

// ─── Relay + Indication LED Control ─────────────────────────────────────────

// Write to indication LED respecting its active polarity
void setIndicLED(int channel, bool relayOn) {
  bool pinLevel = INDIC_LED_ACTIVE_LOW ? !relayOn : relayOn;
  digitalWrite(LED_PINS[channel], pinLevel ? HIGH : LOW);
}

// Apply a single channel's relay + its paired indication LED
void applyRelayState(int channel, bool state) {
  if (channel < 0 || channel >= MAX_CHANNELS) return;

  // Drive relay
  bool relayPin = RELAY_ACTIVE_LOW ? !state : state;
  digitalWrite(RELAY_PINS[channel], relayPin ? HIGH : LOW);

  // Drive indication LED
  setIndicLED(channel, state);

  relayStates[channel] = state;

  Serial.printf("[Relay] ch%d → %s | Indic LED → %s\n",
                channel + 1,
                state ? "ON " : "OFF",
                state ? "ON " : "OFF");
}

// Apply all channels at once (boot / restore)
void applyAllRelays() {
  for (int i = 0; i < RELAY_COUNT; i++) {
    applyRelayState(i, relayStates[i]);
  }
}

// ─── Status LED ──────────────────────────────────────────────────────────────

void writeStatusLED(bool on) {
  // Respect polarity (active-LOW = on when pin is LOW)
  bool pinLevel = STATUS_LED_ACTIVE_LOW ? !on : on;
  digitalWrite(PIN_STATUS_LED, pinLevel ? HIGH : LOW);
}

void updateStatusLED() {
  bool wifiOk = (WiFi.status() == WL_CONNECTED);
  bool fbOk   = wifiOk && firebaseReady && Firebase.ready();

  if (fbOk) {
    // Solid ON — fully connected
    writeStatusLED(true);
    statusLedOn = true;
    return;
  }

  unsigned long now    = millis();
  unsigned long period = wifiOk ? BLINK_FAST_MS : BLINK_SLOW_MS;

  if (now - lastStatusBlink >= period) {
    lastStatusBlink = now;
    statusLedOn     = !statusLedOn;
    writeStatusLED(statusLedOn);
  }
}

// ─── WiFi ────────────────────────────────────────────────────────────────────

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
    updateStatusLED(); // keep LED blinking while connecting
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] Failed. Will retry...");
  }
}

// ─── Firebase ────────────────────────────────────────────────────────────────
//
//  Anonymous Authentication — no email/password needed.
//  Requires: Firebase Console → Authentication → Sign-in method
//            → Anonymous → ENABLE
//
//  Firebase ESP Client v4.x needs explicit signUp() with empty
//  strings to trigger anonymous sign-in (not just begin()).

void initFirebase() {
  fbConfig.api_key      = FIREBASE_API_KEY;
  fbConfig.database_url = FIREBASE_DB_URL;

  fbConfig.token_status_callback      = tokenStatusCallback;
  fbConfig.max_token_generation_retry = 5;

  // Anonymous sign-up — empty strings = anonymous user
  Serial.print("[Firebase] Signing in anonymously...");
  if (Firebase.signUp(&fbConfig, &fbAuth, "", "")) {
    Serial.println(" OK");
  } else {
    Serial.println(" FAILED!");
    Serial.println("[Firebase] Error: " + String(fbConfig.signer.signupError.message.c_str()));
    Serial.println("[Firebase] → Go to Firebase Console → Authentication → Anonymous → Enable");
  }

  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);

  fbdo.setResponseSize(4096);
  heartbeatFbdo.setResponseSize(1024);
}

void registerDevice() {
  String infoPath = basePath + "/info";

  Firebase.RTDB.setString(&fbdo, infoPath + "/firmwareVersion", FIRMWARE_VER);
  Firebase.RTDB.setInt(&fbdo,    infoPath + "/relayCount",      RELAY_COUNT);
  Firebase.RTDB.setString(&fbdo, infoPath + "/deviceType",      DEVICE_TYPE);
  Firebase.RTDB.setString(&fbdo, infoPath + "/password",        DEVICE_PASSWORD_HASH);
  Firebase.RTDB.setString(&fbdo, infoPath + "/chipId",          String(ESP.getChipId(), HEX));

  for (int i = 0; i < RELAY_COUNT; i++) {
    String chPath = channelsPath + "/ch" + String(i + 1);

    // Only write defaults if name doesn't exist yet
    if (!Firebase.RTDB.getString(&fbdo, chPath + "/name") || fbdo.stringData().isEmpty()) {
      String name = "Channel " + String(i + 1);
      Firebase.RTDB.setString(&fbdo, chPath + "/name",    name);
      Firebase.RTDB.setBool(&fbdo,   chPath + "/state",   relayStates[i]);
      Firebase.RTDB.setInt(&fbdo,    chPath + "/gpio",    RELAY_PINS[i]);
      Firebase.RTDB.setInt(&fbdo,    chPath + "/ledGpio", LED_PINS[i]);

      // Default timer (disabled)
      Firebase.RTDB.setBool(&fbdo, chPath + "/timer/enabled",   false);
      Firebase.RTDB.setInt(&fbdo,  chPath + "/timer/duration",  0);
      Firebase.RTDB.setInt(&fbdo,  chPath + "/timer/startTime", 0);

      // Default schedule (disabled)
      Firebase.RTDB.setBool(&fbdo,   chPath + "/schedule/enabled", false);
      Firebase.RTDB.setString(&fbdo, chPath + "/schedule/onTime",  "08:00");
      Firebase.RTDB.setString(&fbdo, chPath + "/schedule/offTime", "18:00");
    }
  }

  Serial.println("[Firebase] Device registered/verified");
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

void sendHeartbeat() {
  unsigned long epochMs = (unsigned long long)timeClient.getEpochTime() * 1000ULL;
  if (epochMs == 0) epochMs = millis(); // Fallback if NTP not synced

  Firebase.RTDB.setInt(&heartbeatFbdo,    basePath + "/heartbeat", epochMs);
  Firebase.RTDB.setString(&heartbeatFbdo, basePath + "/status",    "online");
  Serial.println("[Heartbeat] Sent at " + String(epochMs));
}

// ─── Countdown Timer Logic ────────────────────────────────────────────────────

void checkTimers() {
  unsigned long now = (unsigned long)timeClient.getEpochTime() * 1000;
  if (now == 0) return; // NTP not synced yet

  for (int i = 0; i < RELAY_COUNT; i++) {
    String chPath = channelsPath + "/ch" + String(i + 1);

    if (Firebase.RTDB.getBool(&fbdo, chPath + "/timer/enabled") && fbdo.boolData()) {
      long duration = 0, startTime = 0;

      if (Firebase.RTDB.getInt(&fbdo, chPath + "/timer/duration"))
        duration = (long)fbdo.intData() * 1000; // seconds → ms

      if (Firebase.RTDB.getInt(&fbdo, chPath + "/timer/startTime"))
        startTime = fbdo.intData();

      if (startTime > 0 && duration > 0) {
        long elapsed = now - startTime;
        if (elapsed >= duration) {
          // Timer expired — turn relay OFF
          applyRelayState(i, false);
          Firebase.RTDB.setBool(&fbdo, chPath + "/state",           false);
          Firebase.RTDB.setBool(&fbdo, chPath + "/timer/enabled",   false);
          Firebase.RTDB.setInt(&fbdo,  chPath + "/timer/startTime", 0);
          saveStatesToEEPROM();
          Serial.println("[Timer] ch" + String(i + 1) + " expired → OFF");
        }
      }
    }
  }
}

// ─── Schedule Logic ──────────────────────────────────────────────────────────

void checkSchedules() {
  if (!timeClient.isTimeSet()) return;

  int    currentHour = timeClient.getHours();
  int    currentMin  = timeClient.getMinutes();
  String currentTime = (currentHour < 10 ? "0" : "") + String(currentHour) + ":" +
                       (currentMin  < 10 ? "0" : "") + String(currentMin);

  for (int i = 0; i < RELAY_COUNT; i++) {
    String chPath = channelsPath + "/ch" + String(i + 1) + "/schedule";

    if (Firebase.RTDB.getBool(&fbdo, chPath + "/enabled") && fbdo.boolData()) {
      String onTime = "", offTime = "";

      if (Firebase.RTDB.getString(&fbdo, chPath + "/onTime"))  onTime  = fbdo.stringData();
      if (Firebase.RTDB.getString(&fbdo, chPath + "/offTime")) offTime = fbdo.stringData();

      if (currentTime == onTime && !relayStates[i]) {
        applyRelayState(i, true);
        Firebase.RTDB.setBool(&fbdo, channelsPath + "/ch" + String(i + 1) + "/state", true);
        saveStatesToEEPROM();
        Serial.println("[Schedule] ch" + String(i + 1) + " → ON  at " + currentTime);
      }
      if (currentTime == offTime && relayStates[i]) {
        applyRelayState(i, false);
        Firebase.RTDB.setBool(&fbdo, channelsPath + "/ch" + String(i + 1) + "/state", false);
        saveStatesToEEPROM();
        Serial.println("[Schedule] ch" + String(i + 1) + " → OFF at " + currentTime);
      }
    }
  }
}

// ─── Sync Channel States from Firebase ───────────────────────────────────────

void syncChannelStates() {
  bool changed = false;

  for (int i = 0; i < RELAY_COUNT; i++) {
    String statePath = channelsPath + "/ch" + String(i + 1) + "/state";

    if (Firebase.RTDB.getBool(&fbdo, statePath)) {
      bool newState = fbdo.boolData();
      if (newState != relayStates[i]) {
        applyRelayState(i, newState);
        changed = true;
      }
    }
  }

  if (changed) saveStatesToEEPROM();
}

// ─── Setup ───────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[Stem Infinity] NodeMCU 2-Channel Firmware v" FIRMWARE_VER);
  Serial.println("[Device]  ID: " DEVICE_ID);

  // ── Configure output pins ─────────────────────────────────────────────────

  // Relay pins — drive safe OFF state immediately
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    // Active-LOW relay: HIGH = OFF. Active-HIGH relay: LOW = OFF.
    digitalWrite(RELAY_PINS[i], RELAY_ACTIVE_LOW ? HIGH : LOW);
  }

  // Indication LED pins — all OFF
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    // Active-HIGH (default): LOW = OFF. Active-LOW: HIGH = OFF.
    digitalWrite(LED_PINS[i], INDIC_LED_ACTIVE_LOW ? HIGH : LOW);
  }

  // Status LED pin
  pinMode(PIN_STATUS_LED, OUTPUT);
  writeStatusLED(false); // OFF initially

  // ── EEPROM init ───────────────────────────────────────────────────────────
  EEPROM.begin(EEPROM_SIZE);

  // ── Restore relay states ──────────────────────────────────────────────────
  if (loadStatesFromEEPROM()) {
    Serial.println("[EEPROM] Restored previous relay states:");
    for (int i = 0; i < RELAY_COUNT; i++) {
      Serial.printf("  ch%d → %s\n", i + 1, relayStates[i] ? "ON" : "OFF");
    }
  } else {
    Serial.println("[EEPROM] No saved states — defaulting all OFF");
    for (int i = 0; i < RELAY_COUNT; i++) relayStates[i] = false;
  }

  // Apply restored states (drives relays + indication LEDs together)
  applyAllRelays();

  // ── Firebase RTDB paths ───────────────────────────────────────────────────
  basePath     = "deviceData/" + String(DEVICE_ID);
  channelsPath = basePath + "/channels";

  // ── Connect WiFi ─────────────────────────────────────────────────────────
  connectWiFi();

  // ── NTP ──────────────────────────────────────────────────────────────────
  timeClient.begin();
  timeClient.update();

  // ── Firebase ─────────────────────────────────────────────────────────────
  initFirebase();

  Serial.print("[Firebase] Waiting for auth");
  unsigned long authTimeout = millis();
  while (!Firebase.ready() && millis() - authTimeout < 15000) {
    delay(300);
    Serial.print(".");
    updateStatusLED();
  }
  Serial.println();

  if (Firebase.ready()) {
    firebaseReady = true;
    registerDevice();
    sendHeartbeat();
    lastHeartbeat = millis();
    Serial.println("[Stem Infinity] ✓ Fully Ready!");
  } else {
    Serial.println("[Firebase] Auth timed out — will retry in loop");
  }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

void loop() {
  unsigned long now = millis();

  // ── Status LED (always running, non-blocking) ─────────────────────────────
  updateStatusLED();

  // ── WiFi Watchdog ─────────────────────────────────────────────────────────
  if (now - lastWifiCheck >= WIFI_RECONNECT_MS) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Disconnected — reconnecting...");
      WiFi.reconnect();
    }
  }

  // ── Firebase Ready Check ──────────────────────────────────────────────────
  if (!firebaseReady || !Firebase.ready()) {
    if (now - lastFirebaseCheck >= FIREBASE_RECONNECT_MS) {
      lastFirebaseCheck = now;
      if (Firebase.ready()) {
        firebaseReady = true;
        registerDevice();
        Serial.println("[Firebase] Reconnected ✓");
      }
    }
    delay(10); // Small yield — keep LED updating without blocking
    return;
  }

  // ── NTP Update ────────────────────────────────────────────────────────────
  timeClient.update();

  // ── Heartbeat (every 15 s) ────────────────────────────────────────────────
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  // ── Poll Firebase for relay state changes (every 1 s) ─────────────────────
  if (now - lastFirebasePoll >= FIREBASE_POLL_MS) {
    lastFirebasePoll = now;
    syncChannelStates();

    // Timers and schedules run on every sync tick
    checkTimers();
    checkSchedules();
  }

  // Allow ESP8266 background tasks (WiFi stack, etc.)
  yield();
}
