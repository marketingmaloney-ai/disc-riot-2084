/**
 * DISC RIOT 2084 online relay: one Durable Object per 4-letter room code, two players max.
 * It only forwards each player's messages to the other one; the game itself runs on the phones
 * (rollback netcode, see src/net/rollback.ts in the game). Runs on Cloudflare's free plan.
 *
 *   GET /room/ABCD  (WebSocket upgrade)  ->  {"t":"hello","idx":0|1}  then  {"t":"peer"} once both are in
 *                                            {"t":"left"} if the other player disconnects
 *                                            {"t":"full"} and close if two players are already in
 */
import { DurableObject } from 'cloudflare:workers';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
}

const CODE = /^[A-Z]{4}$/;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/room\/([A-Za-z]{4})$/);
    if (!m) return new Response('DISC RIOT 2084 relay', { status: url.pathname === '/' ? 200 : 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected a WebSocket', { status: 426 });
    const code = m[1].toUpperCase();
    if (!CODE.test(code)) return new Response('bad room code', { status: 400 });
    return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(req);
  },
};

export class Room extends DurableObject<Env> {
  async fetch(_req: Request): Promise<Response> {
    const taken = new Set(this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment() as number).filter((i) => i >= 0));
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const idx = !taken.has(0) ? 0 : !taken.has(1) ? 1 : -1;
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(idx);
    if (idx < 0) {
      server.send(JSON.stringify({ t: 'full' }));
      server.close(4000, 'room full');
      return new Response(null, { status: 101, webSocket: client });
    }
    server.send(JSON.stringify({ t: 'hello', idx }));
    if (taken.size === 1) for (const ws of [server, ...this.others(server)]) ws.send(JSON.stringify({ t: 'peer' }));
    return new Response(null, { status: 101, webSocket: client });
  }

  /** The two seated players (a turned-away third socket has idx -1 until it closes). */
  private others(ws: WebSocket) {
    return this.ctx.getWebSockets().filter((o) => o !== ws && (o.deserializeAttachment() as number) >= 0);
  }

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    if (typeof msg !== 'string' || msg.length > 16384 || (ws.deserializeAttachment() as number) < 0) return;
    for (const other of this.others(ws)) other.send(msg);
  }

  async webSocketClose(ws: WebSocket) {
    if ((ws.deserializeAttachment() as number) >= 0) for (const other of this.others(ws)) other.send(JSON.stringify({ t: 'left' }));
    try { ws.close(); } catch { /* already closed */ }
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }
}
