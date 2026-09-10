import React from 'react';
import { Plane, Shield, Radio, Terminal } from 'lucide-react';
import { AEROSPACE_CONTENT } from '../../data/aerospaceContent';
import { NavTab } from './AerospaceNavbar';

interface AerospaceFooterProps {
  onSelectTab: (tab: NavTab) => void;
  onLaunchMission: () => void;
}

export const AerospaceFooter: React.FC<AerospaceFooterProps> = ({
  onSelectTab,
  onLaunchMission,
}) => {
  return (
    <footer className="relative z-20 w-full bg-slate-950/90 backdrop-blur-2xl border-t border-white/10 text-slate-400 py-10 px-6 sm:px-12 lg:px-16 pointer-events-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400">
            <Plane className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-[0.25em] text-white">
              {AEROSPACE_CONTENT.brand.name}
            </span>
            <span className="text-[9px] font-mono tracking-[0.15em] text-slate-500">
              {AEROSPACE_CONTENT.brand.tagline} // {AEROSPACE_CONTENT.brand.subtagline}
            </span>
          </div>
        </div>

        {/* Quick Nav Links */}
        <div className="flex flex-wrap items-center gap-6 text-xs font-medium tracking-wider text-slate-400">
          <button onClick={() => onSelectTab('home')} className="hover:text-white transition-colors">
            Home
          </button>
          <button onClick={() => onSelectTab('technology')} className="hover:text-white transition-colors">
            Technology
          </button>
          <button onClick={() => onSelectTab('specifications')} className="hover:text-white transition-colors">
            Specifications
          </button>
          <button onClick={() => onSelectTab('gallery')} className="hover:text-white transition-colors">
            Theatres
          </button>
          <button onClick={onLaunchMission} className="text-sky-400 hover:text-sky-300 transition-colors font-semibold">
            3D Simulator
          </button>
          <button onClick={() => onSelectTab('contact')} className="hover:text-white transition-colors">
            Inquiry
          </button>
        </div>

        {/* System Status Indicators */}
        <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>SWARM MESH LIVE</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <Shield className="w-3 h-3 text-sky-400" />
            <span>TRL-9 VERIFIED</span>
          </div>
        </div>
      </div>

      {/* Copyright Note */}
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
        <span>© {new Date().getFullYear()} {AEROSPACE_CONTENT.brand.name} DEFENSE AEROSPACE SYSTEMS. ALL RIGHTS RESERVED.</span>
        <span>HIGH-ALTITUDE LONG-ENDURANCE TACTICAL PLATFORM</span>
      </div>
    </footer>
  );
};
