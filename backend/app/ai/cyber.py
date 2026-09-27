"""
AERO-TWIN — Cyber / Telemetry Integrity Detection

This module performs DEFENSIVE telemetry integrity analysis.
It does NOT perform any offensive cybersecurity functions.

The system evaluates incoming telemetry for:
1. Cross-sensor consistency (physics-based plausibility checks)
2. Temporal consistency (frozen values, sudden jumps)
3. Physics consistency (impossible/implausible values)
4. Statistical anomaly (residual magnitude vs expected)
5. Sensor dropout detection

Returns per-sensor confidence scores and overall telemetry integrity score.

When a sensor is flagged as unreliable, the Digital Twin provides an
estimated replacement value (sensor self-healing).

CLASSIFICATION:
- NORMAL TELEMETRY
- SENSOR FAILURE (frozen/dropout)
- SENSOR DRIFT
- DATA ANOMALY (single sensor spike)
- SUSPICIOUS TELEMETRY (cross-sensor inconsistency)
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from collections import deque
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)

SENSOR_KEYS = ["rpm", "egt_c", "cht_c", "oil_temp_c", "oil_pressure_bar",
               "fuel_flow_lph", "vibration"]

# Physics-based reasonable ranges for sensor values
SENSOR_RANGES = {
    "rpm": (400, 6500),
    "egt_c": (100, 1000),
    "cht_c": (20, 280),
    "oil_temp_c": (10, 160),
    "oil_pressure_bar": (0.0, 8.0),
    "fuel_flow_lph": (0.0, 50.0),
    "vibration": (0.0, 10.0),
}

# Freeze detection: if std of last N samples is below this, sensor is frozen
FREEZE_STD_THRESHOLD = {
    "rpm": 0.1,
    "egt_c": 0.05,
    "cht_c": 0.05,
    "oil_temp_c": 0.02,
    "oil_pressure_bar": 0.001,
    "fuel_flow_lph": 0.01,
    "vibration": 0.001,
}

FREEZE_WINDOW = 15  # steps to check for freeze

# Max physically plausible rate-of-change per second
MAX_ROC_PER_STEP = {
    "rpm": 500.0,
    "egt_c": 50.0,
    "cht_c": 20.0,
    "oil_temp_c": 10.0,
    "oil_pressure_bar": 2.0,
    "fuel_flow_lph": 5.0,
    "vibration": 3.0,
}


@dataclass
class SensorStatus:
    sensor: str
    confidence: float = 1.0         # 0 = unreliable, 1 = trusted
    is_frozen: bool = False
    is_out_of_range: bool = False
    has_spike: bool = False
    is_drifting: bool = False
    is_dropout: bool = False
    reason: str = ""
    twin_estimate: Optional[float] = None
    using_twin_estimate: bool = False


@dataclass
class TelemetryIntegrityResult:
    timestamp: float = 0.0
    telemetry_integrity_score: float = 1.0   # 0–1
    cyber_anomaly_score: float = 0.0          # 0–1
    overall_classification: str = "NORMAL TELEMETRY"
    telemetry_verdict: str = "NORMAL TELEMETRY"
    is_cyber_anomaly: bool = False
    is_physical_fault: bool = False
    sensor_statuses: Dict[str, SensorStatus] = field(default_factory=dict)
    affected_sensors: List[str] = field(default_factory=list)
    anomaly_reasons: List[str] = field(default_factory=list)
    physics_cross_checks: Dict[str, Dict] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        statuses = {}
        for k, v in self.sensor_statuses.items():
            statuses[k] = {
                "confidence": round(v.confidence, 3),
                "is_frozen": v.is_frozen,
                "is_out_of_range": v.is_out_of_range,
                "has_spike": v.has_spike,
                "is_drifting": v.is_drifting,
                "is_dropout": v.is_dropout,
                "reason": v.reason,
                "twin_estimate": v.twin_estimate,
                "using_twin_estimate": v.using_twin_estimate,
            }
        return {
            "telemetry_integrity_score": round(self.telemetry_integrity_score, 3),
            "cyber_anomaly_score": round(self.cyber_anomaly_score, 3),
            "overall_classification": self.overall_classification,
            "telemetry_verdict": self.telemetry_verdict,
            "is_cyber_anomaly": self.is_cyber_anomaly,
            "is_physical_fault": self.is_physical_fault,
            "sensor_statuses": statuses,
            "affected_sensors": self.affected_sensors,
            "anomaly_reasons": self.anomaly_reasons,
            "physics_cross_checks": self.physics_cross_checks,
        }


class TelemetryIntegrityMonitor:
    """
    Monitors telemetry stream for integrity violations.

    Implements purely DEFENSIVE checks:
    - No offensive cybersecurity functionality
    - Evaluates data quality and sensor reliability
    - Provides twin-based sensor estimation when sensors are unreliable
    """

    def __init__(self, history_len: int = 50):
        self._history: Dict[str, deque] = {k: deque(maxlen=history_len) for k in SENSOR_KEYS}
        self._drift_baseline: Dict[str, Optional[float]] = {k: None for k in SENSOR_KEYS}
        self._step = 0

    def analyze(
        self,
        actual: Dict[str, float],
        expected: Dict[str, float],
        residual: Dict[str, float],
    ) -> TelemetryIntegrityResult:
        """
        Analyze telemetry integrity for the current timestep.

        Parameters
        ----------
        actual : dict — raw sensor readings
        expected : dict — digital twin expected values
        residual : dict — actual - expected
        """
        self._step += 1
        result = TelemetryIntegrityResult()
        result.timestamp = float(self._step)

        issues: List[str] = []
        low_confidence_sensors: List[str] = []

        for sensor in SENSOR_KEYS:
            value = actual.get(sensor, None)
            exp_value = expected.get(sensor, None)
            res_value = residual.get(sensor, 0.0)

            status = SensorStatus(sensor=sensor, confidence=1.0)

            if value is None or not np.isfinite(value):
                # Dropout
                status.is_dropout = True
                status.confidence = 0.0
                status.reason = "Signal dropout / NaN"
                status.using_twin_estimate = True
                status.twin_estimate = exp_value
                issues.append(f"{sensor.upper()} DROPOUT")
            else:
                self._history[sensor].append(value)

                # ── Out of range ──────────────────────────────────────────────
                lo, hi = SENSOR_RANGES.get(sensor, (-1e9, 1e9))
                if not (lo <= value <= hi):
                    status.is_out_of_range = True
                    status.confidence -= 0.6
                    status.reason = f"Value {value:.1f} outside physical range [{lo}, {hi}]"
                    issues.append(f"{sensor.upper()} OUT OF RANGE")

                # ── Frozen sensor ──────────────────────────────────────────────
                if len(self._history[sensor]) >= FREEZE_WINDOW:
                    recent = list(self._history[sensor])[-FREEZE_WINDOW:]
                    std = np.std(recent)
                    threshold = FREEZE_STD_THRESHOLD.get(sensor, 0.01)
                    if std < threshold and exp_value is not None:
                        # Only flag as frozen if expected value is changing
                        exp_recent = [exp_value]  # simplified
                        if abs(value - exp_value) > 2.0:  # frozen at wrong value
                            status.is_frozen = True
                            status.confidence -= 0.5
                            status.reason = f"Sensor appears frozen (std={std:.4f} < {threshold})"
                            issues.append(f"{sensor.upper()} FROZEN")
                            status.using_twin_estimate = True
                            status.twin_estimate = exp_value

                # ── Spike detection ───────────────────────────────────────────
                if len(self._history[sensor]) >= 3:
                    hist = list(self._history[sensor])
                    max_roc = MAX_ROC_PER_STEP.get(sensor, 1000.0)
                    roc = abs(hist[-1] - hist[-2]) if len(hist) >= 2 else 0
                    if roc > max_roc:
                        status.has_spike = True
                        status.confidence -= 0.4
                        status.reason = (
                            f"Sudden change of {roc:.1f} exceeds physical limit {max_roc}"
                        )
                        issues.append(f"{sensor.upper()} SPIKE")
                        status.using_twin_estimate = True
                        status.twin_estimate = exp_value

                # ── Cross-sensor physics consistency ─────────────────────────
                # EGT inconsistency: EGT should correlate with CHT and fuel_flow
                if sensor == "egt_c" and exp_value is not None:
                    abs_res = abs(res_value)
                    if abs_res > 150:   # large EGT residual
                        # Check if other sensors are consistent with this EGT
                        cht = actual.get("cht_c", 0)
                        expected_cht = expected.get("cht_c", 0)
                        cht_res = abs(cht - expected_cht) if expected_cht else 0

                        if cht_res < 20:  # CHT is normal but EGT is anomalous
                            # This is a cross-sensor inconsistency → suspect EGT sensor
                            status.confidence -= 0.45
                            if not status.reason:
                                status.reason = (
                                    f"EGT residual {abs_res:.0f}°C but CHT is normal "
                                    f"→ suspect EGT sensor"
                                )
                            issues.append("EGT-CHT CROSS-SENSOR INCONSISTENCY")
                            status.using_twin_estimate = True
                            status.twin_estimate = exp_value

                # ── Drift detection ───────────────────────────────────────────
                if len(self._history[sensor]) >= 20 and exp_value is not None:
                    hist = np.array(list(self._history[sensor])[-20:])
                    # Fit linear trend
                    t = np.arange(len(hist))
                    slope = np.polyfit(t, hist, 1)[0]
                    exp_slope = 0.0  # assume expected is roughly stable for drift check

                    if abs(slope) > 2.0 * MAX_ROC_PER_STEP.get(sensor, 1000.0) / 20:
                        status.is_drifting = True
                        status.confidence -= 0.2
                        if not status.reason:
                            status.reason = f"Sensor drift detected (slope={slope:.3f}/step)"
                        issues.append(f"{sensor.upper()} DRIFT")

                # Clamp confidence
                status.confidence = float(np.clip(status.confidence, 0.0, 1.0))

                # If confidence low, use twin estimate
                if status.confidence < 0.5 and not status.using_twin_estimate and exp_value is not None:
                    status.using_twin_estimate = True
                    status.twin_estimate = exp_value

            result.sensor_statuses[sensor] = status

            if status.confidence < 0.7:
                low_confidence_sensors.append(sensor)

        result.affected_sensors = list(set(low_confidence_sensors))
        result.anomaly_reasons = list(set(issues))

        # ── Physics-based Cross-Validation Checks ─────────────────────────────
        egt_res = abs(residual.get("egt_c", 0.0))
        cht_res = abs(residual.get("cht_c", 0.0))
        oil_p_res = abs(residual.get("oil_pressure_bar", 0.0))
        oil_t_res = abs(residual.get("oil_temp_c", 0.0))
        ff_res = abs(residual.get("fuel_flow_lph", 0.0))
        rpm_res = abs(residual.get("rpm", 0.0))

        # Check 1: EGT vs CHT Thermal Mass Coupling
        egt_cht_valid = not (egt_res > 90.0 and cht_res < 15.0)
        # Check 2: Oil Viscosity & Hydrodynamic Film Balance
        oil_coupling_valid = not (oil_p_res > 1.8 and oil_t_res < 5.0)
        # Check 3: Fuel Flow vs RPM Conservation of Energy
        fuel_rpm_valid = not (ff_res > 8.0 and rpm_res < 80.0)

        result.physics_cross_checks = {
            "thermal_coupling": {
                "name": "EGT ↔ CHT Thermal Inertia Coupling",
                "valid": bool(egt_cht_valid),
                "detail": "Consistent" if egt_cht_valid else f"EGT residual {egt_res:.1f}°C isolated without CHT rise ({cht_res:.1f}°C)",
            },
            "lubrication_dynamics": {
                "name": "Oil Pressure ↔ Temperature Viscosity",
                "valid": bool(oil_coupling_valid),
                "detail": "Consistent" if oil_coupling_valid else "Pressure drop without thermal signature",
            },
            "mass_energy_balance": {
                "name": "Fuel Flow ↔ RPM Thermodynamic Law",
                "valid": bool(fuel_rpm_valid),
                "detail": "Consistent" if fuel_rpm_valid else "Fuel flow deviation violates mechanical power balance",
            },
        }

        # ── Compute aggregate scores ─────────────────────────────────────────
        confidences = [s.confidence for s in result.sensor_statuses.values()]
        result.telemetry_integrity_score = float(np.mean(confidences))

        n_issues = len(result.affected_sensors)
        result.cyber_anomaly_score = float(np.clip(n_issues / len(SENSOR_KEYS), 0.0, 1.0))

        # Multi-sensor coupled physical fault signature
        is_coupled_physical = (egt_res > 40.0 and cht_res > 12.0) or (oil_p_res > 0.8 and oil_t_res > 8.0)
        is_isolated_violation = not egt_cht_valid or not oil_coupling_valid or not fuel_rpm_valid or any("SPIKE" in r or "FROZEN" in r for r in result.anomaly_reasons)

        result.is_physical_fault = bool(is_coupled_physical and not is_isolated_violation)
        result.is_cyber_anomaly = bool(is_isolated_violation or (n_issues > 0 and not is_coupled_physical))

        # ── Overall classification & Verdict ──────────────────────────────────
        if n_issues == 0 and not is_isolated_violation:
            result.overall_classification = "NORMAL TELEMETRY"
            result.telemetry_verdict = "NORMAL TELEMETRY (AUTHENTIC)"
        elif result.is_physical_fault:
            result.overall_classification = "PHYSICAL ENGINE DEGRADATION"
            result.telemetry_verdict = "AUTHENTIC ENGINE HARDWARE FAULT"
        elif any("DROPOUT" in r for r in result.anomaly_reasons):
            result.overall_classification = "SENSOR FAILURE"
            result.telemetry_verdict = "SENSOR HARDWARE FAILURE (DROPOUT)"
        elif any("FROZEN" in r for r in result.anomaly_reasons):
            result.overall_classification = "SUSPICIOUS TELEMETRY"
            result.telemetry_verdict = "CYBER ANOMALY (FROZEN ADC / TELEMETRY TAMPERING)"
        elif result.is_cyber_anomaly:
            result.overall_classification = "SUSPICIOUS TELEMETRY"
            result.telemetry_verdict = "CYBER ANOMALY (MANIPULATED / SPOOFED TELEMETRY)"
        else:
            result.overall_classification = "DATA ANOMALY"
            result.telemetry_verdict = "DATA ANOMALY"

        return result


    def get_corrected_telemetry(
        self,
        actual: Dict[str, float],
        integrity_result: TelemetryIntegrityResult,
    ) -> Dict[str, float]:
        """
        Return corrected telemetry where unreliable sensors are replaced
        by digital twin estimates. Used for AI pipeline when sensor confidence is low.
        """
        corrected = dict(actual)
        for sensor, status in integrity_result.sensor_statuses.items():
            if status.using_twin_estimate and status.twin_estimate is not None:
                corrected[sensor] = status.twin_estimate
        return corrected

    def reset(self) -> None:
        for k in self._history:
            self._history[k].clear()
        self._drift_baseline = {k: None for k in SENSOR_KEYS}
        self._step = 0
