import { execSync, spawnSync } from 'child_process';
import path from 'path';

// Ensure Arduino CLI is in PATH
const arduinoCliDir = 'C:\\Program Files\\Arduino CLI';
const env = { ...process.env };
if (!env.PATH.includes(arduinoCliDir)) {
  env.PATH = `${arduinoCliDir};${env.PATH}`;
}

const FQBN = 'arduino:avr:nano:cpu=atmega328old';
const SKETCH = 'firmware/airtouch_firmware';
const PRIORITY_PORTS = ['COM6', 'COM7'];

// Optional manual port from CLI arg: node scripts/flash.js COM6
const manualPort = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const shouldCompile = process.argv.includes('--compile');

function run(cmd, inherit = true) {
  try {
    return execSync(cmd, { env, stdio: inherit ? 'inherit' : 'pipe', encoding: 'utf-8' });
  } catch (err) {
    return null;
  }
}

function getAvailablePorts() {
  try {
    const output = execSync('arduino-cli board list', { env, encoding: 'utf-8' });
    const lines = output.split('\n');
    const ports = [];
    for (const line of lines) {
      const match = line.match(/^(COM\d+)/i);
      if (match) {
        ports.push(match[1].toUpperCase());
      }
    }
    return ports;
  } catch (e) {
    return [];
  }
}

async function main() {
  console.log('⚡ AirTouch Nano Smart Flasher (Old Bootloader)');
  console.log(`Board FQBN: ${FQBN}`);

  if (shouldCompile) {
    console.log('\n🔨 Compiling firmware...');
    const compileResult = spawnSync('arduino-cli', ['compile', '--fqbn', FQBN, SKETCH], {
      env,
      stdio: 'inherit',
    });
    if (compileResult.status !== 0) {
      console.error('❌ Compilation failed! Aborting upload.');
      process.exit(1);
    }
    console.log('✓ Firmware compiled successfully.');
  }

  const detectedPorts = getAvailablePorts();
  console.log(`\n🔍 Detected active COM ports: ${detectedPorts.length > 0 ? detectedPorts.join(', ') : 'None'}`);

  let candidatePorts = [];
  if (manualPort) {
    candidatePorts = [manualPort.toUpperCase()];
  } else {
    // Priority: COM6 first, then COM7, then any other detected serial port
    const preferred = detectedPorts.filter((p) => PRIORITY_PORTS.includes(p));
    const fallback = PRIORITY_PORTS.filter((p) => !preferred.includes(p));
    const otherDetected = detectedPorts.filter((p) => !PRIORITY_PORTS.includes(p));
    candidatePorts = [...preferred, ...fallback, ...otherDetected];
    if (candidatePorts.length === 0) candidatePorts = PRIORITY_PORTS;
  }

  console.log(`Targeting ports in priority order: ${candidatePorts.join(' -> ')}`);

  let success = false;
  for (const port of candidatePorts) {
    console.log(`\n🚀 Attempting upload to ${port}...`);
    const res = spawnSync('arduino-cli', ['upload', '-p', port, '--fqbn', FQBN, SKETCH], {
      env,
      stdio: 'inherit',
    });

    if (res.status === 0) {
      console.log(`\n🎉 SUCCESS! Firmware successfully flashed to Arduino Nano on ${port}!`);
      success = true;
      break;
    } else {
      console.warn(`⚠️ Upload to ${port} failed. Trying next candidate...`);
    }
  }

  if (!success) {
    console.error('\n❌ Could not upload to any targeted ports.');
    console.log('Please check:');
    console.log('1. Arduino Nano USB cable is plugged in.');
    console.log('2. Web browser or other serial monitor (e.g. Arduino IDE) has closed the COM port.');
    console.log('3. Run "arduino-cli board list" to see the active port.');
    process.exit(1);
  }
}

main();
