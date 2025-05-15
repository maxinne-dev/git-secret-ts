import * as utils from '../utils';
import path from 'path';
import fs from 'fs/promises';

interface CleanCommandOptions {
    verbose?: boolean;
}

const actionLogic = async (
    args: string[],
    options: CleanCommandOptions
) => {
    if (options.verbose) utils.setVerbose(true);

    try {
        await utils.userRequired();
        const gitRoot = await utils.getGitRootPath();
        if (!gitRoot) utils.abort('Not in a git repository.');

        const mappings = await utils.readPathMapping();
        if (mappings.length === 0 && utils.SECRETS_VERBOSE) {
             utils.message('No files are currently tracked by git-secret.');
        }

        for (const mapping of mappings) {
            const absoluteDecryptedPath = path.join(gitRoot, mapping.filePath);
            const encryptedPath = utils.getEncryptedFilePath(absoluteDecryptedPath);
            try {
                await fs.unlink(encryptedPath);
                if (utils.SECRETS_VERBOSE) utils.message(`Deleted: ${encryptedPath}`);
            } catch (e) {
                if ((e as NodeJS.ErrnoException).code !== 'ENOENT') { 
                    utils.warn(`Failed to delete ${encryptedPath}: ${(e as Error).message}`);
                } else if (utils.SECRETS_VERBOSE) {
                    utils.message(`Skipped (not found): ${encryptedPath}`);
                }
            }
        }
        utils.message('Clean complete.');

    } catch (error) {
        utils.abort(`Error in 'clean' command: ${(error as Error).message}`);
    }
};

export default utils.toCommand(
    'clean',
    'Removes all the encrypted files.',
    actionLogic,
    [
        ['-v, --verbose', 'Verbose mode, shows which files are deleted.']
    ],
    []
);
