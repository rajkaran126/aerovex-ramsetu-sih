import React, { useState, Suspense, lazy, useMemo } from 'react';
import { useStore, SimView } from '../store/useStore';
import { api } from '../services/api';
import { HealthGauge, RULPanel, MissionRiskPanel } from '../components/dashboard/HealthGauge';
import { SwarmNetPanel } from '../components/3d/SwarmNetPanel';
import {
  Compass,
  Layers,
  Activity,
  Zap,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  MapPin,
  Flame,
  Radio,
  Eye,
  Camera,
} from 'lucide-react';

import { GPSTacticalHUD } from '../components/aerospace/GPSTacticalHUD';
import { FlightJoystick } from '../components/aerospace/FlightJoystick';

const UAVScene = lazy(() => import('../components/3d/UAVScene').then(m => ({ default: m.UAVScene })));

function fmt(v: number | undefined, d = 1) {
  if (v === undefined || !isFinite(v)) return '---';
  return v.toFixed(d);
}

// ── View Selector ────────────────────────────────────────────────────────
const VIEWS: { key: SimView; label: string; icon: any }[] = [
  { key: 'chase', label: 'CHASE', icon: Camera },
  { key: 'cockpit', label: 'COCKPIT', icon: Eye },
  { key: 'tactical', label: 'TACTICAL', icon: Compass },
  { key: 'engine', label: 'ENGINE', icon: Flame },
  { key: 'environment', label: 'ENVIRON', icon: MapPin },
  { key: 'ai', label: 'AI REASONING', icon: Sparkles },
  { key: 'swarm', label: 'SWARM NET', icon: Radio },
];

const TERRAINS: {
  key: string;
  label: string;
  icon: string;
  modelBadge: string;
  sectorName: string;
  defaultLat: number;
  defaultLon: number;
  defaultAlt: number;
}[] = [
  {
    key: 'MOUNTAIN',
    label: 'HIMALAYAS BORDER (LADAKH)',
    icon: '🏔️',
    modelBadge: 'MULTI-LAYER 3D',
    sectorName: 'Ladakh / Siachen Sector, India',
    defaultLat: 34.1526,
    defaultLon: 77.5771,
    defaultAlt: 18500,
  },
  {
    key: 'DESERT',
    label: 'THAR DESERT (RAJASTHAN)',
    icon: '🏜️',
    modelBadge: 'MULTI-LAYER 3D',
    sectorName: 'Pokhran / Jaisalmer Sector, India',
    defaultLat: 26.9157,
    defaultLon: 70.9083,
    defaultAlt: 4500,
  },
  {
    key: 'MARITIME',
    label: 'INDIAN OCEAN EEZ',
    icon: '🌊',
    modelBadge: 'OCEAN SWELL',
    sectorName: 'Arabian Sea / Mumbai High, India',
    defaultLat: 18.9220,
    defaultLon: 72.8347,
    defaultAlt: 7200,
  },
  {
    key: 'FOREST',
    label: 'WESTERN GHATS (NIGHT RECON)',
    icon: '🌲',
    modelBadge: 'DENSE CANOPY',
    sectorName: 'Nilgiri / Southern Command, India',
    defaultLat: 11.4102,
    defaultLon: 76.6950,
    defaultAlt: 8200,
  },
];

function ViewSelector() {
  const {
    activeView,
    setActiveView,
    splitView,
    setSplitView,
    showGhostUAV,
    setShowGhostUAV,
    swarmEnabled,
    setSwarmEnabled,
    mission,
    setEnvironment,
  } = useStore(s => ({
    activeView: s.activeView,
    setActiveView: s.setActiveView,
    splitView: s.splitView,
    setSplitView: s.setSplitView,
    showGhostUAV: s.showGhostUAV,
    setShowGhostUAV: s.setShowGhostUAV,
    swarmEnabled: s.swarmEnabled,
    setSwarmEnabled: s.setSwarmEnabled,
    mission: s.mission,
    setEnvironment: s.setEnvironment,
  }));

  const currentEnv = mission.environment || 'STANDARD';

  return (
    <div className="glass-panel mx-4 my-2.5 p-3 rounded-2xl flex flex-col gap-2.5 z-20 flex-shrink-0">
      {/* Top View Selector Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-widest mr-2 flex items-center gap-1">
            <Camera className="w-3 h-3" />
            3D VIEW:
          </span>
          {VIEWS.map(v => {
            const Icon = v.icon;
            const isActive = activeView === v.key;

            return (
              <button
                key={v.key}
                onClick={() => setActiveView(v.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono font-medium tracking-wider transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(14,165,233,0.3)] font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-3 h-3 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tactical View Modifiers */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSwarmEnabled(!swarmEnabled);
              if (!swarmEnabled && activeView !== 'swarm') {
                setActiveView('swarm');
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono tracking-wider transition-all ${
              swarmEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.3)] font-bold'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-white/10'
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>SWARM NET</span>
          </button>
          <button
            onClick={() => setSplitView(!splitView)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono tracking-wider transition-all ${
              splitView
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(14,165,233,0.3)] font-bold'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-white/10'
            }`}
          >
            <span>⧉ SPLIT</span>
          </button>
          <button
            onClick={() => setShowGhostUAV(!showGhostUAV)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono tracking-wider transition-all ${
              showGhostUAV
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.3)] font-bold'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-white/10'
            }`}
          >
            <span>◎ GHOST UAV</span>
          </button>
        </div>
      </div>

      {/* Bottom Terrain Theatres Bar */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/5 overflow-x-auto">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold mr-1 flex items-center gap-1 whitespace-nowrap">
          <MapPin className="w-3 h-3 text-cyan-400" />
          THEATRE:
        </span>
        {TERRAINS.map(t => {
          const isActive = currentEnv === t.key;
          return (
            <button
              key={t.key}
              onClick={async () => {
                try {
                  await api.setMission(mission.profile, t.key);
                  useStore.getState().updateFromBackend(await api.getState());
                } catch { /* Shared request feedback reports the failure. */ }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(14,165,233,0.3)] font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                  isActive
                    ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/30'
                    : 'bg-white/5 text-slate-500'
                }`}
              >
                {t.modelBadge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Cockpit HUD Overlay ───────────────────────────────────────────────────
function CockpitHUD() {
  const { telemetry, health, mission, uav } = useStore(s => ({
    telemetry: s.telemetry,
    health: s.health,
    mission: s.mission,
    uav: s.uav,
  }));
  const a = telemetry.actual;

  const healthColor =
    health.index > 80 ? '#10b981' : health.index > 60 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="hud-overlay pointer-events-none">
      {/* Top HUD bar */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-6 px-6 py-2 rounded-2xl glass-panel border border-cyan-400/30 text-center font-mono">
        {[
          { label: 'ALTITUDE', value: `${Math.round(uav.altitude_ft / 100) * 100}`, unit: 'FT' },
          { label: 'AIRSPEED', value: fmt(uav.speed_kts, 0), unit: 'KTS' },
          { label: 'HEADING', value: fmt(uav.heading_deg, 0), unit: '°' },
          { label: 'HEALTH', value: fmt(health.index, 0), unit: '%', color: healthColor },
        ].map(({ label, value, unit, color }) => (
          <div key={label}>
            <div className="text-[8px] text-slate-400 tracking-wider font-bold">{label}</div>
            <div className="text-sm font-black text-white" style={{ color }}>
              {value}
            </div>
            <div className="text-[8px] text-slate-500">{unit}</div>
          </div>
        ))}
      </div>

      {/* Left HUD — Engine */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-2xl glass-panel border border-cyan-400/20 font-mono space-y-2">
        <div className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest pb-1 border-b border-white/10">
          PROPULSION HUD
        </div>
        {[
          { label: 'RPM', value: fmt(a.rpm, 0) },
          { label: 'EGT', value: `${fmt(a.egt_c, 0)}°C` },
          { label: 'CHT', value: `${fmt(a.cht_c, 0)}°C` },
          { label: 'OIL P', value: `${fmt(a.oil_pressure_bar, 2)} bar` },
          { label: 'FUEL', value: `${fmt(a.fuel_flow_lph, 1)} L/h` },
        ].map(item => (
          <div key={item.label} className="flex justify-between gap-4 text-xs">
            <span className="text-slate-400">{item.label}</span>
            <span className="font-bold text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Pipeline View Overlay ──────────────────────────────────────────────
function AIFlowOverlay() {
  const { health, anomaly, faults, rul, missionRisk } = useStore(s => ({
    health: s.health,
    anomaly: s.anomaly,
    faults: s.faults,
    rul: s.rul,
    missionRisk: s.missionRisk,
  }));

  const steps = [
    { label: 'ENGINE STATE', value: `${Math.round(health.index)}% HEALTH`, color: '#38bdf8' },
    { label: 'DIGITAL TWIN', value: 'RESIDUALS COMPUTED', color: '#38bdf8' },
    {
      label: 'ANOMALY',
      value: anomaly.is_anomaly ? `⚠ ${anomaly.anomaly_class}` : '✓ NORMAL',
      color: anomaly.is_anomaly ? '#fbbf24' : '#34d399',
    },
    {
      label: 'FAULT DIAGNOSIS',
      value: faults.top_fault?.toUpperCase(),
      color: faults.top_fault !== 'healthy' ? '#fbbf24' : '#34d399',
    },
    { label: 'RUL REGRESSION', value: `${fmt(rul.rul_median)}h MEDIAN`, color: '#38bdf8' },
    {
      label: 'MISSION RISK',
      value: missionRisk.risk_level,
      color:
        missionRisk.risk_level === 'HIGH'
          ? '#fb7185'
          : missionRisk.risk_level === 'MEDIUM'
          ? '#fbbf24'
          : '#34d399',
    },
    {
      label: 'ACTION',
      value: missionRisk.recommended_action,
      color: missionRisk.risk_level === 'HIGH' ? '#fb7185' : '#34d399',
    },
  ];

  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-6 rounded-3xl glass-panel border border-cyan-400/40 min-w-[280px] pointer-events-none shadow-2xl">
      <div className="text-center mb-4 font-mono text-xs font-bold text-cyan-300 tracking-[0.2em]">
        AI REASONING FLOWGRAPH
      </div>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-xs font-mono min-w-0">
            <div className="w-28 text-[10px] text-slate-400 text-right font-bold tracking-wider flex-shrink-0">
              {s.label}
            </div>
            <div className="w-1 h-5 bg-cyan-400/40 rounded-full flex-shrink-0" />
            <div className="flex-1 font-bold truncate min-w-0" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scenario + Controls Panel ─────────────────────────────────────────────
function ControlsPanel() {
  const [fault, setFault] = useState('none');
  const [severity, setSeverity] = useState(0.7);
  const [scenario, setScenario] = useState('HEALTHY_ISR');
  const [speedMult, setSpeedMult] = useState(1);

  const handleLoadScenario = async () => {
    await api.loadScenario(scenario);
    useStore.getState().setIsRunning(true);
  };

  return (
    <div className="glass-panel rounded-[1.5rem] p-5 flex flex-col h-full overflow-y-auto space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span className="font-display font-bold text-sm text-white tracking-wide">
            SIMULATION CONTROLS
          </span>
        </div>
      </div>

      {/* Speed multiplier */}
      <div>
        <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider font-bold mb-1.5">
          TIME ACCELERATION:
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 5, 10].map(s => (
            <button
              key={s}
              onClick={() => {
                setSpeedMult(s);
                api.controlSimulation({ speed_multiplier: s });
              }}
              className={`py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                speedMult === s
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_10px_rgba(14,165,233,0.3)]'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Presets */}
      <div>
        <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider font-bold mb-1.5">
          DEMO SCENARIO:
        </div>
        <div className="flex gap-2">
          <select
            value={scenario}
            onChange={e => setScenario(e.target.value)}
            className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
          >
            <option value="HEALTHY_ISR">HEALTHY ISR</option>
            <option value="INJECTOR_FAILURE">INJECTOR FAILURE</option>
            <option value="THERMAL_RUNAWAY">THERMAL RUNAWAY</option>
            <option value="OIL_STARVATION">OIL STARVATION</option>
            <option value="SENSOR_DRIFT_CASCADE">SENSOR DRIFT CASCADE</option>
          </select>
          <button
            onClick={handleLoadScenario}
            className="glass-button px-3.5 py-2 rounded-xl text-xs font-bold font-mono text-cyan-300 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40"
          >
            ⚡ LOAD SCENARIO
          </button>
        </div>
      </div>

      {/* Fault Injection */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider font-bold">
          FAULT INJECTION:
        </div>
        <select
          value={fault}
          onChange={e => setFault(e.target.value)}
          className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
        >
          <option value="none">NONE</option>
          <option value="injector_clog">INJECTOR CLOG</option>
          <option value="coolant_leak">COOLANT LEAK</option>
          <option value="oil_pressure_loss">OIL PRESSURE LOSS</option>
          <option value="valve_clearance">VALVE CLEARANCE</option>
          <option value="piston_wear">PISTON WEAR</option>
          <option value="turbo_lag">TURBO LAG</option>
        </select>

        {fault !== 'none' && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>SEVERITY:</span>
              <span className="font-bold text-white">{Math.round(severity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={severity}
              onChange={e => setSeverity(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => api.injectFault(fault, severity)}
            disabled={fault === 'none'}
            className="flex-1 glass-button py-2 rounded-xl text-xs font-bold font-mono text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 disabled:opacity-40"
          >
            ⚠ INJECT
          </button>
          <button
            onClick={() => {
              setFault('none');
              api.clearFault();
            }}
            className="flex-1 glass-button py-2 rounded-xl text-xs font-bold font-mono text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10"
          >
            ✕ CLEAR
          </button>
        </div>
      </div>
    </div>
  );
}

// ── What-If Simulator Panel ───────────────────────────────────────────────
function WhatIfPanel() {
  const whatIfResult = useStore(s => s.whatIfResult);
  const setWhatIfResult = useStore(s => s.setWhatIfResult);

  const [throttle, setThrottle] = useState(0.65);
  const [alt, setAlt] = useState(18500);
  const [temp, setTemp] = useState(-8);
  const [remaining, setRemaining] = useState(4.0);

  const handleSimulate = async () => {
    try {
      const res = await api.runWhatIf({
        throttle,
        altitude_ft: alt,
        ambient_temp_c: temp,
        mission_duration_hours: remaining,
      });
      setWhatIfResult(res);
    } catch (e) {
      console.error('What-if error:', e);
    }
  };

  return (
    <div className="glass-panel rounded-[1.5rem] p-5 flex flex-col h-full overflow-y-auto space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="font-display font-bold text-sm text-white tracking-wide">
            WHAT-IF SIMULATOR
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {[
          {
            label: 'THROTTLE',
            value: throttle,
            set: setThrottle,
            min: 0.3,
            max: 1.0,
            step: 0.05,
            format: (v: number) => `${Math.round(v * 100)}%`,
          },
          {
            label: 'ALTITUDE (FT)',
            value: alt,
            set: setAlt,
            min: 2000,
            max: 30000,
            step: 500,
            format: (v: number) => `${Math.round(v).toLocaleString()}`,
          },
          {
            label: 'AMBIENT TEMP (°C)',
            value: temp,
            set: setTemp,
            min: -30,
            max: 50,
            step: 1,
            format: (v: number) => `${v}°C`,
          },
          {
            label: 'MISSION REM. (HR)',
            value: remaining,
            set: setRemaining,
            min: 0.5,
            max: 8,
            step: 0.25,
            format: (v: number) => `${v.toFixed(2)}h`,
          },
        ].map(({ label, value, set, min, max, step, format }) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-slate-400 font-bold">{label}</span>
              <span className="text-white font-bold">{format(value)}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={e => set(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>
        ))}

        <button
          onClick={handleSimulate}
          className="glass-button w-full py-2.5 rounded-xl text-xs font-black tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-white shadow-[0_0_15px_rgba(14,165,233,0.4)]"
        >
          ⚡ RUN WHAT-IF SIMULATION
        </button>

        {whatIfResult && (
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 font-mono text-xs">
            <div className="text-[10px] uppercase text-cyan-300 font-bold tracking-wider pb-1 border-b border-white/10">
              SIMULATION PROJECTION:
            </div>
            {[
              { label: 'PREDICTED HEALTH', value: `${fmt(whatIfResult.predicted_health, 0)}%` },
              { label: 'PREDICTED RUL', value: `${fmt(whatIfResult.predicted_rul_hours)}h` },
              { label: 'RISK LEVEL', value: whatIfResult.predicted_risk },
              {
                label: 'COMPLETION PROB.',
                value: `${fmt((whatIfResult.mission_completion_probability || 0) * 100, 0)}%`,
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs gap-2 min-w-0">
                <span className="text-slate-400 truncate">{label}</span>
                <span className="font-bold text-white truncate flex-shrink-0">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 3D Canvas with overlays ────────────────────────────────────────────────
function SimulationCanvas({ view }: { view: SimView }) {
  const swarmEnabled = useStore(s => s.swarmEnabled);
  const environment = useStore(s => s.mission.environment || 'MOUNTAIN');

  const modelInfo = useMemo(() => {
    switch (environment) {
      case 'DESERT':
        return { name: 'THAR DESERT CANYON', type: 'MULTI-LAYER 3D OBJ + 4K PBR' };
      case 'MARITIME':
        return { name: 'INDIAN OCEAN EEZ', type: 'DYNAMIC PROCEDURAL SWELL' };
      case 'FOREST':
        return { name: 'WESTERN GHATS JUNGLE', type: 'PROCEDURAL CANOPY + FLIR SCAN' };
      case 'MOUNTAIN':
      case 'HIGH_ALTITUDE':
      default:
        return { name: 'LADAKH HIMALAYAS', type: 'MULTI-LAYER 3D OBJ + SATELLITE RELIEF' };
    }
  }, [environment]);

  return (
    <div className="simulation-canvas relative w-full h-full overflow-hidden rounded-2xl bg-black/40 border border-white/10">
      <Suspense
        fallback={
          <div className="h-full flex items-center justify-center font-mono text-cyan-400 text-xs tracking-widest animate-pulse">
            INITIALIZING 3D TACTICAL AIRSPACE...
          </div>
        }
      >
        <UAVScene view={view} />
      </Suspense>

      {/* 3D Model Telemetry Badge */}
      <div className="mesh-badge z-10 pointer-events-none flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/75 border border-cyan-500/30 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
        <span className="text-[10px] font-mono text-cyan-300 font-bold tracking-wider">
          3D MESH: {modelInfo.name}
        </span>
        <span className="text-[9px] font-mono text-slate-400 border-l border-white/15 pl-2">
          {modelInfo.type}
        </span>
      </div>

      {/* Indian NavIC / GPS Tactical Navigation HUD */}
      <GPSTacticalHUD />

      {/* Interactive 3D UAV Flight Joystick with Keyboard Support */}
      {view !== 'swarm' && view !== 'ai' && view !== 'cockpit' && <FlightJoystick />}

      {view === 'cockpit' && <CockpitHUD />}
      {view === 'ai' && <AIFlowOverlay />}
      {view === 'swarm' && swarmEnabled && <SwarmNetPanel />}
    </div>
  );
}

// ── Main Mission Simulator Page ───────────────────────────────────────────
export default function MissionSimulator() {
  const { activeView, splitView, splitViewB } = useStore(s => ({
    activeView: s.activeView,
    splitView: s.splitView,
    splitViewB: s.splitViewB,
  }));

  return (
    <div className="simulator-page w-full h-full flex flex-col overflow-y-auto pb-2">
      {/* Top Floating View & Theatre Selector */}
      <ViewSelector />

      {/* Main Content Grid: 3D Viewport + Side Controls */}
      <div className="simulator-grid px-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* 3D Simulation Canvas (9 Cols) */}
        <div className="lg:col-span-9 flex flex-col gap-2 overflow-hidden">
          <div className="flex-1 min-h-0">
            <SimulationCanvas view={activeView} />
          </div>
          {splitView && (
            <div className="h-64 min-h-0">
              <SimulationCanvas view={splitViewB} />
            </div>
          )}
        </div>

        {/* Right Column: Controls & What-If Panels (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col gap-3 overflow-hidden">
          <div className="flex-[1.15] min-h-0">
            <ControlsPanel />
          </div>
          <div className="flex-[0.85] min-h-0">
            <WhatIfPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
