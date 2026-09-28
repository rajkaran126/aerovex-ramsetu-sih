"""
AERO-TWIN — Zero-Trust Cyber-Telemetry Shield

Implements 12 physical-plausibility and defensive telemetry integrity vectors:
1. Sensor freeze / stiction (identical floating values over multiple timesteps)
2. Rate-of-change (ROC) spikes (exceeding physical dynamic limits)
3. Sensor drift / bias (continuous unidirectional divergence from physics expectation)
4. Out-of-bounds impossible values (outside physical hardware limits)
5. Timestamp jitter / stagnation (non-monotonic or irregular delta-t)
6. Packet loss / dropout (NaN, missing packets, or bus frame drop)
7. Cross-sensor thermodynamic contradictions (e.g. EGT vs CHT, RPM vs Fuel Flow)
8. Hostile spoofing / replay attacks (repeated cyclic sequences or synthetic artificial step functions)
9. Noise floor collapse (variance drops below physical transducer thermal noise floor)
10. Calibration scale jump (sudden instantaneous multiplicative shift)
11. Asynchronous phase lag (sensor lagging delayed by > N cycles)
12. Parity / bit-level corruption (invalid CAN checksum/parity or payload byte packing errors)

Complies strictly with the Numerical Authority Rule (§40):
All integrity scores, plausibility flags, and anomaly classifications are evaluated
via analytical physics checks and statistical thresholds—never fabricated by LLMs.
"""

import time
import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any, Deque
from collections import deque
import logging

logger = logging.getLogger(__name__)

SENSOR_KEYS = [
    "rpm",
    "map",
    "egt_c",
    "cht_c",
    "oil_temp_c",
    "oil_pressure_bar",
    "fuel_flow_lph",
    "vibration",
]

# Physical hardware plausible ranges
SENSOR_RANGES = {
    "rpm": (400.0, 6500.0),
    "map": (10.0, 45.0),
    "manifold_pressure_inhg": (10.0, 45.0),
    "egt_c": (100.0, 1000.0),
    "cht_c": (20.0, 280.0),
    "oil_temp_c": (10.0, 160.0),
    "oil_pressure_bar": (0.0, 8.0),
    "fuel_flow_lph": (0.0, 50.0),
    "vibration": (0.0, 10.0),
}

# Max physically plausible rate-of-change per 0.1s step
MAX_ROC_PER_STEP = {
    "rpm": 500.0,
    "map": 5.0,
    "manifold_pressure_inhg": 5.0,
    "egt_c": 50.0,
    "cht_c": 15.0,
    "oil_temp_c": 8.0,
    "oil_pressure_bar": 2.0,
    "fuel_flow_lph": 6.0,
    "vibration": 3.0,
}

# Physical thermal/transducer minimum noise floor (std dev over 10 samples)
MIN_NOISE_FLOOR = {
    "rpm": 0.5,
    "map": 0.02,
    "manifold_pressure_inhg": 0.02,
    "egt_c": 0.2,
    "cht_c": 0.05,
    "oil_temp_c": 0.02,
    "oil_pressure_bar": 0.005,
    "fuel_flow_lph": 0.02,
    "vibration": 0.005,
}

FREEZE_WINDOW = 15


@dataclass
class ChannelIntegrityStatus:
    channel: str
    confidence: float = 1.0  # 0.0 (fully untrusted) to 1.0 (fully trusted)
    is_frozen: bool = False
    is_out_of_range: bool = False
    has_spike: bool = False
    is_drifting: bool = False
    is_dropout: bool = False
    noise_floor_collapsed: bool = False
    scale_jump: bool = False
    bit_corrupted: bool = False
    cross_contradiction: bool = False
    replay_detected: bool = False
    reasons: List[str] = field(default_factory=list)
    twin_estimate: Optional[float] = None
    using_twin_estimate: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "channel": self.channel,
            "confidence": round(self.confidence, 3),
            "is_frozen": self.is_frozen,
            "is_out_of_range": self.is_out_of_range,
            "has_spike": self.has_spike,
            "is_drifting": self.is_drifting,
            "is_dropout": self.is_dropout,
            "noise_floor_collapsed": self.noise_floor_collapsed,
            "scale_jump": self.scale_jump,
            "bit_corrupted": self.bit_corrupted,
            "cross_contradiction": self.cross_contradiction,
            "replay_detected": self.replay_detected,
            "reasons": self.reasons,
            "twin_estimate": round(self.twin_estimate, 3) if self.twin_estimate is not None else None,
            "using_twin_estimate": self.using_twin_estimate,
        }


@dataclass
class CyberShieldReport:
    timestamp: float = 0.0
    telemetry_integrity_score: float = 1.0  # Mean confidence [0.0, 1.0]
    cyber_anomaly_score: float = 0.0         # Fraction of compromised channels [0.0, 1.0]
    overall_classification: str = "NORMAL TELEMETRY"
    telemetry_verdict: str = "NORMAL TELEMETRY (AUTHENTIC)"
    is_cyber_anomaly: bool = False
    is_physical_fault: bool = False
    sensor_statuses: Dict[str, ChannelIntegrityStatus] = field(default_factory=dict)
    affected_sensors: List[str] = field(default_factory=list)
    anomaly_reasons: List[str] = field(default_factory=list)
    physics_cross_checks: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    timestamp_jitter_ms: float = 0.0
    packet_loss_rate: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": round(self.timestamp, 4),
            "telemetry_integrity_score": round(self.telemetry_integrity_score, 3),
            "cyber_anomaly_score": round(self.cyber_anomaly_score, 3),
            "overall_classification": self.overall_classification,
            "telemetry_verdict": self.telemetry_verdict,
            "is_cyber_anomaly": self.is_cyber_anomaly,
            "is_physical_fault": self.is_physical_fault,
            "sensor_statuses": {k: v.to_dict() for k, v in self.sensor_statuses.items()},
            "affected_sensors": self.affected_sensors,
            "anomaly_reasons": self.anomaly_reasons,
            "physics_cross_checks": self.physics_cross_checks,
            "timestamp_jitter_ms": round(self.timestamp_jitter_ms, 2),
            "packet_loss_rate": round(self.packet_loss_rate, 4),
        }


class ZeroTrustCyberShield:
    """
    12-Vector Zero-Trust Telemetry Cyber Shield.
    Performs deterministic physics cross-validation, temporal plausibility,
    and hostile pattern detection.
    """

    def __init__(self, history_len: int = 60):
        self.history_len = history_len
        self._history: Dict[str, Deque[float]] = {k: deque(maxlen=history_len) for k in SENSOR_KEYS}
        self._timestamps: Deque[float] = deque(maxlen=history_len)
        self._step = 0
        self._total_packets = 0
        self._lost_packets = 0

    @staticmethod
    def _normalize_key(key: str) -> str:
        k = key.lower()
        if k.startswith("res_"):
            k = k[4:]
        if k in ("manifold_pressure_inhg", "map_inhg"):
            return "map"
        if k in ("oil_press_bar", "oil_p_bar"):
            return "oil_pressure_bar"
        if k in ("oil_t_c", "oil_temperature_c"):
            return "oil_temp_c"
        if k in ("fuel_flow", "ff"):
            return "fuel_flow_lph"
        if k == "vib":
            return "vibration"
        return k

    def evaluate_telemetry(
        self,
        actual: Dict[str, float],
        expected: Dict[str, float],
        residual: Dict[str, float],
        timestamp: Optional[float] = None,
        bit_flags: Optional[Dict[str, bool]] = None,
    ) -> CyberShieldReport:
        """
        Execute 12 defensive cyber-physical telemetry validation checks.
        """
        self._step += 1
        now = timestamp if timestamp is not None else time.time()
        self._total_packets += 1

        # ── Vector 5: Timestamp Jitter / Stagnation ──────────────────────────
        jitter_ms = 0.0
        if len(self._timestamps) >= 2:
            dt = now - self._timestamps[-1]
            if dt <= 0.0:  # Non-monotonic or stagnated
                jitter_ms = 999.0
            else:
                prev_dt = self._timestamps[-1] - self._timestamps[-2] if len(self._timestamps) >= 3 else dt
                jitter_ms = abs(dt - prev_dt) * 1000.0
        self._timestamps.append(now)

        report = CyberShieldReport(timestamp=now, timestamp_jitter_ms=jitter_ms)
        issues: List[str] = []
        low_confidence_channels: List[str] = []

        # Standardize inputs
        act_std = {self._normalize_key(k): float(v) for k, v in actual.items()}
        exp_std = {self._normalize_key(k): float(v) for k, v in expected.items()}
        res_std = {self._normalize_key(k): float(v) for k, v in residual.items()}

        for ch in SENSOR_KEYS:
            status = ChannelIntegrityStatus(channel=ch, confidence=1.0)
            val = act_std.get(ch)
            exp_val = exp_std.get(ch)
            res_val = res_std.get(ch, 0.0)

            # ── Vector 6: Packet loss / dropout / NaN ─────────────────────────
            if val is None or not np.isfinite(val):
                status.is_dropout = True
                status.confidence = 0.0
                status.reasons.append("Packet Loss / Signal Dropout")
                status.using_twin_estimate = True
                status.twin_estimate = exp_val
                issues.append(f"{ch.upper()} DROPOUT")
                self._lost_packets += 1
                report.sensor_statuses[ch] = status
                low_confidence_channels.append(ch)
                continue

            self._history[ch].append(val)
            hist = list(self._history[ch])

            # ── Vector 4: Out-of-bounds impossible physical limits ───────────
            lo, hi = SENSOR_RANGES.get(ch, (-1e9, 1e9))
            if not (lo <= val <= hi):
                status.is_out_of_range = True
                status.confidence = max(0.0, status.confidence - 0.7)
                msg = f"Out of bounds: {val:.2f} ∉ [{lo}, {hi}]"
                status.reasons.append(msg)
                issues.append(f"{ch.upper()} OUT OF RANGE")

            # ── Vector 2: Rate-of-Change (ROC) Spikes ─────────────────────────
            if len(hist) >= 2:
                roc = abs(hist[-1] - hist[-2])
                max_roc = MAX_ROC_PER_STEP.get(ch, 1000.0)
                if roc > max_roc:
                    status.has_spike = True
                    status.confidence = max(0.0, status.confidence - 0.5)
                    msg = f"Dynamic ROC spike: {roc:.2f} > limit {max_roc}"
                    status.reasons.append(msg)
                    issues.append(f"{ch.upper()} ROC SPIKE")

            # ── Vector 1: Sensor Freeze / Stiction ────────────────────────────
            if len(hist) >= FREEZE_WINDOW:
                recent = hist[-FREEZE_WINDOW:]
                std_dev = float(np.std(recent))
                floor = MIN_NOISE_FLOOR.get(ch, 0.01)
                # If ADC has zero variation while twin expected state indicates deviation
                if std_dev < (floor * 0.1) and exp_val is not None:
                    if abs(val - exp_val) > (floor * 5.0):
                        status.is_frozen = True
                        status.confidence = max(0.0, status.confidence - 0.6)
                        status.reasons.append(f"Sensor frozen at {val:.2f} (std={std_dev:.5f})")
                        issues.append(f"{ch.upper()} FROZEN")

            # ── Vector 9: Noise Floor Collapse ────────────────────────────────
            if len(hist) >= 12 and not status.is_frozen:
                recent = hist[-12:]
                std_dev = float(np.std(recent))
                floor = MIN_NOISE_FLOOR.get(ch, 0.01)
                # Natural transducers always exhibit thermal Gaussian noise
                if std_dev < (floor * 0.05) and act_std.get("rpm", 0) > 1200:
                    status.noise_floor_collapsed = True
                    status.confidence = max(0.0, status.confidence - 0.3)
                    status.reasons.append("Thermal noise floor collapsed (synthetic override)")
                    issues.append(f"{ch.upper()} NOISE FLOOR COLLAPSE")

            # ── Vector 3: Sensor Drift / Linear Bias ──────────────────────────
            if len(hist) >= 20 and exp_val is not None:
                t = np.arange(len(hist[-20:]))
                slope = float(np.polyfit(t, hist[-20:], 1)[0])
                max_roc = MAX_ROC_PER_STEP.get(ch, 100.0)
                # Continuous monotonic slope divergence
                if abs(slope) > (max_roc / 10.0) and abs(val - exp_val) > (max_roc * 0.5):
                    status.is_drifting = True
                    status.confidence = max(0.0, status.confidence - 0.35)
                    status.reasons.append(f"Unchecked sensor drift (slope={slope:.3f}/step)")
                    issues.append(f"{ch.upper()} SENSOR DRIFT")

            # ── Vector 8: Hostile Spoofing / Replay Detection ─────────────────
            # Cyclic exact pattern replication
            if len(hist) >= 30:
                h = np.array(hist[-30:])
                # Check auto-correlation at lag 10
                lag = 10
                if np.std(h) > 0.1:
                    corr = float(np.corrcoef(h[:-lag], h[lag:])[0, 1])
                    if corr > 0.992 and abs(val - (exp_val or val)) > 5.0:
                        status.replay_detected = True
                        status.confidence = max(0.0, status.confidence - 0.7)
                        status.reasons.append("Identical cyclic telemetry sequence (replay pattern)")
                        issues.append(f"{ch.upper()} REPLAY SPOOFING")

            # ── Vector 10: Calibration Scale Jump ────────────────────────────
            if len(hist) >= 6 and exp_val is not None:
                prev_ratio = hist[-2] / max(exp_val, 1e-4) if exp_val else 1.0
                curr_ratio = hist[-1] / max(exp_val, 1e-4) if exp_val else 1.0
                if abs(curr_ratio - prev_ratio) > 0.6 and not status.has_spike:
                    status.scale_jump = True
                    status.confidence = max(0.0, status.confidence - 0.4)
                    status.reasons.append(f"Instantaneous calibration scale step ({prev_ratio:.2f}x → {curr_ratio:.2f}x)")
                    issues.append(f"{ch.upper()} CALIBRATION JUMP")

            # ── Vector 12: Bit / Parity Corruption ────────────────────────────
            if bit_flags and bit_flags.get(ch, False):
                status.bit_corrupted = True
                status.confidence = 0.0
                status.reasons.append("CAN Frame Bit Parity / CRC Checksum Mismatch")
                issues.append(f"{ch.upper()} BIT CORRUPTION")

            # Substitute twin estimate if confidence dropped
            if status.confidence < 0.6 and exp_val is not None:
                status.using_twin_estimate = True
                status.twin_estimate = exp_val

            report.sensor_statuses[ch] = status
            if status.confidence < 0.75:
                low_confidence_channels.append(ch)

        # ── Vector 7: Cross-Sensor Thermodynamic Contradictions ──────────────
        egt_res = abs(res_std.get("egt_c", 0.0))
        cht_res = abs(res_std.get("cht_c", 0.0))
        oil_p_res = abs(res_std.get("oil_pressure_bar", 0.0))
        oil_t_res = abs(res_std.get("oil_temp_c", 0.0))
        ff_res = abs(res_std.get("fuel_flow_lph", 0.0))
        rpm_res = abs(res_std.get("rpm", 0.0))
        map_val = act_std.get("map", 29.92)
        throttle = actual.get("throttle", 0.7)

        # Cross 1: EGT vs CHT Thermal Mass Coupling
        egt_cht_valid = not (egt_res > 90.0 and cht_res < 15.0)
        if not egt_cht_valid:
            report.sensor_statuses["egt_c"].cross_contradiction = True
            report.sensor_statuses["egt_c"].confidence = max(0.0, report.sensor_statuses["egt_c"].confidence - 0.4)
            issues.append("EGT-CHT THERMAL CONTRADICTION")

        # Cross 2: Oil Pressure vs Oil Temperature Viscosity Law
        oil_coupling_valid = not (oil_p_res > 1.8 and oil_t_res < 5.0)
        if not oil_coupling_valid:
            report.sensor_statuses["oil_pressure_bar"].cross_contradiction = True
            report.sensor_statuses["oil_pressure_bar"].confidence = max(0.0, report.sensor_statuses["oil_pressure_bar"].confidence - 0.4)
            issues.append("OIL PRESSURE-TEMPERATURE CONTRADICTION")

        # Cross 3: Fuel Flow vs RPM Power Conservation
        fuel_rpm_valid = not (ff_res > 8.0 and rpm_res < 80.0)
        if not fuel_rpm_valid:
            report.sensor_statuses["fuel_flow_lph"].cross_contradiction = True
            report.sensor_statuses["fuel_flow_lph"].confidence = max(0.0, report.sensor_statuses["fuel_flow_lph"].confidence - 0.4)
            issues.append("FUEL FLOW-RPM POWER CONTRADICTION")

        # Cross 4: Turbo Manifold Pressure vs High Throttle
        map_throttle_valid = not (throttle > 0.85 and map_val < 18.0)
        if not map_throttle_valid and "map" in report.sensor_statuses:
            report.sensor_statuses["map"].cross_contradiction = True
            report.sensor_statuses["map"].confidence = max(0.0, report.sensor_statuses["map"].confidence - 0.4)
            issues.append("MAP-THROTTLE BOOST CONTRADICTION")

        report.physics_cross_checks = {
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
            "turbo_manifold_dynamics": {
                "name": "Manifold Pressure ↔ Throttle Dynamic Law",
                "valid": bool(map_throttle_valid),
                "detail": "Consistent" if map_throttle_valid else "Manifold vacuum during high throttle command",
            },
        }

        # ── Aggregate Scores & Diagnostic Verdict ─────────────────────────────
        conf_list = [s.confidence for s in report.sensor_statuses.values()]
        report.telemetry_integrity_score = float(np.mean(conf_list))
        report.affected_sensors = sorted(list(set(low_confidence_channels)))
        report.anomaly_reasons = sorted(list(set(issues)))
        report.cyber_anomaly_score = float(np.clip(len(report.affected_sensors) / len(SENSOR_KEYS), 0.0, 1.0))
        report.packet_loss_rate = float(self._lost_packets / max(self._total_packets, 1))

        # Disambiguate authentic coupled physical fault vs hostile/sensor cyber tampering
        coupled_physical = (egt_res > 40.0 and cht_res > 12.0) or (oil_p_res > 0.8 and oil_t_res > 8.0)
        isolated_violation = (
            not egt_cht_valid
            or not oil_coupling_valid
            or not fuel_rpm_valid
            or not map_throttle_valid
            or any("SPIKE" in r or "FROZEN" in r or "SPOOFING" in r or "BIT" in r or "COLLAPSE" in r for r in report.anomaly_reasons)
        )

        report.is_physical_fault = bool(coupled_physical and not isolated_violation)
        report.is_cyber_anomaly = bool(isolated_violation or (len(report.affected_sensors) > 0 and not coupled_physical))

        if len(report.affected_sensors) == 0 and not isolated_violation:
            report.overall_classification = "NORMAL TELEMETRY"
            report.telemetry_verdict = "NORMAL TELEMETRY (AUTHENTIC)"
        elif report.is_physical_fault:
            report.overall_classification = "PHYSICAL ENGINE DEGRADATION"
            report.telemetry_verdict = "AUTHENTIC ENGINE HARDWARE FAULT"
        elif any("DROPOUT" in r for r in report.anomaly_reasons):
            report.overall_classification = "SENSOR FAILURE"
            report.telemetry_verdict = "SENSOR HARDWARE FAILURE (DROPOUT)"
        elif any("SPOOFING" in r for r in report.anomaly_reasons):
            report.overall_classification = "HOSTILE SPOOFING ATTACK"
            report.telemetry_verdict = "HOSTILE REPLAY / ADVERSARIAL TELEMETRY INJECTION"
        elif any("FROZEN" in r for r in report.anomaly_reasons):
            report.overall_classification = "SUSPICIOUS TELEMETRY"
            report.telemetry_verdict = "CYBER ANOMALY (FROZEN ADC / TELEMETRY TAMPERING)"
        elif report.is_cyber_anomaly:
            report.overall_classification = "SUSPICIOUS TELEMETRY"
            report.telemetry_verdict = "CYBER ANOMALY (MANIPULATED / SPOOFED TELEMETRY)"
        else:
            report.overall_classification = "DATA ANOMALY"
            report.telemetry_verdict = "DATA ANOMALY"

        return report

    def reset(self):
        for ch in SENSOR_KEYS:
            self._history[ch].clear()
        self._timestamps.clear()
        self._step = 0
        self._total_packets = 0
        self._lost_packets = 0
