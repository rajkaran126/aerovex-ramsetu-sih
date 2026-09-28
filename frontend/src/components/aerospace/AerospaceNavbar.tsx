import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type NavTab = 'home' | 'technology' | 'specifications' | 'demo' | 'operations' | 'simulator' | 'contact';

interface AerospaceNavbarProps { activeTab: NavTab; onSelectTab: (tab: NavTab) => void; onLaunchMission: () => void; onOpenContact: () => void; }

const NAV_LINKS: { key: NavTab; label: string }[] = [
  { key: 'home', label: 'Home' }, { key: 'technology', label: 'Systems' }, { key: 'specifications', label: 'Specifications' },
  { key: 'demo', label: 'Demo' }, { key: 'operations', label: 'Operations' }, { key: 'simulator', label: 'Simulator' },
];

export const AerospaceNavbar: React.FC<AerospaceNavbarProps> = ({ activeTab, onSelectTab, onLaunchMission, onOpenContact }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = (tab: NavTab) => { if (tab === 'contact') onOpenContact(); else onSelectTab(tab); setMobileOpen(false); };
  return <header className="reference-nav">
    <div className="reference-nav-inner">
      <button className="reference-brand" onClick={() => navigate('home')} aria-label="VYOMAMEDHA home"><img src="/images/vyomamedha-logo.png" alt="VYOMAMEDHA" className="brand-logo" /><span>VYOMAMEDHA</span></button>
      <nav className="reference-desktop-nav" aria-label="Primary navigation">
        {NAV_LINKS.map(link => <button key={link.key} className={activeTab === link.key ? 'active' : ''} onClick={() => navigate(link.key)}>{link.label}</button>)}
      </nav>
      <div className="reference-nav-side"><button onClick={onOpenContact}>Contact us</button><button className="reference-launch" onClick={onLaunchMission}>Open console</button><button className="reference-menu" onClick={() => setMobileOpen(value => !value)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>{mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}</button></div>
    </div>
    {mobileOpen && <nav className="reference-mobile-nav" aria-label="Mobile navigation">{NAV_LINKS.map(link => <button key={link.key} onClick={() => navigate(link.key)}>{link.label}</button>)}<button onClick={() => navigate('contact')}>Contact us</button></nav>}
  </header>;
};
