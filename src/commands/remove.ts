import * as utils from '../utils';
import path from 'path';
import fs from 'fs/promises';

interface RemoveCommandOptions {
    cleanEncrypted?: boolean;
}

const actionLogic = async (
    pathspecs: string[],
    options: RemoveCommandOptions
) => {
    try {
        await utils.userRequired();
        const gitRoot = await utils.getGitRootPath();
        if (!gitRoot) utils.abort('Not in a git repository.');

        let removedCount = 0;
        for (const item of pathspecs) {
            const normalizedPath = await utils.gitNormalizeFilename(item);
            const absolutePath = path.join(gitRoot, normalizedPath);
            
            if (await utils.fsdbRemoveRecord(normalizedPath)) {
                if (utils.SECRETS_VERBOSE) utils.message(`Removed from index: ${normalizedPath}`);
                removedCount++;

                if (options.cleanEncrypted) {
                    const encryptedPath = utils.getEncryptedFilePath(absolutePath);
                    try {
                        await fs.unlink(encryptedPath);
                        if (utils.SECRETS_VERBOSE) utils.message(`Deleted encrypted file: ${encryptedPath}`);
                    } catch (e) {
                        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                            utils.warn(`Failed to delete encrypted file ${encryptedPath}: ${(e as Error).message}`);
                        }
                    }
                }
            } else {
                if (utils.SECRETS_VERBOSE) utils.message(`File not found in index: ${normalizedPath}`);
            }
        }

        if (removedCount > 0) {
             utils.message(`Removed ${removedCount} item(s) from index.`);
             utils.message(`Ensure that removed files: [${pathspecs.join(', ')}] are now not ignored in .gitignore if they should be committed unencrypted.`);
        } else {
             utils.message('No items removed from index.');
        }

    } catch (error) {
        utils.abort(`Error in 'remove' command: ${(error as Error).message}`);
    }
};

export default utils.toCommand(
    'remove',
    'Removes files from index.',
    actionLogic,
    [
        ['-c, --clean-encrypted', 'Deletes existing real encrypted files.']
    ],
    ['<pathspec...>', 'File(s) to remove from git-secret tracking.']
);
