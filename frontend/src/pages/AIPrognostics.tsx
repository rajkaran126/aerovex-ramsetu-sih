import React from 'react';
import { useStore } from '../store/useStore';
import { SectionHeader, StatCard, Badge } from '../components/aerospace/UIComponents';
import {
  BrainCircuit,
  TrendingUp,
  Cpu,
  Clock,
  Sparkles,
  AlertTriangle,
  Flame,
  Activity,
} from 'lucide-react';

function fmt(v: number | undefined, d = 1) {
  if (v === undefined || !isFinite(v)) return '---';
  return v.toFixed(d);
}

// ── SHAP Panel ────────────────────────────────────────────────────────────
function SHAPPanel() {
  const shap = useStore(s => s.faults.shap);
  if (!shap || !shap.shap_values?.length) {
    return (
      <div className="glass-panel rounded-[1.5rem] p-5 h-full flex flex-col justify-between">
        <div className="flex items-center gap-2 pb-3 border-b border-white/10">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-sm text-white tracking-wide">
            SHAP EXPLAINABILITY
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6">
          <div className="w-full max-w-[180px] space-y-3">
            {[70, 50, 35, 20, 12].map((w, i) => (
              <div key={i} className="space-y-1">
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full animate-pulse"
                    style={{ width: `${w}%`, background: 'rgba(56,189,248,0.3)', animationDelay: `${i * 0.15}s` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <span className="text-slate-500 font-mono text-[10px] tracking-wider">
            AWAITING FEATURE ATTRIBUTIONS
          </span>
        </div>
      </div>
    );
  }

  const faultColors: Record<string, string> = {
    healthy: '#10b981',
    injector: '#f59e0b',
    cooling: '#f97316',
    lubrication: '#f43f5e',
    combustion: '#ec4899',
    mechanical: '#a855f7',
    sensor: '#0ea5e9',
  };
  const fc = faultColors[shap.predicted_fault || 'healthy'] || '#38bdf8';

  return (
    <div className="glass-panel rounded-[1.5rem] p-6 h-full flex flex-col">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <h3 className="font-display font-bold text-sm text-white tracking-wide">
            SHAP EXPLAINABILITY
          </h3>
        </div>
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
          {shap.explanation_method?.substring(0, 20)}
        </span>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
        {/* Predicted Fault Highlight */}
        <div
          className="p-4 rounded-2xl border space-y-1"
          style={{
            background: `${fc}12`,
            borderColor: `${fc}44`,
            boxShadow: `0 0 20px ${fc}20`,
          }}
        >
          <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">
            PRIMARY CONTRIBUTING FAULT:
          </div>
          <div className="text-base font-black font-mono tracking-wide" style={{ color: fc }}>
            {shap.predicted_fault?.toUpperCase()} — {fmt((shap.confidence || 0) * 100, 0)}%
          </div>
        </div>

        {/* Feature Bars */}
        <div className="space-y-3">
          <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider font-bold">
            TOP DRIVING THERMODYNAMIC CHANNELS:
          </div>
          {shap.shap_values?.slice(0, 7).map((sv, i) => {
            const isPositive = sv.direction === 'positive';
            const barColor = isPositive ? '#f43f5e' : '#38bdf8';
            const maxAbs = Math.max(...(shap.shap_values?.map(s => s.abs_shap) || [1]));
            const width = (sv.abs_shap / maxAbs) * 100;

            return (
              <div key={i} className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-300">{sv.display_name}</span>
                  <span className="font-bold" style={{ color: barColor }}>
                    {isPositive ? '+' : ''}
                    {sv.shap_value.toFixed(3)}
                  </span>
                </div>
                <div className="relative h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full rounded-full transition-all duration-500"
                    style={{
                      left: sv.direction === 'negative' ? `${50 - width / 2}%` : '50%',
                      width: `${width / 2}%`,
                      background: barColor,
                      boxShadow: `0 0 6px ${barColor}66`,
                    }}
                  />
                  <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white/20" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[9px] font-mono text-slate-500">
          ⚠ {shap.disclaimer}
        </div>
      </div>
    </div>
  );
}

// ── Degradation Trend Panel ──────────────────────────────────────────────
function DegradationTrend() {
  const { degradation, healthHistory } = useStore(s => ({
    degradation: s.degradation,
    healthHistory: s.healthHistory,
  }));
  const last50 = healthHistory.slice(-50);
  const maxH = 100;

  return (
    <div className="glass-panel rounded-[1.5rem] p-6 h-full flex flex-col">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h3 className="font-display font-bold text-sm text-white tracking-wide">
            HEALTH HISTORICAL TREND
          </h3>
        </div>
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
          LAST 50 STEPS
        </span>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
        {/* Sparkline curve */}
        {last50.length > 1 && (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
            <svg width="100%" height={70} className="overflow-visible">
              <defs>
                <linearGradient id="grad-trend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polyline
                points={last50
                  .map((v, i) => `${(i / (last50.length - 1)) * 100}%,${70 - (v / maxH) * 65}`)
                  .join(' ')}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={2}
                style={{ filter: 'drop-shadow(0 0 8px rgba(56,189,248,0.8))' }}
              />
            </svg>
          </div>
        )}

        {/* Degradation Breakdown */}
        <div className="space-y-2.5">
          <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider font-bold">
            PHYSICAL DAMAGE VECTORS:
          </div>
          {Object.entries(degradation).map(([key, val]) => {
            const v = val as number;
            const color = v > 0.6 ? '#f43f5e' : v > 0.3 ? '#f59e0b' : '#34d399';

            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-300 uppercase">{key}</span>
                  <span className="font-bold" style={{ color }}>
                    {fmt(v * 100, 0)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${v * 100}%`, background: color }}
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

// ── AI Prognostics Page ───────────────────────────────────────────────────
export default function AIPrognostics() {
  const { anomaly, faults, rul } = useStore(s => ({
    anomaly: s.anomaly,
    faults: s.faults,
    rul: s.rul,
  }));

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
    <div className="w-full h-full p-6 flex flex-col gap-6 overflow-y-auto font-sans">
      {/* ─── Top Header ─── */}
      <SectionHeader
        title="AI PROGNOSTICS & FAULT ATTRIBUTION"
        kicker="PREDICTIVE INTELLIGENCE SUITE"
        subtitle="Uncertainty-quantified Remaining Useful Life regression, 7-class fault classifier, and SHAP explainability."
        badge={
          <Badge
            status={anomaly.is_anomaly ? 'ANOMALY ALERT' : 'SYSTEM NOMINAL'}
            variant={anomaly.is_anomaly ? 'warning' : 'healthy'}
          />
        }
      />

      {/* ─── 4 Stat Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="ANOMALY CLASSIFICATION"
          value={anomaly.is_anomaly ? 'ACTIVE' : 'NOMINAL'}
          subvalue={`Score: ${fmt((anomaly.anomaly_score ?? 0) * 100, 0)}%`}
          icon={<AlertTriangle className="w-6 h-6" />}
          color={anomaly.is_anomaly ? 'amber' : 'emerald'}
          trend={{ direction: anomaly.is_anomaly ? 'down' : 'up', text: anomaly.is_anomaly ? 'FLAGGED' : 'CLEAN' }}
        />
        <StatCard
          label="TOP FAULT CLASSIFIER"
          value={faults.top_fault?.toUpperCase() || 'HEALTHY'}
          subvalue={`Confidence: ${fmt((faults.top_fault_probability ?? 0) * 100, 0)}%`}
          icon={<Cpu className="w-6 h-6" />}
          color={faults.top_fault === 'healthy' ? 'emerald' : 'rose'}
          trend={{ direction: faults.top_fault === 'healthy' ? 'up' : 'down', text: 'RF 100 TREES' }}
        />
        <StatCard
          label="MEDIAN RUL PREDICTION"
          value={`${rul.rul_median?.toFixed(1) ?? '--'} h`}
          subvalue={`P10 Lower: ${rul.rul_lower?.toFixed(1) ?? '--'} h`}
          icon={<Clock className="w-6 h-6" />}
          color="cyan"
          trend={{ direction: 'neutral', text: 'QUANTILE' }}
        />
        <StatCard
          label="UNCERTAINTY CONFIDENCE"
          value={`${Math.round((rul.rul_confidence ?? 0.88) * 100)}%`}
          subvalue="Synthetic Physics Trained"
          icon={<Sparkles className="w-6 h-6" />}
          color="purple"
          trend={{ direction: 'up', text: 'HIGH FIDELITY' }}
        />
      </div>

      {/* ─── 3-Column Glass Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch min-h-0">
        {/* Column 1: Fault Classifier Probabilities (4 Cols) */}
        <div className="lg:col-span-4 glass-panel rounded-[1.5rem] p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-sm text-white tracking-wide">
                FAULT CLASS PROBABILITIES
              </h3>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-widest">
              RANDOM FOREST
            </span>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {Object.entries(faults.probabilities || {})
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([fault, prob]) => {
                const p = prob as number;
                const color = faultColors[fault] || '#64748b';
                const isTop = fault === faults.top_fault && fault !== 'healthy';

                return (
                  <div key={fault} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className={`tracking-wide ${isTop ? 'text-white font-bold' : 'text-slate-400'}`}>
                        {isTop && '▶ '}
                        {fault.toUpperCase()}
                      </span>
                      <span className="font-bold text-sm" style={{ color }}>
                        {fmt(p * 100, 1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${p * 100}%`,
                          background: color,
                          boxShadow: isTop ? `0 0 10px ${color}88` : 'none',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Column 2: RUL Quantiles + Trend (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* RUL Quantiles Box */}
          <div className="glass-panel rounded-[1.5rem] p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="font-display font-bold text-sm text-white tracking-wide">
                  RUL QUANTILES
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                HOURS REMAINING
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'P10 (LOWER)', value: rul.rul_lower, color: '#f43f5e' },
                { label: 'MEDIAN', value: rul.rul_median, color: '#38bdf8' },
                { label: 'P90 (UPPER)', value: rul.rul_upper, color: '#34d399' },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center"
                >
                  <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">
                    {label}
                  </div>
                  <div className="text-xl font-black font-mono mt-1" style={{ color }}>
                    {fmt(value)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">hours</div>
                </div>
              ))}
            </div>
          </div>

          {/* Degradation Trend */}
          <div className="flex-1 min-h-0">
            <DegradationTrend />
          </div>
        </div>

        {/* Column 3: SHAP Feature Attribution (3 Cols) */}
        <div className="lg:col-span-3">
          <SHAPPanel />
        </div>
      </div>
    </div>
  );
}
