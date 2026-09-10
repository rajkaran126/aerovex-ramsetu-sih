import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Key,
  Bot,
  Send,
  Cpu,
  ShieldCheck,
  Activity,
  FolderGit2,
  Radio,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { StatCard, SectionHeader, Badge } from '../components/aerospace/UIComponents';

interface ReadinessData {
  datasets: {
    aero_twin: boolean;
    cmapss: boolean;
    n_cmapss: boolean;
    ml_olympiad: boolean;
  };
  groq: {
    configured: boolean;
    mode: string;
    notice: string;
  };
  models: {
    anomaly: boolean;
    fault: boolean;
    rul: boolean;
  };
  subsystems: {
    physics_engine: boolean;
    digital_twin: boolean;
    local_ai: boolean;
    mission_engine: boolean;
    telemetry_cyber_monitor: boolean;
  };
}

interface AgentMessage {
  sender: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export default function SystemReadiness() {
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [registry, setRegistry] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [groqStatusMsg, setGroqStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Agent Chat State
  const [selectedAgent, setSelectedAgent] = useState<'orchestrator' | 'engine' | 'security' | 'mission' | 'maintenance'>('orchestrator');
  const [userPrompt, setUserPrompt] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatLog, setChatLog] = useState<AgentMessage[]>([
    {
      sender: 'SYSTEM',
      role: 'system',
      content: 'Intelligence console ready. Configure Groq for chat; numerical monitoring uses the shared simulation stream.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const connected = useStore(s => s.connected);
  const { telemetry, health, missionRisk, mission } = useStore(s => ({
    telemetry: s.telemetry,
    health: s.health,
    missionRisk: s.missionRisk,
    mission: s.mission,
  }));

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const [rData, regData] = await Promise.all([
        api.getReadiness(),
        api.getDatasetRegistry(),
      ]);
      setReadiness(rData);
      setRegistry(regData);
    } catch (e) {
      console.error('Failed to fetch readiness:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleScanDatasets = async () => {
    setScanning(true);
    try {
      const res = await api.scanDatasets();
      setRegistry(res.datasets);
      await fetchStatus();
    } catch (e) {
      console.error('Scan error:', e);
    } finally {
      setScanning(false);
    }
  };

  const handleGenerateAeroTwin = async () => {
    setGenerating(true);
    try {
      await api.generateAeroTwinDataset();
      await fetchStatus();
    } catch (e) {
      console.error('Generate error:', e);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGroqKey = async () => {
    if (!groqKeyInput.trim()) return;
    try {
      const res = await api.setGroqApiKey(groqKeyInput.trim());
      setGroqStatusMsg({ type: 'success', text: `Key configured! Mode: ${res.notice}` });
      setGroqKeyInput('');
      await fetchStatus();
    } catch (err: any) {
      setGroqStatusMsg({ type: 'error', text: err.message || 'Failed to update Groq key' });
    }
  };

  const handleSendChat = async () => {
    if (!userPrompt.trim() || chatLoading) return;
    const msg = userPrompt.trim();
    setUserPrompt('');

    const newLog: AgentMessage[] = [
      ...chatLog,
      {
        sender: 'OPERATOR',
        role: 'user',
        content: msg,
        timestamp: new Date().toLocaleTimeString(),
      },
    ];
    setChatLog(newLog);
    setChatLoading(true);

    try {
      const context = {
        altitude_ft: mission.altitude_ft ?? 15000,
        rpm: telemetry.actual.rpm ?? 4800,
        egt_c: telemetry.actual.egt_c ?? 650,
        cht_c: telemetry.actual.cht_c ?? 180,
        oil_pressure_bar: telemetry.actual.oil_pressure_bar ?? 3.5,
        health_index: health.index,
        health_status: health.label,
        mission_risk: missionRisk.risk_level,
      };

      const res = await api.chatAgent(msg, selectedAgent, context);

      setChatLog([
        ...newLog,
        {
          sender: res.agent ? res.agent.toUpperCase() : selectedAgent.toUpperCase(),
          role: 'assistant',
          content: res.response,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (e: any) {
      setChatLog([
        ...newLog,
        {
          sender: 'SYSTEM',
          role: 'system',
          content: e.message || 'LLM intelligence unavailable — numerical AI remains active.',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const isGroqOnline = readiness?.groq?.configured ?? false;

  return (
    <div className="w-full h-full p-5 flex flex-col gap-5 overflow-y-auto font-sans">
      {/* ─── Top Header with Glowing Vertical Accent Bar ─── */}
      <SectionHeader
        title="SYSTEM READINESS & RESOURCE MATRIX"
        kicker="SIMULATION RESOURCE VERIFICATION"
        subtitle="Live telemetry validation, AI model inference checks, dataset telemetry status, and cross-agent orchestrator."
        badge={
          <Badge
            status={isGroqOnline ? 'GROQ ACCELERATION ONLINE' : 'LOCAL AI MODE'}
            variant={isGroqOnline ? 'healthy' : 'warning'}
          />
        }
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={handleScanDatasets}
              disabled={scanning}
              className="glass-button flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold font-mono tracking-wider text-cyan-300 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'SCANNING...' : 'SCAN DATASETS'}</span>
            </button>
            <button
              onClick={handleGenerateAeroTwin}
              disabled={generating}
              className="glass-button flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black tracking-wider text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-white transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              <span>{generating ? 'SYNTHESIZING...' : 'GENERATE SYNTHETIC DATA'}</span>
            </button>
          </div>
        }
      />

      {/* ─── 4 KAPP-BMW Inspired Stat Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="SUBSYSTEM HEALTH"
          value={readiness ? `${Object.values(readiness.subsystems).filter(Boolean).length} / ${Object.keys(readiness.subsystems).length}` : "--"}
          subvalue="Subsystem checks"
          icon={<ShieldCheck className="w-6 h-6" />}
          color="emerald"
          trend={{ direction: 'up', text: 'NOMINAL' }}
        />
        <StatCard
          label="AI INFERENCE MODELS"
          value={readiness ? `${Object.values(readiness.models).filter(Boolean).length} / 3` : "--"}
          subvalue="Model artifacts found"
          icon={<Cpu className="w-6 h-6" />}
          color="cyan"
          trend={{ direction: 'up', text: 'OPTIMIZED' }}
        />
        <StatCard
          label="TELEMETRY STREAM"
          value={connected ? "1 Hz" : "Offline"}
          subvalue="Configured publish rate"
          icon={<Activity className="w-6 h-6" />}
          color="blue"
          trend={{ direction: 'neutral', text: connected ? 'CONNECTED' : 'OFFLINE' }}
        />
        <StatCard
          label="INTELLIGENCE ENGINE"
          value={isGroqOnline ? 'GROQ LLM' : 'LOCAL AI'}
          subvalue={isGroqOnline ? 'Multi-Agent Active' : 'Fallback Mode'}
          icon={<Bot className="w-6 h-6" />}
          color={isGroqOnline ? 'purple' : 'amber'}
          trend={{ direction: isGroqOnline ? 'up' : 'neutral', text: isGroqOnline ? 'ACCELERATED' : 'LOCAL' }}
        />
      </div>

      {/* ─── Main Two-Column Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch min-h-0">
        {/* Left Column: Verification Matrix (5 Cols) */}
        <div className="lg:col-span-5 glass-panel rounded-[1.5rem] p-5 flex flex-col space-y-3 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-base text-white tracking-wide">
                SYSTEM VERIFICATION MATRIX
              </h3>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 font-bold tracking-widest uppercase">
              10 CHANNELS
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <StatusRow
              title="AERO-TWIN TELEMETRY"
              ready={readiness?.datasets?.aero_twin ?? false}
              readyText="READY"
              awaitingText="MISSING / GENERATING"
              detail="Primary aero-piston physics dataset (Rotax 914/915 iS class)"
            />
            <StatusRow
              title="NASA C-MAPSS"
              ready={readiness?.datasets?.cmapss ?? false}
              readyText="READY"
              awaitingText="AWAITING DROP"
              detail="NASA Turbofan Run-to-Failure degradation benchmark"
            />
            <StatusRow
              title="NASA N-CMAPSS"
              ready={readiness?.datasets?.n_cmapss ?? false}
              readyText="READY"
              awaitingText="AWAITING DROP"
              detail="High-Fidelity N-CMAPSS HDF5 continuous sequence benchmark"
            />
            <StatusRow
              title="ML OLYMPIAD"
              ready={readiness?.datasets?.ml_olympiad ?? false}
              readyText="READY"
              awaitingText="AWAITING DROP"
              detail="Multivariate turbofan predictive maintenance competition dataset"
            />
            <StatusRow
              title="LOCAL ML INFERENCE MODELS"
              ready={Boolean(readiness?.models?.anomaly && readiness?.models?.fault && readiness?.models?.rul)}
              readyText="OPERATIONAL"
              awaitingText="INITIALIZING"
              detail="Isolation Forest Anomaly, 7-Class Random Forest, Quantile RUL Regressor"
            />
            <StatusRow
              title="GROQ MULTI-AGENT LLM"
              ready={readiness?.groq?.configured ?? false}
              readyText="CONFIGURED"
              awaitingText="API KEY REQUIRED"
              detail="Chief, Engine, Cyber, Mission & Maintenance multi-agent orchestration"
            />
            <StatusRow
              title="DIGITAL TWIN ENGINE"
              ready={readiness?.subsystems?.digital_twin ?? true}
              readyText="SYNCHRONIZED"
              awaitingText="OFFLINE"
              detail="Real-time analytical state estimator with 7-channel thermodynamic residual vectors"
            />
            <StatusRow
              title="MISSION PARETO ENGINE"
              ready={readiness?.subsystems?.mission_engine ?? true}
              readyText="ENGAGED"
              awaitingText="OFFLINE"
              detail="Dynamic Pareto risk modeling, contingency path evaluator & autonomous replanner"
            />
          </div>

          {/* Dataset Ingestion Paths */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 font-mono text-[11px] text-slate-400 space-y-1.5">
            <div className="text-cyan-300 font-bold tracking-wider mb-1 flex items-center gap-2">
              <FolderGit2 className="w-4 h-4" />
              <span>DATASET INGESTION PATHS:</span>
            </div>
            <div>• C-MAPSS: <code className="text-slate-200">data/raw/cmapss/train_FD001.txt</code></div>
            <div>• N-CMAPSS: <code className="text-slate-200">data/raw/n_cmapss/N-CMAPSS_DS02-006.h5</code></div>
            <div>• ML Olympiad: <code className="text-slate-200">data/raw/ml_olympiad/train_set.csv</code></div>
          </div>
        </div>

        {/* Right Column: Multi-Agent Intelligence Hub (7 Cols) */}
        <div className="lg:col-span-7 glass-panel rounded-[1.5rem] p-5 flex flex-col space-y-3 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-400">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-base text-white tracking-wide">
                MULTI-AGENT INTELLIGENCE CONSOLE
              </h3>
            </div>
            <Badge
              status={isGroqOnline ? 'LLM ACCELERATION ACTIVE' : 'LOCAL TELEMETRY MODE'}
              variant={isGroqOnline ? 'purple' : 'warning'}
            />
          </div>

          {/* Groq Key Banner */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 flex items-center gap-2 font-bold">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                CENTRALIZED GROQ API KEY CONFIGURATION
              </span>
              <span className={isGroqOnline ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                {readiness?.groq?.mode || 'LOCAL_ONLY'}
              </span>
            </div>

            <div className="flex gap-3">
              <input
                type="password"
                placeholder={isGroqOnline ? '•••••••••••••••••••••••••••• (API Key Active)' : 'Paste your gsk_... key to unlock full multi-agent LLM reasoning'}
                value={groqKeyInput}
                onChange={(e) => setGroqKeyInput(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
              <button
                onClick={handleSaveGroqKey}
                className="glass-button px-5 py-2.5 rounded-xl text-xs font-black tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(14,165,233,0.4)]"
              >
                APPLY KEY
              </button>
            </div>

            {groqStatusMsg && (
              <div
                className={`text-xs font-mono ${
                  groqStatusMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {groqStatusMsg.text}
              </div>
            )}
          </div>

          {/* Interactive Agent Chat Stream */}
          <div className="flex-1 flex flex-col rounded-2xl bg-black/40 border border-white/10 overflow-hidden min-h-0">
            {/* Agent Selector Bar */}
            <div className="flex items-center gap-1.5 p-2.5 bg-white/[0.02] border-b border-white/10 overflow-x-auto">
              {(['orchestrator', 'engine', 'security', 'mission', 'maintenance'] as const).map((agent) => (
                <button
                  key={agent}
                  onClick={() => setSelectedAgent(agent)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium tracking-wider transition-all whitespace-nowrap ${
                    selectedAgent === agent
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(14,165,233,0.3)] font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {agent === 'orchestrator' ? '👑 Chief Orchestrator' :
                   agent === 'engine' ? '⚙ Propulsion' :
                   agent === 'security' ? '🛡 Cyber Security' :
                   agent === 'mission' ? '🎯 Mission Risk' : '🔧 Maintenance'}
                </button>
              ))}
            </div>

            {/* Message Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
              {chatLog.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    m.role === 'user'
                      ? 'bg-cyan-500/10 border-cyan-400/30 text-cyan-100 ml-8'
                      : m.role === 'system'
                      ? 'bg-amber-500/10 border-amber-400/30 text-amber-100'
                      : 'bg-white/[0.04] border-white/10 text-slate-200 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 text-[10px]">
                    <span
                      className={`font-bold tracking-wider ${
                        m.role === 'user'
                          ? 'text-cyan-400'
                          : m.role === 'system'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      [{m.sender}]
                    </span>
                    <span className="text-slate-500">{m.timestamp}</span>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed font-light break-words min-w-0">{m.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs italic animate-pulse p-2">
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                  <span>Multi-agent cross reasoning graph executing...</span>
                </div>
              )}
            </div>

            {/* Transmit Form */}
            <div className="p-3 bg-white/[0.02] border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                placeholder={
                  isGroqOnline
                    ? `Ask ${selectedAgent.toUpperCase()} agent with live telemetry context...`
                    : 'Query agent (local telemetry fallback mode)...'
                }
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
              <button
                onClick={handleSendChat}
                disabled={chatLoading}
                className="glass-button px-5 py-2.5 rounded-xl text-xs font-black tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(14,165,233,0.4)]"
              >
                <span>TRANSMIT</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  title,
  ready,
  readyText,
  awaitingText,
  detail,
}: {
  title: string;
  ready: boolean;
  readyText: string;
  awaitingText: string;
  detail: string;
}) {
  return (
    <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.04] transition-all duration-300 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-slate-200 tracking-wide">
          {title}
        </span>
        <Badge
          status={ready ? readyText : awaitingText}
          variant={ready ? 'healthy' : 'warning'}
        />
      </div>
      <p className="text-[11px] text-slate-400 font-light leading-snug">{detail}</p>
    </div>
  );
}
