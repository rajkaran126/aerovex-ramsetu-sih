"""
AERO-TWIN — Mission Risk Engine

Computes mission risk level (LOW / MEDIUM / HIGH) based on:
- Current RUL vs mission remaining
- Health index
- Fault probabilities
- Thermal margin
- Telemetry integrity
- Degradation rate

DISCLAIMER: This is ADVISORY decision support only.
The human operator is the final authority.
The system NEVER claims "SAFE TO FLY" — only provides RECOMMENDED ACTION.
"""

import numpy as np
from typing import Dict, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


class RiskLevel(str):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


@dataclass
class MissionRiskResult:
    risk_level: str = "LOW"
    risk_score: float = 0.0       # 0–1 continuous risk
    mission_completion_probability: float = 1.0
    rul_margin_hours: float = 0.0  # RUL - mission_remaining (positive = sufficient)
    rul_insufficient: bool = False
    health_concern: bool = False
    thermal_concern: bool = False
    integrity_concern: bool = False
    fault_concern: bool = False
    risk_factors: list = None
    recommended_action: str = "CONTINUE"

    def __post_init__(self):
        if self.risk_factors is None:
            self.risk_factors = []

    def to_dict(self) -> Dict:
        return {
            "risk_level": self.risk_level,
            "risk_score": round(self.risk_score, 3),
            "mission_completion_probability": round(self.mission_completion_probability, 3),
            "rul_margin_hours": round(self.rul_margin_hours, 2),
            "rul_insufficient": self.rul_insufficient,
            "health_concern": self.health_concern,
            "thermal_concern": self.thermal_concern,
            "integrity_concern": self.integrity_concern,
            "fault_concern": self.fault_concern,
            "risk_factors": self.risk_factors,
            "recommended_action": self.recommended_action,
        }


class MissionRiskEngine:
    """
    Computes mission risk from multiple inputs and produces
    a structured risk assessment and recommended action.

    Risk thresholds are configurable.
    """

    def __init__(
        self,
        health_high_risk: float = 40.0,
        health_medium_risk: float = 65.0,
        rul_margin_high_risk: float = -0.5,   # RUL < mission remaining by 30 min
        rul_margin_medium_risk: float = 0.5,   # RUL within 30 min of mission
    ):
        self.health_high_risk = health_high_risk
        self.health_medium_risk = health_medium_risk
        self.rul_margin_high_risk = rul_margin_high_risk
        self.rul_margin_medium_risk = rul_margin_medium_risk

    def assess(
        self,
        health: float,
        rul_median: float,
        rul_lower: float,
        rul_upper: float,
        mission_remaining_hours: float,
        fault_probabilities: Dict[str, float],
        thermal_margin: float,
        telemetry_integrity: float,
        degradation: Dict[str, float],
    ) -> MissionRiskResult:
        """
        Assess mission risk from all available signals.

        Returns MissionRiskResult with risk level and recommended action.
        """
        result = MissionRiskResult()
        risk_factors = []
        risk_contributions = []

        # ── RUL vs Mission Remaining ────────────────────────────────────────
        rul_margin = rul_lower - mission_remaining_hours  # pessimistic margin
        result.rul_margin_hours = rul_margin

        if rul_margin < self.rul_margin_high_risk:
            result.rul_insufficient = True
            risk_factors.append(
                f"RUL lower bound ({rul_lower:.1f}h) < mission remaining ({mission_remaining_hours:.1f}h)"
            )
            risk_contributions.append(0.5)
        elif rul_margin < self.rul_margin_medium_risk:
            risk_factors.append(
                f"RUL margin is narrow ({rul_margin:.1f}h)"
            )
            risk_contributions.append(0.25)
        else:
            risk_contributions.append(0.0)

        # ── Health ─────────────────────────────────────────────────────────
        if health < self.health_high_risk:
            result.health_concern = True
            risk_factors.append(f"Engine health critical: {health:.0f}%")
            risk_contributions.append(0.4)
        elif health < self.health_medium_risk:
            result.health_concern = True
            risk_factors.append(f"Engine health degraded: {health:.0f}%")
            risk_contributions.append(0.2)
        else:
            risk_contributions.append(0.0)

        # ── Thermal margin ─────────────────────────────────────────────────
        if thermal_margin < 10.0:
            result.thermal_concern = True
            risk_factors.append(f"Thermal margin critical: {thermal_margin:.0f}°C below CHT limit")
            risk_contributions.append(0.3)
        elif thermal_margin < 25.0:
            result.thermal_concern = True
            risk_factors.append(f"Thermal margin low: {thermal_margin:.0f}°C below CHT limit")
            risk_contributions.append(0.15)
        else:
            risk_contributions.append(0.0)

        # ── Telemetry integrity ─────────────────────────────────────────────
        if telemetry_integrity < 0.5:
            result.integrity_concern = True
            risk_factors.append(f"Telemetry integrity compromised: {telemetry_integrity:.0%}")
            risk_contributions.append(0.25)
        elif telemetry_integrity < 0.75:
            result.integrity_concern = True
            risk_factors.append(f"Telemetry integrity reduced: {telemetry_integrity:.0%}")
            risk_contributions.append(0.1)
        else:
            risk_contributions.append(0.0)

        # ── Critical fault probability ──────────────────────────────────────
        critical_fault_prob = max(
            fault_probabilities.get("injector", 0.0),
            fault_probabilities.get("cooling", 0.0),
            fault_probabilities.get("lubrication", 0.0),
            fault_probabilities.get("mechanical", 0.0),
            fault_probabilities.get("combustion", 0.0),
        )
        if critical_fault_prob > 0.7:
            result.fault_concern = True
            risk_factors.append(f"High fault probability: {critical_fault_prob:.0%}")
            risk_contributions.append(0.35)
        elif critical_fault_prob > 0.4:
            result.fault_concern = True
            risk_factors.append(f"Elevated fault probability: {critical_fault_prob:.0%}")
            risk_contributions.append(0.15)
        else:
            risk_contributions.append(0.0)

        # ── Rapid degradation ───────────────────────────────────────────────
        deg = degradation
        max_deg = max(deg.get("injector", 0), deg.get("cooling", 0),
                      deg.get("lubrication", 0), deg.get("mechanical", 0),
                      deg.get("combustion", 0))
        if max_deg > 0.7:
            risk_factors.append(f"Advanced degradation: {max_deg:.0%}")
            risk_contributions.append(0.2)
        elif max_deg > 0.4:
            risk_contributions.append(0.1)
        else:
            risk_contributions.append(0.0)

        # ── Aggregate risk score ────────────────────────────────────────────
        risk_score = float(np.clip(sum(risk_contributions), 0.0, 1.0))
        result.risk_score = risk_score
        result.risk_factors = risk_factors

        # ── Risk level classification ───────────────────────────────────────
        if risk_score >= 0.45 or result.rul_insufficient:
            result.risk_level = "HIGH"
        elif risk_score >= 0.20:
            result.risk_level = "MEDIUM"
        else:
            result.risk_level = "LOW"

        # ── Mission completion probability ──────────────────────────────────
        # P(completion) based on RUL distribution vs mission remaining
        if rul_upper <= mission_remaining_hours:
            result.mission_completion_probability = 0.05
        elif rul_lower >= mission_remaining_hours:
            result.mission_completion_probability = 0.95
        else:
            # Interpolate
            span = rul_upper - rul_lower
            if span > 0:
                p = (mission_remaining_hours - rul_lower) / span
                result.mission_completion_probability = float(np.clip(1.0 - p, 0.05, 0.95))
            else:
                result.mission_completion_probability = 0.5

        # ── Recommended action ──────────────────────────────────────────────
        result.recommended_action = self._get_recommendation(result)

        return result

    def _get_recommendation(self, result: MissionRiskResult) -> str:
        """Generate advisory recommendation. Never claims 'safe to fly'."""
        if result.rul_insufficient or (result.risk_level == "HIGH" and result.health_concern):
            return "RETURN TO BASE"
        elif result.risk_level == "HIGH":
            return "MODIFY MISSION"
        elif result.risk_level == "MEDIUM" and result.fault_concern:
            return "MODIFY MISSION"
        elif result.risk_level == "MEDIUM":
            return "CONTINUE WITH MONITORING"
        else:
            return "CONTINUE"
