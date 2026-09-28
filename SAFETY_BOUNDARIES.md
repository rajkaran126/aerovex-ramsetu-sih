# AEROVEX / AERO-TWIN — Operational Safety & Regulatory Boundaries

## 1. Prototype & Demonstrator Status (§3)

> [!IMPORTANT]
> **OPERATIONAL DECISION-SUPPORT DEMONSTRATOR ONLY**  
> AEROVEX is an experimental cyber-physical research prototype and operational decision-support demonstrator. It is **NOT** certified by the FAA, EASA, CEMILAC, or DGCA for flight-critical control.

* **No Direct Control Authority:** The software does not directly command aerodynamic flight surfaces, actuators, electronic engine controls (FADEC), fuel metering valves, or weapon systems.
* **Human-in-the-Loop Mandate:** All contingency flight plans (Return to Base, Emergency Diversion, Safe Descent) are advisory recommendations requiring **explicit human operator authorization** prior to execution.

---

## 2. Physical Engine Test Bench Safety (§5)

* **Non-Destructive Testing:** Physical ground testing on internal combustion aero-engines must **never** intentionally induce destructive mechanical seizures or disable safety cutoffs.
* **Emergency Magneto Cutoff:** The test bench hardware includes an optically isolated emergency cutoff circuit on GPIO `PC13` that instantly grounds the engine magneto ignition if Cylinder Head Temperature exceeds $250^\circ\text{C}$ or oil pressure falls below $1.5\text{ bar}$.
* **Galvanic Isolation:** The microcontroller and edge computer logic planes are isolated from engine 24V supply lines by a 1500V DC-DC isolation barrier and 6N137 high-speed optical isolators.

---

## 3. The Numerical Authority Rule (§4)

* **No LLM Fabrication:** Large Language Models (LLMs) are strictly non-authoritative regarding numerical telemetry.
* **Mathematical Provenance:** All Health Indices, analytical residuals, anomaly scores, fault probabilities, TreeSHAP values, quantile RUL ($P10 \le P50 \le P90$), and Pareto objective trade-offs are generated exclusively by deterministic physics equations, certified machine learning models, or numerical optimizers.
* **Role of LLMs:** LLMs serve solely to interpret, explain, and synthesize structured numerical outputs into military operational debriefs for human command.

---

## 4. Simulated NavIC & Environmental Representation (§28)

* **Sovereign Navigation Fallback:** In the absence of an active physical multi-frequency NavIC GNSS receiver antenna, satellite constellations, carrier-to-noise ratios, and jamming vectors are mathematically simulated.
* **No False Lock Claims:** Operational documentation and UI consoles clearly label simulated navigation telemetry as **SIMULATED NavIC / NAVIGATION REPRESENTATION**.
