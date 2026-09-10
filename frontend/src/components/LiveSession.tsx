import { useEffect, useState } from 'react';
import { Activity, Play, Pause, RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';

export function LiveSession() {
  const { connected, lastUpdate, simulationStatus, step, mission, manualFlight } = useStore(s => ({ connected: s.connected, lastUpdate: s.lastUpdate, simulationStatus: s.simulationStatus, step: s.step, mission: s.mission, manualFlight: s.manualFlight }));
  const [now, setNow] = useState(Date.now());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const handleError = (event: Event) => setError((event as CustomEvent<string>).detail);
    window.addEventListener('api-error', handleError);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); window.removeEventListener('api-error', handleError); };
  }, []);
  const age = lastUpdate ? Math.max(0, Math.floor((now - lastUpdate) / 1000)) : null;
  const fresh = connected && age !== null && age < 5;
  const label = !connected ? 'Disconnected' : !fresh ? 'Awaiting fresh data' : simulationStatus === 'RUNNING' ? 'Live simulation' : simulationStatus === 'PAUSED' ? 'Simulation paused' : 'Ready to start';
  async function command(action: () => Promise<unknown>) {
    setPending(true); setError('');
    try { await action(); useStore.getState().updateFromBackend(await api.getState()); }
    catch { setError('Could not reach the simulation service. Check the backend and retry.'); }
    finally { setPending(false); }
  }
  return <section className="live-session" aria-label="Shared simulation session">
    <div className="session-identity"><span className={`session-icon ${fresh ? 'fresh' : ''}`}><Activity size={18}/></span><div><strong>{label}</strong><small>Simulator & operations share one backend session</small></div></div>
    <div className="session-facts"><span>{mission.profile} / {mission.environment}</span><span>Step {step}</span><span>{age === null ? 'No samples yet' : `Received ${age}s ago`}</span></div>
    <div className="session-controls"><button disabled={pending || !connected || simulationStatus === 'RUNNING'} onClick={() => command(api.startSimulation)}><Play size={14}/> Start</button><button disabled={pending || !connected || simulationStatus !== 'RUNNING'} onClick={() => command(api.pauseSimulation)}><Pause size={14}/> Pause</button><button disabled={pending || !connected} onClick={() => command(api.resetSimulation)}><RotateCcw size={14}/> Reset</button></div>
    {(!fresh || step === 0) && <p className="session-notice">{step === 0 ? 'Start the simulator to populate telemetry. Initial values are placeholders.' : 'Telemetry is not live. Displaying the last received values.'}</p>}
    {manualFlight && <p className="session-notice">Manual flight is a local 3D preview. Engine monitoring continues from the backend simulation.</p>}
    {error && <p role="alert" className="session-notice">{error}</p>}
  </section>;
}
