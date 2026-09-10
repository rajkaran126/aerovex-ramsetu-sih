"""
AERO-TWIN — ML Olympiad Predictive Maintenance Dataset Adapter

Handles loading, schema validation, and feature preparation for the
ML Olympiad Predictive Maintenance competition dataset.

CRITICAL INSTRUCTION:
- Use `train_set.csv` and `test_set.csv`.
- Do NOT train using `sample_submission.csv`.
"""

import os
import logging
import pandas as pd
from typing import Dict, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)


class MLOlympiadAdapter:
    """Adapter for ML Olympiad Predictive Maintenance multivariate time-series dataset."""

    def __init__(self, raw_dir: Optional[Path] = None, processed_dir: Optional[Path] = None):
        repo_root = Path(__file__).resolve().parent.parent.parent.parent
        self.raw_dir = raw_dir or (repo_root / "data" / "raw" / "ml_olympiad")
        self.processed_dir = processed_dir or (repo_root / "data" / "processed" / "ml_olympiad")
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def is_available(self) -> bool:
        """Check if train_set.csv exists."""
        return (self.raw_dir / "train_set.csv").exists()

    def load_dataset(self) -> Optional[Tuple[pd.DataFrame, Optional[pd.DataFrame]]]:
        """
        Load train and test sets.
        Excludes sample_submission.csv from training pipeline.
        """
        train_path = self.raw_dir / "train_set.csv"
        test_path = self.raw_dir / "test_set.csv"

        if not train_path.exists():
            logger.info(f"ML Olympiad train_set.csv not present in {self.raw_dir}")
            return None

        train_df = pd.read_csv(train_path)
        test_df = pd.read_csv(test_path) if test_path.exists() else None

        logger.info(f"Loaded ML Olympiad dataset: {len(train_df)} train records")
        return train_df, test_df

    def get_status(self) -> Dict:
        available = self.is_available()
        return {
            "status": "ready" if available else "awaiting_files",
            "available": available,
            "type": "external",
            "domain": "turbofan",
            "has_train": (self.raw_dir / "train_set.csv").exists(),
            "has_test": (self.raw_dir / "test_set.csv").exists(),
            "path": str(self.raw_dir),
        }
