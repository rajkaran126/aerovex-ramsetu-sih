"""
AERO-TWIN — Dynamic Mission Replanner

Generates and evaluates alternative mission profiles when current mission
becomes unsafe/high-risk.

Uses the digital twin + RUL predictor to forward-simulate candidate profiles
and selects the best feasible alternative.

Returns multiple candidates with predicted health, RUL, risk, and
mission completion probability for each.
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
import logging

from ..digital_twin.engine_model import (
    AeroPistonEngineModel,
    EngineInputs,
    DegradationState,
)
from ..digital_twin.health_index import compute_health_index
from .risk_model import MissionRiskEngine

logger = logging.getLogger(__name__)


@dataclass
class MissionCandidate:
    """Alternative mission profile candidate"""
    name: str
    throttle: float
    altitude_ft: float
    duration_hours: float
    description: str

    # Forward-simulation results
    predicted_health_end: float = 0.0
    predicted_rul_hours: float = 0.0
    predicted_risk: str = "HIGH"
    mission_completion_probability: float = 0.0
    predicted_thermal_margin: float = 0.0
    fuel_impact_pct: float = 0.0  # relative fuel consumption vs current

    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "throttle": round(self.throttle, 2),
            "altitude_ft": round(self.altitude_ft, 0),
            "duration_hours": round(self.duration_hours, 2),
            "description": self.description,
            "predicted_health_end": round(self.predicted_health_end, 1),
            "predicted_rul_hours": round(self.predicted_rul_hours, 2),
            "predicted_risk": self.predicted_risk,
            "mission_completion_probability": round(self.mission_completion_probability, 3),
            "predicted_thermal_margin": round(self.predicted_thermal_margin, 1),
            "fuel_impact_pct": round(self.fuel_impact_pct, 1),
        }


@dataclass
class ReplanningResult:
    triggered: bool = False
    reason: str = ""
    current_risk: str = "LOW"
    candidates: List[MissionCandidate] = field(default_factory=list)
    best_candidate: Optional[MissionCandidate] = None
    recommendation: str = "CONTINUE"
    ghost_waypoints: List[Dict] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "triggered": self.triggered,
            "reason": self.reason,
            "current_risk": self.current_risk,
            "candidates": [c.to_dict() for c in self.candidates],
            "best_candidate": self.best_candidate.to_dict() if self.best_candidate else None,
            "recommendation": self.recommendation,
            "ghost_waypoints": self.ghost_waypoints,
        }


class MissionReplanner:
    """
    Dynamic Mission Replanner.

    When triggered (by high risk or explicit request), generates alternative
    mission profiles and evaluates each using forward simulation.
    """

    CANDIDATE_PROFILES = [
        MissionCandidate("RTB", 0.55, 8000, 1.0, "Return to Base — minimum time"),
        MissionCandidate("REDUCED_ALTITUDE", 0.60, 12000, 3.0, "Reduced altitude, reduced throttle"),
        MissionCandidate("CONSERVATIVE", 0.55, 10000, 2.5, "Conservative profile — extended margin"),
        MissionCandidate("LOITER", 0.45, 8000, 2.0, "Low-altitude loiter — minimal stress"),
        MissionCandidate("EMERGENCY_RTB", 0.70, 5000, 0.5, "Emergency return — best speed"),
    ]

    def __init__(self):
        self._engine_model = AeroPistonEngineModel(noise_factor=0.0, seed=0)
        self._risk_engine = MissionRiskEngine()

    def evaluate(
        self,
        current_risk: str,
        health: float,
        degradation: Dict[str, float],
        rul_median: float,
        rul_lower: float,
        mission_remaining_hours: float,
        throttle: float,
        altitude_ft: float,
        ambient_temp_c: float,
        fault_probabilities: Dict[str, float],
        base_lat: float = 28.6139,
        base_lon: float = 77.2090,
        uav_lat: float = 28.8,
        uav_lon: float = 77.4,
    ) -> ReplanningResult:
        """
        Generate and evaluate alternative mission profiles.
        """
        result = ReplanningResult()
        result.current_risk = current_risk

        if current_risk == "LOW":
            result.triggered = False
            result.recommendation = "CONTINUE"
            return result

        result.triggered = True
        result.reason = f"Mission risk is {current_risk} — evaluating alternatives"

        deg = DegradationState(**{
            k: float(v) for k, v in degradation.items()
            if k in ["injector", "cooling", "lubrication", "mechanical", "combustion"]
        })

        # Evaluate each candidate by forward-simulating the engine
        evaluated: List[Tuple[float, MissionCandidate]] = []

        for template in self.CANDIDATE_PROFILES:
            candidate = MissionCandidate(
                name=template.name,
                throttle=template.throttle,
                altitude_ft=template.altitude_ft,
                duration_hours=min(template.duration_hours, mission_remaining_hours * 1.1),
                description=template.description,
            )

            # Forward simulate to end of candidate mission
            health_end, thermal_margin, ff_ref = self._forward_simulate(
                candidate, deg, ambient_temp_c, health
            )

            # Estimate RUL for candidate profile
            rul_candidate = self._estimate_rul_for_profile(health_end, rul_lower, health, deg)

            # Compute risk for candidate
            risk_result = self._risk_engine.assess(
                health=health_end,
                rul_median=rul_candidate * 1.3,
                rul_lower=rul_candidate,
                rul_upper=rul_candidate * 1.7,
                mission_remaining_hours=candidate.duration_hours,
                fault_probabilities=fault_probabilities,
                thermal_margin=thermal_margin,
                telemetry_integrity=1.0,
                degradation=degradation,
            )

            # Fuel impact vs current throttle
            current_ff = throttle * 25
            candidate_ff = candidate.throttle * 25
            candidate.fuel_impact_pct = (candidate_ff / max(current_ff, 0.1) - 1.0) * 100

            candidate.predicted_health_end = health_end
            candidate.predicted_rul_hours = rul_candidate
            candidate.predicted_risk = risk_result.risk_level
            candidate.mission_completion_probability = risk_result.mission_completion_probability
            candidate.predicted_thermal_margin = thermal_margin

            # Score: prefer lower risk, higher health margin, feasible mission
            score = (
                (1.0 - risk_result.risk_score) * 0.5
                + (health_end / 100.0) * 0.3
                + risk_result.mission_completion_probability * 0.2
            )
            evaluated.append((score, candidate))

        evaluated.sort(key=lambda x: x[0], reverse=True)
        result.candidates = [c for _, c in evaluated]

        if evaluated:
            result.best_candidate = evaluated[0][1]
            best = result.best_candidate
            if best.name == "RTB" or best.name == "EMERGENCY_RTB":
                result.recommendation = "RETURN TO BASE"
            elif best.predicted_risk == "HIGH":
                result.recommendation = "RETURN TO BASE"
            else:
                result.recommendation = "MODIFY MISSION"

        # Generate ghost waypoints for best candidate (RTB path)
        result.ghost_waypoints = self._generate_ghost_waypoints(
            uav_lat, uav_lon, base_lat, base_lon,
            result.best_candidate.name if result.best_candidate else "RTB"
        )

        return result

    def _forward_simulate(
        self,
        candidate: MissionCandidate,
        deg: DegradationState,
        ambient_temp_c: float,
        start_health: float,
    ) -> Tuple[float, float, float]:
        """
        Forward-simulate engine state at end of candidate mission.
        Returns (health_end, thermal_margin, fuel_flow).
        """
        steps = max(1, int(candidate.duration_hours * 60))  # 1 step = 1 minute

        inputs = EngineInputs(
            throttle=candidate.throttle,
            rpm_target=4600,
            altitude_ft=candidate.altitude_ft,
            ambient_temp_c=ambient_temp_c,
            engine_load=candidate.throttle,
            degradation=deg,
            noise_factor=0.0,
        )

        outputs = self._engine_model.compute(inputs)

        # Estimate health at end: degrade based on load and degradation
        load_stress = candidate.throttle * 0.8 + (1 - min(candidate.altitude_ft, 15000) / 15000) * 0.2
        deg_overall = (
            0.3 * deg.injector + 0.2 * deg.cooling + 0.2 * deg.lubrication
            + 0.2 * deg.mechanical + 0.1 * deg.combustion
        )
        health_decay_per_hour = 0.5 * (1 + deg_overall * 3) * load_stress
        health_end = max(0.0, start_health - health_decay_per_hour * candidate.duration_hours)

        return health_end, outputs.thermal_margin, outputs.fuel_flow_lph

    def _estimate_rul_for_profile(
        self,
        health_end: float,
        rul_lower_current: float,
        health_current: float,
        deg: DegradationState,
    ) -> float:
        """Estimate RUL if this candidate is flown"""
        if health_end <= 20.0:
            return 0.0
        # Extend RUL proportionally to health preservation
        health_preserved = health_end - 20.0
        current_margin = health_current - 20.0
        if current_margin <= 0:
            return 0.0
        return rul_lower_current * (health_preserved / max(current_margin, 0.01))

    def _generate_ghost_waypoints(
        self,
        uav_lat: float,
        uav_lon: float,
        base_lat: float,
        base_lon: float,
        mission_name: str,
    ) -> List[Dict]:
        """Generate ghost UAV waypoints for the best candidate mission"""
        if "RTB" in mission_name:
            # Direct path back to base
            return [
                {"lat": uav_lat, "lon": uav_lon, "label": "CURRENT", "type": "current"},
                {"lat": (uav_lat + base_lat) / 2, "lon": (uav_lon + base_lon) / 2,
                 "label": "MID", "type": "waypoint"},
                {"lat": base_lat, "lon": base_lon, "label": "BASE", "type": "base"},
            ]
        else:
            # Reduced altitude route — stays in area but at lower/safer parameters
            dlat = base_lat - uav_lat
            dlon = base_lon - uav_lon
            return [
                {"lat": uav_lat, "lon": uav_lon, "label": "CURRENT", "type": "current"},
                {"lat": uav_lat + dlat * 0.3, "lon": uav_lon + dlon * 0.3,
                 "label": "ALT-WP1", "type": "waypoint"},
                {"lat": uav_lat + dlat * 0.6, "lon": uav_lon + dlon * 0.6,
                 "label": "ALT-WP2", "type": "waypoint"},
                {"lat": base_lat, "lon": base_lon, "label": "BASE", "type": "base"},
            ]
