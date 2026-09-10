"""
AERO-TWIN — Engine Simulator

Orchestrates the simulation of:
- Mission profile execution
- Engine state evolution
- Fault injection
- Degradation progression
- Sensor failure simulation
- Telemetry anomaly injection

This is the authoritative source of "physical" engine state in the system.
"""

import numpy as np
import time
import logging
from dataclasses import dataclass, field
from typing import Dict, Optional, List, Tuple
from enum import Enum

from ..digital_twin.engine_model import (
    AeroPistonEngineModel,
    EngineInputs,
    EngineOutputs,
    DegradationState,
    isa_atmosphere,
)

logger = logging.getLogger(__name__)


class SimulationStatus(str, Enum):
    STOPPED = "STOPPED"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"


class FaultType(str, Enum):
    NONE = "none"
    INJECTOR = "injector"
    COOLING = "cooling"
    LUBRICATION = "lubrication"
    MECHANICAL = "mechanical"
    COMBUSTION = "combustion"
    SENSOR = "sensor"


class SensorAnomalyType(str, Enum):
    NONE = "none"
    FREEZE = "freeze"
    DRIFT = "drift"
    SPIKE = "spike"
    DROPOUT = "dropout"
    BIAS = "bias"
    NOISE = "noise"


@dataclass
class SensorInjection:
    """Describes an active telemetry anomaly injection"""
    sensor: str = ""          # e.g. "egt_c", "rpm"
    anomaly_type: SensorAnomalyType = SensorAnomalyType.NONE
    magnitude: float = 0.0    # spike/bias/drift magnitude
    frozen_value: Optional[float] = None  # for freeze
    start_step: int = 0
    duration_steps: int = 300  # how long injection lasts


@dataclass
class MissionProfile:
    name: str = "ISR"
    altitude_ft: float = 10000.0
    throttle: float = 0.65
    engine_load: float = 0.65
    rpm_target: float = 4800.0
    duration_hours: float = 4.0
    ambient_temp_c: float = 15.0
    description: str = ""


MISSION_PROFILES = {
    "ISR": MissionProfile(
        name="ISR", altitude_ft=12000, throttle=0.60, engine_load=0.60,
        rpm_target=4600, duration_hours=4.0, ambient_temp_c=10.0,
        description="Intelligence, Surveillance, Reconnaissance — steady cruise"
    ),
    "ENDURANCE": MissionProfile(
        name="ENDURANCE", altitude_ft=8000, throttle=0.50, engine_load=0.50,
        rpm_target=4200, duration_hours=8.0, ambient_temp_c=12.0,
        description="Extended endurance — low throttle, maximum time aloft"
    ),
    "HIGH_ALTITUDE": MissionProfile(
        name="HIGH_ALTITUDE", altitude_ft=22000, throttle=0.80, engine_load=0.80,
        rpm_target=5200, duration_hours=3.0, ambient_temp_c=-5.0,
        description="High altitude ISR — engine near performance limit"
    ),
    "HOT_WEATHER": MissionProfile(
        name="HOT_WEATHER", altitude_ft=5000, throttle=0.70, engine_load=0.70,
        rpm_target=4800, duration_hours=3.0, ambient_temp_c=42.0,
        description="Desert hot weather operation — thermal stress"
    ),
    "MARITIME": MissionProfile(
        name="MARITIME", altitude_ft=3000, throttle=0.65, engine_load=0.65,
        rpm_target=4600, duration_hours=5.0, ambient_temp_c=28.0,
        description="Maritime patrol — low altitude, high humidity"
    ),
    "RAPID_THROTTLE": MissionProfile(
        name="RAPID_THROTTLE", altitude_ft=10000, throttle=0.85, engine_load=0.85,
        rpm_target=5400, duration_hours=2.0, ambient_temp_c=15.0,
        description="High-performance manoeuvre profile — maximum stress"
    ),
}


ENVIRONMENTS = {
    "MOUNTAIN": {"name": "Mountain", "altitude_offset": 3000, "temp_offset": -8, "turbulence": 0.3},
    "DESERT": {"name": "Desert", "altitude_offset": 0, "temp_offset": 25, "turbulence": 0.15},
    "MARITIME": {"name": "Maritime", "altitude_offset": -2000, "temp_offset": 10, "turbulence": 0.2},
    "FOREST": {"name": "Forest", "altitude_offset": 0, "temp_offset": 0, "turbulence": 0.1},
    "HIGH_ALTITUDE": {"name": "High Altitude", "altitude_offset": 8000, "temp_offset": -20, "turbulence": 0.1},
    "ADVERSE_WEATHER": {"name": "Adverse Weather", "altitude_offset": 0, "temp_offset": 5, "turbulence": 0.6},
    "STANDARD": {"name": "Standard", "altitude_offset": 0, "temp_offset": 0, "turbulence": 0.05},
}


@dataclass
class SimulationState:
    """Complete simulation state snapshot"""
    step: int = 0
    simulation_time_s: float = 0.0      # simulated elapsed time
    real_time_s: float = 0.0
    status: SimulationStatus = SimulationStatus.STOPPED
    speed_multiplier: float = 1.0

    # Mission
    mission_profile: str = "ISR"
    mission_elapsed_hours: float = 0.0
    mission_duration_hours: float = 4.0
    mission_remaining_hours: float = 4.0
    mission_progress_pct: float = 0.0

    # Engine inputs
    throttle: float = 0.65
    altitude_ft: float = 10000.0
    rpm_target: float = 4800.0
    ambient_temp_c: float = 15.0
    engine_load: float = 0.65
    environment: str = "STANDARD"

    # Active fault
    active_fault: FaultType = FaultType.NONE
    fault_severity: float = 0.0

    # Degradation
    degradation: DegradationState = field(default_factory=DegradationState)

    # Active sensor injection
    sensor_injections: List[SensorInjection] = field(default_factory=list)

    # Engine outputs (actual — with noise and degradation)
    engine_outputs: Dict[str, float] = field(default_factory=dict)

    # Health
    health_index: float = 100.0

    # UAV position (simulated)
    uav_lat: float = 28.6139     # Delhi area reference
    uav_lon: float = 77.2090
    uav_heading_deg: float = 90.0
    uav_speed_kts: float = 85.0

    # Waypoints for current mission
    waypoints: List[Dict] = field(default_factory=list)
    current_waypoint_idx: int = 0

    # Offline/edge mode
    edge_mode: bool = False
    buffered_steps: int = 0

    # Scenario
    scenario: str = "HEALTHY_ISR"


class EngineSimulator:
    """
    Main Engine Simulator

    Manages simulation loop, fault injection, sensor anomaly injection,
    and produces telemetry at each timestep.
    """

    STEP_INTERVAL_S = 1.0      # simulated seconds per step at 1x speed
    HZ = 1.0                   # update frequency

    def __init__(self, seed: int = 42):
        self._rng = np.random.default_rng(seed)
        self._model = AeroPistonEngineModel(noise_factor=1.0, seed=seed)
        self._state = SimulationState()
        self._frozen_values: Dict[str, float] = {}
        self._drift_accum: Dict[str, float] = {}

        # Initialize default waypoints
        self._state.waypoints = self._generate_waypoints("ISR")

    def get_state(self) -> SimulationState:
        return self._state

    def set_mission_profile(self, profile_name: str) -> None:
        profile = MISSION_PROFILES.get(profile_name, MISSION_PROFILES["ISR"])
        self._state.mission_profile = profile_name
        self._state.throttle = profile.throttle
        self._state.altitude_ft = profile.altitude_ft
        self._state.rpm_target = profile.rpm_target
        self._state.ambient_temp_c = profile.ambient_temp_c
        self._state.engine_load = profile.engine_load
        self._state.mission_duration_hours = profile.duration_hours
        self._state.mission_remaining_hours = profile.duration_hours
        self._state.waypoints = self._generate_waypoints(profile_name)

    def set_environment(self, env_name: str) -> None:
        env = ENVIRONMENTS.get(env_name, ENVIRONMENTS["STANDARD"])
        self._state.environment = env_name
        # Apply environment offsets
        profile = MISSION_PROFILES.get(self._state.mission_profile, MISSION_PROFILES["ISR"])
        self._state.altitude_ft = profile.altitude_ft + env["altitude_offset"]
        self._state.ambient_temp_c = profile.ambient_temp_c + env["temp_offset"]

    def inject_fault(self, fault_type: str, severity: float) -> None:
        """Inject a fault with given severity 0–1"""
        ft = FaultType(fault_type) if fault_type in [f.value for f in FaultType] else FaultType.NONE
        self._state.active_fault = ft
        self._state.fault_severity = float(np.clip(severity, 0.0, 1.0))
        logger.info(f"Fault injected: {ft.value} severity={severity:.2f}")

    def clear_fault(self) -> None:
        self._state.active_fault = FaultType.NONE
        self._state.fault_severity = 0.0
        self._state.degradation = DegradationState()

    def inject_sensor_anomaly(
        self,
        sensor: str,
        anomaly_type: str,
        magnitude: float = 0.0,
        duration_steps: int = 300,
    ) -> None:
        """Inject a sensor anomaly"""
        anomaly = SensorInjection(
            sensor=sensor,
            anomaly_type=SensorAnomalyType(anomaly_type),
            magnitude=magnitude,
            start_step=self._state.step,
            duration_steps=duration_steps,
        )
        # Remove existing injection for same sensor
        self._state.sensor_injections = [
            s for s in self._state.sensor_injections if s.sensor != sensor
        ]
        self._state.sensor_injections.append(anomaly)
        logger.info(f"Sensor anomaly injected: {sensor} type={anomaly_type}")

    def clear_sensor_injections(self) -> None:
        self._state.sensor_injections = []
        self._frozen_values = {}
        self._drift_accum = {}

    def set_throttle(self, throttle: float) -> None:
        self._state.throttle = float(np.clip(throttle, 0.0, 1.0))

    def set_altitude(self, altitude_ft: float) -> None:
        self._state.altitude_ft = float(np.clip(altitude_ft, 0, 30000))

    def set_ambient_temp(self, temp_c: float) -> None:
        self._state.ambient_temp_c = float(np.clip(temp_c, -40, 60))

    def set_speed_multiplier(self, speed: float) -> None:
        self._state.speed_multiplier = float(np.clip(speed, 0.1, 20.0))

    def start(self) -> None:
        self._state.status = SimulationStatus.RUNNING

    def pause(self) -> None:
        self._state.status = SimulationStatus.PAUSED

    def reset(self) -> None:
        profile_name = self._state.mission_profile
        env_name = self._state.environment
        self._state = SimulationState()
        self._state.mission_profile = profile_name
        self._state.environment = env_name
        self.set_mission_profile(profile_name)
        self.set_environment(env_name)
        self._frozen_values = {}
        self._drift_accum = {}

    def activate_edge_mode(self) -> None:
        self._state.edge_mode = True
        self._state.buffered_steps = 0
        logger.info("EDGE MODE activated — ground telemetry suspended")

    def deactivate_edge_mode(self) -> None:
        self._state.edge_mode = False
        buffered = self._state.buffered_steps
        self._state.buffered_steps = 0
        logger.info(f"Edge mode deactivated — {buffered} steps synchronized")
        return buffered

    def step(self) -> Optional[Dict]:
        """
        Advance simulation by one timestep.
        Returns the engine telemetry dict, or None if paused/stopped.
        """
        if self._state.status != SimulationStatus.RUNNING:
            return None

        self._state.step += 1
        dt = self.STEP_INTERVAL_S * self._state.speed_multiplier
        self._state.simulation_time_s += dt

        # ── Update mission time ──────────────────────────────────────────────
        dt_hours = dt / 3600.0
        self._state.mission_elapsed_hours += dt_hours
        self._state.mission_remaining_hours = max(
            0.0,
            self._state.mission_duration_hours - self._state.mission_elapsed_hours
        )
        if self._state.mission_duration_hours > 0:
            self._state.mission_progress_pct = min(
                100.0,
                100.0 * self._state.mission_elapsed_hours / self._state.mission_duration_hours
            )

        # ── Update degradation from active fault ────────────────────────────
        self._update_degradation()

        # ── Throttle variation (gentle sinusoidal for realism) ───────────────
        env = ENVIRONMENTS.get(self._state.environment, ENVIRONMENTS["STANDARD"])
        turb = env["turbulence"]
        throttle_noise = self._rng.normal(0, 0.01 * turb)
        effective_throttle = float(np.clip(self._state.throttle + throttle_noise, 0.05, 1.0))

        # ── Build engine inputs ──────────────────────────────────────────────
        inputs = EngineInputs(
            throttle=effective_throttle,
            rpm_target=self._state.rpm_target,
            altitude_ft=self._state.altitude_ft,
            ambient_temp_c=self._state.ambient_temp_c,
            engine_load=self._state.engine_load,
            degradation=self._state.degradation,
            noise_factor=1.0,
        )

        # ── Compute engine outputs ───────────────────────────────────────────
        outputs = self._model.compute(inputs)
        output_dict = outputs.to_dict()

        # ── Apply sensor anomaly injections ──────────────────────────────────
        output_dict = self._apply_sensor_injections(output_dict)

        # ── Update UAV position ──────────────────────────────────────────────
        self._update_flight_path(dt)

        self._state.engine_outputs = output_dict

        # In edge mode, buffer the step
        if self._state.edge_mode:
            self._state.buffered_steps += 1

        return {
            "step": self._state.step,
            "simulation_time_s": round(self._state.simulation_time_s, 1),
            "throttle": round(effective_throttle, 3),
            "altitude_ft": round(self._state.altitude_ft, 0),
            "ambient_temp_c": round(self._state.ambient_temp_c, 1),
            "engine_load": round(self._state.engine_load, 3),
            "rpm_target": self._state.rpm_target,
            "outputs": output_dict,
            "degradation": self._state.degradation.to_dict(),
            "mission_elapsed_hours": round(self._state.mission_elapsed_hours, 4),
            "mission_remaining_hours": round(self._state.mission_remaining_hours, 4),
            "mission_progress_pct": round(self._state.mission_progress_pct, 2),
            "uav_lat": self._state.uav_lat,
            "uav_lon": self._state.uav_lon,
            "uav_heading_deg": self._state.uav_heading_deg,
            "uav_speed_kts": self._state.uav_speed_kts,
            "active_fault": self._state.active_fault.value,
            "fault_severity": round(self._state.fault_severity, 3),
            "edge_mode": self._state.edge_mode,
        }

    def _update_degradation(self) -> None:
        """Gradually increase degradation based on active fault"""
        fault = self._state.active_fault
        severity = self._state.fault_severity
        deg = self._state.degradation

        # Rate of degradation per step (at 1x speed = 1s per step)
        # Severity 1.0 → reaches 1.0 in ~500 steps = ~8 min
        rate = severity * 0.002

        if fault == FaultType.INJECTOR:
            deg.injector = min(1.0, deg.injector + rate)
        elif fault == FaultType.COOLING:
            deg.cooling = min(1.0, deg.cooling + rate)
        elif fault == FaultType.LUBRICATION:
            deg.lubrication = min(1.0, deg.lubrication + rate)
        elif fault == FaultType.MECHANICAL:
            deg.mechanical = min(1.0, deg.mechanical + rate)
        elif fault == FaultType.COMBUSTION:
            deg.combustion = min(1.0, deg.combustion + rate)

        # Secondary causal effects
        if deg.cooling > 0.3:
            # Overheating accelerates mechanical wear
            deg.mechanical = min(1.0, deg.mechanical + rate * 0.3)
        if deg.lubrication > 0.4:
            # Poor lubrication → mechanical degradation
            deg.mechanical = min(1.0, deg.mechanical + rate * 0.5)

    def _apply_sensor_injections(self, outputs: Dict[str, float]) -> Dict[str, float]:
        """Apply active sensor anomaly injections to outputs"""
        expired = []
        for inj in self._state.sensor_injections:
            steps_elapsed = self._state.step - inj.start_step
            if steps_elapsed > inj.duration_steps:
                expired.append(inj)
                continue

            sensor = inj.sensor
            if sensor not in outputs:
                continue

            original = outputs[sensor]

            if inj.anomaly_type == SensorAnomalyType.FREEZE:
                if inj.frozen_value is None:
                    inj.frozen_value = original
                outputs[sensor] = inj.frozen_value

            elif inj.anomaly_type == SensorAnomalyType.SPIKE:
                outputs[sensor] = original + inj.magnitude

            elif inj.anomaly_type == SensorAnomalyType.BIAS:
                outputs[sensor] = original + inj.magnitude

            elif inj.anomaly_type == SensorAnomalyType.DRIFT:
                drift_rate = inj.magnitude / max(inj.duration_steps, 1)
                self._drift_accum[sensor] = self._drift_accum.get(sensor, 0.0) + drift_rate
                outputs[sensor] = original + self._drift_accum[sensor]

            elif inj.anomaly_type == SensorAnomalyType.NOISE:
                outputs[sensor] = original + float(self._rng.normal(0, inj.magnitude))

            elif inj.anomaly_type == SensorAnomalyType.DROPOUT:
                outputs[sensor] = 0.0  # signal lost

        # Remove expired injections
        for inj in expired:
            self._state.sensor_injections.remove(inj)
            if inj.sensor in self._drift_accum:
                del self._drift_accum[inj.sensor]
            if inj.sensor in self._frozen_values:
                del self._frozen_values[inj.sensor]

        return outputs

    def _compute_health_index(
        self, actual: Dict[str, float], expected: Dict[str, float]
    ) -> float:
        """
        Computes an overall engine health index from 0 to 100
        based on parameter deviations and degradation state.
        """
        weights = {
            "egt_c": 0.25,
            "cht_c": 0.20,
            "oil_pressure_bar": 0.20,
            "fuel_flow_lph": 0.15,
            "vibration_rms": 0.10,
            "rpm": 0.10,
        }
        health = 100.0

        for param, weight in weights.items():
            if param in actual and param in expected and expected[param] > 0:
                rel_error = abs(actual[param] - expected[param]) / (expected[param] + 1e-6)
                penalty = min(rel_error * 120.0, 100.0) * weight
                health -= penalty

        # Additional penalty from physical degradation state
        degr = self._state.degradation
        degr_penalty = (
            degr.mechanical * 25.0
            + degr.cooling * 20.0
            + degr.lubrication * 25.0
            + degr.injector * 15.0
        )
        health -= degr_penalty

        return float(np.clip(health, 0.0, 100.0))

    def _health_label(self, health_index: float) -> str:
        if health_index >= 85:
            return "HEALTHY"
        elif health_index >= 70:
            return "MONITOR"
        elif health_index >= 50:
            return "DEGRADED"
        elif health_index >= 30:
            return "CRITICAL"
        return "FAILURE IMMINENT"

    def _health_color(self, health_index: float) -> str:
        if health_index >= 85:
            return "#00ff88"
        elif health_index >= 70:
            return "#38bdf8"
        elif health_index >= 50:
            return "#facc15"
        elif health_index >= 30:
            return "#fb923c"
        return "#f43f5e"

    def _update_flight_path(self, dt: float) -> None:
        """Advance UAV along its route"""
        speed_mps = (self._state.uav_speed_kts * 1852.0) / 3600.0
        dist_m = speed_mps * dt

        heading_rad = np.radians(self._state.uav_heading_deg)
        dlat = (dist_m * np.cos(heading_rad)) / 111320.0
        dlon = (dist_m * np.sin(heading_rad)) / (
            111320.0 * np.cos(np.radians(self._state.uav_lat))
        )

        self._state.uav_lat += dlat
        self._state.uav_lon += dlon

        # Navigate toward current waypoint
        if self._state.waypoints and self._state.current_waypoint_idx < len(self._state.waypoints):
            wp = self._state.waypoints[self._state.current_waypoint_idx]
            target_lat = wp["lat"]
            target_lon = wp["lon"]
            dlat_t = target_lat - self._state.uav_lat
            dlon_t = target_lon - self._state.uav_lon
            dist_to_wp = np.sqrt(dlat_t**2 + dlon_t**2) * 111320
            if dist_to_wp < 500:  # within 500m → advance to next waypoint
                self._state.current_waypoint_idx = (
                    self._state.current_waypoint_idx + 1
                ) % len(self._state.waypoints)
            else:
                # Steer toward waypoint
                self._state.uav_heading_deg = float(
                    np.degrees(np.arctan2(dlon_t, dlat_t)) % 360
                )

    def _generate_waypoints(self, mission_profile: str) -> List[Dict]:
        """Generate Indian defence mission waypoints (lat/lon) for 3D display"""
        base_lat = 34.1526  # Ladakh / Himalayan Sector, India
        base_lon = 77.5771
        routes = {
            "ISR": [
                {"lat": base_lat + 0.15, "lon": base_lon + 0.10, "label": "WP1-SIACHEN"},
                {"lat": base_lat + 0.35, "lon": base_lon + 0.20, "label": "WP2-KARAKORAM"},
                {"lat": base_lat + 0.40, "lon": base_lon + 0.45, "label": "TARGET-LAC"},
                {"lat": base_lat + 0.20, "lon": base_lon + 0.40, "label": "WP3-PANGONG"},
                {"lat": base_lat, "lon": base_lon + 0.15, "label": "WP4-LEH"},
            ],
            "ENDURANCE": [
                {"lat": base_lat + 0.3, "lon": base_lon + 0.8, "label": "WP4"},
            ],
        }
        route = routes.get(mission_profile, routes["ISR"])
        return route

    def get_waypoints(self) -> List[Dict]:
        return self._state.waypoints

    def apply_replanning(self, new_profile: Dict) -> None:
        """Apply a replanning result to simulation"""
        if "throttle" in new_profile:
            self._state.throttle = float(new_profile["throttle"])
        if "altitude_ft" in new_profile:
            self._state.altitude_ft = float(new_profile["altitude_ft"])
        if "mission_duration_hours" in new_profile:
            remaining = new_profile.get("mission_duration_hours", self._state.mission_remaining_hours)
            self._state.mission_remaining_hours = min(remaining, self._state.mission_remaining_hours)
            self._state.mission_duration_hours = self._state.mission_elapsed_hours + remaining
        logger.info(f"Replanning applied: {new_profile}")
