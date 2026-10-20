// Output of the CLI jobs the app runs (sign-in, remove, …), sanitized in main.

import { CircleCheck, CircleX, LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { JobView } from '../../shared/types';
import { call } from '../api';
import { t } from '../i18n';
import { useStore } from '../store';
import { Button, Card } from './ui';

function JobRow({ job }: { job: JobView }) {
  const { run } = useStore();
  const out = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (out.current) out.current.scrollTop = out.current.scrollHeight;
  }, [job.output.length]);
  const icon = job.state === 'running'
    ? <LoaderCircle className="size-4 animate-spin text-info" aria-hidden />
    : job.state === 'succeeded' ? <CircleCheck className="size-4 text-ok" aria-hidden /> : <CircleX className="size-4 text-bad" aria-hidden />;
  return (
    <div className="rounded-md border border-border bg-bg">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate text-[13px] text-fg">{job.label}</span>
        </div>
        {job.state === 'running' && (
          <Button variant="ghost" className="px-2 py-0.5" icon={<X className="size-3.5" aria-hidden />} onClick={() => void run(() => call('jobs.cancel', { id: job.id }))}>
            {t('common.cancel')}
          </Button>
        )}
      </div>
      {job.output.length > 0 && (
        <pre ref={out} className="max-h-48 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11.5px] leading-relaxed text-muted">
          {job.output.join('\n')}
        </pre>
      )}
    </div>
  );
}

export function JobPanel({ kinds, limit = 3 }: { kinds?: string[]; limit?: number }) {
  const { jobs } = useStore();
  const shown = jobs.filter(j => !kinds || kinds.includes(j.kind)).slice(-limit).reverse();
  if (shown.length === 0) return null;
  return (
    <Card title={t('jobs.recent')}>
      <div className="space-y-2">{shown.map(job => <JobRow key={job.id} job={job} />)}</div>
    </Card>
  );
}
