export interface SlackContext {
  workspace: string;
  debug: boolean;
  hasWorkspace: boolean;
  log: { debug: (...args: any[]) => void };
}

export const GlobalContext: SlackContext = {
  workspace: '',
  debug: false,
  get hasWorkspace() {
    return this.workspace !== '';
  },
  log: console,
};
