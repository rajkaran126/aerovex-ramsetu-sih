import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Crosshair, Eye, Network, Play, Shield, Volume2, VolumeX } from 'lucide-react';

interface UAVHeroCenterpieceProps {
  onStartMission: () => void;
  onExploreTech: () => void;
  onWatchDemo?: () => void;
}

const features = [
  { label: 'Persistent monitoring', icon: Eye },
  { label: 'AI-powered intelligence', icon: Network },
  { label: 'Multi-spectral sensing', icon: Shield },
  { label: 'Mission-ready reliability', icon: Crosshair },
];

export const UAVHeroCenterpiece: React.FC<UAVHeroCenterpieceProps> = ({ onStartMission, onExploreTech, onWatchDemo }) => {
  const [isMuted, setIsMuted] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(err => {
        console.info('[Hero Video] Autoplay waiting for interaction:', err.message);
      });
    }
  }, []);

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted) {
        videoRef.current.play().catch(e => console.warn('Audio playback error', e));
      }
    }
  };

  return (
    <section className="visual-hero relative w-full h-full overflow-hidden">
      {/* ── Cinematic UAV Video Background ── */}
      <video
        ref={videoRef}
        src="/videos/hero-uav.mp4"
        poster="/images/aerovex-uav-hero.jpg"
        autoPlay
        loop
        muted={isMuted}
        playsInline
        onLoadedData={() => setVideoLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-1000 ${
          videoLoaded ? 'opacity-85' : 'opacity-40'
        }`}
      />

      {/* ── Atmospheric Aerospace Vignettes & Wash ── */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#020b14]/95 via-[#020b14]/65 to-transparent pointer-events-none" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#020b14] via-transparent to-[#020b14]/60 pointer-events-none" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_65%_45%,transparent_25%,#020b14_90%)] pointer-events-none" />

      {/* ── Hero Foreground Content ── */}
      <aside className="visual-rail z-10"><i /><span className="active">01</span><span>02</span><span>03</span></aside>
      <div className="visual-kicker z-10">VYOMAMEDHA // MISSION-AWARE ENGINE INTELLIGENCE <i /></div>
      <div className="visual-copy z-10">
        <h1>AI-ENABLED<br />ENGINE INTELLIGENCE<br /><span>FOR UAV RELIABILITY</span></h1>
        <p>Cyber-physical digital twin, real-time prognostics, and autonomous mission risk replanning for MALE UAV aero-piston engines.</p>
        <div className="visual-actions">
          <button onClick={onStartMission} className="visual-primary">
            <Play className="w-4 h-4 fill-current" />LAUNCH SIMULATOR
          </button>
          {onWatchDemo && (
            <button
              onClick={onWatchDemo}
              className="visual-primary !bg-emerald-500/20 !border-emerald-400/50 hover:!bg-emerald-500/30 text-emerald-300"
            >
              <Play className="w-4 h-4 fill-current text-emerald-400" />WATCH DEMO
            </button>
          )}
          <button onClick={onExploreTech} className="visual-secondary">
            EXPLORE SYSTEMS <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="visual-feature-label z-10">PREDICT<br />UNDERSTAND<br />PROTECT<br /><span>VYOMAMEDHA</span></div>
      <div className="visual-features z-10">
        {features.map(({ label, icon: Icon }) => (
          <article key={label}><Icon className="w-7 h-7" /><span>{label}</span></article>
        ))}
      </div>
      <div className="visual-system-online z-10"><i /> SYSTEMS ONLINE</div>

      {/* ── Right-most Bottom Mute / Unmute Icon-Only Control ── */}
      <div className="absolute right-6 bottom-6 sm:right-10 sm:bottom-8 z-30 flex items-center">
        <button
          onClick={toggleMute}
          className="group relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#051424]/85 hover:bg-[#0a2647] active:scale-95 backdrop-blur-2xl border border-sky-400/40 hover:border-sky-400/80 shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_16px_rgba(56,189,248,0.25)] transition-all duration-300 cursor-pointer"
          title={isMuted ? 'Click to unmute audio' : 'Click to mute audio'}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
        >
          {!isMuted && (
            <span className="absolute inset-0 rounded-full border border-emerald-400/50 animate-ping pointer-events-none" />
          )}
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-slate-300 group-hover:text-amber-400 transition-colors drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          ) : (
            <Volume2 className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 transition-colors drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          )}
        </button>
      </div>
    </section>
  );
};
