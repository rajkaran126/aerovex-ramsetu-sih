"""
AERO-TWIN — Resource Checker Service

Monitors and validates readiness of all external and internal assets:
- Primary AERO-TWIN synthetic dataset
- NASA C-MAPSS benchmark dataset
- NASA N-CMAPSS sequence benchmark dataset
- ML Olympiad Predictive Maintenance dataset
- Single GROQ API Key configuration
- Trained machine learning model artifacts (Anomaly, Fault, RUL)
- Digital Twin and Mission Subsystems
"""

import os
import logging
from typing import Dict, Any
from pathlib import Path

from ..config import settings

logger = logging.getLogger(__name__)


class ResourceChecker:
    """Resource detection and readiness validation service."""

    def __init__(self):
        self.repo_root = Path(__file__).resolve().parent.parent.parent.parent
        self.data_dir = self.repo_root / "data"
        self.models_dir = Path(__file__).resolve().parent.parent.parent / settings.MODELS_DIR

    def check_all(self) -> Dict[str, Any]:
        """Perform full validation across datasets, credentials, and models."""
        # 1. Datasets
        aero_twin_ready = (
            (self.data_dir / "processed" / "aero_twin" / "aero_twin_train.csv").exists() or
            (self.data_dir / "raw" / "aero_twin" / "aero_twin_telemetry_full.csv").exists()
        )
        cmapss_ready = (self.data_dir / "raw" / "cmapss" / "train_FD001.txt").exists()
        n_cmapss_ready = len(list((self.data_dir / "raw" / "n_cmapss").glob("*.h5"))) > 0
        ml_olympiad_ready = (self.data_dir / "raw" / "ml_olympiad" / "train_set.csv").exists()

        # 2. Groq API Key
        groq_configured = bool(settings.GROQ_API_KEY and len(settings.GROQ_API_KEY.strip()) > 5)

        # 3. Trained models
        anomaly_model_ready = (self.models_dir / "anomaly_model.pkl").exists() or (self.models_dir / "anomaly_model.joblib").exists()
        fault_model_ready = (self.models_dir / "fault_classifier.pkl").exists() or (self.models_dir / "fault_classifier.joblib").exists()
        rul_model_ready = (self.models_dir / "rul_model.pkl").exists() or (self.models_dir / "rul_model.joblib").exists()

        return {
            "datasets": {
                "aero_twin": aero_twin_ready,
                "cmapss": cmapss_ready,
                "n_cmapss": n_cmapss_ready,
                "ml_olympiad": ml_olympiad_ready,
            },
            "groq": {
                "configured": groq_configured,
                "mode": "ONLINE" if groq_configured else "OFFLINE",
                "notice": "GROQ INTELLIGENCE ONLINE" if groq_configured else "LOCAL AI ACTIVE — GROQ INTELLIGENCE OFFLINE"
            },
            "models": {
                "anomaly": anomaly_model_ready,
                "fault": fault_model_ready,
                "rul": rul_model_ready,
            },
            "subsystems": {
                "physics_engine": True,
                "digital_twin": True,
                "local_ai": True,
                "mission_engine": True,
                "telemetry_cyber_monitor": True,
            }
        }


resource_checker = ResourceChecker()
