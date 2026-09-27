/**
 * AERO-TWIN — Global Zustand Store
 * 
 * Single source of truth for all system state received from backend.
 * The backend is AUTHORITATIVE — frontend only stores/displays what backend sends.
 */

import React, { useRef, useCallback, useSyncExternalStore } from 'react';
import { createStore, StoreApi } from 'zustand/vanilla';
import { shallow } from 'zustand/vanilla/shallow';
import { wsService } from '../services/api';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type HealthLabel = 'HEALTHY' | 'DEGRADED' | 'WARNING' | 'CRITICAL' | 'SEVERE';
export type SimView = 'tactical' | 'chase' | 'cockpit' | 'engine' | 'environment' | 'ai' | 'swarm';
export type SwarmFormation = 'V_SHAPE' | 'DIAMOND' | 'ECHELON' | 'ORBIT';

export interface SwarmNodeInfo {
  id: string;
  callsign: string;
  role: 'LEAD' | 'WINGMAN_PORT' | 'WINGMAN_STBD' | 'RELAY';
  battery_pct: number;
  rssi_dbm: number;
  latency_ms: number;
  pdr_pct: number;
  health_pct: number;
  status: 'OPTIMAL' | 'DEGRADED' | 'JAMMED';
}

export interface TelemetryActual {
  rpm: number;
  egt_c: number;
  cht_c: number;
  oil_temp_c: number;
  oil_pressure_bar: number;
  fuel_flow_lph: number;
  vibration: number;
  power_kw: number;
  efficiency: number;
  thermal_margin: number;
  torque_nm: number;
}

export interface SensorStatus {
  confidence: number;
  is_frozen: boolean;
  is_out_of_range: boolean;
  has_spike: boolean;
  is_drifting: boolean;
  is_dropout: boolean;
  reason: string;
  twin_estimate: number | null;
  using_twin_estimate: boolean;
}

export interface SystemState {
  // Connection
  connected: boolean;
  lastUpdate: number;

  // Simulation
  step: number;
  simulationTime: number;
  isRunning: boolean;
  simulationStatus: 'STOPPED' | 'RUNNING' | 'PAUSED';
  commandError: string;

  // Mission
  mission: {
    profile: string;
    environment: string;
    elapsed_hours: number;
    remaining_hours: number;
    duration_hours: number;
    progress_pct: number;
    throttle: number;
    altitude_ft: number;
    ambient_temp_c: number;
    active_fault: string;
    fault_severity: number;
  };

  // Telemetry
  telemetry: {
    actual: Partial<TelemetryActual>;
    expected: Partial<TelemetryActual>;
    residual: Record<string, number>;
  };

  // Health
  health: {
    index: number;
    label: HealthLabel;
    color: string;
    breakdown: Record<string, number>;
  };

  // Degradation
  degradation: {
    injector: number;
    cooling: number;
    lubrication: number;
    mechanical: number;
    combustion: number;
  };

  // AI
  anomaly: {
    anomaly_score: number;
    is_anomaly: boolean;
    confidence: number;
    anomaly_class: string;
  };

  faults: {
    probabilities: Record<string, number>;
    top_fault: string;
    top_fault_probability: number;
    shap: {
      predicted_fault?: string;
      confidence?: number;
      shap_values?: Array<{
        feature: string;
        display_name: string;
        shap_value: number;
        abs_shap: number;
        direction: string;
        feature_value: number;
      }>;
      explanation_method?: string;
      disclaimer?: string;
    };
  };

  rul: {
    rul_median: number;
    rul_lower: number;
    rul_upper: number;
    rul_confidence: number;
    method: string;
  };

  // Telemetry integrity
  integrity: {
    telemetry_integrity_score: number;
    cyber_anomaly_score: number;
    overall_classification: string;
    sensor_statuses: Record<string, SensorStatus>;
    affected_sensors: string[];
    anomaly_reasons: string[];
  };

  // Mission risk
  missionRisk: {
    risk_level: RiskLevel;
    risk_score: number;
    mission_completion_probability: number;
    rul_margin_hours: number;
    rul_insufficient: boolean;
    risk_factors: string[];
    recommended_action: string;
  };

  // Replanning
  replanning: {
    triggered: boolean;
    reason: string;
    current_risk: RiskLevel;
    candidates: Array<{
      name: string;
      throttle: number;
      altitude_ft: number;
      duration_hours: number;
      description: string;
      predicted_health_end: number;
      predicted_rul_hours: number;
      predicted_risk: string;
      mission_completion_probability: number;
      predicted_thermal_margin: number;
      fuel_impact_pct: number;
    }>;
    best_candidate: any | null;
    recommendation: string;
    ghost_waypoints: Array<{ lat: number; lon: number; label: string; type: string }>;
  } | null;

  // UAV position
  uav: {
    lat: number;
    lon: number;
    heading_deg: number;
    speed_kts: number;
    altitude_ft: number;
    waypoints: Array<{ lat: number; lon: number; label: string }>;
    current_waypoint_idx: number;
  };

  // Edge mode
  edgeMode: boolean;
  bufferedSteps: number;

  // Scenario
  scenario: string;

  // UI state (local — not from backend)
  activeView: SimView;
  splitView: boolean;
  splitViewB: SimView;
  showGhostUAV: boolean;
  speedMultiplier: number;
  healthHistory: number[];
  whatIfResult: any | null;
  replayEvents: any[];
  // Swarm & FANET Mesh Networking (UavNetSim integration)
  swarmEnabled: boolean;
  swarmFormation: SwarmFormation;
  showCommsMesh: boolean;
  showRfBubbles: boolean;
  commsJamming: boolean;
  swarmNodes: SwarmNodeInfo[];
  // Manual Flight & Virtual Joystick Control
  manualFlight: boolean;
  joystick: {
    pitch: number;    // -1 (nose down/dive) to +1 (nose up/climb)
    roll: number;     // -1 (bank left) to +1 (bank right)
    yaw: number;      // -1 (rudder left) to +1 (rudder right)
    throttle: number; // 0 (idle) to 1 (full military thrust)
  };
  // Theme
  themeMode: 'dark' | 'light';
}

const defaultState: SystemState = {
  connected: false,
  lastUpdate: 0,
  step: 0,
  simulationTime: 0,
  isRunning: false,
  simulationStatus: 'STOPPED',
  commandError: '',
  mission: {
    profile: 'ISR',
    environment: 'MOUNTAIN',
    elapsed_hours: 0,
    remaining_hours: 4,
    duration_hours: 4,
    progress_pct: 0,
    throttle: 0.65,
    altitude_ft: 18500,
    ambient_temp_c: -8,
    active_fault: 'none',
    fault_severity: 0,
  },
  telemetry: { actual: {}, expected: {}, residual: {} },
  health: { index: 100, label: 'HEALTHY', color: '#00ff88', breakdown: {} },
  degradation: { injector: 0, cooling: 0, lubrication: 0, mechanical: 0, combustion: 0 },
  anomaly: { anomaly_score: 0, is_anomaly: false, confidence: 0.5, anomaly_class: 'NORMAL' },
  faults: { probabilities: {}, top_fault: 'healthy', top_fault_probability: 1, shap: {} },
  rul: { rul_median: 99, rul_lower: 80, rul_upper: 120, rul_confidence: 0.5, method: '' },
  integrity: {
    telemetry_integrity_score: 1,
    cyber_anomaly_score: 0,
    overall_classification: 'NORMAL TELEMETRY',
    sensor_statuses: {},
    affected_sensors: [],
    anomaly_reasons: [],
  },
  missionRisk: {
    risk_level: 'LOW',
    risk_score: 0,
    mission_completion_probability: 1,
    rul_margin_hours: 0,
    rul_insufficient: false,
    risk_factors: [],
    recommended_action: 'CONTINUE',
  },
  replanning: null,
  uav: {
    lat: 34.1526,
    lon: 77.5771,
    heading_deg: 55,
    speed_kts: 110,
    altitude_ft: 18500,
    waypoints: [],
    current_waypoint_idx: 0,
  },
  edgeMode: false,
  bufferedSteps: 0,
  scenario: 'HEALTHY_ISR',
  activeView: 'chase',
  splitView: false,
  splitViewB: 'engine',
  showGhostUAV: true,
  speedMultiplier: 1,
  healthHistory: [],
  whatIfResult: null,
  replayEvents: [],
  swarmEnabled: false,
  swarmFormation: 'V_SHAPE',
  showCommsMesh: false,
  showRfBubbles: false,
  commsJamming: false,
  manualFlight: false,
  joystick: { pitch: 0, roll: 0, yaw: 0, throttle: 0.65 },
  swarmNodes: [
    { id: 'uav-01', callsign: 'REAPER-LEAD', role: 'LEAD', battery_pct: 92, rssi_dbm: -42, latency_ms: 8.4, pdr_pct: 99.8, health_pct: 100, status: 'OPTIMAL' },
    { id: 'uav-02', callsign: 'ALPHA-02', role: 'WINGMAN_PORT', battery_pct: 88, rssi_dbm: -51, latency_ms: 12.1, pdr_pct: 99.2, health_pct: 98, status: 'OPTIMAL' },
    { id: 'uav-03', callsign: 'BETA-03', role: 'WINGMAN_STBD', battery_pct: 86, rssi_dbm: -53, latency_ms: 13.5, pdr_pct: 98.7, health_pct: 97, status: 'OPTIMAL' },
    { id: 'uav-04', callsign: 'RELAY-04', role: 'RELAY', battery_pct: 79, rssi_dbm: -58, latency_ms: 17.2, pdr_pct: 97.5, health_pct: 94, status: 'OPTIMAL' },
  ],
  themeMode: 'dark',
};

interface Actions {
  updateFromBackend: (data: any) => void;
  setConnected: (v: boolean) => void;
  setActiveView: (v: SimView) => void;
  setSplitView: (v: boolean, viewB?: SimView) => void;
  setShowGhostUAV: (v: boolean) => void;
  setSpeedMultiplier: (v: number) => void;
  setWhatIfResult: (v: any) => void;
  setReplayEvents: (v: any[]) => void;
  setIsRunning: (v: boolean) => void;
  setSwarmEnabled: (v: boolean) => void;
  setSwarmFormation: (f: SwarmFormation) => void;
  setShowCommsMesh: (v: boolean) => void;
  setShowRfBubbles: (v: boolean) => void;
  setCommsJamming: (v: boolean) => void;
  setEnvironment: (env: string) => void;
  setManualFlight: (v: boolean) => void;
  setJoystick: (joy: Partial<SystemState['joystick']>) => void;
  updateUavFlight: (upd: Partial<SystemState['uav']>) => void;
}

const storeApi = createStore<SystemState & Actions>((set, get) => ({
  ...defaultState,

  updateFromBackend: (data: any) => {
    const prev = get();
    const newHealth = data.health?.index ?? prev.health.index;
    const baseHistory = data.step < prev.step ? [] : prev.healthHistory;
    const history = data.step !== prev.step ? [...baseHistory.slice(-299), newHealth] : baseHistory;

    // If manual flight is active, keep local uav position/heading/alt instead of snapping
    const uavData = prev.manualFlight && prev.uav ? prev.uav : (data.uav ?? prev.uav);

    set({
      step: data.step ?? prev.step,
      isRunning: data.simulation_status === 'RUNNING',
      simulationStatus: data.simulation_status ?? prev.simulationStatus,
      speedMultiplier: data.speed_multiplier ?? prev.speedMultiplier,
      simulationTime: data.simulation_time_s ?? prev.simulationTime,
      lastUpdate: Date.now(),
      mission: data.mission ?? prev.mission,
      telemetry: data.telemetry ?? prev.telemetry,
      health: data.health ?? prev.health,
      degradation: data.degradation ?? prev.degradation,
      anomaly: data.anomaly ?? prev.anomaly,
      faults: data.faults ?? prev.faults,
      rul: data.rul ?? prev.rul,
      integrity: data.integrity ?? prev.integrity,
      missionRisk: data.mission_risk ?? prev.missionRisk,
      replanning: data.replanning ?? prev.replanning,
      uav: uavData,
      edgeMode: data.edge_mode ?? prev.edgeMode,
      bufferedSteps: data.buffered_steps ?? prev.bufferedSteps,
      scenario: data.scenario ?? prev.scenario,
      healthHistory: history,
    });
  },

  setConnected: (v) => set({ connected: v }),
  setActiveView: (v) => set({ activeView: v }),
  setSplitView: (v, viewB) => set({ splitView: v, ...(viewB && { splitViewB: viewB }) }),
  setShowGhostUAV: (v) => set({ showGhostUAV: v }),
  setSpeedMultiplier: (v) => set({ speedMultiplier: v }),
  setWhatIfResult: (v) => set({ whatIfResult: v }),
  setReplayEvents: (v) => set({ replayEvents: v }),
  setIsRunning: (v) => set({ isRunning: v }),
  setSwarmEnabled: (v) => set({ swarmEnabled: v }),
  setSwarmFormation: (f) => set({ swarmFormation: f }),
  setShowCommsMesh: (v) => set({ showCommsMesh: v }),
  setShowRfBubbles: (v) => set({ showRfBubbles: v }),
  setCommsJamming: (v) => set(s => ({
    commsJamming: v,
    swarmNodes: s.swarmNodes.map((n, i) => i === 2 ? {
      ...n,
      status: v ? 'JAMMED' : 'OPTIMAL',
      pdr_pct: v ? 42.1 : 98.7,
      latency_ms: v ? 142.0 : 13.5,
      rssi_dbm: v ? -89 : -53,
    } : n),
  })),
  setEnvironment: (env) => set(s => ({ mission: { ...s.mission, environment: env } })),
  setManualFlight: (v) => set({ manualFlight: v }),
  setJoystick: (joy) => set(s => ({ joystick: { ...s.joystick, ...joy } })),
  updateUavFlight: (upd) => set(s => ({ uav: { ...s.uav, ...upd } })),
}));

type StoreHook<S> = {
  (): S;
  <U>(selector: (state: S) => U): U;
} & StoreApi<S>;

export const useStore = Object.assign(
  function useStore<U = SystemState & Actions>(selector?: (state: SystemState & Actions) => U): U {
    const selectorRef = useRef(selector);
    selectorRef.current = selector;
    const lastSelectionRef = useRef<U>(undefined as any);

    const getSnapshot = useCallback(() => {
      const state = storeApi.getState();
      const next = selectorRef.current ? selectorRef.current(state) : (state as unknown as U);
      if (lastSelectionRef.current === undefined || !shallow(lastSelectionRef.current, next)) {
        lastSelectionRef.current = next;
      }
      return lastSelectionRef.current;
    }, []);

    return useSyncExternalStore(
      storeApi.subscribe,
      getSnapshot,
      () => {
        const init = storeApi.getInitialState();
        return selectorRef.current ? selectorRef.current(init) : (init as unknown as U);
      }
    );
  } as unknown as StoreHook<SystemState & Actions>,
  storeApi
);

// One shared stream for every page, including connection lifecycle changes.
export function initWebSocket() {
  const connection = wsService.onConnection(connected => useStore.setState({ connected }));
  const unsubscribe = wsService.subscribe(data => {
    if (typeof data.step === 'number') useStore.getState().updateFromBackend(data);
  });
  return () => { unsubscribe(); connection(); wsService.disconnect(); };
}
