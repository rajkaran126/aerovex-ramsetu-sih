"""
AERO-TWIN — Digital Twin State Estimator

Maintains actual vs expected engine state and computes residuals.
The expected state is calculated from the reduced-order physics model
using the CURRENT operating conditions but with ZERO degradation.

residual = actual - expected

A large residual indicates the engine is deviating from its healthy
physics-based expectation, which may indicate fault or degradation.
"""

import numpy as np
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Deque
from collections import deque
import time
import logging

from .engine_model import (
    AeroPistonEngineModel,
    EngineInputs,
    EngineOutputs,
    DegradationState,
)

logger = logging.getLogger(__name__)

HISTORY_LEN = 300  # timesteps to keep for rolling stats


@dataclass
class ResidualState:
    rpm: float = 0.0
    egt_c: float = 0.0
    cht_c: float = 0.0
    oil_temp_c: float = 0.0
    oil_pressure_bar: float = 0.0
    fuel_flow_lph: float = 0.0
    vibration: float = 0.0

    def magnitude(self) -> float:
        """Composite residual magnitude (normalized)"""
        return np.sqrt(
            (self.rpm / 5800) ** 2
            + (self.egt_c / 720) ** 2
            + (self.cht_c / 200) ** 2
            + (self.oil_temp_c / 95) ** 2
            + (self.oil_pressure_bar / 4.8) ** 2
            + (self.fuel_flow_lph / 25) ** 2
            + (self.vibration / 1.0) ** 2
        ) / np.sqrt(7)

    def to_dict(self) -> Dict[str, float]:
        return {
            "rpm": round(self.rpm, 2),
            "egt_c": round(self.egt_c, 2),
            "cht_c": round(self.cht_c, 2),
            "oil_temp_c": round(self.oil_temp_c, 2),
            "oil_pressure_bar": round(self.oil_pressure_bar, 4),
            "fuel_flow_lph": round(self.fuel_flow_lph, 3),
            "vibration": round(self.vibration, 4),
            "magnitude": round(self.magnitude(), 4),
        }


@dataclass
class TwinState:
    timestamp: float = 0.0
    step: int = 0

    # Actual engine outputs (from simulator with degradation + noise)
    actual: Dict[str, float] = field(default_factory=dict)

    # Expected engine outputs (from model with ZERO degradation)
    expected: Dict[str, float] = field(default_factory=dict)

    # Residuals
    residual: Dict[str, float] = field(default_factory=dict)

    # Health index 0–100
    health_index: float = 100.0

    # Degradation state
    degradation: Dict[str, float] = field(default_factory=dict)

    # Confidence
    twin_confidence: float = 1.0


class StateEstimator:
    """
    Digital Twin State Estimator

    Maintains rolling history and computes:
    - Expected state (healthy physics baseline)
    - Residuals (actual - expected)
    - Health index
    - Rolling statistics for anomaly features
    """

    # Healthy engine model (zero degradation) for expected state
    _healthy_model = AeroPistonEngineModel(noise_factor=0.0, seed=0)

    def __init__(self, history_len: int = HISTORY_LEN):
        self.history_len = history_len
        self._history: Deque[TwinState] = deque(maxlen=history_len)
        self._step = 0

    def update(
        self,
        actual_outputs: EngineOutputs,
        inputs: EngineInputs,
        health: float,
    ) -> TwinState:
        """
        Compute twin state from actual engine outputs and current inputs.

        The expected state is computed from the same inputs but with zero
        degradation — representing what a healthy engine would produce.
        """
        self._step += 1

        # ── Compute expected state ───────────────────────────────────────────
        healthy_inputs = EngineInputs(
            throttle=inputs.throttle,
            rpm_target=inputs.rpm_target,
            altitude_ft=inputs.altitude_ft,
            ambient_temp_c=inputs.ambient_temp_c,
            engine_load=inputs.engine_load,
            degradation=DegradationState(),  # ZERO degradation
            noise_factor=0.0,               # no noise for expected
        )
        expected_outputs = self._healthy_model.compute(healthy_inputs)

        actual_d = actual_outputs.to_dict()
        expected_d = expected_outputs.to_dict()

        # ── Compute residuals ────────────────────────────────────────────────
        keys = ["rpm", "egt_c", "cht_c", "oil_temp_c", "oil_pressure_bar",
                "fuel_flow_lph", "vibration"]
        residual = ResidualState()
        for k in keys:
            setattr(residual, k, actual_d.get(k, 0) - expected_d.get(k, 0))

        state = TwinState(
            timestamp=time.time(),
            step=self._step,
            actual=actual_d,
            expected=expected_d,
            residual=residual.to_dict(),
            health_index=round(health, 2),
            degradation=inputs.degradation.to_dict(),
            twin_confidence=1.0,
        )
        self._history.append(state)
        return state

    def get_rolling_features(self, window: int = 20) -> Dict[str, float]:
        """
        Compute rolling statistics over recent history for AI features.
        Returns mean, std, and rate-of-change for key parameters.
        """
        if len(self._history) < 2:
            return {}

        recent = list(self._history)[-min(window, len(self._history)):]
        features: Dict[str, float] = {}
        keys = ["rpm", "egt_c", "cht_c", "oil_temp_c", "oil_pressure_bar",
                "fuel_flow_lph", "vibration"]

        for k in keys:
            vals = [s.actual.get(k, 0.0) for s in recent]
            features[f"{k}_mean"] = float(np.mean(vals))
            features[f"{k}_std"] = float(np.std(vals))
            if len(vals) >= 2:
                features[f"{k}_roc"] = float(vals[-1] - vals[-2])
            else:
                features[f"{k}_roc"] = 0.0

            res_vals = [s.residual.get(k, 0.0) for s in recent]
            features[f"{k}_res_mean"] = float(np.mean(res_vals))
            features[f"{k}_res_abs"] = float(np.mean(np.abs(res_vals)))

        return features

    def get_history(self, n: int = 100) -> List[Dict]:
        """Return last n twin states as dicts"""
        recent = list(self._history)[-n:]
        return [
            {
                "timestamp": s.timestamp,
                "step": s.step,
                "health_index": s.health_index,
                "actual": s.actual,
                "expected": s.expected,
                "residual": s.residual,
                "degradation": s.degradation,
            }
            for s in recent
        ]
