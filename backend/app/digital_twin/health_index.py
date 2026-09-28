"""
AERO-TWIN — Engine Health Index Calculator

Computes a transparent 0–100 health index from multiple indicators:
- Residual magnitude (deviation from expected state)
- Degradation state (weighted)
- Anomaly score contribution
- Thermal margin
- Vibration condition
- Lubrication condition

Thresholds are configurable via Settings.
"""

import numpy as np
from dataclasses import dataclass
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class HealthConfig:
    """Configurable health scoring thresholds and weights per §38 Master Implementation Spec"""
    # Master thresholds: >85 Healthy, 60-85 Caution, <60 Critical
    healthy_min: float = 85.0
    caution_min: float = 60.0
    critical_threshold: float = 60.0

    # Backwards compatibility fields
    degraded_min: float = 60.0
    warning_min: float = 40.0
    critical_min: float = 20.0

    # Component weights (must sum to 1.0)
    w_residual: float = 0.25
    w_degradation: float = 0.30
    w_thermal: float = 0.20
    w_vibration: float = 0.15
    w_lubrication: float = 0.10

    def health_label(self, health: float) -> str:
        if health > self.healthy_min:
            return "HEALTHY"
        elif health >= self.caution_min:
            return "CAUTION"
        elif health >= 30.0:
            return "CRITICAL"
        else:
            return "SEVERE"

    def health_color(self, health: float) -> str:
        label = self.health_label(health)
        colors = {
            "HEALTHY": "#00ff88",
            "CAUTION": "#ffcc00",
            "DEGRADED": "#ffcc00",
            "WARNING": "#ff8800",
            "CRITICAL": "#ff3300",
            "SEVERE": "#cc0000",
        }
        return colors.get(label, "#ffffff")


DEFAULT_CONFIG = HealthConfig()

# Reference limits for health scoring
CHT_LIMIT = 220.0     # °C
EGT_LIMIT = 850.0     # °C
VIB_LIMIT = 3.0       # vibration index
OIL_PRES_MIN = 2.5    # bar


def compute_health_index(
    residual_magnitude: float,
    degradation: Dict[str, float],
    thermal_margin: float,
    vibration: float,
    oil_pressure: float,
    anomaly_score: float = 0.0,
    config: HealthConfig = DEFAULT_CONFIG,
) -> float:
    """
    Compute 0–100 health index from multiple signals.

    Parameters
    ----------
    residual_magnitude : float
        Normalized residual magnitude 0–1 from state estimator
    degradation : dict
        Degradation state dict with keys: injector, cooling, lubrication,
        mechanical, combustion; each 0–1
    thermal_margin : float
        Degrees below CHT limit (negative = over limit)
    vibration : float
        Current vibration index
    oil_pressure : float
        Current oil pressure bar
    anomaly_score : float
        AI anomaly score 0–1
    config : HealthConfig
        Scoring configuration

    Returns
    -------
    float
        Health index 0–100
    """
    # ── Residual component ──────────────────────────────────────────────────
    # Maps residual 0→1 to health_contribution 1→0
    residual_health = 1.0 - np.clip(residual_magnitude * 3.0, 0.0, 1.0)

    # ── Degradation component ───────────────────────────────────────────────
    injector = degradation.get("injector", 0.0)
    cooling = degradation.get("cooling", 0.0)
    lubrication = degradation.get("lubrication", 0.0)
    mechanical = degradation.get("mechanical", 0.0)
    combustion = degradation.get("combustion", 0.0)

    weighted_deg = (
        0.30 * injector
        + 0.20 * cooling
        + 0.20 * lubrication
        + 0.20 * mechanical
        + 0.10 * combustion
    )
    degradation_health = 1.0 - np.clip(weighted_deg, 0.0, 1.0)

    # ── Thermal component ───────────────────────────────────────────────────
    # thermal_margin > 30 → full health contribution
    # thermal_margin = 0 → at limit
    # thermal_margin < 0 → over limit
    thermal_health = np.clip(thermal_margin / 50.0, 0.0, 1.0)

    # ── Vibration component ─────────────────────────────────────────────────
    vib_health = np.clip(1.0 - (vibration - 1.0) / (VIB_LIMIT - 1.0), 0.0, 1.0)

    # ── Lubrication/oil pressure component ─────────────────────────────────
    oil_health = np.clip((oil_pressure - OIL_PRES_MIN) / (4.8 - OIL_PRES_MIN), 0.0, 1.0)

    # ── Weighted sum ────────────────────────────────────────────────────────
    total_health = (
        config.w_residual * residual_health
        + config.w_degradation * degradation_health
        + config.w_thermal * thermal_health
        + config.w_vibration * vib_health
        + config.w_lubrication * oil_health
    )

    # Anomaly score penalty (up to 10 points)
    anomaly_penalty = anomaly_score * 10.0

    health_index = total_health * 100.0 - anomaly_penalty
    return float(np.clip(health_index, 0.0, 100.0))


def health_breakdown(
    residual_magnitude: float,
    degradation: Dict[str, float],
    thermal_margin: float,
    vibration: float,
    oil_pressure: float,
    anomaly_score: float = 0.0,
) -> Dict[str, float]:
    """Return individual health component contributions"""
    residual_health = 1.0 - np.clip(residual_magnitude * 3.0, 0.0, 1.0)

    injector = degradation.get("injector", 0.0)
    cooling = degradation.get("cooling", 0.0)
    lubrication = degradation.get("lubrication", 0.0)
    mechanical = degradation.get("mechanical", 0.0)
    combustion = degradation.get("combustion", 0.0)
    weighted_deg = 0.30*injector + 0.20*cooling + 0.20*lubrication + 0.20*mechanical + 0.10*combustion
    degradation_health = 1.0 - np.clip(weighted_deg, 0.0, 1.0)

    thermal_health = np.clip(thermal_margin / 50.0, 0.0, 1.0)
    vib_health = np.clip(1.0 - (vibration - 1.0) / (VIB_LIMIT - 1.0), 0.0, 1.0)
    oil_health = np.clip((oil_pressure - OIL_PRES_MIN) / (4.8 - OIL_PRES_MIN), 0.0, 1.0)

    return {
        "residual_health": round(residual_health * 100, 1),
        "degradation_health": round(degradation_health * 100, 1),
        "thermal_health": round(thermal_health * 100, 1),
        "vibration_health": round(vib_health * 100, 1),
        "oil_health": round(oil_health * 100, 1),
        "anomaly_penalty": round(anomaly_score * 10, 1),
    }
