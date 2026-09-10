import React, { useState } from 'react';
import { X, Send, ShieldCheck, Mail, Building, User } from 'lucide-react';
import { AEROSPACE_CONTENT } from '../../data/aerospaceContent';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    agency: '',
    email: '',
    theatre: 'HIGH_ALTITUDE',
    notes: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2200);
  };

  return (
    <div className="reference-contact fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-xl animate-fadeIn">
      <div className="reference-contact-card relative w-full max-w-lg p-6 sm:p-8 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close contact"
          className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            <span className="text-[10px] font-mono tracking-widest text-sky-400 uppercase font-semibold">
              MISSION PROCUREMENT & BRIEFING
            </span>
          </div>
          <h3 className="text-2xl font-bold text-white tracking-wide">
            Deploy {AEROSPACE_CONTENT.brand.name} Systems
          </h3>
          <p className="text-xs text-slate-400 font-light">
            Connect with our aerospace mission integration team for technical evaluation kits, flight
            trial schedules, and deployment specifications.
          </p>
        </div>

        {submitted ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">Mission Dossier Dispatched</h4>
            <p className="text-xs text-slate-300 max-w-xs font-light">
              Your transmission has been encrypted and routed to our defense mission planning desk.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-mono tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                <User className="w-3 h-3 text-sky-400" />
                <span>Command Officer / Representative</span>
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Commander Vikram Roy"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-sky-400 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-400 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                  <Building className="w-3 h-3 text-sky-400" />
                  <span>Agency / Organization</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="Defense / Coast Guard / Security"
                  value={formData.agency}
                  onChange={e => setFormData({ ...formData, agency: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-sky-400 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-400 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-sky-400" />
                  <span>Secure Email</span>
                </label>
                <input
                  required
                  type="email"
                  placeholder="officer@agency.mil"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-sky-400 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-400 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono tracking-wider text-slate-300 uppercase">
                Primary Operational Theatre of Interest
              </label>
              <select
                value={formData.theatre}
                onChange={e => setFormData({ ...formData, theatre: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 focus:border-sky-400 text-xs text-white focus:outline-none transition-colors"
              >
                <option value="HIGH_ALTITUDE">High-Altitude Mountain Ridge (Himalayas)</option>
                <option value="MARITIME">Exclusive Economic Zone (EEZ) Maritime Ocean</option>
                <option value="DESERT">Desert & Arid Plains (SAR Radar)</option>
                <option value="JUNGLE">Dense Forest & Tropical Canopy (FLIR)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono tracking-wider text-slate-300 uppercase">
                Mission Objective / Technical Request
              </label>
              <textarea
                rows={3}
                placeholder="Specify payload configuration, endurance parameters, or simulation requirements..."
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-sky-400 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-400 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full text-xs font-bold tracking-wider text-slate-950 bg-gradient-to-r from-sky-400 via-sky-300 to-cyan-200 hover:from-sky-300 hover:to-white transition-all duration-300 shadow-[0_0_25px_rgba(56,189,248,0.5)] flex items-center justify-center gap-2 mt-2"
            >
              <span>Transmit Encrypted Inquiry</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
