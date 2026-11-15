/**
 * AirTouch Firmware — Arduino Nano (ATmega328P)
 * 
 * Hardware Wiring:
 * - MPU-6050 (I2C 0x68): SDA -> A4, SCL -> A5, VCC -> 5V (or 3V3), GND -> GND
 * - Pushbutton Switch: Pin 2 (D2) -> GND (Active LOW, internal INPUT_PULLUP)
 * - Vibration Motor: Pin 3 (D3) (PWM via Timer2, analogWrite 0-255)
 * 
 * Target FQBN: arduino:avr:nano:cpu=atmega328old (or cpu=atmega328)
 */

#include <Wire.h>

const int MPU_ADDR = 0x68;
const int buttonPin = 2; // Pushbutton on Pin 2
const int motorPin  = 3; // Vibration motor on Pin 3 (PWM)

// Orientation tracking (Complementary Filter)
float roll = 0.0f;
float pitch = 0.0f;
float yaw = 0.0f;

float rollOffset = 0.0f;
float pitchOffset = 0.0f;
float yawOffset = 0.0f;

unsigned long lastImuTime = 0;
unsigned long lastTelemetryTime = 0;

// Non-blocking Haptics Timer
unsigned long hapticEndTime = 0;
bool hapticActive = false;

// Button Debounce and Click State Machine
int lastButtonReading = HIGH;
int buttonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 25;

unsigned long pressStartTime = 0;
unsigned long lastReleaseTime = 0;
int clickCount = 0;
const unsigned long doubleClickGap = 300;
uint8_t pendingClickEvent = 0;

// Non-blocking Serial Buffer (32 bytes to preserve ATmega328P SRAM)
char serialBuffer[32];
uint8_t serialBufferIdx = 0;

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
      analogWrite(motorPin, pwm);

      if (pwm > 0 && duration > 0) {
        hapticEndTime = millis() + duration;
        hapticActive = true;
      } else {
        hapticActive = false;
      }
    }
  } else if (type == 'Z') {
    // Recenter / Zero offsets directly to current absolute angles
    rollOffset = roll;
    pitchOffset = pitch;
    yawOffset = yaw;
  } else if (type == 'C') {
    // C,<r>,<g>,<b> — Front Optical LED Color Command
    // Front optical beacon is physical 5mm Blue LED for webcam tracking;
    // Command is accepted and acknowledged safely without serial buffer error.
  }
}

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
  int reading = digitalRead(buttonPin);

  if (reading != lastButtonReading) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != buttonState) {
      buttonState = reading;

      if (buttonState == LOW) {
        pressStartTime = millis();
        clickCount++;
      } else {
        lastReleaseTime = millis();
      }
    }
  }

  lastButtonReading = reading;

  if (clickCount > 0 && (millis() - lastReleaseTime) > doubleClickGap && buttonState == HIGH) {
    if (clickCount == 1) pendingClickEvent = 1;
    else if (clickCount >= 2) pendingClickEvent = 2;
    clickCount = 0;
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(400000L); // 400kHz fast I2C

  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(motorPin, OUTPUT);
  analogWrite(motorPin, 0);

  // Wake up the MPU-6050
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0);    // Set to 0 to wake up MPU-6050
  byte err = Wire.endTransmission(true);

  if (err != 0) {
    Serial.println(F("ERR: MPU-6050 not responding at 0x68. Check A4(SDA) and A5(SCL)"));
  }

  // Startup haptic confirmation chirp
  analogWrite(motorPin, 120);
  delay(80);
  analogWrite(motorPin, 0);

  lastImuTime = micros();
  lastTelemetryTime = millis();
}

void loop() {
  // 1. Process incoming serial commands
  checkSerialInput();

  // 2. Non-blocking haptic timer
  if (hapticActive && millis() >= hapticEndTime) {
    analogWrite(motorPin, 0);
    hapticActive = false;
  }

  // 3. Update button state
  updateButtonState();

  // 4. Read MPU-6050 sensor data (Burst read 14 bytes)
  unsigned long nowMicros = micros();
  float dt = (nowMicros - lastImuTime) / 1000000.0f;
  if (dt <= 0.0f || dt > 0.1f) dt = 0.01f;
  lastImuTime = nowMicros;

  int16_t rawAcX = 0, rawAcY = 0, rawAcZ = 0;
  int16_t rawGyX = 0, rawGyY = 0, rawGyZ = 0;

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);

  if (Wire.requestFrom(MPU_ADDR, 14, true) == 14) {
    rawAcX = (Wire.read() << 8) | Wire.read();
    rawAcY = (Wire.read() << 8) | Wire.read();
    rawAcZ = (Wire.read() << 8) | Wire.read();
    Wire.read(); Wire.read(); // Skip Tmp
    rawGyX = (Wire.read() << 8) | Wire.read();
    rawGyY = (Wire.read() << 8) | Wire.read();
    rawGyZ = (Wire.read() << 8) | Wire.read();
  }

  // Convert raw values (±2g range: 16384 LSB/g, ±250 deg/s range: 131.0 LSB/deg/s)
  float ax = (rawAcX / 16384.0f) * 9.80665f; // m/s^2
  float ay = (rawAcY / 16384.0f) * 9.80665f;
  float az = (rawAcZ / 16384.0f) * 9.80665f;

  float gyroRateX = rawGyX / 131.0f; // deg/s
  float gyroRateY = rawGyY / 131.0f;
  float gyroRateZ = rawGyZ / 131.0f;

  // Physical Wand Orientation Alignment:
  // - Pitch: Tilting the wand tip up and down (rotation around X-axis)
  // - Roll:  Twisting the wand barrel between fingers (rotation around Y-axis)
  // - Yaw:   Sweeping the wand tip left and right (rotation around Z-axis)
  float accPitch = atan2(ay, az) * 57.29578f;
  float accRoll  = atan2(-ax, sqrt(ay * ay + az * az)) * 57.29578f;

  pitch = 0.98f * (pitch + gyroRateX * dt) + 0.02f * accPitch;
  roll  = 0.98f * (roll + gyroRateY * dt) + 0.02f * accRoll;
  yaw   = yaw + gyroRateZ * dt;

  // 5. Emit Telemetry at 100 Hz (every 10 ms)
  unsigned long nowMillis = millis();
  if (nowMillis - lastTelemetryTime >= 10) {
    lastTelemetryTime = nowMillis;

    float outRoll  = roll - rollOffset;
    float outPitch = pitch - pitchOffset;
    float outYaw   = yaw - yawOffset;

    uint8_t btnOutput = (buttonState == LOW) ? 1 : 0;
    uint8_t eventToSend = pendingClickEvent;
    pendingClickEvent = 0;

    // Compact CSV protocol: T,<roll>,<pitch>,<yaw>,<ax>,<ay>,<az>,<btn>,<clickEvent>
    Serial.print(F("T,"));
    Serial.print(outRoll, 2);
    Serial.print(F(","));
    Serial.print(outPitch, 2);
    Serial.print(F(","));
    Serial.print(outYaw, 2);
    Serial.print(F(","));
    Serial.print(ax, 2);
    Serial.print(F(","));
    Serial.print(ay, 2);
    Serial.print(F(","));
    Serial.print(az, 2);
    Serial.print(F(","));
    Serial.print(btnOutput);
    Serial.print(F(","));
    Serial.println(eventToSend);
  }
}
