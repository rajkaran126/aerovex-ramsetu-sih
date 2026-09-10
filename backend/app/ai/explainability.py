"""
AERO-TWIN — SHAP Explainability

Provides SHAP (SHapley Additive exPlanations) for the Random Forest
fault classifier. Returns feature importance for the predicted class.

DISCLAIMER: SHAP values reflect model attribution, not physical causality.
They explain which features most influenced THIS prediction.
"""

import numpy as np
import shap
import logging
from typing import Dict, List, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

FEATURE_DISPLAY_NAMES = {
    "rpm": "RPM",
    "egt_c": "EGT (°C)",
    "cht_c": "CHT (°C)",
    "oil_temp_c": "Oil Temp (°C)",
    "oil_pressure_bar": "Oil Pressure (bar)",
    "fuel_flow_lph": "Fuel Flow (L/hr)",
    "vibration": "Vibration Index",
    "res_rpm": "RPM Residual",
    "res_egt_c": "EGT Residual",
    "res_cht_c": "CHT Residual",
    "res_oil_temp_c": "Oil Temp Residual",
    "res_oil_pressure_bar": "Oil Pressure Residual",
    "res_fuel_flow_lph": "Fuel Flow Residual",
    "res_vibration": "Vibration Residual",
    "egt_c_mean": "EGT Rolling Mean",
    "cht_c_mean": "CHT Rolling Mean",
    "vibration_mean": "Vibration Rolling Mean",
    "oil_pres_mean": "Oil Pressure Rolling Mean",
    "egt_c_std": "EGT Rolling Std",
    "cht_c_std": "CHT Rolling Std",
    "vibration_std": "Vibration Rolling Std",
    "egt_c_roc": "EGT Rate of Change",
    "cht_c_roc": "CHT Rate of Change",
    "vibration_roc": "Vibration Rate of Change",
    "rpm_roc": "RPM Rate of Change",
    "thermal_margin": "Thermal Margin",
    "efficiency": "Engine Efficiency",
}


class ExplainabilityEngine:
    """
    SHAP-based explainability for fault classifier.

    Uses TreeExplainer for fast, exact SHAP values on Random Forest.
    """

    def __init__(self, fault_classifier):
        self._classifier = fault_classifier
        self._explainer: Optional[shap.TreeExplainer] = None
        self._background_data: Optional[np.ndarray] = None
        self._initialized = False

    def _ensure_initialized(self) -> bool:
        """Lazy initialization of SHAP explainer"""
        if self._initialized:
            return True
        if self._classifier.model is None:
            return False

        try:
            # TreeExplainer works directly on RandomForest without background data
            self._explainer = shap.TreeExplainer(self._classifier.model)
            self._initialized = True
            logger.info("SHAP TreeExplainer initialized")
            return True
        except Exception as e:
            logger.warning(f"SHAP init failed: {e}")
            return False

    def explain(
        self,
        actual: Dict[str, float],
        residual: Dict[str, float],
        rolling: Dict[str, float],
        thermal_margin: float = 20.0,
        efficiency: float = 0.82,
        fault_probabilities: Optional[Dict[str, float]] = None,
    ) -> Dict:
        """
        Compute SHAP values for the current prediction.

        Returns top contributing features for the predicted fault class.
        """
        if not self._ensure_initialized():
            return self._fallback_explanation(fault_probabilities)

        try:
            fv = self._classifier._build_features(actual, residual, rolling, thermal_margin, efficiency)
            fv = np.nan_to_num(fv, nan=0.0)
            fv_scaled = self._classifier.scaler.transform(fv.reshape(1, -1))

            # Compute SHAP values [n_classes, n_features]
            shap_values = self._explainer.shap_values(fv_scaled)

            # Determine predicted class index
            if fault_probabilities:
                top_fault = max(fault_probabilities, key=fault_probabilities.get)
                classes = list(self._classifier.encoder.classes_)
                if top_fault in classes:
                    class_idx = classes.index(top_fault)
                else:
                    class_idx = 0
            else:
                pred = self._classifier.model.predict(fv_scaled)[0]
                class_idx = int(pred)
                top_fault = self._classifier.encoder.classes_[class_idx]

            # SHAP for predicted class
            if isinstance(shap_values, list):
                class_shap = shap_values[class_idx][0]
            elif isinstance(shap_values, np.ndarray) and shap_values.ndim == 3:
                # Shape is (n_samples, n_features, n_classes)
                class_shap = shap_values[0, :, class_idx]
            elif isinstance(shap_values, np.ndarray) and shap_values.ndim == 2:
                class_shap = shap_values[0]
            else:
                class_shap = np.zeros(len(self._classifier.get_feature_names()))

            feature_names = self._classifier.get_feature_names()

            # Build feature importance list
            contributions = []
            for i, (name, sv) in enumerate(zip(feature_names, class_shap)):
                display_name = FEATURE_DISPLAY_NAMES.get(name, name)
                contributions.append({
                    "feature": name,
                    "display_name": display_name,
                    "shap_value": round(float(sv), 4),
                    "abs_shap": round(float(abs(sv)), 4),
                    "direction": "positive" if sv > 0 else "negative",
                    "feature_value": round(float(fv[i]), 3),
                })

            # Sort by |SHAP|
            contributions.sort(key=lambda x: x["abs_shap"], reverse=True)
            top_features = contributions[:8]

            return {
                "predicted_fault": top_fault,
                "confidence": round(float(fault_probabilities.get(top_fault, 0.0)) if fault_probabilities else 0.5, 3),
                "shap_values": top_features,
                "explanation_method": "SHAP TreeExplainer (Random Forest)",
                "disclaimer": "SHAP values reflect model attribution, not physical causality",
            }

        except Exception as e:
            logger.error(f"SHAP explanation error: {e}")
            return self._fallback_explanation(fault_probabilities)

    def _fallback_explanation(self, fault_probabilities: Optional[Dict] = None) -> Dict:
        """Return feature-importance-based explanation when SHAP fails"""
        top_fault = "healthy"
        confidence = 0.5

        if fault_probabilities:
            top_fault = max(fault_probabilities, key=fault_probabilities.get)
            confidence = fault_probabilities[top_fault]

        # Use model feature importances as fallback
        if self._classifier.model and hasattr(self._classifier.model, "feature_importances_"):
            importances = self._classifier.model.feature_importances_
            feature_names = self._classifier.get_feature_names()
            contributions = [
                {
                    "feature": name,
                    "display_name": FEATURE_DISPLAY_NAMES.get(name, name),
                    "shap_value": round(float(imp), 4),
                    "abs_shap": round(float(imp), 4),
                    "direction": "positive",
                    "feature_value": 0.0,
                }
                for name, imp in zip(feature_names, importances)
            ]
            contributions.sort(key=lambda x: x["abs_shap"], reverse=True)
            top_features = contributions[:8]
        else:
            top_features = [
                {"feature": "egt_c", "display_name": "EGT (°C)", "shap_value": 0.3, "abs_shap": 0.3, "direction": "positive", "feature_value": 0.0},
                {"feature": "res_egt_c", "display_name": "EGT Residual", "shap_value": 0.25, "abs_shap": 0.25, "direction": "positive", "feature_value": 0.0},
            ]

        return {
            "predicted_fault": top_fault,
            "confidence": round(confidence, 3),
            "shap_values": top_features,
            "explanation_method": "Feature Importance (SHAP unavailable)",
            "disclaimer": "SHAP values reflect model attribution, not physical causality",
        }
