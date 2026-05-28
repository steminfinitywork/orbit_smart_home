/*
 * ═══════════════════════════════════════════════════════════════
 *  Orbit Smart Home — NodeMCU (ESP8266) 2-Channel Firmware
 *  Version: 2.0.0 (Simplified Flat Schema)
 * ═══════════════════════════════════════════════════════════════
 *
 *  HARDWARE:
 *  ─────────────────────────────────────────────────────────────
 *  Board     : NodeMCU 1.0 (ESP-12E) / Wemos D1 Mini
 *  Channel 1 : Relay on D1  → GPIO  5  (RELAY_ACTIVE_LOW = true)
 *  Channel 2 : Relay on D2  → GPIO  4
 *  Status LED: WiFi/Firebase → D4  → GPIO  2  (built-in blue LED)
 *  LED Ch1   : Indication   → D5  → GPIO 14  (ON when ch1 is ON)
 *  LED Ch2   : Indication   → D6  → GPIO 12  (ON when ch2 is ON)
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
#define FIREBASE_API_KEY  "AIzaSyBGLqqtTbqX3EURUwY0iplcBm0Ryah2I5M"
#define FIREBASE_DB_URL   "https://orbit-d9271-default-rtdb.asia-southeast1.firebasedatabase.app"

// This device's unique credentials (must match Firebase RTDB key)
#define DEVICE_ID         "NODEMCU-2CH-000001"
#define DEVICE_PASSWORD_HASH "91e45b9dc41b1b0cf5576ae64ebaeb1b649771ead2d68df705c91ead989433b5"

// ─── Pin Definitions ─────────────────────────────────────────────────────────
#define PIN_RELAY_CH1     D1   // GPIO  5  — relay for channel 1
#define PIN_RELAY_CH2     D2   // GPIO  4  — relay for channel 2
#define PIN_STATUS_LED    D4   // GPIO  2  — system status LED
#define PIN_LED_CH1       D5   // GPIO 14  — indication LED for channel 1
#define PIN_LED_CH2       D6   // GPIO 12  — indication LED for channel 2

#define STATUS_LED_ACTIVE_LOW   true
#define INDIC_LED_ACTIVE_LOW    false

// ─── Relay Configuration ─────────────────────────────────────────────────────
#define RELAY_ACTIVE_LOW  true
#define RELAY_COUNT       2
#define MAX_CHANNELS      2

const int RELAY_PINS[MAX_CHANNELS] = { PIN_RELAY_CH1, PIN_RELAY_CH2 };
const int LED_PINS[MAX_CHANNELS]   = { PIN_LED_CH1, PIN_LED_CH2 };

#define DEVICE_TYPE   "relay"
#define FIRMWARE_VER  "2.0.0"

// ─── Timing Configuration ────────────────────────────────────────────────────
#define HEARTBEAT_INTERVAL_MS   15000   // Send heartbeat every 15 s
#define FIREBASE_POLL_MS        1000    // Read RTDB every 1 s
#define WIFI_RECONNECT_MS       5000    // WiFi reconnect attempt interval
#define FIREBASE_RECONNECT_MS   10000   // Firebase reconnect attempt interval

#define BLINK_SLOW_MS           1000    // WiFi not connected
#define BLINK_FAST_MS           200     // Firebase not ready

// ─── EEPROM Layout ───────────────────────────────────────────────────────────
#define EEPROM_MAGIC    0xAB
#define EEPROM_SIZE     (1 + MAX_CHANNELS)

// ─── Firebase Objects ─────────────────────────────────────────────────────────
FirebaseData fbdo;
FirebaseData heartbeatFbdo;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

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

String basePath;
String lastScheduledMinute      = ""; // Prevents double toggles within the same minute

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

// ─── Relay + LED Controls ────────────────────────────────────────────────────
void applyRelayState(int channel, bool state) {
  if (channel < 0 || channel >= MAX_CHANNELS) return;

  // Drive relay
  bool relayPin = RELAY_ACTIVE_LOW ? !state : state;
  digitalWrite(RELAY_PINS[channel], relayPin ? HIGH : LOW);

  // Drive LED indication
  bool ledPin = INDIC_LED_ACTIVE_LOW ? !state : state;
  digitalWrite(LED_PINS[channel], ledPin ? HIGH : LOW);

  relayStates[channel] = state;

  Serial.printf("[Relay] ch%d → %s\n", channel + 1, state ? "ON" : "OFF");
}

void applyAllRelays() {
  for (int i = 0; i < RELAY_COUNT; i++) {
    applyRelayState(i, relayStates[i]);
  }
}

// ─── Status LED ──────────────────────────────────────────────────────────────
void writeStatusLED(bool on) {
  bool pinLevel = STATUS_LED_ACTIVE_LOW ? !on : on;
  digitalWrite(PIN_STATUS_LED, pinLevel ? HIGH : LOW);
}

void updateStatusLED() {
  bool wifiOk = (WiFi.status() == WL_CONNECTED);
  bool fbOk   = wifiOk && firebaseReady && Firebase.ready();

  if (fbOk) {
    writeStatusLED(true); // Solid ON — fully connected
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
    updateStatusLED();
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] Failed. Will retry...");
  }
}

// ─── Firebase ────────────────────────────────────────────────────────────────
void initFirebase() {
  fbConfig.api_key      = FIREBASE_API_KEY;
  fbConfig.database_url = FIREBASE_DB_URL;
  fbConfig.token_status_callback      = tokenStatusCallback;
  fbConfig.max_token_generation_retry = 5;

  Serial.print("[Firebase] Signing in anonymously...");
  if (Firebase.signUp(&fbConfig, &fbAuth, "", "")) {
    Serial.println(" OK");
  } else {
    Serial.println(" FAILED!");
  }

  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);

  fbdo.setResponseSize(2048);
  heartbeatFbdo.setResponseSize(1024);
}

void registerDevice() {
  // Register flat meta info
  Firebase.RTDB.setString(&fbdo, basePath + "/device_id",       DEVICE_ID);
  Firebase.RTDB.setString(&fbdo, basePath + "/device_password", DEVICE_PASSWORD_HASH);
  Firebase.RTDB.setInt(&fbdo,    basePath + "/relay_count",     RELAY_COUNT);
  Firebase.RTDB.setString(&fbdo, basePath + "/firmwareVersion", FIRMWARE_VER);
  
  // Set default active bits if they don't exist yet
  if (!Firebase.RTDB.getInt(&fbdo, basePath + "/auto")) {
    Firebase.RTDB.setInt(&fbdo, basePath + "/auto", 0);
    Firebase.RTDB.setInt(&fbdo, basePath + "/timer", 0);
    Firebase.RTDB.setInt(&fbdo, basePath + "/ch1", relayStates[0] ? 1 : 0);
    Firebase.RTDB.setInt(&fbdo, basePath + "/ch2", relayStates[1] ? 1 : 0);
  }

  Serial.println("[Firebase] Device registered/verified on flat schema");
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────
void sendHeartbeat() {
  unsigned long epochMs = (unsigned long long)timeClient.getEpochTime() * 1000ULL;
  if (epochMs == 0) epochMs = millis(); // Fallback

  Firebase.RTDB.setInt(&heartbeatFbdo,    basePath + "/heartbeat", epochMs);
  Firebase.RTDB.setString(&heartbeatFbdo, basePath + "/status",    "online");
  Serial.println("[Heartbeat] Sent at " + String(epochMs));
}

// ─── Sync Channel States from Firebase ───────────────────────────────────────
void syncChannelStates() {
  bool changed = false;

  for (int i = 0; i < RELAY_COUNT; i++) {
    String statePath = basePath + "/ch" + String(i + 1);

    if (Firebase.RTDB.getInt(&fbdo, statePath)) {
      bool newState = (fbdo.intData() == 1);
      if (newState != relayStates[i]) {
        applyRelayState(i, newState);
        changed = true;
      }
    }
  }

  if (changed) saveStatesToEEPROM();
}

// ─── Integrated Timer & Schedule Logic ──────────────────────────────────────
void checkSchedulesAndTimers() {
  if (!timeClient.isTimeSet()) return;

  int currentHour = timeClient.getHours();
  int currentMin  = timeClient.getMinutes();
  String currentTime = (currentHour < 10 ? "0" : "") + String(currentHour) + ":" +
                       (currentMin  < 10 ? "0" : "") + String(currentMin);

  // Avoid processing multiple times in the same minute
  if (currentTime == lastScheduledMinute) return;

  int autoVal = 0, timerVal = 0, autoChannel = 1;
  String autoOn = "", autoOff = "";

  // One-shot fetch of the automation parameters from the flat RTDB node
  if (Firebase.RTDB.getInt(&fbdo, basePath + "/auto"))         autoVal     = fbdo.intData();
  if (Firebase.RTDB.getInt(&fbdo, basePath + "/timer"))        timerVal    = fbdo.intData();
  if (Firebase.RTDB.getInt(&fbdo, basePath + "/auto_channel")) autoChannel = fbdo.intData();
  if (Firebase.RTDB.getString(&fbdo, basePath + "/auto_on"))   autoOn      = fbdo.stringData();
  if (Firebase.RTDB.getString(&fbdo, basePath + "/auto_off"))  autoOff     = fbdo.stringData();

  int targetChIdx = autoChannel - 1;
  if (targetChIdx < 0 || targetChIdx >= RELAY_COUNT) return;

  // ── 1. Countdown Timer Trigger check ──────────────────────────────────────
  if (timerVal == 1 && autoOff != "" && relayStates[targetChIdx]) {
    if (currentTime == autoOff) {
      applyRelayState(targetChIdx, false);
      
      // Update DB directly to clear the active timer bit
      Firebase.RTDB.setInt(&fbdo, basePath + "/ch" + String(autoChannel), 0);
      Firebase.RTDB.setInt(&fbdo, basePath + "/timer", 0);
      Firebase.RTDB.setString(&fbdo, basePath + "/auto_off", "");
      
      saveStatesToEEPROM();
      lastScheduledMinute = currentTime;
      Serial.println("[Timer] Expired for ch" + String(autoChannel) + " → OFF");
      return;
    }
  }

  // ── 2. Daily Schedule Automation check ────────────────────────────────────
  if (autoVal == 1 && autoOn != "" && autoOff != "") {
    // Turn ON trigger
    if (currentTime == autoOn && !relayStates[targetChIdx]) {
      applyRelayState(targetChIdx, true);
      Firebase.RTDB.setInt(&fbdo, basePath + "/ch" + String(autoChannel), 1);
      saveStatesToEEPROM();
      lastScheduledMinute = currentTime;
      Serial.println("[Schedule] ch" + String(autoChannel) + " → ON");
    }
    // Turn OFF trigger
    if (currentTime == autoOff && relayStates[targetChIdx]) {
      applyRelayState(targetChIdx, false);
      
      // Disable schedule auto after completion to optimize reads
      Firebase.RTDB.setInt(&fbdo, basePath + "/ch" + String(autoChannel), 0);
      Firebase.RTDB.setInt(&fbdo, basePath + "/auto", 0);
      Firebase.RTDB.setString(&fbdo, basePath + "/auto_on", "");
      Firebase.RTDB.setString(&fbdo, basePath + "/auto_off", "");
      
      saveStatesToEEPROM();
      lastScheduledMinute = currentTime;
      Serial.println("[Schedule] ch" + String(autoChannel) + " → OFF (Disabled)");
    }
  }
}

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[Orbit] NodeMCU Smart Home Firmware v" FIRMWARE_VER);
  Serial.println("[Device] ID: " DEVICE_ID);

  // Configure Pins
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], RELAY_ACTIVE_LOW ? HIGH : LOW);
  }
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], INDIC_LED_ACTIVE_LOW ? HIGH : LOW);
  }
  pinMode(PIN_STATUS_LED, OUTPUT);
  writeStatusLED(false);

  // Restore States from EEPROM
  EEPROM.begin(EEPROM_SIZE);
  if (loadStatesFromEEPROM()) {
    Serial.println("[EEPROM] Restored states");
  } else {
    Serial.println("[EEPROM] Defaults OFF");
    for (int i = 0; i < RELAY_COUNT; i++) relayStates[i] = false;
  }
  applyAllRelays();

  basePath = "deviceData/" + String(DEVICE_ID);

  connectWiFi();

  timeClient.begin();
  timeClient.update();

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
    Serial.println("[Orbit] ✓ Fully Ready!");
  } else {
    Serial.println("[Firebase] Auth timed out — retrying in loop");
  }
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  updateStatusLED();

  // WiFi Reconnect
  if (now - lastWifiCheck >= WIFI_RECONNECT_MS) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Reconnecting...");
      WiFi.reconnect();
    }
  }

  // Firebase Reconnect
  if (!firebaseReady || !Firebase.ready()) {
    if (now - lastFirebaseCheck >= FIREBASE_RECONNECT_MS) {
      lastFirebaseCheck = now;
      if (Firebase.ready()) {
        firebaseReady = true;
        registerDevice();
        Serial.println("[Firebase] Reconnected ✓");
      }
    }
    delay(10);
    return;
  }

  timeClient.update();

  // Heartbeat every 15 seconds (NTP based or Millis based)
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  // Poll RTDB every 1 second
  if (now - lastFirebasePoll >= FIREBASE_POLL_MS) {
    lastFirebasePoll = now;
    syncChannelStates();
    checkSchedulesAndTimers();
  }

  yield();
}
