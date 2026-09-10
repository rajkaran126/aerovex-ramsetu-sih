"""
AERO-TWIN — Primary Synthetic Aero-Piston Dataset Generator

Generates high-fidelity aero-piston engine flight telemetry data for MALE UAVs.
Variables generated:
- Flight & Environment: altitude_ft, ambient_temp_c, ambient_pressure_kpa, air_density_kgm3
- Pilot Demands: throttle, rpm_target, engine_load
- Core Engine Telemetry: rpm, torque_nm, power_kw, egt_c, cht_c, oil_temp_c, oil_pressure_bar, fuel_flow_lph, vibration
- Health & Thermodynamics: thermal_margin, efficiency, health_index
- Degradation State: deg_injector, deg_cooling, deg_lubrication, deg_mechanical
- Labels: fault_class, anomaly_flag, rul_hours, mission_profile, sensor_anomaly_type
"""

import os
import json
import logging
import numpy as np
import pandas as pd
from typing import Dict, Tuple, Optional
from pathlib import Path

from ..digital_twin.engine_model import AeroPistonEngineModel, EngineInputs, DegradationState
from ..digital_twin.health_index import compute_health_index

logger = logging.getLogger(__name__)


class AeroTwinDatasetGenerator:
    """Generates synthetic aero-piston engine telemetry and run-to-failure records."""

    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            # Default to repo root / data
            repo_root = Path(__file__).resolve().parent.parent.parent.parent
            self.data_dir = repo_root / "data"
        else:
            self.data_dir = Path(data_dir)

        self.raw_dir = self.data_dir / "raw" / "aero_twin"
        self.proc_dir = self.data_dir / "processed" / "aero_twin"
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.proc_dir.mkdir(parents=True, exist_ok=True)

        self.model = AeroPistonEngineModel()

    def generate(self, n_samples: int = 5000, random_seed: int = 42) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Generate full synthetic dataset with normal, degraded, and fault conditions."""
        np.random.seed(random_seed)
        logger.info(f"Generating AERO-TWIN synthetic dataset with {n_samples} samples...")

        records = []
        fault_classes = ["healthy", "injector", "cooling", "lubrication", "combustion", "mechanical", "sensor"]

        profiles = ["ISR", "TRANSIT", "HIGH_ALTITUDE", "LOITER", "DESERT_PATROL"]

        for i in range(n_samples):
            # Sample operational condition
            profile = np.random.choice(profiles)
            if profile == "HIGH_ALTITUDE":
                alt = float(np.random.uniform(15000, 25000))
                throttle = float(np.random.uniform(0.70, 0.95))
            elif profile == "LOITER":
                alt = float(np.random.uniform(3000, 8000))
                throttle = float(np.random.uniform(0.40, 0.60))
            else:
                alt = float(np.random.uniform(1000, 16000))
                throttle = float(np.random.uniform(0.50, 0.85))

            ambient_temp = float(15.0 - (alt / 1000.0) * 1.98 + np.random.normal(0, 3))
            if profile == "DESERT_PATROL":
                ambient_temp += float(np.random.uniform(15, 25))

            # Inject fault or healthy
            is_fault = np.random.rand() > 0.45
            fault = "healthy"
            severity = 0.0

            deg = DegradationState()
            sensor_anomaly_type = "none"

            if is_fault:
                fault = np.random.choice(fault_classes[1:])
                severity = float(np.random.uniform(0.2, 1.0))

                if fault == "injector":
                    deg.injector = severity
                elif fault == "cooling":
                    deg.cooling = severity
                elif fault == "lubrication":
                    deg.lubrication = severity
                elif fault == "mechanical":
                    deg.mechanical = severity
                elif fault == "combustion":
                    deg.combustion = severity
                    deg.injector = severity * 0.5
                    deg.mechanical = severity * 0.5
                elif fault == "sensor":
                    sensor_anomaly_type = np.random.choice(["spike", "drift", "freeze", "noise"])

            rpm_target = float(2000 + throttle * 3800)
            engine_load = float(throttle * (1.0 - (alt / 35000.0) * 0.3))

            inputs = EngineInputs(
                throttle=throttle,
                rpm_target=rpm_target,
                altitude_ft=alt,
                ambient_temp_c=ambient_temp,
                engine_load=engine_load,
                degradation=deg,
            )

            outputs = self.model.compute(inputs)

            # Health calculation
            res_mag = severity * 0.8 if is_fault else np.random.exponential(0.05)
            anomaly_score = min(1.0, severity * 0.9 + np.random.normal(0, 0.05)) if is_fault else float(np.random.uniform(0.02, 0.25))
            health = compute_health_index(
                residual_magnitude=res_mag,
                degradation=deg.to_dict(),
                thermal_margin=outputs.thermal_margin,
                vibration=outputs.vibration,
                oil_pressure=outputs.oil_pressure_bar,
                anomaly_score=anomaly_score,
            )

            # RUL calculation: healthy engines ~100-150h; high degradation ~5-30h
            base_rul = 120.0 * (health / 100.0) ** 1.3
            rul_hours = max(0.5, float(base_rul + np.random.normal(0, 3.0)))

            rec = {
                "sample_id": i,
                "mission_profile": profile,
                "altitude_ft": round(alt, 1),
                "ambient_temp_c": round(ambient_temp, 1),
                "throttle": round(throttle, 3),
                "engine_load": round(engine_load, 3),
                "rpm": round(outputs.rpm, 1),
                "torque_nm": round(outputs.torque_nm, 1),
                "power_kw": round(outputs.power_kw, 1),
                "egt_c": round(outputs.egt_c, 1),
                "cht_c": round(outputs.cht_c, 1),
                "oil_temp_c": round(outputs.oil_temp_c, 1),
                "oil_pressure_bar": round(outputs.oil_pressure_bar, 2),
                "fuel_flow_lph": round(outputs.fuel_flow_lph, 2),
                "vibration": round(outputs.vibration, 3),
                "thermal_margin": round(outputs.thermal_margin, 2),
                "efficiency": round(outputs.efficiency, 3),
                "deg_injector": round(deg.injector, 3),
                "deg_cooling": round(deg.cooling, 3),
                "deg_lubrication": round(deg.lubrication, 3),
                "deg_mechanical": round(deg.mechanical, 3),
                "health_index": round(health, 2),
                "anomaly_flag": int(is_fault and severity > 0.3),
                "anomaly_score": round(anomaly_score, 3),
                "fault_class": fault,
                "fault_severity": round(severity, 2),
                "sensor_anomaly_type": sensor_anomaly_type,
                "rul_hours": round(rul_hours, 2),
            }
            records.append(rec)

        df = pd.DataFrame(records)

        # Train/test split (80/20)
        train_idx = int(0.8 * len(df))
        df_train = df.iloc[:train_idx].copy()
        df_test = df.iloc[train_idx:].copy()

        # Save files
        df.to_csv(self.raw_dir / "aero_twin_telemetry_full.csv", index=False)
        df_train.to_csv(self.proc_dir / "aero_twin_train.csv", index=False)
        df_test.to_csv(self.proc_dir / "aero_twin_test.csv", index=False)

        # Save metadata summary
        meta = {
            "dataset_name": "AERO-TWIN Synthetic Aero-Piston Telemetry",
            "total_samples": len(df),
            "train_samples": len(df_train),
            "test_samples": len(df_test),
            "features": list(df.columns),
            "fault_distribution": df["fault_class"].value_counts().to_dict(),
            "mean_rul": float(df["rul_hours"].mean()),
            "domain": "aero-piston",
        }
        with open(self.proc_dir / "metadata.json", "w") as f:
            json.dump(meta, f, indent=2)

        logger.info(f"AERO-TWIN dataset generated: {len(df)} samples saved to {self.proc_dir}")
        return df_train, df_test


if __name__ == "__main__":
    generator = AeroTwinDatasetGenerator()
    generator.generate(5000)
