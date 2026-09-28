# AEROVEX / AERO-TWIN: Comprehensive Implementation Gap Analysis

**Document Status:** Complete Baseline Audit  
**Date:** September 2026  
**Project:** AEROVEX / AERO-TWIN — Cyber-Physical Digital Twin & Autonomous Prognostics Platform for MALE UAV Aero-Piston Engines  
**Target Architecture:** Rotax 914 / 915 iS class piston engines powering Medium-Altitude Long-Endurance (MALE) Unmanned Aerial Vehicles  

---

## 1. Executive Summary

This gap analysis maps the existing **AERO-TWIN** repository against the **Master Implementation Specification**. The existing codebase contains a functional, high-quality foundation—including first-principles thermodynamics, an Isolation Forest anomaly detector, a 7-class Random Forest fault classifier, TreeSHAP explainability, multi-quantile RUL estimation, dynamic replanning, a 3D Three.js cockpit, and a real-time Leaflet GPS tactical map with NavIC support.

However, to transition from a pure software demonstration into a true **Cyber-Physical Digital Twin** ready for a ground-based physical engine test bench, several architectural gaps must be bridged:
1. **Physical Hardware Abstraction Layer (HAL):** Missing STM32 sensor acquisition pipeline and CAN bus transceiver interfaces (SocketCAN / serial DBC parser).
2. **Unified Telemetry Schema:** Missing a single canonical Pydantic model tracking all 31 mandatory engine, flight, and meta-data channels (including explicit `source`: `physical`, `simulation`, `fault_injection`, `reconstructed`).
3. **Explicit Self-Healing Provenance:** Although the cyber monitor calculates synthetic replacements, channel-level attribution (`source = SENSOR` vs `source = DIGITAL_TWIN_ESTIMATE`) is not explicitly streamed downstream.
4. **Backend Modularization:** `main.py` currently contains monolithically defined REST endpoints; endpoints need modular decomposition into `app/api/`, `app/telemetry/`, and dedicated controllers.
5. **Missing Standard Endpoints:** Dedicated endpoints `/api/digital-twin`, `/api/prognostics`, `/api/cyber`, `/api/rul`, `/api/mission` must be formally exposed.
6. **Airworthiness ATA Maintenance:** Maintenance advisories need rigorous mapping to aerospace standard ATA Chapters (72, 73, 75, 79, 31) with formal inspection directives.

---

## 2. Comprehensive Component Matrix

| Module / Requirement | Master Spec Section | Current Repo Status | Classification | Key Findings & Required Action |
| :--- | :--- | :--- | :--- | :--- |
| **Engine Physics Model** | §1, §9 | Implemented in `digital_twin/engine_model.py` & `simulator/engine_simulator.py` | **EXISTING** | High-fidelity Rotax 914 thermodynamics, ISA lapse rate, MAP boost, EGT/CHT heat transfer. Preserve as-is. |
| **Residual State Estimator** | §10 | Implemented in `digital_twin/state_estimator.py` | **EXISTING** | Computes 7-channel residual vector `r(t) = actual - expected`. Works reliably. |
| **Health Index Formulation** | §11 | Implemented in `digital_twin/health_index.py` | **EXISTING** | Configurable equation $H(t) \in [0, 100]$ weighted across residuals, vibration, and thermal margins. |
| **Unified Telemetry Schema** | §4 | Ad-hoc dicts in `simulator` and `orchestrator` | **MISSING / REFACTOR** | Need formal Pydantic model with 31 mandatory fields, confidence tags, data quality, and `source` enum. |
| **STM32 Sensor Node HAL** | §5 | None in repository | **MISSING (PHYSICAL)** | Create `hardware/stm32/` HAL specification, pulse counter, ADC scaling, thermocouple conditioning, and CAN packet formatter. |
| **CAN Bus Transceiver Interface** | §3, §5 | None in repository | **MISSING (PHYSICAL)** | Create `app/telemetry/can_interface.py` with standard CAN IDs (`0x100`–`0x105`), DBC parser, SocketCAN & serial fallback. |
| **Zero-Trust Cyber Shield** | §7 | Partially in `ai/cyber.py` | **PARTIAL** | Detects freezes, spikes, and drifts. Needs cross-sensor consistency checks and explicit spoofing injection tests. |
| **Self-Healing Telemetry** | §8 | Implemented in `cyber.py` (`get_corrected_telemetry`) | **PARTIAL / REFACTOR** | Substitutes twin estimates but does not explicitly tag channel-level provenance (`reconstructed`) in state payload. |
| **AI Anomaly Detection** | §12 | Implemented in `ai/anomaly.py` | **EXISTING** | Isolation Forest running on rolling residual features. Runs 100% locally. |
| **7-Class Fault Classification** | §13 | Implemented in `ai/fault_classifier.py` | **EXISTING** | Calibrated Random Forest model predicting all 7 failure modes. |
| **Explainable AI (TreeSHAP)** | §15 | Implemented in `ai/explainability.py` | **EXISTING** | Computes exact TreeSHAP feature attributions on real model inference. Never fabricated. |
| **Multi-Quantile RUL** | §16 | Implemented in `ai/rul.py` | **EXISTING** | Quantile regressors outputting P10, P50, and P90 confidence bounds. |
| **Degradation Tracking** | §14 | Distributed across `simulator` & `orchestrator` | **PARTIAL** | Tracks wear levels, but needs dedicated `degradation/` module calculating formal degradation rates and trends. |
| **Mission Risk Evaluator** | §17 | Implemented in `mission/risk_model.py` | **EXISTING** | Computes $P(\text{Success})$ against P10 RUL, thermal margin, and terrain constraints. |
| **What-If Simulation Engine** | §18 | Implemented in `mission/what_if.py` | **EXISTING** | Fast forward-simulation of candidate parameter sweeps. |
| **Pareto Mission Replanner** | §19 | Implemented in `mission/mission_replanner.py` | **EXISTING** | Evaluates 4 contingency strategies (Continue, Safe Descent, Divert, RTB) with multi-objective scores. |
| **Real-Time GPS Tactical Map** | §20 | Implemented in `frontend/.../GPSTrackingMap.tsx` | **EXISTING** | Leaflet map with NavIC lock, 4 Indian defense sectors, dead-reckoning patrol loop, satellite/dark vector tiles. |
| **3D UAV & Ghost Hologram** | §21 | Implemented in `frontend/.../UAVScene.tsx` | **EXISTING** | 5 camera modes, high-fidelity airframe, spinning prop, and holographic Ghost UAV replanning ribbon. |
| **SwarmNet Simulation** | §22 | Implemented in `frontend/.../SwarmNetPanel.tsx` | **EXISTING (SIMULATION)** | 4-node swarm (Lead, Wingmen, Relay), RSSI/PDR degradation, RF jamming event simulation. |
| **Multi-Agent LLM Copilot** | §23, §24 | Implemented in `ai/groq_orchestrator.py` & `MissionReplanningChat.tsx` | **EXISTING** | Groq-accelerated multi-agent reasoning (Chief, Engine, Cyber, Mission, Maintenance). Strictly obeys numerical authority. |
| **Prescriptive Maintenance** | §25 | Partial in `main.py` & `Maintenance.tsx` | **PARTIAL / REFACTOR** | Needs formal ATA Chapter (72, 73, 75, 79, 31) work order generation with torque/tool specs and airworthiness sign-off. |
| **Digital Blackbox Replay** | §26 | Implemented in `orchestrator.py` & `main.py` | **PARTIAL** | Records chronological mission events; needs dedicated timeline scrubber and event inspection in UI. |
| **Offline Edge Resilience** | §27 | Inherent architecture | **PARTIAL** | Local ML runs offline. Needs explicit `OFFLINE` $\rightarrow$ `SYNCING` $\rightarrow$ `CONNECTED` state machine in frontend status bar. |
| **Modular REST Endpoints** | §28, §29 | Monolithic in `main.py` | **REFACTOR** | Decompose `main.py` into FastAPI APIRouter structure under `backend/app/api/`. |
| **Dataset Ingestion Adapters** | §33 | Implemented in `datasets/` | **EXISTING** | Modular adapters for C-MAPSS, N-CMAPSS, and ML Olympiad with clear turbofan vs piston disclaimers. |

---

## 3. Detailed Architectural Categorization

### A. Existing Working Functionality (Preserve Without Unnecessary Rewrites)
* **First-Principles Thermodynamics:** `backend/app/digital_twin/engine_model.py` models real 4-stroke Rotax 914 behavior (intake manifold dynamics, turbo boost, combustion, cooling dissipation).
* **Residual Calculation:** `backend/app/digital_twin/state_estimator.py` continuously compares physical/simulated outputs with healthy analytical estimates.
* **AI Prognostics Models:**
  - `backend/app/ai/anomaly.py`: Isolation Forest.
  - `backend/app/ai/fault_classifier.py`: Calibrated 7-class Random Forest.
  - `backend/app/ai/explainability.py`: TreeSHAP attribution ranking.
  - `backend/app/ai/rul.py`: Multi-quantile P10/P50/P90 regressors.
* **Mission Decision Engines:**
  - `backend/app/mission/risk_model.py`: Multi-factor mission success probability.
  - `backend/app/mission/what_if.py`: Parameter modification re-evaluator.
  - `backend/app/mission/mission_replanner.py`: 4-candidate Pareto contingency planner.
* **Frontend Centerpieces:**
  - `frontend/src/components/3d/UAVScene.tsx`: 3D UAV with Ghost trajectory projection.
  - `frontend/src/components/aerospace/GPSTrackingMap.tsx`: NavIC Indian defense sector GPS tracker with CARTO key integration and Esri satellite imagery.
  - `frontend/src/components/aerospace/CyberTelemetryDetector.tsx`: Visual cyber-telemetry anomaly shield.
  - `frontend/src/components/aerospace/MissionReplanningChat.tsx`: Copilot chat explaining Pareto replans.

### B. Partially Implemented Modules (Requires Surgical Enhancement)
* **Cyber-Telemetry Shield (`ai/cyber.py`):**
  - *Current state:* Detects freeze, spike, and simple ROC violations.
  - *Gap:* Lacks formal cross-sensor physical inconsistency detection (e.g., high RPM + low MAP contradiction) and does not output per-sensor confidence arrays into the unified schema.
* **Self-Healing Telemetry (`ai/cyber.py` & `orchestrator.py`):**
  - *Current state:* Replaces bad values in a local dictionary.
  - *Gap:* The streamed state does not explicitly label which channels are `physical`, `simulated`, or `reconstructed`.
* **Prescriptive Maintenance (`main.py` & `Maintenance.tsx`):**
  - *Current state:* Returns simple alert cards.
  - *Gap:* Lacks structured ATA Chapter mapping (ATA 72, 73, 75, 79, 31) with parts lists, inspection intervals, and work order exports.
* **Digital Blackbox:**
  - *Current state:* Stores event tuples in a memory deque.
  - *Gap:* Lacks persistent SQLite/file storage, time-scrubbing playback API, and structured export.

### C. Missing Functionality (Must Be Implemented)
1. **Unified Telemetry Schema (`app/schemas/telemetry.py`):**
   - Canonical Pydantic schema enforcing all 31 fields specified in Section 4.
2. **STM32 Hardware Abstraction Layer & CAN Interface (`app/telemetry/can_interface.py` & `hardware/stm32/`):**
   - Software interface to receive real CAN frames from an STM32 sensor acquisition node on a physical test bench (with virtual CAN / serial loopback for bench simulation).
   - Documented CAN Arbitration IDs:
     - `0x100`: Engine Core (RPM, Throttle, MAP)
     - `0x101`: Thermal State (CHT1-4, EGT1-4)
     - `0x102`: Fluid Dynamics (Oil Pressure, Oil Temp, Fuel Flow)
     - `0x103`: Structural Dynamics (Accelerometer Vibration RMS)
     - `0x104`: Environmental (Ambient Pressure, Ambient Temp, Baro Altitude)
     - `0x105`: Node Health (Battery voltage, packet counter, checksum)
3. **Dedicated Modular REST Routers (`app/api/`):**
   - Clean route controllers for `/api/digital-twin`, `/api/prognostics`, `/api/cyber`, `/api/rul`, `/api/mission`, `/api/maintenance`, `/api/replay`.
4. **Offline Edge State Indicator:**
   - Formal client-side detection and state transition indicator (`OFFLINE` $\rightarrow$ `SYNCING` $\rightarrow$ `CONNECTED`).

### D. Redundant / Cluttered Elements (To Refactor or Clean)
* Large inline route definitions in `backend/app/main.py` should delegate to APIRouters.
* Unused `.zip` terrain archives in repository root should be cleaned or moved to asset cache to reduce git footprint.

---

## 4. Boundary Definition: Physical vs. Software Simulation

### Physical Hardware Scope (Ground-Based Test Bench Demonstrator)
* Physical single-cylinder or small 4-stroke engine test bench (or hardware sensor test jig).
* Physical sensors: Hall-effect RPM, manifold pressure, K-type thermocouples (EGT/CHT), piezo-electric vibration sensor, oil pressure transducer.
* Microcontroller: STM32F4 / STM32H7 sensor acquisition node running FreeRTOS/Bare-Metal ADC and pulse counting.
* CAN Transceiver: MCP2515 or SN65HVD230 interfacing to an Edge Computer (NVIDIA Jetson / Raspberry Pi / x86 PC).
* Physical Emergency Cutoff & protective enclosure.

### Software / Simulation Scope
* MALE UAV flight aerodynamics and 3D attitude.
* NavIC satellite constellation representation.
* Long-endurance flight waypoints across Indian operational sectors (Thar, Himalayas, Indian Ocean, North-East).
* Dynamic Pareto trajectory replanning and Ghost UAV holographic projection.
* Multi-UAV SwarmNet mesh networking and RF electronic warfare jamming.
* High-level Groq multi-agent tactical reasoning copilot.

---

## 5. Conclusion of Gap Analysis

The existing codebase is structurally sound, stable, and highly sophisticated in its AI and simulation layers. The primary work required is:
1. Formalizing the **Unified Telemetry Schema**.
2. Introducing the **STM32/CAN Physical Ingestion Interface**.
3. Elevating **Self-Healing Telemetry** to explicitly expose channel-by-channel reconstruction tags.
4. Refactoring the backend into the requested modular layout.
5. Hardening the **System Readiness** and **Prescriptive Maintenance** modules.

Proceed to review `IMPLEMENTATION_PLAN.md` for the step-by-step phased execution roadmap.
