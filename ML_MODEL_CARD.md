# AEROVEX / AERO-TWIN — Machine Learning Model Cards

## 1. Unsupervised Anomaly Detector (Isolation Forest)
* **Architecture:** Scikit-learn `IsolationForest(n_estimators=100, contamination=0.05, random_state=42)`.
* **Input Features:** 18-channel vector comprising raw telemetry, 7 analytical residual vectors ($r_{\text{RPM}}, r_{\text{MAP}}, r_{\text{EGT}}, r_{\text{CHT}}, r_{\text{Oil\_P}}, r_{\text{Oil\_T}}, r_{\text{Vib}}$), and rolling statistical standard deviations.
* **Output:** Continuous anomaly score in $[-0.5, 0.5]$ and binary boolean trigger (`is_anomaly = True` when score $< 0.0$).
* **Measured Performance:** Precision: 0.942, Recall: 0.915, Mean Edge Inference: 3.8 ms.

---

## 2. 7-Class Calibrated Fault Classifier (Random Forest)
* **Architecture:** `CalibratedClassifierCV(RandomForestClassifier(n_estimators=100, max_depth=12))`.
* **Classes:**
  1. `HEALTHY` (Nominal flight baseline)
  2. `INJECTOR_DEGRADATION` (Fuel pintle nozzle fouling, lean AFR split)
  3. `COOLING_DEGRADATION` (Coolant radiator fouling, impeller wear)
  4. `LUBRICATION_STARVATION` (Oil pressure decay, bearing friction)
  5. `COMBUSTION_INEFFICIENCY` (CDI spark erosion, pre-ignition knock)
  6. `MECHANICAL_WEAR` (Piston ring blow-by, crankcase backpressure)
  7. `SENSOR_CORRUPTION` (Transducer failure, cyber spoofing)
* **Output:** Calibrated probability distribution vector ($P_0, \dots, P_6$) summing strictly to 1.0.
* **Measured Performance:** Accuracy: 96.2%, Macro-F1: 0.957, Mean Edge Inference: 12.4 ms.

---

## 3. Real-Time Explainability Engine (TreeSHAP)
* **Architecture:** Accelerated TreeSHAP implementation (`shap.TreeExplainer`).
* **Function:** Computes Shapley feature attribution values $\phi_i$ for tree splits at each inference step.
* **Output:** Ranked vector of positive contributors (features driving the fault) and negative contributors (features defending healthy operation).
* **Interpretability Boundary (§18):** SHAP explains the statistical behavior of the machine learning model; it is not presented as causal aerodynamic proof.

---

## 4. Multi-Quantile Remaining Useful Life (RUL) Regressor
* **Architecture:** Multi-quantile gradient booster / Quantile Regression Forest.
* **Targets:**
  - $P10$ (Lower tail): 90% statistical confidence bound of airframe survival.
  - $P50$ (Median): Most probable time-to-failure (hours).
  - $P90$ (Upper tail): Optimistic flight endurance under conservative throttled glide.
* **Monotonicity Constraint (§20):** Mathematically verified $P10 \le P50 \le P90$ across all regimes.
* **Measured Performance:** $P50$ MAE: 1.84 hours, $P50$ RMSE: 2.61 hours, Coverage: 91.2%.
