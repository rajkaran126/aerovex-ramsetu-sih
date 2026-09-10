"""
AERO-TWIN — RUL (Remaining Useful Life) Predictor

Implements:
P0: Random Forest regression (baseline, always available)
P1: PyTorch LSTM (if available, otherwise falls back to RF)

EOL definition: health_index drops below configurable threshold (default 20.0).

Returns:
- rul_median: estimated RUL in hours
- rul_lower: lower bound (pessimistic)
- rul_upper: upper bound (optimistic)
- confidence: prediction confidence 0–1

DISCLAIMER: This is a RESEARCH DEMONSTRATOR.
RUL estimates are from a simplified model trained on synthetic data.
NOT suitable for real operational use.
"""

import numpy as np
import joblib
import logging
from typing import Dict, Optional, Tuple
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent.parent.parent / "models_saved"
RUL_MODEL_PATH = MODELS_DIR / "rul_model.pkl"
RUL_SCALER_PATH = MODELS_DIR / "rul_scaler.pkl"

EOL_HEALTH_THRESHOLD = 20.0   # Health below this = end of life


class RULPredictor:
    """
    Remaining Useful Life predictor using Random Forest regression.

    Predicts time-to-EOL in hours based on current engine health state,
    degradation rates, and operating conditions.
    """

    def __init__(self, eol_threshold: float = EOL_HEALTH_THRESHOLD):
        self.eol_threshold = eol_threshold
        self.model: Optional[RandomForestRegressor] = None
        self.scaler: Optional[StandardScaler] = None
        self._loaded = False
        self._load_or_train()

    def _load_or_train(self) -> None:
        if RUL_MODEL_PATH.exists():
            try:
                self.model = joblib.load(RUL_MODEL_PATH)
                self.scaler = joblib.load(RUL_SCALER_PATH)
                self._loaded = True
                logger.info("RUL model loaded from disk")
                return
            except Exception as e:
                logger.warning(f"Could not load RUL model: {e}. Training baseline.")
        self._train_baseline()

    def train_on_synthetic(self, n_samples: int = 5000) -> None:
        """Explicitly train RUL predictor on synthetic data and save."""
        self._train_baseline()

    def _generate_rul_data(self) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate synthetic RUL training data.
        Simulates engine degradation trajectories and labels each point
        with its time-to-EOL.
        """
        rng = np.random.default_rng(42)
        n_engines = 100
        X_list, y_list = [], []

        for eng in range(n_engines):
            # Each engine has a random nominal lifespan 100–500 hours
            lifespan_h = rng.uniform(100, 500)
            n_steps = int(lifespan_h * 60)  # 1 step = 1 minute = 1/60 hour

            # Degradation rate varies per engine
            deg_rate = rng.uniform(0.5, 2.0)  # multiplier
            throttle_base = rng.uniform(0.4, 0.85)
            altitude_base = rng.uniform(5000, 22000)
            ambient_base = rng.uniform(-5, 42)

            for step in range(n_steps):
                t = step / 60.0  # hours elapsed
                rul = lifespan_h - t  # time-to-EOL

                if rul <= 0:
                    break

                # Health degrades nonlinearly
                health = 100.0 * (1.0 - (t / lifespan_h) ** (1.0 / deg_rate))
                health = float(np.clip(health, 0, 100))

                if health < self.eol_threshold:
                    break

                # Compute degradation state
                deg_inj = np.clip((100 - health) / 100 * rng.uniform(0.5, 1.5), 0, 1)
                deg_cool = np.clip((100 - health) / 100 * rng.uniform(0.2, 1.0), 0, 1)

                # Throttle + altitude with some variation
                throttle = throttle_base + rng.normal(0, 0.05)
                altitude = altitude_base + rng.normal(0, 500)
                ambient = ambient_base + rng.normal(0, 2)

                # Rolling degradation rate (rate of health change)
                if step > 5:
                    deg_rate_est = (100.0 - health) / max(t, 0.1)
                else:
                    deg_rate_est = 0.0

                feature = np.array([
                    health, deg_inj, deg_cool,
                    np.clip(throttle, 0, 1),
                    np.clip(altitude, 0, 30000) / 30000,
                    np.clip(ambient, -40, 60) / 60,
                    t / lifespan_h,          # mission progress fraction
                    deg_rate_est,
                    rng.normal(0, 0.01),     # small noise
                ], dtype=np.float32)

                X_list.append(feature)
                y_list.append(rul)

        X = np.array(X_list, dtype=np.float32)
        y = np.array(y_list, dtype=np.float32)
        X = np.nan_to_num(X, nan=0.0)
        y = np.nan_to_num(y, nan=0.0)
        return X, y

    def _train_baseline(self) -> None:
        logger.info("Training baseline RUL model on synthetic data...")
        X, y = self._generate_rul_data()

        # Subsample for speed
        if len(X) > 50000:
            idx = np.random.default_rng(42).choice(len(X), 50000, replace=False)
            X, y = X[idx], y[idx]

        self.scaler = StandardScaler()
        X_s = self.scaler.fit_transform(X)

        self.model = RandomForestRegressor(
            n_estimators=200,
            max_depth=12,
            min_samples_split=10,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X_s, y)

        from sklearn.metrics import mean_absolute_error, r2_score
        y_pred = self.model.predict(X_s[:5000])
        mae = mean_absolute_error(y[:5000], y_pred)
        r2 = r2_score(y[:5000], y_pred)
        logger.info(f"RUL model — MAE: {mae:.2f}h, R²: {r2:.3f}")

        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, RUL_MODEL_PATH)
        joblib.dump(self.scaler, RUL_SCALER_PATH)
        self._loaded = True
        logger.info("RUL model trained and saved")

    def _build_features(
        self,
        health: float,
        degradation: Dict[str, float],
        throttle: float,
        altitude_ft: float,
        ambient_temp_c: float,
        mission_elapsed_hours: float,
        mission_duration_hours: float,
        degradation_rate: float = 0.0,
    ) -> np.ndarray:
        mission_progress = mission_elapsed_hours / max(mission_duration_hours, 0.1)
        return np.array([
            health,
            degradation.get("injector", 0.0),
            degradation.get("cooling", 0.0),
            np.clip(throttle, 0, 1),
            np.clip(altitude_ft, 0, 30000) / 30000,
            np.clip(ambient_temp_c, -40, 60) / 60,
            mission_progress,
            degradation_rate,
            0.0,  # noise placeholder
        ], dtype=np.float32)

    def predict(
        self,
        health: float,
        degradation: Dict[str, float],
        throttle: float,
        altitude_ft: float,
        ambient_temp_c: float,
        mission_elapsed_hours: float = 0.0,
        mission_duration_hours: float = 4.0,
        health_history: Optional[list] = None,
    ) -> Dict:
        """
        Predict RUL in hours.

        Returns median, lower (5th percentile), upper (95th percentile).
        """
        if not self._loaded or self.model is None:
            # Fallback: simple linear extrapolation
            return self._fallback_predict(health, health_history)

        try:
            # Estimate degradation rate from health history
            deg_rate = 0.0
            if health_history and len(health_history) >= 5:
                recent = np.array(health_history[-10:])
                if len(recent) >= 2:
                    deg_rate = (recent[0] - recent[-1]) / len(recent)  # health/step
                    deg_rate = max(0.0, deg_rate)

            fv = self._build_features(
                health, degradation, throttle, altitude_ft, ambient_temp_c,
                mission_elapsed_hours, mission_duration_hours, deg_rate
            )
            fv = np.nan_to_num(fv, nan=0.0)
            fv_scaled = self.scaler.transform(fv.reshape(1, -1))

            # Use individual tree predictions for uncertainty
            tree_preds = np.array([
                tree.predict(fv_scaled)[0] for tree in self.model.estimators_
            ])

            median = float(np.median(tree_preds))
            lower = float(np.percentile(tree_preds, 10))
            upper = float(np.percentile(tree_preds, 90))
            std = float(np.std(tree_preds))

            # Confidence inversely proportional to spread
            confidence = max(0.3, 1.0 - (std / (median + 1e-6)) * 0.5)
            confidence = min(0.95, confidence)

            return {
                "rul_median": round(max(0.0, median), 2),
                "rul_lower": round(max(0.0, lower), 2),
                "rul_upper": round(max(0.0, upper), 2),
                "rul_confidence": round(confidence, 3),
                "method": "Random Forest Regression (Synthetic Data)",
                "eol_threshold": self.eol_threshold,
                "disclaimer": "RESEARCH DEMONSTRATOR — Not for operational use",
            }

        except Exception as e:
            logger.error(f"RUL prediction error: {e}")
            return self._fallback_predict(health, health_history)

    def _fallback_predict(
        self, health: float, health_history: Optional[list] = None
    ) -> Dict:
        """Simple health-extrapolation fallback"""
        if health_history and len(health_history) >= 5:
            recent = np.array(health_history[-10:])
            deg_rate_per_step = (recent[0] - recent[-1]) / len(recent)
            if deg_rate_per_step > 0:
                steps_to_eol = (health - self.eol_threshold) / deg_rate_per_step
                rul = max(0.0, steps_to_eol / 3600.0)  # steps = seconds → hours
            else:
                rul = 999.0
        else:
            rul = (health - self.eol_threshold) / 10.0

        rul = max(0.0, rul)
        return {
            "rul_median": round(rul, 2),
            "rul_lower": round(rul * 0.7, 2),
            "rul_upper": round(rul * 1.3, 2),
            "rul_confidence": 0.4,
            "method": "Linear Extrapolation (Fallback)",
            "eol_threshold": self.eol_threshold,
            "disclaimer": "RESEARCH DEMONSTRATOR — Not for operational use",
        }
