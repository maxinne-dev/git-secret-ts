import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

// Mock das dependências
vi.mock('path');
vi.mock('fs/promises');
vi.mock('../../src/utils', () => ({
  userRequired: vi.fn(),
  getGitRootPath: vi.fn(),
  readPathMapping: vi.fn(),
  getEncryptedFilePath: vi.fn(),
  message: vi.fn(),
  warn: vi.fn(),
  abort: vi.fn(),
  setVerbose: vi.fn(),
  SECRETS_VERBOSE: false,
  toCommand: vi.fn((name, description, actionFn) => ({
    name,
    description,
    action: actionFn,
  })),
}));

// Importar após configurar os mocks
import gitSecretClean from '../../src/commands/clean';
import * as utils from '../../src/utils';

describe('git-secret-clean command', () => {
  const mockGitRoot = '/path/to/git/repo';
  const mockMappings = [
    { filePath: 'file1.txt', realPath: 'file1.txt' },
    { filePath: 'path/to/file2.txt', realPath: 'path/to/file2.txt' }
  ];
  const mockEncryptedPaths = [
    '/path/to/git/repo/file1.txt.secret',
    '/path/to/git/repo/path/to/file2.txt.secret'
  ];
  const mockAbsolutePaths = [
    '/path/to/git/repo/file1.txt',
    '/path/to/git/repo/path/to/file2.txt'
  ];

  beforeEach(() => {
    vi.resetAllMocks();

    // Configuração default para o cenário feliz
    vi.mocked(utils.userRequired).mockResolvedValue(undefined);
    vi.mocked(utils.getGitRootPath).mockResolvedValue(mockGitRoot);
    // @ts-ignore
    vi.mocked(utils.readPathMapping).mockResolvedValue(mockMappings);
    vi.mocked(path.join)
      .mockReturnValueOnce(mockAbsolutePaths[0])
      .mockReturnValueOnce(mockAbsolutePaths[1]);
    vi.mocked(utils.getEncryptedFilePath)
      .mockReturnValueOnce(mockEncryptedPaths[0])
      .mockReturnValueOnce(mockEncryptedPaths[1]);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.mocked(utils.abort).mockImplementation((msg: string) => {
      throw new Error(msg);
    });
  });

  it('deve limpar os arquivos criptografados corretamente', async () => {
    // Executar comando
    // @ts-ignore
    await gitSecretClean.action([], {});

    // Verificar chamadas
    expect(utils.userRequired).toHaveBeenCalled();
    expect(utils.getGitRootPath).toHaveBeenCalled();
    expect(utils.readPathMapping).toHaveBeenCalled();
    expect(path.join).toHaveBeenCalledTimes(2);
    expect(utils.getEncryptedFilePath).toHaveBeenCalledTimes(2);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.unlink).toHaveBeenCalledWith(mockEncryptedPaths[0]);
    expect(fs.unlink).toHaveBeenCalledWith(mockEncryptedPaths[1]);
    expect(utils.message).toHaveBeenCalledWith('Clean complete.');
  });

  it('deve ativar o modo verbose quando a opção verbose é verdadeira', async () => {
    // Executar comando com opção verbose
    // @ts-ignore
    await gitSecretClean.action([], { verbose: true });

    // Verificar que o modo verbose foi ativado
    expect(utils.setVerbose).toHaveBeenCalledWith(true);
  });

  it('deve exibir mensagens detalhadas em modo verbose', async () => {
    // Temporariamente substitui a propriedade SECRETS_VERBOSE
    const originalValue = utils.SECRETS_VERBOSE;
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: true,
      configurable: true
    });

    // Executar comando
    // @ts-ignore
    await gitSecretClean.action([], {});

    // Verificar mensagens em modo verbose
    expect(utils.message).toHaveBeenCalledWith(`Deleted: ${mockEncryptedPaths[0]}`);
    expect(utils.message).toHaveBeenCalledWith(`Deleted: ${mockEncryptedPaths[1]}`);
    expect(utils.message).toHaveBeenCalledWith('Clean complete.');

    // Restaura o valor original
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: originalValue,
      configurable: true
    });
  });

  it('deve exibir mensagem quando não há arquivos rastreados no modo verbose', async () => {
    // Configurar mock para retornar array vazio
    vi.mocked(utils.readPathMapping).mockResolvedValue([]);
    
    // Temporariamente substitui a propriedade SECRETS_VERBOSE
    const originalValue = utils.SECRETS_VERBOSE;
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: true,
      configurable: true
    });

    // Executar comando
    // @ts-ignore
    await gitSecretClean.action([], {});

    // Verificar mensagem
    expect(utils.message).toHaveBeenCalledWith('No files are currently tracked by git-secret.');
    expect(utils.message).toHaveBeenCalledWith('Clean complete.');

    // Restaura o valor original
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: originalValue,
      configurable: true
    });
  });

  it('deve ignorar arquivos que não existem', async () => {
    // Simular erro de arquivo não encontrado para o primeiro arquivo
    const notFoundError = new Error('ENOENT: File not found');
    Object.defineProperty(notFoundError, 'code', { value: 'ENOENT' });
    vi.mocked(fs.unlink).mockRejectedValueOnce(notFoundError);

    // Executar comando
    // @ts-ignore
    await gitSecretClean.action([], {});

    // Verificar que o comando continua após o erro
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(utils.message).toHaveBeenCalledWith('Clean complete.');
  });

  it('deve mostrar aviso para erros que não são ENOENT', async () => {
    // Simular erro de permissão para o primeiro arquivo
    const permissionError = new Error('EACCES: Permission denied');
    Object.defineProperty(permissionError, 'code', { value: 'EACCES' });
    vi.mocked(fs.unlink).mockRejectedValueOnce(permissionError);

    // Executar comando
    // @ts-ignore
    await gitSecretClean.action([], {});

    // Verificar que exibe aviso mas continua
    expect(utils.warn).toHaveBeenCalledWith(`Failed to delete ${mockEncryptedPaths[0]}: EACCES: Permission denied`);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(utils.message).toHaveBeenCalledWith('Clean complete.');
  });

  it('deve exibir mensagem para arquivos não encontrados no modo verbose', async () => {
    // Simular erro de arquivo não encontrado
    const notFoundError = new Error('ENOENT: File not found');
    Object.defineProperty(notFoundError, 'code', { value: 'ENOENT' });
    vi.mocked(fs.unlink).mockRejectedValueOnce(notFoundError);
    
    // Temporariamente substitui a propriedade SECRETS_VERBOSE
    const originalValue = utils.SECRETS_VERBOSE;
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: true,
      configurable: true
    });

    // Executar comando
    // @ts-ignore
    await gitSecretClean.action([], {});

    // Verificar mensagem
    expect(utils.message).toHaveBeenCalledWith(`Skipped (not found): ${mockEncryptedPaths[0]}`);
    
    // Restaura o valor original
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: originalValue,
      configurable: true
    });
  });

  it('deve abortar se não estiver em um repositório git', async () => {
    vi.mocked(utils.getGitRootPath).mockResolvedValue('');

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretClean.action([], {})).rejects.toThrow('Not in a git repository.');
    expect(utils.abort).toHaveBeenCalledWith('Not in a git repository.');
  });

  it('deve abortar quando ocorre um erro', async () => {
    // Simular erro durante a execução
    const mockError = new Error('Teste de erro');
    vi.mocked(utils.readPathMapping).mockRejectedValue(mockError);

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretClean.action([], {})).rejects.toThrow("Error in 'clean' command: Teste de erro");
    expect(utils.abort).toHaveBeenCalledWith("Error in 'clean' command: Teste de erro");
  });

  it('deve verificar a estrutura do comando exportado', () => {
    expect(gitSecretClean.name).toBe('clean');
    expect(gitSecretClean.description).toBe('Removes all the encrypted files.');
    expect(typeof gitSecretClean.action).toBe('function');
  });
});
