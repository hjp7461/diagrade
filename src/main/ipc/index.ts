import { registerDialogIpc } from './dialog';
import { registerFsIpc } from './fs';
import { registerConfigIpc } from './config';
import { registerProtocolIpc } from './protocol';
import { registerPrintIpc } from './print';
import type { ConfigStore } from '../config';

export function registerAllIpc(store: ConfigStore): void {
  registerDialogIpc();
  registerFsIpc();
  registerConfigIpc(store);
  registerProtocolIpc();
  registerPrintIpc();
}
