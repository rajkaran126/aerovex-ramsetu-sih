/**
 * AERO-TWIN — WebSocket Service
 * Maintains a persistent WebSocket connection to the backend.
 * Automatically reconnects on disconnect.
 */

const WS_URL = import.meta.env.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/telemetry`;
const API_BASE = import.meta.env.VITE_API_URL || ''; 

type MessageHandler = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 15000;
  private _connected = false;
  private stopped = false;
  private connectionHandlers = new Set<(connected: boolean) => void>();

  onConnection(handler: (connected: boolean) => void): () => void {
    this.connectionHandlers.add(handler);
    handler(this._connected);
    return () => { this.connectionHandlers.delete(handler); };
  }

  private setConnected(connected: boolean) {
    this._connected = connected;
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  get connected() { return this._connected; }

  connect(): void {
    this.stopped = false;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.setConnected(true);
        this.reconnectDelay = 1000;
        console.info('[AERO-TWIN WS] Connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ping') return;
          this.handlers.forEach(h => h(data));
        } catch (e) {
          console.warn('[AERO-TWIN WS] Parse error', e);
        }
      };

      this.ws.onclose = () => {
        this.setConnected(false);
        console.info('[AERO-TWIN WS] Disconnected — reconnecting...');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[AERO-TWIN WS] Error', err);
        this.ws?.close();
      };
    } catch (e) {
      console.error('[AERO-TWIN WS] Failed to connect', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
    return () => this.handlers.delete(handler);
  }

  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.setConnected(false);
  }
}

export const wsService = new WebSocketService();

// ── REST API helpers ──────────────────────────────────────────────────────

async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }); } catch (error) {
    window.dispatchEvent(new CustomEvent('api-error', { detail: 'Backend unavailable. Check the connection and retry.' }));
    throw error;
  }
  if (!res.ok) {
    const err = await res.text();
    window.dispatchEvent(new CustomEvent('api-error', { detail: `Request failed (${res.status}). Please retry.` }));
    throw new Error(`API Error ${res.status}: ${err}`);
  }
  return res.json();
}

export const api = {
  getState: () => apiFetch('/api/state'),
  getHealth: () => apiFetch('/api/health'),
  getFaults: () => apiFetch('/api/faults'),
  getRUL: () => apiFetch('/api/rul'),
  getMissions: () => apiFetch('/api/missions'),
  getReplay: () => apiFetch('/api/replay'),
  getMaintenance: () => apiFetch('/api/maintenance'),
  getTwinHistory: () => apiFetch('/api/twin/history'),

  startSimulation: () => apiFetch('/api/simulation/start', { method: 'POST' }),
  pauseSimulation: () => apiFetch('/api/simulation/pause', { method: 'POST' }),
  resetSimulation: () => apiFetch('/api/simulation/reset', { method: 'POST' }),

  controlSimulation: (params: Record<string, number>) =>
    apiFetch('/api/simulation/control', { method: 'POST', body: JSON.stringify(params) }),

  setMission: (profile: string, environment?: string) =>
    apiFetch('/api/missions/set', { method: 'POST', body: JSON.stringify({ profile, environment }) }),

  loadScenario: (scenario: string) =>
    apiFetch('/api/scenario/load', { method: 'POST', body: JSON.stringify({ scenario }) }),

  injectFault: (fault_type: string, severity: number) =>
    apiFetch('/api/fault/inject', { method: 'POST', body: JSON.stringify({ fault_type, severity }) }),

  clearFault: () => apiFetch('/api/fault/clear', { method: 'POST' }),

  injectTelemetryAnomaly: (sensor: string, anomaly_type: string, magnitude: number, duration_steps?: number) =>
    apiFetch('/api/telemetry/inject', {
      method: 'POST',
      body: JSON.stringify({ sensor, anomaly_type, magnitude, duration_steps: duration_steps ?? 300 }),
    }),

  clearTelemetryInjection: () => apiFetch('/api/telemetry/clear', { method: 'POST' }),

  runReplanning: () => apiFetch('/api/replanning/run', { method: 'POST' }),

  applyReplanning: (candidate_name: string) =>
    apiFetch('/api/replanning/apply', { method: 'POST', body: JSON.stringify({ candidate_name }) }),

  runWhatIf: (params: Record<string, any>) =>
    apiFetch('/api/what-if', { method: 'POST', body: JSON.stringify(params) }),

  activateEdgeMode: () => apiFetch('/api/edge/activate', { method: 'POST' }),
  deactivateEdgeMode: () => apiFetch('/api/edge/deactivate', { method: 'POST' }),

  updateSettings: (settings: Record<string, number>) =>
    apiFetch('/api/settings/update', { method: 'POST', body: JSON.stringify(settings) }),

  // System Readiness & Dynamic Handoff
  getReadiness: () => apiFetch('/api/system/readiness'),
  getDatasetRegistry: () => apiFetch('/api/datasets/registry'),
  scanDatasets: () => apiFetch('/api/datasets/scan', { method: 'POST' }),
  generateAeroTwinDataset: () => apiFetch('/api/datasets/generate-aero-twin', { method: 'POST' }),
  setGroqApiKey: (api_key: string) =>
    apiFetch('/api/system/groq-key', { method: 'POST', body: JSON.stringify({ api_key }) }),
  getAgentStatus: () => apiFetch('/api/agent/status'),
  chatAgent: (message: string, agent_type?: string, context?: Record<string, any>) =>
    apiFetch('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message, agent_role: agent_type || 'orchestrator', context: context || {} }),
    }),
};
