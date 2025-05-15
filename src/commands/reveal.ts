import * as utils from '../utils';
import path from 'path';
import fs from 'fs/promises';

interface RevealCommandOptions {
    forceOverwrite?: boolean;
    forceContinue?: boolean;
    preservePermissions?: boolean;
    verbose?: boolean;
    homedir?: string;
    passphrase?: string;
    privateKey?: string;
}

const actionLogic = async (
    pathspecs: string[],
    options: RevealCommandOptions
) => {
    if (options.verbose) utils.setVerbose(true);

    try {
        await utils.userRequired();
        const gitRoot = await utils.getGitRootPath();
        if (!gitRoot) utils.abort('Not in a git repository.');

        const privateKeyArmored = options.privateKey 
            ? options.privateKey
            : process.env.GPG_PRIVATE_KEY;

        if (!privateKeyArmored) {
            utils.abort('Private key must be provided via --private-key option or GPG_PRIVATE_KEY env variable.');
        }
        const passphrase = options.passphrase || process.env.GPG_PASSPHRASE;

        let filesToReveal = pathspecs && pathspecs.length > 0 
            ? pathspecs.map(p => ({ filePath: p })) 
            : await utils.readPathMapping();

        let revealedCount = 0;
        for (const item of filesToReveal) {
            const normalizedPath = await utils.gitNormalizeFilename(item.filePath);
            const unencryptedPath = path.join(gitRoot, normalizedPath);
            const encryptedPath = utils.getEncryptedFilePath(unencryptedPath);

            if (unencryptedPath.endsWith(utils.SECRETS_EXTENSION)) {
                 utils.warnOrAbort(!options.forceContinue, `Cannot decrypt to secret version of file: ${unencryptedPath}`);
                 if (!options.forceContinue) return;
                 continue;
            }

            let encryptedFileExists = false;
            try {
                await fs.access(encryptedPath);
                encryptedFileExists = true;
            } catch (e) {
                utils.warnOrAbort(!options.forceContinue, `Cannot find file to decrypt: ${encryptedPath}`);
                if (!options.forceContinue) return;
                continue;
            }

            if (encryptedFileExists) {
                if (!options.forceOverwrite) {
                    try {
                        await fs.access(unencryptedPath);
                        
                        utils.warnOrAbort(!options.forceContinue, `Unencrypted file ${unencryptedPath} already exists. Use -f to overwrite.`);
                        if (!options.forceContinue) return;
                        continue;
                    } catch (e) {
                        // File doesn't exist, ok to proceed
                    }
                }

                try {
                    const decryptedData = await utils.decryptFile(encryptedPath, privateKeyArmored, passphrase);
                    await fs.writeFile(unencryptedPath, decryptedData);
                    revealedCount++;
                    if (utils.SECRETS_VERBOSE) utils.message(`Revealed: ${unencryptedPath}`);

                    if (options.preservePermissions) {
                        try {
                            const perms = await utils.getOctalPerms(encryptedPath);
                            await fs.chmod(unencryptedPath, parseInt(perms, 8));
                            if (utils.SECRETS_VERBOSE) utils.message(`Set permissions of ${unencryptedPath} to ${perms}`);
                        } catch(e) {
                            utils.warn(`Could not preserve permissions for ${unencryptedPath}: ${(e as Error).message}`);
                        }
                    }
                } catch (e) {
                     utils.warnOrAbort(!options.forceContinue, `Failed to decrypt ${encryptedPath}: ${(e as Error).message}`);
                     if (!options.forceContinue) return;
                }
            }
        }
        utils.message(`Done. ${revealedCount} of ${filesToReveal.length} files are revealed.`);

    } catch (error) {
        utils.abort(`Error in 'reveal' command: ${(error as Error).message}`);
    }
};

export default utils.toCommand(
    'reveal',
    'Decrypts all added files.',
    actionLogic,
    [
        ['-f, --force-overwrite', 'Forces gpg to overwrite existing files without prompt.'],
        ['-F, --force-continue', 'Forces reveal to continue even if a file fails to decrypt.'],
        ['-P, --preserve-permissions', 'Preserve permissions of encrypted file in unencrypted file.'],
        ['-v, --verbose', 'Verbose, shows extra information.'],
        ['-d, --homedir <dir>', 'Custom GPG home directory (ignored).'],
        ['-p, --passphrase <password>', 'Passphrase for the private key.'],
        ['--private-key <key_path>', 'Path to the armored private key file.']
    ],
    ['[pathspec...]', 'Specific files to reveal. Reveals all if none specified.']
);
