import { ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SystemInfo, UpdateCheckResult } from '../../shared/types';
import { call } from '../api';
import { ActionButton, Banner, Button, Card, PageHeader } from '../components/ui';
import { phaseText, unknown } from '../format';
import { t } from '../i18n';
import { useStore } from '../store';

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-all text-right text-fg">{value ?? unknown()}</dd>
    </div>
  );
}

type Link = 'repository' | 'issues' | 'docs' | 'releases' | 'license';

/** One line for the bundled backend and one for an attached external one. */
function UpdateVerdicts({ update, onNotes }: { update: UpdateCheckResult; onNotes: () => void }) {
  if (update.error) return <p className="mt-2 text-[12px] text-bad">{t('about.checkFailed', { error: update.error })}</p>;
  const latest = update.latest ?? '';
  const lines: Array<{ key: string; text: string; old: boolean }> = [];
  if (update.bundled) {
    const { current, updateAvailable } = update.bundled;
    lines.push({ key: 'bundled', old: updateAvailable, text: updateAvailable ? t('about.bundledOld', { current, latest }) : t('about.bundledCurrent', { current }) });
  }
  if (update.external) {
    const { current, updateAvailable } = update.external;
    lines.push({ key: 'external', old: updateAvailable, text: updateAvailable ? t('about.externalOld', { current, latest }) : t('about.externalCurrent', { current }) });
  }
  if (!lines.length) lines.push({ key: 'none', old: false, text: t('about.latestOnly', { latest }) });
  return (
    <div className="mt-2 space-y-1 text-[12px] text-fg">
      {lines.map(line => <p key={line.key}>{line.text}</p>)}
      {lines.some(line => line.old) && <Button variant="ghost" onClick={onNotes}>{t('about.notes')}</Button>}
    </div>
  );
}

export function About() {
  const { backend, run } = useStore();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null);
  const phase = backend?.phase;
  useEffect(() => {
    void call('system.info').then(setInfo);
  }, [phase]);
  const open = (target: Link) => () => run(() => call('system.openExternal', { target }));

  return (
    <div className="space-y-4">
      <PageHeader title={t('about.title')} />
      <Banner tone="info" title={t('about.communityTitle')}>{t('about.communityBody')}</Banner>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
        <Card title={t('about.versions')}>
          {info && (
            <dl className="divide-y divide-border">
              <Row label={t('about.desktop')} value={info.desktopVersion} />
              <Row label={t('about.bundled')} value={info.bundledBackendVersion} />
              <Row label={t('about.running')} value={info.backendVersion} />
              <Row label="Electron" value={info.electronVersion} />
              <Row label={t('about.node')} value={info.nodeVersion} />
              <Row label={t('about.os')} value={`${info.os} (${info.arch})`} />
              <Row label={t('about.proxy')} value={phaseText(info.proxyPhase)} />
              <Row label={t('about.lastError')} value={info.lastError?.split('\n')[0] ?? t('common.none')} />
              <Row label={t('about.configDir')} value={info.configDir} />
              <Row label={t('about.appData')} value={info.userDataDir} />
            </dl>
          )}
        </Card>
        <Card title={t('about.project')}>
          <p className="text-[13px] text-muted">{t('about.projectBody')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton icon={<ExternalLink className="size-3.5" aria-hidden />} onAction={open('repository')}>{t('about.repository')}</ActionButton>
            <ActionButton icon={<ExternalLink className="size-3.5" aria-hidden />} onAction={open('docs')}>{t('about.docs')}</ActionButton>
            <ActionButton icon={<ExternalLink className="size-3.5" aria-hidden />} onAction={open('issues')}>{t('about.issue')}</ActionButton>
            <ActionButton icon={<ExternalLink className="size-3.5" aria-hidden />} onAction={open('license')}>{t('about.license')}</ActionButton>
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-[13px] font-medium text-fg">{t('about.updates')}</div>
            <p className="mt-1 text-[12px] text-muted">{t('about.updatesBody')}</p>
            <ActionButton className="mt-2" icon={<RefreshCw className="size-3.5" aria-hidden />} onAction={async () => setUpdate(await call('system.checkForUpdates'))}>{t('about.check')}</ActionButton>
            {update && <UpdateVerdicts update={update} onNotes={() => void open('releases')()} />}
            <p className="mt-2 text-[12px] text-muted">{t('about.desktopChannel')}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
