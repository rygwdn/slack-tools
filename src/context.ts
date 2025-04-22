/**
 * CommandContext class to handle workspace validation and retrieval logic
 */
export class CommandContext {
  private _workspace?: string;
  private _lastWorkspaceUsed = false;
  private _debug = false;

  /**
   * Set the workspace value
   */
  set workspace(value: string | undefined) {
    this._workspace = value;
  }

  /**
   * Get the workspace value with validation
   * If the workspace is not set, execute a standard error message and exit
   */
  get workspace(): string {
    if (!this._workspace) {
      console.error('Error: No workspace specified. Please specify a workspace using:');
      console.error('  - Use -w, --workspace <workspace> to specify a workspace directly');
      console.error('  - Use -l, --last-workspace to use your most recently used workspace');
      process.exit(1);
    }
    return this._workspace;
  }

  /**
   * Check if a workspace is set without validation
   */
  get hasWorkspace(): boolean {
    return !!this._workspace;
  }

  /**
   * Set flag indicating last workspace was used
   */
  set lastWorkspaceUsed(value: boolean) {
    this._lastWorkspaceUsed = value;
  }

  /**
   * Get flag indicating if last workspace was used
   */
  get lastWorkspaceUsed(): boolean {
    return this._lastWorkspaceUsed;
  }

  /**
   * Set debug mode flag
   */
  set debug(value: boolean) {
    this._debug = value;
  }

  /**
   * Get debug mode flag
   */
  get debug(): boolean {
    return this._debug;
  }

  /**
   * Log debug message if debug mode is enabled
   * @param message The message or object to log
   * @param ...args Additional arguments to log
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debugLog(message: any, ...args: any[]): void {
    if (this._debug) {
      if (args.length > 0) {
        console.error('[DEBUG]', message, ...args);
      } else {
        console.error('[DEBUG]', message);
      }
    }
  }
}
