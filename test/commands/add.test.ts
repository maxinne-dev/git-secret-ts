import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

// Mock das dependências
vi.mock('path');
vi.mock('fs/promises');
vi.mock('../../src/utils', () => ({
  userRequired: vi.fn(),
  getGitRootPath: vi.fn(),
  gitNormalizeFilename: vi.fn(),
  isTrackedInGit: vi.fn(),
  checkIgnore: vi.fn(),
  addFileToGitignore: vi.fn(),
  fsdbAddRecord: vi.fn(),
  message: vi.fn(),
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
import gitSecretAdd from '../../src/commands/add';
import * as utils from '../../src/utils';

describe('git-secret-add command', () => {
  const mockGitRoot = '/path/to/git/repo';
  const mockPathspec = 'file.txt';
  const mockNormalizedPath = 'file.txt';
  const mockAbsolutePath = '/path/to/git/repo/file.txt';

  beforeEach(() => {
    vi.resetAllMocks();

    // Configuração dos mocks para o cenário feliz
    vi.mocked(utils.getGitRootPath).mockResolvedValue(mockGitRoot);
    vi.mocked(utils.gitNormalizeFilename).mockResolvedValue(mockNormalizedPath);
    vi.mocked(path.join).mockReturnValue(mockAbsolutePath);
    vi.mocked(utils.isTrackedInGit).mockResolvedValue(false);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(utils.checkIgnore).mockResolvedValue(false);
    vi.mocked(utils.fsdbAddRecord).mockResolvedValue(true);
    vi.mocked(utils.abort).mockImplementation((msg) => {
      throw new Error(msg);
    });
  });

  it('deve adicionar arquivos ao rastreamento git-secret corretamente', async () => {
    // Executa a ação do comando
    // @ts-ignore
    await gitSecretAdd.action([mockPathspec], {});

    // Verificações
    expect(utils.userRequired).toHaveBeenCalled();
    expect(utils.getGitRootPath).toHaveBeenCalled();
    expect(utils.gitNormalizeFilename).toHaveBeenCalledWith(mockPathspec);
    expect(path.join).toHaveBeenCalledWith(mockGitRoot, mockNormalizedPath);
    expect(utils.isTrackedInGit).toHaveBeenCalledWith(mockAbsolutePath);
    expect(fs.access).toHaveBeenCalledWith(mockAbsolutePath);
    expect(utils.checkIgnore).toHaveBeenCalledWith(mockAbsolutePath);
    expect(utils.addFileToGitignore).toHaveBeenCalledWith(mockNormalizedPath);
    expect(utils.fsdbAddRecord).toHaveBeenCalledWith(mockNormalizedPath);
    expect(utils.message).toHaveBeenCalledWith('1 item(s) added.');
  });

  it('deve adicionar múltiplos arquivos ao rastreamento', async () => {
    const mockPathspecs = ['file1.txt', 'file2.txt'];
    const mockNormalizedPaths = ['file1.txt', 'file2.txt'];
    const mockAbsolutePaths = [
      '/path/to/git/repo/file1.txt',
      '/path/to/git/repo/file2.txt',
    ];

    vi.mocked(utils.gitNormalizeFilename)
      .mockResolvedValueOnce(mockNormalizedPaths[0])
      .mockResolvedValueOnce(mockNormalizedPaths[1]);

    vi.mocked(path.join)
      .mockReturnValueOnce(mockAbsolutePaths[0])
      .mockReturnValueOnce(mockAbsolutePaths[1]);

    vi.mocked(utils.isTrackedInGit).mockResolvedValue(false);
    vi.mocked(utils.checkIgnore).mockResolvedValue(false);
    vi.mocked(utils.fsdbAddRecord).mockResolvedValue(true);

    // @ts-ignore
    await gitSecretAdd.action(mockPathspecs, {});

    expect(utils.gitNormalizeFilename).toHaveBeenCalledTimes(2);
    expect(utils.addFileToGitignore).toHaveBeenCalledTimes(2);
    expect(utils.fsdbAddRecord).toHaveBeenCalledTimes(2);
    expect(utils.message).toHaveBeenCalledWith('2 item(s) added.');
  });

  it('deve ativar o modo verbose quando a opção verbose é verdadeira', async () => {
    // @ts-ignore
    await gitSecretAdd.action([mockPathspec], { verbose: true });

    expect(utils.setVerbose).toHaveBeenCalledWith(true);
  });

  it('deve abortar se não estiver em um repositório git', async () => {
    vi.mocked(utils.getGitRootPath).mockResolvedValue('');

    // @ts-ignore
    await expect(gitSecretAdd.action([mockPathspec], {})).rejects.toThrow('Not in a git repository.');

    expect(utils.abort).toHaveBeenCalledWith('Not in a git repository.');
    expect(utils.fsdbAddRecord).not.toHaveBeenCalled();
  });

  it('deve abortar se o arquivo já estiver rastreado pelo git', async () => {
    vi.mocked(utils.isTrackedInGit).mockResolvedValue(true);

    // @ts-ignore
    await expect(gitSecretAdd.action([mockPathspec], {})).rejects.toThrow(
      `File '${mockPathspec}' is tracked in git. Consider using 'git rm --cached ${mockPathspec}'.`
    );

    expect(utils.abort).toHaveBeenCalledWith(
      `File '${mockPathspec}' is tracked in git. Consider using 'git rm --cached ${mockPathspec}'.`
    );
    expect(utils.fsdbAddRecord).not.toHaveBeenCalled();
  });

  it('deve abortar se o arquivo não for encontrado', async () => {
    const fileNotFoundError = new Error('File not found');
    vi.mocked(fs.access).mockRejectedValue(fileNotFoundError);

    // @ts-ignore
    await expect(gitSecretAdd.action([mockPathspec], {})).rejects.toThrow(
      `File not found: ${mockPathspec}`
    );

    expect(utils.abort).toHaveBeenCalledWith(`File not found: ${mockPathspec}`);
    expect(utils.fsdbAddRecord).not.toHaveBeenCalled();
  });

  it('não deve adicionar ao .gitignore se o arquivo já estiver ignorado', async () => {
    vi.mocked(utils.checkIgnore).mockResolvedValue(true);

    // @ts-ignore
    await gitSecretAdd.action([mockPathspec], {});

    expect(utils.addFileToGitignore).not.toHaveBeenCalled();
    expect(utils.fsdbAddRecord).toHaveBeenCalledWith(mockNormalizedPath);
  });

  it('deve mostrar mensagem adicional se SECRETS_VERBOSE for verdadeiro', async () => {
    // Temporariamente substitui a propriedade SECRETS_VERBOSE
    const originalValue = utils.SECRETS_VERBOSE;
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: true,
      configurable: true
    });

    // @ts-ignore
    await gitSecretAdd.action([mockPathspec], {});

    expect(utils.message).toHaveBeenCalledWith(`Adding file: ${mockNormalizedPath}`);

    // Restaura o valor original
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: originalValue,
      configurable: true
    });
  });

  it('deve verificar a estrutura do comando exportado', () => {
    expect(gitSecretAdd.name).toBe('add');
    expect(gitSecretAdd.description).toBe('Starts to track added files.');
    expect(typeof gitSecretAdd.action).toBe('function');
  });
});