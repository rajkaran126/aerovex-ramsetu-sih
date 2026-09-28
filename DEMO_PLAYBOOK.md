# AEROVEX / AERO-TWIN — 27-Step Operational Demonstration Playbook

This playbook outlines the exact step-by-step procedure for demonstrating AERO-TWIN to defense evaluators and technical juries (§67).

---

## 27-Step Demonstration Sequence

1. **System Initialization:** Launch the platform via `start.bat` or `./run_backend.py` + `npm run dev`.
2. **System Readiness Check:** Navigate to the **System Readiness Audit** console; confirm all subsystems show `READY`.
3. **Start Nominal Mission:** Select `HEALTHY_ISR` mission profile over the Ladakh LAC sector.
4. **Physical & Simulated Telemetry Verification:** Observe the 7 engine channels streaming at nominal values.
5. **Digital Twin Expected State:** Inspect the analytical expected curve tracking actual telemetry with near-zero residuals.
6. **Residual Stream Analysis:** Confirm that residual errors $r(t) = y_{\text{actual}}(t) - y_{\text{expected}}(t)$ remain within $\pm 2\%$.
7. **Health Index Baseline:** Verify that the Engine Health Index reports $>95\%$ (`HEALTHY`, Green).
8. **Inject Progressive Injector Degradation:** Use the fault injection console to set Injector Degradation to 0.70.
9. **Observe Residual Divergence:** Watch actual EGT increase by $+85^\circ\text{C}$ while twin expected remains nominal.
10. **Unsupervised Anomaly Trigger:** Verify that the Isolation Forest anomaly detector trips within 2 seconds.
11. **Supervised Fault Diagnosis:** Confirm that the Calibrated Random Forest identifies `INJECTOR_DEGRADATION` with $>85\%$ confidence.
12. **Real-Time TreeSHAP Attribution:** Inspect the SHAP waterfall plot confirming EGT residual as the #1 physical contributor.
13. **Continuous Degradation Tracking:** Observe the degradation kinematics state shift from `STABLE` to `SLOW_DEGRADATION`.
14. **Quantile RUL Forecast:** Examine the $P10$, $P50$, and $P90$ RUL interval; verify $P10 \le P50 \le P90$.
15. **Mission Risk Assessment:** Note that remaining sortie duration begins to encroach upon lower-bound $P10$ RUL.
16. **Execute What-If Contingency:** In the What-If console, adjust throttle to 60% and altitude to 10,000 ft; observe RUL recovery.
17. **Generate Pareto Replanning Profiles:** Trigger the Pareto Replanner; inspect Option A (RTB), Option B (Cruise), Option C (Descent).
18. **Holographic Ghost UAV Display:** Observe the cyan Ghost UAV shadow trajectory rendering the Option A path in 3D and 2D.
19. **Inject Cyber Anomaly (EGT Sensor Freeze):** From the cyber console, inject a sensor freeze on EGT.
20. **Zero-Trust Detection & Isolation:** Observe the Zero-Trust Shield flag `CYBER_ANOMALY` within 15 timesteps.
21. **Self-Healing Telemetry Activation:** Confirm that the EGT channel is tagged with `source = 'reconstructed'` and synthetic twin telemetry is substituted.
22. **Mechanical vs. Cyber Decoupling:** Demonstrate that engine mechanical health remains objective and does not falsely crash.
23. **Electronic Warfare Jamming Test:** Inject GNSS jamming; verify sub-200ms failover to the ISRO NavIC satellite constellation.
24. **SwarmNet Tactical Mesh Rerouting:** Observe 4-UAV SwarmNet mesh autonomously route packets through airborne relay Delta-4.
25. **Prescriptive Maintenance ATA Work Order:** Navigate to Maintenance; inspect generated `ATA 73 (Engine Fuel)` taskcard with tools and parts.
26. **Tamper-Evident Blackbox Ledger:** Review the SHA-256 chained logbook; verify `CRYPTOGRAPHIC INTEGRITY: VERIFIED`.
27. **Complete Flight Replay:** Scrub the timeline back to the sortie start to review the full chronological chain of events.
