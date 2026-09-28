"""
AERO-TWIN — Comprehensive Unit and Integration Test Suite
"""

import pytest
import numpy as np
import time
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

    def test_residual_engine_zero_baseline_and_divergence(self):
        from app.digital_twin.residual_engine import ResidualEngine
        engine = ResidualEngine(window_size=50)

        # Baseline: actual matches expected
        healthy_state = {
            "rpm": 5000.0, "map": 30.0, "egt_c": 700.0, "cht_c": 170.0,
            "oil_pressure_bar": 4.5, "oil_temp_c": 90.0, "vibration": 1.0, "fuel_flow_lph": 22.0
        }
        res_zero = engine.compute_residual_vector(actual=healthy_state, expected=healthy_state)
        assert res_zero.magnitude == 0.0
        assert res_zero.raw_residuals["egt_c"] == 0.0

        # Divergence: thermal and pressure stress
        stressed_actual = dict(healthy_state)
        stressed_actual["egt_c"] = 850.0  # +150°C
        stressed_actual["oil_pressure_bar"] = 2.0  # -2.5 bar
        res_stressed = engine.compute_residual_vector(actual=stressed_actual, expected=healthy_state)
        assert res_stressed.magnitude > 0.1
        assert res_stressed.raw_residuals["egt_c"] == 150.0
        assert res_stressed.raw_residuals["oil_pressure_bar"] == -2.5

    def test_residual_engine_rolling_statistics(self):
        from app.digital_twin.residual_engine import ResidualEngine
        engine = ResidualEngine(window_size=50)
        expected = {"rpm": 5000.0, "egt_c": 700.0, "cht_c": 170.0, "oil_pressure_bar": 4.5, "oil_temp_c": 90.0, "vibration": 1.0}
        
        for i in range(15):
            actual = dict(expected)
            actual["egt_c"] += i * 15.0  # large rising drift (up to 210°C)
            actual["vibration"] += (i % 3) * 0.02
            engine.compute_residual_vector(actual, expected)

        stats = engine.get_rolling_statistics()
        assert stats["sample_count"] == 15
        assert "means" in stats
        assert "variances" in stats
        assert "skewness" in stats
        assert stats["means"]["egt_c"] > 0
        assert stats["dominant_deviation_channel"] == "egt_c"

    def test_health_index_threshold_classification(self):
        from app.digital_twin.health_index import HealthConfig
        cfg = HealthConfig()
        assert cfg.health_label(92.0) == "HEALTHY"
        assert cfg.health_label(85.1) == "HEALTHY"
        assert cfg.health_label(85.0) == "CAUTION"
        assert cfg.health_label(72.5) == "CAUTION"
        assert cfg.health_label(60.0) == "CAUTION"
        assert cfg.health_label(59.9) == "CRITICAL"
        assert cfg.health_label(25.0) == "SEVERE"


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

    def test_rul_quantile_monotonicity(self):
        rul_pred = RULPredictor()
        res = rul_pred.predict(health=78.0, degradation={"cooling": 0.4}, throttle=0.7, altitude_ft=8000, ambient_temp_c=20)
        # Quantile monotonicity rule: P10 <= P50 <= P90
        assert res["rul_lower"] <= res["rul_median"] <= res["rul_upper"]
        assert 0.0 <= res["rul_confidence"] <= 1.0

    def test_shap_explainability(self):
        from app.ai.explainability import ExplainabilityEngine
        fc = FaultClassifier()
        explainer = ExplainabilityEngine(fc)
        actual = {"rpm": 5000, "egt_c": 820, "cht_c": 210, "oil_temp_c": 105, "oil_pressure_bar": 3.8, "fuel_flow_lph": 25, "vibration": 1.4}
        residual = {"res_egt_c": 120, "res_cht_c": 40, "res_rpm": 0, "res_oil_temp_c": 10, "res_oil_pressure_bar": -0.5, "res_fuel_flow_lph": 1.0, "res_vibration": 0.4}
        rolling = {"egt_c_mean": 800, "cht_c_mean": 205, "vibration_mean": 1.3, "oil_pres_mean": 3.9, "egt_c_std": 12.0, "cht_c_std": 4.0, "vibration_std": 0.1, "egt_c_roc": 2.0, "cht_c_roc": 1.0, "vibration_roc": 0.05, "rpm_roc": 0.0}
        
        t0 = time.time()
        res = explainer.explain(actual, residual, rolling, thermal_margin=10.0, efficiency=0.78)
        dt_ms = (time.time() - t0) * 1000.0
        assert "shap_values" in res
        assert len(res["shap_values"]) > 0
        for item in res["shap_values"]:
            assert item["direction"] in ("positive", "negative")
            assert "feature" in item

    def test_degradation_tracker(self):
        from app.degradation.tracker import DegradationTracker
        tracker = DegradationTracker(window_size=20, dt_step_seconds=0.1)

        # Baseline stable health
        for i in range(10):
            met = tracker.update(health=95.0, degradation_dict={"cooling": 0.0}, cht_c=170.0, vibration=1.0)
        assert met.status == "STABLE"

        # Rapidly degrading health
        for i in range(15):
            met = tracker.update(health=95.0 - (i * 1.5), degradation_dict={"cooling": 0.05 * i}, cht_c=170.0 + (i * 2.0), vibration=1.0 + (i * 0.1))
        assert met.status == "RAPID_DEGRADATION"
        assert met.dominant_subsystem == "cooling"


class TestCyberSecurity:
    def test_telemetry_integrity(self):
        monitor = TelemetryIntegrityMonitor()
        actual = {"rpm": 5000, "egt_c": 1200, "cht_c": 190, "oil_temp_c": 95, "oil_pressure_bar": 4.0, "fuel_flow_lph": 24, "vibration": 1.2}
        expected = {"rpm": 5000, "egt_c": 750, "cht_c": 190, "oil_temp_c": 95, "oil_pressure_bar": 4.0, "fuel_flow_lph": 24, "vibration": 1.2}
        residual = {f"res_{k}": actual[k] - expected[k] for k in actual}
        integrity = monitor.analyze(actual, expected, residual)
        assert integrity.telemetry_integrity_score < 1.0
        assert len(integrity.affected_sensors) > 0

    def test_zero_trust_shield_egt_spike_and_freeze(self):
        from app.cyber_security.zero_trust_shield import ZeroTrustCyberShield
        shield = ZeroTrustCyberShield()

        actual = {"rpm": 5000.0, "map": 30.0, "egt_c": 700.0, "cht_c": 170.0, "oil_pressure_bar": 4.5, "oil_temp_c": 90.0, "fuel_flow_lph": 22.0, "vibration": 1.0}
        expected = dict(actual)
        residual = {k: 0.0 for k in actual}

        # Warm up history
        for _ in range(20):
            shield.evaluate_telemetry(actual, expected, residual)

        # Inject extreme EGT ROC spike (from 700 to 950 in 1 step: delta 250 > max ROC 50)
        spiked_actual = dict(actual)
        spiked_actual["egt_c"] = 950.0
        spiked_res = dict(residual)
        spiked_res["egt_c"] = 250.0
        rep_spike = shield.evaluate_telemetry(spiked_actual, expected, spiked_res)

        assert "egt_c" in rep_spike.affected_sensors
        assert rep_spike.sensor_statuses["egt_c"].has_spike is True
        assert rep_spike.is_cyber_anomaly is True

        # Test sensor freeze (frozen at 700 while expected rises to 820)
        shield.reset()
        for _ in range(16):
            frozen_actual = dict(actual)  # constant 700.0 with 0 std dev
            rising_expected = dict(actual)
            rising_expected["egt_c"] = 820.0
            frozen_res = {"egt_c": -120.0}
            rep_freeze = shield.evaluate_telemetry(frozen_actual, rising_expected, frozen_res)

        assert rep_freeze.sensor_statuses["egt_c"].is_frozen is True
        assert rep_freeze.sensor_statuses["egt_c"].confidence < 0.6

    def test_self_healing_pipeline_substitution_and_audit(self):
        from app.cyber_security.zero_trust_shield import ZeroTrustCyberShield
        from app.telemetry.self_healing import SelfHealingPipeline
        from app.schemas.telemetry import TelemetrySource

        shield = ZeroTrustCyberShield()
        healer = SelfHealingPipeline(confidence_threshold=0.65)

        actual = {"rpm": 5000.0, "map": 30.0, "egt_c": 1150.0, "cht_c": 170.0, "oil_pressure_bar": 4.5, "oil_temp_c": 90.0, "fuel_flow_lph": 22.0, "vibration": 1.0}
        expected = {"rpm": 5000.0, "map": 30.0, "egt_c": 710.0, "cht_c": 170.0, "oil_pressure_bar": 4.5, "oil_temp_c": 90.0, "fuel_flow_lph": 22.0, "vibration": 1.0}
        residual = {k: actual[k] - expected[k] for k in actual}

        # Evaluate through zero trust shield
        report = shield.evaluate_telemetry(actual, expected, residual)
        assert "egt_c" in report.affected_sensors

        # Execute transparent self-healing
        healed, sources, events = healer.heal_telemetry(
            actual_telemetry=actual,
            expected_telemetry=expected,
            cyber_report=report,
            step=42,
        )

        # 1. Corrupted physical channel isolated; analytical estimate substituted
        assert healed["egt_c"] == expected["egt_c"]
        assert healed["rpm"] == actual["rpm"]

        # 2. Provenance metadata explicitly tagged as RECONSTRUCTED
        assert sources["egt_c"] == TelemetrySource.RECONSTRUCTED
        assert sources["rpm"] == TelemetrySource.PHYSICAL

        # 3. Audit log contains the event
        assert len(events) >= 1
        assert events[0].channel == "egt_c"
        assert events[0].original_value == 1150.0
        assert events[0].substituted_value == 710.0
        assert events[0].flight_step == 42
        assert len(healer.get_audit_log()) >= 1


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

    def test_unified_telemetry_schema(self):
        from app.schemas.telemetry import UnifiedTelemetryRecord, TelemetrySource, MissionPhase
        import time
        rec = UnifiedTelemetryRecord(
            timestamp=time.time(),
            engine_id="ROTAX-914-TEST",
            mission_id="MIS-TEST-01",
            rpm=5000.0,
            map=30.0,
            cht=160.0,
            egt=680.0,
            oil_pressure=4.2,
            oil_temperature=85.0,
            vibration=0.9,
            fuel_flow=22.0,
            throttle=0.65,
            source=TelemetrySource.SIMULATION,
        )
        assert rec.engine_id == "ROTAX-914-TEST"
        assert rec.source == TelemetrySource.SIMULATION
        assert rec.power > 0
        assert rec.torque > 0

    def test_can_telemetry_hardware_hal(self):
        from app.telemetry.can_interface import CanTelemetryBridge, MockCanBenchTransmitter, TelemetrySource
        bridge = CanTelemetryBridge(engine_id="ROTAX-914-PHYSICAL")
        tx = MockCanBenchTransmitter(bridge)
        record = tx.transmit_burst(rpm=5100.0, throttle=0.72, map_inhg=31.5)
        assert record.source == TelemetrySource.PHYSICAL
        assert record.engine_id == "ROTAX-914-PHYSICAL"
        assert record.rpm == 5100.0
        assert abs(record.throttle - 0.72) < 0.01

    def test_agent_offline_fallback(self, client, monkeypatch):
        from app.config import settings
        from app.ai.groq_orchestrator import groq_orchestrator
        monkeypatch.setattr(settings, "GROQ_API_KEY", "")
        monkeypatch.setattr(groq_orchestrator, "_groq_api_key", "")
        monkeypatch.setenv("GROQ_API_KEY", "")
        
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


class TestMissionAndReplanning:
    def test_what_if_contingency_simulation(self):
        sim = WhatIfSimulator()
        req = WhatIfRequest(
            throttle=0.55,
            altitude_ft=9000.0,
            ambient_temp_c=12.0,
            mission_duration_hours=4.0,
            mission_remaining_hours=2.5,
            degradation={"cooling": 0.2},
        )
        res = sim.simulate(
            request=req,
            current_health=82.0,
            current_fault_probabilities={"cooling": 0.4, "healthy": 0.6},
            current_rul_lower=14.0,
            scenario_label="Altitude Descent Test",
        )
        data = res.to_dict()
        assert "predicted_health" in data
        assert "predicted_thermal_margin" in data
        assert "predicted_rul_hours" in data
        assert data["predicted_health"] > 0.0

    def test_pareto_multi_objective_replanning(self):
        from app.replanning.pareto_optimizer import ParetoReplanner
        replanner = ParetoReplanner()

        res = replanner.evaluate_pareto_frontier(
            current_health=65.0,
            current_risk="HIGH",
            degradation={"cooling": 0.5, "lubrication": 0.2},
            rul_median=4.5,
            rul_lower=2.8,
            mission_remaining_hours=3.5,
            current_throttle=0.72,
            current_altitude_ft=14000.0,
            ambient_temp_c=10.0,
            fault_probabilities={"cooling": 0.7, "healthy": 0.1},
        )
        data = res.to_dict()
        assert data["triggered"] is True
        assert len(data["candidates"]) == 3

        # Check that Option A, Option B, and Option C are present
        c_ids = [c["candidate_id"] for c in data["candidates"]]
        assert "OPTION_A" in c_ids
        assert "OPTION_B" in c_ids
        assert "OPTION_C" in c_ids

        # Check monotonic ranking by Pareto score
        scores = [c["pareto_score"] for c in data["candidates"]]
        assert scores == sorted(scores, reverse=True)

        # Check ghost flight plan waypoints
        for c in data["candidates"]:
            assert len(c["ghost_waypoints"]) >= 3
            assert c["ghost_waypoints"][0]["name"] == "CURRENT_POSITION"

        # Verify Option A specializes in Safety, Option B in Mission Completion
        cand_map = {c["candidate_id"]: c for c in data["candidates"]}
        assert cand_map["OPTION_A"]["safety_score"] >= cand_map["OPTION_B"]["safety_score"]
        assert cand_map["OPTION_B"]["mission_completion_prob"] >= cand_map["OPTION_A"]["mission_completion_prob"]


class TestSwarmAndGNSS:
    def test_swarm_formation_and_heartbeat(self):
        from app.swarm.swarm_manager import SwarmManager
        mgr = SwarmManager()
        state = mgr.update_step(lead_health=92.0, step=1)
        assert state["enabled"] is True
        assert len(state["nodes"]) == 4
        assert state["nodes"][0]["role"] == "LEAD"
        assert state["nodes"][0]["health_pct"] == 92.0

        # Change formation to DIAMOND
        ok = mgr.set_formation("DIAMOND")
        assert ok is True
        assert mgr.formation == "DIAMOND"
        # Bravo offset should match DIAMOND
        assert mgr.nodes["bravo-2"].offset_x_m == -50.0

    def test_gnss_navic_failover_latency(self):
        from app.gps.gps_navic import GPSNavICReceiver
        rx = GPSNavICReceiver(init_lat=28.8, init_lon=77.4)

        # Baseline: normal GPS
        gnss_base = rx.update(uav_lat=28.8, uav_lon=77.4, altitude_ft=10000, speed_kts=105, heading_deg=45)
        assert gnss_base.active_constellation == "GPS"

        # Inject Jamming: triggers autonomous failover to NavIC
        rx.set_electronic_attack(jammed=True, spoofed=False)
        gnss_jammed = rx.update(uav_lat=28.8, uav_lon=77.4, altitude_ft=10000, speed_kts=105, heading_deg=45)
        assert gnss_jammed.active_constellation == "NAVIC"
        assert gnss_jammed.failover_latency_ms < 200.0  # Must be < 200 ms per spec

    def test_gps_denied_dead_reckoning_drift(self):
        from app.gps.gps_navic import GPSNavICReceiver
        rx = GPSNavICReceiver(init_lat=28.8, init_lon=77.4)

        # Inject Spoofing: triggers dead reckoning
        rx.set_electronic_attack(jammed=False, spoofed=True)
        gnss_dr1 = rx.update(uav_lat=28.8, uav_lon=77.4, altitude_ft=10000, speed_kts=100, heading_deg=90, dt_seconds=1.0)
        assert gnss_dr1.active_constellation == "DEAD_RECKONING"

        # Verify drift is bounded and tracks inertial physics
        assert gnss_dr1.dead_reckoning_drift_m >= 0.0

    def test_terrain_diversion_reachability(self):
        from app.gps.terrain import TerrainDiversionManager
        mgr = TerrainDiversionManager()

        # UAV near Ambala at 25,000 ft (high glide reachability)
        results = mgr.evaluate_reachability(uav_lat=30.35, uav_lon=76.85, altitude_ft=25000.0, ground_speed_kts=95.0)
        assert len(results) > 0
        amb = next(a for a in results if a.code == "AMB")
        assert amb.is_reachable is True
        assert amb.distance_km < 15.0
        assert amb.glide_margin_m > 5000.0


class TestMilestone7MaintenanceAndLogbook:
    def test_taskcard_generation_cooling_and_injector(self):
        from app.maintenance.taskcard_generator import MaintenanceTaskcardGenerator
        gen = MaintenanceTaskcardGenerator()

        # Inject cooling fault
        cards_cooling = gen.generate_taskcards(
            fault_probabilities={"cooling": 0.85, "injector": 0.05, "mechanical": 0.05, "sensor": 0.05},
            health_index=55.0,
            p10_rul_hours=14.0,
            active_fault="cooling",
            degradation={"thermal_barrier_degradation": 0.6},
        )
        assert len(cards_cooling) > 0
        ata75 = next(c for c in cards_cooling if "ATA 75" in c.ata_chapter)
        assert "Coolant" in ata75.title or "Cooling" in ata75.title
        assert ata75.urgency in ("IMMEDIATE_GROUNDING", "PRIORITY_A_CHECK")
        assert len(ata75.required_tools) > 0
        assert len(ata75.required_parts) > 0
        assert len(ata75.action_steps) > 0

        # Inject injector fault
        cards_injector = gen.generate_taskcards(
            fault_probabilities={"injector": 0.90, "cooling": 0.02, "mechanical": 0.04, "sensor": 0.04},
            health_index=68.0,
            p10_rul_hours=32.0,
            active_fault="injector",
            degradation={"injector_fouling": 0.7},
        )
        ata73 = next(c for c in cards_injector if "ATA 73" in c.ata_chapter)
        assert "Injector" in ata73.title
        assert ata73.urgency in ("PRIORITY_A_CHECK", "ROUTINE_B_CHECK")

    def test_immutable_digital_logbook_cryptographic_verification(self):
        from app.storage.immutable_logbook import ImmutableDigitalLogbook
        logbook = ImmutableDigitalLogbook(engine_id="TEST-ENGINE-001")

        # Initial genesis verification
        is_valid, err = logbook.verify_integrity()
        assert is_valid is True
        assert err is None
        assert len(logbook.chain) == 1
        assert logbook.chain[0].event_type == "GENESIS"

        # Append sequence of events
        logbook.append_event("SORTIE_START", {"sortie_id": "SRT-101", "pilot": "AUTO"})
        logbook.append_event("TELEMETRY_SNAPSHOT", {"step": 50, "health": 88.5})
        logbook.append_event("CYBER_INTERVENTION", {"channel": "egt_c", "action": "substitute"})
        logbook.append_event("MAINTENANCE_SIGNOFF", {"taskcard_id": "TC-ATA75-001", "tech": "ENG-44"})
        logbook.append_event("SORTIE_END", {"sortie_id": "SRT-101", "total_hours": 4.2})

        assert len(logbook.chain) == 6
        is_valid, err = logbook.verify_integrity()
        assert is_valid is True
        assert err is None

        # Verify to_dict output
        summary = logbook.to_dict()
        assert summary["total_blocks"] == 6
        assert summary["integrity_valid"] is True
        assert len(summary["latest_hash"]) == 64

        # Test tamper detection on payload
        original_val = logbook.chain[2].payload["health"]
        logbook.chain[2].payload["health"] = 99.9  # Tamper with recorded health
        is_valid, err = logbook.verify_integrity()
        assert is_valid is False
        assert "Tampered payload" in err

        # Restore payload
        logbook.chain[2].payload["health"] = original_val
        is_valid, err = logbook.verify_integrity()
        assert is_valid is True

        # Test broken link detection
        real_hash = logbook.chain[3].prev_hash
        logbook.chain[3].prev_hash = "deadbeef" * 8
        is_valid, err = logbook.verify_integrity()
        assert is_valid is False
        assert "Broken link" in err

    def test_orchestrator_full_state_milestone7(self):
        from app.orchestrator import AeroTwinOrchestrator
        orch = AeroTwinOrchestrator()
        orch._ensure_ai_models()
        ok = orch.load_scenario("HOT_WEATHER")
        assert ok is True

        # Run 3 simulation steps
        state = None
        for _ in range(3):
            state = orch._step_simulation()

        assert state is not None
        # Verify Milestone 7 attributes are populated
        assert "maintenance_taskcards" in state
        assert isinstance(state["maintenance_taskcards"], list)
        assert "digital_logbook" in state
        assert state["digital_logbook"]["integrity_valid"] is True
        assert state["digital_logbook"]["total_blocks"] >= 1  # At least SORTIE_START
        assert "swarm" in state
        assert state["swarm"]["enabled"] is True
        assert "gnss" in state
        assert state["gnss"]["active_constellation"] in ("GPS", "NAVIC", "DEAD_RECKONING")
        assert "emergency_diversion_airfields" in state
        assert len(state["emergency_diversion_airfields"]) > 0



