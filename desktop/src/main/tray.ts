// System tray. Created once per app run (a second instance focuses this one
// instead of making another icon). Some Linux desktops have no tray at all;
// then create() returns null and the app works as a plain window — closing
// it quits instead of hiding into a tray nobody can see.

import { Menu, Tray, type NativeImage } from 'electron';
import type { MessageKey, Translate } from '../shared/i18n';
import type { PageId } from '../shared/ipc';
import type { BackendState } from '../shared/types';

export interface TrayActions {
  show(page?: PageId): void;
  start(): void;
  stop(): void;
  openDashboard(): void;
  quit(): void;
}

export function trayStatusLabel(state: BackendState, t: Translate): string {
  const phase = t(`phase.${state.phase}` as MessageKey);
  if (state.phase !== 'running') return t('tray.status', { phase });
  return t('tray.statusRunning', { phase, who: t(state.ownership === 'owned' ? 'tray.startedHere' : 'tray.external') });
}

export class AppTray {
  private constructor(private readonly tray: Tray, private readonly actions: TrayActions, private readonly t: () => Translate) {
    tray.setToolTip('TeamClaude Desktop');
    // Linux trays usually ignore click; Windows opens the window on click.
    tray.on('click', () => actions.show());
  }

  static create(icon: NativeImage, actions: TrayActions, t: () => Translate): AppTray | null {
    try {
      return new AppTray(new Tray(icon), actions, t);
    } catch {
      return null;
    }
  }

  update(state: BackendState): void {
    const t = this.t();
    const running = state.phase === 'running';
    const busy = state.phase === 'starting' || state.phase === 'stopping';
    const canStop = running && state.ownership === 'owned';
    const status = trayStatusLabel(state, t);
    this.tray.setToolTip(`TeamClaude — ${status}`);
    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: t('tray.open'), click: () => this.actions.show() },
      { label: status, enabled: false },
      { type: 'separator' },
      { label: t('tray.start'), enabled: !running && !busy, click: () => this.actions.start() },
      { label: t('tray.stop'), enabled: canStop && !busy, click: () => this.actions.stop() },
      { label: t('tray.dashboard'), enabled: running, click: () => this.actions.openDashboard() },
      { label: t('tray.logs'), click: () => this.actions.show('logs') },
      { label: t('tray.settings'), click: () => this.actions.show('settings') },
      { type: 'separator' },
      { label: t('tray.quit'), click: () => this.actions.quit() },
    ]));
  }

  destroy(): void {
    this.tray.destroy();
  }
}
