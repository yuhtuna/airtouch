# AirTouch

AirTouch is a 3D spatial haptic wand and browser-based spatial studio integrating an Arduino Nano (ATmega328P), an MPU-6050 6-DoF IMU, a coin vibrator motor, an illuminated trigger pushbutton, a diffused front tracking LED, and a real-time 3D orientation visualization built with Vite, React, and Three.js.

> 📖 **Full System Architecture & Hardware Specification**: See [ARCHITECTURE.md](file:///c:/Users/tuant/Downloads/HKT/airtouch/ARCHITECTURE.md) for pinouts, serial protocol, optical tracking, and interaction model.

---

## 🛠 Prerequisites Installed

- **`arduino-cli`** (v1.6.0+)
- **Arduino AVR Core** (`arduino:avr` via Arduino CLI)
- **Hardware Libraries**:
  - `Adafruit MPU6050`
  - `Adafruit Unified Sensor`
  - `Adafruit NeoPixel`
  - `Adafruit BusIO`

---

## 🚀 Quick Start

### 1. Compile Firmware
Compile the firmware for Arduino Nano (ATmega328P):

```bash
npm run firmware:compile
```

For Arduino Nano clone boards with the Old Bootloader:
```bash
npm run firmware:compile:old
```

Equivalent direct command:
```bash
arduino-cli compile --fqbn arduino:avr:nano:cpu=atmega328 firmware/airtouch_firmware
```

### 2. Identify & Flash Hardware
1. Connect your Arduino Nano via USB.
2. List available ports:
   ```bash
   npm run firmware:boards
   ```
3. Compile and flash directly:
   ```bash
   npm run firmware:flash
   ```
   Or if using an old bootloader board:
   ```bash
   npm run firmware:flash:old
   ```
   Or specify a port if multiple serial devices are connected:
   ```bash
   arduino-cli upload -p COMx --fqbn arduino:avr:nano:cpu=atmega328 firmware/airtouch_firmware
   ```

### 3. Launch 3D Visualizer Frontend
Start the local Vite development server:

```bash
npm run dev
```

Then open `http://localhost:3000` in Google Chrome or Microsoft Edge (which support the Web Serial API).
- Click **"Connect Wand"** to stream live orientation from the Arduino Nano.
- The app automatically runs smooth floating simulation when disconnected.

---

## 🎯 Four Core Interactive Demo Modes

1. **3D Spatial Sculpt & Paint**: Extrude smooth 3D tube strokes in mid-air with continuous haptic feedback; twist wand wrist to scale brush radius; binary STL export.
2. **Haptic Material & Texture Lab**: 4 material spheres (*Ice*, *Coarse Sandpaper*, *Corrugated Metal*, *Soft Rubber*) with velocity-dependent dynamic PWM waveforms and LED color synchronization.
3. **CAD Cross-Section Slicer & Exploder**: Multi-part planetary gearset with wrist-tilt clipping plane and trigger-held explosion.
4. **Voice-to-3D Physics Sandbox**: Speak commands to spawn dynamic 3D primitives with kinematic wand collisions and impulse transfer.
