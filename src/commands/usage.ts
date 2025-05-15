import * as utils from '../utils';

const actionLogic = async () => {
    console.log("Run 'git-secret --help' to see all available commands and options.");
    console.log("Run 'git-secret <command> --help' for help on a specific command.");

    console.log("\nusage: git secret [--version] [command] [command-options]");
    console.log("");
    console.log("options:");
    console.log(" --version                 - prints the version number");
    console.log("");
    console.log("commands (use 'git-secret <command> --help' for more details):");
    const commands: string[] = [ 
        "add", "cat", "changes", "clean", "hide", "init", 
        "list", "remove", "removeperson", "reveal", "tell", "usage", "whoknows"
    ];
    commands.forEach(cmd => console.log(` ${cmd.padEnd(25)}`));
};

export default utils.toCommand(
    'usage',
    'Prints all the available commands.',
    actionLogic,
    [],
    []
);
