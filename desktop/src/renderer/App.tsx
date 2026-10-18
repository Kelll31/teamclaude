import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { PageId } from '../shared/ipc';
import { BackendBanner } from './components/BackendBanner';
import { Sidebar } from './components/Sidebar';
import { Banner, cx } from './components/ui';
import { t } from './i18n';
import { About } from './pages/About';
import { Accounts } from './pages/Accounts';
import { Activity } from './pages/Activity';
import { Integrations } from './pages/Integrations';
import { Logs } from './pages/Logs';
import { Overview } from './pages/Overview';
import { Routing } from './pages/Routing';
import { Sessions } from './pages/Sessions';
import { Settings } from './pages/Settings';
import { StoreProvider, useStore } from './store';

const PAGES: Record<PageId, () => ReactNode> = {
  overview: Overview,
  accounts: Accounts,
  sessions: Sessions,
  activity: Activity,
  routing: Routing,
  integrations: Integrations,
  settings: Settings,
  logs: Logs,
  about: About,
};

/** A rendering error in one page shows a message instead of a blank window. */
class PageBoundary extends Component<{ page: PageId; children: ReactNode }, { error: string | null }> {
  override state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page render error', error, info.componentStack);
  }
  override componentDidUpdate(prev: { page: PageId }) {
    if (prev.page !== this.props.page && this.state.error) this.setState({ error: null });
  }
  override render() {
    if (this.state.error) return <Banner tone="bad" title={t('app.pageError')}>{this.state.error}</Banner>;
    return this.props.children;
  }
}

function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} className={cx('pointer-events-auto rounded-md border px-3 py-2 text-[13px] shadow-lg', toast.ok ? 'border-ok/40 bg-panel text-fg' : 'border-bad/40 bg-panel text-bad')}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function Shell() {
  const { backend, page, loadError } = useStore();
  const Page = PAGES[page];
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 p-6 max-[700px]:p-3">
          {loadError && <Banner tone="bad" title={t('app.loadError')}>{loadError}</Banner>}
          {!backend && !loadError && <div className="text-muted">{t('app.loading')}</div>}
          {backend && <BackendBanner state={backend} />}
          {backend && <div className="flex-1"><PageBoundary page={page}><Page /></PageBoundary></div>}
        </div>
      </main>
      <Toasts />
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
