"""
AERO-TWIN — NASA N-CMAPSS Dataset Adapter

Handles loading and feature preparation for NASA N-CMAPSS HDF5 datasets.
Initially supports N-CMAPSS_DS02-006.h5 with extensible interface for DS01/DS03/etc.

NOTE: N-CMAPSS contains commercial turbofan flight-condition records,
used exclusively for deep sequence degradation modeling & RUL comparison.
"""

import os
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class NCMAPSSAdapter:
    """Adapter for NASA N-CMAPSS HDF5 datasets."""

    def __init__(self, raw_dir: Optional[Path] = None, processed_dir: Optional[Path] = None):
        repo_root = Path(__file__).resolve().parent.parent.parent.parent
        self.raw_dir = raw_dir or (repo_root / "data" / "raw" / "n_cmapss")
        self.processed_dir = processed_dir or (repo_root / "data" / "processed" / "n_cmapss")
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def is_available(self) -> bool:
        """Check if at least one N-CMAPSS h5 file exists."""
        return len(list(self.raw_dir.glob("*.h5"))) > 0

    def get_available_files(self) -> List[str]:
        return [f.name for f in self.raw_dir.glob("*.h5")]

    def load_dataset(self, filename: str = "N-CMAPSS_DS02-006.h5") -> Optional[Dict[str, Any]]:
        """
        Load an N-CMAPSS HDF5 dataset file.
        Requires 'h5py' when available.
        """
        file_path = self.raw_dir / filename
        if not file_path.exists():
            logger.info(f"N-CMAPSS file {filename} not present in {self.raw_dir}")
            return None

        try:
            import h5py
            with h5py.File(file_path, "r") as hdf:
                keys = list(hdf.keys())
                logger.info(f"Loaded N-CMAPSS file {filename} with keys: {keys}")
                return {"filename": filename, "keys": keys, "status": "loaded"}
        except ImportError:
            logger.warning("h5py is not installed; N-CMAPSS parsing requires h5py")
            return {"filename": filename, "status": "h5py_missing"}
        except Exception as e:
            logger.error(f"Error loading {filename}: {e}")
            return None

    def get_status(self) -> Dict:
        available_files = self.get_available_files()
        available = len(available_files) > 0
        return {
            "status": "ready" if available else "awaiting_files",
            "available": available,
            "type": "external",
            "domain": "turbofan",
            "files_available": available_files,
            "path": str(self.raw_dir),
        }
