import React from 'react';
import { useStore } from '../../store/useStore';
import { Shield, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

// ── Health Gauge ──────────────────────────────────────────────────────────
export function HealthGauge() {
  const { health } = useStore(s => ({ health: s.health }));
  const h = health.index;

  const getColor = () => {
    if (h >= 80) return '#10b981';
    if (h >= 60) return '#f59e0b';
    if (h >= 40) return '#f97316';
    if (h >= 20) return '#ef4444';
    return '#dc2626';
  };

  const color = getColor();

  // SVG Arc path
  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (cx: number, cy: number, r: number, start: number, end: number) => {
    const s = polarToCartesian(cx, cy, r, start);
    const e = polarToCartesian(cx, cy, r, end);
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const startAngle = -45 + 90; // 45° from bottom-left
  const endAngle = startAngle + 270;
  const fillEnd = startAngle + (Math.max(0, Math.min(100, h)) / 100) * 270;

  return (
    <div className="glass-panel rounded-[1.5rem] p-5 text-center flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="font-display font-bold text-xs text-white tracking-wider">
            HEALTH INDEX
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
          PHYSICS + AI
        </span>
      </div>

      {/* SVG Arc Gauge */}
      <div className="relative inline-block my-1 mx-auto">
        <svg width={150} height={120} viewBox="0 0 150 120">
          {/* Background arc */}
          <path
            d={describeArc(75, 85, 58, startAngle, endAngle)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
          />
          {/* Fill arc */}
          <path
            d={describeArc(75, 85, 58, startAngle, fillEnd)}
            stroke={color}
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 10px ${color}99)`,
              transition: 'all 0.6s ease',
            }}
          />
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map(tick => {
            const angle = startAngle + (tick / 100) * 270;
            const inner = polarToCartesian(75, 85, 47, angle);
            const outer = polarToCartesian(75, 85, 56, angle);
            return (
              <line
                key={tick}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={2}
              />
            );
          })}
        </svg>

        {/* Center value */}
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div
            className="text-3xl font-black font-mono tracking-tight"
            style={{ color, textShadow: `0 0 20px ${color}66` }}
          >
            {Math.round(h)}%
          </div>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-semibold">
            {health.label}
          </div>
        </div>
      </div>

      {/* Breakdown Metrics */}
      <div className="mt-2 space-y-2 text-left pt-2 border-t border-white/5">
        {Object.entries(health.breakdown || {}).map(([key, val]) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-400 font-medium">
                {key.replace(/_/g, ' ').toUpperCase().replace(' HEALTH', '').replace(' PENALTY', ' PEN.')}
              </span>
              <span className="text-slate-200 font-bold">
                {typeof val === 'number'
                  ? key.includes('penalty')
                    ? `-${val.toFixed(1)}`
                    : `${val.toFixed(0)}%`
                  : ''}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, Math.abs(val as number))}%`,
                  background: key.includes('penalty')
                    ? '#f43f5e'
                    : (val as number) > 70
                    ? '#10b981'
                    : (val as number) > 40
                    ? '#f59e0b'
                    : '#f43f5e',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RUL Panel ────────────────────────────────────────────────────────────
export function RULPanel() {
  const { rul } = useStore(s => ({ rul: s.rul }));
  const remaining = useStore(s => s.mission.remaining_hours);

  const margin = (rul.rul_lower ?? 0) - remaining;
  const isSufficient = margin >= 0;
  const color = isSufficient ? '#10b981' : '#f43f5e';

  return (
    <div className="glass-panel rounded-[1.5rem] p-5">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <span className="font-display font-bold text-xs text-white tracking-wider">
            REMAINING USEFUL LIFE
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-400 tracking-widest">
          QUANTILE REGRESSION
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
          <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
            MEDIAN RUL
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300 mt-0.5">
            {rul.rul_median?.toFixed(1) ?? '--'}
            <span className="text-xs font-normal text-slate-400 ml-1">hrs</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
          <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
            LOWER P10
          </div>
          <div
            className="text-2xl font-black font-mono mt-0.5"
            style={{ color, textShadow: `0 0 15px ${color}66` }}
          >
            {rul.rul_lower?.toFixed(1) ?? '--'}
            <span className="text-xs font-normal text-slate-400 ml-1">hrs</span>
          </div>
        </div>
      </div>

      <div
        className="p-2.5 rounded-xl border flex items-center justify-between font-mono text-[10px] mb-2 gap-2"
        style={{
          background: isSufficient ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
          borderColor: isSufficient ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)',
        }}
      >
        <span className="text-slate-300 whitespace-nowrap">RUL MISSION MARGIN:</span>
        <span className="font-bold font-mono text-right" style={{ color }}>
          {margin >= 0 ? '+' : ''}
          {margin.toFixed(2)}h // {isSufficient ? 'SUFFICIENT' : 'ABORT'}
        </span>
      </div>

      <div className="text-[9px] font-mono text-slate-500 text-center">
        CONFIDENCE: {Math.round((rul.rul_confidence ?? 0) * 100)}% // ZERO-INTRUSION MODEL
      </div>
    </div>
  );
}

// ── Mission Risk Panel ────────────────────────────────────────────────────
export function MissionRiskPanel() {
  const { missionRisk, replanning } = useStore(s => ({
    missionRisk: s.missionRisk,
    replanning: s.replanning,
  }));

  const colors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    LOW: {
      bg: 'rgba(16, 185, 129, 0.1)',
      text: '#34d399',
      border: 'rgba(16, 185, 129, 0.35)',
      glow: 'rgba(16, 185, 129, 0.3)',
    },
    MEDIUM: {
      bg: 'rgba(245, 158, 11, 0.1)',
      text: '#fbbf24',
      border: 'rgba(245, 158, 11, 0.35)',
      glow: 'rgba(245, 158, 11, 0.3)',
    },
    HIGH: {
      bg: 'rgba(244, 63, 94, 0.1)',
      text: '#fb7185',
      border: 'rgba(244, 63, 94, 0.35)',
      glow: 'rgba(244, 63, 94, 0.4)',
    },
  };

  const currentTheme = colors[missionRisk.risk_level] || colors.LOW;

  return (
    <div className="glass-panel rounded-[1.5rem] p-5">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <span className="font-display font-bold text-xs text-white tracking-wider">
            MISSION PARETO RISK
          </span>
        </div>
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase border"
          style={{
            background: currentTheme.bg,
            borderColor: currentTheme.border,
            color: currentTheme.text,
            boxShadow: `0 0 12px ${currentTheme.glow}`,
          }}
        >
          {missionRisk.risk_level}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center border font-mono font-black text-lg flex-shrink-0"
          style={{
            background: currentTheme.bg,
            borderColor: currentTheme.border,
            color: currentTheme.text,
            boxShadow: `0 0 15px ${currentTheme.glow}`,
          }}
        >
          {Math.round((missionRisk.mission_completion_probability ?? 0) * 100)}%
        </div>
        <div className="min-w-0">
          <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider truncate">
            COMPLETION PROBABILITY
          </div>
          <div className="text-[10px] font-semibold text-slate-200 mt-0.5 truncate">
            DYNAMIC PARETO FRONTIER
          </div>
        </div>
      </div>

      {/* Recommended Action Card */}
      <div
        className="p-3 rounded-xl border space-y-1"
        style={{ background: currentTheme.bg, borderColor: currentTheme.border }}
      >
        <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">
          TACTICAL DIRECTIVE:
        </div>
        <div className="text-xs font-bold font-mono" style={{ color: currentTheme.text }}>
          {missionRisk.recommended_action || 'CONTINUE MISSION PROFILE'}
        </div>
      </div>

      {replanning?.triggered && (
        <div className="mt-2 text-[10px] font-mono text-sky-400 flex items-center gap-1.5 p-2 rounded-lg bg-sky-500/10 border border-sky-400/20">
          <CheckCircle2 className="w-3 h-3 text-sky-400" />
          <span>GHOST UAV AUTONOMOUS REPLAN ACTIVE</span>
        </div>
      )}
    </div>
  );
}
