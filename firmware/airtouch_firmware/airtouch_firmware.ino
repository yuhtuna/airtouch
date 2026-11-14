/**
 * AirTouch Firmware — Seeed Studio XIAO ESP32S3 Sense
 * 
 * Strict Hardware Pinout:
 * - MPU-6050 (I2C): SDA -> D4 (GPIO5), SCL -> D5 (GPIO6)
 * - Coin Vibrator Motor (PWM): D1 (GPIO2)
 * - ILLUM Pushbutton: D0 (GPIO1), INPUT_PULLUP (Active LOW)
 * - Tip Optical Beacon LED: D3 (GPIO4), NeoPixel / Optical Beacon
 * 
 * Target FQBN: esp32:esp32:XIAO_ESP32S3:CDCOnBoot=cdc,PSRAM=opi
 */

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_NeoPixel.h>

// Strict Pinout Definitions
#define PIN_BUTTON   D0 // GPIO 1 (Active LOW, INPUT_PULLUP)
#define PIN_HAPTIC   D1 // GPIO 2 (PWM Haptics)
#define PIN_BEACON   D3 // GPIO 4 (Optical Beacon LED / NeoPixel)
#define PIN_SDA      D4 // GPIO 5 (I2C SDA)
#define PIN_SCL      D5 // GPIO 6 (I2C SCL)

#define NUM_BEACON_PIXELS 1

Adafruit_MPU6050 mpu;
Adafruit_NeoPixel beacon(NUM_BEACON_PIXELS, PIN_BEACON, NEO_GRB + NEO_KHZ800);

// Complementary filter variables
float roll = 0.0f;
float pitch = 0.0f;
float yaw = 0.0f;

float rollOffset = 0.0f;
float pitchOffset = 0.0f;
float yawOffset = 0.0f;

unsigned long lastImuTime = 0;
unsigned long lastTelemetryTime = 0;

// Non-blocking Haptics
unsigned long hapticEndTime = 0;
bool hapticActive = false;

// Button Debounce and Click State Machine
int lastButtonReading = HIGH;
int buttonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 25; // 25ms debounce

unsigned long pressStartTime = 0;
unsigned long lastReleaseTime = 0;
int clickCount = 0;
const unsigned long doubleClickGap = 300; // max time between clicks for double click

uint8_t pendingClickEvent = 0; // 0 = none, 1 = single click, 2 = double click

// Non-blocking Serial Input Buffer (Zero blocking latency)
char serialBuffer[64];
uint8_t serialBufferIdx = 0;

void setup() {
  Serial.begin(115200);
  delay(500);

  // Configure Hardware Pins
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_HAPTIC, OUTPUT);
  analogWrite(PIN_HAPTIC, 0);

  // Initialize Beacon LED (Default bright cyan for 60 FPS webcam tracking)
  beacon.begin();
  beacon.setBrightness(255);
  beacon.setPixelColor(0, beacon.Color(0, 255, 255)); // Bright Cyan beacon
  beacon.show();

  // Initialize I2C with strict Xiao ESP32S3 Sense pinout at 400kHz fast mode
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(400000);

  if (!mpu.begin(0x68, &Wire)) {
    // Retry once at 0x69
    if (!mpu.begin(0x69, &Wire)) {
      // Beacon red error indication
      beacon.setPixelColor(0, beacon.Color(255, 0, 0));
      beacon.show();
      Serial.println(F("ERR: MPU-6050 not detected at 0x68 or 0x69! Check SDA(D4) and SCL(D5) connections."));
      while (1) {
        delay(100);
      }
    }
  }

  // Configure MPU6050 ranges
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  // Startup haptic confirmation chirp
  analogWrite(PIN_HAPTIC, 180);
  delay(70);
  analogWrite(PIN_HAPTIC, 0);

  // Initial beacon back to bright cyan
  beacon.setPixelColor(0, beacon.Color(0, 255, 255));
  beacon.show();

  lastImuTime = micros();
  lastTelemetryTime = millis();
}

void parseSerialCommand(const char* cmd) {
  if (cmd == NULL || cmd[0] == '\0') return;

  char type = cmd[0];
  if (type == 'H') {
    // H,<pwm>,<duration_ms>
    const char* firstComma = strchr(cmd, ',');
    if (firstComma != NULL) {
      const char* secondComma = strchr(firstComma + 1, ',');
      int pwm = atoi(firstComma + 1);
      unsigned long duration = (secondComma != NULL) ? strtoul(secondComma + 1, NULL, 10) : 0;

      pwm = constrain(pwm, 0, 255);
      analogWrite(PIN_HAPTIC, pwm);

      if (pwm > 0 && duration > 0) {
        hapticEndTime = millis() + duration;
        hapticActive = true;
      } else {
        // pwm == 0 or duration == 0 (continuous vibration until H,0,0)
        hapticActive = false;
      }
    }
  } else if (type == 'C') {
    // C,<r>,<g>,<b>
    const char* c1 = strchr(cmd, ',');
    if (c1 != NULL) {
      const char* c2 = strchr(c1 + 1, ',');
      if (c2 != NULL) {
        const char* c3 = strchr(c2 + 1, ',');
        int r = atoi(c1 + 1);
        int g = atoi(c2 + 1);
        int b = (c3 != NULL) ? atoi(c3 + 1) : 0;
        beacon.setPixelColor(0, beacon.Color(constrain(r, 0, 255), constrain(g, 0, 255), constrain(b, 0, 255)));
        beacon.show();
      }
    }
  } else if (type == 'Z') {
    // Recenter / Zero offsets directly to current absolute angles
    rollOffset = roll;
    pitchOffset = pitch;
    yawOffset = yaw;
  }
}

// 100% Non-blocking Serial Character Accumulator
void checkSerialInput() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialBufferIdx > 0) {
        serialBuffer[serialBufferIdx] = '\0';
        parseSerialCommand(serialBuffer);
        serialBufferIdx = 0;
      }
    } else if (serialBufferIdx < sizeof(serialBuffer) - 1) {
      serialBuffer[serialBufferIdx++] = c;
    }
  }
}

void updateButtonState() {
  int reading = digitalRead(PIN_BUTTON);

  if (reading != lastButtonReading) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != buttonState) {
      buttonState = reading;

      if (buttonState == LOW) {
        // Button pressed
        pressStartTime = millis();
        clickCount++;
      } else {
        // Button released
        lastReleaseTime = millis();
      }
    }
  }

  lastButtonReading = reading;

  // Double click window detection
  if (clickCount > 0 && (millis() - lastReleaseTime) > doubleClickGap && buttonState == HIGH) {
    if (clickCount == 1) {
      pendingClickEvent = 1; // Single click
    } else if (clickCount >= 2) {
      pendingClickEvent = 2; // Double click
    }
    clickCount = 0;
  }
}

void loop() {
  // 1. Process Incoming Serial Commands (Zero blocking latency)
  checkSerialInput();

  // 2. Handle Non-blocking Haptics Timer
  if (hapticActive && millis() >= hapticEndTime) {
    analogWrite(PIN_HAPTIC, 0);
    hapticActive = false;
  }

  // 3. Update Button State Machine
  updateButtonState();

  // 4. Update IMU & Complementary Filter
  unsigned long nowMicros = micros();
  float dt = (nowMicros - lastImuTime) / 1000000.0f;
  if (dt <= 0.0f || dt > 0.1f) dt = 0.01f;
  lastImuTime = nowMicros;

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Accelerometer pitch and roll (degrees)
  float accPitch = atan2(-a.acceleration.x, sqrt(a.acceleration.y * a.acceleration.y + a.acceleration.z * a.acceleration.z)) * 57.2957795f;
  float accRoll  = atan2(a.acceleration.y, a.acceleration.z) * 57.2957795f;

  // Gyro rates in deg/s (MPU6050 returns rad/s)
  float gyroRateX = g.gyro.x * 57.2957795f;
  float gyroRateY = g.gyro.y * 57.2957795f;
  float gyroRateZ = g.gyro.z * 57.2957795f;

  // Complementary filter (98% gyro integration, 2% accelerometer correction)
  roll  = 0.98f * (roll + gyroRateX * dt) + 0.02f * accRoll;
  pitch = 0.98f * (pitch + gyroRateY * dt) + 0.02f * accPitch;
  yaw   = yaw + gyroRateZ * dt; // Yaw integrated from Z gyro

  // 5. Emit Telemetry at 100 Hz (every 10 ms)
  unsigned long nowMillis = millis();
  if (nowMillis - lastTelemetryTime >= 10) {
    lastTelemetryTime = nowMillis;

    // Output calibrated angles
    float outRoll  = roll - rollOffset;
    float outPitch = pitch - pitchOffset;
    float outYaw   = yaw - yawOffset;

    // Active LOW button: 0 = pressed -> 1 in telemetry, 1 = released -> 0
    uint8_t btnOutput = (buttonState == LOW) ? 1 : 0;
    uint8_t eventToSend = pendingClickEvent;
    pendingClickEvent = 0; // Clear edge trigger

    // Compact CSV protocol: T,<roll>,<pitch>,<yaw>,<ax>,<ay>,<az>,<btn>,<clickEvent>
    Serial.print("T,");
    Serial.print(outRoll, 2);
    Serial.print(",");
    Serial.print(outPitch, 2);
    Serial.print(",");
    Serial.print(outYaw, 2);
    Serial.print(",");
    Serial.print(a.acceleration.x, 2);
    Serial.print(",");
    Serial.print(a.acceleration.y, 2);
    Serial.print(",");
    Serial.print(a.acceleration.z, 2);
    Serial.print(",");
    Serial.print(btnOutput);
    Serial.print(",");
    Serial.println(eventToSend);
  }
}
