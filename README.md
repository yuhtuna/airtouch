# AirTouch

AirTouch is a 3D spatial haptic wand and browser-based spatial studio integrating a Seeed Studio XIAO ESP32S3 Sense, an MPU6050 6-DoF IMU, a coin vibrator motor, an illuminated trigger pushbutton, a diffused front tracking LED, and a real-time 3D orientation visualization built with Vite, React, and Three.js.

> 📖 **Full System Architecture & Hardware Specification**: See [ARCHITECTURE.md](file:///c:/Users/tuant/Downloads/HKT/airtouch/ARCHITECTURE.md) for pinouts, serial protocol, optical tracking, and interaction model.

---

## 🛠 Prerequisites Installed

- **`arduino-cli`** (v1.6.0+)
- **ESP32 Core** (`esp32:esp32` via Espressif board manager)
- **Hardware Libraries**:
  - `Adafruit MPU6050`
  - `Adafruit Unified Sensor`
  - `Adafruit NeoPixel`
  - `Adafruit BusIO` & `Adafruit GFX`

---

## 🚀 Quick Start

### 1. Compile Firmware
Compile the firmware for Seeed Studio XIAO ESP32S3 with **USB CDC On Boot** and **OPI PSRAM** enabled:

```bash
npm run firmware:compile
```

Equivalent direct command:
```bash
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:CDCOnBoot=cdc,PSRAM=opi firmware/airtouch_firmware
```

### 2. Identify & Flash Hardware
1. Connect your Seeed Studio XIAO ESP32S3 Sense via USB-C.
2. List available ports:
   ```bash
   npm run firmware:boards
   ```
3. Compile and flash directly:
   ```bash
   npm run firmware:flash
   ```
   Or specify a port if multiple serial devices are connected:
   ```bash
   arduino-cli upload -p COMx --fqbn esp32:esp32:XIAO_ESP32S3:CDCOnBoot=cdc,PSRAM=opi firmware/airtouch_firmware
   ```

### 3. Launch 3D Visualizer Frontend
Start the local Vite development server:

```bash
npm run dev
```

Then open `http://localhost:3000` in Google Chrome or Microsoft Edge (which support the Web Serial API).
- Click **"Connect Hardware"** to stream live orientation from the ESP32.
- Toggle **"Simulation: ON"** to test 3D rendering and motion smoothing even when no hardware is attached.

---

## 📁 Project Structure

```
airtouch/
├── firmware/
│   └── airtouch_firmware/
│       └── airtouch_firmware.ino   # ESP32S3 firmware (MPU6050 + NeoPixel + CDC Serial)
├── src/
│   ├── App.jsx                     # Three.js 3D viewport + Web Serial telemetry dashboard
│   ├── main.jsx                    # React entrypoint
│   └── index.css                   # Global styling
├── index.html                      # HTML shell
├── package.json                    # Scripts and dependencies
└── vite.config.js                  # Vite configuration
```
