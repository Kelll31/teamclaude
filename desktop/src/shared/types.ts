// View models shared by the main process and the renderer. The renderer never
// sees the backend's raw /teamclaude/status payload: services/normalize.ts maps
// it onto these shapes, so a React component never depends on the server's
// internal field names and a field the server drops reads as `null`, not as a
// crash.

/** Lifecycle of the proxy as the desktop app sees it. */
export type ProxyPhase =
  | 'stopped' // nothing answers on the configured port
  | 'starting' // we spawned a backend and wait for it to answer
  | 'running' // a TeamClaude server answers /teamclaude/status
  | 'stopping'
  | 'unreachable' // it answered before, and stopped answering
  | 'port-conflict' // something that is not TeamClaude holds the port
  | 'error' // the backend we spawned exited or never became ready
  | 'crash-loop'; // automatic restart gave up after repeated crashes

/** Who started the server that answers on the port. */
export type Ownership = 'owned' | 'external' | 'none';

export interface QuotaWindow {
  /** 0..1 as reported upstream, or null when no reading exists. */
  utilization: number | null;
  /** Epoch ms of the next reset, or null when unknown. */
  resetAt: number | null;
  /** Epoch ms when upstream last stated this value, or null when unknown. */
  seenAt: number | null;
}

export interface NamedQuotaWindow extends QuotaWindow {
  label: string;
}

export interface AccountErrorView {
  code: string;
  detail: string;
  remedy: string | null;
}

export interface AccountView {
  /** Position in the server's account list (status order). */
  index: number;
  name: string;
  /** 'oauth' | 'apikey' | backend-specific type, as the server names it. */
  type: string;
  /** 'claude' | 'codex' | … — the pool the account belongs to. */
  provider: string;
  orgName: string | null;
  priority: number;
  disabled: boolean;
  /** Server's own state word: 'active' | 'exhausted' | 'error' | … */
  status: string;
  /** Why rotation will not use it right now; null = it can serve. */
  unavailable: string | null;
  error: AccountErrorView | null;
  isCurrent: boolean;
  sessions: number;
  knownSessions: number;
  fiveHour: QuotaWindow;
  weekly: QuotaWindow;
  /** Model-scoped weekly buckets (Sonnet, Fable, …) when the server reports them. */
  modelWindows: NamedQuotaWindow[];
  onExtraUsage: boolean;
  allowExtraUsage: boolean;
  rateLimitedUntil: string | null;
  pausedUntil: string | null;
  credentialRejectedUntil: string | null;
  totalRequests: number | null;
}

export interface SessionView {
  id: string;
  active: boolean;
  inFlight: number;
  requests: number;
  lastSeen: number | null;
  client: string | null;
  conversation: string | null;
  /** Weekly bucket → account name, resolved from the server's index pins. */
  accounts: Record<string, string>;
}

export interface RouteView {
  name: string;
  match: string[];
  provider: string;
  autocreated: boolean;
  pinned: string | null;
  target: string | null;
}

export interface ServerInfo {
  version: string | null;
  pid: number | null;
  port: number | null;
  uptimeSeconds: number | null;
  startedAt: string | null;
  updateAvailable: string | null;
  upstream: string | null;
}

export interface BackgroundJobView {
  enabled: boolean;
  intervalSeconds: number;
}

export interface StatusView {
  server: ServerInfo;
  accounts: AccountView[];
  /** provider → current account name */
  currentAccounts: Record<string, string | null>;
  switchThreshold: number | null;
  perBucketThresholds: boolean;
  sessions: {
    active: number;
    known: number;
    distribution: string | null;
    draining: number;
    starvedMax: number;
    /** null when the server runs without proxy.sessionDetail. */
    items: SessionView[] | null;
  };
  routes: RouteView[];
  probe: BackgroundJobView;
  warm: BackgroundJobView;
  blockedModels: string[];
  /** true when this caller holds a client key and may not change settings. */
  readOnly: boolean;
}

export interface BackendState {
  phase: ProxyPhase;
  ownership: Ownership;
  host: string;
  port: number;
  endpoint: string;
  /** pid of the process we spawned, when we own it. */
  childPid: number | null;
  lastError: string | null;
  restartCount: number;
  /** A `systemd --user` unit for TeamClaude is installed on this machine. */
  serviceInstalled: boolean;
  compatibility: { ok: boolean; message: string | null };
  status: StatusView | null;
  /** Epoch ms of the last successful status read. */
  statusAt: number | null;
  configPath: string;
  configExists: boolean;
}

export type LogStream = 'stdout' | 'stderr' | 'desktop';

export interface LogLine {
  seq: number;
  at: number;
  stream: LogStream;
  text: string;
}

export type Theme = 'dark' | 'light' | 'system';

export interface NotificationPrefs {
  proxyCrashed: boolean;
  authExpired: boolean;
  allUnavailable: boolean;
  quotaExhausted: boolean;
  backendRecovered: boolean;
  updateAvailable: boolean;
}

export interface DesktopSettings {
  theme: Theme;
  language: string;
  launchAtLogin: boolean;
  startProxyOnLaunch: boolean;
  startMinimized: boolean;
  minimizeToTray: boolean;
  keepProxyOnWindowClose: boolean;
  restartOnCrash: boolean;
  notifications: NotificationPrefs;
}

export interface CliToolInfo {
  name: string;
  found: boolean;
  path: string | null;
}

export interface IntegrationInfo {
  endpoint: string;
  proxyReady: boolean;
  claude: CliToolInfo;
  codex: CliToolInfo;
  /** Shell snippets that point a client at the proxy. No secrets. */
  env: { posix: string; powershell: string; cmd: string };
  vscodeSettingsSnippet: string;
}

export interface SystemInfo {
  os: string;
  arch: string;
  desktopVersion: string;
  electronVersion: string;
  nodeVersion: string;
  backendVersion: string | null;
  bundledBackendVersion: string | null;
  proxyPhase: ProxyPhase;
  lastError: string | null;
  configDir: string;
  userDataDir: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** A CLI job the desktop runs on the user's behalf (login, remove, …). */
export interface JobView {
  id: number;
  kind: string;
  label: string;
  state: 'running' | 'succeeded' | 'failed';
  output: string[];
  exitCode: number | null;
}

export interface UpdateCheckResult {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  url: string;
  error: string | null;
}
