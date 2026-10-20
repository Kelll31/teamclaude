import { CircleCheck, CircleX, SquareTerminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { IntegrationInfo } from '../../shared/types';
import { call } from '../api';
import { ActionButton, Badge, Banner, Card, CodeBlock, CopyButton, PageHeader, Rich } from '../components/ui';
import { t } from '../i18n';
import { useStore } from '../store';

const copy = (text: string) => call('system.copyText', { text });

const codexToml = (port: number) => [
  'model_provider = "teamclaude"',
  '',
  '[model_providers.teamclaude]',
  'name = "teamclaude"',
  `base_url = "http://127.0.0.1:${port}/backend-api/codex"`,
  'wire_api = "responses"',
].join('\n');

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string | null }) {
  return (
    <li className="flex items-start gap-2 py-1 text-[13px]">
      {ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> : <CircleX className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />}
      <span className="min-w-0"><span className="text-fg">{label}</span>{detail && <span className="block break-all font-mono text-[11px] text-muted">{detail}</span>}</span>
    </li>
  );
}

const SHELL_LABEL = { posix: 'bash / zsh', powershell: 'PowerShell', cmd: 'cmd.exe' } as const;

export function Integrations() {
  const { backend, run } = useStore();
  const [info, setInfo] = useState<IntegrationInfo | null>(null);
  const phase = backend?.phase;
  useEffect(() => {
    void call('system.integrations').then(setInfo);
  }, [phase]);
  if (!info) return null;
  const isWindows = navigator.userAgent.includes('Windows');
  const shells = isWindows ? (['powershell', 'cmd', 'posix'] as const) : (['posix', 'powershell', 'cmd'] as const);
  const toml = codexToml(backend?.port ?? 3456);

  return (
    <div className="space-y-4">
      <PageHeader title={t('int.title')} subtitle={t('int.subtitle')} />
      <Card title={t('int.check')}>
        <ul>
          <Check ok={info.proxyReady} label={t(info.proxyReady ? 'int.proxyOk' : 'int.proxyNo', { endpoint: info.endpoint })} />
          <Check ok={info.claude.found} label={t(info.claude.found ? 'int.claudeOk' : 'int.claudeNo')} detail={info.claude.path} />
          <Check ok={info.codex.found} label={t(info.codex.found ? 'int.codexOk' : 'int.codexNo')} detail={info.codex.path} />
        </ul>
      </Card>
      <Card title={t('int.terminalTitle')} actions={<ActionButton icon={<SquareTerminal className="size-3.5" aria-hidden />} onAction={() => run(() => call('system.openTerminal'))}>{t('int.openTerminal')}</ActionButton>}>
        <p className="mb-3 text-[12px] text-muted"><Rich text={t('int.terminalBody')} /></p>
        <div className="space-y-2">
          {shells.map(shell => (
            <div key={shell}>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted">{SHELL_LABEL[shell]}</div>
              <CodeBlock actions={<CopyButton text={info.env[shell]} onCopy={copy} />}>{info.env[shell]}</CodeBlock>
            </div>
          ))}
        </div>
      </Card>
      <Card title={t('int.codexTitle')}>
        <p className="mb-3 text-[12px] text-muted"><Rich text={t('int.codexBody')} /></p>
        <CodeBlock actions={<CopyButton text={toml} onCopy={copy} />}>{toml}</CodeBlock>
      </Card>
      <Card title={<span className="flex items-center gap-2">VS Code <Badge tone="warn">{t('int.vscodeBadge')}</Badge></span>}>
        <Banner tone="info" title={t('int.vscodeBannerTitle')}>{t('int.vscodeBannerBody')}</Banner>
        <div className="mt-3"><CodeBlock actions={<CopyButton text={info.vscodeSettingsSnippet} onCopy={copy} />}>{info.vscodeSettingsSnippet}</CodeBlock></div>
        <p className="mt-2 text-[12px] text-muted"><Rich text={t('int.vscodeNote')} /></p>
      </Card>
    </div>
  );
}
