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
    <div className="visual-kicker">AUTONOMOUS AERIAL PLATFORMS <i /></div>
    <div className="visual-copy">
      <h1>SECURITY<br />SURVEILLANCE<br /><span>IN THE SKY</span></h1>
      <p>Persistent aerial intelligence for the missions where visibility, endurance, and decisive action matter most.</p>
      <div className="visual-actions"><button onClick={onStartMission} className="visual-primary"><Play className="w-4 h-4 fill-current" />WATCH MISSION</button><button onClick={onExploreTech} className="visual-secondary">EXPLORE SYSTEMS <ArrowRight className="w-4 h-4" /></button></div>
    </div>
    <div className="visual-feature-label">DEFEND<br />MONITOR<br />PROTECT<br /><span>ALWAYS AHEAD</span></div><div className="visual-features">{features.map(({label,icon:Icon}) => <article key={label}><Icon className="w-7 h-7" /><span>{label}</span></article>)}</div>
    <div className="visual-system-online"><i /> SYSTEMS ONLINE</div>
  </section>;
};
