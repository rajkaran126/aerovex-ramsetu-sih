import React, { useState } from 'react';
import { Cpu, Shield, Share2, Layers, CheckCircle2, ChevronRight } from 'lucide-react';
import { AEROSPACE_CONTENT, TechFeature } from '../../data/aerospaceContent';

interface TechSectionProps {
  onLaunchMission: () => void;
}

export const TechSection: React.FC<TechSectionProps> = ({ onLaunchMission }) => {
  const [selectedTech, setSelectedTech] = useState<TechFeature>(AEROSPACE_CONTENT.technologies[0]);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Cpu':
        return <Cpu className="w-5 h-5 text-sky-400" />;
      case 'Shield':
        return <Shield className="w-5 h-5 text-sky-400" />;
      case 'Share2':
        return <Share2 className="w-5 h-5 text-sky-400" />;
      case 'Layers':
      default:
        return <Layers className="w-5 h-5 text-sky-400" />;
    }
  };

  return (
    <div className="marketing-page tech-page relative w-full min-h-screen pointer-events-auto max-w-7xl mx-auto flex flex-col">
      {/* Section Header */}
      <div className="space-y-2 mb-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-0.5 bg-sky-400" />
          <span className="text-[10px] sm:text-xs font-mono tracking-[0.25em] text-sky-400 uppercase font-semibold">
            AVIONICS & AUTONOMY
          </span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Aerospace Grade{' '}
          <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
            Technology Stack
          </span>
        </h2>
        <p className="text-sm text-slate-300 max-w-2xl font-light">
          Engineered for mission survivability, beyond-line-of-sight command, and autonomous precision
          across contested environments.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Column: Tech Navigation Cards */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {AEROSPACE_CONTENT.technologies.map(tech => {
            const isSelected = selectedTech.id === tech.id;
            return (
              <button
                key={tech.id}
                onClick={() => setSelectedTech(tech)}
                className={`text-left p-5 rounded-2xl transition-all duration-300 border flex items-start gap-4 ${
                  isSelected
                    ? 'bg-slate-900/85 backdrop-blur-xl border-sky-400/50 shadow-[0_8px_25px_rgba(56,189,248,0.2)]'
                    : 'bg-slate-950/40 backdrop-blur-md border-white/5 hover:border-white/15 hover:bg-slate-900/40'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'bg-sky-500/20 border border-sky-400/40' : 'bg-white/5'
                  }`}
                >
                  {getIcon(tech.icon)}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white tracking-wide">
                    {tech.title}
                  </h4>
                  <p className="text-xs text-slate-400 font-light mt-1 line-clamp-2">
                    {tech.summary}
                  </p>
                </div>
                <ChevronRight
                  className={`w-4 h-4 mt-1 transition-transform ${
                    isSelected ? 'text-sky-400 translate-x-1' : 'text-slate-600'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right Column: Deep-Dive Preview Window */}
        <div className="lg:col-span-7 rounded-3xl p-8 bg-slate-950/75 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/30">
                  {getIcon(selectedTech.icon)}
                </div>
                <div>
                  <span className="text-[9px] font-mono tracking-widest text-sky-400 uppercase">
                    SUBSYSTEM SPECIFICATION
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-wide">
                    {selectedTech.title}
                  </h3>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-medium tracking-widest">
                VERIFIED TRL-9
              </span>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed font-light">
              {selectedTech.description}
            </p>

            {/* Key Capabilities Bullet Points */}
            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Operational Capabilities
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedTech.highlights.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300 font-light">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-8 mt-6 border-t border-white/10 flex items-center justify-between">
            <div className="text-[11px] font-mono text-slate-400">
              INTER-OPERABLE WITH ALL 4 THEATRES
            </div>
            <button
              onClick={onLaunchMission}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold tracking-wider text-slate-950 bg-gradient-to-r from-sky-400 to-cyan-300 hover:from-sky-300 hover:to-white transition-all shadow-[0_0_20px_rgba(56,189,248,0.4)]"
            >
              <span>Test in 3D Simulator</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
