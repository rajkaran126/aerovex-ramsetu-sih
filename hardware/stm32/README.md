# AEROVEX / AERO-TWIN — STM32 Physical Sensor Acquisition Node

## 1. Overview
This directory contains the Hardware Abstraction Layer (HAL) specifications for the physical ground-based engine test bench sensor node. The node is implemented on an **STM32F4** or **STM32H7** microcontroller, acquiring raw analog and digital signals from engine instrumentation and transmitting calibrated CAN packets to the AERO-TWIN edge computer at 50 Hz.

---

## 2. Sensor Instrumentation & Pin Assignments

| Sensor Function | Transducer / Interface | STM32 Pin | Protocol / Channel | Sampling Rate | Scale Factor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Crankshaft Speed (RPM)** | Hall-Effect / Variable Reluctance | `PA0` | TIM2 Input Capture | 100 Hz | 1 RPM / bit |
| **Manifold Pressure (MAP)** | MPX4250AP (0-250 kPa absolute) | `PA1` | ADC1_IN1 (12-bit) | 50 Hz | 0.01 inHg / bit |
| **Oil Pressure** | 0-10 bar Piezo-resistive Transducer | `PA2` | ADC1_IN2 (12-bit) | 50 Hz | 0.01 bar / bit |
| **Throttle Position (TPS)** | Rotational Potentiometer | `PA3` | ADC1_IN3 (12-bit) | 50 Hz | 0.4% / bit |
| **Cylinder Head Temp (CHT)** | Type-K Thermocouple + MAX31855 | `PB0` (CS1) | SPI1 (10 MHz) | 10 Hz | 0.1 °C / bit |
| **Exhaust Gas Temp (EGT)** | Type-K Thermocouple + MAX31855 | `PB1` (CS2) | SPI1 (10 MHz) | 10 Hz | 0.1 °C / bit |
| **Engine Vibration** | ADXL345 3-Axis Digital Accelerometer | `PB6/PB7` | I2C1 (400 kHz) | 100 Hz | 0.01 g-RMS / bit |
| **Ambient Pressure & Temp** | BMP280 Barometric Sensor | `PB6/PB7` | I2C1 (400 kHz) | 10 Hz | 0.1 hPa / bit |
| **CAN Bus Transceiver** | SN65HVD230 / MCP2515 | `PB8/PB9` | bxCAN / CAN1 | 500 kbps | Standard 11-bit IDs |

---

## 3. CAN Bus Arbitration Message Dictionary

Conforming to [`aerovex_can_protocol.h`](aerovex_can_protocol.h):

* `0x100` — **Core Dynamics** (RPM [2B], Throttle [1B], MAP [2B]) @ 50 Hz
* `0x101` — **Thermal State** (CHT [2B], EGT [2B]) @ 10 Hz
* `0x102` — **Fluid Dynamics** (Oil Pressure [2B], Oil Temp [2B], Fuel Flow [2B]) @ 20 Hz
* `0x103` — **Vibration & Load** (Vibration RMS [2B], Engine Load [1B]) @ 50 Hz
* `0x104` — **Environmental** (Ambient Temp [2B], Ambient Pressure [2B], Baro Altitude [2B]) @ 5 Hz
* `0x105` — **Node Health & Watchdog** (Battery Voltage [1B], Sequence Counter [2B], Error Flags [1B]) @ 2 Hz

---

## 4. Hardware Safety, Optical Isolation & Electrical Schematics

### 4.1 Electrical Power Architecture
* **Primary Test Bench Rail:** 24V DC unregulated laboratory supply.
* **Galvanic Isolation:** Traco Power isolated DC-DC converter (`24V -> 5V DC, 1500V isolation barrier`) prevents ignition ground loops and inductive spikes from reaching the MCU logic plane.
* **Logic Voltage:** Ultra-low-dropout 3.3V regulator (AMS1117-3.3) powering STM32F4/H7 core and digital peripherals.

### 4.2 Optical Tachometer Isolation Circuit (Crankshaft Speed Pickoff)
* **Optical Isolator:** 6N137 High-Speed Optocoupler (10 MBd logic gate output).
* **Emitter Circuit:** Variable reluctance / magnetic pickup output conditioned through an NPN Schmitt trigger, driving the 6N137 IR LED with a 330 $\Omega$ current-limiting resistor and anti-parallel 1N4148 flyback clamp.
* **Collector Circuit:** Open-collector pull-up to +3.3V ($R = 1.0\text{ k}\Omega$) routed directly to STM32 `PA0` (TIM2_CH1 Input Capture).
* **Noise Immunity:** Eliminates magneto ignition noise spikes ($\le 25\text{ kV}$) from corrupting engine RPM timing.

```text
 Engine Mag Pickup ──[ 10k ]──┬──|>| Clamp (1N4148)
                             │
                      [ 330R ]──>| 6N137 LED (Pin 2,3)
                                  │ (Optical Isolation Barrier 2.5 kV)
                                  ▼
   +3.3V Clean ──[ 1.0k ]──┬───── 6N137 Out (Pin 6) ───> STM32 PA0 (TIM2)
                           │
                         [ 100nF Decoupling ]
```

### 4.3 CAN Bus Physical Layer & Termination
* **Transceiver:** Texas Instruments SN65HVD230 (3.3V supply, 1 Mbps CAN transceiver).
* **Split Termination:** $60\,\Omega + 60\,\Omega$ ($120\,\Omega$ total) across CAN-H and CAN-L, with center-tap $4.7\text{ nF}$ capacitor to ground for high-frequency common-mode EMI filtering.
* **ESD Protection:** NXP PESD1CAN bidirectional TVS diode array on CAN bus connector.

---

## 5. Hardware-in-the-Loop (HIL) Physical vs. Simulation Boundaries

```text
  ┌────────────────────────────────────────────────────────┐
  │         PHYSICAL TEST BENCH (Ground-Based Engine)      │
  │  - Single-cylinder / 4-stroke aero-piston test engine  │
  │  - Crankshaft optical encoder (RPM)                    │
  │  - Dual EGT / CHT Type-K thermocouples                 │
  │  - Fuel flow turbine meter + Oil pressure transducer   │
  │  - STM32F4/H7 DAQ Node + SN65HVD230 CAN Transceiver    │
  └───────────────────────────┬────────────────────────────┘
                              │ Physical CAN @ 500 kbps
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │        AERO-TWIN BACKEND TELEMETRY PIPELINE            │
  │  (Exact same unified ingestion pipeline for both)      │
  │  1. CanTelemetryBridge / UnifiedTelemetryRecord        │
  │  2. Zero-Trust Cyber Shield (12 detection vectors)     │
  │  3. Self-Healing Reconstruction (Digital Twin)         │
  │  4. Local AI Prognostics (XGBoost + SHAP + Quantile)   │
  │  5. Mission Replanning (Pareto multi-objective)        │
  └───────────────────────────▲────────────────────────────┘
                              │
  ┌───────────────────────────┴────────────────────────────┐
  │             SIMULATION-ONLY SUBSYSTEMS                 │
  │  - Flight Aerodynamics & 6-DoF UAV trajectory          │
  │  - SwarmNet 4-UAV tactical mesh (Alpha/Bravo/Charlie)  │
  │  - Dual-Constellation NavIC / GPS jamming & failover   │
  │  - 14:1 glide cone emergency diversion airfields      │
  │  - Ghost UAV shadow simulation for replanning          │
  └────────────────────────────────────────────────────────┘
```

### 5.1 Physical Boundary Mandate
1. **Never simulate physical sensors when CAN bench is connected:** The system detects active CAN frames on the configured socket or virtual interface, sets `source = "CAN_PHYSICAL"`, and populates real transducer signals.
2. **Deterministic Failover:** If CAN telemetry packets drop for $> 200\text{ ms}$, the Zero-Trust Cyber Shield flags packet loss and the Self-Healing Pipeline substitutes Digital Twin expected states (`source = "reconstructed"`).
3. **No Fake Flight Hardware:** Flight aerodynamics, NavIC jamming, and SwarmNet meshes are explicitly simulated, preventing misleading claims during airworthiness audits while providing a 100% physically grounded engine twin.

