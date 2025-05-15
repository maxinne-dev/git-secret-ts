import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fsSync from 'fs';
import fs from 'fs/promises';
import { simpleGit } from 'simple-git';

// Mock das dependências
vi.mock('simple-git');
vi.mock('path');
vi.mock('fs');
vi.mock('fs/promises');
vi.mock('../../src/utils', () => ({
    getGitRootPath: vi.fn(),
    message: vi.fn(),
    warn: vi.fn(),
    SECRETS_VERBOSE: true
}));

// Importar as funções a serem testadas
import {
    isInsideGitTree,
    checkIgnore,
    gitNormalizeFilename,
    isTrackedInGit,
    addFileToGitignore
} from '../../src/utils/gitHelper';
import { getGitRootPath, message, warn } from '../../src/utils';

describe('Git Helper Utilities', () => {
    const mockGitRoot = '/fake/git/root';
    let mockGit: any;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Configurar mock do Git
        mockGit = {
            checkIsRepo: vi.fn(),
            checkIgnore: vi.fn(),
            raw: vi.fn()
        };
        
        vi.mocked(simpleGit).mockReturnValue(mockGit);
        vi.mocked(getGitRootPath).mockResolvedValue(mockGitRoot);
        
        // Mock para path
        vi.mocked(path.resolve).mockImplementation((p) => `resolved/${p}`);
        vi.mocked(path.relative).mockImplementation((from, to) => `relative/${to}`);
        vi.mocked(path.join).mockImplementation((...parts) => parts.join('/'));
    });

    describe('isInsideGitTree', () => {
        it('deve retornar true quando estiver dentro de um repositório git', async () => {
            mockGit.checkIsRepo.mockResolvedValue(true);
            
            const result = await isInsideGitTree();
            
            expect(simpleGit).toHaveBeenCalledWith(mockGitRoot);
            expect(mockGit.checkIsRepo).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('deve retornar false quando não estiver dentro de um repositório git', async () => {
            mockGit.checkIsRepo.mockResolvedValue(false);
            
            const result = await isInsideGitTree();
            
            expect(simpleGit).toHaveBeenCalledWith(mockGitRoot);
            expect(mockGit.checkIsRepo).toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('deve retornar false quando getGitRootPath retornar string vazia', async () => {
            vi.mocked(getGitRootPath).mockResolvedValue('');
            mockGit.checkIsRepo.mockResolvedValue(true);
            
            const result = await isInsideGitTree();
            
            expect(simpleGit).toHaveBeenCalledWith(undefined);
            expect(mockGit.checkIsRepo).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('deve retornar false quando ocorrer um erro', async () => {
            mockGit.checkIsRepo.mockRejectedValue(new Error('Git error'));
            
            const result = await isInsideGitTree();
            
            expect(result).toBe(false);
        });
    });

    describe('checkIgnore', () => {
        it('deve retornar true quando o arquivo estiver ignorado', async () => {
            const filePath = 'path/to/file.txt';
            mockGit.checkIgnore.mockResolvedValue(['relative/file.txt']);
            
            const result = await checkIgnore(filePath);
            
            expect(simpleGit).toHaveBeenCalledWith(mockGitRoot);
            expect(path.relative).toHaveBeenCalledWith(mockGitRoot, filePath);
            expect(mockGit.checkIgnore).toHaveBeenCalledWith('relative/path/to/file.txt');
            expect(result).toBe(true);
        });

        it('deve retornar false quando o arquivo não estiver ignorado', async () => {
            const filePath = '/path/to/file.txt';
            mockGit.checkIgnore.mockResolvedValue([]);
            
            const result = await checkIgnore(filePath);
            
            expect(mockGit.checkIgnore).toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('deve retornar false quando não estiver em um repositório git', async () => {
            vi.mocked(getGitRootPath).mockResolvedValue('');
            
            const result = await checkIgnore('/path/to/file.txt');
            
            expect(simpleGit).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('deve retornar false quando ocorrer um erro', async () => {
            mockGit.checkIgnore.mockRejectedValue(new Error('Git error'));
            
            const result = await checkIgnore('/path/to/file.txt');
            
            expect(result).toBe(false);
        });
    });

    describe('gitNormalizeFilename', () => {
        it('deve normalizar caminho relativo à raiz do git', async () => {
            const filePath = 'path/to/file.txt';
            vi.mocked(path.resolve).mockReturnValue(`${mockGitRoot}/path/to/file.txt`);
            vi.mocked(path.relative).mockReturnValue('path/to/file.txt');
            
            const result = await gitNormalizeFilename(filePath);
            
            expect(path.resolve).toHaveBeenCalledWith(filePath);
            expect(path.relative).toHaveBeenCalledWith(mockGitRoot, `${mockGitRoot}/path/to/file.txt`);
            expect(result).toBe('path/to/file.txt');
        });

        it('deve retornar caminho resolvido quando não estiver em um repositório git', async () => {
            vi.mocked(getGitRootPath).mockResolvedValue('');
            vi.mocked(path.resolve).mockReturnValue('/resolved/path/to/file.txt');
            
            const result = await gitNormalizeFilename('path/to/file.txt');
            
            expect(path.resolve).toHaveBeenCalledWith('path/to/file.txt');
            expect(result).toBe('/resolved/path/to/file.txt');
        });

        it('deve retornar caminho original quando o arquivo não estiver dentro da raiz do git', async () => {
            const filePath = '/another/path/to/file.txt';
            vi.mocked(path.resolve).mockReturnValue('/another/path/to/file.txt');
            
            // Mock que o caminho resolvido não começa com mockGitRoot
            vi.mocked(path.resolve).mockImplementation((p) => p.startsWith('/') ? p : `/resolved/${p}`);
            
            const result = await gitNormalizeFilename(filePath);
            
            expect(result).toBe('/another/path/to/file.txt');
        });
    });

    describe('isTrackedInGit', () => {
        it('deve retornar true quando o arquivo estiver rastreado no git', async () => {
            const filePath = 'path/to/file.txt';
            mockGit.raw.mockResolvedValue('path/to/file.txt');
            
            const result = await isTrackedInGit(filePath);
            
            expect(simpleGit).toHaveBeenCalledWith(mockGitRoot);
            expect(path.relative).toHaveBeenCalledWith(mockGitRoot, 'resolved/path/to/file.txt');
            expect(mockGit.raw).toHaveBeenCalledWith(['ls-files', '--error-unmatch', 'relative/resolved/path/to/file.txt']);
            expect(result).toBe(true);
        });

        it('deve retornar false quando o arquivo não estiver rastreado no git', async () => {
            mockGit.raw.mockRejectedValue(new Error('Git error'));
            
            const result = await isTrackedInGit('/path/to/file.txt');
            
            expect(result).toBe(false);
        });

        it('deve retornar false quando não estiver em um repositório git', async () => {
            vi.mocked(getGitRootPath).mockResolvedValue('');
            
            const result = await isTrackedInGit('/path/to/file.txt');
            
            expect(result).toBe(false);
        });

        it('deve retornar false quando o comando retornar string vazia', async () => {
            mockGit.raw.mockResolvedValue('');
            
            const result = await isTrackedInGit('/path/to/file.txt');
            
            expect(result).toBe(false);
        });
    });

    describe('addFileToGitignore', () => {
        it('deve adicionar padrão ao .gitignore quando o arquivo existir', async () => {
            const pattern = '*.secret';
            const existingContent = 'node_modules/\n.env\n';
            const expectedContent = 'node_modules/\n.env\n*.secret\n';
            
            vi.mocked(fsSync.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFile).mockResolvedValue(existingContent);
            
            await addFileToGitignore(pattern);
            
            expect(path.join).toHaveBeenCalledWith(mockGitRoot, '.gitignore');
            expect(fsSync.existsSync).toHaveBeenCalled();
            expect(fs.readFile).toHaveBeenCalled();
            expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), expectedContent);
            expect(message).toHaveBeenCalledWith(`Added '${pattern}' to .gitignore`);
        });

        it('deve criar .gitignore quando o arquivo não existir', async () => {
            const pattern = '*.secret';
            const expectedContent = '*.secret\n';
            
            vi.mocked(fsSync.existsSync).mockReturnValue(false);
            
            await addFileToGitignore(pattern);
            
            expect(fs.readFile).not.toHaveBeenCalled();
            expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), expectedContent);
        });

        it('não deve adicionar padrão duplicado ao .gitignore', async () => {
            const pattern = '*.secret';
            const existingContent = 'node_modules/\n*.secret\n.env\n';
            
            vi.mocked(fsSync.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFile).mockResolvedValue(existingContent);
            
            await addFileToGitignore(pattern);
            
            expect(fs.writeFile).not.toHaveBeenCalled();
        });

        it('deve garantir quebra de linha no final quando o conteúdo existente não terminar com quebra de linha', async () => {
            const pattern = '*.secret';
            const existingContent = 'node_modules/\n.env';
            const expectedContent = 'node_modules/\n.env\n*.secret\n';
            
            vi.mocked(fsSync.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFile).mockResolvedValue(existingContent);
            
            await addFileToGitignore(pattern);
            
            expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), expectedContent);
        });

        it('deve mostrar aviso quando não estiver em um repositório git', async () => {
            vi.mocked(getGitRootPath).mockResolvedValue('');
            
            await addFileToGitignore('*.secret');
            
            expect(warn).toHaveBeenCalledWith('Cannot add to .gitignore: not in a git repository.');
        });

        it('deve mostrar aviso quando falhar ao atualizar .gitignore', async () => {
            vi.mocked(fsSync.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFile).mockResolvedValue('content');
            vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));
            
            await addFileToGitignore('*.secret');
            
            expect(warn).toHaveBeenCalledWith('Failed to update .gitignore: Permission denied');
        });
    });
});
