import fs from "fs/promises";
import * as openpgp from "openpgp";
import { glob } from "glob";
import {abort, checkIgnore, getSecretsDir, getSecretsKeysDir, SECRETS_DIR_NAME, warn} from ".";

export async function secretsDirExists(): Promise<boolean> {
    try {
        const stats = await fs.stat(await getSecretsDir());
        return stats.isDirectory();
    } catch (e) {
        return false;
    }
}

export async function secretsDirIsNotIgnored(): Promise<boolean> {
    return !(await checkIgnore(await getSecretsDir()));
}

export async function listUserPublicKeys(): Promise<openpgp.PublicKey[]> { // From .gitsecret/keys/*.asc
    const keysDir = await getSecretsKeysDir();
    try {
        const keyFiles = await glob('*.asc', {cwd: keysDir, absolute: true});
        const keys: openpgp.PublicKey[] = [];
        for (const keyFile of keyFiles) {
            try {
                const armoredKey = await fs.readFile(keyFile, 'utf8');
                const pubKey = await openpgp.readKey({armoredKey});
                if (!pubKey.isPrivate()) {
                    keys.push(pubKey);
                }
            } catch (e) {
                warn(`Could not parse key file ${keyFile}: ${(e as Error).message}`);
            }
        }
        return keys;
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; // Keys dir doesn't exist
        throw e;
    }
}

export async function userRequired(checkInitialized: boolean = true): Promise<void> {
    if (checkInitialized && !(await secretsDirExists())) {
        abort(`Directory '${SECRETS_DIR_NAME}' does not exist. Use 'git secret init' to initialize git-secret.`);
    }
    const publicKeys = await listUserPublicKeys();
    if (publicKeys.length === 0) {
        abort("No public keys for users found. Run 'git secret tell email@address'.");
    }
}