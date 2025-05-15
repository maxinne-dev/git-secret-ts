import * as utils from '../utils';
import path from 'path';
import fs from 'fs/promises';
import fse from 'fs-extra';
import * as openpgp from 'openpgp';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface TellCommandOptions {
    verbose?: boolean;
    useGitEmail?: boolean;
    gpgHomedir?: string;
    file?: string;
}

function sanitizeEmailForFilename(email: string): string {
    const emailMatch = email.match(/<([^>]+)>/);
    const actualEmail = emailMatch ? emailMatch[1] : email;
    return actualEmail.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function getPublicKeyFromGpg(email: string, gpgHomedir?: string): Promise<string> {
    const args: string[] = ['--export', '-a', email];
    if (gpgHomedir) {
        args.unshift('--homedir', gpgHomedir);
    }
    try {
        const { stdout } = await execFileAsync('gpg', args);
        return stdout;
    } catch (e) {
        utils.abort(`Failed to export public key for '${email}' using GPG: ${(e as any).stderr || (e as Error).message}. Ensure GPG is installed and the key exists.`);
    }
}

const actionLogic = async (
    argEmails: string[],
    options: TellCommandOptions
) => {
    if (options.verbose) utils.setVerbose(true);

    try {
        if (!(await utils.secretsDirExists())) {
            utils.abort(`Directory '${utils.SECRETS_DIR_NAME}' does not exist. Use 'git secret init' first.`);
        }
        
        const emailsToAdd: string[] = [...argEmails];
        let armoredKeyToImport: string | null = null;

        if (options.useGitEmail) {
            const git = utils.SimpleGit(await utils.getGitRootPath());
            const gitEmail = (await git.raw(['config', 'user.email'])).trim();
            if (!gitEmail) {
                utils.abort("'git config user.email' is not set, but -m option was used.");
            }
            emailsToAdd.push(gitEmail);
        }
        
        if (options.file) {
            if (emailsToAdd.length > 1 || (emailsToAdd.length === 1 && options.useGitEmail && emailsToAdd[0] !== (await utils.SimpleGit(await utils.getGitRootPath()).raw(['config', 'user.email'])).trim())) {
                 utils.abort("Option -f (file) can only be used when specifying a single email or none (if email is in key).");
            }
            armoredKeyToImport = await fs.readFile(options.file, 'utf8');
        }

        if (emailsToAdd.length === 0 && !armoredKeyToImport) {
            utils.abort('You must provide an email address, or use -m or -f <key_file>.');
        }
        
        const keysDir = await utils.getSecretsKeysDir();
        await fse.ensureDir(keysDir);

        let addedCount = 0;

        for (const email of (emailsToAdd.length > 0 ? emailsToAdd : [null])) { 
            let currentArmoredKey: string | null = armoredKeyToImport;
            let targetEmail: string | null | undefined = email;

            if (!currentArmoredKey && email) { 
                currentArmoredKey = await getPublicKeyFromGpg(email, options.gpgHomedir);
            }
            
            if (!currentArmoredKey) {
                utils.warn(`Could not obtain public key for ${email || 'the provided file'}.`);
                continue;
            }

            let pubKey: openpgp.PublicKey;
            try {
                pubKey = await openpgp.readKey({ armoredKey: currentArmoredKey });
            } catch (e) {
                utils.warn(`Invalid public key for ${targetEmail || 'provided file'}: ${(e as Error).message}`);
                continue;
            }

            if (pubKey.isPrivate()) {
                utils.warn(`The key for ${targetEmail || 'provided file'} is not a public key.`);
                continue;
            }
            
            if (!targetEmail) {
                const primaryUser = await pubKey.getPrimaryUser();
                targetEmail = primaryUser.user.userID?.email;
                if (!targetEmail) {
                     utils.warn(`Could not determine email from key in ${options.file}. Please provide an email argument.`);
                     continue;
                }
            }

            const existingKeys = await utils.listUserPublicKeys();
            if (existingKeys.some(k => k.getUserIDs().some(uid => uid.includes(targetEmail!)))) {
                utils.warn(`A key for ${targetEmail} already exists in the git-secret keyring. Skipping.`);
                continue;
            }

            const keyFilename = `${sanitizeEmailForFilename(targetEmail)}.${pubKey.getKeyID().toHex().toLowerCase()}.asc`;
            const keyPath = path.join(keysDir, keyFilename);
            
            await fs.writeFile(keyPath, currentArmoredKey);
            if (utils.SECRETS_VERBOSE) utils.message(`Added key for ${targetEmail} to ${keyPath}`);
            addedCount++;
        }

        if (addedCount > 0) {
            utils.message(`Done. ${addedCount} user(s) added.`);
            await utils.fsdbClearHashes();
            utils.message('Hashes cleared. Re-encrypt files with `git secret hide`.');
        } else {
            utils.message('No new users were added.');
        }

    } catch (error) {
        utils.abort(`Error in 'tell' command: ${(error as Error).message}`);
    }
};

export default utils.toCommand(
    'tell',
    'Adds person who can access private data.',
    actionLogic,
    [
        ['-v, --verbose', 'Verbose output.'],
        ['-m, --use-git-email', 'Use your current `git config user.email` as an identifier.'],
        ['-d, --gpg-homedir <dir>', 'Specify custom GPG home directory to export key from.'],
        ['-f, --file <key_file>', 'Path to the armored public key file to import.']
    ],
    ['[emails...]', 'Email address(es) of the person(s) to add. Required if -m or -f is not used.']
);
