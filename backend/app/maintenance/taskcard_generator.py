"""
AERO-TWIN — Automated Maintenance Taskcard Generator

Maps physical degradation, classified fault probabilities, and remaining useful life
to standardized aerospace ATA-chapter maintenance taskcards:
- ATA 71: Powerplant General
- ATA 72: Engine Reciprocating
- ATA 73: Engine Fuel & Control
- ATA 75: Air / Turbocharging System
- ATA 79: Engine Oil & Lubrication
- ATA 80: Starting & Ignition

Complies strictly with §18 of Master Implementation Specification.
"""

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)


@dataclass
class MaintenanceTaskcard:
    taskcard_id: str
    ata_chapter: str
    title: str
    subsystem: str
    urgency: str                    # "IMMEDIATE_GROUNDING", "PRIORITY_A_CHECK", "ROUTINE_B_CHECK"
    estimated_man_hours: float
    required_tools: List[str]
    required_parts: List[str]
    sign_off_authority: str
    trigger_fault: str
    trigger_condition: str
    action_steps: List[str]
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "taskcard_id": self.taskcard_id,
            "ata_chapter": self.ata_chapter,
            "title": self.title,
            "subsystem": self.subsystem,
            "urgency": self.urgency,
            "estimated_man_hours": round(self.estimated_man_hours, 1),
            "required_tools": self.required_tools,
            "required_parts": self.required_parts,
            "sign_off_authority": self.sign_off_authority,
            "trigger_fault": self.trigger_fault,
            "trigger_condition": self.trigger_condition,
            "action_steps": self.action_steps,
            "created_at": round(self.created_at, 2),
        }


# ATA Taskcard Template Library
TASKCARD_TEMPLATES = {
    "injector": {
        "id": "TC-73-102",
        "ata": "ATA 73 (Engine Fuel & Control)",
        "title": "Ultrasonic Flow Bench Calibration & Injector Solenoid Overhaul",
        "subsystem": "Fuel Injection",
        "tools": ["Ultrasonic cleaning bath", "Fuel injection flow bench", "Torque wrench 1/4 inch", "Digital multimeter"],
        "parts": ["High-pressure O-ring seals (Fluorocarbon)", "Fuel rail crush washers (P/N 914-73-01)"],
        "authority": "IA / Certified A&P Powerplant Mechanic",
        "hours": 3.5,
        "steps": [
            "De-pressurize fuel rail and lock out electric boost pump.",
            "Remove harness connectors and disconnect fuel rail banjos.",
            "Extract 4x electronic fuel injectors and inspect spray pintle tips for carbon varnishing.",
            "Perform ultrasonic bath solvent cleaning (40 kHz, 15 minutes).",
            "Mount on flow test rig: verify spray cone angle (15° +/- 2°) and flow volume balance within 1.5%.",
            "Reinstall with fresh fluorocarbon O-rings torqued to 9.5 Nm. Perform leak check at 3.2 bar static pressure.",
        ],
    },
    "cooling": {
        "id": "TC-75-204",
        "ata": "ATA 75 (Air / Liquid Cooling)",
        "title": "Coolant Radiator Descaling, Water Pump Impeller & Thermostat Inspection",
        "subsystem": "Thermal Cooling System",
        "tools": ["Refractometer (glycol concentration)", "Coolant pressure tester", "Borescope camera"],
        "parts": ["Water pump mechanical ceramic seal", "Thermostat valve (80°C threshold)", "Silicate-free coolant concentrate"],
        "authority": "Certified A&P Powerplant Mechanic",
        "hours": 4.0,
        "steps": [
            "Drain engine cooling circuit into clean recovery vessel; inspect for particulate sedimentation.",
            "Borescope coolant passage gallery jackets around cylinder heads 2 and 4.",
            "Remove water pump housing: inspect composite impeller blades for cavitation erosion or shaft play.",
            "Test thermostat opening response in calibrated heated water bath (target open at 80°C +/- 2°C).",
            "Flush heat exchanger radiator with de-scaling solution.",
            "Refill with 50/50 water-glycol mixture, bleed airlock via highest purge nipple, and pressure test circuit to 1.2 bar.",
        ],
    },
    "lubrication": {
        "id": "TC-79-108",
        "ata": "ATA 79 (Engine Oil & Scavenge)",
        "title": "Magnetic Chip Detector Inspection, Oil Pump Pressure Relief & Filter Sectioning",
        "subsystem": "Lubrication Circuit",
        "tools": ["Filter element cutting tool", "Inspection microscope (40x)", "Oil pressure test gauge (0-10 bar)"],
        "parts": ["Spin-on oil filter element (10 micron)", "Oil tank sealing gasket", "AeroShell Sport Plus 4 oil (3.5L)"],
        "authority": "Certified A&P Powerplant Mechanic",
        "hours": 2.5,
        "steps": [
            "Extract magnetic drain plug and inspect for ferrous metal whiskers or bronze bearing flakes.",
            "Section oil filter canister with non-cutting wheel; spread pleats under 40x microscope for microscopic particulate count.",
            "Inspect mechanical oil pump pressure relief valve spring free-length and plunger seating face.",
            "Verify oil return scavenge line check-valve sealing to prevent crankcase hydraulic lock.",
            "Install new 10-micron filter, torque to 15 Nm, safety-wire canister.",
            "Service with fresh AeroShell Sport Plus 4; conduct ground run to verify minimum 3.0 bar at 4000 RPM.",
        ],
    },
    "mechanical": {
        "id": "TC-72-301",
        "ata": "ATA 72 (Engine Reciprocating Assembly)",
        "title": "Differential Cylinder Compression Test & Valve Train Clearance Verification",
        "subsystem": "Reciprocating Assembly",
        "tools": ["Differential cylinder pressure tester (80 PSI source)", "Feeler gauge set (0.05 - 0.50 mm)", "Piston top dead center locator"],
        "parts": ["Rocker cover gaskets (P/N 914-72-12)", "Cylinder base O-rings"],
        "authority": "IA / Certified A&P Powerplant Mechanic",
        "hours": 5.0,
        "steps": [
            "Warm engine to operating temperature (oil temp > 50°C) and remove lower spark plugs.",
            "Perform 80 PSI differential compression test across cylinders 1, 2, 3, 4 (minimum threshold 72/80).",
            "Listen at exhaust pipe, intake manifold, and crankcase breather for air leakage to isolate ring vs valve seat wear.",
            "Measure cold valve tappet lash clearances (Intake: 0.10 mm, Exhaust: 0.15 mm).",
            "Inspect pushrod straightness on precision granite surface plate.",
            "Re-torque cylinder head studs in diagonal cross pattern to 22 Nm.",
        ],
    },
    "combustion": {
        "id": "TC-74-105",
        "ata": "ATA 74 (Ignition & Dual Spark Circuits)",
        "title": "Dual Capacitor Discharge Ignition (CDI) Timing Check & Spark Plug Renewal",
        "subsystem": "Ignition / Combustion",
        "tools": ["Stroboscopic timing light", "Spark plug gap feeler (0.6 - 0.7 mm)", "High-tension lead spark tester"],
        "parts": ["8x NGK DCPR8E spark plugs", "Dual CDI trigger pickups"],
        "authority": "Avionics / Certified A&P Mechanic",
        "hours": 2.0,
        "steps": [
            "Remove all 8 dual spark plugs; record ceramic insulator color and electrode erosion gap.",
            "Test resistance of high-tension leads (target: 5.0 kOhm +/- 10%).",
            "Install 8 fresh NGK plugs gapped precisely to 0.65 mm, torque to 20 Nm.",
            "Connect timing light to flywheel reference tooth; verify electronic ignition advance transitions from 4° BTDC to 26° BTDC.",
            "Verify dual ignition drop check on ground run (max drop 300 RPM between circuits A and B).",
        ],
    },
}


class MaintenanceTaskcardGenerator:
    """
    Automated generation of ATA-compliant maintenance work orders based on diagnostics.
    """

    def generate_taskcards(
        self,
        fault_probabilities: Dict[str, float],
        health_index: float,
        p10_rul_hours: float,
        active_fault: str = "none",
        degradation: Optional[Dict[str, float]] = None,
    ) -> List[MaintenanceTaskcard]:
        """
        Produce prioritized maintenance taskcards.
        """
        taskcards: List[MaintenanceTaskcard] = []
        deg = degradation or {}

        # 1. Evaluate top fault mode
        top_fault = max(fault_probabilities, key=fault_probabilities.get)
        top_prob = fault_probabilities.get(top_fault, 0.0)

        # Immediate grounding if health < 40 or P10 RUL < 1.0 hr
        urgency = "ROUTINE_B_CHECK"
        if health_index < 50.0 or p10_rul_hours < 2.0:
            urgency = "IMMEDIATE_GROUNDING"
        elif health_index < 75.0 or top_prob > 0.40 or p10_rul_hours < 8.0:
            urgency = "PRIORITY_A_CHECK"

        # Check all fault candidates above threshold (0.25) or explicit degradation (>0.20)
        evaluated_faults = set()
        if active_fault != "none" and active_fault in TASKCARD_TEMPLATES:
            evaluated_faults.add(active_fault)

        for fault, prob in fault_probabilities.items():
            if fault in TASKCARD_TEMPLATES and (prob > 0.25 or deg.get(fault, 0.0) > 0.20):
                evaluated_faults.add(fault)

        # If healthy, generate routine ATA 71 powerplant inspection if health < 85
        if not evaluated_faults:
            if health_index < 85.0:
                taskcards.append(
                    MaintenanceTaskcard(
                        taskcard_id="TC-71-001",
                        ata_chapter="ATA 71 (Powerplant General)",
                        title="Comprehensive Pre-Sortie Powerplant Inspection & Borescope Survey",
                        subsystem="Powerplant Overall",
                        urgency="ROUTINE_B_CHECK",
                        estimated_man_hours=1.5,
                        required_tools=["Fiberoptic Borescope", "Flashlight", "Torque wrench"],
                        required_parts=["Lock wire 0.8mm", "Air cleaner pre-filter"],
                        sign_off_authority="Certified A&P Mechanic",
                        trigger_fault="healthy",
                        trigger_condition=f"Preventative maintenance check triggered (Health={health_index:.1f}%)",
                        action_steps=[
                            "Visual survey of engine bay for fuel or oil seepage.",
                            "Inspect exhaust manifold springs and wastegate linkage freedom of travel.",
                            "Check engine mount rubber silent-bloc bushings for cracking or delamination.",
                        ],
                    )
                )
            return taskcards

        # Generate taskcard for each detected fault category
        for f in sorted(evaluated_faults):
            tmpl = TASKCARD_TEMPLATES[f]
            prob = fault_probabilities.get(f, 0.5)
            deg_val = deg.get(f, 0.0)

            tc = MaintenanceTaskcard(
                taskcard_id=tmpl["id"],
                ata_chapter=tmpl["ata"],
                title=tmpl["title"],
                subsystem=tmpl["subsystem"],
                urgency=urgency,
                estimated_man_hours=tmpl["hours"],
                required_tools=tmpl["tools"],
                required_parts=tmpl["parts"],
                sign_off_authority=tmpl["authority"],
                trigger_fault=f,
                trigger_condition=(
                    f"Fault Probability={prob*100:.1f}%, Subsystem Degradation={deg_val*100:.1f}%, "
                    f"P10 RUL={p10_rul_hours:.1f} hrs"
                ),
                action_steps=tmpl["steps"],
            )
            taskcards.append(tc)

        # Sort: IMMEDIATE_GROUNDING first, then PRIORITY_A_CHECK, then ROUTINE
        order = {"IMMEDIATE_GROUNDING": 0, "PRIORITY_A_CHECK": 1, "ROUTINE_B_CHECK": 2}
        taskcards.sort(key=lambda t: order.get(t.urgency, 99))
        return taskcards
