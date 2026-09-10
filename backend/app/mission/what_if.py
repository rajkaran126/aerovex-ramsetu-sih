"""
AERO-TWIN — What-If Simulation Engine

Allows operators to interactively change mission parameters and run
a forward simulation to see predicted outcomes.

Evaluates a candidate what-if scenario against the current profile.
"""

import numpy as np
from typing import Dict, Optional
from dataclasses import dataclass
import logging

from ..digital_twin.engine_model import AeroPistonEngineModel, EngineInputs, DegradationState
from ..digital_twin.health_index import compute_health_index
from .risk_model import MissionRiskEngine

logger = logging.getLogger(__name__)


@dataclass
class WhatIfRequest:
    throttle: float = 0.65
    altitude_ft: float = 10000.0
    ambient_temp_c: float = 15.0
    mission_duration_hours: float = 4.0
    mission_remaining_hours: float = 3.0
    degradation: Dict = None

    def __post_init__(self):
        if self.degradation is None:
            self.degradation = {}


@dataclass
class WhatIfResult:
    scenario_label: str = "What-If"
    throttle: float = 0.65
    altitude_ft: float = 10000.0
    ambient_temp_c: float = 15.0
    mission_remaining_hours: float = 3.0

    predicted_health: float = 0.0
    predicted_rul_hours: float = 0.0
    predicted_risk: str = "LOW"
    mission_completion_probability: float = 0.0
    predicted_thermal_margin: float = 0.0
    predicted_egt: float = 0.0
    predicted_cht: float = 0.0
    predicted_oil_temp: float = 0.0
    predicted_power_kw: float = 0.0
    recommended_action: str = "CONTINUE"
    comparison_note: str = ""

    def to_dict(self) -> Dict:
        return {
            "scenario_label": self.scenario_label,
            "throttle": round(self.throttle, 3),
            "altitude_ft": round(self.altitude_ft, 0),
            "ambient_temp_c": round(self.ambient_temp_c, 1),
            "mission_remaining_hours": round(self.mission_remaining_hours, 2),
            "predicted_health": round(self.predicted_health, 1),
            "predicted_rul_hours": round(self.predicted_rul_hours, 2),
            "predicted_risk": self.predicted_risk,
            "mission_completion_probability": round(self.mission_completion_probability, 3),
            "predicted_thermal_margin": round(self.predicted_thermal_margin, 1),
            "predicted_egt": round(self.predicted_egt, 1),
            "predicted_cht": round(self.predicted_cht, 1),
            "predicted_oil_temp": round(self.predicted_oil_temp, 1),
            "predicted_power_kw": round(self.predicted_power_kw, 2),
            "recommended_action": self.recommended_action,
            "comparison_note": self.comparison_note,
        }


class WhatIfSimulator:
    """
    Interactive What-If simulator.

    Given a scenario, runs the digital twin forward and returns
    predicted engine state, health, RUL, and mission risk.
    """

    def __init__(self):
        self._model = AeroPistonEngineModel(noise_factor=0.0, seed=0)
        self._risk_engine = MissionRiskEngine()

    def simulate(
        self,
        request: WhatIfRequest,
        current_health: float,
        current_fault_probabilities: Dict[str, float],
        current_rul_lower: float,
        scenario_label: str = "What-If",
    ) -> WhatIfResult:
        """
        Forward-simulate the engine under a what-if scenario.
        """
        result = WhatIfResult(
            scenario_label=scenario_label,
            throttle=request.throttle,
            altitude_ft=request.altitude_ft,
            ambient_temp_c=request.ambient_temp_c,
            mission_remaining_hours=request.mission_remaining_hours,
        )

        # Build degradation state
        deg = DegradationState()
        for k, v in request.degradation.items():
            if hasattr(deg, k):
                setattr(deg, k, float(np.clip(v, 0.0, 1.0)))

        inputs = EngineInputs(
            throttle=request.throttle,
            rpm_target=4600 + request.throttle * 1200,
            altitude_ft=request.altitude_ft,
            ambient_temp_c=request.ambient_temp_c,
            engine_load=request.throttle * 0.95,
            degradation=deg,
            noise_factor=0.0,
        )

        # Compute instantaneous engine state
        outputs = self._model.compute(inputs)

        result.predicted_egt = outputs.egt_c
        result.predicted_cht = outputs.cht_c
        result.predicted_oil_temp = outputs.oil_temp_c
        result.predicted_power_kw = outputs.power_kw
        result.predicted_thermal_margin = outputs.thermal_margin

        # Forward-project health over mission duration
        deg_overall = (
            0.3 * deg.injector + 0.2 * deg.cooling
            + 0.2 * deg.lubrication + 0.2 * deg.mechanical + 0.1 * deg.combustion
        )
        load_stress = request.throttle
        health_decay_rate = 0.5 * (1 + deg_overall * 3) * load_stress
        predicted_health = max(0.0, current_health - health_decay_rate * request.mission_remaining_hours)
        result.predicted_health = predicted_health

        # Estimate RUL based on health projection
        if health_decay_rate > 0:
            hours_to_eol = max(0.0, (current_health - 20.0) / health_decay_rate)
            result.predicted_rul_hours = min(hours_to_eol, 500.0)
        else:
            result.predicted_rul_hours = min(current_rul_lower * 1.1, 500.0)

        rul_lower = result.predicted_rul_hours * 0.75
        rul_upper = result.predicted_rul_hours * 1.25

        # Assess risk for this scenario
        risk = self._risk_engine.assess(
            health=predicted_health,
            rul_median=result.predicted_rul_hours,
            rul_lower=rul_lower,
            rul_upper=rul_upper,
            mission_remaining_hours=request.mission_remaining_hours,
            fault_probabilities=current_fault_probabilities,
            thermal_margin=outputs.thermal_margin,
            telemetry_integrity=1.0,
            degradation=request.degradation,
        )

        result.predicted_risk = risk.risk_level
        result.mission_completion_probability = risk.mission_completion_probability
        result.recommended_action = risk.recommended_action

        return result

    def compare(
        self,
        current: WhatIfResult,
        alternative: WhatIfResult,
    ) -> str:
        """Generate a comparison note between two scenarios"""
        notes = []

        rul_diff = alternative.predicted_rul_hours - current.predicted_rul_hours
        if rul_diff > 0.2:
            notes.append(f"Predicted RUL improves by {rul_diff:.1f}h")
        elif rul_diff < -0.2:
            notes.append(f"Predicted RUL decreases by {abs(rul_diff):.1f}h")

        health_diff = alternative.predicted_health - current.predicted_health
        if abs(health_diff) > 2.0:
            direction = "improves" if health_diff > 0 else "decreases"
            notes.append(f"End-of-mission health {direction} by {abs(health_diff):.0f}%")

        if alternative.predicted_risk != current.predicted_risk:
            notes.append(f"Risk changes from {current.predicted_risk} → {alternative.predicted_risk}")

        thermal_diff = alternative.predicted_thermal_margin - current.predicted_thermal_margin
        if thermal_diff > 5:
            notes.append(f"Thermal margin improves by {thermal_diff:.0f}°C")

        if not notes:
            notes.append("Similar predicted performance")

        return " | ".join(notes)
