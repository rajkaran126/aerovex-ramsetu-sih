import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function setup() {
  const sockets = [], timers = new Map();
  class Socket {
    static OPEN = 1;
    readyState = 0;
    constructor() { sockets.push(this); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  const source = fs.readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8').replaceAll('import.meta.env', '({})');
  const exports = {};
  const context = { exports, WebSocket: Socket, location: { protocol: 'http:', host: 'localhost:5173' }, console,
    setTimeout: callback => { const key = timers.size + 1; timers.set(key, callback); return key; },
    clearTimeout: key => timers.delete(key), fetch: async () => ({ok:true,json:async()=>({})}) };
  vm.runInNewContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS }), context);
  return { service: exports.wsService, sockets, timers };
}

test('connecting subscribers share one socket and receive state', () => {
  const {service,sockets}=setup(); const frames=[];
  service.subscribe(data=>frames.push(data)); service.connect(); service.subscribe(()=>{});
  assert.equal(sockets.length,1);
  sockets[0].onmessage({data:'{"step":7}'});
  assert.equal(frames[0].step,7);
  sockets[0].onmessage({data:'{"type":"ping"}'});
  assert.equal(frames.length,1);
});
test('connection loss is reported and reconnect is scheduled',()=>{
  const {service,sockets,timers}=setup(); const states=[];
  service.onConnection(value=>states.push(value));service.connect();
  sockets[0].readyState=1;sockets[0].onopen();sockets[0].close();
  assert.deepEqual(states,[false,true,false]);assert.equal(timers.size,1);
});
test('intentional shutdown cancels retries and allows a clean restart',()=>{
  const {service,sockets,timers}=setup();service.connect();sockets[0].close();
  service.disconnect();assert.equal(timers.size,0);assert.equal(service.connected,false);
  service.connect();assert.equal(sockets.length,2);
});
