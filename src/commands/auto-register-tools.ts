import { Command } from 'commander';
import { Tool } from 'fastmcp';
import { ZodObject, ZodTypeAny, ZodError, ZodRawShape } from 'zod';
import { GlobalContext } from '../context';
import { handleCommandError } from '../utils/auth-error';

function toKebabCase(str: string): string {
  const withoutPrefix = str.replace(/^slack_/, '');

  return withoutPrefix
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function getCommanderOption(key: string, value: ZodTypeAny): string {
  const optionName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
  return value._def.typeName === 'ZodBoolean' ? `--${optionName}` : `--${optionName} <value>`;
}

function allowCoerce(param: ZodTypeAny) {
  let type = param;
  while ('innerType' in type._def) {
    type = type._def.innerType;
  }
  if (type._def.coerce === false) {
    type._def.coerce = true;
  }
}

type CommandOptions = Record<string, string | boolean | number | undefined>;

export function registerToolAsCommand<TObj extends ZodRawShape>(
  program: Command,
  tool: Required<Tool<Record<string, never> | undefined, ZodObject<TObj>>>,
): Command {
  const toolName = tool.name;
  const commandName = toKebabCase(toolName);
  const shape = tool.parameters.shape;

  const command = program.command(commandName).description(tool.description || '');

  Object.entries(shape).forEach(([key, param]) => {
    const option = command.createOption(getCommanderOption(key, param), param.description || '');
    if (param._def.defaultValue) {
      option.defaultValue = param._def.defaultValue();
    } else if (param._def.typeName !== 'ZodOptional') {
      option.required = true;
    }
    command.addOption(option);
  });

  command.action(async (options: CommandOptions) => {
    try {
      await optionAction<TObj>(shape, options, tool, commandName);
    } catch (error) {
      handleCommandError(error, program);
    }
  });

  return command;
}
async function optionAction<TObj extends ZodRawShape>(
  shape: TObj,
  options: CommandOptions,
  tool: Required<Tool<Record<string, never> | undefined, ZodObject<TObj>>>,
  commandName: string,
) {
  const params = Object.fromEntries(
    Object.entries(shape).map(([key, param]) => {
      const optionKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      const value = options[key] || options[optionKey];
      allowCoerce(param);
      return [key, value];
    }),
  );

  const validationResult = tool.parameters.safeParse(params);

  if (!validationResult.success) {
    console.error(`Error: Invalid arguments for command "${commandName}":`);
    validationResult.error.errors.forEach((err: ZodError['errors'][number]) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    console.log({ params });
    process.exit(1);
  }

  const result = await tool.execute(validationResult.data, {
    log: {
      ...console,
      ...GlobalContext.log,
    },
    reportProgress: () => Promise.resolve(),
    session: {},
  });

  if (typeof result === 'string') {
    console.log(result);
  } else if (result && 'isError' in result && result.isError) {
    console.error(result.content);
    process.exit(1);
  } else {
    console.log(result);
  }
}
