import { Command } from 'commander';

export function toCommand(
  name: string,
  description: string,
  action: (this: Command, ...args: any[]) => void | Promise<void>,
  options?: string[][],
  argument?: string[],
) {
  const program: Command = new Command();

  const cmd = program.name(name).description(description).action(action);

  if (options && options.length > 0) {
    for (const key in options) {
      cmd.option(options[key][0], options[key][1]);
    }
  }

  if (argument && argument.length === 2) {
    cmd.argument(argument[0], argument[1]);
  }
  return cmd;
}
