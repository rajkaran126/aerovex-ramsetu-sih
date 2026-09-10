import React, { useState } from 'react';
import { Sliders, Gauge, Activity, Radio, ArrowUpRight } from 'lucide-react';
import { AEROSPACE_CONTENT } from '../../data/aerospaceContent';

interface SpecsSectionProps {
  onLaunchMission: () => void;
}

export const SpecsSection: React.FC<SpecsSectionProps> = ({ onLaunchMission }) => {
  const [activeCategory, setActiveCategory] = useState(0);

  const currentCategory = AEROSPACE_CONTENT.specifications[activeCategory];

  return (
    <div className="marketing-page specs-page relative w-full min-h-screen pointer-events-auto max-w-7xl mx-auto flex flex-col">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-0.5 bg-sky-400" />
            <span className="text-[10px] sm:text-xs font-mono tracking-[0.25em] text-sky-400 uppercase font-semibold">
              TECHNICAL DOSSIER
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Performance{' '}
            <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
              Specifications
            </span>
          </h2>
        </div>

        {/* Category Switcher Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/10 self-start md:self-auto">
          {AEROSPACE_CONTENT.specifications.map((cat, idx) => (
            <button
              key={idx}
              onClick={() => setActiveCategory(idx)}
              className={`px-4 py-2 rounded-xl text-xs font-medium tracking-wide transition-all ${
                activeCategory === idx
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat.category}
            </button>
          ))}
        </div>
      </div>

      {/* Top 4 Quick Stat Hero Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'OPERATIONAL CEILING', value: '32,000', unit: 'FT', icon: Gauge, desc: 'High-Altitude Himalayan Envelope' },
          { label: 'FLIGHT ENDURANCE', value: '36+', unit: 'HRS', icon: Activity, desc: 'Long Loitering Coastal EEZ Patrol' },
          { label: 'WINGSPAN', value: '20.6', unit: 'M', icon: Sliders, desc: 'Ultra-High Aspect Carbon Wing' },
          { label: 'MAX PAYLOAD', value: '350', unit: 'KG', icon: Radio, desc: 'Multi-Mission Quick-Swap Bay' },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-slate-950/70 backdrop-blur-xl border border-white/10 flex flex-col justify-between hover:border-sky-400/40 transition-colors"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[9px] font-mono tracking-widest uppercase">{stat.label}</span>
                <Icon className="w-4 h-4 text-sky-400" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                  {stat.value}
                </span>
                <span className="text-sm font-mono text-sky-400 font-bold">{stat.unit}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-light mt-1">{stat.desc}</span>
            </div>
          );
        })}
      </div>

      {/* Detailed Specs Grid */}
      <div className="rounded-3xl p-6 sm:p-8 bg-slate-950/80 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
          <h3 className="text-base font-bold text-white tracking-wide uppercase font-mono">
            {currentCategory.category} — Engineering Telemetry
          </h3>
          <span className="text-xs font-mono text-slate-400">
            CONFIDENTIAL / DEFENSE EXPORT APPROVED
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentCategory.items.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-colors flex flex-col justify-between"
            >
              <span className="text-xs text-slate-400 font-light mb-2">{item.label}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-mono font-bold text-white tracking-wide">
                  {item.value}
                </span>
                {item.unit && (
                  <span className="text-xs font-mono text-sky-400 font-semibold">{item.unit}</span>
                )}
              </div>
              {item.note && (
                <span className="text-[10px] text-slate-500 font-mono mt-2 pt-2 border-t border-white/5">
                  // {item.note}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer Link */}
        <div className="pt-6 mt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-slate-400 font-light">
            All telemetry derived from active flight trials and hardware-in-the-loop (HIL) simulations.
          </span>
          <button
            onClick={onLaunchMission}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold text-slate-950 bg-gradient-to-r from-sky-400 to-cyan-300 hover:from-sky-300 hover:to-white transition-all shadow-[0_0_15px_rgba(56,189,248,0.4)]"
          >
            <span>Simulate Flight Physics</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
