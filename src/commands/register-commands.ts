import { Command } from 'commander';
import { registerClearCommand } from './clear';
import { registerPrintCommand } from './print';
// import { registerStatusCommand } from './status';
import { registerTestCommand } from './test';
// import { registerMyMessagesCommand } from './my-messages';
// import { registerSearchCommand } from './search';
import { registerMcpCommand } from './mcp';
// import { registerReminderCommand } from './reminder';
// import { registerThreadCommand } from './thread';
// import { registerUserActivityCommand } from './user-activity';
// import { registerCallToolCommand } from './call-tool';

export function registerCommands(program: Command): void {
  registerClearCommand(program);
  registerPrintCommand(program);
  registerTestCommand(program);

  // registerStatusCommand(program, context);
  // // registerMyMessagesCommand(program, context);
  // registerSearchCommand(program, context);
  registerMcpCommand(program);
  // registerReminderCommand(program, context);
  // registerThreadCommand(program, context);
  // registerUserActivityCommand(program, context);
  // registerCallToolCommand(program, context);
}
