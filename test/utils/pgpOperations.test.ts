import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import * as openpgp from 'openpgp';

// Mock das dependências
vi.mock('fs/promises');
vi.mock('openpgp');
vi.mock('../../src/utils', () => ({
    abort: vi.fn(),
    listUserPublicKeys: vi.fn()
}));

import { getRecipientKeys, encryptFile, decryptFile } from '../../src/utils/pgpOperations';
import { abort, listUserPublicKeys } from '../../src/utils';

describe('PGP Operations', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('getRecipientKeys', () => {
        it('deve retornar as chaves públicas dos usuários', async () => {
            const mockKeys = [{ keyId: 'mock-key-1' }, { keyId: 'mock-key-2' }] as unknown as openpgp.PublicKey[];
            vi.mocked(listUserPublicKeys).mockResolvedValue(mockKeys);

            const result = await getRecipientKeys();

            expect(listUserPublicKeys).toHaveBeenCalled();
            expect(result).toEqual(mockKeys);
        });

        it('deve abortar quando não há chaves públicas configuradas', async () => {
            vi.mocked(listUserPublicKeys).mockResolvedValue([]);

            await expect(getRecipientKeys()).resolves.toEqual([]);
            expect(abort).toHaveBeenCalledWith('No configured recipients (public keys). Add users with `git secret tell`.');
        });
    });

    describe('encryptFile', () => {
        const mockInputPath = '/path/to/input.txt';
        const mockOutputPath = '/path/to/output.gpg';
        const mockPlainData = Buffer.from('conteúdo secreto');
        const mockEncryptedData = 'dados criptografados';
        const mockPublicKeys = [{ keyId: 'mock-key' }] as unknown as openpgp.PublicKey[];
        const mockMessage = { type: 'message' };

        beforeEach(() => {
            vi.mocked(fs.readFile).mockResolvedValue(mockPlainData);
            vi.mocked(openpgp.createMessage).mockResolvedValue(mockMessage as any);
            vi.mocked(openpgp.encrypt).mockResolvedValue(mockEncryptedData as any);
        });

        it('deve criptografar arquivos em formato binário por padrão', async () => {
            await encryptFile(mockInputPath, mockOutputPath, mockPublicKeys);

            expect(fs.readFile).toHaveBeenCalledWith(mockInputPath);
            expect(openpgp.createMessage).toHaveBeenCalledWith({ binary: mockPlainData });
            expect(openpgp.encrypt).toHaveBeenCalledWith({
                message: mockMessage,
                encryptionKeys: mockPublicKeys,
                format: 'binary'
            });
            expect(fs.writeFile).toHaveBeenCalledWith(mockOutputPath, mockEncryptedData);
        });

        it('deve criptografar arquivos em formato armored quando especificado', async () => {
            await encryptFile(mockInputPath, mockOutputPath, mockPublicKeys, true);

            expect(fs.readFile).toHaveBeenCalledWith(mockInputPath);
            expect(openpgp.createMessage).toHaveBeenCalledWith({ text: mockPlainData.toString('utf8') });
            expect(openpgp.encrypt).toHaveBeenCalledWith({
                message: mockMessage,
                encryptionKeys: mockPublicKeys,
                format: 'armored'
            });
            expect(fs.writeFile).toHaveBeenCalledWith(mockOutputPath, mockEncryptedData);
        });

        it('deve propagar erros na leitura do arquivo', async () => {
            const mockError = new Error('Erro ao ler arquivo');
            vi.mocked(fs.readFile).mockRejectedValue(mockError);

            await expect(encryptFile(mockInputPath, mockOutputPath, mockPublicKeys)).rejects.toThrow('Erro ao ler arquivo');
        });

        it('deve propagar erros na criptografia', async () => {
            const mockError = new Error('Erro na criptografia');
            vi.mocked(openpgp.encrypt).mockRejectedValue(mockError);

            await expect(encryptFile(mockInputPath, mockOutputPath, mockPublicKeys)).rejects.toThrow('Erro na criptografia');
        });
    });

    describe('decryptFile', () => {
        const mockInputPath = '/path/to/encrypted.gpg';
        const mockPrivateKeyPath = '/path/to/private.key';
        const mockPassphrase = 'senha-segura';
        const mockEncryptedData = Buffer.from('dados criptografados');
        const mockDecryptedData = 'conteúdo secreto';
        const mockPrivateKeyRaw = '-----BEGIN PGP PRIVATE KEY BLOCK-----\n...\n-----END PGP PRIVATE KEY BLOCK-----';
        const mockPrivateKey = {
            isDecrypted: vi.fn(),
            keyId: 'mock-key'
        };
        const mockEncryptedMessage = { type: 'encrypted-message' };

        beforeEach(() => {
            vi.mocked(fs.readFile).mockImplementation(async (path, encoding) => {
                if (path === mockInputPath) return mockEncryptedData;
                if (path === mockPrivateKeyPath && encoding === 'utf8') return mockPrivateKeyRaw;
                return Buffer.from('');
            });
            vi.mocked(openpgp.readPrivateKey).mockResolvedValue(mockPrivateKey as any);
            vi.mocked(openpgp.readMessage).mockResolvedValue(mockEncryptedMessage as any);
            vi.mocked(openpgp.decrypt).mockResolvedValue({ data: mockDecryptedData } as any);
        });

        it('deve descriptografar arquivos binários com chave privada já descriptografada', async () => {
            mockPrivateKey.isDecrypted.mockReturnValue(true);

            const result = await decryptFile(mockInputPath, mockPrivateKeyPath);

            expect(fs.readFile).toHaveBeenCalledWith(mockInputPath);
            expect(fs.readFile).toHaveBeenCalledWith(mockPrivateKeyPath, 'utf8');
            expect(openpgp.readPrivateKey).toHaveBeenCalledWith({ armoredKey: mockPrivateKeyRaw });
            expect(mockPrivateKey.isDecrypted).toHaveBeenCalled();
            expect(openpgp.decryptKey).not.toHaveBeenCalled();
            expect(openpgp.readMessage).toHaveBeenCalledWith({ binaryMessage: mockEncryptedData });
            expect(openpgp.decrypt).toHaveBeenCalledWith({
                message: mockEncryptedMessage,
                decryptionKeys: mockPrivateKey,
                format: 'binary'
            });
            expect(result).toBe(mockDecryptedData);
        });

        it('deve descriptografar arquivos armored quando o arquivo termina com .asc', async () => {
            const armoredInputPath = '/path/to/encrypted.asc';
            mockPrivateKey.isDecrypted.mockReturnValue(true);
            vi.mocked(fs.readFile).mockImplementation(async (path, encoding) => {
                if (path === armoredInputPath) return mockEncryptedData;
                if (path === mockPrivateKeyPath && encoding === 'utf8') return mockPrivateKeyRaw;
                return Buffer.from('');
            });

            const result = await decryptFile(armoredInputPath, mockPrivateKeyPath);

            expect(openpgp.readMessage).toHaveBeenCalledWith({ armoredMessage: mockEncryptedData.toString('utf8') });
            expect(openpgp.decrypt).toHaveBeenCalledWith({
                message: mockEncryptedMessage,
                decryptionKeys: mockPrivateKey
            });
            expect(result).toBe(mockDecryptedData);
        });

        it('deve descriptografar arquivos com chave privada criptografada usando passphrase', async () => {
            mockPrivateKey.isDecrypted.mockReturnValue(false);
            vi.mocked(openpgp.decryptKey).mockResolvedValue(mockPrivateKey as any);

            const result = await decryptFile(mockInputPath, mockPrivateKeyPath, mockPassphrase);

            expect(openpgp.decryptKey).toHaveBeenCalledWith({
                privateKey: mockPrivateKey,
                passphrase: mockPassphrase
            });
            expect(result).toBe(mockDecryptedData);
        });

        it('deve abortar quando a chave privada não puder ser lida', async () => {
            const mockError = new Error('Invalid private key');
            vi.mocked(openpgp.readPrivateKey).mockRejectedValue(mockError);

            await expect(decryptFile(mockInputPath, mockPrivateKeyPath)).rejects.toThrow();
            expect(abort).toHaveBeenCalledWith(`Failed to read private key: ${mockError.message}`);
        });

        it('deve abortar quando a chave privada estiver criptografada mas não for fornecida uma passphrase', async () => {
            mockPrivateKey.isDecrypted.mockReturnValue(false);

            await decryptFile(mockInputPath, mockPrivateKeyPath);
            expect(abort).toHaveBeenCalledWith('Private key is encrypted, but no passphrase was provided.');
        });

        it('deve abortar quando a passphrase for inválida', async () => {
            mockPrivateKey.isDecrypted.mockReturnValue(false);
            const mockError = new Error('Invalid passphrase');
            vi.mocked(openpgp.decryptKey).mockRejectedValue(mockError);

            await decryptFile(mockInputPath, mockPrivateKeyPath, 'passphrase-errada');
            expect(abort).toHaveBeenCalledWith(`Failed to decrypt private key with passphrase: ${mockError.message}`);
        });
    });
});
