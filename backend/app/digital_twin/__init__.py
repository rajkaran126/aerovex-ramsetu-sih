"""
AERO-TWIN — Digital Twin Package
"""

from .engine_model import AeroPistonEngineModel, EngineInputs, EngineOutputs, DegradationState
from .state_estimator import StateEstimator, TwinState, ResidualState
from .residual_engine import ResidualEngine, ResidualSnapshot
from .health_index import compute_health_index, health_breakdown, HealthConfig, DEFAULT_CONFIG

__all__ = [
    "AeroPistonEngineModel",
    "EngineInputs",
    "EngineOutputs",
    "DegradationState",
    "StateEstimator",
    "TwinState",
    "ResidualState",
    "ResidualEngine",
    "ResidualSnapshot",
    "compute_health_index",
    "health_breakdown",
    "HealthConfig",
    "DEFAULT_CONFIG",
]
