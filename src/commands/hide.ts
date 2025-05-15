import * as utils from '../utils';
import path from 'path';
import fs from 'fs/promises';

interface HideCommandOptions {
    verbose?: boolean;
    cleanFirst?: boolean;
    forceContinue?: boolean;
    preservePermissions?: boolean;
    deleteUnencrypted?: boolean;
    modifiedOnly?: boolean;
    armor?: boolean;
}

const actionLogic = async (
    args: string[],
    options: HideCommandOptions
) => {
    if (options.verbose) utils.setVerbose(true);

    try {
        await utils.userRequired();
        const gitRoot = await utils.getGitRootPath();
        if (!gitRoot) utils.abort('Not in a git repository.');

        if (options.cleanFirst) {
            const mappings = await utils.readPathMapping();
            for (const mapping of mappings) {
                const absoluteDecryptedPath = path.join(gitRoot, mapping.filePath);
                const encryptedPath = utils.getEncryptedFilePath(absoluteDecryptedPath);
                try {
                    await fs.unlink(encryptedPath);
                    if (utils.SECRETS_VERBOSE) utils.message(`Cleaned (deleted): ${encryptedPath}`);
                } catch (e) {
                    if ((e as NodeJS.ErrnoException).code !== 'ENOENT' && utils.SECRETS_VERBOSE) {
                         utils.warn(`Could not clean ${encryptedPath}: ${(e as Error).message}`);
                    }
                }
            }
        }

        const recipientKeys = await utils.getRecipientKeys();
        if (recipientKeys.length === 0) {
            utils.abort('No configured recipients. Use `git secret tell` to add users.');
        }

        const mappings = await utils.readPathMapping();
        let hiddenCount = 0;

        for (const mapping of mappings) {
            const unencryptedPath = path.join(gitRoot, mapping.filePath);
            const encryptedPath = utils.getEncryptedFilePath(unencryptedPath);

            let fileExists = false;
            try {
                await fs.access(unencryptedPath);
                fileExists = true;
            } catch (e) {
                utils.warnOrAbort(!options.forceContinue, `File not found: ${unencryptedPath}`);
                if (!options.forceContinue) return; 
                if (utils.SECRETS_VERBOSE) utils.message(`Skipping (not found): ${unencryptedPath}`);
                continue;
            }

            if (fileExists && options.modifiedOnly) {
                const currentHash = await utils.sha256sum(unencryptedPath);
                if (mapping.hash === currentHash) {
                    if (utils.SECRETS_VERBOSE) utils.message(`Skipping (unmodified): ${mapping.filePath}`);
                    continue;
                }
            }
            
            if (utils.SECRETS_VERBOSE) utils.message(`Encrypting: ${mapping.filePath} to ${encryptedPath}`);
            await utils.encryptFile(unencryptedPath, encryptedPath, recipientKeys, options.armor);
            hiddenCount++;

            if (options.preservePermissions) {
                const perms = await utils.getOctalPerms(unencryptedPath);
                await fs.chmod(encryptedPath, parseInt(perms, 8));
                 if (utils.SECRETS_VERBOSE) utils.message(`Set permissions of ${encryptedPath} to ${perms}`);
            }
            
            const newHash = await utils.sha256sum(unencryptedPath);
            await utils.fsdbUpdateRecordHash(mapping.filePath, newHash);

            if (options.deleteUnencrypted) {
                await fs.unlink(unencryptedPath);
                if (utils.SECRETS_VERBOSE) utils.message(`Deleted unencrypted source: ${unencryptedPath}`);
            }
        }
        utils.message(`Done. ${hiddenCount} of ${mappings.length} files are hidden.`);

    } catch (error) {
        utils.abort(`Error in 'hide' command: ${(error as Error).message}`);
    }
};

export default utils.toCommand(
    'hide',
    'Encrypts all added files with repo keyring.',
    actionLogic,
    [
        ['-v, --verbose', 'Verbose, shows extra information.'],
        ['-c, --clean-first', 'Deletes encrypted files before creating new ones.'],
        ['-F, --force-continue', 'Forces hide to continue if a file to encrypt is missing.'],
        ['-P, --preserve-permissions', 'Preserve permissions of unencrypted file in encrypted file.'],
        ['-d, --delete-unencrypted', 'Deletes unencrypted files after encryption.'],
        ['-m, --modified-only', 'Encrypt files only when modified (based on SHA256 hash).'],
        ['--armor', 'Output ASCII armored data instead of binary.']
    ],
    []
);
