import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  AlertTriangle,
  Radio,
  Flame,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  Lock,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { api } from '../../services/api';

export function CyberTelemetryDetector({ className = '' }: { className?: string }) {
  const { integrity, telemetry, mission, faults, health, themeMode } = useStore(s => ({
    integrity: s.integrity,
    telemetry: s.telemetry,
    mission: s.mission,
    faults: s.faults,
    health: s.health,
    themeMode: s.themeMode,
  }));

  const isLight = themeMode === 'light';

  const [selfHealingActive, setSelfHealingActive] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const integrityScorePct = Math.round((integrity.telemetry_integrity_score || 1.0) * 100);
  const isCompromised = integrityScorePct < 75 || integrity.overall_classification?.includes('SUSPICIOUS');
  const isPhysicalFault = (health.index < 80 || (mission.active_fault && mission.active_fault !== 'none')) && !isCompromised;

  // Simulate Real Hardware Engine Degradation
  const handleSimulatePhysicalFault = async () => {
    setActionLoading(true);
    try {
      await api.clearTelemetryInjection();
      await api.injectFault('cooling', 0.65);
      const state = await api.getState();
      useStore.getState().updateFromBackend(state);
    } finally {
      setActionLoading(false);
    }
  };

  // Simulate Cyber Telemetry Spoofing / Manipulation Attack
  const handleSimulateCyberAttack = async () => {
    setActionLoading(true);
    try {
      await api.clearFault();
      // Inject isolated impossible +360Â°C EGT spike (violates CHT coupling)
      await api.injectTelemetryAnomaly('egt_c', 'spike', 360, 300);
      const state = await api.getState();
      useStore.getState().updateFromBackend(state);
    } finally {
      setActionLoading(false);
    }
  };

  // Reset to Normal
  const handleClearAll = async () => {
    setActionLoading(true);
    try {
      await api.clearFault();
      await api.clearTelemetryInjection();
      const state = await api.getState();
      useStore.getState().updateFromBackend(state);
    } finally {
      setActionLoading(false);
    }
  };

  const sensors = [
    { key: 'egt_c', label: 'EGT (Exhaust Gas Temp)', unit: 'Â°C' },
    { key: 'cht_c', label: 'CHT (Cylinder Head Temp)', unit: 'Â°C' },
    { key: 'rpm', label: 'Engine RPM', unit: 'RPM' },
    { key: 'oil_pressure_bar', label: 'Oil Pressure', unit: 'bar' },
    { key: 'oil_temp_c', label: 'Oil Temperature', unit: 'Â°C' },
    { key: 'fuel_flow_lph', label: 'Fuel Flow Rate', unit: 'L/h' },
    { key: 'vibration', label: 'Vibration Index', unit: 'mm/s' },
  ];

  return (
    <div className={`flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
      isLight
        ? 'bg-white/95 border-cyan-500/25 text-slate-900 shadow-xl'
        : 'bg-slate-950/85 backdrop-blur-xl border-cyan-500/30 text-white shadow-2xl'
    } ${className}`}>
      {/* â”€â”€ Top Header â”€â”€ */}
      <div className={`flex items-center justify-between px-5 py-3.5 border-b transition-colors ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-white/10'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs font-bold tracking-wider ${isLight ? 'text-slate-950' : 'text-white'}`}>
                CYBER-TELEMETRY ANOMALY DETECTOR
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-500 border border-cyan-500/30">
                PHYSICS-CONSTRAINED
              </span>
            </div>
            <div className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Distinguishing Authentic Hardware Failures from Data Tampering
            </div>
          </div>
        </div>

        {/* â”€â”€ Integrity Score Badge â”€â”€ */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-[9px] font-mono uppercase font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              TELEMETRY INTEGRITY
            </div>
            <div
              className={`font-mono text-sm font-extrabold ${
                integrityScorePct > 80
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : integrityScorePct > 60
                  ? 'text-sky-500 dark:text-sky-400'
                  : 'text-red-500 dark:text-red-400'
              }`}
            >
              {integrityScorePct}% TRUSTED
            </div>
          </div>
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              integrityScorePct > 80
                ? 'bg-emerald-500 animate-pulse'
                : integrityScorePct > 60
                ? 'bg-sky-500 animate-pulse'
                : 'bg-red-500 animate-ping'
            }`}
          />
        </div>
      </div>

      <div className="p-5 space-y-4 overflow-y-auto">
        {/* â”€â”€ Real-Time Verdict Card â”€â”€ */}
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isCompromised
              ? 'bg-red-950/70 border-red-500/50 text-red-200'
              : isPhysicalFault
              ? 'bg-sky-950/70 border-sky-500/50 text-sky-200'
              : isLight
              ? 'bg-emerald-50 border-emerald-500/40 text-emerald-950'
              : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {isCompromised ? (
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            ) : isPhysicalFault ? (
              <Flame className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider">
                DIAGNOSTIC VERDICT:{' '}
                {isCompromised
                  ? 'CYBER ANOMALY (MANIPULATED / SPOOFED TELEMETRY DETECTED)'
                  : isPhysicalFault
                  ? 'AUTHENTIC MECHANICAL DEGRADATION (PHYSICAL FAULT)'
                  : 'NORMAL AUTHENTIC TELEMETRY STREAM'}
              </div>
              <p className="text-xs mt-1 opacity-90 font-sans leading-relaxed">
                {isCompromised
                  ? 'Telemetry violates thermodynamic coupling laws. Individual sensor exhibits impossible rate-of-change with zero cross-sensor thermal correlation. Digital Twin analytical redundancy engaged.'
                  : isPhysicalFault
                  ? 'Multi-sensor thermodynamic coupling confirmed. CHT, EGT, and oil pressure respond in harmony according to internal combustion physics. Real component wear in progress.'
                  : 'All incoming sensor vectors are physically consistent with Digital Twin thermodynamic state estimator.'}
              </p>
            </div>
          </div>

          <div className="flex-shrink-0">
            <span
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border inline-block ${
                isCompromised
                  ? 'bg-red-900/60 text-red-200 border-red-500/60'
                  : isPhysicalFault
                  ? 'bg-sky-900/60 text-sky-200 border-sky-500/60'
                  : isLight
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                  : 'bg-emerald-900/60 text-emerald-200 border-emerald-500/60'
              }`}
            >
              {isCompromised
                ? 'CYBER ATTACK / GLITCH'
                : isPhysicalFault
                ? 'AUTHENTIC ENGINE FAULT'
                : 'CLEAN TELEMETRY'}
            </span>
          </div>
        </div>

        {/* â”€â”€ Key Distinction Explainer (How AERO-TWIN Tells Them Apart) â”€â”€ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className={`p-3.5 rounded-xl border ${
            isLight ? 'bg-cyan-50/60 border-cyan-500/20' : 'bg-slate-900/70 border-white/10'
          }`}>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-sky-600 dark:text-sky-300 mb-2">
              <Flame className="w-4 h-4 text-sky-500 dark:text-sky-400" />
              <span>AUTHENTIC ENGINE FAULTS (PHYSICS-BOUND)</span>
            </div>
            <ul className={`text-[11px] font-sans space-y-1.5 leading-snug ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Multi-Sensor Coupling:</strong> EGT and CHT temperatures rise together with thermal mass inertia.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Viscosity Proportionality:</strong> Oil pressure loss correlates directly with oil temperature spike.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Verdict:</strong> Require flight plan replanning or mechanical maintenance.</span>
              </li>
            </ul>
          </div>

          <div className={`p-3.5 rounded-xl border ${
            isLight ? 'bg-cyan-50/60 border-cyan-500/20' : 'bg-slate-900/70 border-white/10'
          }`}>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 mb-2">
              <Zap className="w-4 h-4 text-cyan-500" />
              <span>CYBER MANIPULATION (PHYSICS-VIOLATED)</span>
            </div>
            <ul className={`text-[11px] font-sans space-y-1.5 leading-snug ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              <li className="flex items-start gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <span><strong>Isolated Anomaly:</strong> EGT spikes +300Â°C instantly while CHT remains cold (physically impossible).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <span><strong>Zero Variance:</strong> Sensor frozen at static bit-pattern (sensor lockup or spoofed stream).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Self-Healing:</strong> Digital Twin substitutes synthetic estimate to prevent unnecessary abort!</span>
              </li>
            </ul>
          </div>
        </div>

        {/* â”€â”€ Multi-Sensor Consistency & Self-Healing Table â”€â”€ */}
        <div className={`rounded-xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/60 border-white/10'
        }`}>
          <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-white/10'
          }`}>
            <span className={`font-mono text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              TELEMETRY CROSS-CHECK & TWIN SELF-HEALING AUDIT
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                DIGITAL TWIN ESTIMATION:
              </span>
              <button
                onClick={() => setSelfHealingActive(!selfHealingActive)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  selfHealingActive
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40'
                    : isLight
                    ? 'bg-slate-200 text-slate-600'
                    : 'bg-white/10 text-slate-400'
                }`}
              >
                {selfHealingActive ? 'ACTIVE (HEALING)' : 'RAW ONLY'}
              </button>
            </div>
          </div>

          <table className="w-full text-left font-mono text-[11px]">
            <thead className={`border-b text-[10px] uppercase ${
              isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-950/80 text-slate-400 border-white/10'
            }`}>
              <tr>
                <th className="py-2.5 px-4 font-semibold">Sensor</th>
                <th className="py-2.5 px-3 font-semibold">Raw Telemetry</th>
                <th className="py-2.5 px-3 font-semibold">Twin Expected</th>
                <th className="py-2.5 px-3 font-semibold">Confidence</th>
                <th className="py-2.5 px-3 font-semibold">Integrity Classification</th>
                <th className="py-2.5 px-4 font-semibold">Effective Value Used</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-200 text-slate-800' : 'divide-white/5 text-slate-300'}`}>
              {sensors.map(s => {
                const actualVal = (telemetry.actual as any)?.[s.key];
                const expVal = (telemetry.expected as any)?.[s.key];
                const status = integrity.sensor_statuses?.[s.key];
                const isUnreliable = status && status.confidence < 0.6;
                const isUsingTwin = selfHealingActive && (isUnreliable || status?.using_twin_estimate);

                return (
                  <tr
                    key={s.key}
                    className={`transition-colors ${
                      isUnreliable
                        ? isLight ? 'bg-red-50' : 'bg-red-950/30'
                        : isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className={`py-2.5 px-4 font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>
                      {s.label}
                    </td>
                    <td className="py-2.5 px-3">
                      {actualVal !== undefined ? `${actualVal.toFixed(1)} ${s.unit}` : '---'}
                    </td>
                    <td className={`py-2.5 px-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {expVal !== undefined ? `${expVal.toFixed(1)} ${s.unit}` : '---'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-bold ${
                          (status?.confidence ?? 1.0) > 0.8
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : (status?.confidence ?? 1.0) > 0.5
                            ? 'text-sky-600 dark:text-sky-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {Math.round((status?.confidence ?? 1.0) * 100)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {isUnreliable ? (
                        <span className="inline-flex items-center gap-1 text-red-500 font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{status?.reason || 'VIOLATION'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>PHYSICALLY PLAUSIBLE</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-bold">
                      {isUsingTwin && expVal !== undefined ? (
                        <span className="text-cyan-600 dark:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                          {expVal.toFixed(1)} {s.unit} (Twin Synthetic)
                        </span>
                      ) : actualVal !== undefined ? (
                        <span className={isLight ? 'text-slate-950' : 'text-white'}>
                          {actualVal.toFixed(1)} {s.unit}
                        </span>
                      ) : (
                        '---'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* â”€â”€ Interactive 1-Click Demonstration Bench â”€â”€ */}
        <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-white/10'
        }`}>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>
              INTERACTIVE TEST BENCH:
            </span>
            <span className={`hidden sm:inline ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Inject real hardware degradation or cyber telemetry manipulation
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSimulatePhysicalFault}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Simulate Real Engine Fault</span>
            </button>

            <button
              onClick={handleSimulateCyberAttack}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate Cyber Spoofing</span>
            </button>

            <button
              onClick={handleClearAll}
              disabled={actionLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer disabled:opacity-50 ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Normal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

