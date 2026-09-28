import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Crosshair, Eye, Network, Play, Shield, Volume2, VolumeX } from 'lucide-react';

interface UAVHeroCenterpieceProps {
  onStartMission: () => void;
  onExploreTech: () => void;
}

const features = [
  { label: 'Persistent monitoring', icon: Eye },
  { label: 'AI-powered intelligence', icon: Network },
  { label: 'Multi-spectral sensing', icon: Shield },
  { label: 'Mission-ready reliability', icon: Crosshair },
];

export const UAVHeroCenterpiece: React.FC<UAVHeroCenterpieceProps> = ({ onStartMission, onExploreTech }) => {
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

      {/* ── Right-most Bottom Mute / Unmute Control ── */}
      <div className="absolute right-6 bottom-6 sm:right-10 sm:bottom-8 z-30 flex items-center">
        <button
          onClick={toggleMute}
          className="group flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#051424]/85 hover:bg-[#09223d] active:scale-95 backdrop-blur-xl border border-sky-400/35 hover:border-sky-400/80 shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_16px_rgba(56,189,248,0.25)] text-white text-xs font-mono tracking-wider transition-all duration-300 cursor-pointer"
          title={isMuted ? 'Unmute video audio' : 'Mute video audio'}
          aria-label={isMuted ? 'Unmute video audio' : 'Mute video audio'}
        >
          <div className={`w-2 h-2 rounded-full transition-all ${isMuted ? 'bg-amber-400' : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'}`} />
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-slate-300 group-hover:text-amber-300 transition-colors" />
          ) : (
            <Volume2 className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300 transition-colors animate-pulse" />
          )}
          <span className="font-bold text-[11px] select-none">
            {isMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO'}
          </span>
        </button>
      </div>
    </section>
  );
};
