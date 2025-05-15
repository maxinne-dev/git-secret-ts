import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { simpleGit } from 'simple-git';

// Importar as funções a serem testadas
import {
    getGitRootPath,
    getSecretsDir,
    getSecretsKeysDir,
    getSecretsPathsDir,
    getSecretsPathMappingFile,
    getEncryptedFilePath,
    getDecryptedFilePath, __resetGitRootPathCache
} from '../../src/utils';

import { SECRETS_DIR_NAME, SECRETS_EXTENSION } from '../../src/utils';

// Mock das dependências externas
vi.mock('simple-git', () => ({
    simpleGit: vi.fn()
}));

vi.mock('path', () => ({
    default: {
        join: vi.fn((...args) => args.join('/')),
        dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
        basename: vi.fn((p, ext) => {
            const base = p.split('/').pop();
            if (ext && base?.endsWith(ext)) {
                return base.slice(0, -ext.length);
            }
            return base;
        })
    }
}));

// Mock para evitar dependência circular
vi.mock('../utils', () => ({
    SECRETS_DIR_NAME: '.gitsecret',
    SECRETS_EXTENSION: '.secret'
}));

describe('paths.ts', () => {
    const mockGitRoot = '/fake/git/root';
    let mockRevparse: any;

    beforeEach(() => {
        vi.clearAllMocks();
        __resetGitRootPathCache();

        // Configurar mock do Git
        mockRevparse = vi.fn().mockResolvedValue(mockGitRoot);
        vi.mocked(simpleGit).mockReturnValue({
            revparse: mockRevparse
        } as any);
    });

    describe('getGitRootPath', () => {
        it('deve retornar o caminho raiz do git quando estiver em um repositório git', async () => {
            const result = await getGitRootPath();
            expect(mockRevparse).toHaveBeenCalledWith(['--show-toplevel']);
            expect(result).toBe(mockGitRoot);
        });

        it('deve retornar string vazia quando não estiver em um repositório git', async () => {
            mockRevparse.mockRejectedValueOnce(new Error('Not a git repo'));
            const result = await getGitRootPath();
            expect(result).toBe('');
        });

        it('deve armazenar em cache o caminho raiz do git', async () => {
            await getGitRootPath();
            await getGitRootPath();
            expect(mockRevparse).toHaveBeenCalledTimes(1);
        });
    });

    describe('getSecretsDir', () => {
        it('deve retornar o caminho correto do diretório de segredos', async () => {
            const result = await getSecretsDir();
            expect(path.join).toHaveBeenCalledWith(mockGitRoot, SECRETS_DIR_NAME);
            expect(result).toBe(`${mockGitRoot}/${SECRETS_DIR_NAME}`);
        });
    });

    describe('getSecretsKeysDir', () => {
        it('deve retornar o caminho correto do diretório de chaves', async () => {
            const result = await getSecretsKeysDir();
            expect(result.endsWith('/keys')).toBe(true);
        });
    });

    describe('getSecretsPathsDir', () => {
        it('deve retornar o caminho correto do diretório de caminhos', async () => {
            const result = await getSecretsPathsDir();
            expect(result.endsWith('/paths')).toBe(true);
        });
    });

    describe('getSecretsPathMappingFile', () => {
        it('deve retornar o caminho correto do arquivo de mapeamento', async () => {
            const result = await getSecretsPathMappingFile();
            expect(result.endsWith('/mapping.cfg')).toBe(true);
        });
    });

    describe('getEncryptedFilePath', () => {
        it('deve adicionar a extensão .secret ao arquivo sem extensão', () => {
            const filePath = '/caminho/para/arquivo';
            const result = getEncryptedFilePath(filePath);
            expect(result).toBe(`${filePath}${SECRETS_EXTENSION}`);
        });

        it('deve manter a extensão .secret se o arquivo já a possuir', () => {
            const filePath = `/caminho/para/arquivo${SECRETS_EXTENSION}`;
            const result = getEncryptedFilePath(filePath);
            expect(result).toBe(filePath);
        });

        it('deve adicionar a extensão .secret para arquivos com outras extensões', () => {
            const filePath = '/caminho/para/arquivo.txt';
            const result = getEncryptedFilePath(filePath);
            expect(result).toBe(`${filePath}${SECRETS_EXTENSION}`);
        });
    });

    describe('getDecryptedFilePath', () => {
        it('deve remover a extensão .secret de um arquivo que a possui', () => {
            const filePath = `/caminho/para/arquivo${SECRETS_EXTENSION}`;
            const result = getDecryptedFilePath(filePath);
            expect(result).toBe('/caminho/para/arquivo');
        });

        it('deve retornar o caminho original para arquivos sem a extensão .secret', () => {
            const filePath = '/caminho/para/arquivo.txt';
            const result = getDecryptedFilePath(filePath);
            expect(result).toBe(filePath);
        });
    });

    describe('__resetGitRootPathCache', () => {
        it('deve redefinir o cache para que getGitRootPath chame git novamente', async () => {
            // Primeira chamada para preencher o cache
            await getGitRootPath();
            expect(mockRevparse).toHaveBeenCalledTimes(1);

            // Segunda chamada deve usar o cache
            await getGitRootPath();
            expect(mockRevparse).toHaveBeenCalledTimes(1);

            // Resetar o cache
            __resetGitRootPathCache();

            // Terceira chamada deve chamar git novamente
            await getGitRootPath();
            expect(mockRevparse).toHaveBeenCalledTimes(2);
        });
    });
})