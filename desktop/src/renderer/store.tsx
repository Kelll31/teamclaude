// Renderer state: the latest BackendState pushed by the main process, the
// settings, log lines, CLI jobs, and two things the renderer derives itself
// from successive snapshots — an activity timeline of observed changes and a
// short series of samples for the overview chart. Nothing here is invented:
// each entry records a difference between two real status readings.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import type { DesktopEvent, PageId } from '../shared/ipc';
import type { ActionResult, BackendState, DesktopSettings, JobView, LogLine } from '../shared/types';
import { bridge, call } from './api';
import { phaseText, unavailableText } from './format';
import { setLanguage, t } from './i18n';

export interface ActivityEvent {
  id: number;
  at: number;
  kind: 'phase' | 'switch' | 'account' | 'error';
  provider: string | null;
  account: string | null;
  text: string;
}

export interface Sample {
  at: number;
  activeSessions: number;
  requests: number | null;
}

interface Data {
  backend: BackendState | null;
  settings: DesktopSettings | null;
  logs: LogLine[];
  jobs: JobView[];
  activity: ActivityEvent[];
  samples: Sample[];
  loadError: string | null;
}

type Action =
  | { type: 'backend'; state: BackendState }
  | { type: 'settings'; settings: DesktopSettings }
  | { type: 'logs'; lines: LogLine[]; replace?: boolean }
  | { type: 'job'; job: JobView }
  | { type: 'jobs'; jobs: JobView[] }
  | { type: 'loadError'; message: string };

const MAX_LOGS = 5000;
const MAX_ACTIVITY = 500;
const MAX_SAMPLES = 180;

let activitySeq = 0;

export function diffActivity(prev: BackendState | null, next: BackendState, at: number): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const push = (kind: ActivityEvent['kind'], text: string, provider: string | null = null, account: string | null = null) =>
    events.push({ id: ++activitySeq, at, kind, provider, account, text });
  if (!prev) return events;
  if (prev.phase !== next.phase) {
    const text = t('ev.phase', { from: phaseText(prev.phase), to: phaseText(next.phase) });
    push(next.phase === 'error' || next.phase === 'crash-loop' ? 'error' : 'phase', next.lastError ? `${text}: ${next.lastError.split('\n')[0]}` : text);
  }
  const before = prev.status;
  const after = next.status;
  if (!before || !after) return events;
  const none = t('overview.none');
  for (const [provider, name] of Object.entries(after.currentAccounts)) {
    const was = before.currentAccounts[provider] ?? null;
    if (was !== name) push('switch', t('ev.switch', { provider, from: was ?? none, to: name ?? none }), provider, name);
  }
  const old = new Map(before.accounts.map(a => [`${a.provider}\u0000${a.name}`, a]));
  for (const a of after.accounts) {
    const was = old.get(`${a.provider}\u0000${a.name}`);
    if (!was) {
      push('account', t('ev.appeared', { name: a.name }), a.provider, a.name);
      continue;
    }
    if (was.unavailable !== a.unavailable) {
      push(a.unavailable === 'error' ? 'error' : 'account',
        t('ev.availability', { name: a.name, from: unavailableText(was.unavailable), to: unavailableText(a.unavailable) }), a.provider, a.name);
    }
    if (a.error && a.error.code !== was.error?.code) push('error', t('ev.error', { name: a.name, code: a.error.code, detail: a.error.detail }), a.provider, a.name);
  }
  for (const a of before.accounts) {
    if (!after.accounts.some(b => b.provider === a.provider && b.name === a.name)) push('account', t('ev.removed', { name: a.name }), a.provider, a.name);
  }
  return events;
}

function sampleOf(state: BackendState, at: number): Sample | null {
  const status = state.status;
  if (!status) return null;
  const counts = status.accounts.map(a => a.totalRequests).filter((n): n is number => n !== null);
  return { at, activeSessions: status.sessions.active, requests: counts.length ? counts.reduce((x, y) => x + y, 0) : null };
}

function reduce(data: Data, action: Action): Data {
  switch (action.type) {
    case 'backend': {
      const at = Date.now();
      const events = diffActivity(data.backend, action.state, at);
      const sample = action.state.statusAt !== data.backend?.statusAt ? sampleOf(action.state, at) : null;
      return {
        ...data,
        backend: action.state,
        activity: events.length ? [...events.toReversed(), ...data.activity].slice(0, MAX_ACTIVITY) : data.activity,
        samples: sample ? [...data.samples, sample].slice(-MAX_SAMPLES) : data.samples,
      };
    }
    case 'settings':
      return { ...data, settings: action.settings };
    case 'logs': {
      const merged = action.replace ? action.lines : [...data.logs, ...action.lines];
      return { ...data, logs: merged.slice(-MAX_LOGS) };
    }
    case 'job': {
      const exists = data.jobs.some(j => j.id === action.job.id);
      return { ...data, jobs: exists ? data.jobs.map(j => (j.id === action.job.id ? action.job : j)) : [...data.jobs, action.job] };
    }
    case 'jobs':
      return { ...data, jobs: action.jobs };
    case 'loadError':
      return { ...data, loadError: action.message };
  }
}

export interface Toast {
  id: number;
  ok: boolean;
  message: string;
}

interface Store extends Data {
  page: PageId;
  setPage: (page: PageId) => void;
  now: number;
  toasts: Toast[];
  toast: (ok: boolean, message: string) => void;
  /** Run an action and toast its outcome; never throws. */
  run: (action: () => Promise<ActionResult>) => Promise<ActionResult>;
  clearLogs: () => void;
}

const StoreContext = createContext<Store | null>(null);

const INITIAL: Data = { backend: null, settings: null, logs: [], jobs: [], activity: [], samples: [], loadError: null };

let toastSeq = 0;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reduce, INITIAL);
  const [page, setPage] = useState<PageId>('overview');
  const [now, setNow] = useState(Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const api = bridge();
    if (!api) {
      dispatch({ type: 'loadError', message: t('app.bridgeMissing') });
      return;
    }
    const off = api.onEvent((event: DesktopEvent) => {
      switch (event.type) {
        case 'backend': dispatch({ type: 'backend', state: event.state }); break;
        case 'log': dispatch({ type: 'logs', lines: event.lines }); break;
        case 'job': dispatch({ type: 'job', job: event.job }); break;
        case 'settings': dispatch({ type: 'settings', settings: event.settings }); break;
        case 'navigate': setPage(event.page); break;
      }
    });
    Promise.all([call('backend.getState'), call('settings.get'), call('logs.get'), call('jobs.list')])
      .then(([state, settings, logs, jobs]) => {
        dispatch({ type: 'backend', state });
        dispatch({ type: 'settings', settings });
        dispatch({ type: 'logs', lines: logs, replace: true });
        dispatch({ type: 'jobs', jobs });
      })
      .catch((err: Error) => dispatch({ type: 'loadError', message: err.message }));
    return off;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Set during render, not in an effect: the pages below read t() in this
  // same render pass, so the switch takes effect without a second render.
  if (data.settings) setLanguage(data.settings.language);

  // Theme follows the settings.
  useEffect(() => {
    const s = data.settings;
    if (!s) return;
    const apply = () => {
      const dark = s.theme === 'dark' || (s.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (s.theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [data.settings]);

  const toast = useCallback((ok: boolean, message: string) => {
    const id = ++toastSeq;
    setToasts(list => [...list.slice(-3), { id, ok, message }]);
    setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), ok ? 3500 : 7000);
  }, []);

  const run = useCallback(async (action: () => Promise<ActionResult>) => {
    try {
      const result = await action();
      toast(result.ok, result.message);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(false, message);
      return { ok: false, message };
    }
  }, [toast]);

  const clearLogs = useCallback(() => {
    void call('logs.clear').then(() => dispatch({ type: 'logs', lines: [], replace: true }));
  }, []);

  const value = useMemo<Store>(() => ({ ...data, page, setPage, now, toasts, toast, run, clearLogs }), [data, page, now, toasts, toast, run, clearLogs]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore outside StoreProvider');
  return store;
}
