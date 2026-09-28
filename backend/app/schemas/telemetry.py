"""
AERO-TWIN — Unified Telemetry Schema
Canonical data contract for cyber-physical engine telemetry and MALE UAV states.
Complies with Section 4 of the Master Implementation Specification.
"""

from enum import Enum
from typing import Dict, Optional, Any
from pydantic import BaseModel, Field


class TelemetrySource(str, Enum):
    PHYSICAL = "physical"
    SIMULATION = "simulation"
    FAULT_INJECTION = "fault_injection"
    RECONSTRUCTED = "reconstructed"


class MissionPhase(str, Enum):
    PREFLIGHT = "PREFLIGHT"
    TAKEOFF = "TAKEOFF"
    CLIMB = "CLIMB"
    CRUISE = "CRUISE"
    LOITER_ISR = "LOITER_ISR"
    DESCENT = "DESCENT"
    APPROACH = "APPROACH"
    LANDING = "LANDING"
    EMERGENCY_DIVERT = "EMERGENCY_DIVERT"


class SensorConfidenceMap(BaseModel):
    rpm: float = Field(default=1.0, ge=0.0, le=1.0)
    map: float = Field(default=1.0, ge=0.0, le=1.0)
    cht: float = Field(default=1.0, ge=0.0, le=1.0)
    egt: float = Field(default=1.0, ge=0.0, le=1.0)
    oil_pressure: float = Field(default=1.0, ge=0.0, le=1.0)
    oil_temperature: float = Field(default=1.0, ge=0.0, le=1.0)
    vibration: float = Field(default=1.0, ge=0.0, le=1.0)
    fuel_flow: float = Field(default=1.0, ge=0.0, le=1.0)
    throttle: float = Field(default=1.0, ge=0.0, le=1.0)


class ChannelSourceMap(BaseModel):
    rpm: TelemetrySource = TelemetrySource.SIMULATION
    map: TelemetrySource = TelemetrySource.SIMULATION
    cht: TelemetrySource = TelemetrySource.SIMULATION
    egt: TelemetrySource = TelemetrySource.SIMULATION
    oil_pressure: TelemetrySource = TelemetrySource.SIMULATION
    oil_temperature: TelemetrySource = TelemetrySource.SIMULATION
    vibration: TelemetrySource = TelemetrySource.SIMULATION
    fuel_flow: TelemetrySource = TelemetrySource.SIMULATION
    throttle: TelemetrySource = TelemetrySource.SIMULATION


class UnifiedTelemetryRecord(BaseModel):
    """
    Canonical 31-channel telemetry record unifying physical engine test bench
    acquisitions, digital twin estimators, and MALE UAV simulation states.
    """
    # ── Identifiers & Timing ──────────────────────────────────────────────────
    timestamp: float = Field(..., description="UNIX epoch timestamp in seconds")
    engine_id: str = Field(default="ROTAX-914-F01", description="Unique propulsion serial ID")
    mission_id: str = Field(default="MIS-ISR-SEC02", description="Assigned sortie identifier")

    # ── Core Engine Telemetry ─────────────────────────────────────────────────
    rpm: float = Field(..., ge=0.0, le=7500.0, description="Crankshaft rotational speed (RPM)")
    map: float = Field(..., ge=0.0, le=60.0, description="Manifold Absolute Pressure (inHg)")
    cht: float = Field(..., description="Cylinder Head Temperature (deg C)")
    egt: float = Field(..., description="Exhaust Gas Temperature (deg C)")
    oil_pressure: float = Field(..., ge=0.0, le=12.0, description="Oil pressure (bar)")
    oil_temperature: float = Field(..., description="Oil temperature (deg C)")
    vibration: float = Field(..., ge=0.0, le=30.0, description="Vibration energy (g-RMS)")
    fuel_flow: float = Field(..., ge=0.0, le=80.0, description="Fuel flow rate (L/h)")
    throttle: float = Field(..., ge=0.0, le=1.0, description="Normalized throttle demand [0..1]")

    # ── Flight & Environmental Dynamics ───────────────────────────────────────
    ambient_temperature: float = Field(default=15.0, description="Ambient air temperature (deg C)")
    ambient_pressure: float = Field(default=1013.25, description="Ambient static pressure (hPa)")
    altitude: float = Field(default=4500.0, description="Barometric / MSL altitude (ft)")
    airspeed: float = Field(default=110.0, ge=0.0, description="Indicated airspeed (kts)")
    engine_load: float = Field(default=0.65, ge=0.0, le=1.0, description="Calculated engine load [0..1]")
    torque: float = Field(default=120.0, ge=0.0, description="Estimated crankshaft torque (Nm)")
    power: float = Field(default=85.0, ge=0.0, description="Brake mechanical power (kW)")
    efficiency: float = Field(default=0.82, ge=0.0, le=1.0, description="Thermal-mechanical efficiency")

    # ── Geospatial Navigation (NavIC / GPS) ───────────────────────────────────
    latitude: float = Field(default=34.1526, description="WGS84 Latitude degrees")
    longitude: float = Field(default=77.5771, description="WGS84 Longitude degrees")
    heading: float = Field(default=55.0, ge=0.0, le=360.0, description="True heading degrees [0..360]")
    mission_phase: MissionPhase = Field(default=MissionPhase.CRUISE, description="Tactical flight phase")

    # ── Zero-Trust Integrity & Quality Metrics ────────────────────────────────
    sensor_health: float = Field(default=100.0, ge=0.0, le=100.0, description="Sensor hardware health index")
    sensor_confidence: SensorConfidenceMap = Field(default_factory=SensorConfidenceMap, description="Per-channel confidence")
    channel_sources: ChannelSourceMap = Field(default_factory=ChannelSourceMap, description="Channel-by-channel source attribution")
    telemetry_integrity: float = Field(default=1.0, ge=0.0, le=1.0, description="Zero-trust aggregate score")
    packet_loss: float = Field(default=0.0, ge=0.0, le=100.0, description="Telemetry packet loss rate percentage")
    timestamp_valid: bool = Field(default=True, description="Strict monotonically increasing clock verification")
    data_quality: str = Field(default="OPTIMAL", description="OPTIMAL | DEGRADED | UNRELIABLE | CORRUPTED")

    # ── Data Provenance ───────────────────────────────────────────────────────
    source: TelemetrySource = Field(default=TelemetrySource.SIMULATION, description="Overall telemetry origin")

    class Config:
        use_enum_values = True
