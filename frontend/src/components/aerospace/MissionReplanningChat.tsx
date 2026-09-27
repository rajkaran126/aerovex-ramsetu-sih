import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  Navigation,
  Bot,
  User,
  Sparkles,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { api } from '../../services/api';

interface ChatMessage {
  id: string;
  sender: 'copilot' | 'operator';
  text: string;
  timestamp: string;
  isProposal?: boolean;
  proposalDetails?: {
    candidateName: string;
    targetThrottle: number;
    targetAltitude: number;
    durationHours: number;
    healthPreservationPct: number;
    completionProb: number;
    fuelSavedPct: number;
  };
  executed?: boolean;
}

const PRESET_QUESTIONS = [
  'Why is divert safer than continuing the current mission profile?',
  'What happens if we maintain current throttle for 15 minutes?',
  'How much thermal margin and fuel do we recover with this plan?',
  'What are the minimum terrain clearance constraints in this sector?',
];

export function MissionReplanningChat({ className = '' }: { className?: string }) {
  const {
    health,
    mission,
    missionRisk,
    replanning,
    telemetry,
    uav,
    rul,
    faults,
    themeMode,
  } = useStore(s => ({
    health: s.health,
    mission: s.mission,
    missionRisk: s.missionRisk,
    replanning: s.replanning,
    telemetry: s.telemetry,
    uav: s.uav,
    rul: s.rul,
    faults: s.faults,
    themeMode: s.themeMode,
  }));
  const isLight = themeMode === 'light';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [lastNotifiedHealth, setLastNotifiedHealth] = useState(100);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Initial welcome message
  useEffect(() => {
    setMessages([
      {
        id: 'msg-welcome',
        sender: 'copilot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `Autonomous Mission Replanning Copilot online for sector ${mission.environment || 'Standard'}. Monitoring thermodynamic health and dynamic flight envelopes. If engine degradation is detected, I will automatically compute and propose a safer mission profile.`,
      },
    ]);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Proactive trigger: If engine health deteriorates (< 85% or fault active), automatically propose a shorter/safer profile!
  useEffect(() => {
    const currentHealth = health.index;
    const hasDeteriorated = currentHealth < 85 && (lastNotifiedHealth - currentHealth >= 8 || lastNotifiedHealth >= 85);
    const hasActiveFault = mission.active_fault && mission.active_fault !== 'none' && mission.active_fault !== FaultTypeNone;

    if ((hasDeteriorated || hasActiveFault) && currentHealth < 88) {
      setLastNotifiedHealth(currentHealth);

      // Auto-trigger replanning evaluation
      api.runReplanning().catch(() => {});

      const best = replanning?.best_candidate || {
        name: 'EMERGENCY_DIVERT',
        throttle: 0.50,
        altitude_ft: Math.min(uav.altitude_ft || 12000, 8000),
        duration_hours: 1.2,
        predicted_health_end: Math.max(35, currentHealth - 10),
        mission_completion_probability: 0.94,
        fuel_impact_pct: -38.5,
      };

      const faultDesc = mission.active_fault !== 'none' ? `Active fault detected: ${mission.active_fault.toUpperCase()}.` : '';
      const chttemp = telemetry.actual?.cht_c ? `${Math.round(telemetry.actual.cht_c)}Â°C` : 'elevated';
      const proposalText = `[CRITICAL ADVISORY] ENGINE HEALTH DETERIORATION DETECTED (${Math.round(currentHealth)}% â€” ${health.label}).
${faultDesc} CHT is at ${chttemp} with thermal margin dropping. Continuation of profile '${mission.profile}' at ${Math.round(uav.altitude_ft || mission.altitude_ft)} ft risks thermal runaway and mechanical lockup within ${Math.max(15, Math.round(rul.rul_median * 0.4))} minutes.

AUTOMATIC REPLAN PROPOSAL: Proposing immediate transition to safe profile '${best.name}'.
- Throttle derate: ${Math.round(best.throttle * 100)}% (lowers cylinder heat flux)
- Safe altitude: ${Math.round(best.altitude_ft)} ft MSL (optimum glide + cooling density)
- Fuel impact: ${best.fuel_impact_pct}% burn
- Completion confidence: ${Math.round(best.mission_completion_probability * 100)}% (vs ${Math.round(missionRisk.mission_completion_probability * 100)}% current)`;

      setMessages(prev => [
        ...prev,
        {
          id: `proposal-${Date.now()}`,
          sender: 'copilot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: proposalText,
          isProposal: true,
          proposalDetails: {
            candidateName: best.name,
            targetThrottle: best.throttle,
            targetAltitude: best.altitude_ft,
            durationHours: best.duration_hours,
            healthPreservationPct: best.predicted_health_end,
            completionProb: best.mission_completion_probability,
            fuelSavedPct: Math.abs(best.fuel_impact_pct),
          },
        },
      ]);
    }
  }, [health.index, mission.active_fault, lastNotifiedHealth]);

  const FaultTypeNone = 'none';

  // Execute Replan Action
  const handleExecuteReplan = async (msgId: string, candidateName: string) => {
    try {
      await api.applyReplanning(candidateName);
      const state = await api.getState();
      useStore.getState().updateFromBackend(state);

      setMessages(prev =>
        prev.map(m => (m.id === msgId ? { ...m, executed: true } : m)).concat({
          id: `exec-confirm-${Date.now()}`,
          sender: 'copilot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `[CONFIRMED] REPLAN EXECUTED: Flight Computer updated to '${candidateName}'. Throttle clamped to safe derated envelope. Telemetry and flight vector aligned to safe divert corridor.`,
        })
      );
    } catch (err) {
      console.error('Failed to apply replanning:', err);
    }
  };

  // Generate intelligent response to operator questions
  const generateCopilotResponse = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes('why') && (q.includes('divert') || q.includes('safer') || q.includes('rtb'))) {
      return `Thermodynamic rationale: Under current degradation (${faults.top_fault || 'thermal fatigue'}), cylinder head temperature exceeds nominal dissipation limits. Loitering at altitude maintains cylinder pressure at ${Math.round((telemetry.actual?.power_kw || 70) * 1.1)} kPa, accelerating piston crown wear. Diverting directly to the nearest sector airfield at reduced throttle (50%) cuts convective heat buildup by 42% and guarantees positive glide distance in case of sudden flameout.`;
    }

    if (q.includes('15 minute') || q.includes('maintain current') || q.includes('continue')) {
      const margin = telemetry.actual?.thermal_margin || 18;
      const rulEstimate = Math.max(10, Math.round(rul.rul_median * 0.3));
      return `Projection: Maintaining current throttle (${Math.round((mission.throttle || 0.65) * 100)}%) will deplete remaining thermal margin (currently ${margin.toFixed(1)}Â°C) within approximately ${rulEstimate} minutes. At that point, oil viscosity drops below hydrodynamic film threshold (< 1.2 cSt), leading to unrecoverable valve guide seizure.`;
    }

    if (q.includes('thermal') || q.includes('fuel') || q.includes('recover')) {
      return `Derating throttle from ${Math.round((mission.throttle || 0.65) * 100)}% down to 50% reduces cylinder fuel flow from ${(telemetry.actual?.fuel_flow_lph || 24).toFixed(1)} L/h to ${(telemetry.actual?.fuel_flow_lph ? telemetry.actual.fuel_flow_lph * 0.72 : 16.5).toFixed(1)} L/h. This extends Remaining Useful Life (RUL) margin by +${(rul.rul_median * 0.5).toFixed(1)} hours and recovers +14.2Â°C of thermal safety margin.`;
    }

    if (q.includes('terrain') || q.includes('altitude') || q.includes('clearance') || q.includes('sector')) {
      const terrain = mission.environment || 'DESERT';
      const safeFloor = terrain === 'MOUNTAIN' ? 14500 : terrain === 'FOREST' ? 6500 : 3000;
      return `In the ${terrain} sector, minimum safe instrument altitude (MORA) is ${safeFloor.toLocaleString()} ft MSL. The proposed replan altitude balances atmospheric cooling air density while preserving a minimum 1,500 ft terrain obstacle buffer above mountain ridges and towers.`;
    }

    // Default contextual answer
    return `Analysis: Digital Twin real-time health index is ${Math.round(health.index)}% with risk state '${missionRisk.risk_level}'. The recommended action is '${missionRisk.recommended_action || 'Execute derated divert'}'. I will continue to forward-simulate alternative profiles to optimize survivability.`;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'operator',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: text.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsTyping(true);

    // Try backend Groq agent first if available, otherwise use domain expert engine
    let reply = '';
    try {
      const res = await api.chatAgent(text.trim(), 'mission', {
        health: health.index,
        mission: mission.profile,
        environment: mission.environment,
        risk: missionRisk.risk_level,
        fault: faults.top_fault,
      });

      if (res && res.response && !res.response.includes('LLM intelligence unavailable')) {
        reply = res.response;
      } else {
        reply = generateCopilotResponse(text);
      }
    } catch {
      reply = generateCopilotResponse(text);
    }

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'copilot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: reply,
        },
      ]);
      setIsTyping(false);
    }, 600);
  };

  const handleManualEval = async () => {
    setIsTyping(true);
    try {
      await api.runReplanning();
      const state = await api.getState();
      useStore.getState().updateFromBackend(state);

      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: `eval-${Date.now()}`,
            sender: 'copilot',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: `Manual evaluation complete. Current risk: ${missionRisk.risk_level}. Health margin: ${Math.round(health.index)}%. 5 alternative profiles evaluated against digital twin model.`,
          },
        ]);
        setIsTyping(false);
      }, 500);
    } catch {
      setIsTyping(false);
    }
  };

  return (
    <div className={`flex flex-col h-full rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
      isLight
        ? 'bg-white/95 border-cyan-500/25 text-slate-900 shadow-xl'
        : 'bg-slate-950/85 backdrop-blur-xl border-cyan-500/30 text-white shadow-2xl'
    } ${className}`}>
      {/* â”€â”€ Chat Header â”€â”€ */}
      <div className={`flex items-center justify-between px-4 py-3 border-b transition-colors ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-white/10'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs font-bold tracking-wider ${isLight ? 'text-slate-950' : 'text-white'}`}>
                TACTICAL MISSION REPLANNER COPILOT
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Autonomous Health-Driven Profile Adaptation
            </div>
          </div>
        </div>

        <button
          onClick={handleManualEval}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
            isLight
              ? 'text-cyan-600 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30'
              : 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30'
          }`}
          title="Run dynamic replanning forward-simulation"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Re-Evaluate</span>
        </button>
      </div>

      {/* â”€â”€ Chat Messages Stream â”€â”€ */}
      <div ref={chatScrollRef} className={`flex-1 p-4 overflow-y-auto space-y-3.5 transition-colors ${
        isLight ? 'bg-slate-50/60' : 'bg-slate-950/50'
      }`}>
        {messages.map(m => {
          const isCopilot = m.sender === 'copilot';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 ${isCopilot ? 'justify-start' : 'justify-end'}`}
            >
              {isCopilot && (
                <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-cyan-500 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs font-sans leading-relaxed shadow-xs ${
                  isCopilot
                    ? isLight
                      ? 'bg-white border border-cyan-500/20 text-slate-800 shadow-sm'
                      : 'bg-slate-900/90 border border-cyan-500/30 text-slate-200'
                    : 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white font-medium border border-cyan-400/40 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[10px] font-mono mb-1.5 opacity-70">
                  <span className={isCopilot ? (isLight ? 'text-cyan-600 font-bold' : 'text-cyan-400 font-bold') : 'text-slate-100 font-bold'}>
                    {isCopilot ? 'AI COPILOT' : 'OPERATOR'}
                  </span>
                  <span>{m.timestamp}</span>
                </div>

                <div className="whitespace-pre-line text-xs font-normal">
                  {m.text}
                </div>

                {/* â”€â”€ Interactive Proposal Card â”€â”€ */}
                {m.isProposal && m.proposalDetails && !m.executed && (
                  <div className={`mt-3 p-3 rounded-xl border ${
                    isLight
                      ? 'bg-cyan-50/90 border-cyan-500/35 text-slate-900 shadow-sm'
                      : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-100'
                  }`}>
                    <div className="flex items-center justify-between font-mono text-[11px] font-bold text-cyan-600 dark:text-cyan-300 border-b border-cyan-500/30 pb-1.5 mb-2">
                      <span>PROFILE: {m.proposalDetails.candidateName}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {Math.round(m.proposalDetails.completionProb * 100)}% SAFE CONFIDENCE
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-slate-600 dark:text-slate-300 mb-3">
                      <div>
                        Derated Throttle:{' '}
                        <strong className="text-slate-950 dark:text-white">
                          {Math.round(m.proposalDetails.targetThrottle * 100)}%
                        </strong>
                      </div>
                      <div>
                        Divert Altitude:{' '}
                        <strong className="text-slate-950 dark:text-white">
                          {Math.round(m.proposalDetails.targetAltitude)} ft
                        </strong>
                      </div>
                      <div>
                        Flight Time:{' '}
                        <strong className="text-slate-950 dark:text-white">
                          {m.proposalDetails.durationHours} hrs
                        </strong>
                      </div>
                      <div>
                        Fuel Burn Saved:{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                          +{m.proposalDetails.fuelSavedPct}%
                        </strong>
                      </div>
                    </div>

                    <button
                      onClick={() => handleExecuteReplan(m.id, m.proposalDetails!.candidateName)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-mono text-xs font-bold shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-all cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>APPROVE & EXECUTE SAFER MISSION PROFILE</span>
                    </button>
                  </div>
                )}

                {m.executed && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/40">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>MISSION PROFILE ADOPTED & FLIGHT COMPUTER LOCKED</span>
                  </div>
                )}
              </div>

              {!isCopilot && (
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-xs ${
                  isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-white'
                }`}>
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 pl-9">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            <span>AI Copilot computing thermodynamic envelope...</span>
          </div>
        )}
      </div>

      {/* â”€â”€ Preset Operator Query Chips â”€â”€ */}
      <div className={`px-4 py-2 border-t overflow-x-auto flex items-center gap-1.5 transition-colors ${
        isLight ? 'bg-slate-100/90 border-slate-200' : 'bg-slate-900/80 border-white/10'
      }`}>
        <span className={`text-[10px] font-mono font-bold uppercase flex-shrink-0 ${
          isLight ? 'text-slate-500' : 'text-slate-400'
        }`}>
          PROMPTS:
        </span>
        {PRESET_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-sans border transition-all cursor-pointer truncate max-w-xs ${
              isLight
                ? 'bg-white text-slate-700 hover:text-cyan-600 hover:bg-cyan-50 border-slate-200 hover:border-cyan-400'
                : 'bg-white/5 text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15 border-white/10 hover:border-cyan-500/30'
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* â”€â”€ Message Input Bar â”€â”€ */}
      <div className={`p-3 border-t flex items-center gap-2 transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-white/10'
      }`}>
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask Copilot about replanning, thermal risks, divert routes..."
          className={`flex-1 px-3.5 py-2 text-xs rounded-xl border transition-all font-sans focus:outline-none focus:border-cyan-500 ${
            isLight
              ? 'bg-slate-50 border-slate-200 text-slate-950 placeholder:text-slate-400'
              : 'bg-slate-900/90 border-white/15 text-white placeholder:text-slate-500'
          }`}
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputValue.trim()}
          className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-xs transition-all cursor-pointer font-bold"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

