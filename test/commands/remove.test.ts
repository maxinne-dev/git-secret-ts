import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

// Mock das dependências
vi.mock('path');
vi.mock('fs/promises');
vi.mock('../../src/utils', () => ({
  userRequired: vi.fn(),
  getGitRootPath: vi.fn(),
  gitNormalizeFilename: vi.fn(),
  fsdbRemoveRecord: vi.fn(),
  getEncryptedFilePath: vi.fn(),
  message: vi.fn(),
  warn: vi.fn(),
  abort: vi.fn(),
  SECRETS_VERBOSE: false,
  toCommand: vi.fn((name, description, actionFn) => ({
    name,
    description,
    action: actionFn,
  })),
}));

// Importar após configurar os mocks
import gitSecretRemove from '../../src/commands/remove';
import * as utils from '../../src/utils';

describe('git-secret-remove command', () => {
  const mockGitRoot = '/path/to/git/repo';
  const mockPathspec = 'file.txt';
  const mockNormalizedPath = 'file.txt';
  const mockAbsolutePath = '/path/to/git/repo/file.txt';
  const mockEncryptedPath = '/path/to/git/repo/file.txt.secret';

  beforeEach(() => {
    vi.resetAllMocks();

    // Configuração default para o cenário feliz
    vi.mocked(utils.userRequired).mockResolvedValue(undefined);
    vi.mocked(utils.getGitRootPath).mockResolvedValue(mockGitRoot);
    vi.mocked(utils.gitNormalizeFilename).mockResolvedValue(mockNormalizedPath);
    vi.mocked(path.join).mockReturnValue(mockAbsolutePath);
    vi.mocked(utils.getEncryptedFilePath).mockReturnValue(mockEncryptedPath);
    vi.mocked(utils.fsdbRemoveRecord).mockResolvedValue(true); // Arquivo encontrado e removido com sucesso
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.mocked(utils.abort).mockImplementation((msg: string) => {
      throw new Error(msg);
    });
  });

  it('deve remover um arquivo do índice corretamente', async () => {
    // Executar comando
    // @ts-ignore
    await gitSecretRemove.action([mockPathspec], {});

    // Verificar chamadas
    expect(utils.userRequired).toHaveBeenCalled();
    expect(utils.getGitRootPath).toHaveBeenCalled();
    expect(utils.gitNormalizeFilename).toHaveBeenCalledWith(mockPathspec);
    expect(utils.fsdbRemoveRecord).toHaveBeenCalledWith(mockNormalizedPath);
    expect(utils.message).toHaveBeenCalledWith('Removed 1 item(s) from index.');
    expect(utils.message).toHaveBeenCalledWith(`Ensure that removed files: [${mockPathspec}] are now not ignored in .gitignore if they should be committed unencrypted.`);
  });

  it('deve remover múltiplos arquivos do índice', async () => {
    const mockPathspecs = ['file1.txt', 'file2.txt'];
    const mockNormalizedPaths = ['file1.txt', 'file2.txt'];
    const mockAbsolutePaths = [
      '/path/to/git/repo/file1.txt',
      '/path/to/git/repo/file2.txt',
    ];
    const mockEncryptedPaths = [
      '/path/to/git/repo/file1.txt.secret',
      '/path/to/git/repo/file2.txt.secret',
    ];

    vi.mocked(utils.gitNormalizeFilename)
      .mockResolvedValueOnce(mockNormalizedPaths[0])
      .mockResolvedValueOnce(mockNormalizedPaths[1]);

    vi.mocked(path.join)
      .mockReturnValueOnce(mockAbsolutePaths[0])
      .mockReturnValueOnce(mockAbsolutePaths[1]);

    vi.mocked(utils.getEncryptedFilePath)
      .mockReturnValueOnce(mockEncryptedPaths[0])
      .mockReturnValueOnce(mockEncryptedPaths[1]);

    vi.mocked(utils.fsdbRemoveRecord).mockResolvedValue(true);

    // Executar comando
    // @ts-ignore
    await gitSecretRemove.action(mockPathspecs, {});

    // Verificar chamadas
    expect(utils.gitNormalizeFilename).toHaveBeenCalledTimes(2);
    expect(utils.fsdbRemoveRecord).toHaveBeenCalledTimes(2);
    expect(utils.message).toHaveBeenCalledWith('Removed 2 item(s) from index.');
    expect(utils.message).toHaveBeenCalledWith(`Ensure that removed files: [file1.txt, file2.txt] are now not ignored in .gitignore if they should be committed unencrypted.`);
  });

  it('deve remover arquivos criptografados quando cleanEncrypted é true', async () => {
    // Executar comando com cleanEncrypted
    // @ts-ignore
    await gitSecretRemove.action([mockPathspec], { cleanEncrypted: true });

    // Verificar chamadas
    expect(utils.fsdbRemoveRecord).toHaveBeenCalledWith(mockNormalizedPath);
    expect(utils.getEncryptedFilePath).toHaveBeenCalledWith(mockAbsolutePath);
    expect(fs.unlink).toHaveBeenCalledWith(mockEncryptedPath);
  });

  it('deve ignorar erros ENOENT ao excluir arquivos criptografados', async () => {
    // Simular erro de arquivo não encontrado
    const notFoundError = new Error('ENOENT: File not found');
    Object.defineProperty(notFoundError, 'code', { value: 'ENOENT' });
    vi.mocked(fs.unlink).mockRejectedValue(notFoundError);

    // Executar comando com cleanEncrypted
    // @ts-ignore
    await gitSecretRemove.action([mockPathspec], { cleanEncrypted: true });

    // Verificar que o processo continua normalmente
    expect(fs.unlink).toHaveBeenCalledWith(mockEncryptedPath);
    expect(utils.message).toHaveBeenCalledWith('Removed 1 item(s) from index.');
    expect(utils.warn).not.toHaveBeenCalled();
  });

  it('deve mostrar aviso para erros que não são ENOENT ao excluir arquivos criptografados', async () => {
    // Simular erro de permissão negada
    const permissionError = new Error('EACCES: Permission denied');
    Object.defineProperty(permissionError, 'code', { value: 'EACCES' });
    vi.mocked(fs.unlink).mockRejectedValue(permissionError);

    // Executar comando com cleanEncrypted
    // @ts-ignore
    await gitSecretRemove.action([mockPathspec], { cleanEncrypted: true });

    // Verificar que o aviso é exibido
    expect(fs.unlink).toHaveBeenCalledWith(mockEncryptedPath);
    expect(utils.warn).toHaveBeenCalledWith(`Failed to delete encrypted file ${mockEncryptedPath}: EACCES: Permission denied`);
    expect(utils.message).toHaveBeenCalledWith('Removed 1 item(s) from index.');
  });

  it('deve exibir mensagem quando arquivo não é encontrado no índice', async () => {
    // Configurar que o arquivo não foi encontrado no índice
    vi.mocked(utils.fsdbRemoveRecord).mockResolvedValue(false);

    // Configurar modo verbose
    const originalValue = utils.SECRETS_VERBOSE;
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: true,
      configurable: true
    });

    // Executar comando
    // @ts-ignore
    await gitSecretRemove.action([mockPathspec], {});

    // Verificar mensagem
    expect(utils.message).toHaveBeenCalledWith(`File not found in index: ${mockNormalizedPath}`);
    expect(utils.message).toHaveBeenCalledWith('No items removed from index.');

    // Restaurar original
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: originalValue,
      configurable: true
    });
  });

  it('deve exibir mensagens adicionais no modo verbose', async () => {
    // Configurar modo verbose
    const originalValue = utils.SECRETS_VERBOSE;
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: true,
      configurable: true
    });

    // Executar comando com cleanEncrypted
    // @ts-ignore
    await gitSecretRemove.action([mockPathspec], { cleanEncrypted: true });

    // Verificar mensagens
    expect(utils.message).toHaveBeenCalledWith(`Removed from index: ${mockNormalizedPath}`);
    expect(utils.message).toHaveBeenCalledWith(`Deleted encrypted file: ${mockEncryptedPath}`);

    // Restaurar original
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: originalValue,
      configurable: true
    });
  });

  it('deve abortar se não estiver em um repositório git', async () => {
    vi.mocked(utils.getGitRootPath).mockResolvedValue('');

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretRemove.action([mockPathspec], {})).rejects.toThrow('Not in a git repository.');
    expect(utils.abort).toHaveBeenCalledWith('Not in a git repository.');
  });

  it('deve abortar quando ocorre um erro', async () => {
    // Simular erro durante a execução
    const mockError = new Error('Teste de erro');
    vi.mocked(utils.fsdbRemoveRecord).mockRejectedValue(mockError);

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretRemove.action([mockPathspec], {})).rejects.toThrow("Error in 'remove' command: Teste de erro");
    expect(utils.abort).toHaveBeenCalledWith("Error in 'remove' command: Teste de erro");
  });

  it('deve verificar a estrutura do comando exportado', () => {
    expect(gitSecretRemove.name).toBe('remove');
    expect(gitSecretRemove.description).toBe('Removes files from index.');
    expect(typeof gitSecretRemove.action).toBe('function');
  });
});
