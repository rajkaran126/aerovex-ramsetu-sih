"""
AERO-TWIN — Comprehensive Unit and Integration Test Suite
"""

import pytest
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.simulator.engine_simulator import EngineSimulator, MISSION_PROFILES, ENVIRONMENTS
from app.digital_twin.engine_model import EngineInputs, DegradationState, AeroPistonEngineModel
from app.digital_twin.state_estimator import StateEstimator
from app.digital_twin.health_index import compute_health_index, health_breakdown, HealthConfig
from app.ai.anomaly import AnomalyDetector
from app.ai.fault_classifier import FaultClassifier
from app.ai.rul import RULPredictor
from app.ai.cyber import TelemetryIntegrityMonitor
from app.mission.mission_replanner import MissionReplanner
from app.mission.what_if import WhatIfSimulator, WhatIfRequest


@pytest.fixture
def client():
    return TestClient(app)


class TestEngineSimulator:
    def test_simulator_step(self):
        sim = EngineSimulator()
        sim.start()
        res = sim.step()
        assert res is not None
        assert "step" in res
        assert "outputs" in res
        assert "egt_c" in res["outputs"]
        assert "rpm" in res["outputs"]
        assert 1000 <= res["outputs"]["rpm"] <= 6500

    def test_fault_injection(self):
        sim = EngineSimulator()
        sim.start()
        sim.inject_fault("cooling", 0.8)
        state = sim.get_state()
        assert state.active_fault == "cooling"
        assert state.fault_severity == 0.8
        res = sim.step()
        assert res["outputs"]["cht_c"] > 50.0  # CHT will be elevated


class TestDigitalTwin:
    def test_state_estimator(self):
        estimator = StateEstimator()
        model = AeroPistonEngineModel()
        inputs = EngineInputs(throttle=0.7, rpm_target=5000, altitude_ft=5000, ambient_temp_c=15)
        expected = model.compute(inputs)
        
        state = estimator.update(expected, inputs, health=100.0)
        assert state is not None
        assert "magnitude" in state.residual

    def test_health_index(self):
        h_good = compute_health_index(residual_magnitude=0.05, degradation={}, thermal_margin=25.0, vibration=1.0, oil_pressure=4.0, anomaly_score=0.1)
        h_bad = compute_health_index(residual_magnitude=0.8, degradation={"mechanical": 0.8}, thermal_margin=-5.0, vibration=4.5, oil_pressure=1.2, anomaly_score=0.9)
        assert h_good > h_bad
        assert 0.0 <= h_bad <= 100.0


class TestAIPipeline:
    def test_anomaly_detector(self):
        ad = AnomalyDetector()
        actual = {"rpm": 5000, "egt_c": 750, "cht_c": 190, "oil_temp_c": 95, "oil_pressure_bar": 4.0, "fuel_flow_lph": 24, "vibration": 1.2}
        residual = {"res_egt_c": 5, "res_cht_c": 2, "res_rpm": 10, "res_oil_temp_c": 1, "res_oil_pressure_bar": 0.1, "res_fuel_flow_lph": 0.2, "res_vibration": 0.1}
        rolling = {"egt_c_mean": 750, "cht_c_mean": 190, "vibration_mean": 1.2, "oil_pres_mean": 4.0, "egt_c_std": 1.0, "cht_c_std": 0.5, "vibration_std": 0.05, "egt_c_roc": 0.1, "cht_c_roc": 0.05, "vibration_roc": 0.01, "rpm_roc": 1.0}
        res = ad.detect(actual, residual, rolling)
        assert "anomaly_score" in res
        assert "is_anomaly" in res

    def test_fault_classifier(self):
        fc = FaultClassifier()
        actual = {"rpm": 5000, "egt_c": 750, "cht_c": 190, "oil_temp_c": 95, "oil_pressure_bar": 4.0, "fuel_flow_lph": 24, "vibration": 1.2}
        residual = {"res_egt_c": 5, "res_cht_c": 2, "res_rpm": 10, "res_oil_temp_c": 1, "res_oil_pressure_bar": 0.1, "res_fuel_flow_lph": 0.2, "res_vibration": 0.1}
        rolling = {"egt_c_mean": 750, "cht_c_mean": 190, "vibration_mean": 1.2, "oil_pres_mean": 4.0, "egt_c_std": 1.0, "cht_c_std": 0.5, "vibration_std": 0.05, "egt_c_roc": 0.1, "cht_c_roc": 0.05, "vibration_roc": 0.01, "rpm_roc": 1.0}
        probs = fc.predict(actual, residual, rolling)
        assert isinstance(probs, dict)
        assert "healthy" in probs
        assert abs(sum(probs.values()) - 1.0) < 1e-3

    def test_rul_predictor(self):
        rul_pred = RULPredictor()
        res = rul_pred.predict(health=85.0, degradation={}, throttle=0.65, altitude_ft=10000, ambient_temp_c=15, mission_elapsed_hours=2.0, mission_duration_hours=6.0)
        assert "rul_median" in res
        assert res["rul_median"] > 0


class TestCyberSecurity:
    def test_telemetry_integrity(self):
        monitor = TelemetryIntegrityMonitor()
        actual = {"rpm": 5000, "egt_c": 1200, "cht_c": 190, "oil_temp_c": 95, "oil_pressure_bar": 4.0, "fuel_flow_lph": 24, "vibration": 1.2}
        expected = {"rpm": 5000, "egt_c": 750, "cht_c": 190, "oil_temp_c": 95, "oil_pressure_bar": 4.0, "fuel_flow_lph": 24, "vibration": 1.2}
        residual = {f"res_{k}": actual[k] - expected[k] for k in actual}
        integrity = monitor.analyze(actual, expected, residual)
        assert integrity.telemetry_integrity_score < 1.0
        assert len(integrity.affected_sensors) > 0


class TestRestAPI:
    def test_health_endpoint(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

    def test_missions_list(self, client):
        resp = client.get("/api/missions")
        assert resp.status_code == 200
        assert "profiles" in resp.json()
        assert len(resp.json()["profiles"]) > 0

    def test_state_endpoint(self, client):
        resp = client.get("/api/state")
        assert resp.status_code == 200

    def test_readiness_endpoint(self, client):
        resp = client.get("/api/system/readiness")
        assert resp.status_code == 200
        data = resp.json()
        assert "datasets" in data
        assert "groq" in data
        assert "models" in data
        assert data["datasets"]["aero_twin"] is True

    def test_dataset_registry_endpoint(self, client):
        resp = client.get("/api/datasets/registry")
        assert resp.status_code == 200
        data = resp.json()
        assert "aero_twin" in data
        assert "cmapss" in data
        assert "n_cmapss" in data
        assert "ml_olympiad" in data

    def test_agent_offline_fallback(self, client):
        resp = client.get("/api/agent/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["online"] is False
        assert "LOCAL AI ACTIVE" in data["mode"]

        chat_resp = client.post("/api/agent/chat", json={
            "message": "Engine status check",
            "agent_type": "orchestrator",
            "context": {}
        })
        assert chat_resp.status_code == 200
        chat_data = chat_resp.json()
        assert "LLM intelligence unavailable" in chat_data["response"]
