"""
AERO-TWIN — Fault Classifier

Random Forest multi-class fault classifier.
Classes: healthy, injector, cooling, lubrication, combustion, mechanical, sensor

Trained on synthetic aero-piston engine data with injected faults.
If no model exists, trains a baseline on generated data.

Returns probability for each class — NOT hard-coded values.
"""

import numpy as np
import joblib
import logging
from typing import Dict, List, Optional
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent.parent.parent / "models_saved"
FAULT_MODEL_PATH = MODELS_DIR / "fault_classifier.pkl"
FAULT_SCALER_PATH = MODELS_DIR / "fault_scaler.pkl"
FAULT_ENCODER_PATH = MODELS_DIR / "fault_encoder.pkl"

FAULT_CLASSES = ["healthy", "injector", "cooling", "lubrication", "combustion", "mechanical", "sensor"]

FEATURE_NAMES = [
    "rpm", "egt_c", "cht_c", "oil_temp_c", "oil_pressure_bar",
    "fuel_flow_lph", "vibration",
    "res_rpm", "res_egt_c", "res_cht_c", "res_oil_temp_c",
    "res_oil_pressure_bar", "res_fuel_flow_lph", "res_vibration",
    "egt_c_mean", "cht_c_mean", "vibration_mean", "oil_pres_mean",
    "egt_c_std", "cht_c_std", "vibration_std",
    "egt_c_roc", "cht_c_roc", "vibration_roc", "rpm_roc",
    "thermal_margin", "efficiency",
]


class FaultClassifier:
    """
    Random Forest fault classifier.
    Produces probability estimates for 7 fault classes.
    """

    def __init__(self):
        self.model: Optional[RandomForestClassifier] = None
        self.scaler: Optional[StandardScaler] = None
        self.encoder: Optional[LabelEncoder] = None
        self._loaded = False
        self._load_or_train()

    def _load_or_train(self) -> None:
        if FAULT_MODEL_PATH.exists():
            try:
                self.model = joblib.load(FAULT_MODEL_PATH)
                self.scaler = joblib.load(FAULT_SCALER_PATH)
                self.encoder = joblib.load(FAULT_ENCODER_PATH)
                self._loaded = True
                logger.info("Fault classifier loaded from disk")
                return
            except Exception as e:
                logger.warning(f"Could not load fault classifier: {e}. Training baseline.")

        self._train_baseline()

    def train_on_synthetic(self, n_samples: int = 5000) -> None:
        """Explicitly train fault classifier on synthetic data and save."""
        self._train_baseline()

    def _generate_training_data(self) -> tuple:
        """Generate synthetic training data for fault classifier"""
        rng = np.random.default_rng(42)
        n_per_class = 2000
        X_list, y_list = [], []

        def healthy_engine(n):
            throttle = rng.uniform(0.3, 0.9, n)
            rpm = 800 + throttle * 5000 + rng.normal(0, 30, n)
            egt = 300 + throttle * 420 + rng.normal(0, 15, n)
            cht = egt * 0.26 + 20 + rng.normal(0, 5, n)
            oil_t = 60 + throttle * 35 + rng.normal(0, 3, n)
            oil_p = 1.0 + throttle * 3.8 + rng.normal(0, 0.15, n)
            ff = throttle * 25 + rng.normal(0, 0.5, n)
            vib = 1.0 + throttle * 0.2 + rng.normal(0, 0.05, n)
            res = rng.normal(0, [30, 15, 5, 3, 0.15, 0.5, 0.05], (n, 7))
            eff = 0.82 + rng.normal(0, 0.02, n)
            tm = 220 - cht
            return np.column_stack([rpm, egt, cht, oil_t, oil_p, ff, vib,
                                    res, egt, cht, vib, oil_p, res[:, 1], res[:, 2], res[:, 6],
                                    rng.normal(0, 3, n), rng.normal(0, 3, n), rng.normal(0, 0.1, n), rng.normal(0, 3, n),
                                    tm, eff])

        def _make_features(rpm, egt, cht, oil_t, oil_p, ff, vib, res, eff, n):
            tm = 220 - cht
            egt_mean = egt + rng.normal(0, 5, n)
            cht_mean = cht + rng.normal(0, 3, n)
            vib_mean = vib + rng.normal(0, 0.05, n)
            oil_mean = oil_p + rng.normal(0, 0.1, n)
            egt_std = np.abs(rng.normal(10, 5, n))
            cht_std = np.abs(rng.normal(5, 2, n))
            vib_std = np.abs(rng.normal(0.05, 0.02, n))
            roc = rng.normal(0, [3, 2, 2, 0.05, 0.05], (n, 5))
            return np.column_stack([
                rpm, egt, cht, oil_t, oil_p, ff, vib,
                res[:, 0], res[:, 1], res[:, 2], res[:, 3], res[:, 4], res[:, 5], res[:, 6],
                egt_mean, cht_mean, vib_mean, oil_mean,
                egt_std, cht_std, vib_std,
                roc[:, 2], roc[:, 1], roc[:, 4], roc[:, 0],
                tm, eff
            ])

        # HEALTHY
        n = n_per_class
        throttle = rng.uniform(0.3, 0.9, n)
        rpm = 800 + throttle * 5000 + rng.normal(0, 30, n)
        egt = 300 + throttle * 420 + rng.normal(0, 15, n)
        cht = egt * 0.26 + 20 + rng.normal(0, 5, n)
        oil_t = 60 + throttle * 35 + rng.normal(0, 3, n)
        oil_p = 1.0 + throttle * 3.8 + rng.normal(0, 0.15, n)
        ff = throttle * 25 + rng.normal(0, 0.5, n)
        vib = 1.0 + throttle * 0.2 + rng.normal(0, 0.05, n)
        res = rng.normal(0, [30, 15, 5, 3, 0.15, 0.5, 0.05], (n, 7))
        eff = 0.82 + rng.normal(0, 0.02, n)
        X_list.append(_make_features(rpm, egt, cht, oil_t, oil_p, ff, vib, res, eff, n))
        y_list.extend(["healthy"] * n)

        # INJECTOR FAULT — EGT deviation, FF deviation, CHT rise, efficiency drop
        deg_inj = rng.uniform(0.2, 0.9, n)
        egt2 = egt + deg_inj * 80 + rng.normal(0, 20, n)
        cht2 = egt2 * 0.26 + 20 + deg_inj * 15 + rng.normal(0, 8, n)
        ff2 = ff * (1 + 0.2 * deg_inj * rng.choice([-1, 1], n))
        vib2 = vib + deg_inj * 0.8 + rng.normal(0, 0.1, n)
        eff2 = eff * (1 - 0.35 * deg_inj)
        res2 = np.column_stack([
            rng.normal(0, 30, n), egt2 - egt, cht2 - cht,
            rng.normal(0, 3, n), rng.normal(0, 0.15, n), ff2 - ff, vib2 - vib
        ])
        X_list.append(_make_features(rpm, egt2, cht2, oil_t, oil_p, ff2, vib2, res2, eff2, n))
        y_list.extend(["injector"] * n)

        # COOLING FAULT — CHT rise, thermal margin decrease
        deg_cool = rng.uniform(0.2, 0.9, n)
        cht3 = cht + deg_cool * 40 + rng.normal(0, 10, n)
        egt3 = egt + deg_cool * 20 + rng.normal(0, 10, n)
        res3 = np.column_stack([
            rng.normal(0, 30, n), egt3 - egt, cht3 - cht,
            rng.normal(0, 3, n), rng.normal(0, 0.15, n), rng.normal(0, 0.5, n), rng.normal(0, 0.05, n)
        ])
        eff3 = eff - rng.normal(0, 0.02, n)
        X_list.append(_make_features(rpm, egt3, cht3, oil_t, oil_p, ff, vib, res3, eff3, n))
        y_list.extend(["cooling"] * n)

        # LUBRICATION FAULT — oil pressure drop, oil temp rise, vibration increase
        deg_lub = rng.uniform(0.2, 0.9, n)
        oil_t4 = oil_t + deg_lub * 25 + rng.normal(0, 5, n)
        oil_p4 = oil_p * (1 - 0.5 * deg_lub) + rng.normal(0, 0.1, n)
        oil_p4 = np.maximum(0.3, oil_p4)
        vib4 = vib + deg_lub * 1.0 + rng.normal(0, 0.15, n)
        res4 = np.column_stack([
            rng.normal(0, 30, n), rng.normal(0, 15, n), rng.normal(0, 5, n),
            oil_t4 - oil_t, oil_p4 - oil_p, rng.normal(0, 0.5, n), vib4 - vib
        ])
        X_list.append(_make_features(rpm, egt, cht, oil_t4, oil_p4, ff, vib4, res4, eff, n))
        y_list.extend(["lubrication"] * n)

        # COMBUSTION FAULT — EGT fluctuation, RPM instability, vibration
        deg_comb = rng.uniform(0.2, 0.9, n)
        egt5 = egt + deg_comb * 60 + rng.normal(0, 30 * deg_comb, n)
        rpm5 = rpm - deg_comb * 200 + rng.normal(0, 50 * deg_comb, n)
        vib5 = vib + deg_comb * 1.5 + rng.normal(0, 0.2, n)
        res5 = np.column_stack([
            rpm5 - rpm, egt5 - egt, rng.normal(0, 5, n),
            rng.normal(0, 3, n), rng.normal(0, 0.15, n), rng.normal(0, 0.5, n), vib5 - vib
        ])
        X_list.append(_make_features(rpm5, egt5, cht, oil_t, oil_p, ff, vib5, res5, eff, n))
        y_list.extend(["combustion"] * n)

        # MECHANICAL FAULT — vibration increase, efficiency drop
        deg_mech = rng.uniform(0.2, 0.9, n)
        vib6 = vib + deg_mech * 2.5 + rng.normal(0, 0.3, n)
        eff6 = eff * (1 - 0.3 * deg_mech)
        rpm6 = rpm * (1 - 0.15 * deg_mech) + rng.normal(0, 50, n)
        res6 = np.column_stack([
            rpm6 - rpm, rng.normal(0, 15, n), rng.normal(0, 5, n),
            rng.normal(0, 3, n), rng.normal(0, 0.15, n), rng.normal(0, 0.5, n), vib6 - vib
        ])
        X_list.append(_make_features(rpm6, egt, cht, oil_t, oil_p, ff, vib6, res6, eff6, n))
        y_list.extend(["mechanical"] * n)

        # SENSOR FAULT — frozen/spike/drift — sensor value very different from twins
        # Characterised by large residuals in one sensor but others remain normal
        sensor_res = rng.normal(0, [500, 200, 50, 30, 3, 5, 2], (n, 7))
        # Only one sensor per sample has large residual
        for i in range(n):
            sensor_idx = rng.integers(0, 7)
            sensor_res[i, :] = rng.normal(0, 2, 7)  # mostly normal
            sensor_res[i, sensor_idx] = rng.choice([-1, 1]) * rng.uniform(3, 10) * [500, 200, 50, 30, 3, 5, 2][sensor_idx]
        X_list.append(_make_features(rpm, egt, cht, oil_t, oil_p, ff, vib, sensor_res, eff, n))
        y_list.extend(["sensor"] * n)

        X = np.vstack(X_list)
        y = np.array(y_list)

        # Replace NaN/Inf
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
        return X, y

    def _train_baseline(self) -> None:
        logger.info("Training baseline fault classifier on synthetic data...")
        X, y = self._generate_training_data()

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        self.scaler = StandardScaler()
        X_train_s = self.scaler.fit_transform(X_train)
        X_test_s = self.scaler.transform(X_test)

        self.encoder = LabelEncoder()
        y_train_e = self.encoder.fit_transform(y_train)
        y_test_e = self.encoder.transform(y_test)

        self.model = RandomForestClassifier(
            n_estimators=300,
            max_depth=15,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1,
            class_weight="balanced",
        )
        self.model.fit(X_train_s, y_train_e)

        # Log metrics
        y_pred = self.model.predict(X_test_s)
        y_pred_labels = self.encoder.inverse_transform(y_pred)
        logger.info("Fault classifier training metrics:\n" + classification_report(y_test, y_pred_labels))

        # Save
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, FAULT_MODEL_PATH)
        joblib.dump(self.scaler, FAULT_SCALER_PATH)
        joblib.dump(self.encoder, FAULT_ENCODER_PATH)
        self._loaded = True
        logger.info("Fault classifier trained and saved")

    def _build_features(
        self,
        actual: Dict[str, float],
        residual: Dict[str, float],
        rolling: Dict[str, float],
        thermal_margin: float = 20.0,
        efficiency: float = 0.82,
    ) -> np.ndarray:
        def sg(d, k):
            v = d.get(k, 0.0)
            return float(v) if v is not None and np.isfinite(v) else 0.0

        return np.array([
            sg(actual, "rpm"), sg(actual, "egt_c"), sg(actual, "cht_c"),
            sg(actual, "oil_temp_c"), sg(actual, "oil_pressure_bar"),
            sg(actual, "fuel_flow_lph"), sg(actual, "vibration"),
            sg(residual, "rpm"), sg(residual, "egt_c"), sg(residual, "cht_c"),
            sg(residual, "oil_temp_c"), sg(residual, "oil_pressure_bar"),
            sg(residual, "fuel_flow_lph"), sg(residual, "vibration"),
            sg(rolling, "egt_c_mean"), sg(rolling, "cht_c_mean"),
            sg(rolling, "vibration_mean"), sg(rolling, "oil_pressure_bar_mean"),
            sg(rolling, "egt_c_std"), sg(rolling, "cht_c_std"), sg(rolling, "vibration_std"),
            sg(rolling, "egt_c_roc"), sg(rolling, "cht_c_roc"),
            sg(rolling, "vibration_roc"), sg(rolling, "rpm_roc"),
            thermal_margin, efficiency,
        ], dtype=np.float32)

    def predict(
        self,
        actual: Dict[str, float],
        residual: Dict[str, float],
        rolling: Dict[str, float],
        thermal_margin: float = 20.0,
        efficiency: float = 0.82,
    ) -> Dict[str, float]:
        """
        Predict fault class probabilities.

        Returns dict mapping fault class → probability.
        """
        if not self._loaded or self.model is None:
            return {c: 1.0 / len(FAULT_CLASSES) for c in FAULT_CLASSES}

        try:
            fv = self._build_features(actual, residual, rolling, thermal_margin, efficiency)
            fv = np.nan_to_num(fv, nan=0.0)
            fv_scaled = self.scaler.transform(fv.reshape(1, -1))
            proba = self.model.predict_proba(fv_scaled)[0]
            classes = self.encoder.classes_

            result = {str(c): round(float(p), 4) for c, p in zip(classes, proba)}
            # Ensure all fault classes present
            for fc in FAULT_CLASSES:
                if fc not in result:
                    result[fc] = 0.0
            return result
        except Exception as e:
            logger.error(f"Fault classification error: {e}")
            return {c: 1.0 / len(FAULT_CLASSES) for c in FAULT_CLASSES}

    def get_top_fault(self, probabilities: Dict[str, float]) -> tuple[str, float]:
        """Return (fault_class, probability) for highest probability class"""
        if not probabilities:
            return "healthy", 1.0
        top = max(probabilities, key=probabilities.get)
        return top, probabilities[top]

    def get_feature_names(self) -> List[str]:
        return FEATURE_NAMES
