# AEROVEX / AERO-TWIN — REST API & WebSocket Reference

## 1. Base URL & Protocol
* **REST API:** `http://localhost:8000` (Swagger UI at `http://localhost:8000/docs`)
* **WebSocket Stream:** `ws://localhost:8000/ws/telemetry` (Broadcast rate: 1–10 Hz)

---

## 2. Core REST Endpoints

### `GET /health`
* **Description:** Health probe checking database, digital twin, and background simulation loop.
* **Response:** `{"status": "ok", "timestamp": 1727500000.0, "subsystems": {...}}`

### `GET /api/state`
* **Description:** Returns the complete system state snapshot:
  - `step`: Simulation integer step index
  - `simulation_time_s`: Elapsed sortie seconds
  - `mission`: Profile, throttle, altitude, environment, elapsed/remaining hours
  - `telemetry`: Actual, twin expected, continuous residual vectors, channel sources
  - `health`: Overall health index [0, 100], status label, and breakdown weights
  - `anomaly`: Isolation Forest score, binary trigger, confidence
  - `faults`: 7-class probability distribution, top fault, TreeSHAP attribution list
  - `rul`: P10, P50, P90 hours and confidence bounds
  - `cyber_shield`: 12-vector detection report, affected sensors, integrity score
  - `uav`: Latitude, longitude, altitude, heading, airspeed, waypoints
  - `swarm`: 4-UAV mesh status, positions, RSSI, PDR %, formation
  - `gnss`: Active constellation (`GPS` / `NAVIC` / `DEAD_RECKONING`), latency
  - `emergency_diversion_airfields`: Top 5 reachable IAF airfields with 14:1 glide margins
  - `maintenance_taskcards`: Active ATA-chapter work orders
  - `digital_logbook`: Chained SHA-256 block summary and verification status

### `POST /api/simulation/start`
* **Description:** Starts or unpauses the background simulation loop.

### `POST /api/simulation/pause`
* **Description:** Pauses the simulation clock.

### `POST /api/simulation/reset`
* **Description:** Re-initializes all engines, digital twins, and ML buffers to baseline.

### `POST /api/simulation/control`
* **Body:** `{"throttle": 0.70, "rpm": 5200, "altitude": 14000, "speed_multiplier": 1.0}`

### `POST /api/scenario/load`
* **Body:** `{"scenario": "HEALTHY_ISR" | "INJECTOR_DEGRADATION" | "HOT_WEATHER" | "CYBER_ANOMALY" | "SEVERE_DEGRADATION"}`

### `POST /api/fault/inject`
* **Body:** `{"fault_type": "injector" | "cooling" | "mechanical" | "sensor", "severity": 0.0 to 1.0}`

### `POST /api/telemetry/inject`
* **Body:** `{"sensor": "egt_c", "anomaly_type": "freeze" | "spike" | "drift", "magnitude": 250}`

### `POST /api/what-if`
* **Body:** `{"throttle": 0.60, "altitude_ft": 9000, "ambient_temp_c": 15, "mission_remaining_hours": 3.0}`
* **Response:** Returns forward-simulated `predicted_health`, `predicted_thermal_margin`, `predicted_rul_hours`, and `mission_risk`.

---

## 3. High-Throughput WebSocket Stream (`/ws/telemetry`)

* Streams full JSON system state at 1–10 Hz.
* Automatically implements lagging client queue overflow recovery (`q.get_nowait()`) so slow clients never stall the central simulation loop.
