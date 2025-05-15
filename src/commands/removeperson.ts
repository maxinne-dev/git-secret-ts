import * as utils from '../utils';
import path from 'path';
import fs from 'fs/promises';
import * as openpgp from 'openpgp';
import { glob } from 'glob';

const actionLogic = async (
    emails: string[]
) => {
    try {
        await utils.userRequired(false); 
        const keysDir = await utils.getSecretsKeysDir();

        let removedCount = 0;
        for (const email of emails) {
            let keyRemoved = false;
            
            const keyFiles = await glob('*.asc', { cwd: keysDir, absolute: true });
            let filesToDelete: string[] = [];

            for (const keyFile of keyFiles) {
                try {
                    const armoredKey = await fs.readFile(keyFile, 'utf8');
                    const pubKey = await openpgp.readKey({ armoredKey });
                    const userIds = pubKey.getUserIDs();
                    if (userIds.some(uid => uid.includes(`<${email}>`) || uid === email)) {
                        filesToDelete.push(keyFile);
                    }
                } catch (e) {
                    utils.warn(`Could not parse key file ${path.basename(keyFile)} while checking for ${email}.`);
                }
            }
            
            if (filesToDelete.length === 0) {
                utils.warn(`No key found associated with email: ${email}`);
                continue;
            }

            for (const fileToDel of filesToDelete) {
                try {
                    await fs.unlink(fileToDel);
                    if (utils.SECRETS_VERBOSE) utils.message(`Removed key file: ${path.basename(fileToDel)} for ${email}`);
                    keyRemoved = true;
                } catch (e) {
                    utils.warn(`Failed to remove key file ${path.basename(fileToDel)}: ${(e as Error).message}`);
                }
            }
            
            if(keyRemoved) removedCount++;
        }

        if (removedCount > 0) {
            utils.message(`Removed keys for ${removedCount} email(s).`);
            utils.message(`Make sure to hide the existing secrets again to apply changes.`);
            await utils.fsdbClearHashes();
        } else {
            utils.message('No keys removed.');
        }

    } catch (error) {
        utils.abort(`Error in 'removeperson' command: ${(error as Error).message}`);
    }
};

const killpersonActionLogic = async (
    emails: string[]
) => {
    utils.warn("'killperson' has been renamed to 'removeperson'. This alias will be removed in future versions.");
    try {
        await actionLogic(emails);
    } catch (error) {
        utils.abort(`Error in 'killperson' command: ${(error as Error).message}`);
    }
};

export const removepersonCommand = utils.toCommand(
    'removeperson',
    "Removes user's public key from repo keyring.",
    actionLogic,
    [],
    ['<emails...>', "Email address(es) of the person(s) to remove."]
);

export const killpersonCommand = utils.toCommand(
    'killperson',
    "(alias for removeperson) Removes user's public key from repo keyring.",
    killpersonActionLogic,
    [],
    ['<emails...>', "Email address(es) of the person(s) to remove."]
);
