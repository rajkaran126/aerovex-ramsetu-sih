"""AERO-TWIN Backend — Application Configuration"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AERO-TWIN"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./aero_twin.db"

    # Simulation
    SIMULATION_FREQUENCY_HZ: float = 1.0
    DEFAULT_SPEED_MULTIPLIER: float = 1.0

    # Health thresholds
    HEALTH_HEALTHY_MIN: float = 80.0
    HEALTH_DEGRADED_MIN: float = 60.0
    HEALTH_WARNING_MIN: float = 40.0
    HEALTH_CRITICAL_MIN: float = 20.0

    # Mission risk thresholds
    RISK_HIGH_HEALTH: float = 40.0
    RISK_MEDIUM_HEALTH: float = 65.0

    # RUL EOL threshold (health below this = end of life)
    RUL_EOL_HEALTH_THRESHOLD: float = 20.0

    # Sensor noise
    SENSOR_NOISE_FACTOR: float = 1.0

    # CORS
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000"]

    # Groq LLM Configuration
    GROQ_API_KEY: Optional[str] = None
    ENGINE_AGENT_MODEL: str = "llama-3.3-70b-versatile"
    SECURITY_AGENT_MODEL: str = "llama-3.3-70b-versatile"
    MISSION_AGENT_MODEL: str = "llama-3.3-70b-versatile"
    MAINTENANCE_AGENT_MODEL: str = "llama-3.3-70b-versatile"
    ORCHESTRATOR_MODEL: str = "llama-3.3-70b-versatile"

    # Dataset directory paths
    DATA_DIR: str = "../data"
    MODELS_DIR: str = "models_saved"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
