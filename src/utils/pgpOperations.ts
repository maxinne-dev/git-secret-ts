import * as openpgp from "openpgp";
import fs from "fs/promises";
import {abort, listUserPublicKeys} from ".";

export async function getRecipientKeys(): Promise<openpgp.PublicKey[]> {
    const userKeys = await listUserPublicKeys();
    if (userKeys.length === 0) {
        abort('No configured recipients (public keys). Add users with `git secret tell`.');
    }
    return userKeys;
}

export async function encryptFile(
    inputPath: string,
    outputPath: string,
    recipientPublicKeys: openpgp.PublicKey[],
    armor: boolean = false
): Promise<void> {
    const plainData = await fs.readFile(inputPath);
    let encrypted: string | Uint8Array;
    if (armor) {
        const message = await openpgp.createMessage({ text: plainData.toString('utf8') });
        encrypted = await openpgp.encrypt({
            message,
            encryptionKeys: recipientPublicKeys,
            format: 'armored',
        });
    } else {
        const message = await openpgp.createMessage({ binary: plainData });
        encrypted = await openpgp.encrypt({
            message,
            encryptionKeys: recipientPublicKeys,
            format: 'binary',
        });
    }
    await fs.writeFile(outputPath, encrypted);
}

export async function decryptFile(
    inputPath: string,
    privateKeyArmored: string,
    passphrase?: string
): Promise<Uint8Array | string> {
    const fileData = await fs.readFile(inputPath);
    const isArmored = inputPath.endsWith('.asc');

    const rawPrivateKey = await fs.readFile(privateKeyArmored, 'utf8');
    let privateKey;
    try {
        privateKey = await openpgp.readPrivateKey({ armoredKey: rawPrivateKey });
    } catch (e) {
        abort(`Failed to read private key: ${(e as Error).message}`);
    }

    if (privateKey.isDecrypted() === false && passphrase) { // Check if needs passphrase & one is provided
        try {
            privateKey = await openpgp.decryptKey({
                privateKey,
                passphrase,
            });
        } catch (e) {
            abort(`Failed to decrypt private key with passphrase: ${(e as Error).message}`);
        }
    } else if (privateKey.isDecrypted() === false && !passphrase) {
        abort('Private key is encrypted, but no passphrase was provided.');
    }

    if (isArmored) {
        // Para mensagens em formato de texto
        const encryptedMessage = await openpgp.readMessage({
            armoredMessage: fileData.toString('utf8')
        });
        const { data } = await openpgp.decrypt({
            message: encryptedMessage,
            decryptionKeys: privateKey
        });
        return data as string;
    } else {
        // Para mensagens em formato binário
        const encryptedMessage = await openpgp.readMessage({
            binaryMessage: fileData
        });
        const { data } = await openpgp.decrypt({
            message: encryptedMessage,
            decryptionKeys: privateKey,
            format: 'binary'
        });
        return data as Uint8Array;
    }
}