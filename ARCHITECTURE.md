# AirTouch — System Architecture & Hardware Context

## 1. Project Overview
AirTouch is a 3D spatial haptic wand and browser-based spatial studio built with:
- **Hardware**: Arduino Nano (ATmega328P), GY-521 MPU-6050 (6-axis IMU), 10mm Coin Vibrator Motor, ILLUM Pushbutton Switch, and a diffused Front Tracking LED (NeoPixel or standard LED).
- **Frontend**: Vite + React + TypeScript + Three.js (`@react-three/fiber`, `@react-three/drei`) + Tailwind CSS.
- **Communication**: Bidirectional Web Serial API (`navigator.serial` at `115200` baud) over USB, paired with 60 FPS browser webcam optical tracking (`getUserMedia` HTML5 Canvas blob detection) and Web Speech API for voice commands.

---

## 2. Strict Hardware Pinout (`Arduino Nano ATmega328P`)
NEVER change these pin definitions in firmware:
- **MPU-6050 IMU (I2C)**:
  - `VCC` -> `5V` (or `3V3` on GY-521)
  - `GND` -> `GND`
  - `SDA` -> `A4` (Hardware I2C SDA)
  - `SCL` -> `A5` (Hardware I2C SCL)
- **Coin Vibrator Motor (PWM Haptics)**:
  - `Pos (+)` -> `Pin 9` — Driven via `analogWrite(9, pwmValue)` (0–255 PWM via Timer1).
  - `Neg (-)` -> `GND`
- **ILLUM Pushbutton Switch (Primary Trigger)**:
  - `Leg 1` -> `Pin 2` — Configured with `pinMode(2, INPUT_PULLUP)`. Active `LOW` (`0` = pressed, `1` = released).
  - `Leg 2` -> `GND`
- **Tip Optical Beacon LED**:
  - `Data / Anode (+)` -> `Pin 3` — Always illuminated brightly during operation (NeoPixel data or PWM high) so the laptop webcam can track the front diffuser orb.
  - `GND / Cathode (-)` -> `GND`

---

## 3. Arduino CLI Build & Flash Commands
- **Target FQBN**: `arduino:avr:nano:cpu=atmega328` (or `arduino:avr:nano:cpu=atmega328old` for clone bootloaders).
- **Compile**:
  `arduino-cli compile --fqbn arduino:avr:nano:cpu=atmega328 firmware/airtouch_firmware`
- **Upload**:
  `arduino-cli upload -p <PORT> --fqbn arduino:avr:nano:cpu=atmega328 firmware/airtouch_firmware`

---

## 4. Bidirectional Serial Protocol (`115200` Baud, Newline-Delimited)

### A. Wand -> Browser (`100 Hz` Telemetry Stream)
Compact CSV line emitted every `10 ms` to minimize serial parsing overhead:
Format: `T,<roll>,<pitch>,<yaw>,<ax>,<ay>,<az>,<btn>,<clickEvent>\n`
- `roll`, `pitch`, `yaw`: Complementary-filtered orientation angles in degrees (`float`, 2 decimal places).
- `ax`, `ay`, `az`: Linear acceleration in m/s² (`float`, 2 decimal places) for gesture flick detection.
- `btn`: Current button state (`1` = held down, `0` = released).
- `clickEvent`: Edge-triggered event (`0` = none, `1` = single click, `2` = double click for camera/IMU recenter).
Example: `T,12.45,-4.10,88.20,0.12,-0.05,9.81,1,0`

### B. Browser -> Wand (Haptic & LED Commands)
Single-line ASCII commands terminated by `\n`:
- `H,<pwm>,<duration_ms>\n`: Set haptic motor intensity (`0–255`) for `duration_ms` (e.g., `H,200,80\n` for a crisp collision thud, or `H,90,0\n` for continuous surface texture buzz; `H,0,0\n` to stop).
- `C,<r>,<g>,<b>\n`: Set NeoPixel tip LED color (`0–255` each) if using addressable RGB, or brightness if standard LED.
- `Z\n`: Zero/recenter the IMU yaw/roll/pitch offsets on the microcontroller.

---

## 5. Spatial Tracking & 1-Button Interaction Model

### A. Hybrid 6-DOF Fusion
1. **3D Position (`X, Y, Z`) from Webcam Optical Tracker**:
   - Captures 60 FPS video via `navigator.mediaDevices.getUserMedia`.
   - Tracks the brightest cyan/white circular blob (the `12 mm` diffused LED tip).
   - Maps blob centroid `(u, v)` -> 3D stage `(X, Y)` (smoothed with an exponential moving average / 1-Euro filter to eliminate jitter).
   - Maps blob apparent pixel radius `r` -> 3D depth `Z` (larger radius = closer to camera).
   - Fallback Mode: If webcam tracking is toggled off, integrate IMU tilt/yaw as a 3D laser pointer raycaster.
2. **3D Orientation (`Roll, Pitch, Yaw`) from MPU-6050**:
   - Directly rotates the 3D wand cursor/tool mesh in the Three.js scene.

### B. Multi-Modal Controls (Using 1 Physical Button + IMU + Voice)
- **Hover (Button Released `btn=0`)**: Move 3D cursor freely without modifying the scene.
- **Primary Action (Button Held `btn=1`)**: Draw voxel/tube stroke, carve clay, grab/drag 3D part, or rub haptic surface.
- **Brush Size / Parameter Dial (Wrist Roll Twist)**: Twisting the wand along its roll axis dynamically scales brush radius (`1x` to `5x`) and sends short haptic clicks (`H,140,15\n`) every `15°` of rotation like a physical detent dial.
- **Undo Gesture (Sharp Left Flick)**: If `ax < -18.0 m/s²` while button is released, trigger `undo()` and fire a double haptic pulse.
- **Recenter / Calibration (Double-Click `clickEvent=2` or `Spacebar`)**: Sets current wand position and IMU angles as `(0, 0, 0)` origin.
- **Voice Commands (Browser `webkitSpeechRecognition` or Onboard Mic)**:
  - Phrases: *"Sculpt mode"*, *"Erase mode"*, *"Texture mode"*, *"Slicer mode"*, *"Clear canvas"*, *"Spawn gear"*, *"Export STL"*.

---

## 6. Four Core Interactive Demo Modes in Three.js
Build a clean top/bottom glassmorphic HUD allowing instant switching between:
1. **3D Spatial Sculpt & Paint**: Extrude smooth 3D tube/metaball strokes in mid-air; continuous subtle haptic buzz (`H,85,50\n`) while extruding.
2. **Haptic Material & Texture Lab**: Present 4 interactive spheres (*Ice*, *Coarse Sandpaper*, *Corrugated Metal*, *Soft Rubber*). Raycast wand tip collisions against the spheres and stream real-time PWM waveforms (`H,<pwm>,<ms>\n`) based on cursor velocity and surface roughness.
3. **CAD Cross-Section Slicer & Exploder**: Load a multi-part 3D assembly (or procedural mechanical gearset). Holding the button grabs/explodes parts; switching to Slicer attaches a `THREE.Plane` clipping plane to the wand's IMU `pitch` and `roll` so tilting your wrist slices the 3D object in real time.
4. **Voice-to-3D Physics Sandbox**: Speak object names to spawn physics-enabled 3D primitives you can bat around with the wand, triggering heavy `H,255,60\n` haptic impacts on collision.
