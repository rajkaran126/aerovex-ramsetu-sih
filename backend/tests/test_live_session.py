import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.orchestrator import orchestrator


def test_shared_session_pause_and_controls():
    client = TestClient(app)
    client.post('/api/simulation/reset')
    before = client.get('/api/state').json()
    assert before['simulation_status'] == 'PAUSED'
    assert before['health'] and before['telemetry']['actual']
    assert orchestrator._step_simulation() is None
    assert client.get('/api/state').json()['step'] == before['step']
    client.post('/api/simulation/start')
    assert client.get('/api/state').json()['simulation_status'] == 'RUNNING'
    client.post('/api/simulation/pause')
    client.post('/api/simulation/control', json={'speed_multiplier': 5})
    client.post('/api/missions/set', json={'profile': 'ISR', 'environment': 'DESERT'})
    state = client.get('/api/state').json()
    assert state['speed_multiplier'] == 5
    assert state['mission']['environment'] == 'DESERT'
    with client.websocket_connect('/ws/telemetry') as ws:
        snapshot = ws.receive_json()
        assert snapshot['simulation_status'] == 'PAUSED'
        assert snapshot['step'] == state['step']


def test_groq_rejects_invalid_key_without_replacing_key():
    from app.ai.groq_orchestrator import groq_orchestrator
    old = groq_orchestrator._groq_api_key
    response = TestClient(app).post('/api/system/groq-key', json={'api_key': 'invalid'})
    assert response.status_code == 400
    assert groq_orchestrator._groq_api_key == old


def test_broadcast_reaches_both_clients():
    async def check():
        first, second = orchestrator.subscribe(), orchestrator.subscribe()
        try:
            state = orchestrator.get_full_state()
            await orchestrator._broadcast(state)
            assert await first.get() == await second.get() == state
        finally:
            orchestrator.unsubscribe(first)
            orchestrator.unsubscribe(second)
    asyncio.run(check())
