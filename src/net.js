// P2P 네트워크 (PeerJS / WebRTC). 방장이 권한 서버 역할
import { Peer } from 'peerjs';

const PREFIX = 'rouletterush-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_PLAYERS = 8;

// ── 테스트용 모의 피어 (?mocknet): 같은 브라우저 탭끼리 BroadcastChannel로 연결 ──
const MOCK = typeof location !== 'undefined' && location.search.includes('mocknet');
class Emitter { constructor() { this._h = {}; } on(e, f) { (this._h[e] || (this._h[e] = [])).push(f); } emit(e, ...a) { (this._h[e] || []).forEach((f) => f(...a)); } }
const mockPeers = new Map();
class FakeConn extends Emitter {
  constructor(owner, remote) { super(); this.owner = owner; this.peer = remote; this.open = false; }
  send(d) { if (this.open) this.owner.ch.postMessage({ to: this.peer, from: this.owner.id, type: 'data', d: JSON.parse(JSON.stringify(d)) }); }
  close() { if (!this.open) return; this.open = false; this.owner.ch.postMessage({ to: this.peer, from: this.owner.id, type: 'close' }); this.emit('close'); }
}
class FakePeer extends Emitter {
  constructor(id) {
    super(); this.id = typeof id === 'string' ? id : 'c' + Math.random().toString(36).slice(2, 9);
    this.ch = new BroadcastChannel('rr-mock'); this.conns = new Map();
    this.ch.onmessage = (ev) => this.recv(ev.data);
    setTimeout(() => this.emit('open', this.id), 30);
  }
  recv(m) {
    if (m.to !== this.id) return;
    if (m.type === 'connect') { const c = new FakeConn(this, m.from); this.conns.set(m.from, c); this.emit('connection', c); setTimeout(() => { c.open = true; c.emit('open'); this.ch.postMessage({ to: m.from, from: this.id, type: 'accept' }); }, 20); }
    else if (m.type === 'accept') { const c = this.conns.get(m.from); if (c) { c.open = true; c.emit('open'); } }
    else if (m.type === 'data') { const c = this.conns.get(m.from); if (c) setTimeout(() => c.emit('data', m.d), MOCK_LAG); }
    else if (m.type === 'close') { const c = this.conns.get(m.from); if (c) { c.open = false; c.emit('close'); this.conns.delete(m.from); } }
  }
  connect(id) { const c = new FakeConn(this, id); this.conns.set(id, c); this.ch.postMessage({ to: id, from: this.id, type: 'connect' }); return c; }
  reconnect() {}
  destroy() { for (const c of this.conns.values()) c.close(); this.ch.close(); }
}
const MOCK_LAG = MOCK ? (Number(new URLSearchParams(location.search).get('lag')) || 40) : 0;
const PeerImpl = MOCK ? FakePeer : Peer;

function makeCode() { let s = ''; for (let i = 0; i < 5; i++) s += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]; return s; }
const PEER_OPTS = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };

const ERR_KO = {
  'peer-unavailable': '방을 찾을 수 없어요. 코드를 다시 확인해 주세요.',
  'network': '연결 서버에 접속할 수 없어요. 인터넷 연결을 확인해 주세요.',
  'server-error': '연결 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.',
  'socket-error': '연결 서버와의 연결이 끊겼어요.',
  'socket-closed': '연결 서버와의 연결이 끊겼어요.',
  'browser-incompatible': '이 브라우저는 온라인 대전을 지원하지 않아요.',
  'webrtc': 'P2P 연결에 실패했어요. 다른 네트워크(와이파이/데이터)로 시도해 보세요.',
};
export const errText = (e) => ERR_KO[e?.type] || ('연결 오류: ' + (e?.type || e?.message || e));

// ── 방장 ──
export class Host {
  constructor(handlers) {
    this.h = handlers; this.conns = new Map(); // peerId -> {conn, pid}
    this.code = null; this.peer = null; this.closed = false;
  }
  open(tries = 0) {
    return new Promise((resolve, reject) => {
      const code = makeCode();
      const peer = new PeerImpl(PREFIX + code, PEER_OPTS);
      let done = false;
      peer.on('open', () => { done = true; this.peer = peer; this.code = code; resolve(code); });
      peer.on('error', (e) => {
        if (!done) {
          peer.destroy();
          if (e.type === 'unavailable-id' && tries < 4) this.open(tries + 1).then(resolve, reject);
          else reject(e);
          return;
        }
        if (this.h.onError) this.h.onError(e);
      });
      peer.on('connection', (conn) => this.accept(conn));
      peer.on('disconnected', () => { if (!this.closed) try { peer.reconnect(); } catch (e) { /* 무시 */ } });
      setTimeout(() => { if (!done) { done = true; peer.destroy(); reject({ type: 'network' }); } }, 12000);
    });
  }
  accept(conn) {
    conn.on('open', () => { this.conns.set(conn.peer, { conn, pid: null }); });
    conn.on('data', (d) => {
      const c = this.conns.get(conn.peer); if (!c || !d || typeof d !== 'object') return;
      this.h.onData(c, d);
    });
    const gone = () => { const c = this.conns.get(conn.peer); if (c) { this.conns.delete(conn.peer); this.h.onLeave(c); } };
    conn.on('close', gone); conn.on('error', gone);
  }
  send(c, msg) { try { if (c.conn.open) c.conn.send(msg); } catch (e) { /* 무시 */ } }
  broadcast(msg, except) { for (const c of this.conns.values()) if (c.pid !== null && c !== except) this.send(c, msg); }
  kick(c, reason) { this.send(c, { t: 'bye', reason }); setTimeout(() => { try { c.conn.close(); } catch (e) { /* 무시 */ } }, 200); }
  close() { this.closed = true; for (const c of this.conns.values()) this.send(c, { t: 'bye', reason: '방장이 방을 닫았어요.' }); setTimeout(() => { try { this.peer && this.peer.destroy(); } catch (e) { /* 무시 */ } }, 250); }
}

// ── 참가자 ──
export class Client {
  constructor(handlers) { this.h = handlers; this.peer = null; this.conn = null; this.closed = false; }
  connect(code) {
    return new Promise((resolve, reject) => {
      const peer = new PeerImpl(PEER_OPTS);
      this.peer = peer; let done = false;
      const fail = (e) => { if (done) return; done = true; try { peer.destroy(); } catch (x) { /* 무시 */ } reject(e); };
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
        this.conn = conn;
        conn.on('open', () => { if (done) return; done = true; resolve(); });
        conn.on('data', (d) => { if (d && typeof d === 'object') this.h.onData(d); });
        conn.on('close', () => { if (!this.closed) this.h.onClose('방장과의 연결이 끊어졌어요.'); });
        conn.on('error', () => { if (!this.closed) this.h.onClose('연결 오류가 발생했어요.'); });
      });
      peer.on('error', (e) => { if (!done) fail(e); else if (!this.closed && e.type !== 'peer-unavailable') this.h.onClose(errText(e)); });
      setTimeout(() => fail({ type: 'peer-unavailable' }), 12000);
    });
  }
  send(msg) { try { if (this.conn && this.conn.open) this.conn.send(msg); } catch (e) { /* 무시 */ } }
  close() { this.closed = true; try { this.conn && this.conn.close(); } catch (e) { /* 무시 */ } setTimeout(() => { try { this.peer && this.peer.destroy(); } catch (e) { /* 무시 */ } }, 100); }
}
