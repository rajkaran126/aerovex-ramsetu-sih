import React from 'react';
import { Mountain, Waves, Sun, Trees, ArrowRight, Compass } from 'lucide-react';
import { AEROSPACE_CONTENT } from '../../data/aerospaceContent';

interface GallerySectionProps {
  onLaunchTheatre?: (theatreId: string) => void;
  onLaunchMission?: () => void;
}

export const GallerySection: React.FC<GallerySectionProps> = ({ onLaunchTheatre, onLaunchMission }) => {
  const getTheatreIcon = (id: string) => {
    switch (id) {
      case 'mountain':
        return <Mountain className="w-5 h-5 text-sky-400" />;
      case 'maritime':
        return <Waves className="w-5 h-5 text-cyan-400" />;
      case 'desert':
        return <Sun className="w-5 h-5 text-amber-400" />;
      case 'jungle':
      default:
        return <Trees className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="marketing-page gallery-page relative w-full min-h-screen pointer-events-auto max-w-7xl mx-auto flex flex-col">
      {/* Section Header */}
      <div className="space-y-2 mb-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-0.5 bg-sky-400" />
          <span className="text-[10px] sm:text-xs font-mono tracking-[0.25em] text-sky-400 uppercase font-semibold">
            THEATRES OF OPERATION
          </span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Deployment{' '}
          <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
            Environments
          </span>
        </h2>
        <p className="text-sm text-slate-300 max-w-2xl font-light">
          From glaciated peaks at 28,000+ ft to deep ocean EEZ corridors, explore the MALE UAV’s
          proven endurance across extreme geographical domains.
        </p>
      </div>

      {/* 4 Theatre Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {AEROSPACE_CONTENT.theatres.map(th => (
          <div
            key={th.id}
            className="group relative rounded-3xl p-7 bg-slate-950/75 backdrop-blur-2xl border border-white/10 hover:border-sky-400/50 transition-all duration-300 shadow-2xl flex flex-col justify-between overflow-hidden"
          >
            {/* Top Row: Theatre Tag & Altitude Badge */}
            <div className="flex items-center justify-between mb-4 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover:border-sky-400/40 transition-colors">
                  {getTheatreIcon(th.id)}
                </div>
                <div>
                  <span className="text-[9px] font-mono tracking-widest text-sky-400 uppercase block">
                    {th.theatre}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-medium">
                    // {th.tag}
                  </span>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 font-mono text-[10px] font-bold">
                {th.altitude}
              </span>
            </div>

            {/* Description */}
            <div className="my-3 z-10">
              <h3 className="text-xl font-bold text-white tracking-wide group-hover:text-sky-300 transition-colors">
                {th.title}
              </h3>
              <p className="text-xs text-slate-300 font-light mt-2 leading-relaxed">
                {th.description}
              </p>
            </div>

            {/* Action Bar */}
            <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between z-10">
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                <span>3D SIMULATION READY</span>
              </span>

              <button
                onClick={() => (onLaunchTheatre ? onLaunchTheatre(th.id) : onLaunchMission?.())}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wider text-slate-950 bg-gradient-to-r from-sky-400 to-cyan-300 hover:from-sky-300 hover:to-white transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.6)]"
              >
                <span>Enter Theatre</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Ambient Background Gradient Sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>
        ))}
      </div>
    </div>
  );
};
