"""
AERO-TWIN — FastAPI Application

REST API + WebSocket server for the AERO-TWIN digital twin system.
"""

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .config import settings
from .orchestrator import orchestrator, DEMO_SCENARIOS, _sanitize_for_json
from .simulator.engine_simulator import MISSION_PROFILES, ENVIRONMENTS
from .database.database import create_tables
from .datasets.dataset_manager import dataset_manager
from .system.resource_checker import resource_checker
from .ai.groq_orchestrator import groq_orchestrator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown"""
    logger.info("=== AERO-TWIN Starting Up ===")
    create_tables()
    # Start simulation loop as background task
    loop_task = asyncio.create_task(orchestrator.run_loop(interval_s=1.0))
    logger.info("Simulation loop started")
    yield
    loop_task.cancel()
    logger.info("=== AERO-TWIN Shutting Down ===")


app = FastAPI(
    title="AERO-TWIN API",
    description="AI-Enabled Real-Time Digital Twin for MALE UAV Engine Health Monitoring",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Request Models ──────────────────────────────────────────────────

class FaultInjectionRequest(BaseModel):
    fault_type: str  # injector, cooling, lubrication, mechanical, combustion, none
    severity: float = 0.5

class SensorInjectionRequest(BaseModel):
    sensor: str      # rpm, egt_c, cht_c, oil_temp_c, oil_pressure_bar, fuel_flow_lph, vibration
    anomaly_type: str  # freeze, spike, bias, drift, noise, dropout
    magnitude: float = 0.0
    duration_steps: int = 300

class SimulationControlRequest(BaseModel):
    speed_multiplier: Optional[float] = None
    throttle: Optional[float] = None
    altitude_ft: Optional[float] = None
    ambient_temp_c: Optional[float] = None

class MissionProfileRequest(BaseModel):
    profile: str
    environment: Optional[str] = "STANDARD"

class ScenarioRequest(BaseModel):
    scenario: str

class WhatIfRequest(BaseModel):
    throttle: float = 0.65
    altitude_ft: float = 10000.0
    ambient_temp_c: float = 15.0
    mission_remaining_hours: float = 3.0
    label: str = "What-If"

class ThresholdUpdateRequest(BaseModel):
    health_healthy_min: Optional[float] = None
    health_degraded_min: Optional[float] = None
    health_warning_min: Optional[float] = None
    health_critical_min: Optional[float] = None
    sensor_noise_factor: Optional[float] = None

class ReplanningApplyRequest(BaseModel):
    candidate_name: str

class AgentChatRequest(BaseModel):
    message: str
    agent_role: Optional[str] = "orchestrator"

class GroqKeyUpdateRequest(BaseModel):
    api_key: str


# ── REST Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/state")
async def get_state():
    """Get complete current system state"""
    state = orchestrator.get_full_state()
    if not state:
        return JSONResponse(content={"status": "not_started", "message": "Simulation not yet started"})
    return JSONResponse(content=_sanitize_for_json(state))


@app.get("/api/health")
async def get_health():
    """Get current health index and breakdown"""
    state = orchestrator.get_full_state()
    return JSONResponse(content=_sanitize_for_json(state.get("health", {"index": 100.0, "label": "HEALTHY"})))


@app.get("/api/faults")
async def get_faults():
    """Get current fault classification"""
    state = orchestrator.get_full_state()
    return JSONResponse(content=_sanitize_for_json(state.get("faults", {})))


@app.get("/api/rul")
async def get_rul():
    """Get current RUL prediction"""
    state = orchestrator.get_full_state()
    return JSONResponse(content=_sanitize_for_json(state.get("rul", {})))


@app.get("/api/missions")
async def list_missions():
    """List available mission profiles"""
    return {
        "profiles": [
            {
                "name": name,
                "altitude_ft": p.altitude_ft,
                "throttle": p.throttle,
                "duration_hours": p.duration_hours,
                "description": p.description,
            }
            for name, p in MISSION_PROFILES.items()
        ],
        "environments": [
            {"name": name, "display": env["name"]}
            for name, env in ENVIRONMENTS.items()
        ],
        "scenarios": [
            {
                "name": name,
                "description": s["description"],
                "profile": s["profile"],
                "environment": s["environment"],
            }
            for name, s in DEMO_SCENARIOS.items()
        ],
    }


@app.post("/api/missions/set")
async def set_mission(request: MissionProfileRequest):
    """Set mission profile and environment"""
    orchestrator.simulator.set_mission_profile(request.profile)
    if request.environment:
        orchestrator.simulator.set_environment(request.environment)
    return {"status": "ok", "profile": request.profile, "environment": request.environment}


@app.post("/api/simulation/start")
async def start_simulation():
    orchestrator.simulator.start()
    return {"status": "running"}


@app.post("/api/simulation/pause")
async def pause_simulation():
    orchestrator.simulator.pause()
    return {"status": "paused"}


@app.post("/api/simulation/reset")
async def reset_simulation():
    orchestrator.simulator.reset()
    return {"status": "reset"}


@app.post("/api/simulation/control")
async def control_simulation(request: SimulationControlRequest):
    """Update simulation parameters"""
    if request.speed_multiplier is not None:
        orchestrator.simulator.set_speed_multiplier(request.speed_multiplier)
    if request.throttle is not None:
        orchestrator.simulator.set_throttle(request.throttle)
    if request.altitude_ft is not None:
        orchestrator.simulator.set_altitude(request.altitude_ft)
    if request.ambient_temp_c is not None:
        orchestrator.simulator.set_ambient_temp(request.ambient_temp_c)
    return {"status": "ok"}


@app.post("/api/scenario/load")
async def load_scenario(request: ScenarioRequest):
    """Load a demo scenario"""
    success = orchestrator.load_scenario(request.scenario)
    if not success:
        raise HTTPException(status_code=404, detail=f"Scenario '{request.scenario}' not found")
    scenario = DEMO_SCENARIOS[request.scenario]
    return {"status": "loaded", "scenario": request.scenario, "description": scenario["description"]}


@app.post("/api/fault/inject")
async def inject_fault(request: FaultInjectionRequest):
    """Inject an engine fault"""
    if request.fault_type == "none":
        orchestrator.simulator.clear_fault()
        return {"status": "cleared"}
    orchestrator.simulator.inject_fault(request.fault_type, request.severity)
    return {"status": "injected", "fault_type": request.fault_type, "severity": request.severity}


@app.post("/api/telemetry/inject")
async def inject_telemetry_anomaly(request: SensorInjectionRequest):
    """Inject a sensor/telemetry anomaly"""
    orchestrator.simulator.inject_sensor_anomaly(
        sensor=request.sensor,
        anomaly_type=request.anomaly_type,
        magnitude=request.magnitude,
        duration_steps=request.duration_steps,
    )
    return {
        "status": "injected",
        "sensor": request.sensor,
        "anomaly_type": request.anomaly_type,
        "magnitude": request.magnitude,
    }


@app.post("/api/telemetry/clear")
async def clear_telemetry_injection():
    """Clear all sensor anomaly injections"""
    orchestrator.simulator.clear_sensor_injections()
    return {"status": "cleared"}


@app.post("/api/fault/clear")
async def clear_fault():
    orchestrator.simulator.clear_fault()
    return {"status": "cleared"}


@app.post("/api/replanning/run")
async def run_replanning():
    """Explicitly trigger mission replanning"""
    state = orchestrator.get_full_state()
    if not state:
        raise HTTPException(status_code=400, detail="Simulation not started")

    sim_state = orchestrator.simulator.get_state()
    health = state.get("health", {}).get("index", 100.0)
    rul = state.get("rul", {})
    risk = state.get("mission_risk", {})

    result = orchestrator._replanner.evaluate(
        current_risk=risk.get("risk_level", "MEDIUM"),
        health=health,
        degradation=state.get("degradation", {}),
        rul_median=rul.get("rul_median", 99.0),
        rul_lower=rul.get("rul_lower", 80.0),
        mission_remaining_hours=state.get("mission", {}).get("remaining_hours", 3.0),
        throttle=state.get("mission", {}).get("throttle", 0.65),
        altitude_ft=state.get("mission", {}).get("altitude_ft", 10000),
        ambient_temp_c=state.get("mission", {}).get("ambient_temp_c", 15.0),
        fault_probabilities=state.get("faults", {}).get("probabilities", {}),
        uav_lat=sim_state.uav_lat,
        uav_lon=sim_state.uav_lon,
    )
    orchestrator._replanning_result = result.to_dict()
    return result.to_dict()


@app.post("/api/replanning/apply")
async def apply_replanning(request: ReplanningApplyRequest):
    """Apply a replanning candidate"""
    replanning = orchestrator._replanning_result
    if not replanning or not replanning.get("candidates"):
        raise HTTPException(status_code=400, detail="No replanning result available")

    candidates = replanning["candidates"]
    selected = next((c for c in candidates if c["name"] == request.candidate_name), None)
    if not selected:
        raise HTTPException(status_code=404, detail=f"Candidate '{request.candidate_name}' not found")

    orchestrator.simulator.apply_replanning(selected)
    return {"status": "applied", "candidate": selected}


@app.post("/api/what-if")
async def run_what_if(request: WhatIfRequest):
    """Run a what-if simulation"""
    result = orchestrator.run_what_if(request.dict())
    return result


@app.get("/api/replay")
async def get_replay():
    """Get mission replay events"""
    return {
        "events": orchestrator.get_replay_events(),
        "total": len(orchestrator._replay_events),
    }


@app.get("/api/maintenance")
async def get_maintenance():
    """Get maintenance recommendations based on current state"""
    state = orchestrator.get_full_state()
    if not state:
        return {"recommendations": []}

    health = state.get("health", {}).get("index", 100.0)
    degradation = state.get("degradation", {})
    fault_probs = state.get("faults", {}).get("probabilities", {})
    rul = state.get("rul", {})

    recommendations = []

    if degradation.get("injector", 0) > 0.3:
        recommendations.append({
            "system": "FUEL INJECTION",
            "action": "INSPECT INJECTOR SYSTEM",
            "severity": "HIGH" if degradation["injector"] > 0.6 else "MEDIUM",
            "reason": f"Injector degradation: {degradation['injector']:.0%}",
            "fault_probability": round(fault_probs.get("injector", 0), 3),
        })

    if degradation.get("cooling", 0) > 0.3:
        recommendations.append({
            "system": "COOLING",
            "action": "CHECK COOLING SYSTEM AND OIL COOLER",
            "severity": "HIGH" if degradation["cooling"] > 0.6 else "MEDIUM",
            "reason": f"Cooling degradation: {degradation['cooling']:.0%}",
            "fault_probability": round(fault_probs.get("cooling", 0), 3),
        })

    if degradation.get("lubrication", 0) > 0.3:
        recommendations.append({
            "system": "LUBRICATION",
            "action": "INSPECT OIL SYSTEM AND LUBRICATION",
            "severity": "HIGH" if degradation["lubrication"] > 0.6 else "MEDIUM",
            "reason": f"Lubrication degradation: {degradation['lubrication']:.0%}",
            "fault_probability": round(fault_probs.get("lubrication", 0), 3),
        })

    if degradation.get("mechanical", 0) > 0.3:
        recommendations.append({
            "system": "MECHANICAL",
            "action": "INSPECT VIBRATION/MECHANICAL SYSTEM",
            "severity": "HIGH" if degradation["mechanical"] > 0.6 else "MEDIUM",
            "reason": f"Mechanical degradation: {degradation['mechanical']:.0%}",
            "fault_probability": round(fault_probs.get("mechanical", 0), 3),
        })

    if health < 60:
        recommendations.append({
            "system": "ENGINE",
            "action": "FULL ENGINE INSPECTION RECOMMENDED",
            "severity": "CRITICAL" if health < 40 else "HIGH",
            "reason": f"Engine health: {health:.0f}%",
            "fault_probability": 1.0 - health / 100,
        })

    rul_h = rul.get("rul_median", 99.0)
    if rul_h < 10:
        recommendations.append({
            "system": "ENGINE",
            "action": "ENGINE OVERHAUL OR REPLACEMENT REQUIRED",
            "severity": "CRITICAL",
            "reason": f"Predicted RUL: {rul_h:.1f}h",
            "fault_probability": 0.95,
        })

    return {
        "recommendations": recommendations,
        "health": health,
        "rul_median": rul.get("rul_median", 99.0),
        "degradation": degradation,
        "disclaimer": "RESEARCH DEMONSTRATOR — Recommendations based on synthetic data and research models",
    }


@app.get("/api/twin/history")
async def get_twin_history():
    """Get digital twin history"""
    return {"history": orchestrator.get_twin_history(100)}


@app.post("/api/edge/activate")
async def activate_edge_mode():
    """Simulate connection loss / edge mode"""
    orchestrator.simulator.activate_edge_mode()
    return {"status": "edge_mode_active"}


@app.post("/api/edge/deactivate")
async def deactivate_edge_mode():
    """Reconnect and sync buffered data"""
    buffered = orchestrator.simulator.deactivate_edge_mode()
    return {"status": "synced", "buffered_steps": buffered}


@app.post("/api/settings/update")
async def update_settings(request: ThresholdUpdateRequest):
    """Update health thresholds and simulation settings"""
    config = orchestrator.health_config
    if request.health_healthy_min is not None:
        config.healthy_min = request.health_healthy_min
    if request.health_degraded_min is not None:
        config.degraded_min = request.health_degraded_min
    if request.health_warning_min is not None:
        config.warning_min = request.health_warning_min
    if request.health_critical_min is not None:
        config.critical_min = request.health_critical_min
    if request.sensor_noise_factor is not None:
        orchestrator.simulator._model.noise_factor = request.sensor_noise_factor
    return {"status": "updated"}


# ── System Readiness & Dataset Handoff Endpoints ──────────────────────────────

@app.get("/api/system/readiness")
async def get_system_readiness():
    """Return resource checker discovery and readiness summary"""
    return JSONResponse(content=_sanitize_for_json(resource_checker.check_all()))


@app.get("/api/datasets/registry")
async def get_dataset_registry():
    """Return current dataset registry status"""
    return JSONResponse(content=_sanitize_for_json(dataset_manager.get_registry()))


@app.post("/api/datasets/scan")
async def scan_datasets():
    """Scan dataset folders and refresh registry"""
    registry = dataset_manager.scan_and_update_registry()
    return JSONResponse(content=_sanitize_for_json(registry))


@app.post("/api/datasets/generate-aero-twin")
async def generate_aero_twin_dataset():
    """Generate primary AERO-TWIN synthetic dataset"""
    train_df, test_df = dataset_manager.aero_generator.generate(n_samples=5000)
    dataset_manager.scan_and_update_registry()
    return {
        "status": "generated",
        "train_samples": len(train_df),
        "test_samples": len(test_df),
    }


@app.post("/api/system/groq-key")
async def set_groq_api_key(request: GroqKeyUpdateRequest):
    """Dynamically configure or update single GROQ_API_KEY without code modifications"""
    success = groq_orchestrator.set_api_key(request.api_key)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid Groq API key format")
    return {"status": "configured", "online": True, "notice": "GROQ INTELLIGENCE ONLINE"}


@app.get("/api/agent/status")
async def get_agent_status():
    """Return Groq LLM intelligence status and agent models"""
    return JSONResponse(content=groq_orchestrator.get_status())


@app.post("/api/agent/chat")
async def agent_chat(request: AgentChatRequest):
    """Chat with Groq Chief Orchestrator or specialized agents"""
    state = orchestrator.get_full_state()
    response = await groq_orchestrator.chat(
        user_message=request.message,
        system_state=state,
        agent_role=request.agent_role or "orchestrator",
    )
    return JSONResponse(content=_sanitize_for_json(response))


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "AERO-TWIN", "version": "1.0.0"}


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """
    WebSocket endpoint for real-time telemetry streaming.
    Streams complete system state at 1Hz (or simulation speed).
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected: {websocket.client}")

    q = orchestrator.subscribe()

    try:
        # Send current state immediately on connect
        current = orchestrator.get_full_state()
        if current:
            await websocket.send_json(current)

        while True:
            try:
                # Wait for next state update with timeout
                state = await asyncio.wait_for(q.get(), timeout=30.0)
                await websocket.send_json(state)
            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                await websocket.send_json({"type": "ping", "timestamp": time.time()})

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected: {websocket.client}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        orchestrator.unsubscribe(q)
