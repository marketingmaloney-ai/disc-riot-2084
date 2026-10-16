import { describe, expect, it } from 'vitest';
import { CpuPlayer, DIFFICULTIES } from '../ai/cpu';
import { createGame, step } from '../sim/game';
import type { GameState, InputFrame } from '../sim/types';
import { hashState, pack, RollbackSession, unpack, type NetMsg } from './rollback';

/** Two peers over an in-order link (like a WebSocket) with latency and jitter, each driven by a CPU. */
function play(opts: { latency: number; jitter: number; frames: number; corruptGuest?: boolean }) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const queues: { at: number; m: NetMsg }[][] = [[], []]; // messages in flight TO peer i
  let now = 0;
  const sendTo = (i: number) => (m: NetMsg) => {
    const q = queues[i];
    const at = Math.max(now + opts.latency + Math.floor(rnd() * (opts.jitter + 1)), q.length ? q[q.length - 1].at : 0);
    q.push({ at, m: JSON.parse(JSON.stringify(m)) });
  };
  const peers = [0, 1].map((i) => new RollbackSession(createGame('kaito', 'diesel'), i as 0 | 1, sendTo(1 - i), 2, 10));
  const cpus = [new CpuPlayer(0, DIFFICULTIES.hard, 3), new CpuPlayer(1, DIFFICULTIES.hard, 9)];
  const sent: number[][] = [[], []]; // what each peer actually played, by frame
  const deliver = () => {
    for (let i = 0; i < 2; i++) while (queues[i].length && queues[i][0].at <= now) peers[i].receive(queues[i].shift()!.m);
  };
  for (; now < opts.frames * 3 && Math.min(peers[0].frame, peers[1].frame) < opts.frames; now++) {
    deliver();
    for (let i = 0; i < 2; i++) {
      if (peers[i].frame >= opts.frames) continue;
      peers[i].tick(() => {
        const inp = cpus[i].think(peers[i].game);
        sent[i][peers[i].frame + peers[i].delay] = pack(inp);
        return inp;
      });
    }
    if (opts.corruptGuest && now === 200) peers[1].game.players[0].x += 0.01; // stand-in for float drift
  }
  for (let k = 0; k < 200; k++, now++) deliver(); // drain the link
  return { peers, sent };
}

function replay(sent: number[][], frames: number): GameState {
  const g = createGame('kaito', 'diesel');
  const at = (i: number, f: number) => (sent[i][f] === undefined ? { mx: 0, mz: 0, a: false, b: false } : unpack(sent[i][f]));
  for (let f = 0; f < frames; f++) step(g, [at(0, f), at(1, f)] as [InputFrame, InputFrame]);
  return g;
}

describe('rollback netcode', () => {
  it('two peers over a laggy link end in the identical state, equal to an offline replay', () => {
    const frames = 1500;
    const { peers, sent } = play({ latency: 6, jitter: 4, frames });
    expect(peers[0].frame).toBe(frames);
    expect(peers[1].frame).toBe(frames);
    const ref = hashState(replay(sent, frames));
    expect(hashState(peers[0].game)).toBe(ref);
    expect(hashState(peers[1].game)).toBe(ref);
    expect(peers[0].rollbacks + peers[1].rollbacks).toBeGreaterThan(0); // it really had to correct guesses
    expect(peers[0].desyncs + peers[1].desyncs).toBe(0);
  });

  it('the guest snaps back to the host after drifting', () => {
    const frames = 600;
    const { peers, sent } = play({ latency: 3, jitter: 2, frames, corruptGuest: true });
    expect(peers[1].desyncs).toBeGreaterThan(0);
    const ref = hashState(replay(sent, frames));
    expect(hashState(peers[0].game)).toBe(ref);
    expect(hashState(peers[1].game)).toBe(ref);
  });
});
