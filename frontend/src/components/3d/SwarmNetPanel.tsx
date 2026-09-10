import React from 'react';
import { useStore, SwarmFormation } from '../../store/useStore';

export function SwarmNetPanel() {
  const {
    swarmEnabled,
    setSwarmEnabled,
    swarmFormation,
    setSwarmFormation,
    showCommsMesh,
    setShowCommsMesh,
    showRfBubbles,
    setShowRfBubbles,
    commsJamming,
    setCommsJamming,
    swarmNodes,
  } = useStore(s => ({
    swarmEnabled: s.swarmEnabled,
    setSwarmEnabled: s.setSwarmEnabled,
    swarmFormation: s.swarmFormation,
    setSwarmFormation: s.setSwarmFormation,
    showCommsMesh: s.showCommsMesh,
    setShowCommsMesh: s.setShowCommsMesh,
    showRfBubbles: s.showRfBubbles,
    setShowRfBubbles: s.setShowRfBubbles,
    commsJamming: s.commsJamming,
    setCommsJamming: s.setCommsJamming,
    swarmNodes: s.swarmNodes,
  }));

  const avgPdr = swarmNodes.reduce((acc, n) => acc + n.pdr_pct, 0) / (swarmNodes.length || 1);
  const avgLatency = swarmNodes.reduce((acc, n) => acc + n.latency_ms, 0) / (swarmNodes.length || 1);

  const FORMATIONS: { key: SwarmFormation; label: string; icon: string }[] = [
    { key: 'V_SHAPE', label: 'V-SHAPE', icon: '∧' },
    { key: 'DIAMOND', label: 'DIAMOND', icon: '◇' },
    { key: 'ECHELON', label: 'ECHELON', icon: '⧅' },
    { key: 'ORBIT', label: 'ORBIT', icon: '◎' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 38,
        right: 12,
        width: 310,
        maxHeight: 'calc(100% - 48px)',
        overflowY: 'auto',
        background: 'rgba(5, 12, 20, 0.88)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #1a3a5a',
        borderRadius: 4,
        padding: '12px 14px',
        fontFamily: 'monospace',
        color: '#c8d8e8',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        zIndex: 20,
      }}
    >
      {/* Panel Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1a324a', paddingBottom: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#00d4ff', letterSpacing: '0.12em' }}>
            UAVNETSIM | FANET MESH
          </div>
          <div style={{ fontSize: 8, color: '#4a6888' }}>
            AODV AD-HOC PROTOCOL | SIMULATION
          </div>
        </div>
        <button
          onClick={() => setSwarmEnabled(!swarmEnabled)}
          style={{
            background: swarmEnabled ? '#00d4ff22' : '#ff335522',
            border: `1px solid ${swarmEnabled ? '#00d4ff' : '#ff3355'}`,
            color: swarmEnabled ? '#00d4ff' : '#ff3355',
            fontSize: 9,
            padding: '2px 8px',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          {swarmEnabled ? 'SWARM ON' : 'SOLO'}
        </button>
      </div>

      {swarmEnabled && (
        <>
          {/* Network Performance Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            <div style={{ background: '#081624', padding: '6px 8px', borderRadius: 3, border: '1px solid #142a40' }}>
              <div style={{ fontSize: 8, color: '#4a6888' }}>AVG PACKET RATIO (PDR)</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: commsJamming ? '#ffaa00' : '#00ff88' }}>
                {avgPdr.toFixed(1)}%
              </div>
            </div>
            <div style={{ background: '#081624', padding: '6px 8px', borderRadius: 3, border: '1px solid #142a40' }}>
              <div style={{ fontSize: 8, color: '#4a6888' }}>END-TO-END LATENCY</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: commsJamming ? '#ffaa00' : '#00d4ff' }}>
                {avgLatency.toFixed(1)} ms
              </div>
            </div>
            <div style={{ background: '#081624', padding: '6px 8px', borderRadius: 3, border: '1px solid #142a40' }}>
              <div style={{ fontSize: 8, color: '#4a6888' }}>THROUGHPUT</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c8d8e8' }}>
                {commsJamming ? '14.2 Mbps' : '24.8 Mbps'}
              </div>
            </div>
            <div style={{ background: '#081624', padding: '6px 8px', borderRadius: 3, border: '1px solid #142a40' }}>
              <div style={{ fontSize: 8, color: '#4a6888' }}>ACTIVE MESH LINKS</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: commsJamming ? '#ff8800' : '#00ff88' }}>
                {commsJamming ? '4 / 6 Active' : '6 / 6 Mesh Full'}
              </div>
            </div>
          </div>

          {/* Formation Selector */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 8, color: '#4a6888', marginBottom: 4, letterSpacing: '0.08em' }}>
              SWARM FORMATION
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {FORMATIONS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setSwarmFormation(f.key)}
                  style={{
                    background: swarmFormation === f.key ? '#00d4ff33' : '#0a1a2a',
                    border: `1px solid ${swarmFormation === f.key ? '#00d4ff' : '#1a3048'}`,
                    color: swarmFormation === f.key ? '#00d4ff' : '#88a0b8',
                    fontSize: 8,
                    padding: '4px 2px',
                    borderRadius: 2,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 10 }}>{f.icon}</div>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Swarm Nodes List */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 8, color: '#4a6888', marginBottom: 4, letterSpacing: '0.08em' }}>
              SWARM NODES ({swarmNodes.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {swarmNodes.map(node => (
                <div
                  key={node.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 6px',
                    background: node.status === 'JAMMED' ? 'rgba(255, 51, 85, 0.12)' : '#071522',
                    border: `1px solid ${node.status === 'JAMMED' ? '#ff335555' : '#10283e'}`,
                    borderRadius: 2,
                    fontSize: 8,
                  }}
                >
                  <div>
                    <span style={{ color: node.status === 'JAMMED' ? '#ff3355' : '#00d4ff', fontWeight: 700 }}>
                      {node.callsign}
                    </span>
                    <span style={{ color: '#4a6888', marginLeft: 4 }}>
                      [{node.role.replace('WINGMAN_', '')}]
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#88a0b8' }}>{node.rssi_dbm} dBm</span>
                    <span style={{ color: '#88a0b8' }}>{node.latency_ms.toFixed(0)}ms</span>
                    <span
                      style={{
                        color:
                          node.status === 'OPTIMAL' ? '#00ff88' :
                          node.status === 'DEGRADED' ? '#ffaa00' : '#ff3355',
                        fontWeight: 700,
                      }}
                    >
                      {node.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Display & Experimentation Toggles */}
          <div style={{ borderTop: '1px solid #142a40', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setShowCommsMesh(!showCommsMesh)}
                style={{
                  flex: 1,
                  background: showCommsMesh ? '#00d4ff18' : '#081624',
                  border: `1px solid ${showCommsMesh ? '#00d4ff88' : '#142a40'}`,
                  color: showCommsMesh ? '#00d4ff' : '#6080a0',
                  fontSize: 8,
                  padding: '4px 6px',
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                ⧉ MESH LINKS: {showCommsMesh ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setShowRfBubbles(!showRfBubbles)}
                style={{
                  flex: 1,
                  background: showRfBubbles ? '#00d4ff18' : '#081624',
                  border: `1px solid ${showRfBubbles ? '#00d4ff88' : '#142a40'}`,
                  color: showRfBubbles ? '#00d4ff' : '#6080a0',
                  fontSize: 8,
                  padding: '4px 6px',
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                ◎ RF DOMES: {showRfBubbles ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Jamming Test Button */}
            <button
              onClick={() => setCommsJamming(!commsJamming)}
              style={{
                width: '100%',
                background: commsJamming ? '#ff335528' : '#ffaa0018',
                border: `1px solid ${commsJamming ? '#ff3355' : '#ffaa0088'}`,
                color: commsJamming ? '#ff3355' : '#ffaa00',
                fontSize: 9,
                fontWeight: 700,
                padding: '6px 8px',
                borderRadius: 3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {commsJamming ? '⚡ CLEAR RF JAMMING (RESTORE)' : '⚡ INJECT RF JAMMING ATTACK'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
