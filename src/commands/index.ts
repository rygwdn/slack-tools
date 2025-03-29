import { Command } from 'commander';
import { registerClearCommand } from './clear';
import { registerPrintCommand } from './print';
import { registerStatusCommand } from './status';
import { registerTestCommand } from './test';
import { registerMyMessagesCommand } from './my-messages';
import { registerSearchCommand } from './search';
import { registerMcpCommand } from './mcp';
import { CommandContext } from '../context';

export function registerCommands(program: Command, context: CommandContext): void {
  registerClearCommand(program);
  registerPrintCommand(program, context);
  registerStatusCommand(program, context);
  registerTestCommand(program, context);
  registerMyMessagesCommand(program, context);
  registerSearchCommand(program, context);
  registerMcpCommand(program, context);
}
