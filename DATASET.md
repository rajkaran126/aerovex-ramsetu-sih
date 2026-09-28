# AEROVEX / AERO-TWIN — Dataset Provenance & Benchmark Specification

## 1. Overview & Dataset Provenance (§21 & §22)

AEROVEX maintains strict provenance separation between the primary aero-piston digital twin dataset and external benchmark reference corpora:

| Dataset Name | Domain / Engine Class | Role in AERO-TWIN | Provenance & Boundaries |
| :--- | :--- | :--- | :--- |
| **AERO-TWIN Aero-Piston Dataset** | Rotax 914 / 915 iS Turbocharged Piston | **PRIMARY DATASET** | Dynamometer-correlated synthetic operational dataset modeling transient flights (0–25,000 ft MSL). |
| **NASA C-MAPSS (FD001–FD004)** | Commercial Turbofan Gas Turbines | **BENCHMARK ONLY** | Used strictly for external RUL regression benchmarking. **NOT** presented as aero-piston data. |
| **NASA N-CMAPSS** | Advanced High-Bypass Turbofans | **BENCHMARK ONLY** | Validates sequence modeling under multi-component flight transients. |
| **ML Olympiad Turbofan** | Industrial Turbofan Turbines | **BENCHMARK ONLY** | Cross-validates quantile regression monotonicity and hyperparameter calibration. |

---

## 2. AERO-TWIN Primary Dataset Schema

The primary AERO-TWIN dataset encompasses complete multi-regime flight sorties:
* **Identification:** `engine_id`, `mission_id`, `timestamp`, `mission_phase` (TAKEOFF, CLIMB, CRUISE, PATROL, LOITER, DESCENT, RTB).
* **Atmospheric State:** `altitude`, `ambient_temperature`, `ambient_pressure`.
* **Actuation & Load:** `throttle`, `engine_load`, `rpm_target`.
* **Thermodynamics & Dynamics:** `rpm`, `map`, `cht`, `egt`, `oil_pressure`, `oil_temperature`, `fuel_flow`, `vibration`.
* **Performance Metrics:** `torque`, `power`, `efficiency`, `thermal_margin`.
* **Degradation State:** `health_score`, `degradation_level`, `injector_degradation`, `cooling_degradation`, `lubrication_degradation`, `mechanical_degradation`, `combustion_degradation`.
* **Fault Annotations:** `fault_type`, `fault_severity`, `sensor_health`, `telemetry_integrity`.
* **Truth Targets:** `physics_residuals`, `rul`, `mission_remaining`, `mission_risk`.

---

## 3. Train / Validation / Test Splitting (§23)

To prevent optimistic data leakage in time-series prognostics, rows from the same engine unit are **never** randomly shuffled into both train and test splits:

* **Engine-Level Separation:**
  - 70% of engine units $\rightarrow$ Training set.
  - 15% of engine units $\rightarrow$ Validation set.
  - 15% of engine units $\rightarrow$ Unseen held-out test set.
* **Temporal Validation:**
  - For sequential degradation models, training is performed on early flight cycles; validation and testing evaluate forward prediction on subsequent unseen flight hours.
