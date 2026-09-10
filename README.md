# AERO-TWIN: AI-Enabled Real-Time Digital Twin for MALE UAV Aero-Piston Engines

[![Python](https://img.shields.io/badge/Python-3.11%2B%20%7C%203.13-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111%2B-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r174%20%2F%20R3F-black.svg)](https://threejs.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-38B2AC.svg)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**AERO-TWIN** is a full-stack, research-grade Cyber-Physical Digital Twin and AI Prognostics platform designed for aero-piston engines (e.g. Rotax 914 / 915 iS class) powering Medium-Altitude Long-Endurance (MALE) Unmanned Aerial Vehicles (UAVs).

Engineered to fulfill the pipeline:
$$\mathbf{Sense \longrightarrow Verify \longrightarrow Model \longrightarrow Detect \longrightarrow Diagnose \longrightarrow Predict \longrightarrow Simulate \longrightarrow Replan \longrightarrow Advise}$$

---

## 🛰 Key Engineering Capabilities

1. **First-Principles Engine Thermodynamics & Residual State Estimator**:
   - Continuous thermodynamic simulation accounting for altitude lapse rate, ambient density $\rho(h)$, throttle demand, manifold absolute pressure (MAP), and cooling airflow.
   - Computes expected synthetic healthy states and continuous residual vectors $\mathbf{r}(t) = \mathbf{y}_{\text{actual}}(t) - \hat{\mathbf{y}}_{\text{twin}}(t)$.
   - Real-time Health Index $H(t) \in [0, 100]$ weighted across thermal margins, vibration energy, lubrication dynamics, and residual divergence.

2. **Cyber-Telemetry Validation & Self-Healing Telemetry**:
   - Zero-trust telemetry stream validator detecting:
     - **Sensor Freezes** (zero variance)
     - **Sensor Spikes / Out-of-bounds**
     - **Sensor Biases / Drifts**
     - **High-Frequency Sensor Noise / Dropouts**
   - **Self-Healing Fallback**: Automatically isolates compromised or corrupted sensor channels and substitutes calibrated Digital Twin analytical estimates to maintain uninterrupted flight control and AI prognostics.

3. **Multi-Model AI Prognostics & Health Management (PHM)**:
   - **Anomaly Detection**: Rolling feature extractor + Isolation Forest / Statistical envelope detector.
   - **Fault Classification**: Calibrated Random Forest multi-class classifier identifying 7 distinct failure modes:
     - *Healthy*
     - *Fuel Injection Malfunction / Clogged Injector*
     - *Cylinder Head / Radiator Cooling Degradation*
     - *Oil Lubrication Starvation / Pump Degradation*
     - *Combustion Inefficiency / Knock*
     - *Mechanical Wear / Bearing Deterioration*
     - *Sensor Anomaly / Instrumentation Fault*
   - **Explainability**: Exact **SHAP (SHapley Additive exPlanations)** attribution ranking top feature contributions to provide defensible engineering insights.
   - **Remaining Useful Life (RUL)**: Multi-quantile Random Forest regressor with uncertainty bounds (10th, 50th, 90th percentiles).

4. **Dynamic Mission Replanning & Risk Assessment**:
   - Computes probability of mission completion $P(\text{Mission Success})$ against remaining endurance and thermal margins.
   - Autonomous replanning engine generating Pareto-optimal candidate action plans:
     - *Continue Mission (Throttled Cruise)*
     - *Descend to Denser Air (Optimize Cooling)*
     - *Divert to Nearest Emergency Landing Strip*
     - *Immediate Return to Base (RTB)*
   - Interactive **What-If Simulator** for pilot/operator decision rehearsal.

5. **Cockpit-Grade 3D Mission Visualizer (Three.js / React Three Fiber)**:
   - High-fidelity 3D MALE UAV airframe with spinning dual-blade propeller, control surfaces, and real-time altitude/attitude dynamics.
   - Multi-camera director: Orbit Camera, Chase/Follow Cam, Cockpit HUD, Top-Down Strategic Map, and Engine Cutaway/Thermal X-Ray.
   - Dynamic terrain, live flight path ribbon, and holographic **Ghost UAV** projection displaying proposed replanned trajectories.

---

## 🏛 System Architecture

```
                               ┌─────────────────────────────────────────┐
                               │       MALE UAV Aero-Piston Engine       │
                               │        (Physical / Simulated)           │
                               └────────────────────┬────────────────────┘
                                                    │ Telemetry Stream (10-50 Hz)
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 AERO-TWIN BACKEND                                      │
│                                                                                        │
│  ┌───────────────────────┐         ┌───────────────────────┐                           │
│  │   Cyber-Telemetry     │         │   Physics Engine      │                           │
│  │   Integrity Monitor   │◄───────►│    Digital Twin       │                           │
│  │  (Zero-Trust Filter)  │         │ (Thermodynamic Model) │                           │
│  └──────────┬────────────┘         └───────────┬───────────┘                           │
│             │ Validated / Reconstructed        │ Expected States & Residuals           │
│             ▼                                  ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐                           │
│  │                     AI PROGNOSTICS                      │                           │
│  │  - Isolation Forest Anomaly Detection                   │                           │
│  │  - Multi-Class Fault Classifier (Random Forest)         │                           │
│  │  - SHAP Explainability Engine                           │                           │
│  │  - Multi-Quantile RUL Predictor with Uncertainty Bounds │                           │
│  └──────────────────────────┬──────────────────────────────┘                           │
│                             ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐                           │
│  │                 MISSION RISK & REPLANNER                │                           │
│  │  - Failure Probability Assessment                       │                           │
│  │  - Pareto Trajectory Optimization (RTB / Divert)        │                           │
│  │  - What-If Scenario Predictor                           │                           │
│  └──────────────────────────┬──────────────────────────────┘                           │
│                             │                                                          │
│  ┌──────────────────────────┴──────────────────────────────┐                           │
│  │              FastAPI REST + WebSocket Server            │                           │
│  │          (Bi-directional State Streaming @ 1Hz)         │                           │
│  └──────────────────────────┬──────────────────────────────┘                           │
└─────────────────────────────┼──────────────────────────────────────────────────────────┘
                              │ JSON Telemetry & Predictions (WS: /ws/telemetry)
                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                AERO-TWIN FRONTEND                                      │
│                                                                                        │
│  ┌───────────────────────┐  ┌────────────────────────┐  ┌───────────────────────────┐ │
│  │  Three.js 3D Mission  │  │ Real-Time Health & HUD │  │   AI Diagnostic Studio    │ │
│  │  Simulator & Ghost UAV│  │  - SVG Gauge           │  │   - Fault Probabilities   │ │
│  │  - 5 View Modes       │  │  - Telemetry Sparklines│  │   - SHAP Attribution      │ │
│  │  - Live Trajectory    │  │  - Sensor Grid         │  │   - RUL Confidence Bands  │ │
│  └───────────────────────┘  └────────────────────────┘  └───────────────────────────┘ │
│  ┌───────────────────────┐  ┌────────────────────────┐  ┌───────────────────────────┐ │
│  │  Fault Injection Lab  │  │ Interactive What-If    │  │ Prescription Maintenance  │ │
│  │  - Mechanical / Temp  │  │  - Parameter Knobs     │  │   - Work Order Directives │ │
│  │  - Cyber Anomaly      │  │  - Outcome Projection  │  │   - Safety Advisories     │ │
│  └───────────────────────┘  └────────────────────────┘  └───────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quickstart Guide

### Option 1: One-Click Startup (Windows)
Double-click the root batch script or run in terminal:
```bat
start.bat
```
This automatically initializes Python virtual environment, installs packages, and boots both the FastAPI backend and Vite frontend.

---

### Option 2: Manual Step-by-Step

#### 1. Backend Setup (FastAPI)
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python run_backend.py
```
*Backend runs on: `http://localhost:8000` (API Docs: `http://localhost:8000/docs`)*

#### 2. Frontend Setup (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on: `http://localhost:5173`*

---

## 🧪 Running Automated Tests

AERO-TWIN includes comprehensive test suites across physics, ML models, and REST endpoints:
```bash
cd backend
python -m pytest tests/test_aero_twin.py -v
```

All 11 primary test modules run in under 6 seconds:
- `TestEngineSimulator::test_simulator_step` - Thermodynamics and state transition validation
- `TestEngineSimulator::test_fault_injection` - Physical fault severity induction
- `TestDigitalTwin::test_state_estimator` - State estimator & residual vector calculations
- `TestDigitalTwin::test_health_index` - Multi-factor health index equation
- `TestAIPipeline::test_anomaly_detector` - Feature generation & anomaly classification
- `TestAIPipeline::test_fault_classifier` - 7-class probability calibration
- `TestAIPipeline::test_rul_predictor` - Quantile RUL regressors
- `TestCyberSecurity::test_telemetry_integrity` - Zero-trust sensor validation & flagging
- `TestRestAPI::test_health_endpoint` - REST health check
- `TestRestAPI::test_missions_list` - Mission profile registry
- `TestRestAPI::test_state_endpoint` - Complete state snapshot serialization

---

## 🎮 Interactive Demonstration Scenarios

AERO-TWIN includes pre-programmed defense demonstration profiles selectable directly from the dashboard:

| Scenario | Description | Key Demonstration Signals |
| :--- | :--- | :--- |
| **Healthy ISR** | Baseline intelligence, surveillance & reconnaissance | Health: 100%, RUL > 100h, Zero residuals |
| **Injector Degradation** | Progressive fuel injection restriction | Residual EGT spikes, AFR lean drift, Top Fault: Injector |
| **Severe Degradation** | High altitude operation with thermal runaway | CHT > 230°C, Health drops < 30%, Automated RTB replanning |
| **EGT Sensor Freeze** | Sensor output pinned to constant value | Zero variance detected; Digital Twin self-heals by substituting physics estimate |
| **Cyber Anomaly** | Man-in-the-middle telemetry injection (+360°C spike) | Flagged as cyber/telemetry anomaly; integrity score decreases |
| **Hot Weather Desert** | High ambient temp (45°C) with oil cooling stress | Oil temp elevated, thermal margin reduced, cooling degradation |
| **Combined Failure** | Injector fault + hot weather + sensor drift | Complete emergency scenario triggering Ghost UAV diversion |

---

## 📡 REST API & WebSocket Specifications

### Endpoints
- `GET /health` — Service health and readiness probe.
- `GET /api/state` — Complete synchronous state snapshot of UAV and engine twin.
- `POST /api/simulation/start` — Start / resume simulation loop.
- `POST /api/simulation/pause` — Pause simulation loop.
- `POST /api/simulation/reset` — Reset simulation back to initial healthy waypoint.
- `POST /api/fault/inject` — Inject physical fault (`fault_type`: `injector`, `cooling`, `lubrication`, `mechanical`, `combustion`).
- `POST /api/telemetry/inject` — Inject cyber/sensor anomaly (`anomaly_type`: `freeze`, `spike`, `bias`, `drift`, `noise`).
- `POST /api/what-if` — Execute hypothetical flight parameter predictions.
- `POST /api/replanning/run` — Trigger autonomous mission replanning optimization.
- `GET /api/maintenance` — Prescriptive maintenance advisories and work orders.
- `GET /api/replay` — Mission event blackbox log.
- `WS /ws/telemetry` — Live bi-directional WebSocket telemetry stream.

---

## 🏆 Defense & Academic Credibility

- **Defensible Modeling**: Incorporates Rotax-class 4-stroke turbocharged aircraft engine thermodynamics (4 cylinders, dual ignition, liquid-cooled cylinder heads, air-cooled cylinders).
- **Physical Explainability**: Predictions are grounded by SHAP attributions correlating to physical thermodynamic anomalies (e.g. CHT rise, AFR lean drift, oil pressure decay) rather than black-box guesses.
- **Safety Critical Reliability**: Demonstrates resilience against cyber attacks and sensor dropouts without grounding or endangering the unmanned platform.

---

**SIH / DRDO Research Demonstrator**  
*AERO-TWIN: Real-Time Digital Twin for Aero-Piston Engines*
