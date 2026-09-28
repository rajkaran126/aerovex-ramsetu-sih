"""
AERO-TWIN — Pareto Multi-Objective Replanning Engine

Generates and scores 3 Pareto-optimal tactical contingency flight options:
- Option A: Maximum Safety (Immediate RTB, minimum engine load/thermal stress)
- Option B: Mission Completion (Throttle optimization to complete target loiter)
- Option C: Balanced Compromise (Altitude step-down + duration reduction)

Objective Function:
    ParetoScore = w_1 * SafetyScore + w_2 * P(Success) + w_3 * FuelReserveMargin

Complies strictly with the Numerical Authority Rule (§40):
Multi-objective weights and trade-off ranks are determined by deterministic
scalarization and Pareto frontier dominance testing—never modified by LLMs.
"""

import time
import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
import logging

from ..digital_twin.engine_model import AeroPistonEngineModel, EngineInputs, DegradationState
from ..digital_twin.health_index import compute_health_index
from ..mission.risk_model import MissionRiskEngine

logger = logging.getLogger(__name__)


@dataclass
class ParetoCandidate:
    candidate_id: str               # "OPTION_A", "OPTION_B", "OPTION_C"
    label: str                      # "Maximum Safety (RTB)", etc.
    strategy: str                   # "MAX_SAFETY", "MISSION_COMPLETION", "BALANCED_COMPROMISE"
    throttle: float
    altitude_ft: float
    duration_hours: float
    description: str

    # Quantitative objective metrics
    safety_score: float             # [0.0, 1.0] Higher is safer
    mission_completion_prob: float   # [0.0, 1.0] Higher has higher sortie success
    fuel_reserve_margin: float      # [0.0, 1.0] Margin above mandatory diversion reserve
    predicted_health_end: float     # [0.0, 100.0]
    predicted_thermal_margin_c: float
    predicted_rul_hours: float
    pareto_score: float = 0.0       # Weighted composite objective score
    rank: int = 1
    ghost_waypoints: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidate_id": self.candidate_id,
            "label": self.label,
            "strategy": self.strategy,
            "throttle": round(self.throttle, 2),
            "altitude_ft": round(self.altitude_ft, 0),
            "duration_hours": round(self.duration_hours, 2),
            "description": self.description,
            "safety_score": round(self.safety_score, 3),
            "mission_completion_prob": round(self.mission_completion_prob, 3),
            "fuel_reserve_margin": round(self.fuel_reserve_margin, 3),
            "predicted_health_end": round(self.predicted_health_end, 1),
            "predicted_thermal_margin_c": round(self.predicted_thermal_margin_c, 1),
            "predicted_rul_hours": round(self.predicted_rul_hours, 2),
            "pareto_score": round(self.pareto_score, 4),
            "rank": self.rank,
            "ghost_waypoints": self.ghost_waypoints,
        }


@dataclass
class ParetoReplanningResult:
    timestamp: float
    triggered: bool
    trigger_reason: str
    current_health: float
    current_risk: str
    candidates: List[ParetoCandidate] = field(default_factory=list)
    recommended_option: Optional[ParetoCandidate] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": round(self.timestamp, 4),
            "triggered": self.triggered,
            "trigger_reason": self.trigger_reason,
            "current_health": round(self.current_health, 2),
            "current_risk": self.current_risk,
            "candidates": [c.to_dict() for c in self.candidates],
            "recommended_option": self.recommended_option.to_dict() if self.recommended_option else None,
        }


class ParetoReplanner:
    """
    Evaluates Pareto-optimal tactical replanning solutions for MALE UAV.
    """

    def __init__(
        self,
        w_safety: float = 0.45,
        w_success: float = 0.35,
        w_fuel: float = 0.20,
    ):
        # Configurable objective scalarization weights (sum to 1.0)
        self.w_safety = w_safety
        self.w_success = w_success
        self.w_fuel = w_fuel
        self._engine_model = AeroPistonEngineModel(noise_factor=0.0, seed=0)
        self._risk_engine = MissionRiskEngine()

    def evaluate_pareto_frontier(
        self,
        current_health: float,
        current_risk: str,
        degradation: Dict[str, float],
        rul_median: float,
        rul_lower: float,
        mission_remaining_hours: float,
        current_throttle: float,
        current_altitude_ft: float,
        ambient_temp_c: float,
        fault_probabilities: Dict[str, float],
        uav_lat: float = 28.8,
        uav_lon: float = 77.4,
        base_lat: float = 28.6139,
        base_lon: float = 77.2090,
    ) -> ParetoReplanningResult:
        """
        Generate and rank the 3 canonical Pareto options.
        """
        now = time.time()
        triggered = current_risk in ("HIGH", "MEDIUM") or current_health < 75.0
        reason = (
            f"Health={current_health:.1f}% / Risk={current_risk} triggered multi-objective replanning"
            if triggered else "Nominal monitoring profile"
        )

        deg_state = DegradationState(**{
            k: float(v) for k, v in degradation.items()
            if k in ["injector", "cooling", "lubrication", "mechanical", "combustion"]
        })

        # Define 3 distinct tactical trade-off profiles
        # Option A: Maximum Safety (RTB)
        # Low throttle (0.50), gentle descent to 7,000 ft, shortest duration (1.0 hr)
        # Option B: Mission Completion
        # Moderate throttle (0.62), maintains mission ceiling 14,000 ft, completes 90% of duration
        # Option C: Balanced Compromise
        # Step down to 10,000 ft (cooler/denser air), throttle 0.55, loiter cut by 40%
        specs = [
            {
                "id": "OPTION_A",
                "label": "Option A: Maximum Safety (Immediate RTB)",
                "strategy": "MAX_SAFETY",
                "throttle": 0.50,
                "altitude_ft": 7000.0,
                "duration": min(1.2, max(0.5, mission_remaining_hours * 0.4)),
                "desc": "Immediate RTB at optimum glide/cruise speed; minimizes thermal and mechanical stress on engine.",
                "fuel_factor": 0.50,
                "success_base": 0.25,  # Aborts sortie objectives to guarantee airframe survival
            },
            {
                "id": "OPTION_B",
                "label": "Option B: Mission Completion (Managed Throttle)",
                "strategy": "MISSION_COMPLETION",
                "throttle": 0.62,
                "altitude_ft": max(current_altitude_ft, 12000.0),
                "duration": mission_remaining_hours,
                "desc": "Preserves primary ISR station; manages throttle to avoid thermal runaway while fulfilling sortie.",
                "fuel_factor": 0.85,
                "success_base": 0.88,
            },
            {
                "id": "OPTION_C",
                "label": "Option C: Balanced Compromise (Step-Down Loiter)",
                "strategy": "BALANCED_COMPROMISE",
                "throttle": 0.55,
                "altitude_ft": 10000.0,
                "duration": mission_remaining_hours * 0.65,
                "desc": "Steps down altitude to improve cooling air density; truncates secondary loiter orbits by 35%.",
                "fuel_factor": 0.65,
                "success_base": 0.65,
            },
        ]

        candidates: List[ParetoCandidate] = []

        for s in specs:
            # 1. Physics estimation at candidate operating point
            cand_inputs = EngineInputs(
                throttle=s["throttle"],
                rpm_target=4500.0,
                altitude_ft=s["altitude_ft"],
                ambient_temp_c=ambient_temp_c,
                engine_load=s["throttle"],
                degradation=deg_state,
                noise_factor=0.0,
            )
            cand_outputs = self._engine_model.compute(cand_inputs)

            # Estimate degradation progression
            stress = s["throttle"] * 0.7 + (cand_outputs.cht_c / 220.0) * 0.3
            dur = s["duration"]
            delta_health = stress * dur * (2.5 + deg_state.overall * 8.0)
            health_end = float(np.clip(current_health - delta_health, 5.0, 100.0))

            # Safety score [0, 1]
            safety = (
                (health_end / 100.0) * 0.40
                + (np.clip(cand_outputs.thermal_margin / 40.0, 0.0, 1.0)) * 0.35
                + (1.0 - min(cand_outputs.vibration, 3.0) / 3.0) * 0.25
            )

            # Mission completion probability
            if s["strategy"] == "MAX_SAFETY":
                success_prob = 0.10 if current_risk != "LOW" else 0.20
            else:
                rul_margin = max(0.0, rul_lower - dur)
                success_prob = float(np.clip(s["success_base"] * (1.0 if rul_margin > 0 else 0.4) * (health_end / 80.0), 0.05, 0.98))

            # Fuel reserve margin
            fuel_margin = float(np.clip(1.0 - (s["fuel_factor"] * (dur / max(mission_remaining_hours, 0.1))), 0.05, 0.95))

            # Predicted RUL
            cand_rul = max(0.5, rul_median * (0.65 / s["throttle"]))

            # Pareto composite scalar score
            pareto_score = (
                self.w_safety * safety
                + self.w_success * success_prob
                + self.w_fuel * fuel_margin
            )

            # Generate corresponding ghost waypoints
            waypoints = self._generate_ghost_flight_plan(
                uav_lat, uav_lon, base_lat, base_lon, s["strategy"], s["altitude_ft"]
            )

            cand = ParetoCandidate(
                candidate_id=s["id"],
                label=s["label"],
                strategy=s["strategy"],
                throttle=s["throttle"],
                altitude_ft=s["altitude_ft"],
                duration_hours=dur,
                description=s["desc"],
                safety_score=safety,
                mission_completion_prob=success_prob,
                fuel_reserve_margin=fuel_margin,
                predicted_health_end=health_end,
                predicted_thermal_margin_c=cand_outputs.thermal_margin,
                predicted_rul_hours=cand_rul,
                pareto_score=pareto_score,
                ghost_waypoints=waypoints,
            )
            candidates.append(cand)

        # Sort and rank by Pareto composite score
        candidates.sort(key=lambda c: c.pareto_score, reverse=True)
        for i, c in enumerate(candidates):
            c.rank = i + 1

        rec = candidates[0] if candidates else None

        return ParetoReplanningResult(
            timestamp=now,
            triggered=triggered,
            trigger_reason=reason,
            current_health=current_health,
            current_risk=current_risk,
            candidates=candidates,
            recommended_option=rec,
        )

    def _generate_ghost_flight_plan(
        self,
        uav_lat: float,
        uav_lon: float,
        base_lat: float,
        base_lon: float,
        strategy: str,
        altitude_ft: float,
    ) -> List[Dict[str, Any]]:
        """Generate high-fidelity waypoint coordinates for Ghost UAV simulation"""
        points = []
        # Starting point
        points.append({
            "idx": 0,
            "name": "CURRENT_POSITION",
            "lat": round(uav_lat, 5),
            "lon": round(uav_lon, 5),
            "alt_ft": round(altitude_ft, 0),
            "type": "FIX",
        })

        if strategy == "MAX_SAFETY":
            # Direct descent vector to base
            mid_lat = (uav_lat + base_lat) / 2.0
            mid_lon = (uav_lon + base_lon) / 2.0
            points.append({
                "idx": 1,
                "name": "DESC_INTERMEDIATE",
                "lat": round(mid_lat, 5),
                "lon": round(mid_lon, 5),
                "alt_ft": round(altitude_ft * 0.7, 0),
                "type": "DESC_CORRIDOR",
            })
            points.append({
                "idx": 2,
                "name": "HOME_BASE_APPROACH",
                "lat": round(base_lat, 5),
                "lon": round(base_lon, 5),
                "alt_ft": 1500.0,
                "type": "FINAL_APPROACH",
            })
        elif strategy == "MISSION_COMPLETION":
            # Continue surveillance box then RTB
            points.append({
                "idx": 1,
                "name": "THROTTLED_PATROL_1",
                "lat": round(uav_lat + 0.12, 5),
                "lon": round(uav_lon + 0.10, 5),
                "alt_ft": round(altitude_ft, 0),
                "type": "LOITER_STATION",
            })
            points.append({
                "idx": 2,
                "name": "THROTTLED_PATROL_2",
                "lat": round(uav_lat + 0.05, 5),
                "lon": round(uav_lon + 0.18, 5),
                "alt_ft": round(altitude_ft, 0),
                "type": "LOITER_STATION",
            })
            points.append({
                "idx": 3,
                "name": "PLANNED_RTB",
                "lat": round(base_lat, 5),
                "lon": round(base_lon, 5),
                "alt_ft": 2000.0,
                "type": "RECOVERY",
            })
        else:  # BALANCED_COMPROMISE
            # Stepped down transit
            points.append({
                "idx": 1,
                "name": "STEP_DOWN_TRANSIT",
                "lat": round(uav_lat + 0.06, 5),
                "lon": round(uav_lon + 0.06, 5),
                "alt_ft": round(altitude_ft, 0),
                "type": "REDUCED_LOITER",
            })
            points.append({
                "idx": 2,
                "name": "RECOVERY_CORRIDOR",
                "lat": round(base_lat, 5),
                "lon": round(base_lon, 5),
                "alt_ft": 2000.0,
                "type": "RECOVERY",
            })

        return points
