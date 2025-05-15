import { describe, it, expect, vi, beforeEach } from 'vitest';
import fse from 'fs-extra';
import path from 'path';

// Mock das dependências
vi.mock('fs-extra');
vi.mock('../../src/utils', () => ({
    getGitRootPath: vi.fn(),
    getSecretsDir: vi.fn(),
    getSecretsKeysDir: vi.fn(),
    getSecretsPathsDir: vi.fn(),
    getSecretsPathMappingFile: vi.fn(),
    secretsDirExists: vi.fn(),
    secretsDirIsNotIgnored: vi.fn(),
    addFileToGitignore: vi.fn(),
    message: vi.fn(),
    abort: vi.fn(),
    toCommand: vi.fn((name, description, actionFn) => ({ 
        name, description, action: actionFn 
    })),
    SECRETS_DIR_NAME: '.gitsecret',
    SECRETS_EXTENSION: '.secret'
}));

// Importar após configurar os mocks
import gitSecretInit from '../../src/commands/init';
import * as utils from '../../src/utils';

describe('git-secret-init command', () => {
    const mockGitRoot = '/path/to/git/repo';
    const mockSecretsDir = '/path/to/git/repo/.gitsecret';
    const mockKeysDir = '/path/to/git/repo/.gitsecret/keys';
    const mockPathsDir = '/path/to/git/repo/.gitsecret/paths';
    const mockMappingFile = '/path/to/git/repo/.gitsecret/paths/mapping.txt';

    beforeEach(() => {
        vi.resetAllMocks();

        // Configuração dos mocks para o cenário feliz
        vi.mocked(utils.getGitRootPath).mockResolvedValue(mockGitRoot);
        vi.mocked(utils.getSecretsDir).mockResolvedValue(mockSecretsDir);
        vi.mocked(utils.getSecretsKeysDir).mockResolvedValue(mockKeysDir);
        vi.mocked(utils.getSecretsPathsDir).mockResolvedValue(mockPathsDir);
        vi.mocked(utils.getSecretsPathMappingFile).mockResolvedValue(mockMappingFile);
        vi.mocked(utils.secretsDirExists).mockResolvedValue(false);
        vi.mocked(utils.secretsDirIsNotIgnored).mockResolvedValue(true);
        vi.mocked(utils.abort).mockImplementation((msg: string) => {
            throw new Error(msg);
        });
    });
    // TODO: Corrigir teste.
    // it('deve inicializar o repositório git-secret corretamente', async () => {
    //     // Execute a ação do comando
    //     gitSecretInit.action(vi.fn());
    //
    //     // Verificações
    //     expect(utils.getGitRootPath).toHaveBeenCalled();
    //     expect(utils.secretsDirExists).toHaveBeenCalled();
    //     expect(utils.secretsDirIsNotIgnored).toHaveBeenCalled();
    //
    //     // Verificar criação de diretórios
    //     expect(fse.ensureDir).toHaveBeenCalledWith(mockSecretsDir);
    //     expect(fse.ensureDir).toHaveBeenCalledWith(mockKeysDir);
    //     expect(fse.ensureDir).toHaveBeenCalledWith(mockPathsDir);
    //
    //     // Verificar configuração de permissões
    //     expect(fse.chmod).toHaveBeenCalledWith(mockKeysDir, 0o700);
    //
    //     // Verificar criação do arquivo de mapeamento
    //     expect(fse.writeFile).toHaveBeenCalledWith(mockMappingFile, '');
    //
    //     // Verificar atualização do .gitignore
    //     const randomSeedPattern = path.join(utils.SECRETS_DIR_NAME, 'keys', 'random_seed').replace(/\\/g, '/');
    //     expect(utils.addFileToGitignore).toHaveBeenCalledWith(randomSeedPattern);
    //     expect(utils.addFileToGitignore).toHaveBeenCalledWith(`!*${utils.SECRETS_EXTENSION}`);
    //
    //     // Verificar mensagens
    //     expect(utils.message).toHaveBeenCalledWith(`Init created: '${utils.SECRETS_DIR_NAME}/'`);
    //     expect(utils.message).toHaveBeenCalledWith('Updated .gitignore');
    // });

    it('deve abortar se não estiver em um repositório git', async () => {
        vi.mocked(utils.getGitRootPath).mockResolvedValue('');

        await expect(gitSecretInit.action(vi.fn())).rejects.toThrow('Not in a git repository');
        expect(utils.abort).toHaveBeenCalledWith('Not in a git repository. Please run `git init` first.');
        expect(fse.ensureDir).not.toHaveBeenCalled();
    });

    it('deve abortar se o diretório .gitsecret já existir', async () => {
        vi.mocked(utils.secretsDirExists).mockResolvedValue(true);

        await expect(gitSecretInit.action(vi.fn())).rejects.toThrow(`'${utils.SECRETS_DIR_NAME}' already initialized.`);
        expect(utils.abort).toHaveBeenCalledWith(`'${utils.SECRETS_DIR_NAME}' already initialized.`);
        expect(fse.ensureDir).not.toHaveBeenCalled();
    });

    it('deve abortar se .gitsecret estiver no .gitignore', async () => {
        vi.mocked(utils.secretsDirIsNotIgnored).mockResolvedValue(false);

        await expect(gitSecretInit.action(vi.fn())).rejects.toThrow(`Entry '${utils.SECRETS_DIR_NAME}' seems to be in .gitignore`);
        expect(utils.abort).toHaveBeenCalledWith(
            `Entry '${utils.SECRETS_DIR_NAME}' seems to be in .gitignore. Please remove it first.`
        );
        expect(fse.ensureDir).not.toHaveBeenCalled();
    });

    it('deve propagar erros durante a criação de diretórios', async () => {
        const mockError = new Error('Erro ao criar diretório');
        vi.mocked(fse.ensureDir).mockRejectedValueOnce(mockError);

        await expect(gitSecretInit.action(vi.fn())).rejects.toThrow(`Error in 'init' command: Erro ao criar diretório`);
        expect(utils.abort).toHaveBeenCalledWith(`Error in 'init' command: Erro ao criar diretório`);
    });

    it('deve verificar a estrutura do comando exportado', () => {
        expect(gitSecretInit.name).toBe('init');
        expect(gitSecretInit.description).toBe('Initializes git-secret repository.');
        expect(typeof gitSecretInit.action).toBe('function');
    });
});
