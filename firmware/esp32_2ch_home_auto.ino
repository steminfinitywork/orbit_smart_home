/*
 * ═══════════════════════════════════════════════════════════════
 *  AutoRob Home — ESP32 Smart Controller Firmware (2-Channel)
 *  Version: 1.0.0
 * ═══════════════════════════════════════════════════════════════
 *
 *  HARDWARE:
 *  ─────────────────────────────────────────────────────────────
 *  Board     : ESP32 (DevKit V1 / 30-pin or 38-pin)
 *  Channel 1 : Relay on D1  → GPIO 22   (RELAY_ACTIVE_LOW = true)
 *  Channel 2 : Relay on D2  → GPIO 21
 *  LED Ch1   : Indication   → D5 / GPIO 18  (ON when ch1 is ON)
 *  LED Ch2   : Indication   → D6 / GPIO 19  (ON when ch2 is ON)
 *  Status LED: WiFi/Firebase → D4 / GPIO 16
 *               • Slow blink (1 s)  → WiFi not connected
 *               • Fast blink (200ms)→ Firebase not ready
 *               • Solid ON          → Fully connected & ready
 *
 *  REQUIRED LIBRARIES (Install via Arduino Library Manager):
 *  ─────────────────────────────────────────────────────────────
 *  1. Firebase Arduino Client Library for ESP8266 and ESP32
 *     by Mobizt (v4.x) — Search: "Firebase ESP Client"
 *  2. ArduinoJson (v6.x or 7.x)
 *  3. NTPClient by Fabrice Weinberg
 *
 *  BOARD: ESP32 Dev Module
 *  CPU: 240MHz, Flash: 4MB, Upload Speed: 115200
 *
 * ═══════════════════════════════════════════════════════════════
 */

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Preferences.h>       // ESP32 NVS (replaces EEPROM)
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// ─── User Configuration ──────────────────────────────────────────────────────

#define WIFI_SSID         "YOUR_WIFI_SSID"
#define WIFI_PASSWORD     "YOUR_WIFI_PASSWORD"

// Firebase project config (copy from .env)
#define FIREBASE_API_KEY  "AIzaSyDEMO-REPLACE-WITH-YOUR-KEY"
#define FIREBASE_DB_URL   "https://home-auto-demo-default-rtdb.firebaseio.com"

// This device's unique credentials (must match Firebase RTDB key)
#define DEVICE_ID         "ESP32-2CH-000001"

// SHA-256 hex of your device password (pre-computed and stored at registration)
// Use: https://emn178.github.io/online-tools/sha256.html
#define DEVICE_PASSWORD_HASH "8f14e45fceea167a5a36dedd4bea2543b3a4a52e5b5b1e9e14b9c8d0e2d3c1a4"

// ─── Pin Definitions ─────────────────────────────────────────────────────────
//
//  ESP32 NodeMCU-style label → actual GPIO number mapping used here:
//  D1  = GPIO 22   (Relay Channel 1)
//  D2  = GPIO 21   (Relay Channel 2)
//  D4  = GPIO 16   (Status LED)
//  D5  = GPIO 18   (Indication LED — Channel 1)
//  D6  = GPIO 19   (Indication LED — Channel 2)

#define PIN_RELAY_CH1     22   // D1 — relay for channel 1
#define PIN_RELAY_CH2     21   // D2 — relay for channel 2
#define PIN_STATUS_LED    16   // D4 — system status LED
#define PIN_LED_CH1       18   // D5 — indication LED for channel 1
#define PIN_LED_CH2       19   // D6 — indication LED for channel 2

// ─── Relay Configuration ─────────────────────────────────────────────────────

// true  = relay module is active-LOW (most common opto-isolated boards)
// false = relay module is active-HIGH
#define RELAY_ACTIVE_LOW  true

#define RELAY_COUNT       2    // Only 2 channels in this firmware
#define MAX_CHANNELS      2

// Relay GPIO pin array (index 0 = ch1, index 1 = ch2)
const int RELAY_PINS[MAX_CHANNELS] = {
  PIN_RELAY_CH1,   // ch1
  PIN_RELAY_CH2,   // ch2
};

// Indication LED pin array (mirrors relay array)
const int LED_PINS[MAX_CHANNELS] = {
  PIN_LED_CH1,     // LED for ch1
  PIN_LED_CH2,     // LED for ch2
};

// Device type string (sent to Firebase)
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

// ─── NVS (Non-Volatile Storage) ──────────────────────────────────────────────
// Replaces EEPROM on ESP32 for storing relay states across power cycles

Preferences prefs;
#define NVS_NAMESPACE   "autorob"       // NVS namespace name

// ─── Firebase Objects ─────────────────────────────────────────────────────────

FirebaseData fbdo;
FirebaseData heartbeatFbdo;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// ─── NTP Client ──────────────────────────────────────────────────────────────

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 0, 60000);

// ─── State ───────────────────────────────────────────────────────────────────

bool relayStates[MAX_CHANNELS] = { false, false };
unsigned long lastHeartbeat       = 0;
unsigned long lastFirebasePoll    = 0;
unsigned long lastWifiCheck       = 0;
unsigned long lastFirebaseCheck   = 0;
unsigned long lastStatusBlink     = 0;
bool statusLedOn                  = false;
bool firebaseReady                = false;

// Firebase RTDB paths
String basePath;
String channelsPath;

// ─── NVS Helpers ─────────────────────────────────────────────────────────────

void saveStatesToNVS() {
  prefs.begin(NVS_NAMESPACE, false);
  prefs.putBool("magic", true);  // flag = data is valid
  for (int i = 0; i < RELAY_COUNT; i++) {
    String key = "ch" + String(i + 1);
    prefs.putBool(key.c_str(), relayStates[i]);
  }
  prefs.end();
  Serial.println("[NVS] States saved");
}

bool loadStatesFromNVS() {
  prefs.begin(NVS_NAMESPACE, true); // read-only
  bool valid = prefs.getBool("magic", false);
  if (valid) {
    for (int i = 0; i < RELAY_COUNT; i++) {
      String key = "ch" + String(i + 1);
      relayStates[i] = prefs.getBool(key.c_str(), false);
    }
  }
  prefs.end();
  return valid;
}

// ─── Relay + LED Control ─────────────────────────────────────────────────────

// Apply a single channel's relay + its paired indication LED
void applyRelayState(int channel, bool state) {
  if (channel < 0 || channel >= MAX_CHANNELS) return;

  // Drive relay pin
  bool pinState = RELAY_ACTIVE_LOW ? !state : state;
  digitalWrite(RELAY_PINS[channel], pinState ? HIGH : LOW);

  // Drive indication LED (active-HIGH: ON when channel is ON)
  digitalWrite(LED_PINS[channel], state ? HIGH : LOW);

  relayStates[channel] = state;

  Serial.printf("[Relay] ch%d → %s | LED → %s\n",
                channel + 1,
                state ? "ON " : "OFF",
                state ? "ON " : "OFF");
}

// Apply all channel states at once (used on boot)
void applyAllRelays() {
  for (int i = 0; i < RELAY_COUNT; i++) {
    applyRelayState(i, relayStates[i]);
  }
}

// ─── Status LED ──────────────────────────────────────────────────────────────
//
//  Called every loop() iteration.
//  Solid ON  → fully connected
//  Fast blink → Firebase not ready (but WiFi OK)
//  Slow blink → WiFi disconnected

void updateStatusLED() {
  bool wifiOk     = (WiFi.status() == WL_CONNECTED);
  bool fbOk       = wifiOk && firebaseReady && Firebase.ready();

  if (fbOk) {
    // Solid ON — everything connected
    digitalWrite(PIN_STATUS_LED, HIGH);
    statusLedOn = true;
    return;
  }

  unsigned long now = millis();
  unsigned long period = wifiOk ? BLINK_FAST_MS : BLINK_SLOW_MS;

  if (now - lastStatusBlink >= period) {
    lastStatusBlink = now;
    statusLedOn = !statusLedOn;
    digitalWrite(PIN_STATUS_LED, statusLedOn ? HIGH : LOW);
  }
}

// ─── WiFi ────────────────────────────────────────────────────────────────────

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
    updateStatusLED(); // keep LED blinking during connect
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] Failed. Will retry...");
  }
}

// ─── Firebase ────────────────────────────────────────────────────────────────

void initFirebase() {
  fbConfig.api_key = FIREBASE_API_KEY;
  fbConfig.database_url = FIREBASE_DB_URL;

  // Anonymous auth
  fbAuth.user.email    = "";
  fbAuth.user.password = "";

  fbConfig.token_status_callback = tokenStatusCallback;
  fbConfig.max_token_generation_retry = 5;

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
  Firebase.RTDB.setString(&fbdo, infoPath + "/chipModel",       ESP.getChipModel());

  for (int i = 0; i < RELAY_COUNT; i++) {
    String chPath = channelsPath + "/ch" + String(i + 1);

    // Only write defaults if channel name doesn't exist yet
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
  if (epochMs == 0) epochMs = millis(); // Fallback if NTP not ready

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
          Firebase.RTDB.setBool(&fbdo, chPath + "/state",              false);
          Firebase.RTDB.setBool(&fbdo, chPath + "/timer/enabled",      false);
          Firebase.RTDB.setInt(&fbdo,  chPath + "/timer/startTime",    0);
          saveStatesToNVS();
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
        saveStatesToNVS();
        Serial.println("[Schedule] ch" + String(i + 1) + " → ON  at " + currentTime);
      }
      if (currentTime == offTime && relayStates[i]) {
        applyRelayState(i, false);
        Firebase.RTDB.setBool(&fbdo, channelsPath + "/ch" + String(i + 1) + "/state", false);
        saveStatesToNVS();
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

  if (changed) saveStatesToNVS();
}

// ─── Setup ───────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[AutoRob] ESP32 2-Channel Firmware v" FIRMWARE_VER);
  Serial.println("[Device]  ID: " DEVICE_ID);

  // ── Configure all output pins first ──────────────────────────────────────
  // Relay pins
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    // Drive relays OFF on boot (active-LOW: HIGH = OFF, active-HIGH: LOW = OFF)
    digitalWrite(RELAY_PINS[i], RELAY_ACTIVE_LOW ? HIGH : LOW);
  }

  // Indication LED pins
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW); // OFF
  }

  // Status LED pin
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  // ── Restore relay states from NVS ────────────────────────────────────────
  if (loadStatesFromNVS()) {
    Serial.println("[NVS] Restored previous relay states:");
    for (int i = 0; i < RELAY_COUNT; i++) {
      Serial.printf("  ch%d → %s\n", i + 1, relayStates[i] ? "ON" : "OFF");
    }
  } else {
    Serial.println("[NVS] No saved states — defaulting all OFF");
    for (int i = 0; i < RELAY_COUNT; i++) relayStates[i] = false;
  }

  // Apply restored states (drives relays + indication LEDs)
  applyAllRelays();

  // ── Build Firebase RTDB paths ─────────────────────────────────────────────
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
    Serial.println("[AutoRob] ✓ Fully Ready!");
  } else {
    Serial.println("[Firebase] Auth timed out — will retry in loop");
  }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

void loop() {
  unsigned long now = millis();

  // ── Status LED (always running) ───────────────────────────────────────────
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
    delay(10); // Small yield; don't block LED updates entirely
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

    // Timers and schedules on every sync tick
    checkTimers();
    checkSchedules();
  }

  // Allow ESP32 background tasks (WiFi stack, etc.)
  yield();
}
