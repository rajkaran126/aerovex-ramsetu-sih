import React, { useEffect, useState, lazy, Suspense } from 'react';
import {
  Activity,
  Layers,
  Wrench,
  ShieldAlert,
  Radio,
} from 'lucide-react';
import { initWebSocket, useStore } from './store/useStore';
import { api } from './services/api';
import { LiveSession } from './components/LiveSession';

// Aerospace Components
import { AerospaceNavbar, NavTab } from './components/aerospace/AerospaceNavbar';
import { AerospaceBackground } from './components/aerospace/AerospaceBackground';
import { UAVHeroCenterpiece } from './components/aerospace/UAVHeroCenterpiece';
import { TechSection } from './components/aerospace/TechSection';
import { SpecsSection } from './components/aerospace/SpecsSection';
import { ContactModal } from './components/aerospace/ContactModal';

// Tactical Pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MissionSimulator = lazy(() => import('./pages/MissionSimulator'));
const AIPrognostics = lazy(() => import('./pages/AIPrognostics'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const SystemReadiness = lazy(() => import('./pages/SystemReadiness'));

export type OperationsSubTab = 'dashboard' | 'ai' | 'readiness' | 'maintenance';

const OPERATIONS_TABS: { key: OperationsSubTab; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'LIVE TELEMETRY', icon: Activity },
  { key: 'ai', label: 'AI PROGNOSTICS', icon: Layers },
  { key: 'readiness', label: 'SYSTEM READINESS', icon: ShieldAlert },
  { key: 'maintenance', label: 'MAINTENANCE & RUL', icon: Wrench },
];

function StatusBar() {
  const { connected, step, health, missionRisk, mission } = useStore(s => ({
    connected: s.connected,
    step: s.step,
    health: s.health,
    missionRisk: s.missionRisk,
    mission: s.mission,
  }));

  const riskColor =
    { LOW: '#00ff88', MEDIUM: '#ffaa00', HIGH: '#ff3355' }[missionRisk.risk_level] || '#c8d8e8';

  return (
    <div
      className="status-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 20px',
        background: 'rgba(2, 8, 16, 0.85)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(26, 47, 74, 0.6)',
        fontSize: 10,
        fontFamily: 'monospace',
        color: '#627d98',
        flexShrink: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <span>
          <span style={{ color: connected ? '#00ff88' : '#ff3355', marginRight: 5 }}>●</span>
          {connected ? 'SWARM LINK ACTIVE' : 'TELEMETRY DISCONNECTED'}
        </span>
        <span>STEP: {step}</span>
        <span>
          SYSTEM HEALTH:{' '}
          <span style={{ color: health.index > 80 ? '#00ff88' : '#ffaa00', fontWeight: 700 }}>
            {Math.round(health.index)}%
          </span>
        </span>
        <span className="hidden md:inline">
          PROFILE: {mission.profile} // {mission.environment}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <span>
          RISK: <span style={{ color: riskColor, fontWeight: 700 }}>{missionRisk.risk_level}</span>
        </span>
        <span style={{ color: '#1a2f4a' }}>|</span>
        <span className="hidden sm:inline-flex items-center gap-1.5">
          <img src="/images/vyomamedha-logo.png" alt="VYOMAMEDHA" className="w-3.5 h-3 object-contain" />
          <span>VYOMAMEDHA PROPULSION INTELLIGENCE</span>
        </span>
        <span style={{ color: '#1a2f4a' }}>|</span>
        <span>SIMULATED DATA · RESEARCH DEMO</span>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-transparent">
      <div className="text-center p-8 rounded-3xl bg-slate-950/80 backdrop-blur-2xl border border-sky-400/20 shadow-2xl flex flex-col items-center">
        <img
          src="/images/vyomamedha-logo.png"
          alt="VYOMAMEDHA"
          className="w-16 h-14 object-contain drop-shadow-[0_0_20px_rgba(56,189,248,0.7)] mb-3 animate-pulse"
        />
        <div className="text-xl font-mono font-bold text-white tracking-[0.25em] mb-1">
          VYOMAMEDHA
        </div>
        <div className="text-[10px] font-mono text-cyan-400 tracking-widest uppercase mb-3">
          Predict. Understand. Protect.
        </div>
        <div className="text-xs font-mono text-sky-300/80 tracking-wider">
          LOADING TACTICAL SYSTEMS...
        </div>
        <div className="mt-4 w-48 h-1 bg-slate-900 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-gradient-to-r from-sky-400 to-cyan-300 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [opsTab, setOpsTab] = useState<OperationsSubTab>('dashboard');
  const [isContactOpen, setIsContactOpen] = useState(false);

  useEffect(() => {
    const unsub = initWebSocket();
    return unsub;
  }, []);

  const isHome = activeTab === 'home';

  return (
    <div className="app-shell relative w-full h-full flex flex-col bg-transparent text-slate-200 overflow-hidden font-sans">
      {/* ─── Persistent Background Layer (1st Image: Sharp on Home, Blurred on other pages) ─── */}
      <AerospaceBackground isHome={isHome} />

      {/* ─── Floating Top Pill Navbar (Matching Reference Image 2) ─── */}
      <AerospaceNavbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onLaunchMission={() => setActiveTab('simulator')}
        onOpenContact={() => setIsContactOpen(true)}
      />

      {/* ─── Contact Modal ─── */}
      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />

      {/* ─── Main Viewport Area ─── */}
      <main className="flex-1 overflow-hidden relative z-10 flex flex-col">
        <Suspense fallback={<LoadingScreen />}>
          {/* HOME PAGE: Crisp UAV Background + Hero Centerpiece (Image 2) */}
          {activeTab === 'home' && (
            <div className="home-scroll relative w-full h-full overflow-y-auto flex flex-col">
              <UAVHeroCenterpiece
                onStartMission={() => setActiveTab('simulator')}
                onExploreTech={() => setActiveTab('technology')}
              />
            </div>
          )}

          {/* TECHNOLOGY PAGE */}
          {activeTab === 'technology' && (
            <div className="relative w-full h-full overflow-y-auto overflow-x-hidden pt-16">
              <TechSection onLaunchMission={() => setActiveTab('simulator')} />
            </div>
          )}

          {/* SPECIFICATIONS PAGE */}
          {activeTab === 'specifications' && (
            <div className="relative w-full h-full overflow-y-auto overflow-x-hidden pt-16">
              <SpecsSection onLaunchMission={() => setActiveTab('simulator')} />
            </div>
          )}

          {/* 3D MISSION SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="simulator-shell relative w-full h-full pt-20 flex flex-col">
              <LiveSession />
              <MissionSimulator />
            </div>
          )}

          {/* OPERATIONS DIGITAL TWIN (Telemetry, AI Prognostics, Readiness, Maintenance) */}
          {activeTab === 'operations' && (
            <div className="operations-shell relative w-full h-full pt-20 flex flex-col overflow-hidden">
              {/* Secondary Operations Sub-Navigation Bar */}
              <div className="flex items-center justify-between px-6 py-2 bg-[#06101c]/80 backdrop-blur-xl border-b border-[#1a2f4a]/80 flex-shrink-0 z-20">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono tracking-widest text-sky-400 uppercase font-semibold mr-2">
                    DIGITAL TWIN OPS:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {OPERATIONS_TABS.map(sub => {
                      const Icon = sub.icon;
                      const isSubActive = opsTab === sub.key;
                      return (
                        <button
                          key={sub.key}
                          onClick={() => setOpsTab(sub.key)}
                          className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-mono tracking-wider transition-all ${
                            isSubActive
                              ? 'bg-sky-500/20 text-white border border-sky-400/50 shadow-[0_0_12px_rgba(56,189,248,0.25)] font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${isSubActive ? 'text-sky-400' : 'text-slate-400'}`} />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>SHARED SIMULATION · 1 Hz</span>
                </div>
              </div>

              <LiveSession />
              {/* Active Operations View */}
              <div className="flex-1 overflow-hidden relative">
                {opsTab === 'dashboard' && <Dashboard />}
                {opsTab === 'ai' && <AIPrognostics />}
                {opsTab === 'readiness' && <SystemReadiness />}
                {opsTab === 'maintenance' && <Maintenance />}
              </div>
            </div>
          )}
        </Suspense>
      </main>

      {/* ─── Bottom Status Bar (Active only during tactical operations) ─── */}
      {(activeTab === 'operations' || activeTab === 'simulator') && <StatusBar />}
    </div>
  );
}
