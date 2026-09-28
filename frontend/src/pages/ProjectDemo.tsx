import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  Cpu,
  Layers,
  Activity,
  Wrench,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { SectionHeader, Badge } from '../components/aerospace/UIComponents';

interface ProjectDemoProps {
  onLaunchMission: () => void;
  onExploreTech: () => void;
  onOpenConsole: () => void;
}

const DEMO_CHAPTERS = [
  {
    time: 0,
    title: 'Physical Testbench & STM32 CAN Architecture',
    desc: 'Hardware HAL, optical isolation, and unified 31-channel telemetry ingestion at 500 kbps.',
    icon: Cpu,
  },
  {
    time: 15,
    title: 'Zero-Trust Cyber Shield & Self-Healing Telemetry',
    desc: 'Detection of sensor freeze, spikes, and malicious noise with physics-grounded twin substitution.',
    icon: ShieldCheck,
  },
  {
    time: 30,
    title: 'First-Principles Thermodynamic Digital Twin',
    desc: 'Altitude lapse rate, manifold pressure dynamics, and continuous 7-channel residual vectors.',
    icon: Activity,
  },
  {
    time: 45,
    title: 'AI Prognostics & SHAP Explainability',
    desc: 'Calibrated 7-class Random Forest, Isolation Forest anomaly scoring, and local TreeSHAP attribution.',
    icon: Layers,
  },
  {
    time: 60,
    title: 'Multi-Quantile RUL & Pareto Mission Replanning',
    desc: 'P10/P50/P90 hours remaining with 14:1 glide cone emergency airfield reachability.',
    icon: Wrench,
  },
  {
    time: 75,
    title: 'SwarmNet Tactical Mesh & Immutable Audit Ledger',
    desc: '4-UAV formation heartbeat, EW jamming resilience, and SHA-256 chained CEMILAC logbook.',
    icon: Lock,
  },
];

const FAILURE_MODES = [
  {
    name: 'Fuel Injector Clogging',
    subsystem: 'FUEL / INJECTION',
    symptoms: 'Asymmetric EGT drop in affected cylinder; manifold fuel pressure divergence; loss of torque.',
    severity: 'HIGH',
    color: '#f59e0b',
  },
  {
    name: 'Cylinder Head Cooling Degradation',
    subsystem: 'THERMAL / RADIATOR',
    symptoms: 'Rapid CHT escalation decoupled from ambient air lapse rate; thermal runaway under climb.',
    severity: 'CRITICAL',
    color: '#f97316',
  },
  {
    name: 'Oil Lubrication Starvation',
    subsystem: 'LUBRICATION',
    symptoms: 'Sudden drop in oil pressure (< 2.0 bar) coupled with gradual oil temperature rise and friction spikes.',
    severity: 'CRITICAL',
    color: '#f43f5e',
  },
  {
    name: 'Mechanical Bearing Wear',
    subsystem: 'CRANKSHAFT / ROTOR',
    symptoms: 'Multi-axis accelerometer vibration energy increase; harmonic distortion; high metal particulate wear.',
    severity: 'HIGH',
    color: '#a855f7',
  },
  {
    name: 'Sensor Malfunction / Freezing',
    subsystem: 'AVIONICS / SENSORS',
    symptoms: 'Zero variance sensor signal, unphysical gradient jumps (> 50 K/s), or thermodynamic contradiction.',
    severity: 'MEDIUM',
    color: '#0ea5e9',
  },
  {
    name: 'Combustion Detonation (Knock)',
    subsystem: 'CYLINDER COMBUSTION',
    symptoms: 'High-frequency acoustic shockwaves; abrupt EGT spikes; localized cylinder head hot spots.',
    severity: 'HIGH',
    color: '#ec4899',
  },
  {
    name: 'Nominal Aero-Propulsion Twin',
    subsystem: 'ALL CHANNELS',
    symptoms: 'Residual vectors within 3-sigma stochastic envelope; thermal margins > 25%; vibration nominal.',
    severity: 'NOMINAL',
    color: '#10b981',
  },
];

export default function ProjectDemo({
  onLaunchMission,
  onExploreTech,
  onOpenConsole,
}: ProjectDemoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress((video.currentTime / (video.duration || 1)) * 100);

      let currentCh = 0;
      for (let i = DEMO_CHAPTERS.length - 1; i >= 0; i--) {
        if (video.currentTime >= DEMO_CHAPTERS[i].time) {
          currentCh = i;
          break;
        }
      }
      setActiveChapter(currentCh);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTo = (parseFloat(e.target.value) / 100) * duration;
    videoRef.current.currentTime = seekTo;
    setProgress(parseFloat(e.target.value));
  };

  const jumpToChapter = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    if (!isPlaying) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full h-full p-5 sm:p-8 pb-32 flex flex-col gap-8 overflow-y-auto font-sans [&>*]:flex-shrink-0">
      {/* ─── Top Header ─── */}
      <SectionHeader
        title="PROJECT DEMONSTRATION & ARCHITECTURE MASTERCLASS"
        kicker="VYOMAMEDHA // MISSION CAPABILITY BRIEFING"
        subtitle="End-to-end operational walkthrough of the AI-Enabled Cyber-Physical Digital Twin, physical CAN testbench, and autonomous prognostic replanner."
        badge={
          <Badge
            status="TRL-9 DEFENSE OPERATIONAL ARCHITECTURE"
            variant="healthy"
          />
        }
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={onLaunchMission}
              className="glass-button flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold font-mono tracking-wider text-cyan-300 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>LAUNCH SIMULATOR</span>
            </button>
            <button
              onClick={onOpenConsole}
              className="glass-button flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black tracking-wider text-slate-950 bg-gradient-to-r from-sky-400 to-cyan-300 hover:from-sky-300 hover:to-white transition-all shadow-[0_0_20px_rgba(56,189,248,0.4)] cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>DIGITAL TWIN OPS</span>
            </button>
          </div>
        }
      />

      {/* ─── Video Showcase Centerpiece (Theater Frame) ─── */}
      <div
        ref={playerContainerRef}
        className="glass-panel rounded-[2rem] p-4 sm:p-6 flex flex-col gap-4 border border-sky-400/30 shadow-[0_20px_60px_rgba(0,0,0,0.65)] relative overflow-hidden"
      >
        {/* HUD Frame Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span className="text-white font-bold tracking-widest uppercase">
              FIELD DEMO RECORDING // AERO-PROPULSION TWIN FEED
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-400">
            <span>RES: 1080P HD</span>
            <span>CODEC: H.264 / AAC</span>
            <span className="text-cyan-400 font-bold">VYOMAMEDHA ENGINE RIG</span>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-white/10 group">
          <video
            ref={videoRef}
            src="/videos/project-demo.mp4"
            poster="/images/aerovex-uav-hero.jpg"
            playsInline
            muted={isMuted}
            onClick={togglePlay}
            className="w-full h-full object-contain cursor-pointer"
          />

          {/* Large Center Play Overlay (when paused) */}
          {!isPlaying && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px] transition-all cursor-pointer group-hover:bg-black/35"
            >
              <div className="w-20 h-20 rounded-full bg-sky-500/20 border-2 border-sky-400 flex items-center justify-center text-white shadow-[0_0_40px_rgba(56,189,248,0.7)] group-hover:scale-110 transition-transform">
                <Play className="w-8 h-8 fill-current ml-1 text-sky-300" />
              </div>
            </div>
          )}

          {/* HUD Scanlines & Corner Accents */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-cyan-400/80 pointer-events-none" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-cyan-400/80 pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-cyan-400/80 pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-cyan-400/80 pointer-events-none" />
        </div>

        {/* Custom Video Control Bar */}
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-xs">
          {/* Progress Timeline */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 w-12 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
            <span className="text-[11px] text-slate-400 w-12">
              {formatTime(duration)}
            </span>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
              <button
                onClick={toggleMute}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play();
                    setIsPlaying(true);
                  }
                }}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                CURRENT CHAPTER: <strong className="text-cyan-300">{DEMO_CHAPTERS[activeChapter]?.title}</strong>
              </span>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Chapter Quick Jumps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {DEMO_CHAPTERS.map((ch, idx) => {
            const Icon = ch.icon;
            const isActive = activeChapter === idx;
            return (
              <button
                key={ch.title}
                onClick={() => jumpToChapter(ch.time)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  isActive
                    ? 'bg-sky-500/15 border-sky-400/60 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15'
                }`}
              >
                <div className={`p-2 rounded-lg ${isActive ? 'bg-sky-500/20 text-sky-300' : 'bg-white/5 text-slate-400'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-cyan-400">
                      {formatTime(ch.time)}
                    </span>
                    <span className="text-xs font-bold text-white tracking-wide truncate">
                      {ch.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-snug">
                    {ch.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Section 1: The Core Value Proposition ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel rounded-[1.5rem] p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Activity className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white tracking-wide font-display">
            The "Blind Threshold" Trap
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Conventional avionics trigger alarms only after static thresholds are breached (e.g. CHT &gt; 230°C). Over Siachen or Ladakh (18,500 ft MSL), thin air reduces cooling density by 45%. Thermal runaway occurs while absolute temps look nominal. <strong>VYOMAMEDHA</strong> monitors continuous analytical residuals r(t) against first-principles physics.
          </p>
        </div>

        <div className="glass-panel rounded-[1.5rem] p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white tracking-wide font-display">
            Zero-Trust Cyber-Physical Defense
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Adversary electronic warfare can jam or spoof CAN telemetry. The <strong>Zero-Trust Shield</strong> continuously checks 12 physical and temporal vectors (freeze, spikes, noise, thermodynamic contradictions). When an attack occurs, it isolates the corrupt channel and seamlessly heals the data stream with physics twin estimates.
          </p>
        </div>

        <div className="glass-panel rounded-[1.5rem] p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white tracking-wide font-display">
            The Numerical Authority Rule
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            In military aviation, hallucinated AI decisions cost human lives and $20M+ hulls. In VYOMAMEDHA, <strong>every health score, failure probability, and RUL quantile is computed strictly by deterministic mathematical models</strong>. Large Language Models serve exclusively as tactical copilots to explain and synthesize data.
          </p>
        </div>
      </div>

      {/* ─── Section 2: 7 Failure Modes Diagnostic Matrix ─── */}
      <div className="glass-panel rounded-[1.5rem] p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide font-display">
              7-CLASS PROPULSION FAILURE MODE TAXONOMY
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Calibrated Random Forest multi-class classifier operating at sub-50ms inference
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30">
            97.8% TEST ACCURACY
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FAILURE_MODES.map((fm) => (
            <div
              key={fm.name}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-300">
                    {fm.subsystem}
                  </span>
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: `${fm.color}20`,
                      color: fm.color,
                      border: `1px solid ${fm.color}40`,
                    }}
                  >
                    {fm.severity}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white font-display mt-1">
                  {fm.name}
                </h4>
                <p className="text-xs text-slate-400 font-light leading-snug">
                  {fm.symptoms}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Section 3: The Unbroken Cyber-Physical Loop ─── */}
      <div className="glass-panel rounded-[1.5rem] p-6 space-y-6">
        <div className="pb-3 border-b border-white/10">
          <h3 className="text-lg font-bold text-white tracking-wide font-display">
            THE UNBROKEN CYBER-PHYSICAL WORKFLOW
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            Sense &rarr; Verify &rarr; Model &rarr; Detect &rarr; Diagnose &rarr; Explain &rarr; Predict &rarr; Replan &rarr; Log
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <span className="text-cyan-400 font-bold text-sm">01 / SENSE & VERIFY</span>
            <p className="text-slate-400 font-sans text-xs leading-relaxed">
              Optical isolated CAN transceiver samples 31 channels at 500 kbps. Zero-Trust shield inspects every frame for sensor freezes, gradient spikes, and malicious noise before processing.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <span className="text-cyan-400 font-bold text-sm">02 / MODEL & PREDICT</span>
            <p className="text-slate-400 font-sans text-xs leading-relaxed">
              Thermodynamic equations compute expected healthy state. 7-channel residual vectors feed 100-tree Random Forest and Quantile RUL regressor with P10/P50/P90 confidence bounds.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <span className="text-cyan-400 font-bold text-sm">03 / REPLAN & AUDIT</span>
            <p className="text-slate-400 font-sans text-xs leading-relaxed">
              Pareto optimizer generates 3 flight routes (Safety RTB, Mission Completion, Balanced). Prescriptive ATA taskcards and SHA-256 chained blackbox ledger ensure CEMILAC airworthiness.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Bottom Navigation Launchers ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={onLaunchMission}
          className="p-5 rounded-2xl bg-gradient-to-br from-sky-500/10 to-cyan-500/5 border border-sky-400/30 hover:border-sky-400/70 text-left transition-all cursor-pointer group"
        >
          <div className="text-xs font-mono text-cyan-400 font-bold mb-1 flex items-center justify-between">
            <span>3D VISUALIZER</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="text-base font-bold text-white font-display">
            Interactive Flight Simulator
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Cockpit HUD, Chase Camera, and holographic ghost replanning trajectory.
          </p>
        </button>

        <button
          onClick={onOpenConsole}
          className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-400/30 hover:border-emerald-400/70 text-left transition-all cursor-pointer group"
        >
          <div className="text-xs font-mono text-emerald-400 font-bold mb-1 flex items-center justify-between">
            <span>DIGITAL TWIN OPS</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="text-base font-bold text-white font-display">
            Tactical Operations Console
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Live telemetry grid, SHAP explainability, and SHA-256 digital logbook.
          </p>
        </button>

        <button
          onClick={onExploreTech}
          className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border border-purple-400/30 hover:border-purple-400/70 text-left transition-all cursor-pointer group"
        >
          <div className="text-xs font-mono text-purple-400 font-bold mb-1 flex items-center justify-between">
            <span>ENGINEERING SPECS</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="text-base font-bold text-white font-display">
            Physics & Equations
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            First-principles thermodynamic equations and hardware HAL specifications.
          </p>
        </button>
      </div>
    </div>
  );
}
