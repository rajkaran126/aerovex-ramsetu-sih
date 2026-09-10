"""
AERO-TWIN — AI Anomaly Detection

Implements Isolation Forest (primary) for real-time anomaly scoring.
Trained on healthy engine telemetry + physics residuals.

Features:
- Raw telemetry values
- Physics residuals (actual - expected)
- Rolling means, standard deviations
- Rate of change

Returns:
- anomaly_score: 0.0 (normal) to 1.0 (highly anomalous)
- is_anomaly: bool
- anomaly_class: str
- confidence: float
"""

import numpy as np
import joblib
import os
import logging
from typing import Dict, Optional, Tuple
from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent.parent.parent / "models_saved"
ANOMALY_MODEL_PATH = MODELS_DIR / "anomaly_model.pkl"
ANOMALY_SCALER_PATH = MODELS_DIR / "anomaly_scaler.pkl"

FEATURE_KEYS = [
    "rpm", "egt_c", "cht_c", "oil_temp_c", "oil_pressure_bar",
    "fuel_flow_lph", "vibration",
    "res_rpm", "res_egt_c", "res_cht_c", "res_oil_temp_c",
    "res_oil_pressure_bar", "res_fuel_flow_lph", "res_vibration",
    "rpm_mean", "egt_c_mean", "cht_c_mean", "vibration_mean",
    "rpm_std", "egt_c_std", "cht_c_std", "vibration_std",
    "rpm_roc", "egt_c_roc", "cht_c_roc", "vibration_roc",
]


class AnomalyDetector:
    """
    Isolation Forest based anomaly detector.

    If no trained model exists, trains a baseline model on synthetic
    healthy engine data.
    """

    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.scaler: Optional[StandardScaler] = None
        self._loaded = False
        self._load_or_train()

    def _load_or_train(self) -> None:
        """Load saved model or train a baseline model"""
        if ANOMALY_MODEL_PATH.exists() and ANOMALY_SCALER_PATH.exists():
            try:
                self.model = joblib.load(ANOMALY_MODEL_PATH)
                self.scaler = joblib.load(ANOMALY_SCALER_PATH)
                self._loaded = True
                logger.info("Anomaly model loaded from disk")
                return
            except Exception as e:
                logger.warning(f"Could not load anomaly model: {e}. Training baseline.")

        self._train_baseline()

    def train_on_synthetic(self, n_samples: int = 5000) -> None:
        """Explicitly train anomaly detector on synthetic data and save."""
        self._train_baseline()

    def _train_baseline(self) -> None:
        """
        Train a baseline Isolation Forest on synthetic healthy engine data.
        This generates realistic healthy operating data and trains the model.
        """
        logger.info("Training baseline anomaly model on synthetic healthy data...")

        rng = np.random.default_rng(42)
        n_samples = 5000

        # Simulate healthy engine operating ranges
        throttle = rng.uniform(0.3, 0.9, n_samples)
        rpm = 800 + throttle * 5000 + rng.normal(0, 30, n_samples)
        egt = 300 + throttle * 420 + rng.normal(0, 15, n_samples)
        cht = egt * 0.26 + 20 + rng.normal(0, 5, n_samples)
        oil_temp = 60 + throttle * 35 + rng.normal(0, 3, n_samples)
        oil_pres = 1.0 + throttle * 3.8 + rng.normal(0, 0.15, n_samples)
        fuel_flow = throttle * 25 + rng.normal(0, 0.5, n_samples)
        vibration = 1.0 + throttle * 0.2 + rng.normal(0, 0.05, n_samples)

        # Residuals for healthy engine ~= 0 with small noise
        res = rng.normal(0, 0.5, (n_samples, 7))

        # Rolling features (simulate)
        def rolling_stats(arr: np.ndarray, n: int = 20) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
            means = np.convolve(arr, np.ones(n)/n, mode='same')
            stds = np.array([arr[max(0,i-n):i+1].std() for i in range(len(arr))])
            roc = np.concatenate([[0], np.diff(arr)])
            return means, stds, roc

        features = np.column_stack([
            rpm, egt, cht, oil_temp, oil_pres, fuel_flow, vibration,
            res[:, 0], res[:, 1], res[:, 2], res[:, 3], res[:, 4], res[:, 5], res[:, 6],
            rolling_stats(rpm)[0], rolling_stats(egt)[0], rolling_stats(cht)[0], rolling_stats(vibration)[0],
            rolling_stats(rpm)[1], rolling_stats(egt)[1], rolling_stats(cht)[1], rolling_stats(vibration)[1],
            rolling_stats(rpm)[2], rolling_stats(egt)[2], rolling_stats(cht)[2], rolling_stats(vibration)[2],
        ])

        self.scaler = StandardScaler()
        features_scaled = self.scaler.fit_transform(features)

        self.model = IsolationForest(
            n_estimators=200,
            contamination=0.05,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(features_scaled)

        # Save models
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, ANOMALY_MODEL_PATH)
        joblib.dump(self.scaler, ANOMALY_SCALER_PATH)
        self._loaded = True
        logger.info("Baseline anomaly model trained and saved")

    def _build_feature_vector(
        self,
        actual: Dict[str, float],
        residual: Dict[str, float],
        rolling: Dict[str, float],
    ) -> np.ndarray:
        """Build feature vector from current state"""
        def safe_get(d: Dict, key: str) -> float:
            v = d.get(key, 0.0)
            return float(v) if v is not None and np.isfinite(v) else 0.0

        return np.array([
            safe_get(actual, "rpm"),
            safe_get(actual, "egt_c"),
            safe_get(actual, "cht_c"),
            safe_get(actual, "oil_temp_c"),
            safe_get(actual, "oil_pressure_bar"),
            safe_get(actual, "fuel_flow_lph"),
            safe_get(actual, "vibration"),
            safe_get(residual, "rpm"),
            safe_get(residual, "egt_c"),
            safe_get(residual, "cht_c"),
            safe_get(residual, "oil_temp_c"),
            safe_get(residual, "oil_pressure_bar"),
            safe_get(residual, "fuel_flow_lph"),
            safe_get(residual, "vibration"),
            safe_get(rolling, "rpm_mean"),
            safe_get(rolling, "egt_c_mean"),
            safe_get(rolling, "cht_c_mean"),
            safe_get(rolling, "vibration_mean"),
            safe_get(rolling, "rpm_std"),
            safe_get(rolling, "egt_c_std"),
            safe_get(rolling, "cht_c_std"),
            safe_get(rolling, "vibration_std"),
            safe_get(rolling, "rpm_roc"),
            safe_get(rolling, "egt_c_roc"),
            safe_get(rolling, "cht_c_roc"),
            safe_get(rolling, "vibration_roc"),
        ], dtype=np.float32)

    def detect(
        self,
        actual: Dict[str, float],
        residual: Dict[str, float],
        rolling: Dict[str, float],
    ) -> Dict:
        """
        Detect anomaly from current engine state.

        Returns
        -------
        dict with keys:
            anomaly_score: float [0, 1]
            is_anomaly: bool
            confidence: float [0, 1]
            anomaly_class: str
        """
        if not self._loaded or self.model is None:
            return {"anomaly_score": 0.0, "is_anomaly": False, "confidence": 0.5, "anomaly_class": "UNKNOWN"}

        try:
            fv = self._build_feature_vector(actual, residual, rolling)
            fv_scaled = self.scaler.transform(fv.reshape(1, -1))

            # Isolation Forest: decision_function returns anomaly score
            # negative = anomaly, positive = normal
            raw_score = self.model.decision_function(fv_scaled)[0]
            prediction = self.model.predict(fv_scaled)[0]  # -1 = anomaly

            # Normalize to [0, 1]: higher = more anomalous
            # decision_function typically in [-0.5, 0.5]
            anomaly_score = float(np.clip(0.5 - raw_score, 0.0, 1.0))
            is_anomaly = prediction == -1

            # Classify anomaly type based on dominant residual
            anomaly_class = self._classify_anomaly(actual, residual, is_anomaly)
            confidence = min(0.95, 0.5 + abs(raw_score))

            return {
                "anomaly_score": round(anomaly_score, 4),
                "is_anomaly": is_anomaly,
                "confidence": round(confidence, 4),
                "anomaly_class": anomaly_class,
            }
        except Exception as e:
            logger.error(f"Anomaly detection error: {e}")
            return {"anomaly_score": 0.0, "is_anomaly": False, "confidence": 0.3, "anomaly_class": "ERROR"}

    def _classify_anomaly(
        self, actual: Dict, residual: Dict, is_anomaly: bool
    ) -> str:
        if not is_anomaly:
            return "NORMAL"

        # Heuristic classification based on dominant residual
        egt_res = abs(residual.get("egt_c", 0))
        cht_res = abs(residual.get("cht_c", 0))
        vib_res = abs(residual.get("vibration", 0))
        oil_pres_res = abs(residual.get("oil_pressure_bar", 0))
        ff_res = abs(residual.get("fuel_flow_lph", 0))

        scores = {
            "THERMAL": egt_res * 0.6 + cht_res * 0.4,
            "VIBRATION": vib_res * 50,
            "LUBRICATION": oil_pres_res * 20,
            "FUEL_SYSTEM": ff_res * 5,
        }
        return max(scores, key=scores.get)
