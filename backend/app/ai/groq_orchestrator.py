"""
AERO-TWIN — Groq LLM Multi-Agent Orchestrator

Architectural specifications:
- Exactly ONE GROQ_API_KEY used across all agents.
- Independent model selection per agent role (Engine, Security, Mission, Maintenance, Orchestrator).
- Strictly runs in LOCAL AI MODE when key is missing or invalid.
- Never fabricates fake LLM responses when key is unavailable; returns explicit offline status.
- When key is supplied, grounds prompts with real-time digital twin state and sensor residuals.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import httpx

from ..config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_ORCHESTRATOR = """You are the Chief AI Flight Engineer & Digital Twin Orchestrator for an Indian MALE UAV powered by a turbocharged aero-piston engine (Rotax 914/915 iS class).
You have access to live telemetry, thermodynamic digital twin expected states, sensor residual vectors, cyber-integrity verification, and multi-class fault predictions.
Provide rigorous, technically grounded flight engineering assessments. Refer directly to physical telemetry (CHT, EGT, oil pressure, thermal margins) and digital twin residuals.
Be concise, authoritative, and safety-critical."""

SYSTEM_PROMPT_ENGINE = """You are the Aero-Piston Propulsion Diagnostics Specialist.
Focus strictly on internal combustion engine thermodynamics, manifold pressure, air-fuel ratio deviations, ignition timing, cylinder head cooling, and lubrication film health."""

SYSTEM_PROMPT_SECURITY = """You are the Cyber-Telemetry & Avionics Integrity Specialist.
Focus strictly on zero-trust telemetry stream analysis, sensor freeze detection, spoofing attacks, out-of-bounds telemetry injection, and self-healing analytical substitution."""

SYSTEM_PROMPT_MISSION = """You are the Autonomous Mission & Flight Path Reliability Specialist.
Focus strictly on probability of mission completion, thermal runway margins, altitude optimization, loiter endurance, and emergency divert / RTB recommendations."""

SYSTEM_PROMPT_MAINTENANCE = """You are the Prescriptive Maintenance & Reliability Engineer.
Focus strictly on component degradation rates (injectors, oil pump, piston rings, valves), RUL uncertainty bands, and maintenance taskcard advisories."""


class GroqMultiAgentOrchestrator:
    """Manages LLM reasoning agents powered by Groq API."""

    def __init__(self):
        self._groq_api_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
        self.groq_endpoint = "https://api.groq.com/openai/v1/chat/completions"

    def set_api_key(self, key: str) -> bool:
        """Update API key dynamically at runtime."""
        cleaned = key.strip()
        if len(cleaned) > 5:
            self._groq_api_key = cleaned
            settings.GROQ_API_KEY = cleaned
            logger.info("Groq API key updated and validated dynamically.")
            return True
        return False

    def is_online(self) -> bool:
        """Check whether Groq intelligence is currently active."""
        key = self._groq_api_key or settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
        return bool(key and len(key.strip()) > 5)

    def get_status(self) -> Dict[str, Any]:
        """Return status string for UI and system readiness."""
        online = self.is_online()
        return {
            "online": online,
            "configured": online,
            "mode": "GROQ INTELLIGENCE ONLINE" if online else "LOCAL AI ACTIVE — GROQ INTELLIGENCE OFFLINE",
            "models": {
                "orchestrator": settings.ORCHESTRATOR_MODEL,
                "engine_agent": settings.ENGINE_AGENT_MODEL,
                "security_agent": settings.SECURITY_AGENT_MODEL,
                "mission_agent": settings.MISSION_AGENT_MODEL,
                "maintenance_agent": settings.MAINTENANCE_AGENT_MODEL,
            },
            "key_present": online
        }

    async def chat(
        self,
        user_message: str,
        system_state: Optional[Dict[str, Any]] = None,
        agent_role: str = "orchestrator"
    ) -> Dict[str, Any]:
        """
        Process chat query with live digital twin context.
        If key is not available, returns the required strict message without fake responses.
        """
        if not self.is_online():
            return {
                "status": "offline",
                "response": "LLM intelligence unavailable — numerical AI remains active.",
                "agent_role": agent_role,
                "online": False,
                "local_ai_active": True,
            }

        # Select model and prompt based on requested role
        model_map = {
            "engine": (settings.ENGINE_AGENT_MODEL, SYSTEM_PROMPT_ENGINE),
            "security": (settings.SECURITY_AGENT_MODEL, SYSTEM_PROMPT_SECURITY),
            "mission": (settings.MISSION_AGENT_MODEL, SYSTEM_PROMPT_MISSION),
            "maintenance": (settings.MAINTENANCE_AGENT_MODEL, SYSTEM_PROMPT_MAINTENANCE),
            "orchestrator": (settings.ORCHESTRATOR_MODEL, SYSTEM_PROMPT_ORCHESTRATOR),
        }
        model_id, system_prompt = model_map.get(agent_role, (settings.ORCHESTRATOR_MODEL, SYSTEM_PROMPT_ORCHESTRATOR))

        # Ground prompt with live twin context if available
        context_str = ""
        if system_state:
            health = system_state.get("health", {})
            telemetry = system_state.get("telemetry", {}).get("actual", {})
            residuals = system_state.get("telemetry", {}).get("residual", {})
            faults = system_state.get("faults", {})
            rul = system_state.get("rul", {})
            mission_risk = system_state.get("mission_risk", {})
            integrity = system_state.get("integrity", {})

            context_str = f"""
[CURRENT LIVE TELEMETRY & DIGITAL TWIN STATE]
- Health Index: {health.get('index', 'N/A')}% ({health.get('label', 'N/A')})
- Top Fault: {faults.get('top_fault', 'None')} (Probability: {faults.get('top_fault_probability', 0):.2f})
- Predicted RUL: {rul.get('rul_median', 'N/A')}h (Bounds: {rul.get('rul_lower', 'N/A')}h - {rul.get('rul_upper', 'N/A')}h)
- Mission Risk: {mission_risk.get('risk_level', 'N/A')} (Failure Prob: {mission_risk.get('failure_probability', 0):.2%})
- Telemetry Integrity: {integrity.get('overall_classification', 'NORMAL')} (Score: {integrity.get('telemetry_integrity_score', 1.0):.2f})
- Core Sensors: RPM={telemetry.get('rpm', 0):.0f}, CHT={telemetry.get('cht_c', 0):.1f}°C, EGT={telemetry.get('egt_c', 0):.1f}°C, OilPres={telemetry.get('oil_pressure_bar', 0):.2f}bar, Vibration={telemetry.get('vibration', 0):.2f}
- Key Residuals: EGT_res={residuals.get('res_egt_c', 0):.1f}°C, CHT_res={residuals.get('res_cht_c', 0):.1f}°C, RPM_res={residuals.get('res_rpm', 0):.0f}
"""

        messages = [
            {"role": "system", "content": f"{system_prompt}\n{context_str}"},
            {"role": "user", "content": user_message}
        ]

        key = self._groq_api_key or settings.GROQ_API_KEY
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model_id,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 800,
        }

        candidate_models = [model_id]
        for fallback in ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]:
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                last_error_code = 500
                for candidate in candidate_models:
                    payload = {
                        "model": candidate,
                        "messages": messages,
                        "temperature": 0.3,
                        "max_tokens": 800,
                    }
                    res = await client.post(self.groq_endpoint, headers=headers, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        answer = data["choices"][0]["message"]["content"]
                        return {
                            "status": "success",
                            "response": answer,
                            "model": candidate,
                            "agent_role": agent_role,
                            "online": True,
                        }
                    elif res.status_code == 404:
                        logger.warning(f"Groq model {candidate} not found (404), trying next candidate...")
                        last_error_code = 404
                        continue
                    else:
                        last_error_code = res.status_code
                        break

                logger.warning("Groq API returned HTTP %s for all attempted models", last_error_code)
                return {
                    "status": "api_error",
                    "response": f"Groq request failed (HTTP {last_error_code}). Check your key, model access and quota.",
                    "online": False,
                }
        except Exception as e:
            logger.error(f"Groq API request failed: {e}")
            return {
                "status": "error",
                "response": f"Connection to Groq service failed: {e}",
                "online": False,
            }


groq_orchestrator = GroqMultiAgentOrchestrator()
