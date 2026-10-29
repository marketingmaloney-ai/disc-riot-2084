/**
 * Connection to the room relay (server/ in this repo, a Cloudflare Worker). The relay only forwards
 * messages between the two players in a room; the match itself runs on both phones (rollback.ts).
 */

/** Where the relay lives: VITE_NET_URL at build time, or a local `wrangler dev`. The `?net=` override
 *  works in dev builds only: in a public build a link could otherwise point the game at anyone's server. */
export function relayUrl(): string {
  const q = import.meta.env.DEV ? new URLSearchParams(location.search).get('net') : null;
  if (q) return q;
  const env = import.meta.env.VITE_NET_URL as string | undefined;
  if (env) return env;
  return import.meta.env.DEV ? `ws://${location.hostname}:8787` : '';
}

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I / O: easy to read out loud
export const newRoomCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Msg = { t: string; [k: string]: any };

export class RoomLink {
  idx: 0 | 1 = 0;
  peer = false;
  closed = false;
  onMessage: (m: Msg) => void = () => {};
  onPeer: () => void = () => {};
  onLeft: () => void = () => {};
  private ws: WebSocket;

  private constructor(ws: WebSocket) {
    this.ws = ws;
  }

  /** Join room `code`; resolves once seated (or rejects: room full, no connection). */
  static join(code: string): Promise<RoomLink> {
    return new Promise((resolve, reject) => {
      const base = relayUrl().replace(/^http/, 'ws').replace(/\/$/, '');
      if (!base) { reject(new Error('ONLINE PLAY IS NOT SET UP IN THIS BUILD')); return; }
      let ws: WebSocket;
      try { ws = new WebSocket(`${base}/room/${code}`); } catch { reject(new Error("COULDN'T REACH THE GAME SERVER")); return; }
      const link = new RoomLink(ws);
      let seated = false;
      const timer = window.setTimeout(() => { if (!seated) { ws.close(); reject(new Error("COULDN'T REACH THE GAME SERVER")); } }, 8000);
      ws.onmessage = (e) => {
        let m: Msg;
        try { m = JSON.parse(String(e.data)); } catch { return; }
        if (m.t === 'hello') { seated = true; window.clearTimeout(timer); link.idx = m.idx; resolve(link); }
        else if (m.t === 'full') { window.clearTimeout(timer); reject(new Error('THAT ROOM ALREADY HAS TWO PLAYERS')); }
        else if (m.t === 'peer') { link.peer = true; link.onPeer(); }
        else if (m.t === 'left') { link.peer = false; link.onLeft(); }
        else link.onMessage(m);
      };
      ws.onerror = () => { if (!seated) { window.clearTimeout(timer); reject(new Error("COULDN'T REACH THE GAME SERVER")); } };
      ws.onclose = () => {
        const was = !link.closed;
        link.closed = true;
        if (seated && was) link.onLeft();
      };
    });
  }

  send(m: Msg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  close() {
    this.closed = true;
    try { this.ws.close(); } catch { /* already closed */ }
  }
}
