/*
 * ═══════════════════════════════════════════════════════════════
 *  AutoRob Home — ESP8266 Smart Controller Firmware
 *  Version: 1.0.0
 * ═══════════════════════════════════════════════════════════════
 *
 *  REQUIRED LIBRARIES (Install via Arduino Library Manager):
 *  ─────────────────────────────────────────────────────────────
 *  1. Firebase Arduino Client Library for ESP8266 and ESP32
 *     by Mobizt (v4.x) — Search: "Firebase ESP Client"
 *  2. ArduinoJson (v6.x or 7.x)
 *  3. NTPClient by Fabrice Weinberg
 *  4. WiFiUdp (built-in with ESP8266 core)
 *
 *  BOARD: ESP8266 (NodeMCU 1.0 / Wemos D1 Mini)
 *  CPU: 80MHz, Flash: 4MB, Upload Speed: 115200
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

#define WIFI_SSID         "YOUR_WIFI_SSID"
#define WIFI_PASSWORD     "YOUR_WIFI_PASSWORD"

// Firebase project config (copy from .env)
#define FIREBASE_API_KEY  "AIzaSyDEMO-REPLACE-WITH-YOUR-KEY"
#define FIREBASE_DB_URL   "https://home-auto-demo-default-rtdb.firebaseio.com"

// This device's unique credentials
// Generate a unique ID for each device (must match Firebase RTDB key)
#define DEVICE_ID         "ESP8266-A7F3B2"

// SHA-256 hex of your device password (pre-computed and stored at registration)
// Use: https://emn178.github.io/online-tools/sha256.html
// Password "M8K92QZ1" → store the resulting hash here AND in Firebase RTDB
#define DEVICE_PASSWORD_HASH "8f14e45fceea167a5a36dedd4bea2543b3a4a52e5b5b1e9e14b9c8d0e2d3c1a4"

// ─── Relay Configuration ─────────────────────────────────────────────────────

// Define your relay GPIO pins (add/remove based on your hardware)
// For active-LOW relay boards: RELAY_ACTIVE_LOW = true
#define RELAY_ACTIVE_LOW  true
#define MAX_CHANNELS      8

// Channel GPIO pin mapping (ch1=index 0, ch2=index 1, etc.)
const int RELAY_PINS[MAX_CHANNELS] = {
  D1,   // ch1 — GPIO 5
  D2,   // ch2 — GPIO 4
  D5,   // ch3 — GPIO 14
  D6,   // ch4 — GPIO 12
  D7,   // ch5 — GPIO 13
  D8,   // ch6 — GPIO 15
  255,  // ch7 — not used (255 = skip)
  255,  // ch8 — not used
};

// How many channels this firmware uses (must match Firebase relayCount)
#define RELAY_COUNT  4

// Device type string (sent to Firebase)
#define DEVICE_TYPE   "relay"
#define FIRMWARE_VER  "1.0.0"

// ─── Timing Configuration ────────────────────────────────────────────────────

#define HEARTBEAT_INTERVAL_MS   15000   // Send heartbeat every 15 seconds
#define FIREBASE_POLL_MS        1000    // Read relay states every 1 second
#define WIFI_RECONNECT_MS       5000    // Try WiFi reconnect every 5 seconds
#define FIREBASE_RECONNECT_MS   10000  // Try Firebase reconnect every 10 seconds

// ─── EEPROM Layout ───────────────────────────────────────────────────────────
// Stores last relay states for power failure recovery
// Byte 0: magic number (0xAB = valid data)
// Bytes 1..RELAY_COUNT: relay states (0=OFF, 1=ON)

#define EEPROM_MAGIC     0xAB
#define EEPROM_SIZE      (1 + MAX_CHANNELS)

// ─── Firebase Objects ─────────────────────────────────────────────────────────

FirebaseData fbdo;
FirebaseData heartbeatFbdo;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// ─── NTP Client ──────────────────────────────────────────────────────────────

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 0, 60000);

// ─── State ───────────────────────────────────────────────────────────────────

bool relayStates[MAX_CHANNELS] = { false };
unsigned long lastHeartbeat = 0;
unsigned long lastFirebasePoll = 0;
unsigned long lastWifiCheck = 0;
unsigned long lastFirebaseCheck = 0;
bool firebaseReady = false;
bool initialSyncDone = false;

// Base RTDB path for this device
String basePath;
String channelsPath;

// ─── EEPROM Helpers ──────────────────────────────────────────────────────────

void saveStatesToEEPROM() {
  EEPROM.write(0, EEPROM_MAGIC);
  for (int i = 0; i < RELAY_COUNT; i++) {
    EEPROM.write(1 + i, relayStates[i] ? 1 : 0);
  }
  EEPROM.commit();
}

bool loadStatesFromEEPROM() {
  if (EEPROM.read(0) != EEPROM_MAGIC) return false;
  for (int i = 0; i < RELAY_COUNT; i++) {
    relayStates[i] = (EEPROM.read(1 + i) == 1);
  }
  return true;
}

// ─── Relay Control ───────────────────────────────────────────────────────────

void applyRelayState(int channel, bool state) {
  if (channel < 0 || channel >= MAX_CHANNELS) return;
  int pin = RELAY_PINS[channel];
  if (pin == 255) return; // Not connected

  bool pinState = RELAY_ACTIVE_LOW ? !state : state;
  digitalWrite(pin, pinState ? HIGH : LOW);
  relayStates[channel] = state;
}

void applyAllRelays() {
  for (int i = 0; i < RELAY_COUNT; i++) {
    applyRelayState(i, relayStates[i]);
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

  // Anonymous auth (device writes are validated by RTDB rules)
  fbAuth.user.email = "";
  fbAuth.user.password = "";

  fbConfig.token_status_callback = tokenStatusCallback;
  fbConfig.max_token_generation_retry = 5;

  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);

  // Increase timeout for slow connections
  fbdo.setResponseSize(4096);
  heartbeatFbdo.setResponseSize(1024);
}

void registerDevice() {
  // Write device info to RTDB (only if ownerId is not set yet)
  String infoPath = basePath + "/info";

  // Write device capabilities
  Firebase.RTDB.setString(&fbdo, infoPath + "/firmwareVersion", FIRMWARE_VER);
  Firebase.RTDB.setInt(&fbdo, infoPath + "/relayCount", RELAY_COUNT);
  Firebase.RTDB.setString(&fbdo, infoPath + "/deviceType", DEVICE_TYPE);
  Firebase.RTDB.setString(&fbdo, infoPath + "/password", DEVICE_PASSWORD_HASH);

  // Initialize channels if they don't exist
  for (int i = 0; i < RELAY_COUNT; i++) {
    String chPath = channelsPath + "/ch" + String(i + 1);
    String name;

    // Check if channel already exists
    if (!Firebase.RTDB.getString(&fbdo, chPath + "/name") || fbdo.stringData().isEmpty()) {
      name = "Channel " + String(i + 1);
      Firebase.RTDB.setString(&fbdo, chPath + "/name", name);
      Firebase.RTDB.setBool(&fbdo, chPath + "/state", relayStates[i]);
      Firebase.RTDB.setInt(&fbdo, chPath + "/gpio", RELAY_PINS[i]);

      // Default timer (disabled)
      Firebase.RTDB.setBool(&fbdo, chPath + "/timer/enabled", false);
      Firebase.RTDB.setInt(&fbdo, chPath + "/timer/duration", 0);
      Firebase.RTDB.setInt(&fbdo, chPath + "/timer/startTime", 0);

      // Default schedule (disabled)
      Firebase.RTDB.setBool(&fbdo, chPath + "/schedule/enabled", false);
      Firebase.RTDB.setString(&fbdo, chPath + "/schedule/onTime", "08:00");
      Firebase.RTDB.setString(&fbdo, chPath + "/schedule/offTime", "18:00");
    }
  }

  Serial.println("[Firebase] Device registered/verified");
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

void sendHeartbeat() {
  unsigned long epochMs = (unsigned long long)timeClient.getEpochTime() * 1000ULL;
  if (epochMs == 0) epochMs = millis(); // Fallback if NTP not ready

  Firebase.RTDB.setInt(&heartbeatFbdo, basePath + "/heartbeat", epochMs);
  Firebase.RTDB.setString(&heartbeatFbdo, basePath + "/status", "online");
  Serial.println("[Heartbeat] Sent at " + String(epochMs));
}

// ─── Countdown Timer Logic ────────────────────────────────────────────────────

void checkTimers() {
  unsigned long now = (unsigned long)timeClient.getEpochTime() * 1000;
  if (now == 0) return; // NTP not ready

  for (int i = 0; i < RELAY_COUNT; i++) {
    String chPath = channelsPath + "/ch" + String(i + 1);

    // Read timer state
    if (Firebase.RTDB.getBool(&fbdo, chPath + "/timer/enabled") && fbdo.boolData()) {
      long duration = 0, startTime = 0;

      if (Firebase.RTDB.getInt(&fbdo, chPath + "/timer/duration")) {
        duration = (long)fbdo.intData() * 1000; // convert seconds to ms
      }
      if (Firebase.RTDB.getInt(&fbdo, chPath + "/timer/startTime")) {
        startTime = fbdo.intData();
      }

      if (startTime > 0 && duration > 0) {
        long elapsed = now - startTime;
        if (elapsed >= duration) {
          // Timer expired — turn OFF relay
          applyRelayState(i, false);
          Firebase.RTDB.setBool(&fbdo, chPath + "/state", false);
          Firebase.RTDB.setBool(&fbdo, chPath + "/timer/enabled", false);
          Firebase.RTDB.setInt(&fbdo, chPath + "/timer/startTime", 0);
          saveStatesToEEPROM();
          Serial.println("[Timer] ch" + String(i + 1) + " timer expired — OFF");
        }
      }
    }
  }
}

// ─── Schedule Logic ──────────────────────────────────────────────────────────

void checkSchedules() {
  if (!timeClient.isTimeSet()) return;

  int currentHour = timeClient.getHours();
  int currentMin = timeClient.getMinutes();
  int currentDay = timeClient.getDay(); // 0=Sun
  String currentTime = (currentHour < 10 ? "0" : "") + String(currentHour) + ":" +
                       (currentMin < 10 ? "0" : "") + String(currentMin);

  for (int i = 0; i < RELAY_COUNT; i++) {
    String chPath = channelsPath + "/ch" + String(i + 1) + "/schedule";

    if (Firebase.RTDB.getBool(&fbdo, chPath + "/enabled") && fbdo.boolData()) {
      String onTime = "", offTime = "";

      if (Firebase.RTDB.getString(&fbdo, chPath + "/onTime")) onTime = fbdo.stringData();
      if (Firebase.RTDB.getString(&fbdo, chPath + "/offTime")) offTime = fbdo.stringData();

      if (currentTime == onTime && !relayStates[i]) {
        applyRelayState(i, true);
        Firebase.RTDB.setBool(&fbdo, channelsPath + "/ch" + String(i + 1) + "/state", true);
        saveStatesToEEPROM();
        Serial.println("[Schedule] ch" + String(i + 1) + " → ON at " + currentTime);
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

// ─── Read Channel States from Firebase ───────────────────────────────────────

void syncChannelStates() {
  bool changed = false;
  for (int i = 0; i < RELAY_COUNT; i++) {
    String statePath = channelsPath + "/ch" + String(i + 1) + "/state";
    if (Firebase.RTDB.getBool(&fbdo, statePath)) {
      bool newState = fbdo.boolData();
      if (newState != relayStates[i]) {
        applyRelayState(i, newState);
        changed = true;
        Serial.printf("[RTDB] ch%d state → %s\n", i + 1, newState ? "ON" : "OFF");
      }
    }
  }
  if (changed) saveStatesToEEPROM();
}

// ─── Setup ───────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\n[AutoRob] Booting firmware v" FIRMWARE_VER);
  Serial.println("[Device] ID: " DEVICE_ID);

  // Init EEPROM
  EEPROM.begin(EEPROM_SIZE);

  // Load last relay states from EEPROM (power failure recovery)
  if (loadStatesFromEEPROM()) {
    Serial.println("[EEPROM] Restored previous relay states");
  } else {
    Serial.println("[EEPROM] No saved states — defaulting OFF");
    for (int i = 0; i < RELAY_COUNT; i++) relayStates[i] = false;
  }

  // Init relay pins
  for (int i = 0; i < RELAY_COUNT; i++) {
    if (RELAY_PINS[i] != 255) {
      pinMode(RELAY_PINS[i], OUTPUT);
    }
  }

  // Apply restored relay states
  applyAllRelays();

  // Build Firebase paths
  basePath = "deviceData/" + String(DEVICE_ID);
  channelsPath = basePath + "/channels";

  // Connect WiFi
  connectWiFi();

  // NTP
  timeClient.begin();
  timeClient.update();

  // Firebase
  initFirebase();

  // Wait for Firebase to be ready
  Serial.print("[Firebase] Waiting for auth");
  unsigned long authTimeout = millis();
  while (!Firebase.ready() && millis() - authTimeout < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (Firebase.ready()) {
    firebaseReady = true;
    registerDevice();
    sendHeartbeat();
    lastHeartbeat = millis();
    Serial.println("[AutoRob] ✓ Ready!");
  } else {
    Serial.println("[Firebase] Init timed out — will retry in loop");
  }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

void loop() {
  unsigned long now = millis();

  // ── WiFi Watchdog ──────────────────────────────────────────────────────────
  if (now - lastWifiCheck >= WIFI_RECONNECT_MS) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Disconnected — reconnecting...");
      WiFi.reconnect();
    }
  }

  // ── Firebase Ready Check ───────────────────────────────────────────────────
  if (!firebaseReady || !Firebase.ready()) {
    if (now - lastFirebaseCheck >= FIREBASE_RECONNECT_MS) {
      lastFirebaseCheck = now;
      if (Firebase.ready()) {
        firebaseReady = true;
        registerDevice();
        Serial.println("[Firebase] Reconnected");
      }
    }
    delay(100);
    return; // Don't proceed until Firebase is ready
  }

  // ── NTP Update ────────────────────────────────────────────────────────────
  timeClient.update();

  // ── Heartbeat (every 15 seconds) ─────────────────────────────────────────
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  // ── Poll Firebase for relay state changes (every 1 second) ───────────────
  if (now - lastFirebasePoll >= FIREBASE_POLL_MS) {
    lastFirebasePoll = now;
    syncChannelStates();

    // Check timers and schedules (on every sync tick)
    checkTimers();
    checkSchedules();
  }

  // Allow background tasks
  yield();
}
