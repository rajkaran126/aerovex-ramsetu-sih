"""
AERO-TWIN — NASA C-MAPSS Dataset Adapter

Handles loading, schema validation, normalization, and RUL target calculation
for NASA C-MAPSS Turbofan Engine Run-to-Failure dataset.

NOTE: C-MAPSS is turbofan engine simulation data (not aero-piston).
It is utilized strictly for RUL and degradation benchmarking against the digital twin.
"""

import os
import logging
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

CMAPSS_COLUMNS = [
    "unit_nr", "time_cycles", "setting_1", "setting_2", "setting_3",
    "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10",
    "s11", "s12", "s13", "s14", "s15", "s16", "s17", "s18", "s19", "s20", "s21"
]


class CMAPSSAdapter:
    """Adapter for NASA C-MAPSS turbofan benchmark dataset."""

    def __init__(self, raw_dir: Optional[Path] = None, processed_dir: Optional[Path] = None):
        repo_root = Path(__file__).resolve().parent.parent.parent.parent
        self.raw_dir = raw_dir or (repo_root / "data" / "raw" / "cmapss")
        self.processed_dir = processed_dir or (repo_root / "data" / "processed" / "cmapss")
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def is_available(self) -> bool:
        """Check if at least FD001 train/test files are present."""
        train_file = self.raw_dir / "train_FD001.txt"
        test_file = self.raw_dir / "test_FD001.txt"
        return train_file.exists() and test_file.exists()

    def get_available_subsets(self) -> List[str]:
        """Return list of available sub-datasets (e.g. FD001, FD002, etc.)."""
        subsets = []
        for fd in ["FD001", "FD002", "FD003", "FD004"]:
            if (self.raw_dir / f"train_{fd}.txt").exists():
                subsets.append(fd)
        return subsets

    def load_subset(self, subset: str = "FD001") -> Optional[Tuple[pd.DataFrame, pd.DataFrame]]:
        """
        Load train and test data for a given subset (e.g. FD001).
        Computes RUL targets for training.
        """
        if not (self.raw_dir / f"train_{subset}.txt").exists():
            logger.info(f"C-MAPSS {subset} files not found in {self.raw_dir}")
            return None

        train_path = self.raw_dir / f"train_{subset}.txt"
        test_path = self.raw_dir / f"test_{subset}.txt"
        rul_path = self.raw_dir / f"RUL_{subset}.txt"

        train_df = pd.read_csv(train_path, sep=r"\s+", header=None, names=CMAPSS_COLUMNS)
        test_df = pd.read_csv(test_path, sep=r"\s+", header=None, names=CMAPSS_COLUMNS)

        # Compute RUL for training data: max_cycle - current_cycle
        max_cycle = train_df.groupby("unit_nr")["time_cycles"].max().reset_index()
        max_cycle.columns = ["unit_nr", "max_cycles"]
        train_df = train_df.merge(max_cycle, on="unit_nr", how="left")
        train_df["RUL"] = train_df["max_cycles"] - train_df["time_cycles"]
        train_df.drop(columns=["max_cycles"], inplace=True)

        # Cap piecewise linear RUL at 125 cycles (standard C-MAPSS benchmark practice)
        train_df["RUL_clipped"] = train_df["RUL"].clip(upper=125)

        # Save processed copy
        train_df.to_parquet(self.processed_dir / f"cmapss_{subset}_train.parquet", index=False)
        test_df.to_parquet(self.processed_dir / f"cmapss_{subset}_test.parquet", index=False)

        logger.info(f"Processed C-MAPSS {subset}: {len(train_df)} train records, {len(test_df)} test records")
        return train_df, test_df

    def get_status(self) -> Dict:
        """Get status dictionary for registry."""
        subsets = self.get_available_subsets()
        available = len(subsets) > 0
        return {
            "status": "ready" if available else "awaiting_files",
            "available": available,
            "type": "external",
            "domain": "turbofan",
            "subsets_available": subsets,
            "path": str(self.raw_dir),
            "records": sum(len(pd.read_parquet(self.processed_dir / f"cmapss_{s}_train.parquet")) for s in subsets if (self.processed_dir / f"cmapss_{s}_train.parquet").exists()) if available else 0
        }
