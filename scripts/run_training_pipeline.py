#!/usr/bin/env python
import os
import sys
from pathlib import Path

# Run backend training pipeline
repo_root = Path(__file__).resolve().parent.parent
backend_script = repo_root / "backend" / "scripts" / "run_training_pipeline.py"

if __name__ == "__main__":
    os.system(f'python "{backend_script}"')
