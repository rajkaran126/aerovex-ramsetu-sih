"""
AERO-TWIN — Digital Twin Residual State Engine

Computes continuous 7+ channel residual vectors:
    r(t) = y_actual(t) - y_expected(t)
    
Maintains statistical rolling buffers for:
- Mean residual per channel
- Variance and standard deviation
- Skewness (asymmetry indicator for unilateral sensor drift or runaway)
- Cross-channel Covariance matrix (detecting coupled degradation modes)

Complies strictly with the Numerical Authority Rule (§40):
All residual metrics are computed by analytical physics and statistical equations,
never generated, hallucinated, or modified by LLMs.
"""

import time
import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Deque, Tuple, Any
from collections import deque
import logging

try:
    from scipy.stats import skew
except ImportError:
    def skew(a, axis=0, bias=True):
        a = np.asarray(a)
        m = np.mean(a, axis=axis)
        m2 = np.mean((a - m)**2, axis=axis)
        m3 = np.mean((a - m)**3, axis=axis)
        denom = m2 ** 1.5
        return np.where(denom == 0, 0.0, m3 / denom)

logger = logging.getLogger(__name__)

# Canonical 7 core thermodynamic channels + optional fuel flow
CHANNELS = [
    "rpm",
    "map",
    "egt_c",
    "cht_c",
    "oil_pressure_bar",
    "oil_temp_c",
    "vibration",
    "fuel_flow_lph",
]

# Normalization constants based on Rotax 914/915 rated limits
NORMALIZATION_SCALE = {
    "rpm": 5800.0,
    "map": 39.9,             # inHg (turbocharged max MAP)
    "manifold_pressure_inhg": 39.9,
    "egt_c": 750.0,          # °C rated continuous
    "cht_c": 200.0,          # °C rated continuous
    "oil_pressure_bar": 5.0, # bar nominal
    "oil_temp_c": 110.0,     # °C rated continuous
    "vibration": 2.0,        # vibration index reference
    "fuel_flow_lph": 28.0,   # L/hr cruise reference
}

# Alias mapping between different naming conventions
ALIAS_MAP = {
    "manifold_pressure_inhg": "map",
    "map_inhg": "map",
    "oil_press_bar": "oil_pressure_bar",
    "oil_p_bar": "oil_pressure_bar",
    "oil_t_c": "oil_temp_c",
    "vib": "vibration",
    "fuel_flow": "fuel_flow_lph",
    "egt": "egt_c",
    "cht": "cht_c",
}


@dataclass
class ResidualSnapshot:
    """Instantaneous multi-channel residual snapshot"""
    timestamp: float
    raw_residuals: Dict[str, float]
    normalized_residuals: Dict[str, float]
    magnitude: float
    z_scores: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": round(self.timestamp, 4),
            "raw_residuals": {k: round(v, 4) for k, v in self.raw_residuals.items()},
            "normalized_residuals": {k: round(v, 4) for k, v in self.normalized_residuals.items()},
            "magnitude": round(self.magnitude, 4),
            "z_scores": {k: round(v, 4) for k, v in self.z_scores.items()},
        }


class ResidualEngine:
    """
    Continuous 7-Channel Residual Vector Computation & Statistical Profiler.
    """

    def __init__(self, window_size: int = 150):
        self.window_size = window_size
        self._history: Deque[ResidualSnapshot] = deque(maxlen=window_size)
        self._channel_arrays: Dict[str, deque] = {ch: deque(maxlen=window_size) for ch in CHANNELS}

    @staticmethod
    def _normalize_key(key: str) -> str:
        k = key.lower()
        return ALIAS_MAP.get(k, k)

    def compute_residual_vector(
        self,
        actual: Dict[str, float],
        expected: Dict[str, float],
        timestamp: Optional[float] = None,
    ) -> ResidualSnapshot:
        """
        Compute r(t) = y_actual(t) - y_expected(t) across all recognized channels.
        Calculates composite normalized Euclidean residual magnitude.
        """
        ts = timestamp if timestamp is not None else time.time()
        
        # Standardize key names
        act_std = {self._normalize_key(k): float(v) for k, v in actual.items()}
        exp_std = {self._normalize_key(k): float(v) for k, v in expected.items()}

        raw: Dict[str, float] = {}
        normalized: Dict[str, float] = {}
        sum_sq = 0.0
        n_channels = 0

        for ch in CHANNELS:
            val_act = act_std.get(ch)
            val_exp = exp_std.get(ch)

            if val_act is not None and val_exp is not None:
                diff = val_act - val_exp
                raw[ch] = diff
                scale = NORMALIZATION_SCALE.get(ch, 1.0)
                norm_val = diff / scale
                normalized[ch] = norm_val
                sum_sq += norm_val ** 2
                n_channels += 1

                self._channel_arrays[ch].append(diff)
            else:
                raw[ch] = 0.0
                normalized[ch] = 0.0

        magnitude = np.sqrt(sum_sq / max(n_channels, 1))

        # Compute instantaneous z-scores against rolling window
        z_scores: Dict[str, float] = {}
        for ch in CHANNELS:
            history = self._channel_arrays[ch]
            if len(history) >= 10:
                mean = np.mean(history)
                std = np.std(history)
                if std > 1e-6:
                    z_scores[ch] = float((raw[ch] - mean) / std)
                else:
                    z_scores[ch] = 0.0
            else:
                z_scores[ch] = 0.0

        snapshot = ResidualSnapshot(
            timestamp=ts,
            raw_residuals=raw,
            normalized_residuals=normalized,
            magnitude=float(magnitude),
            z_scores=z_scores,
        )

        self._history.append(snapshot)
        return snapshot

    def get_rolling_statistics(self) -> Dict[str, Any]:
        """
        Compute mean, variance, standard deviation, skewness, and covariance.
        """
        if len(self._history) < 3:
            return {
                "sample_count": len(self._history),
                "means": {ch: 0.0 for ch in CHANNELS},
                "variances": {ch: 0.0 for ch in CHANNELS},
                "stds": {ch: 0.0 for ch in CHANNELS},
                "skewness": {ch: 0.0 for ch in CHANNELS},
                "covariance_matrix": {},
                "dominant_deviation_channel": None,
            }

        means: Dict[str, float] = {}
        variances: Dict[str, float] = {}
        stds: Dict[str, float] = {}
        skewness_dict: Dict[str, float] = {}

        data_matrix = []
        valid_channels = []

        for ch in CHANNELS:
            arr = list(self._channel_arrays[ch])
            if len(arr) >= 3:
                m = float(np.mean(arr))
                v = float(np.var(arr))
                s = float(np.std(arr))
                sk = float(skew(arr))

                means[ch] = round(m, 4)
                variances[ch] = round(v, 6)
                stds[ch] = round(s, 4)
                skewness_dict[ch] = round(sk, 4)

                data_matrix.append(arr)
                valid_channels.append(ch)

        # Covariance matrix between valid channels
        cov_dict: Dict[str, Dict[str, float]] = {}
        if len(data_matrix) >= 2 and len(data_matrix[0]) >= 5:
            try:
                cov_mat = np.cov(data_matrix)
                for i, ch1 in enumerate(valid_channels):
                    cov_dict[ch1] = {}
                    for j, ch2 in enumerate(valid_channels):
                        cov_dict[ch1][ch2] = round(float(cov_mat[i, j]), 6)
            except Exception as e:
                logger.warning(f"Covariance calculation warning: {e}")

        # Determine dominant channel contributing to deviation
        dominant_ch = None
        max_norm_res = -1.0
        if self._history:
            last = self._history[-1]
            for ch, n_res in last.normalized_residuals.items():
                if abs(n_res) > max_norm_res:
                    max_norm_res = abs(n_res)
                    dominant_ch = ch

        return {
            "sample_count": len(self._history),
            "means": means,
            "variances": variances,
            "stds": stds,
            "skewness": skewness_dict,
            "covariance_matrix": cov_dict,
            "dominant_deviation_channel": dominant_ch,
        }

    def reset(self):
        """Clear rolling residual buffers"""
        self._history.clear()
        for ch in CHANNELS:
            self._channel_arrays[ch].clear()
