import { registerDialogIpc } from './dialog';
import { registerFsIpc } from './fs';
import { registerConfigIpc } from './config';
import type { ConfigStore } from '../config';

export function registerAllIpc(store: ConfigStore): void {
  registerDialogIpc();
  registerFsIpc();
  registerConfigIpc(store);
}
