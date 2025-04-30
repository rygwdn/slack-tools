import { Command } from 'commander';
import { FastMCP } from 'fastmcp';
import { ZodObject, ZodTypeAny } from 'zod';
import { SlackContext } from '../context';
import { mcp_tools } from './mcp-tools/tools-registry';
import { ZodError } from 'zod';

// Helper function to format Zod schema parameters
function formatSchemaParameters(schema: ZodTypeAny): string {
  if (schema instanceof ZodObject) {
    const shape = schema.shape as Record<string, ZodTypeAny>;
    const params = Object.entries(shape).map(([key, value]) => {
      const description = value.description ? ` (${value.description})` : '';
      const type = value.constructor.name.replace('Zod', ''); // Get basic type like String, Number, Optional
      const isOptional = value.isOptional();
      return `    - ${key}${isOptional ? '?' : ''}: ${type}${description}`;
    });
    if (params.length === 0) {
      return '  (No parameters)';
    }
    return `  Parameters:
${params.join('\n')}`;
  }
  // Handle non-object schemas if necessary, though unlikely for our tools
  return '  (Parameters schema is not an object)';
}

export function registerCallToolCommand(program: Command, context: SlackContext): void {
  program
    .command('call-tool')
    .description('Directly call an MCP tool by name with JSON arguments, or list available tools.')
    // Make tool-name optional
    .argument('[tool-name]', 'Optional name of the MCP tool to call (e.g., slack_get_status)')
    .option(
      '--args <json_string>',
      'JSON string containing the arguments for the tool (if calling a specific tool)',
      '{}', // Default to empty JSON object
    )
    .action(async (toolName: string | undefined, options: { args: string }) => {
      context.log.debug(
        `call-tool invoked. Tool name: ${toolName ?? 'None provided'}, Args option: ${options.args}`,
      );

      // Instantiate temporary server for execution context
      const packageVersion =
        (process.env.npm_package_version as `${number}.${number}.${number}`) || '1.0.0';
      const tempServer = new FastMCP({
        name: 'temp-tool-runner',
        version: packageVersion,
      });

      // Create a map of tools by name for easier lookup
      const toolMap = new Map<string, any>();
      for (const tool of mcp_tools) {
        toolMap.set(tool.name, tool);
      }

      context.log.debug(`Loaded ${toolMap.size} tools from registry.`);

      // === List Tools Logic ===
      if (!toolName) {
        console.log('Available MCP Tools:\n');
        if (toolMap.size === 0) {
          console.log('No tools found.');
          return; // Exit if no tools registered
        }
        const sortedToolNames = Array.from(toolMap.keys()).sort();
        sortedToolNames.forEach((name) => {
          const tool = toolMap.get(name)!; // Non-null assertion ok due to check above
          console.log(`Tool: ${tool.name}`);
          console.log(`  Description: ${tool.description || 'No description provided.'}`);
          console.log(formatSchemaParameters(tool.parameters));
          console.log('---');
        });
        return; // Exit after listing
      }

      // === Call Specific Tool Logic ===
      context.log.debug(`Proceeding to call specific tool: ${toolName}`);
      const tool = toolMap.get(toolName);

      if (!tool) {
        console.error(`Error: Tool "${toolName}" not found.`);
        console.error(`Available tools: ${Array.from(toolMap.keys()).sort().join(', ')}`);
        process.exit(1);
      }

      context.log.debug(`Found tool definition for "${toolName}"`);

      let parsedArgs: any;
      try {
        parsedArgs = JSON.parse(options.args);
        context.log.debug(`Parsed arguments: ${JSON.stringify(parsedArgs)}`);
      } catch (e) {
        console.error(
          `Error: Invalid JSON provided for --args: ${e instanceof Error ? e.message : String(e)}`,
        );
        console.error(`Please provide a valid JSON string, e.g., '{"text":"hello"}'`);
        process.exit(1);
      }

      const schema = tool.parameters;
      const validationResult = schema.safeParse(parsedArgs);

      if (!validationResult.success) {
        console.error(`Error: Invalid arguments for tool "${toolName}":`);
        validationResult.error.errors.forEach((err: ZodError['errors'][number]) => {
          console.error(`  - Argument '${err.path.join('.')}': ${err.message}`);
        });
        console.error(`Provided args: ${options.args}`);
        process.exit(1);
      }

      context.log.debug(`Arguments validated successfully for tool "${toolName}".`);
      const validatedArgs = validationResult.data;

      try {
        context.log.debug(`Executing tool "${toolName}"...`);
        // Pass context properties directly in the session
        const result = await tool.execute(validatedArgs, {
          server: tempServer,
          session: { ...context },
        });
        context.log.debug(`Tool "${toolName}" executed successfully.`);
        console.log(result);
      } catch (error) {
        console.error(
          `Error executing tool "${toolName}": ${error instanceof Error ? error.message : String(error)}`,
        );
        context.log.debug(`Execution error details: ${error}`);
        process.exit(1);
      }
    });
}
