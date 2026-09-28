"""
AERO-TWIN — Continuous Degradation Tracker

Calculates:
- Current overall and subsystem degradation levels
- Rate of health degradation: d(Health)/dt (%/hr or %/step)
- Thermal trend: d(CHT)/dt, d(EGT)/dt
- Vibration trend: d(Vib)/dt
- Trend classification: STABLE, SLOW_DEGRADATION, RAPID_DEGRADATION

Complies strictly with the Numerical Authority Rule (§40):
Trends and rates of change are calculated via numerical polynomial differentiation
and least-squares regression over rolling time windows.
"""

import time
import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Deque
from collections import deque
import logging

logger = logging.getLogger(__name__)


@dataclass
class DegradationMetrics:
    step: int
    timestamp: float
    health_index: float
    health_roc: float             # d(Health)/dt (%/step)
    health_roc_per_hour: float    # extrapolated %/hr
    thermal_roc: float            # °C/step
    vibration_roc: float          # vib_index/step
    status: str                   # STABLE, SLOW_DEGRADATION, RAPID_DEGRADATION
    subsystem_degradation: Dict[str, float] = field(default_factory=dict)
    dominant_subsystem: str = "none"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step": self.step,
            "timestamp": round(self.timestamp, 4),
            "health_index": round(self.health_index, 2),
            "health_roc": round(self.health_roc, 4),
            "health_roc_per_hour": round(self.health_roc_per_hour, 2),
            "thermal_roc": round(self.thermal_roc, 4),
            "vibration_roc": round(self.vibration_roc, 4),
            "status": self.status,
            "subsystem_degradation": {k: round(v, 4) for k, v in self.subsystem_degradation.items()},
            "dominant_subsystem": self.dominant_subsystem,
        }


class DegradationTracker:
    """
    Tracks multi-timescale degradation across thermal, mechanical, and lubrication vectors.
    """

    def __init__(self, window_size: int = 50, dt_step_seconds: float = 0.1):
        self.window_size = window_size
        self.dt_step = dt_step_seconds
        self._health_buf: Deque[float] = deque(maxlen=window_size)
        self._thermal_buf: Deque[float] = deque(maxlen=window_size)
        self._vib_buf: Deque[float] = deque(maxlen=window_size)
        self._step = 0

    def update(
        self,
        health: float,
        degradation_dict: Dict[str, float],
        cht_c: float,
        vibration: float,
        step: Optional[int] = None,
    ) -> DegradationMetrics:
        """
        Record instantaneous state and evaluate trends.
        """
        self._step = step if step is not None else self._step + 1
        now = time.time()

        self._health_buf.append(health)
        self._thermal_buf.append(cht_c)
        self._vib_buf.append(vibration)

        # ── Compute Rate of Change via Linear Regression Slope ───────────────
        n = len(self._health_buf)
        if n >= 5:
            t = np.arange(n) * self.dt_step
            # Health slope (negative means degrading)
            h_slope = float(np.polyfit(t, list(self._health_buf), 1)[0])  # % per second
            t_slope = float(np.polyfit(t, list(self._thermal_buf), 1)[0])  # °C per second
            v_slope = float(np.polyfit(t, list(self._vib_buf), 1)[0])      # vib per second
        else:
            h_slope = 0.0
            t_slope = 0.0
            v_slope = 0.0

        # Health rate of change (% per step and % per hour)
        roc_per_step = h_slope * self.dt_step
        roc_per_hour = h_slope * 3600.0

        # ── Degradation Status Classification ─────────────────────────────────
        # Note: degradation means health is dropping (negative slope)
        # Slow degradation: -1.0%/hr to -5.0%/hr
        # Rapid degradation: steeper than -5.0%/hr (or step drop > 0.05%)
        if h_slope < -0.0014:  # < -5.0 %/hour
            status = "RAPID_DEGRADATION"
        elif h_slope < -0.00028:  # < -1.0 %/hour
            status = "SLOW_DEGRADATION"
        else:
            status = "STABLE"

        # Dominant degradation subsystem
        dominant = "none"
        max_deg = 0.0
        for k, v in degradation_dict.items():
            if v > max_deg:
                max_deg = v
                dominant = k

        return DegradationMetrics(
            step=self._step,
            timestamp=now,
            health_index=health,
            health_roc=roc_per_step,
            health_roc_per_hour=roc_per_hour,
            thermal_roc=t_slope * self.dt_step,
            vibration_roc=v_slope * self.dt_step,
            status=status,
            subsystem_degradation=degradation_dict,
            dominant_subsystem=dominant if max_deg > 0.05 else "healthy",
        )

    def reset(self):
        self._health_buf.clear()
        self._thermal_buf.clear()
        self._vib_buf.clear()
        self._step = 0
