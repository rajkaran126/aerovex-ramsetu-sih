import React from 'react';

// ─── Reusable KAPP-BMW Inspired Stat Card ─────────────────────────────────────
export interface StatCardProps {
  label: string;
  value: string | number;
  subvalue?: string;
  icon: React.ReactNode;
  color?: 'blue' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple';
  trend?: { direction: 'up' | 'down' | 'neutral'; text: string };
  className?: string;
}

export function StatCard({
  label,
  value,
  subvalue,
  icon,
  color = 'cyan',
  trend,
  className = '',
}: StatCardProps) {
  const palettes = {
    cyan: {
      from: '#0ea5e9',
      to: '#0284c7',
      glow: 'rgba(14, 165, 233, 0.45)',
      textClass: 'text-cyan-300',
    },
    blue: {
      from: '#3b82f6',
      to: '#1d4ed8',
      glow: 'rgba(59, 130, 246, 0.45)',
      textClass: 'text-blue-300',
    },
    emerald: {
      from: '#10b981',
      to: '#059669',
      glow: 'rgba(16, 185, 129, 0.45)',
      textClass: 'text-emerald-300',
    },
    amber: {
      from: '#f59e0b',
      to: '#d97706',
      glow: 'rgba(245, 158, 11, 0.45)',
      textClass: 'text-amber-300',
    },
    rose: {
      from: '#f43f5e',
      to: '#e11d48',
      glow: 'rgba(244, 63, 94, 0.45)',
      textClass: 'text-rose-300',
    },
    purple: {
      from: '#a855f7',
      to: '#7e22ce',
      glow: 'rgba(168, 85, 247, 0.45)',
      textClass: 'text-purple-300',
    },
  };

  const p = palettes[color] || palettes.cyan;

  return (
    <div
      className={`glass-panel p-4 sm:p-5 rounded-[1.5rem] flex items-center gap-4 transition-all duration-500 hover:-translate-y-1 group cursor-default ${className}`}
    >
      {/* Glowing Icon Badge */}
      <div className="relative flex-shrink-0">
        <div
          className="absolute inset-0 blur-xl opacity-60 rounded-full transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: p.glow }}
        />
        <div
          className="relative p-3 sm:p-3.5 rounded-2xl flex items-center justify-center text-white border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.5)] z-10 group-hover:scale-110 transition-transform duration-500"
          style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
        >
          {icon}
        </div>
      </div>

      {/* Metric Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] truncate">
            {label}
          </p>
          {trend && (
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                trend.direction === 'up'
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : trend.direction === 'down'
                  ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                  : 'text-slate-400 bg-slate-500/10'
              }`}
            >
              {trend.text}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <p
            className="text-white text-2xl sm:text-3xl font-black tracking-tight"
            style={{ textShadow: `0 0 20px ${p.glow}` }}
          >
            {value}
          </p>
          {subvalue && (
            <span className="text-slate-400 text-xs font-mono font-medium">{subvalue}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section Header with Gradient Accent Bar ─────────────────────────────────
export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  kicker?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  kicker,
  badge,
  action,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 ${className}`}>
      <div className="flex items-start gap-4">
        {/* Glowing Gradient Accent Bar */}
        <div className="w-1.5 h-10 rounded-full bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-600 shadow-[0_0_15px_rgba(14,165,233,0.6)] flex-shrink-0 mt-0.5" />
        <div>
          {kicker && (
            <span className="text-[10px] font-mono tracking-[0.25em] text-cyan-400 uppercase font-bold block mb-1">
              {kicker}
            </span>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
              {title}
            </h2>
            {badge}
          </div>
          {subtitle && (
            <p className="text-slate-400 text-xs sm:text-sm mt-1 font-medium tracking-wide">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
}

// ─── High-Tech Glass Badge ───────────────────────────────────────────────────
export interface BadgeProps {
  status: string;
  variant?: 'healthy' | 'warning' | 'critical' | 'info' | 'purple';
  dot?: boolean;
}

export function Badge({ status, variant = 'healthy', dot = true }: BadgeProps) {
  const styles = {
    healthy: {
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.35)',
      color: '#34d399',
      glow: 'rgba(16, 185, 129, 0.25)',
      dotColor: '#10b981',
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.35)',
      color: '#fbbf24',
      glow: 'rgba(245, 158, 11, 0.25)',
      dotColor: '#f59e0b',
    },
    critical: {
      bg: 'rgba(244, 63, 94, 0.12)',
      border: 'rgba(244, 63, 94, 0.35)',
      color: '#fb7185',
      glow: 'rgba(244, 63, 94, 0.25)',
      dotColor: '#f43f5e',
    },
    info: {
      bg: 'rgba(14, 165, 233, 0.12)',
      border: 'rgba(14, 165, 233, 0.35)',
      color: '#38bdf8',
      glow: 'rgba(14, 165, 233, 0.25)',
      dotColor: '#0ea5e9',
    },
    purple: {
      bg: 'rgba(168, 85, 247, 0.12)',
      border: 'rgba(168, 85, 247, 0.35)',
      color: '#c084fc',
      glow: 'rgba(168, 85, 247, 0.25)',
      dotColor: '#a855f7',
    },
  };

  const s = styles[variant];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold tracking-[0.15em] uppercase font-mono shadow-inner whitespace-nowrap"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        boxShadow: `0 0 12px ${s.glow}`,
      }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: s.dotColor }}
        />
      )}
      {status}
    </span>
  );
}
