import {Command} from 'commander'
import * as utils from './utils'

import {
    addCommand,
    catCommand,
    changesCommand,
    cleanCommand,
    hideCommand,
    initCommand,
    listCommand,
    removeCommand,
    killpersonCommand,
    removepersonCommand,
    revealCommand,
    tellCommand,
    usageCommand,
    whoknowsCommand
} from './commands'

const GITSECRET_VERSION: string = '0.0.1-alpha1';

const program = new Command();

program
    .name('git-secret')
    .version(GITSECRET_VERSION, '--version', 'Output the version number')
    .option('--dry-run', 'Perform a dry run (not fully implemented in all commands yet)')
    .hook('preAction', async (_: Command, actionCommand: Command) => {
        if (process.env.SECRETS_VERBOSE && process.env.SECRETS_VERBOSE !== '0' && !utils.SECRETS_VERBOSE) {
            utils.setVerbose(true);
            if (utils.SECRETS_VERBOSE) utils.message("Global verbose mode enabled by SECRETS_VERBOSE environment variable.");
        }

        const commandsToSkipSetupCheck: string[] = ['init', 'usage', '--version', '--help'];
        if (!commandsToSkipSetupCheck.includes(actionCommand.name()) && !commandsToSkipSetupCheck.some(c => program.args.includes(c))) {
            if (!(await utils.isInsideGitTree())) {
                utils.abort("Not a git repository. Perhaps use 'git init'/'git clone', then 'git secret init'.");
            }
            if (await utils.secretsDirExists() && !(await utils.secretsDirIsNotIgnored())) {
                utils.abort(`Directory '${utils.SECRETS_DIR_NAME}' is ignored by .gitignore. This is usually incorrect. Please check your .gitignore file.`);
            }
        }
    });

program.addCommand(addCommand);
program.addCommand(catCommand);
program.addCommand(changesCommand);
program.addCommand(cleanCommand);
program.addCommand(hideCommand);
program.addCommand(initCommand);
program.addCommand(listCommand);
program.addCommand(removeCommand);
program.addCommand(removepersonCommand);
program.addCommand(killpersonCommand);
program.addCommand(revealCommand);
program.addCommand(tellCommand);
program.addCommand(usageCommand);
program.addCommand(whoknowsCommand);


(async () => {
    try {
        await program.parseAsync(process.argv);
    } catch (error) {
        utils.abort(`Unhandled error: ${(error as Error).message}`);
    }
})();
