import React from 'react';
import { ArrowRight, Crosshair, Eye, Network, Play, Shield } from 'lucide-react';

interface UAVHeroCenterpieceProps { onStartMission: () => void; onExploreTech: () => void; }

const features = [
  { label: 'Persistent monitoring', icon: Eye }, { label: 'AI-powered intelligence', icon: Network },
  { label: 'Multi-spectral sensing', icon: Shield }, { label: 'Mission-ready reliability', icon: Crosshair },
];

export const UAVHeroCenterpiece: React.FC<UAVHeroCenterpieceProps> = ({ onStartMission, onExploreTech }) => {
  return <section className="visual-hero">
    <aside className="visual-rail"><i /><span className="active">01</span><span>02</span><span>03</span></aside>
    <div className="visual-kicker">VYOMAMEDHA // MISSION-AWARE ENGINE INTELLIGENCE <i /></div>
    <div className="visual-copy">
      <h1>AI-ENABLED<br />ENGINE INTELLIGENCE<br /><span>FOR UAV RELIABILITY</span></h1>
      <p>Cyber-physical digital twin, real-time prognostics, and autonomous mission risk replanning for MALE UAV aero-piston engines.</p>
      <div className="visual-actions"><button onClick={onStartMission} className="visual-primary"><Play className="w-4 h-4 fill-current" />LAUNCH SIMULATOR</button><button onClick={onExploreTech} className="visual-secondary">EXPLORE SYSTEMS <ArrowRight className="w-4 h-4" /></button></div>
    </div>
    <div className="visual-feature-label">PREDICT<br />UNDERSTAND<br />PROTECT<br /><span>VYOMAMEDHA</span></div><div className="visual-features">{features.map(({label,icon:Icon}) => <article key={label}><Icon className="w-7 h-7" /><span>{label}</span></article>)}</div>
    <div className="visual-system-online"><i /> SYSTEMS ONLINE</div>
  </section>;
};
