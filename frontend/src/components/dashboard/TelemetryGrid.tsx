import React from 'react';
import { useStore } from '../../store/useStore';
import { Activity, AlertTriangle } from 'lucide-react';

// ── Utility: format number safely ────────────────────────────────────────
function fmt(v: number | undefined | null, decimals = 1): string {
  if (v === null || v === undefined || !isFinite(v)) return '---';
  return v.toFixed(decimals);
}

// ── Single telemetry cell ────────────────────────────────────────────────
interface CellProps {
  label: string;
  value: number | undefined;
  unit: string;
  decimals?: number;
  expected?: number;
  warnAbove?: number;
  warnBelow?: number;
  critAbove?: number;
  critBelow?: number;
  sensorKey?: string;
}

function TelemetryCell({
  label,
  value,
  unit,
  decimals = 1,
  expected,
  warnAbove,
  warnBelow,
  critAbove,
  critBelow,
  sensorKey,
}: CellProps) {
  const integrity = useStore(s => s.integrity);
  const sensorStatus = sensorKey ? integrity.sensor_statuses[sensorKey] : undefined;
  const confidence = sensorStatus?.confidence ?? 1.0;
  const usingTwin = sensorStatus?.using_twin_estimate ?? false;
  const displayValue = usingTwin ? (sensorStatus?.twin_estimate ?? value) : value;

  let state: 'nominal' | 'warning' | 'critical' = 'nominal';
  let valueColor = 'text-white';
  let borderColor = 'border-white/10 hover:border-white/20';
  let bgGradient = 'bg-white/[0.02]';
  let textShadow = '0 0 16px rgba(56, 189, 248, 0.2)';

  if (critAbove !== undefined && (displayValue ?? 0) >= critAbove) {
    state = 'critical';
    valueColor = 'text-rose-400';
    borderColor = 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.25)]';
    bgGradient = 'bg-rose-500/[0.06]';
    textShadow = '0 0 16px rgba(244, 63, 94, 0.6)';
  } else if (critBelow !== undefined && (displayValue ?? 99999) <= critBelow) {
    state = 'critical';
    valueColor = 'text-rose-400';
    borderColor = 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.25)]';
    bgGradient = 'bg-rose-500/[0.06]';
    textShadow = '0 0 16px rgba(244, 63, 94, 0.6)';
  } else if (warnAbove !== undefined && (displayValue ?? 0) >= warnAbove) {
    state = 'warning';
    valueColor = 'text-amber-400';
    borderColor = 'border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]';
    bgGradient = 'bg-amber-500/[0.05]';
    textShadow = '0 0 16px rgba(245, 158, 11, 0.5)';
  } else if (warnBelow !== undefined && (displayValue ?? 99999) <= warnBelow) {
    state = 'warning';
    valueColor = 'text-amber-400';
    borderColor = 'border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]';
    bgGradient = 'bg-amber-500/[0.05]';
    textShadow = '0 0 16px rgba(245, 158, 11, 0.5)';
  }

  if (confidence < 0.5 && state === 'nominal') {
    state = 'warning';
    valueColor = 'text-amber-300';
    borderColor = 'border-amber-500/30';
  }

  const residual =
    expected !== undefined && displayValue !== undefined ? displayValue - expected : null;

  return (
    <div
      className={`relative p-3.5 rounded-xl border backdrop-blur-md transition-all duration-300 flex flex-col justify-between group ${bgGradient} ${borderColor}`}
    >
      {/* Top row: Label & Confidence */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 font-mono">
          {label}
        </span>
        {sensorStatus && confidence < 1.0 && (
          <span
            className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
              confidence > 0.7
                ? 'text-slate-400 bg-white/5'
                : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
            }`}
          >
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline gap-1.5 my-1">
        <span
          className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${valueColor}`}
          style={{ textShadow }}
        >
          {fmt(displayValue, decimals)}
        </span>
        <span className="text-[11px] font-mono text-slate-400 font-medium">{unit}</span>
      </div>

      {/* Bottom Metadata: Twin Residual or Twin Estimation */}
      <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-white/5 text-[9px] font-mono gap-1">
        {usingTwin ? (
          <span className="text-amber-400 font-bold flex items-center gap-1 truncate">
            <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
            TWIN EST.
          </span>
        ) : residual !== null ? (
          <span
            className={`truncate ${
              Math.abs(residual) > 20
                ? 'text-amber-400 font-semibold'
                : 'text-slate-500'
            }`}
          >
            Δ {residual > 0 ? '+' : ''}
            {fmt(residual, 1)} {unit}
          </span>
        ) : (
          <span className="text-slate-600 truncate">NOMINAL</span>
        )}

        <span className="text-[9px] text-slate-500 uppercase tracking-wider flex-shrink-0">
          {state === 'critical' ? 'CRIT' : state === 'warning' ? 'WARN' : 'OK'}
        </span>
      </div>
    </div>
  );
}

// ── Full telemetry grid ──────────────────────────────────────────────────
export function TelemetryGrid() {
  const { telemetry } = useStore(s => ({ telemetry: s.telemetry }));
  const a = telemetry.actual;
  const e = telemetry.expected;

  return (
    <div className="glass-panel rounded-[1.5rem] p-5 h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 flex-shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-sm text-white tracking-wide truncate">
              ENGINE TELEMETRY MATRIX
            </h3>
            <p className="text-[10px] font-mono text-slate-400 tracking-wider truncate">
              ACTUAL // TWIN ESTIMATE // RESIDUAL VECTORS
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold tracking-widest flex-shrink-0">
          10 CHANNELS
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 flex-1 overflow-y-auto pr-1">
        <TelemetryCell
          label="RPM"
          value={a.rpm}
          unit="rpm"
          decimals={0}
          expected={e.rpm}
          sensorKey="rpm"
          warnAbove={5400}
          critAbove={5700}
        />
        <TelemetryCell
          label="EGT"
          value={a.egt_c}
          unit="°C"
          expected={e.egt_c}
          sensorKey="egt_c"
          warnAbove={760}
          critAbove={820}
        />
        <TelemetryCell
          label="CHT"
          value={a.cht_c}
          unit="°C"
          expected={e.cht_c}
          sensorKey="cht_c"
          warnAbove={195}
          critAbove={215}
        />
        <TelemetryCell
          label="OIL TEMP"
          value={a.oil_temp_c}
          unit="°C"
          expected={e.oil_temp_c}
          sensorKey="oil_temp_c"
          warnAbove={115}
          critAbove={130}
        />
        <TelemetryCell
          label="OIL PRESS"
          value={a.oil_pressure_bar}
          unit="bar"
          decimals={2}
          expected={e.oil_pressure_bar}
          sensorKey="oil_pressure_bar"
          warnBelow={2.8}
          critBelow={2.2}
        />
        <TelemetryCell
          label="FUEL FLOW"
          value={a.fuel_flow_lph}
          unit="L/hr"
          expected={e.fuel_flow_lph}
          sensorKey="fuel_flow_lph"
        />
        <TelemetryCell
          label="VIBRATION"
          value={a.vibration}
          unit="idx"
          decimals={3}
          expected={e.vibration}
          sensorKey="vibration"
          warnAbove={2.0}
          critAbove={3.0}
        />
        <TelemetryCell
          label="POWER"
          value={a.power_kw}
          unit="kW"
          decimals={1}
          expected={e.power_kw}
        />
        <TelemetryCell
          label="EFFICIENCY"
          value={a.efficiency !== undefined ? a.efficiency * 100 : undefined}
          unit="%"
          decimals={1}
          warnBelow={60}
          critBelow={45}
        />
        <TelemetryCell
          label="THERMAL MRG"
          value={a.thermal_margin}
          unit="°C"
          warnBelow={25}
          critBelow={10}
        />
      </div>
    </div>
  );
}
