import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import * as openpgp from 'openpgp';
import { glob } from 'glob';

// Mocks precisam ser configurados antes de importar as funções a serem testadas
vi.mock('fs/promises');
vi.mock('openpgp');
vi.mock('glob');
vi.mock('../../src/utils', () => {
    return {
        getSecretsDir: vi.fn(),
        getSecretsKeysDir: vi.fn(),
        checkIgnore: vi.fn(),
        abort: vi.fn(),
        warn: vi.fn(),
        SECRETS_DIR_NAME: '.gitsecret'
    };
});

// Importar após configurar os mocks
import {
    secretsDirExists,
    secretsDirIsNotIgnored,
    listUserPublicKeys,
    userRequired
} from '../../src/utils/validation';
import { abort, checkIgnore, getSecretsDir, getSecretsKeysDir, SECRETS_DIR_NAME, warn } from '../../src/utils';

describe('Validation', () => {
    const mockSecretsDir = '/path/to/.gitsecret';
    const mockKeysDir = '/path/to/.gitsecret/keys';

    beforeEach(() => {
        vi.mocked(getSecretsDir).mockResolvedValue(mockSecretsDir);
        vi.mocked(getSecretsKeysDir).mockResolvedValue(mockKeysDir);
        vi.mocked(abort).mockImplementation((msg) => {
            throw new Error(String(msg));
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('secretsDirExists', () => {
        it('deve retornar true quando o diretório existe', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);

            const result = await secretsDirExists();
            expect(result).toBe(true);
            expect(getSecretsDir).toHaveBeenCalledTimes(1);
            expect(fs.stat).toHaveBeenCalledWith(mockSecretsDir);
        });

        it('deve retornar false quando o diretório não existe', async () => {
            vi.mocked(fs.stat).mockRejectedValue(new Error('Diretório não encontrado'));

            const result = await secretsDirExists();
            expect(result).toBe(false);
            expect(getSecretsDir).toHaveBeenCalledTimes(1);
            expect(fs.stat).toHaveBeenCalledWith(mockSecretsDir);
        });
    });

    describe('secretsDirIsNotIgnored', () => {
        it('deve retornar true quando o diretório não está ignorado', async () => {
            vi.mocked(checkIgnore).mockResolvedValue(false);

            const result = await secretsDirIsNotIgnored();
            expect(result).toBe(true);
            expect(getSecretsDir).toHaveBeenCalledTimes(1);
            expect(checkIgnore).toHaveBeenCalledWith(mockSecretsDir);
        });

        it('deve retornar false quando o diretório está ignorado', async () => {
            vi.mocked(checkIgnore).mockResolvedValue(true);

            const result = await secretsDirIsNotIgnored();
            expect(result).toBe(false);
            expect(getSecretsDir).toHaveBeenCalledTimes(1);
            expect(checkIgnore).toHaveBeenCalledWith(mockSecretsDir);
        });
    });

    describe('listUserPublicKeys', () => {
        it('deve retornar uma lista de chaves públicas válidas', async () => {
            const mockKeyFiles = [`${mockKeysDir}/key1.asc`, `${mockKeysDir}/key2.asc`];
            vi.mocked(glob).mockResolvedValue(mockKeyFiles);

            const mockPublicKey1 = {
                isPrivate: () => false
            } as unknown as openpgp.PublicKey;

            const mockPublicKey2 = {
                isPrivate: () => false
            } as unknown as openpgp.PublicKey;

            vi.mocked(fs.readFile)
                .mockResolvedValueOnce('armored-key-1')
                .mockResolvedValueOnce('armored-key-2');

            vi.mocked(openpgp.readKey)
                .mockResolvedValueOnce(mockPublicKey1)
                .mockResolvedValueOnce(mockPublicKey2);

            const keys = await listUserPublicKeys();
            expect(keys).toHaveLength(2);
            expect(keys[0]).toBe(mockPublicKey1);
            expect(keys[1]).toBe(mockPublicKey2);
            expect(glob).toHaveBeenCalledWith('*.asc', expect.objectContaining({
                cwd: mockKeysDir,
                absolute: true
            }));
        });

        it('deve ignorar chaves privadas', async () => {
            const mockKeyFiles = [`${mockKeysDir}/key1.asc`, `${mockKeysDir}/key2.asc`];
            vi.mocked(glob).mockResolvedValue(mockKeyFiles);

            const mockPublicKey = {
                isPrivate: () => false
            } as unknown as openpgp.PublicKey;

            const mockPrivateKey = {
                isPrivate: () => true
            } as unknown as openpgp.PublicKey;

            vi.mocked(fs.readFile)
                .mockResolvedValueOnce('armored-key-1')
                .mockResolvedValueOnce('armored-key-2');

            vi.mocked(openpgp.readKey)
                .mockResolvedValueOnce(mockPublicKey)
                .mockResolvedValueOnce(mockPrivateKey);

            const keys = await listUserPublicKeys();
            expect(keys).toHaveLength(1);
            expect(keys[0]).toBe(mockPublicKey);
        });

        it('deve mostrar aviso para arquivos de chave inválidos', async () => {
            const mockKeyFiles = [`${mockKeysDir}/valid.asc`, `${mockKeysDir}/invalid.asc`];
            vi.mocked(glob).mockResolvedValue(mockKeyFiles);

            const mockPublicKey = {
                isPrivate: () => false
            } as unknown as openpgp.PublicKey;

            vi.mocked(fs.readFile)
                .mockResolvedValueOnce('valid-key')
                .mockResolvedValueOnce('invalid-key');

            vi.mocked(openpgp.readKey)
                .mockResolvedValueOnce(mockPublicKey)
                .mockRejectedValueOnce(new Error('Formato inválido'));

            const keys = await listUserPublicKeys();
            expect(keys).toHaveLength(1);
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn).toHaveBeenCalledWith(expect.any(String));
        });

        it('deve retornar lista vazia quando o diretório de chaves não existe', async () => {
            const error = new Error('Diretório não encontrado');
            (error as NodeJS.ErrnoException).code = 'ENOENT';
            vi.mocked(glob).mockRejectedValue(error);

            const keys = await listUserPublicKeys();
            expect(keys).toHaveLength(0);
        });

        it('deve propagar outros erros', async () => {
            const error = new Error('Erro de permissão');
            (error as NodeJS.ErrnoException).code = 'EACCES';
            vi.mocked(glob).mockRejectedValue(error);

            await expect(listUserPublicKeys()).rejects.toThrow('Erro de permissão');
        });
    });

    describe('userRequired', () => {
        it('deve abortar quando o diretório não existe e checkInitialized é true', async () => {
            vi.mocked(fs.stat).mockRejectedValue(new Error('Diretório não encontrado'));

            await expect(async () => {
                await userRequired();
            }).rejects.toThrow(`Directory '${SECRETS_DIR_NAME}' does not exist`);

            expect(abort).toHaveBeenCalled();
        });

        it('deve prosseguir quando o diretório não existe mas checkInitialized é false', async () => {
            vi.mocked(fs.stat).mockRejectedValue(new Error('Diretório não encontrado'));
            vi.mocked(glob).mockResolvedValue([`${mockKeysDir}/key.asc`]);

            const mockPublicKey = {
                isPrivate: () => false
            } as unknown as openpgp.PublicKey;

            vi.mocked(fs.readFile).mockResolvedValue('armored-key');
            vi.mocked(openpgp.readKey).mockResolvedValue(mockPublicKey);

            await userRequired(false);
            expect(abort).not.toHaveBeenCalled();
        });

        it('deve abortar quando não há chaves públicas', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);

            vi.mocked(glob).mockResolvedValue([]);

            await expect(async () => {
                await userRequired();
            }).rejects.toThrow("No public keys for users found");

            expect(abort).toHaveBeenCalled();
        });

        it('deve prosseguir quando há chaves públicas', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);

            vi.mocked(glob).mockResolvedValue([`${mockKeysDir}/key.asc`]);

            const mockPublicKey = {
                isPrivate: () => false
            } as unknown as openpgp.PublicKey;

            vi.mocked(fs.readFile).mockResolvedValue('armored-key');
            vi.mocked(openpgp.readKey).mockResolvedValue(mockPublicKey);

            await userRequired();
            expect(abort).not.toHaveBeenCalled();
        });
    });
});