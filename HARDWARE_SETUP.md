# AEROVEX / AERO-TWIN — Physical Hardware Setup & Wiring Specification

## 1. Safety Ground Rules (§5 & §64)

> [!CAUTION]
> **SAFETY FIRST:** Never intentionally induce destructive mechanical failure or disable safety cutoffs on a physical internal combustion engine. All degradation modes on physical engines must be monitored through non-destructive ground test bench instrumentation or simulated via Software-in-the-Loop (SIL).

---

## 2. Test Bench Component Bill of Materials (BOM)

| Component | Specification / Part Number | Function | Interface to MCU |
| :--- | :--- | :--- | :--- |
| **Microcontroller** | STM32F407VGT6 / STM32H743ZI | Data Acquisition & CAN Node | Onboard Cortex-M4/M7 |
| **CAN Transceiver** | TI SN65HVD230 (3.3V) | Physical CAN 2.0B Bus Driver | `PB8` (CAN_RX), `PB9` (CAN_TX) |
| **Optical Isolator** | 6N137 High-Speed Optocoupler (10 MBd) | Magneto Ignition Noise Barrier | `PA0` (TIM2_CH1 Input Capture) |
| **Manifold Pressure** | Freescale MPX4250AP (20–250 kPa) | Intake Manifold Absolute Pressure | `PA1` (ADC1_IN1, 12-bit) |
| **Oil Pressure** | 0–10 bar Piezoresistive Transducer | Lubrication Circuit Pressure | `PA2` (ADC1_IN2, 12-bit) |
| **Throttle Position** | Dual-track Potentiometer (TPS) | Operator Throttle Demand | `PA3` (ADC1_IN3, 12-bit) |
| **Thermocouple DAQ** | MAX31855 Cold-Junction Amplifiers | Type-K CHT & EGT Probes | `PB0`, `PB1` (SPI1 Chip Selects) |
| **Vibration Sensor** | Analog Devices ADXL345 | Engine Block High-Freq Vibration | `PB6`, `PB7` (I2C1, 400 kHz) |
| **Ambient Barometer** | Bosch BMP280 | Ambient Pressure & Temperature | `PB6`, `PB7` (I2C1, 400 kHz) |
| **Emergency Relay** | 5V Optically Isolated Solid State Relay | Ignition Magneto Grounding Relay | `PC13` (GPIO Output Cutoff) |

---

## 3. Optical Isolation & Electrical Wiring

```text
 Engine Mag Pickup ──[ 10k ]──┬──|>| Clamp (1N4148)
                             │
                      [ 330R ]──>| 6N137 LED (Pin 2,3)
                                  │ (2.5 kV Galvanic Isolation Barrier)
                                  ▼
   +3.3V Clean ──[ 1.0k ]──┬───── 6N137 Out (Pin 6) ───> STM32 PA0 (TIM2_CH1)
                           │
                         [ 100nF Decoupling ]
```

* **Power Plane:** 24V DC test bench supply stepped down via Traco Power 1500V isolated DC-DC converter to +5V DC, followed by an AMS1117-3.3 ultra-low-dropout regulator.
* **CAN Bus Termination:** Standard split termination of $60\,\Omega + 60\,\Omega$ with center-tap $4.7\text{ nF}$ ceramic capacitor to ground for common-mode electromagnetic noise attenuation.

---

## 4. Edge Computer Interface

* **Physical CAN:** Connect CAN-H and CAN-L to a USB-to-CAN adapter (InnoMaker USB-CAN, Peak PCAN-USB, or Waveshare CAN HAT).
* **Linux / Jetson:** `ip link set can0 up type can bitrate 500000`.
* **Windows / Dev:** Use backend `TELEMETRY_SOURCE = "SIMULATION"` or virtual serial loopback without needing physical hardware connected.
