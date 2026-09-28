"""
AERO-TWIN — Main Simulation Orchestrator

Ties together all subsystems:
- Engine simulator
- Digital Twin state estimator
- Health index calculator
- AI anomaly detection
- Fault classification
- RUL prediction
- SHAP explainability
- Cyber/telemetry integrity
- Mission risk engine
- Mission replanner

Produces a complete system state snapshot every timestep.
"""

import asyncio
import time
import numpy as np
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from collections import deque

from .simulator.engine_simulator import EngineSimulator, MISSION_PROFILES, ENVIRONMENTS
from .digital_twin.state_estimator import StateEstimator
from .digital_twin.health_index import compute_health_index, health_breakdown, HealthConfig
from .digital_twin.engine_model import EngineInputs, DegradationState
from .ai.anomaly import AnomalyDetector
from .ai.fault_classifier import FaultClassifier
from .ai.rul import RULPredictor
from .ai.explainability import ExplainabilityEngine
from .ai.cyber import TelemetryIntegrityMonitor
from .cyber_security.zero_trust_shield import ZeroTrustCyberShield
from .telemetry.self_healing import SelfHealingPipeline
from .degradation.tracker import DegradationTracker
from .schemas.telemetry import TelemetrySource
from .mission.risk_model import MissionRiskEngine
from .mission.mission_replanner import MissionReplanner
from .replanning.pareto_optimizer import ParetoReplanner
from .mission.what_if import WhatIfSimulator, WhatIfRequest
from .swarm.swarm_manager import SwarmManager
from .gps.gps_navic import GPSNavICReceiver
from .gps.terrain import TerrainDiversionManager
from .maintenance.taskcard_generator import MaintenanceTaskcardGenerator
from .storage.immutable_logbook import ImmutableDigitalLogbook

logger = logging.getLogger(__name__)

# Demo scenarios
DEMO_SCENARIOS = {
    "HEALTHY_ISR": {
        "profile": "ISR",
        "environment": "STANDARD",
        "fault": "none",
        "fault_severity": 0.0,
        "sensor_injection": None,
        "description": "Healthy ISR mission — baseline healthy operation",
    },
    "INJECTOR_DEGRADATION": {
        "profile": "ISR",
        "environment": "STANDARD",
        "fault": "injector",
        "fault_severity": 0.7,
        "sensor_injection": None,
        "description": "Progressive injector degradation",
    },
    "SEVERE_DEGRADATION": {
        "profile": "HIGH_ALTITUDE",
        "environment": "STANDARD",
        "fault": "mechanical",
        "fault_severity": 1.0,
        "sensor_injection": None,
        "description": "Severe engine degradation — RTB recommended",
    },
    "EGT_SENSOR_FAILURE": {
        "profile": "ISR",
        "environment": "STANDARD",
        "fault": "none",
        "fault_severity": 0.0,
        "sensor_injection": {"sensor": "egt_c", "type": "freeze", "magnitude": 0},
        "description": "EGT sensor freeze — twin estimation activated",
    },
    "CYBER_ANOMALY": {
        "profile": "ISR",
        "environment": "STANDARD",
        "fault": "none",
        "fault_severity": 0.0,
        "sensor_injection": {"sensor": "egt_c", "type": "spike", "magnitude": 360},
        "description": "EGT telemetry spike — cyber anomaly detection",
    },
    "HOT_WEATHER": {
        "profile": "HOT_WEATHER",
        "environment": "DESERT",
        "fault": "cooling",
        "fault_severity": 0.4,
        "sensor_injection": None,
        "description": "Desert hot weather with cooling degradation",
    },
    "HIGH_ALTITUDE": {
        "profile": "HIGH_ALTITUDE",
        "environment": "HIGH_ALTITUDE",
        "fault": "none",
        "fault_severity": 0.0,
        "sensor_injection": None,
        "description": "High altitude performance envelope",
    },
    "COMBINED_FAILURE": {
        "profile": "HOT_WEATHER",
        "environment": "DESERT",
        "fault": "injector",
        "fault_severity": 0.85,
        "sensor_injection": {"sensor": "egt_c", "type": "drift", "magnitude": 200},
        "description": "Combined failure: hot weather + injector fault + EGT drift",
    },
}


def _sanitize_for_json(val: Any) -> Any:
    """Convert numpy scalars and arrays to native Python types for JSON serialization."""
    if isinstance(val, dict):
        return {str(k): _sanitize_for_json(v) for k, v in val.items()}
    elif isinstance(val, (list, tuple)):
        return [_sanitize_for_json(x) for x in val]
    elif isinstance(val, (np.bool_, bool)):
        return bool(val)
    elif isinstance(val, (np.integer, int)):
        return int(val)
    elif isinstance(val, (np.floating, float)):
        if np.isnan(val) or np.isinf(val):
            return 0.0
        return float(val)
    elif isinstance(val, np.ndarray):
        return _sanitize_for_json(val.tolist())
    return val


class AeroTwinOrchestrator:
    """
    Central orchestrator for the AERO-TWIN system.

    Manages the complete pipeline from engine simulation to
    mission recommendation.
    """

    def __init__(self):
        logger.info("Initializing AERO-TWIN Orchestrator...")

        # Core simulation
        self.simulator = EngineSimulator()
        self.state_estimator = StateEstimator()
        self.health_config = HealthConfig()

        # AI subsystems (initialized lazily to avoid startup delay)
        self._anomaly_detector: Optional[AnomalyDetector] = None
        self._fault_classifier: Optional[FaultClassifier] = None
        self._rul_predictor: Optional[RULPredictor] = None
        self._explainability: Optional[ExplainabilityEngine] = None
        self._cyber_monitor = TelemetryIntegrityMonitor()
        self._zero_trust_shield = ZeroTrustCyberShield()
        self._self_healing = SelfHealingPipeline()
        self._degradation_tracker = DegradationTracker()
        self._risk_engine = MissionRiskEngine()
        self._replanner = MissionReplanner()
        self._pareto_replanner = ParetoReplanner()
        self._what_if_sim = WhatIfSimulator()
        self._swarm_manager = SwarmManager()
        self._gps_navic = GPSNavICReceiver()
        self._terrain_manager = TerrainDiversionManager()
        self._taskcard_gen = MaintenanceTaskcardGenerator()
        self._digital_logbook = ImmutableDigitalLogbook(engine_id="ROTAX-914-DEMO")

        # State history
        self._health_history: deque = deque(maxlen=500)
        self._full_system_state: Dict = {}
        self._replanning_result: Optional[Dict] = None
        self._pareto_result: Optional[Dict] = None
        self._replay_events: List[Dict] = []
        self._step = 0

        # Subscribers for WebSocket broadcast
        self._subscribers: List[asyncio.Queue] = []

        logger.info("Orchestrator initialized. AI models will load on first step.")

    def _ensure_ai_models(self) -> None:
        """Lazy-load AI models on first use"""
        if self._anomaly_detector is None:
            logger.info("Loading anomaly detector...")
            self._anomaly_detector = AnomalyDetector()
        if self._fault_classifier is None:
            logger.info("Loading fault classifier...")
            self._fault_classifier = FaultClassifier()
            self._explainability = ExplainabilityEngine(self._fault_classifier)
        if self._rul_predictor is None:
            logger.info("Loading RUL predictor...")
            self._rul_predictor = RULPredictor()

    def subscribe(self) -> asyncio.Queue:
        """Subscribe to state updates via asyncio Queue"""
        q: asyncio.Queue = asyncio.Queue(maxsize=10)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        if q in self._subscribers:
            self._subscribers.remove(q)

    async def _broadcast(self, state: Dict) -> None:
        """Send state to all WebSocket subscribers"""
        dead = []
        for q in self._subscribers:
            try:
                q.put_nowait(state)
            except asyncio.QueueFull:
                q.get_nowait()  # discard oldest so slow clients converge to current state
                q.put_nowait(state)
            except Exception:
                dead.append(q)
        for q in dead:
            self.unsubscribe(q)

    async def run_loop(self, interval_s: float = 1.0) -> None:
        """Main simulation loop — runs as async background task"""
        logger.info("Simulation loop started")
        self._ensure_ai_models()

        while True:
            start = time.monotonic()
            try:
                state = self._step_simulation()
                if state:
                    self._full_system_state = state
                await self._broadcast(self.get_full_state())
            except Exception as e:
                logger.error(f"Simulation step error: {e}", exc_info=True)

            elapsed = time.monotonic() - start
            sleep_time = max(0, interval_s - elapsed)
            await asyncio.sleep(sleep_time)

    def _step_simulation(self) -> Optional[Dict]:
        """Execute one simulation timestep and return full system state"""
        raw = self.simulator.step()
        if raw is None:
            return None

        self._step = raw["step"]
        actual = raw["outputs"]
        inputs = EngineInputs(
            throttle=raw["throttle"],
            rpm_target=raw["rpm_target"],
            altitude_ft=raw["altitude_ft"],
            ambient_temp_c=raw["ambient_temp_c"],
            engine_load=raw["engine_load"],
            degradation=DegradationState(**raw["degradation"]),
        )

        # ── Digital Twin ─────────────────────────────────────────────────────
        twin = self.state_estimator.update(
            actual_outputs=self._dict_to_engine_outputs(actual),
            inputs=inputs,
            health=self._health_history[-1] if self._health_history else 100.0,
        )
        rolling = self.state_estimator.get_rolling_features(20)

        # ── Cyber/Telemetry Integrity & Zero-Trust Shield ────────────────
        integrity = self._cyber_monitor.analyze(
            actual=actual,
            expected=twin.expected,
            residual=twin.residual,
        )
        integrity_dict = integrity.to_dict()

        shield_report = self._zero_trust_shield.evaluate_telemetry(
            actual=actual,
            expected=twin.expected,
            residual=twin.residual,
            timestamp=raw.get("simulation_time_s"),
        )
        healed_actual, channel_sources, healing_events = self._self_healing.heal_telemetry(
            actual_telemetry=actual,
            expected_telemetry=twin.expected,
            cyber_report=shield_report,
            step=self._step,
        )
        corrected_actual = healed_actual

        # ── AI Anomaly Detection ─────────────────────────────────────────
        anomaly = {"anomaly_score": 0.0, "is_anomaly": False, "confidence": 0.5, "anomaly_class": "NORMAL"}
        fault_probs = {c: 1.0/7 for c in ["healthy", "injector", "cooling", "lubrication", "combustion", "mechanical", "sensor"]}
        shap_result = {}
        rul_result = {"rul_median": 99.0, "rul_lower": 80.0, "rul_upper": 120.0, "rul_confidence": 0.5, "method": "init"}

        if self._anomaly_detector:
            anomaly = self._anomaly_detector.detect(corrected_actual, twin.residual, rolling)

        if self._fault_classifier:
            fault_probs = self._fault_classifier.predict(
                corrected_actual, twin.residual, rolling,
                thermal_margin=actual.get("thermal_margin", 20.0),
                efficiency=actual.get("efficiency", 0.82),
            )

        # ── Health Index ─────────────────────────────────────────────────
        health = compute_health_index(
            residual_magnitude=twin.residual.get("magnitude", 0.0),
            degradation=inputs.degradation.to_dict(),
            thermal_margin=actual.get("thermal_margin", 20.0),
            vibration=actual.get("vibration", 1.0),
            oil_pressure=actual.get("oil_pressure_bar", 4.0),
            anomaly_score=anomaly["anomaly_score"],
        )
        self._health_history.append(health)

        # ── Continuous Degradation Tracking ──────────────────────────────
        deg_metrics = self._degradation_tracker.update(
            health=health,
            degradation_dict=inputs.degradation.to_dict(),
            cht_c=actual.get("cht_c", 170.0),
            vibration=actual.get("vibration", 1.0),
            step=self._step,
        )

        # Update twin with correct health
        twin.health_index = health

        # ── SHAP Explanation ─────────────────────────────────────────────
        if self._explainability and self._step % 5 == 0:
            shap_result = self._explainability.explain(
                corrected_actual, twin.residual, rolling,
                thermal_margin=actual.get("thermal_margin", 20.0),
                efficiency=actual.get("efficiency", 0.82),
                fault_probabilities=fault_probs,
            )

        # ── RUL Prediction ───────────────────────────────────────────────
        if self._rul_predictor and self._step % 3 == 0:
            rul_result = self._rul_predictor.predict(
                health=health,
                degradation=inputs.degradation.to_dict(),
                throttle=raw["throttle"],
                altitude_ft=raw["altitude_ft"],
                ambient_temp_c=raw["ambient_temp_c"],
                mission_elapsed_hours=raw["mission_elapsed_hours"],
                mission_duration_hours=self.simulator.get_state().mission_duration_hours,
                health_history=list(self._health_history),
            )

        # ── Mission Risk ─────────────────────────────────────────────────
        mission_risk = self._risk_engine.assess(
            health=health,
            rul_median=rul_result.get("rul_median", 99.0),
            rul_lower=rul_result.get("rul_lower", 80.0),
            rul_upper=rul_result.get("rul_upper", 120.0),
            mission_remaining_hours=raw["mission_remaining_hours"],
            fault_probabilities=fault_probs,
            thermal_margin=actual.get("thermal_margin", 20.0),
            telemetry_integrity=integrity_dict["telemetry_integrity_score"],
            degradation=inputs.degradation.to_dict(),
        )

        # ── Mission Replanning & Pareto Frontier ─────────────────────────
        if (mission_risk.risk_level in ("HIGH", "MEDIUM") or health < 75.0) and self._step % 10 == 0:
            sim_state = self.simulator.get_state()
            replanning = self._replanner.evaluate(
                current_risk=mission_risk.risk_level,
                health=health,
                degradation=inputs.degradation.to_dict(),
                rul_median=rul_result.get("rul_median", 99.0),
                rul_lower=rul_result.get("rul_lower", 80.0),
                mission_remaining_hours=raw["mission_remaining_hours"],
                throttle=raw["throttle"],
                altitude_ft=raw["altitude_ft"],
                ambient_temp_c=raw["ambient_temp_c"],
                fault_probabilities=fault_probs,
                uav_lat=sim_state.uav_lat,
                uav_lon=sim_state.uav_lon,
            )
            self._replanning_result = replanning.to_dict()

            pareto_res = self._pareto_replanner.evaluate_pareto_frontier(
                current_health=health,
                current_risk=mission_risk.risk_level,
                degradation=inputs.degradation.to_dict(),
                rul_median=rul_result.get("rul_median", 99.0),
                rul_lower=rul_result.get("rul_lower", 80.0),
                mission_remaining_hours=raw["mission_remaining_hours"],
                current_throttle=raw["throttle"],
                current_altitude_ft=raw["altitude_ft"],
                ambient_temp_c=raw["ambient_temp_c"],
                fault_probabilities=fault_probs,
                uav_lat=sim_state.uav_lat,
                uav_lon=sim_state.uav_lon,
            )
            self._pareto_result = pareto_res.to_dict()

        # ── Record replay events ─────────────────────────────────────────
        self._record_replay_events(
            step=self._step,
            health=health,
            anomaly=anomaly,
            fault_probs=fault_probs,
            mission_risk=mission_risk,
            integrity=integrity_dict,
            raw=raw,
        )

        # ── SwarmNet Tactical Mesh & GNSS Navigation ─────────────────────
        sim_state = self.simulator.get_state()
        swarm_state = self._swarm_manager.update_step(health, self._step)
        gnss_state = self._gps_navic.update(
            uav_lat=sim_state.uav_lat,
            uav_lon=sim_state.uav_lon,
            altitude_ft=raw["altitude_ft"],
            speed_kts=sim_state.uav_speed_kts,
            heading_deg=sim_state.uav_heading_deg,
        )
        diversion_airfields = self._terrain_manager.evaluate_reachability(
            uav_lat=gnss_state.latitude,
            uav_lon=gnss_state.longitude,
            altitude_ft=raw["altitude_ft"],
            ground_speed_kts=sim_state.uav_speed_kts,
        )

        # ── Prescriptive Maintenance Taskcards ───────────────────────────
        taskcards = self._taskcard_gen.generate_taskcards(
            fault_probabilities=fault_probs,
            health_index=health,
            p10_rul_hours=rul_result.get("rul_lower", 50.0),
            active_fault=raw["active_fault"],
            degradation=inputs.degradation.to_dict(),
        )

        # ── Immutable Digital Logbook Ledger ─────────────────────────────
        if healing_events:
            for ev in healing_events:
                self._digital_logbook.append_event("SELF_HEALING_ACTIVATION", ev.to_dict())
        if self._step % 50 == 0:
            self._digital_logbook.append_event("TELEMETRY_SNAPSHOT", {
                "step": self._step, "health": round(health, 2), "top_fault": max(fault_probs, key=fault_probs.get)
            })

        # ── Assemble complete state ──────────────────────────────────────
        health_label = self.health_config.health_label(health)

        state = {
            "step": self._step,
            "simulation_time_s": raw["simulation_time_s"],
            "timestamp": time.time(),

            "mission": {
                "profile": sim_state.mission_profile,
                "environment": sim_state.environment,
                "elapsed_hours": raw["mission_elapsed_hours"],
                "remaining_hours": raw["mission_remaining_hours"],
                "duration_hours": sim_state.mission_duration_hours,
                "progress_pct": raw["mission_progress_pct"],
                "throttle": raw["throttle"],
                "altitude_ft": raw["altitude_ft"],
                "ambient_temp_c": raw["ambient_temp_c"],
                "active_fault": raw["active_fault"],
                "fault_severity": raw["fault_severity"],
            },

            "telemetry": {
                "actual": actual,
                "expected": twin.expected,
                "residual": twin.residual,
                "healed": healed_actual,
                "channel_sources": {k: v.value if hasattr(v, 'value') else str(v) for k, v in channel_sources.items()},
                "reconstructed_channels": self._self_healing.get_active_reconstructed_channels(),
            },

            "health": {
                "index": round(health, 2),
                "label": health_label,
                "color": self.health_config.health_color(health),
                "breakdown": health_breakdown(
                    twin.residual.get("magnitude", 0.0),
                    inputs.degradation.to_dict(),
                    actual.get("thermal_margin", 20.0),
                    actual.get("vibration", 1.0),
                    actual.get("oil_pressure_bar", 4.0),
                    anomaly["anomaly_score"],
                ),
            },

            "degradation": inputs.degradation.to_dict(),
            "degradation_metrics": deg_metrics.to_dict(),

            "anomaly": anomaly,

            "faults": {
                "probabilities": fault_probs,
                "top_fault": max(fault_probs, key=fault_probs.get),
                "top_fault_probability": max(fault_probs.values()),
                "shap": shap_result,
            },

            "rul": rul_result,

            "integrity": integrity_dict,
            "cyber_shield": shield_report.to_dict(),
            "self_healing_events": [e.to_dict() for e in healing_events],

            "mission_risk": mission_risk.to_dict(),

            "replanning": self._replanning_result,
            "pareto_replanning": self._pareto_result,

            "uav": {
                "lat": gnss_state.latitude,
                "lon": gnss_state.longitude,
                "heading_deg": sim_state.uav_heading_deg,
                "speed_kts": sim_state.uav_speed_kts,
                "altitude_ft": raw["altitude_ft"],
                "waypoints": sim_state.waypoints,
                "current_waypoint_idx": sim_state.current_waypoint_idx,
            },

            "swarm": swarm_state,
            "gnss": gnss_state.to_dict(),
            "emergency_diversion_airfields": [a.to_dict() for a in diversion_airfields[:5]],

            "edge_mode": raw["edge_mode"],
            "buffered_steps": sim_state.buffered_steps,
            "scenario": sim_state.scenario,
            "unified_telemetry": raw.get("unified_telemetry"),
            "maintenance_taskcards": [c.to_dict() for c in taskcards],
            "digital_logbook": self._digital_logbook.to_dict(),
        }

        return _sanitize_for_json(state)

    def _dict_to_engine_outputs(self, d: Dict):
        """Convert dict to EngineOutputs for state estimator"""
        from .digital_twin.engine_model import EngineOutputs
        out = EngineOutputs()
        for k, v in d.items():
            if hasattr(out, k):
                setattr(out, k, float(v) if v is not None else 0.0)
        return out

    def _record_replay_events(self, step, health, anomaly, fault_probs, mission_risk, integrity, raw):
        """Record significant events for replay"""
        events = []
        sim_t = raw["simulation_time_s"]

        if step == 1:
            events.append({"type": "TAKEOFF", "label": "Mission Start", "step": step, "simulation_time_s": sim_t})

        if anomaly["is_anomaly"] and step % 30 == 0:
            events.append({"type": "ANOMALY_DETECTED", "label": f"Anomaly: {anomaly['anomaly_class']}", "step": step, "simulation_time_s": sim_t})

        top_fault = max(fault_probs, key=fault_probs.get)
        if fault_probs[top_fault] > 0.7 and top_fault != "healthy":
            if not any(e.get("type") == "FAULT_CLASSIFIED" and e.get("step", 0) > step - 30 for e in self._replay_events[-10:]):
                events.append({"type": "FAULT_CLASSIFIED", "label": f"Fault: {top_fault.upper()}", "step": step, "simulation_time_s": sim_t})

        if health < 40 and (not self._replay_events or self._replay_events[-1].get("type") != "RUL_WARNING"):
            events.append({"type": "RUL_WARNING", "label": f"Health critical: {health:.0f}%", "step": step, "simulation_time_s": sim_t})

        if mission_risk.risk_level == "HIGH":
            if not any(e.get("type") == "MISSION_RISK_HIGH" and e.get("step", 0) > step - 30 for e in self._replay_events[-10:]):
                events.append({"type": "MISSION_RISK_HIGH", "label": "Mission risk HIGH", "step": step, "simulation_time_s": sim_t})

        if integrity["overall_classification"] not in ("NORMAL TELEMETRY",):
            if not any(e.get("type") == "TELEMETRY_ANOMALY" and e.get("step", 0) > step - 30 for e in self._replay_events[-10:]):
                events.append({"type": "TELEMETRY_ANOMALY", "label": f"Telemetry: {integrity['overall_classification']}", "step": step, "simulation_time_s": sim_t})

        self._replay_events.extend(events)

    # ── Public API ─────────────────────────────────────────────────────────

    def get_full_state(self) -> Dict:
        sim = self.simulator.get_state()
        snapshot = dict(self._full_system_state or {})
        snapshot.update({
            "step": sim.step,
            "simulation_time_s": sim.simulation_time_s,
            "simulation_status": sim.status.value,
            "speed_multiplier": sim.speed_multiplier,
        })
        snapshot["mission"] = {
            **snapshot.get("mission", {}),
            "profile": sim.mission_profile, "environment": sim.environment,
            "throttle": sim.throttle, "altitude_ft": sim.altitude_ft,
            "ambient_temp_c": sim.ambient_temp_c,
            "active_fault": sim.active_fault.value, "fault_severity": sim.fault_severity,
            "elapsed_hours": sim.mission_elapsed_hours, "remaining_hours": sim.mission_remaining_hours,
            "duration_hours": sim.mission_duration_hours, "progress_pct": sim.mission_progress_pct,
        }
        return snapshot

    def get_replay_events(self) -> List[Dict]:
        return self._replay_events[-200:]

    def get_health_history(self, n: int = 200) -> List[float]:
        return list(self._health_history)[-n:]

    def get_twin_history(self, n: int = 100) -> List[Dict]:
        return self.state_estimator.get_history(n)

    def load_scenario(self, scenario_name: str) -> bool:
        """Load a pre-configured demo scenario"""
        scenario = DEMO_SCENARIOS.get(scenario_name)
        if not scenario:
            return False

        self.simulator.reset()
        self._replay_events = []
        self._replanning_result = None
        self._pareto_result = None
        self._health_history.clear()
        self._cyber_monitor.reset()
        self._zero_trust_shield.reset()
        self._self_healing.reset()
        self._degradation_tracker.reset()
        self._digital_logbook.reset()
        self._digital_logbook.append_event("SORTIE_START", {
            "scenario": scenario_name,
            "profile": scenario["profile"],
            "environment": scenario["environment"],
            "description": scenario["description"],
        })
        self.simulator.get_state().scenario = scenario_name

        self.simulator.set_mission_profile(scenario["profile"])
        self.simulator.set_environment(scenario["environment"])

        if scenario["fault"] != "none":
            self.simulator.inject_fault(scenario["fault"], scenario["fault_severity"])

        if scenario.get("sensor_injection"):
            inj = scenario["sensor_injection"]
            self.simulator.inject_sensor_anomaly(
                inj["sensor"], inj["type"], inj.get("magnitude", 0)
            )

        self.simulator.start()
        logger.info(f"Scenario loaded: {scenario_name}")
        return True

    def run_what_if(self, params: Dict) -> Dict:
        """Run a what-if simulation"""
        request = WhatIfRequest(
            throttle=float(params.get("throttle", 0.65)),
            altitude_ft=float(params.get("altitude_ft", 10000)),
            ambient_temp_c=float(params.get("ambient_temp_c", 15)),
            mission_duration_hours=float(params.get("mission_duration_hours", 4)),
            mission_remaining_hours=float(params.get("mission_remaining_hours", 3)),
            degradation=self.simulator.get_state().degradation.to_dict(),
        )

        current_health = self._health_history[-1] if self._health_history else 100.0
        current_faults = self._full_system_state.get("faults", {}).get("probabilities", {})
        current_rul_lower = self._full_system_state.get("rul", {}).get("rul_lower", 80.0)

        result = self._what_if_sim.simulate(
            request=request,
            current_health=current_health,
            current_fault_probabilities=current_faults,
            current_rul_lower=current_rul_lower,
            scenario_label=params.get("label", "What-If"),
        )
        return result.to_dict()


# Global orchestrator instance
orchestrator = AeroTwinOrchestrator()
