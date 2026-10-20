// The activity timeline and the overview chart's samples. The main process
// keeps them (ActivityLog) for as long as the app runs, so a window that is
// reloaded, or only opened from the tray hours later, still shows what
// happened. Each entry records a difference between two real status readings;
// nothing is invented. Entries hold raw values (phases, reason codes, names),
// and the renderer words them, so a language switch rewords old entries too.

import type { BackendState } from './types';

export const MAX_ACTIVITY = 500;
export const MAX_SAMPLES = 180;

export type ActivityDetail =
  | { type: 'phase'; from: string; to: string; error: string | null }
  | { type: 'switch'; from: string | null; to: string | null }
  | { type: 'appeared' }
  | { type: 'removed' }
  | { type: 'availability'; from: string | null; to: string | null }
  | { type: 'error'; code: string; detail: string };

export interface ActivityEvent {
  id: number;
  at: number;
  kind: 'phase' | 'switch' | 'account' | 'error';
  provider: string | null;
  account: string | null;
  detail: ActivityDetail;
}

export interface Sample {
  at: number;
  activeSessions: number;
  requests: number | null;
}

/** Newest event first; samples oldest first. */
export interface History {
  activity: ActivityEvent[];
  samples: Sample[];
}

/** What one status reading added. */
export interface HistoryDelta {
  events: ActivityEvent[];
  sample: Sample | null;
}

type NewEvent = Omit<ActivityEvent, 'id' | 'at'>;

export function diffActivity(prev: BackendState | null, next: BackendState): NewEvent[] {
  const events: NewEvent[] = [];
  const push = (kind: ActivityEvent['kind'], detail: ActivityDetail, provider: string | null = null, account: string | null = null) =>
    events.push({ kind, provider, account, detail });
  if (!prev) return events;
  if (prev.phase !== next.phase) {
    const failed = next.phase === 'error' || next.phase === 'crash-loop';
    push(failed ? 'error' : 'phase', { type: 'phase', from: prev.phase, to: next.phase, error: next.lastError?.split('\n')[0] ?? null });
  }
  const before = prev.status;
  const after = next.status;
  if (!before || !after) return events;
  for (const [provider, name] of Object.entries(after.currentAccounts)) {
    const was = before.currentAccounts[provider] ?? null;
    if (was !== name) push('switch', { type: 'switch', from: was, to: name }, provider, name);
  }
  const old = new Map(before.accounts.map(a => [`${a.provider}\u0000${a.name}`, a]));
  for (const a of after.accounts) {
    const was = old.get(`${a.provider}\u0000${a.name}`);
    if (!was) {
      push('account', { type: 'appeared' }, a.provider, a.name);
      continue;
    }
    if (was.unavailable !== a.unavailable) {
      push(a.unavailable === 'error' ? 'error' : 'account', { type: 'availability', from: was.unavailable, to: a.unavailable }, a.provider, a.name);
    }
    if (a.error && a.error.code !== was.error?.code) push('error', { type: 'error', code: a.error.code, detail: a.error.detail }, a.provider, a.name);
  }
  for (const a of before.accounts) {
    if (!after.accounts.some(b => b.provider === a.provider && b.name === a.name)) push('account', { type: 'removed' }, a.provider, a.name);
  }
  return events;
}

export function sampleOf(state: BackendState, at: number): Sample | null {
  const status = state.status;
  if (!status) return null;
  const counts = status.accounts.map(a => a.totalRequests).filter((n): n is number => n !== null);
  return { at, activeSessions: status.sessions.active, requests: counts.length ? counts.reduce((x, y) => x + y, 0) : null };
}

/** Adds a delta to a history, newest event first, within the limits. */
export function appendHistory(history: History, delta: HistoryDelta): History {
  if (!delta.events.length && !delta.sample) return history;
  return {
    activity: delta.events.length ? [...delta.events.toReversed(), ...history.activity].slice(0, MAX_ACTIVITY) : history.activity,
    samples: delta.sample ? [...history.samples, delta.sample].slice(-MAX_SAMPLES) : history.samples,
  };
}

/**
 * The part of a delta newer than what `history` already holds. A delta can
 * arrive while the initial history is in flight and then be in both.
 */
export function freshPart(history: History, delta: HistoryDelta): HistoryDelta {
  const lastId = history.activity[0]?.id ?? 0;
  const lastAt = history.samples.at(-1)?.at ?? -Infinity;
  return { events: delta.events.filter(e => e.id > lastId), sample: delta.sample && delta.sample.at > lastAt ? delta.sample : null };
}

/** A snapshot from the main process plus whatever newer the renderer already holds. */
export function mergeSnapshot(snapshot: History, held: History): History {
  const lastId = snapshot.activity[0]?.id ?? 0;
  const lastAt = snapshot.samples.at(-1)?.at ?? -Infinity;
  return {
    activity: [...held.activity.filter(e => e.id > lastId), ...snapshot.activity].slice(0, MAX_ACTIVITY),
    samples: [...snapshot.samples, ...held.samples.filter(s => s.at > lastAt)].slice(-MAX_SAMPLES),
  };
}

export class ActivityLog {
  private last: BackendState | null = null;
  private seq = 0;
  private data: History = { activity: [], samples: [] };

  constructor(private readonly clock: () => number = Date.now) {}

  /** Records what changed since the previous reading and returns it. */
  observe(state: BackendState): HistoryDelta {
    const at = this.clock();
    const events = diffActivity(this.last, state).map(e => ({ ...e, id: ++this.seq, at }));
    const sample = state.statusAt !== this.last?.statusAt ? sampleOf(state, at) : null;
    this.last = state;
    const delta = { events, sample };
    this.data = appendHistory(this.data, delta);
    return delta;
  }

  history(): History {
    return this.data;
  }
}
