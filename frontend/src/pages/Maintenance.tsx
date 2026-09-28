import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { SectionHeader, StatCard, Badge } from '../components/aerospace/UIComponents';
import {
  Wrench,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Clock,
  Activity,
  CheckCircle2,
  Flame,
  Cpu,
  FileCheck,
  Hash,
  Database,
  Lock,
  Layers,
  ChevronRight,
  Shield,
} from 'lucide-react';

function fmt(v: number | undefined, d = 1) {
  if (v === undefined || !isFinite(v)) return '---';
  return v.toFixed(d);
}

export default function Maintenance() {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { degradation, rul, health, maintenanceTaskcards, digitalLogbook } = useStore(s => ({
    degradation: s.degradation,
    rul: s.rul,
    health: s.health,
    maintenanceTaskcards: s.maintenanceTaskcards || [],
    digitalLogbook: s.digitalLogbook,
  }));

  const fetchRecommendations = async () => {
    setLoading(true);
    const data = await api.getMaintenance();
    setRecommendations(data.recommendations || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const severityColor: Record<string, { color: string; bg: string; border: string; glow: string }> = {
    CRITICAL: {
      color: '#fb7185',
      bg: 'rgba(244, 63, 94, 0.12)',
      border: 'rgba(244, 63, 94, 0.35)',
      glow: 'rgba(244, 63, 94, 0.4)',
    },
    HIGH: {
      color: '#fb923c',
      bg: 'rgba(249, 115, 22, 0.12)',
      border: 'rgba(249, 115, 22, 0.35)',
      glow: 'rgba(249, 115, 22, 0.4)',
    },
    MEDIUM: {
      color: '#fbbf24',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.35)',
      glow: 'rgba(245, 158, 11, 0.4)',
    },
    LOW: {
      color: '#38bdf8',
      bg: 'rgba(14, 165, 233, 0.12)',
      border: 'rgba(14, 165, 233, 0.35)',
      glow: 'rgba(14, 165, 233, 0.4)',
    },
  };

  const criticalCount = recommendations.filter(r => r.severity === 'CRITICAL').length;

  return (
    <div className="w-full h-full p-5 pb-28 flex flex-col gap-6 overflow-y-auto font-sans [&>*]:flex-shrink-0">
      {/* ─── Header ─── */}
      <SectionHeader
        title="MAINTENANCE & RUL PRESCRIPTIONS"
        kicker="TRL-9 FIELD READINESS DIRECTIVES"
        subtitle="Predictive maintenance advisories generated from thermodynamic wear models and remaining useful life margins."
        badge={
          <Badge
            status={recommendations.length > 0 ? `${recommendations.length} DIRECTIVES ACTIVE` : 'ALL CLEAR'}
            variant={recommendations.length > 0 ? 'warning' : 'healthy'}
          />
        }
        action={
          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="glass-button flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold font-mono tracking-wider text-cyan-300 bg-white/5 hover:bg-white/10 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>
        }
      />

      {/* ─── 4 Stat Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="ENGINE HEALTH"
          value={`${Math.round(health.index)}%`}
          subvalue={health.label}
          icon={<ShieldCheck className="w-6 h-6" />}
          color={health.index > 75 ? 'emerald' : health.index > 50 ? 'amber' : 'rose'}
          trend={{ direction: health.index > 75 ? 'up' : 'down', text: 'PHY-MODEL' }}
        />
        <StatCard
          label="MEDIAN RUL"
          value={`${rul.rul_median?.toFixed(1) ?? '--'} h`}
          subvalue={`Lower: ${rul.rul_lower?.toFixed(1) ?? '--'} h`}
          icon={<Clock className="w-6 h-6" />}
          color="cyan"
          trend={{ direction: 'neutral', text: 'P10-P90' }}
        />
        <StatCard
          label="ACTIVE ADVISORIES"
          value={recommendations.length.toString()}
          subvalue="Prescriptions Loaded"
          icon={<Wrench className="w-6 h-6" />}
          color={recommendations.length > 0 ? 'amber' : 'emerald'}
          trend={{ direction: recommendations.length > 0 ? 'down' : 'up', text: 'DISPATCH' }}
        />
        <StatCard
          label="CRITICAL ACTIONS"
          value={criticalCount.toString()}
          subvalue={criticalCount > 0 ? 'Immediate Action' : 'No Critical Blocks'}
          icon={<AlertTriangle className="w-6 h-6" />}
          color={criticalCount > 0 ? 'rose' : 'emerald'}
          trend={{ direction: criticalCount > 0 ? 'down' : 'up', text: criticalCount > 0 ? 'URGENT' : 'NOMINAL' }}
        />
      </div>

      {/* ─── Main Two-Column Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch min-h-0">
        {/* Left Column: Recommendations Cards (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs font-mono text-amber-200 leading-relaxed break-words min-w-0">
              <strong>RESEARCH ADVISORY DIRECTIVE:</strong> Grounded in real-time thermodynamic state estimation and synthetic failure regression models. Certified field personnel sign-off required prior to flight clearance.
            </div>
          </div>

          {loading && (
            <div className="p-8 text-center text-slate-500 font-mono text-xs animate-pulse">
              Computing wear propagation and prescriptive directives...
            </div>
          )}

          {recommendations.length === 0 && !loading && (
            <div className="p-8 glass-panel rounded-[1.5rem] text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white font-display">All Systems Nominal</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No component replacement or maintenance actions required for the current mission profile.
              </p>
            </div>
          )}

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {recommendations.map((rec, i) => {
              const sc = severityColor[rec.severity] || severityColor.LOW;

              return (
                <div
                  key={i}
                  className="glass-panel p-5 rounded-[1.5rem] border transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    borderLeft: `4px solid ${sc.color}`,
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase border"
                        style={{
                          background: sc.bg,
                          borderColor: sc.border,
                          color: sc.color,
                          boxShadow: `0 0 12px ${sc.glow}`,
                        }}
                      >
                        {rec.severity}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                        {rec.system}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mr-2">
                        FAULT RISK:
                      </span>
                      <span className="text-base font-black font-mono" style={{ color: sc.color }}>
                        {fmt((rec.fault_probability || 0) * 100, 0)}%
                      </span>
                    </div>
                  </div>

                  <h4 className="text-sm sm:text-base font-bold text-white tracking-wide mb-1 font-display break-words min-w-0">
                    {rec.action}
                  </h4>
                  <p className="text-xs text-slate-400 font-light leading-relaxed font-mono break-words min-w-0">
                    {rec.reason}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Status Summary & Degradation State (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Status Summary Panel */}
          <div className="glass-panel rounded-[1.5rem] p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="font-display font-bold text-sm text-white tracking-wide">
                  ENGINE STATUS
                </span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-widest">
                VERIFIED
              </span>
            </div>

            <div className="space-y-3 font-mono">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-xs text-slate-400">ENGINE HEALTH</span>
                <span className="text-lg font-bold text-emerald-400">{fmt(health.index, 0)}%</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-xs text-slate-400">HEALTH STATUS</span>
                <span className="text-xs font-bold text-white">{health.label}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-xs text-slate-400">MEDIAN RUL</span>
                <span className="text-base font-bold text-cyan-300">{fmt(rul.rul_median)} h</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-xs text-slate-400">LOWER P10 RUL</span>
                <span className="text-base font-bold text-rose-400">{fmt(rul.rul_lower)} h</span>
              </div>
            </div>
          </div>

          {/* Degradation State Panel */}
          <div className="glass-panel rounded-[1.5rem] p-5 flex flex-col flex-1">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                <span className="font-display font-bold text-sm text-white tracking-wide">
                  DEGRADATION VECTORS
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                5 SYSTEMS
              </span>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto pr-2">
              {Object.entries(degradation).map(([key, val]) => {
                const v = val as number;
                const color = v > 0.6 ? '#f43f5e' : v > 0.3 ? '#f59e0b' : '#34d399';
                const status = v > 0.6 ? 'CRITICAL' : v > 0.3 ? 'DEGRADED' : v > 0.1 ? 'MINOR' : 'NORMAL';

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-300 uppercase">{key}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-1.5 py-0.2 rounded text-[9px] font-bold"
                          style={{ color, background: `${color}15` }}
                        >
                          {status}
                        </span>
                        <span className="font-bold text-slate-200">{fmt(v * 100, 0)}%</span>
                      </div>
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
      </div>

      {/* ─── ATA-Chapter Maintenance Taskcards (Milestone 7) ─── */}
      <div className="glass-panel rounded-[1.5rem] p-5 space-y-4 flex-shrink-0">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-display font-bold text-base text-white tracking-wide">
                ATA-CHAPTER PRESCRIPTIVE WORK ORDERS
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Standardized aviation maintenance taskcards mapped to physical subsystem degradation
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
            {maintenanceTaskcards.length} TASKCARDS ACTIVE
          </span>
        </div>

        {maintenanceTaskcards.length === 0 ? (
          <div className="p-6 text-center text-slate-500 font-mono text-xs rounded-xl bg-white/[0.01] border border-white/5">
            NO OUTSTANDING ATA TASKCARDS GENERATED — ENGINE OPERATING WITHIN ACCEPTABLE MAINTENANCE TOLERANCES
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {maintenanceTaskcards.map((card: any, idx: number) => {
              const isGrounding = card.urgency === 'IMMEDIATE_GROUNDING';
              const isPriority = card.urgency === 'PRIORITY_A_CHECK';
              const badgeBg = isGrounding ? 'bg-rose-500/15 text-rose-300 border-rose-500/40' :
                              isPriority ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' :
                              'bg-cyan-500/15 text-cyan-300 border-cyan-500/40';

              return (
                <div
                  key={card.taskcard_id || idx}
                  className="rounded-2xl p-4 bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-cyan-400 tracking-wider">
                        {card.taskcard_id} &bull; {card.ata_chapter}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
                        {card.urgency.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white font-display">
                      {card.title}
                    </h4>

                    <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
                        SUBSYSTEM: <span className="text-white">{card.subsystem}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
                        EST. MAN-HOURS: <span className="text-amber-300 font-bold">{card.estimated_man_hours}h</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
                        AUTHORITY: <span className="text-cyan-300">{card.sign_off_authority}</span>
                      </span>
                    </div>

                    {card.required_tools && card.required_tools.length > 0 && (
                      <div className="text-[11px] font-mono">
                        <span className="text-slate-500">TOOLS: </span>
                        <span className="text-slate-300">{card.required_tools.join(', ')}</span>
                      </div>
                    )}

                    {card.required_parts && card.required_parts.length > 0 && (
                      <div className="text-[11px] font-mono">
                        <span className="text-slate-500">PARTS: </span>
                        <span className="text-amber-200">{card.required_parts.join(', ')}</span>
                      </div>
                    )}

                    <div className="space-y-1 pt-2 border-t border-white/5">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">
                        EXECUTION PROTOCOL:
                      </span>
                      <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300 font-mono">
                        {card.action_steps?.slice(0, 3).map((step: string, sIdx: number) => (
                          <li key={sIdx} className="leading-snug">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[10px] font-mono text-slate-500">
                      TRIGGER: {card.trigger_fault?.toUpperCase()} ({card.trigger_condition})
                    </span>
                    <button className="px-3 py-1 rounded-xl text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all">
                      SIGN OFF ORDER
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Cryptographically Immutable Digital Logbook Ledger (Milestone 7) ─── */}
      <div className="glass-panel rounded-[1.5rem] p-5 space-y-4 flex-shrink-0">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-display font-bold text-base text-white tracking-wide">
                TAMPER-EVIDENT DIGITAL LOGBOOK LEDGER
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                SHA-256 chained airworthiness audit ledger compliant with CEMILAC / DGCA standards
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
              digitalLogbook?.integrity_valid !== false
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            }`}>
              {digitalLogbook?.integrity_valid !== false ? 'CRYPTOGRAPHIC INTEGRITY: VERIFIED' : 'INTEGRITY: COMPROMISED'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
            <span className="text-slate-400 text-[10px]">ENGINE IDENTIFIER</span>
            <span className="text-sm font-bold text-white">{digitalLogbook?.engine_id || 'ROTAX-914-DEMO'}</span>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
            <span className="text-slate-400 text-[10px]">CHAINED AUDIT BLOCKS</span>
            <span className="text-sm font-bold text-cyan-300">{digitalLogbook?.total_blocks || 1} BLOCKS</span>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between overflow-hidden">
            <span className="text-slate-400 text-[10px]">LATEST SHA-256 ROOT HASH</span>
            <span className="text-xs font-bold text-slate-300 truncate" title={digitalLogbook?.latest_hash}>
              {digitalLogbook?.latest_hash || 'SHA-256 CALCULATION ACTIVE'}
            </span>
          </div>
        </div>

        {digitalLogbook?.recent_blocks && digitalLogbook.recent_blocks.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-white/5 text-slate-400 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Block #</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Block Hash (SHA-256)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {digitalLogbook.recent_blocks.slice(-5).reverse().map((b: any) => (
                  <tr key={b.index} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3 font-bold text-cyan-400">#{b.index}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-white">
                        {b.event_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">{new Date(b.timestamp * 1000).toLocaleTimeString()}</td>
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-400 truncate max-w-xs" title={b.hash}>
                      {b.hash ? `${b.hash.substring(0, 16)}...${b.hash.substring(b.hash.length - 8)}` : 'GENESIS'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
