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

AERO-TWIN includes comprehensive test suites across physics, ML models, CAN hardware HAL, NavIC, SwarmNet, and ATA maintenance:
```bash
cd backend
python -m pytest tests/ -v
```

**All 36 test modules pass with 100% success rate (6.85 seconds):**
- `TestEngineSimulator` (2 tests): Baseline thermodynamics and fault injection state transitions
- `TestDigitalTwin` (5 tests): Analytical state estimator, residual engine, rolling statistics, health thresholds
- `TestAIPipeline` (6 tests): Isolation Forest, 7-class classifier, RUL regression, TreeSHAP explainability, monotonicity ($P10 \le P50 \le P90$), and degradation tracking
- `TestCyberSecurity` (3 tests): Zero-trust 12-vector shield, EGT spike/freeze, and self-healing telemetry substitution
- `TestRestAPI` (8 tests): State, health, missions, readiness, unified schema, CAN HAL, offline fallback
- `TestMissionAndReplanning` (2 tests): Forward What-If contingency simulation, Pareto multi-objective replanning
- `TestSwarmAndGNSS` (4 tests): 4-UAV SwarmNet mesh, sub-200ms NavIC failover, inertial dead reckoning drift, 14:1 glide cone reachability
- `TestMilestone7MaintenanceAndLogbook` (3 tests): ATA 71–79 taskcards, SHA-256 chained immutable logbook verification, full orchestrator state
- `TestLiveSession` (3 tests): Multi-client WebSocket broadcast and shared simulation session controls

---

## 📚 Technical Documentation & Specification Library

AEROVEX provides an exhaustive suite of technical and regulatory specifications:

* **[ARCHITECTURE.md](file:///c:/Users/KARAN/sih/AERO-TWIN/ARCHITECTURE.md)** — Complete 9-stage pipeline, block diagrams, dependency matrix, and data flow.
* **[IMPLEMENTATION_PLAN.md](file:///c:/Users/KARAN/sih/AERO-TWIN/IMPLEMENTATION_PLAN.md)** — Master implementation plan across all 7 milestones and 35 phases (100% verified).
* **[IMPLEMENTATION_GAP_ANALYSIS.md](file:///c:/Users/KARAN/sih/AERO-TWIN/IMPLEMENTATION_GAP_ANALYSIS.md)** — Exhaustive baseline audit and gap analysis.
* **[AEROVEX_PRODUCT_DOCUMENTATION_A_TO_Z.txt](file:///c:/Users/KARAN/sih/AERO-TWIN/AEROVEX_PRODUCT_DOCUMENTATION_A_TO_Z.txt)** — Exhaustive A-to-Z operational specification (v4.0.0, 811 lines).
* **[DATASET.md](file:///c:/Users/KARAN/sih/AERO-TWIN/DATASET.md)** — Dataset schemas, provenance separation (AERO-TWIN primary vs. C-MAPSS benchmark), and train/val/test splitting.
* **[ML_MODEL_CARD.md](file:///c:/Users/KARAN/sih/AERO-TWIN/ML_MODEL_CARD.md)** — Model cards for Isolation Forest, 7-class classifier, TreeSHAP, and Quantile RUL regressors.
* **[HARDWARE_SETUP.md](file:///c:/Users/KARAN/sih/AERO-TWIN/HARDWARE_SETUP.md)** — Physical ground test bench BOM, STM32 pinouts, and 6N137 optical isolation wiring schematics.
* **[API_REFERENCE.md](file:///c:/Users/KARAN/sih/AERO-TWIN/API_REFERENCE.md)** — Full REST API endpoints and WebSocket telemetry broadcast specification.
* **[DEMO_PLAYBOOK.md](file:///c:/Users/KARAN/sih/AERO-TWIN/DEMO_PLAYBOOK.md)** — 27-step live demonstration script for defense evaluators and technical juries.
* **[SAFETY_BOUNDARIES.md](file:///c:/Users/KARAN/sih/AERO-TWIN/SAFETY_BOUNDARIES.md)** — Operational safety, human-in-the-loop boundaries, and the Numerical Authority Rule.
* **[physics_config.json](file:///c:/Users/KARAN/sih/AERO-TWIN/physics_config.json)** — Channel limits, normalization factors, health weights, and thermodynamic coefficients.
* **[model_metadata.json](file:///c:/Users/KARAN/sih/AERO-TWIN/backend/models_saved/model_metadata.json)** — Model versions, feature schemas, training datasets, and validation metrics.

---

## 🎮 Interactive Demonstration Scenarios

AERO-TWIN includes pre-programmed defense demonstration profiles selectable directly from the dashboard:

| Scenario | Description | Key Demonstration Signals |
| :--- | :--- | :--- |
| **Healthy ISR** | Baseline intelligence, surveillance & reconnaissance | Health: 100%, RUL > 100h, Zero residuals |
| **Injector Degradation** | Progressive fuel injection restriction | Residual EGT spikes, AFR lean drift, Top Fault: Injector, ATA 73 work order |
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

- **The Numerical Authority Rule (§4)**: Health Index, analytical residuals, anomaly scores, fault probabilities, TreeSHAP values, quantile RUL ($P10 \le P50 \le P90$), and Pareto objective trade-offs are generated exclusively by deterministic physics equations, certified machine learning models, or numerical optimizers. Large Language Models never fabricate numerical metrics.
- **Physical Explainability**: Predictions are grounded by SHAP attributions correlating to physical thermodynamic anomalies (e.g. CHT rise, AFR lean drift, oil pressure decay) rather than black-box guesses.
- **Safety Critical Reliability**: Demonstrates resilience against cyber attacks and sensor dropouts without grounding or endangering the unmanned platform.
- **Airworthiness Audit Readiness**: Chained SHA-256 digital logbook ledger compliant with CEMILAC and DGCA military airworthiness standards.

---

**SIH / DRDO Research Demonstrator**  
*AERO-TWIN: Real-Time Digital Twin for Aero-Piston Engines*

