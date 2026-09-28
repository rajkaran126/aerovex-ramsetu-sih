import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { TelemetryGrid } from '../components/dashboard/TelemetryGrid';
import { HealthGauge, RULPanel, MissionRiskPanel } from '../components/dashboard/HealthGauge';
import { GPSTrackingMap } from '../components/aerospace/GPSTrackingMap';
import { CyberTelemetryDetector } from '../components/aerospace/CyberTelemetryDetector';
import { MissionReplanningChat } from '../components/aerospace/MissionReplanningChat';
import {
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  Cpu,
  AlertTriangle,
  Zap,
  Radio,
  Flame,
  Activity,
  Map,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

function fmt(v: number | undefined, d = 1) {
  if (v === undefined || v === null || !isFinite(v)) return '---';
  return v.toFixed(d);
}


// ── Fault Panel ────────────────────────────────────────────────────────────
function FaultPanel() {
  const { faults, anomaly } = useStore(s => ({ faults: s.faults, anomaly: s.anomaly }));
  const probs = faults.probabilities || {};
  const sorted = Object.entries(probs).sort(([, a], [, b]) => (b as number) - (a as number));

  const faultColors: Record<string, string> = {
    healthy: '#10b981',
    injector: '#f59e0b',
    cooling: '#f97316',
    lubrication: '#f43f5e',
    combustion: '#ec4899',
    mechanical: '#a855f7',
    sensor: '#0ea5e9',
  };

  return (
    <div className="glass-panel rounded-[1.5rem] p-5 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-400 flex-shrink-0">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <span className="font-display font-bold text-xs text-white tracking-wider truncate">
            FAULT CLASSIFIER
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest truncate">
          RANDOM FOREST // 7-CLASS
        </span>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto pr-1">
        {/* Anomaly score banner */}
        <div
          className={`p-3 rounded-xl border flex items-center justify-between ${
            anomaly.is_anomaly
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30'
          }`}
        >
          <div>
            <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">
              ISOLATION FOREST ANOMALY
            </div>
            <div
              className={`text-xs font-mono font-bold mt-0.5 ${
                anomaly.is_anomaly ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {anomaly.anomaly_class || 'NORMAL BASELINE'}
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-xl font-black font-mono ${
                anomaly.is_anomaly ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {fmt((anomaly.anomaly_score ?? 0) * 100, 0)}%
            </div>
            <div className="text-[9px] font-mono text-slate-400 uppercase">CONFIDENCE</div>
          </div>
        </div>

        {/* Fault probabilities */}
        <div className="space-y-2 pt-1">
          {sorted.map(([fault, prob]) => {
            const p = prob as number;
            const color = faultColors[fault] || '#64748b';
            const isTop = fault === faults.top_fault && fault !== 'healthy';

            return (
              <div key={fault} className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span
                    className={`font-semibold tracking-wide ${
                      isTop ? 'text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    {isTop && '▶ '}
                    {fault.toUpperCase()}
                  </span>
                  <span className="font-bold" style={{ color }}>
                    {fmt(p * 100, 1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${p * 100}%`,
                      background: color,
                      boxShadow: isTop ? `0 0 8px ${color}88` : 'none',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Telemetry Integrity Panel ─────────────────────────────────────────────
function IntegrityPanel() {
  const integrity = useStore(s => s.integrity);
  const score = integrity.telemetry_integrity_score ?? 1;
  const isGood = score > 0.8;
  const isFair = score > 0.5;
  const color = isGood ? '#10b981' : isFair ? '#f59e0b' : '#f43f5e';
  const classLabel = integrity.overall_classification || 'NORMAL TELEMETRY';

  return (
    <div className="glass-panel rounded-[1.5rem] p-5 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <span className="font-display font-bold text-xs text-white tracking-wider truncate">
            TELEMETRY INTEGRITY
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest truncate">
          ZERO-TRUST DEFENSE
        </span>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto pr-1">
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">
              INTEGRITY SCORE
            </div>
            <div className="text-2xl font-black font-mono mt-0.5" style={{ color }}>
              {fmt(score * 100, 0)}%
            </div>
          </div>
          <span
            className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border max-w-[140px] truncate"
            style={{
              background: `${color}15`,
              borderColor: `${color}40`,
              color,
            }}
          >
            {classLabel}
          </span>
        </div>

        {/* Affected sensors tag list */}
        {integrity.affected_sensors?.length > 0 && (
          <div>
            <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider mb-1.5">
              AFFECTED SENSORS:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {integrity.affected_sensors.map(sensor => (
                <span
                  key={sensor}
                  className="px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-bold"
                >
                  {sensor.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sensor statuses */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider mb-1">
            ESTIMATION CONFIDENCE:
          </div>
          {Object.entries(integrity.sensor_statuses || {}).slice(0, 4).map(([sensor, status]: [string, any]) => (
            <div key={sensor} className="flex justify-between items-center text-[10px] font-mono p-1.5 rounded-lg bg-white/[0.02]">
              <span className="text-slate-300">{sensor.toUpperCase()}</span>
              <span
                className="font-bold"
                style={{
                  color:
                    status.confidence > 0.8
                      ? '#10b981'
                      : status.confidence > 0.5
                      ? '#f59e0b'
                      : '#f43f5e',
                }}
              >
                {Math.round(status.confidence * 100)}% {status.using_twin_estimate ? '(TWIN)' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Alert Panel ───────────────────────────────────────────────────────────
function AlertPanel() {
  const { missionRisk, faults, integrity, anomaly, edgeMode, bufferedSteps } = useStore(s => ({
    missionRisk: s.missionRisk,
    faults: s.faults,
    integrity: s.integrity,
    anomaly: s.anomaly,
    edgeMode: s.edgeMode,
    bufferedSteps: s.bufferedSteps,
  }));

  const alerts: { type: 'info' | 'warning' | 'danger'; msg: string }[] = [];

  if (edgeMode) {
    alerts.push({
      type: 'info',
      msg: `EDGE MODE ACTIVE — ${bufferedSteps} steps buffered on-vehicle`,
    });
  }
  if (missionRisk.risk_level === 'HIGH') {
    alerts.push({
      type: 'danger',
      msg: `MISSION RISK HIGH — ${missionRisk.recommended_action}`,
    });
  } else if (missionRisk.risk_level === 'MEDIUM') {
    alerts.push({
      type: 'warning',
      msg: `MISSION RISK MEDIUM — ${missionRisk.recommended_action}`,
    });
  }
  if (anomaly.is_anomaly) {
    alerts.push({ type: 'warning', msg: `ANOMALY DETECTED: ${anomaly.anomaly_class}` });
  }
  const topFault = faults.top_fault;
  if (topFault !== 'healthy' && (faults.top_fault_probability ?? 0) > 0.5) {
    alerts.push({
      type: 'warning',
      msg: `PROPULSION FAULT: ${topFault?.toUpperCase()} (${fmt(
        (faults.top_fault_probability ?? 0) * 100,
        0
      )}%)`,
    });
  }
  if (integrity.overall_classification !== 'NORMAL TELEMETRY') {
    alerts.push({ type: 'warning', msg: `DEFENSE: ${integrity.overall_classification}` });
  }
  if (missionRisk.rul_insufficient) {
    alerts.push({ type: 'danger', msg: 'RUL INSUFFICIENT FOR REMAINING PROFILE' });
  }

  return (
    <div className="glass-panel rounded-[1.5rem] p-5 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <span className="font-display font-bold text-xs text-white tracking-wider truncate">
            TACTICAL ADVISORIES
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-widest uppercase border flex-shrink-0 ${
            alerts.length > 0
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          }`}
        >
          {alerts.length > 0 ? `${alerts.length} ALERTS` : 'NOMINAL'}
        </span>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-mono text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>ALL AVIONICS & TWIN SUB-CHANNELS NOMINAL</span>
          </div>
        ) : (
          alerts.map((a, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2 ${
                a.type === 'danger'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : a.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-sky-500/10 border-sky-400/30 text-sky-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span className="break-words min-w-0">{a.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Degradation Panel ─────────────────────────────────────────────────────
function DegradationPanel() {
  const degradation = useStore(s => s.degradation);
  const colors = {
    injector: '#f59e0b',
    cooling: '#f97316',
    lubrication: '#f43f5e',
    mechanical: '#a855f7',
    combustion: '#ec4899',
  };

  return (
    <div className="glass-panel rounded-[1.5rem] p-5 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-rose-400 flex-shrink-0">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <span className="font-display font-bold text-xs text-white tracking-wider truncate">
            DEGRADATION STATE
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest truncate">
          PHYSICS TWIN
        </span>
      </div>

      <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
        {Object.entries(degradation).map(([key, val]) => {
          const v = val as number;
          const color = (colors as any)[key] || '#64748b';

          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-300 font-semibold tracking-wide uppercase">
                  {key}
                </span>
                <span className="font-bold" style={{ color }}>
                  {fmt(v * 100, 0)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${v * 100}%`,
                    background:
                      v > 0.7 ? '#f43f5e' : v > 0.4 ? '#f59e0b' : v > 0.1 ? '#eab308' : '#334155',
                    boxShadow: v > 0.4 ? `0 0 8px ${color}88` : 'none',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'gps' | 'cyber' | 'chat'>('matrix');

  return (
    <div className="dashboard-page w-full h-full flex flex-col overflow-y-auto pb-28 [&>*]:flex-shrink-0">
      {/* ── Top Dashboard Workspace Switcher ── */}
      <div className="mx-5 my-2.5 p-1.5 rounded-2xl bg-[#06101c]/80 backdrop-blur-xl border border-[#1a2f4a]/80 shadow-lg flex items-center justify-between gap-3 flex-wrap z-20">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'bg-sky-500/20 text-white border border-sky-400/50 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>LIVE TELEMETRY MATRIX</span>
          </button>

          <button
            onClick={() => setActiveTab('gps')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'gps'
                ? 'bg-sky-500/20 text-white border border-sky-400/50 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>GPS TRACKING MAP (4 TERRAINS)</span>
          </button>

          <button
            onClick={() => setActiveTab('cyber')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cyber'
                ? 'bg-sky-500/20 text-white border border-sky-400/50 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>CYBER-TELEMETRY ANOMALY DETECTION</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'chat'
                ? 'bg-sky-500/20 text-white border border-sky-400/50 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>MISSION REPLANNING COPILOT (CHAT)</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 pr-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>AUTONOMOUS ENGINE TWIN • ONLINE</span>
        </div>
      </div>

      {activeTab === 'gps' && (
        <div className="px-5 pb-3 flex-1 min-h-[600px] flex flex-col">
          <div className="h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-950/80 min-h-[580px] flex flex-col">
            <GPSTrackingMap />
          </div>
        </div>
      )}

      {activeTab === 'cyber' && (
        <div className="px-5 pb-3 flex-1 min-h-[600px]">
          <CyberTelemetryDetector />
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="px-5 pb-3 flex-1 min-h-[600px]">
          <MissionReplanningChat />
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="dashboard-grid px-5 pb-3 pt-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Health Gauge + Degradation Panel (3 Cols) */}
          <div className="lg:col-span-3 flex flex-col gap-4 min-h-0 overflow-hidden">
            <div className="flex-shrink-0">
              <HealthGauge />
            </div>
            <div className="flex-1 min-h-0">
              <DegradationPanel />
            </div>
          </div>

          {/* Center Column: Telemetry Matrix + Fault Classifier & Integrity (6 Cols) */}
          <div className="lg:col-span-6 flex flex-col gap-4 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0">
              <TelemetryGrid />
            </div>
            <div className="h-48 grid grid-cols-1 sm:grid-cols-2 gap-4 flex-shrink-0">
              <FaultPanel />
              <IntegrityPanel />
            </div>
          </div>

          {/* Right Column: RUL Prediction + Pareto Risk + Advisories (3 Cols) */}
          <div className="lg:col-span-3 flex flex-col gap-4 min-h-0 overflow-hidden">
            <div className="flex-shrink-0">
              <RULPanel />
            </div>
            <div className="flex-shrink-0">
              <MissionRiskPanel />
            </div>
            <div className="flex-1 min-h-0">
              <AlertPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

