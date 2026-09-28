# AEROVEX / AERO-TWIN — Complete System Architecture Specification (v3.4.1)

**System Title:** AI-Enabled Real-Time Cyber-Physical Digital Twin & Autonomous Prognostics Platform for MALE UAV Aero-Piston Engines & Mission Reliability  
**Classification:** Defense Research Demonstrator & Operational Decision-Support Prototype  
**Target Platform:** Medium-Altitude Long-Endurance (MALE) UAVs (Rotax 914 / 915 iS Turbo-Piston Class)  
**Authority Rule:** Conforms strictly to the **Numerical Authority Rule** (§4) and **Human-in-the-Loop Protocol** (§3).

---

## 1. High-Level Concept & The Nine-Stage Pipeline

AEROVEX is engineered around an unbroken 9-stage autonomous decision-support pipeline:

```
  1. SENSE     ──► 2. VERIFY    ──► 3. MODEL    ──► 4. DETECT   ──► 5. DIAGNOSE
 (CAN / STM32)     (Zero-Trust)      (Digital Twin)   (Residuals)     (Random Forest)
                                                                            │
  9. ADVISE    ◄── 8. REPLAN    ◄── 7. SIMULATE ◄── 6. PREDICT  ◄───────────┘
 (Multi-Agent)     (Pareto Rtes)    (What-If)       (Quantile RUL)
```

1. **SENSE:** Ingest physical transducer signals from ground-based STM32 engine test bench via CAN 2.0B (`0x100`–`0x105` at 50 Hz) or deterministic flight simulation into a unified 31-channel schema.
2. **VERIFY:** Validate data through the Zero-Trust Cyber Shield across 12 temporal, thermodynamic, and parity criteria.
3. **MODEL:** Execute reduced-order first-principles thermodynamic model calculating expected healthy engine performance $y_{\text{expected}}(t)$.
4. **DETECT:** Compute continuous 7-channel analytical residual vector $r(t) = y_{\text{actual}}(t) - y_{\text{expected}}(t)$ and evaluate rolling statistical envelopes via Isolation Forest.
5. **DIAGNOSE:** Classify mechanical degradation mode using 7-class calibrated Random Forest and rank physical root causes via TreeSHAP feature attributions.
6. **PREDICT:** Estimate component degradation rates and forecast monotonic Remaining Useful Life quantiles ($P10 \le P50 \le P90$).
7. **SIMULATE:** Forward-project engine wear and thermal dissipation margins under alternative throttle/altitude parameters (What-If engine).
8. **REPLAN:** Generate Pareto-optimal contingency alternatives (Option A: Max Safety/RTB, Option B: Cruise, Option C: Safe Descent) with 14:1 glide cone reachability.
9. **ADVISE:** Present explainable decision support to human flight commanders via multi-agent LLM copilot and project the 3D Holographic Ghost UAV.

---

## 2. End-to-End System Block Diagram

```
                     ┌────────────────────────────────┐
                     │    GROUND ENGINE TEST BENCH    │
                     │  - Rotax 914 Turbo-Piston Rig  │
                     │  - STM32F4/H7 Sensor Node      │
                     │  - 6N137 Optical Isolation     │
                     │  - SN65HVD230 CAN Transceiver  │
                     └───────────────┬────────────────┘
                                     │ Physical CAN (0x100 - 0x105 @ 500 kbps)
                                     ▼
                     ┌────────────────────────────────┐
                     │    CAN TELEMETRY BRIDGE        │
                     │  - python-can / Serial Loopback│
                     │  - UnifiedTelemetryRecord      │
                     └───────────────┬────────────────┘
                                     │
                     ┌───────────────┴────────────────┐
                     │ SIMULATED FLIGHT / SENSORS     │
                     │  - 6-DoF UAV Trajectory        │
                     │  - NavIC Sat Lock & EW Jamming │
                     │  - 4-UAV SwarmNet Tactical Mesh│
                     └───────────────┬────────────────┘
                                     │ Unified 31-Channel Record
                                     ▼
                     ┌────────────────────────────────┐
                     │   ZERO-TRUST CYBER SHIELD      │
                     │  - 12 Attack & Failure Vectors │
                     │  - Sensor Confidence Scoring   │
                     └───────────────┬────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │ Valid Channel                         │ Corrupted Channel
                 ▼                                       ▼
 ┌───────────────────────────────┐       ┌───────────────────────────────┐
 │ FIRST-PRINCIPLES DIGITAL TWIN │       │ SELF-HEALING TELEMETRY        │
 │ - ISA Atmospheric Model       │       │ - Analytical Substitution     │
 │ - Stoichiometric Combustion   │◄──────┤ - Tag source = 'reconstructed'│
 │ - 7-Channel Residual Vector   │       │ - Immutable Blackbox Audit    │
 │ - Master Health Index H(t)    │       └───────────────────────────────┘
 └───────────────┬───────────────┘
                 │ Residuals & Validated Telemetry
                 ▼
 ┌────────────────────────────────────────────────────────┐
 │ LOCAL AI PROGNOSTICS SUITE (< 50ms Edge Execution)     │
 │ - Unsupervised Isolation Forest (18 Rolling Features)  │
 │ - Calibrated 7-Class Random Forest Fault Classifier    │
 │ - Real-Time TreeSHAP Feature Attribution Weights       │
 │ - Multi-Quantile Regressor (P10 <= P50 <= P90 RUL)     │
 └───────────────┬────────────────────────────────────────┘
                 │ Anomaly, Probabilities & RUL
                 ▼
 ┌────────────────────────────────────────────────────────┐
 │ TACTICAL MISSION INTELLIGENCE & REPLANNING             │
 │ - Dual-Constellation NavIC / GPS Failover (< 200ms)    │
 │ - 14:1 Aerodynamic Glide Cone Airfield Database (8 IAF)│
 │ - Pareto Multi-Objective Optimizer (Options A, B, C)   │
 │ - 3D Ghost Waypoint Trajectory Generation              │
 └───────────────┬────────────────────────────────────────┘
                 │
         ┌───────┴───────────────────────┐
         │                               │
         ▼                               ▼
 ┌───────────────────────────────┐ ┌───────────────────────────────┐
 │ IMMUTABLE DIGITAL LOGBOOK     │ │ PRESCRIPTIVE MAINTENANCE      │
 │ - Append-Only SHA-256 Chain   │ │ - Automated ATA-Chapter Cards │
 │ - Tamper-Evident Verification │ │ - Tools, Parts, Man-Hours     │
 │ - CEMILAC / DGCA Compliance   │ │ - ATA 71, 72, 73, 74, 75, 79  │
 └───────────────┬───────────────┘ └───────────────┬───────────────┘
                 │                               │
                 └───────────────┬───────────────┘
                                 │ Full State Broadcast
                                 ▼
 ┌────────────────────────────────────────────────────────┐
 │ ASYNC SERVER & COMMUNICATIONS (FastAPI + WebSocket)    │
 │ - Broadcast Stream at /ws/telemetry (1-10 Hz)          │
 │ - REST Endpoints (/api/state, /api/fault, /api/replay) │
 │ - Groq Multi-Agent Copilot (Adheres to Numerical Rule) │
 └───────────────┬────────────────────────────────────────┘
                 │ JSON Telemetry & Tactical Payload
                 ▼
 ┌────────────────────────────────────────────────────────┐
 │ TACTICAL OPERATOR CONSOLE (React + Three.js + Leaflet) │
 │ - 3D Cockpit & Holographic Ghost UAV (5 Camera Modes)  │
 │ - Tactical Leaflet Map (NavIC Lock, 4 Indian Sectors)  │
 │ - AI Prognostics Studio (TreeSHAP Waterfall, RUL Bars) │
 │ - Prescriptive Maintenance & Airworthiness Audit Table │
 │ - Glassmorphism Interface (Dark/Light Mode Compatible) │
 └────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow & Provenance Architecture

Every telemetry record flowing through AERO-TWIN carries an explicit provenance tag in field #31 (`source`):

| Source Tag | Description | Physical Grounding |
| :--- | :--- | :--- |
| `physical` | Acquired directly from physical STM32 transducers via CAN bus (`0x100`–`0x105`). | Real physical engine test bench |
| `simulation` | Generated by the 6-DoF flight dynamics and physics model. | Simulated flight envelope |
| `fault_injection` | Intentionally injected software degradation or sensor anomaly for testing. | Controlled software disturbance |
| `reconstructed` | Analytical estimate substituted by the digital twin when a sensor is compromised. | Digital Twin physics reconstruction |

---

## 4. Subsystem Dependency Matrix

| Subsystem Module | Primary File(s) | Dependencies | Dependent Consumer |
| :--- | :--- | :--- | :--- |
| **CAN HAL** | `hardware/stm32/aerovex_can_protocol.h`, `can_interface.py` | STM32 bxCAN, python-can | `UnifiedTelemetryRecord` |
| **Telemetry Schema** | `backend/app/schemas/telemetry.py` | Pydantic V2 | Orchestrator, Zero-Trust |
| **Digital Twin** | `backend/app/digital_twin/engine_model.py`, `state_estimator.py` | ISA atmosphere, thermodynamic equations | Residual Engine, Healer |
| **Residual Engine** | `backend/app/digital_twin/residual_engine.py` | NumPy, rolling queues | Health Index, Anomaly, Fault |
| **Zero-Trust Shield** | `backend/app/cyber_security/zero_trust_shield.py` | 12 detection algorithms | Self-Healing Pipeline |
| **Self-Healing** | `backend/app/telemetry/self_healing.py` | Digital Twin expected states | Orchestrator, AI Suite |
| **AI Prognostics** | `backend/app/ai/anomaly.py`, `fault_classifier.py`, `rul.py` | scikit-learn, joblib | Risk Engine, UI Dashboard |
| **TreeSHAP** | `backend/app/ai/explainability.py` | TreeSHAP, Random Forest | Operator Dashboard |
| **Pareto Replanner** | `backend/app/replanning/pareto_optimizer.py` | Physics glide cone, multi-objective Pareto | Ghost UAV, Operator UI |
| **NavIC / GNSS** | `backend/app/gps/gps_navic.py`, `terrain.py` | Haversine, 8 IAF airfields | Tactical Map, Replanner |
| **SwarmNet** | `backend/app/swarm/swarm_manager.py` | 4-UAV mesh geometry | 3D Visualizer, UI Panel |
| **Maintenance** | `backend/app/maintenance/taskcard_generator.py` | ATA templates, fault diagnosis | Maintenance Console |
| **Digital Logbook** | `backend/app/storage/immutable_logbook.py` | hashlib SHA-256, JSON serialization | Airworthiness Audit Table |
| **Orchestrator** | `backend/app/orchestrator.py` | All backend subsystems | WebSocket, REST APIs |

---

## 5. Numerical Authority & Human-in-the-Loop Protocol

1. **The Numerical Authority Rule (§4):**
   - The Health Index, 7-channel residuals, anomaly scores, fault probabilities, TreeSHAP values, quantile RUL ($P10 \le P50 \le P90$), and Pareto objective scores are strictly calculated by deterministic mathematics.
   - Large Language Models (Groq) are strictly constrained to natural-language synthesis, explanation of structured outputs, and interactive query handling. Under no circumstance may an LLM alter or fabricate a numerical metric.
2. **Human-in-the-Loop Protocol (§3):**
   - AEROVEX is an operational decision-support tool. It does not possess direct control-surface authority over the aircraft.
   - Contingency recommendations (RTB, Divert, Safe Descent) are presented with Pareto objective trade-offs and holographic Ghost trajectories for **human authorization** prior to execution.

---

## 6. Execution & Verification Summary

* **Unit & Integration Test Suite:** 36 automated test cases verified with 100% pass rate (`python -m pytest tests/ -v`).
* **Frontend Compilation:** Production build verified with zero TypeScript compilation errors (`tsc -b && vite build` completed in 1.64s).
* **Communication Latency:** Telemetry streaming over WebSocket `/ws/telemetry` at 1–10 Hz with lagging-client frame drop recovery.
