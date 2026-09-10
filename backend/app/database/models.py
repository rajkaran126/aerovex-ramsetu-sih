"""AERO-TWIN — SQLAlchemy Database Models"""
from sqlalchemy import (
    Column, Integer, Float, String, Boolean, DateTime, Text, JSON,
    ForeignKey, create_engine
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Engine(Base):
    __tablename__ = "engines"
    id = Column(Integer, primary_key=True, index=True)
    engine_id = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    missions = relationship("Mission", back_populates="engine")


class Mission(Base):
    __tablename__ = "missions"
    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(String, unique=True, index=True)
    engine_id = Column(Integer, ForeignKey("engines.id"))
    profile = Column(String, default="ISR")
    environment = Column(String, default="STANDARD")
    status = Column(String, default="ACTIVE")
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    engine = relationship("Engine", back_populates="missions")
    telemetry_records = relationship("TelemetryRecord", back_populates="mission")
    alerts = relationship("Alert", back_populates="mission")


class TelemetryRecord(Base):
    __tablename__ = "telemetry"
    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id"))
    step = Column(Integer)
    simulation_time_s = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Actual readings
    rpm = Column(Float)
    egt_c = Column(Float)
    cht_c = Column(Float)
    oil_temp_c = Column(Float)
    oil_pressure_bar = Column(Float)
    fuel_flow_lph = Column(Float)
    vibration = Column(Float)

    # Expected
    exp_rpm = Column(Float)
    exp_egt_c = Column(Float)
    exp_cht_c = Column(Float)

    # Residuals
    res_egt_c = Column(Float)
    res_cht_c = Column(Float)
    res_vibration = Column(Float)

    # State
    health_index = Column(Float)
    anomaly_score = Column(Float)
    rul_median = Column(Float)

    throttle = Column(Float)
    altitude_ft = Column(Float)
    ambient_temp_c = Column(Float)

    mission = relationship("Mission", back_populates="telemetry_records")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    alert_type = Column(String)       # FAULT, ANOMALY, RISK, SENSOR, REPLANNING
    severity = Column(String)         # LOW, MEDIUM, HIGH, CRITICAL
    message = Column(Text)
    data = Column(JSON, nullable=True)
    acknowledged = Column(Boolean, default=False)
    mission = relationship("Mission", back_populates="alerts")


class FaultEvent(Base):
    __tablename__ = "fault_events"
    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    fault_type = Column(String)
    severity = Column(Float)
    health_at_detection = Column(Float)
    fault_probabilities = Column(JSON)
    shap_explanation = Column(JSON, nullable=True)


class CyberEvent(Base):
    __tablename__ = "cyber_events"
    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    classification = Column(String)
    affected_sensors = Column(JSON)
    integrity_score = Column(Float)
    anomaly_reasons = Column(JSON)


class ReplanningEvent(Base):
    __tablename__ = "replanning_events"
    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    trigger_risk = Column(String)
    selected_profile = Column(String)
    recommendation = Column(String)
    candidates = Column(JSON)


class ReplayEvent(Base):
    __tablename__ = "replay_events"
    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    step = Column(Integer)
    simulation_time_s = Column(Float)
    event_type = Column(String)   # TAKEOFF, CLIMB, FAULT_ONSET, etc.
    event_label = Column(String)
    data = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
