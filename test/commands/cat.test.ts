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
  getEncryptedFilePath: vi.fn(),
  decryptFile: vi.fn(),
  abort: vi.fn(),
  warnOrAbort: vi.fn(),
  toCommand: vi.fn((name, description, actionFn) => ({
    name,
    description,
    action: actionFn,
  })),
}));

// Importar após configurar os mocks
import gitSecretCat from '../../src/commands/cat';
import * as utils from '../../src/utils';

describe('git-secret-cat command', () => {
  const mockGitRoot = '/path/to/git/repo';
  const mockFile = 'arquivo.txt';
  const mockNormalizedPath = 'arquivo.txt';
  const mockAbsolutePath = '/path/to/git/repo/arquivo.txt';
  const mockEncryptedPath = '/path/to/git/repo/arquivo.txt.secret';
  const mockDecryptedData = 'conteúdo descriptografado';
  const mockPrivateKeyArmored = '-----BEGIN PGP PRIVATE KEY BLOCK-----\n(conteúdo da chave)\n-----END PGP PRIVATE KEY BLOCK-----';
  const mockPassphrase = 'senha123';

  // Mock para process.stdout.write
  const originalStdoutWrite = process.stdout.write;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Configuração dos mocks para o cenário feliz
    vi.mocked(utils.userRequired).mockResolvedValue(undefined);
    vi.mocked(utils.getGitRootPath).mockResolvedValue(mockGitRoot);
    vi.mocked(utils.gitNormalizeFilename).mockResolvedValue(mockNormalizedPath);
    vi.mocked(path.join).mockReturnValue(mockAbsolutePath);
    vi.mocked(utils.getEncryptedFilePath).mockReturnValue(mockEncryptedPath);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(utils.decryptFile).mockResolvedValue(mockDecryptedData);
    vi.mocked(utils.abort).mockImplementation((msg: string) => {
      throw new Error(msg);
    });
    
    process.stdout.write = vi.fn();
    process.env.GPG_PRIVATE_KEY = undefined;
    process.env.GPG_PASSPHRASE = undefined;
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
  });

  it('deve decriptar e exibir o conteúdo do arquivo corretamente', async () => {
    // Executar o comando com opções explícitas
    // @ts-ignore
    await gitSecretCat.action([mockFile], {
      privateKey: mockPrivateKeyArmored,
      passphrase: mockPassphrase,
    });

    // Verificações
    expect(utils.userRequired).toHaveBeenCalled();
    expect(utils.getGitRootPath).toHaveBeenCalled();
    expect(utils.gitNormalizeFilename).toHaveBeenCalledWith(mockFile);
    expect(utils.getEncryptedFilePath).toHaveBeenCalledWith(mockAbsolutePath);
    expect(fs.access).toHaveBeenCalledWith(mockEncryptedPath);
    expect(utils.decryptFile).toHaveBeenCalledWith(
      mockEncryptedPath,
      mockPrivateKeyArmored,
      mockPassphrase
    );
    expect(process.stdout.write).toHaveBeenCalledWith(mockDecryptedData);
  });

  it('deve usar variáveis de ambiente quando não fornecidas nas opções', async () => {
    // Configurar variáveis de ambiente
    process.env.GPG_PRIVATE_KEY = mockPrivateKeyArmored;
    process.env.GPG_PASSPHRASE = mockPassphrase;

    // Executar o comando sem opções
    // @ts-ignore
    await gitSecretCat.action([mockFile], {});

    // Verificar que as variáveis de ambiente foram usadas
    expect(utils.decryptFile).toHaveBeenCalledWith(
      mockEncryptedPath,
      mockPrivateKeyArmored,
      mockPassphrase
    );
  });

  it('deve processar múltiplos arquivos quando fornecidos', async () => {
    const mockFiles = ['arquivo1.txt', 'arquivo2.txt'];
    const mockNormalizedPaths = ['arquivo1.txt', 'arquivo2.txt'];
    const mockAbsolutePaths = [
      '/path/to/git/repo/arquivo1.txt',
      '/path/to/git/repo/arquivo2.txt'
    ];
    const mockEncryptedPaths = [
      '/path/to/git/repo/arquivo1.txt.secret',
      '/path/to/git/repo/arquivo2.txt.secret'
    ];
    const mockDecryptedContents = [
      'conteúdo do arquivo 1',
      'conteúdo do arquivo 2'
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

    vi.mocked(utils.decryptFile)
      .mockResolvedValueOnce(mockDecryptedContents[0])
      .mockResolvedValueOnce(mockDecryptedContents[1]);

    // Executar o comando com múltiplos arquivos
    // @ts-ignore
    await gitSecretCat.action(mockFiles, {
      privateKey: mockPrivateKeyArmored,
    });

    // Verificações
    expect(utils.gitNormalizeFilename).toHaveBeenCalledTimes(2);
    expect(utils.getEncryptedFilePath).toHaveBeenCalledTimes(2);
    expect(fs.access).toHaveBeenCalledTimes(2);
    expect(utils.decryptFile).toHaveBeenCalledTimes(2);
    expect(process.stdout.write).toHaveBeenCalledTimes(2);
    expect(process.stdout.write).toHaveBeenNthCalledWith(1, mockDecryptedContents[0]);
    expect(process.stdout.write).toHaveBeenNthCalledWith(2, mockDecryptedContents[1]);
  });

  it('deve continuar para o próximo arquivo quando um arquivo não é encontrado', async () => {
    const mockFiles = ['arquivo1.txt', 'arquivo-inexistente.txt', 'arquivo3.txt'];
    
    // Configurar o segundo arquivo para falhar no acesso
    vi.mocked(fs.access)
      .mockResolvedValueOnce(undefined) // primeiro arquivo ok
      .mockRejectedValueOnce(new Error('ENOENT')) // segundo arquivo falha
      .mockResolvedValueOnce(undefined); // terceiro arquivo ok
    
    // Configurar outros mocks conforme necessário
    vi.mocked(utils.decryptFile).mockResolvedValue(mockDecryptedData);

    // Executar o comando
    // @ts-ignore
    await gitSecretCat.action(mockFiles, {
      privateKey: mockPrivateKeyArmored,
    });

    // Verificar que warnOrAbort foi chamado para o arquivo não encontrado
    expect(utils.warnOrAbort).toHaveBeenCalledWith(
      false,
      expect.stringContaining('Cannot find file to decrypt')
    );
    
    // Verificar que o processo continuou para o terceiro arquivo
    expect(utils.decryptFile).toHaveBeenCalledTimes(2); // apenas para arquivos 1 e 3
    expect(process.stdout.write).toHaveBeenCalledTimes(2);
  });

  it('deve abortar se não estiver em um repositório git', async () => {
    vi.mocked(utils.getGitRootPath).mockResolvedValue('');

    // @ts-ignore
    await expect(gitSecretCat.action([mockFile], {
      privateKey: mockPrivateKeyArmored,
    })).rejects.toThrow('Not in a git repository.');

    expect(utils.abort).toHaveBeenCalledWith('Not in a git repository.');
    expect(utils.decryptFile).not.toHaveBeenCalled();
  });

  // TODO: Fix this test
  // it('deve abortar se a chave privada não for fornecida', async () => {
  //   // Garantir que não há chave privada nas opções ou no ambiente
  //   process.env.GPG_PRIVATE_KEY = undefined;
  //
  //   // @ts-ignore
  //   await expect(gitSecretCat.action([mockFile], {})).resolves.toBeUndefined();
  //
  //   expect(utils.abort).toHaveBeenCalledWith(
  //     'Private key must be provided via --private-key option or GPG_PRIVATE_KEY env variable.'
  //   );
  //   expect(utils.decryptFile).not.toHaveBeenCalled();
  // });

  it('deve propagar erros do processo de decriptação', async () => {
    const mockError = new Error('Erro de decriptação');
    vi.mocked(utils.decryptFile).mockRejectedValue(mockError);

    // @ts-ignore
    await expect(gitSecretCat.action([mockFile], {
      privateKey: mockPrivateKeyArmored,
    })).rejects.toThrow("Error in 'cat' command: Erro de decriptação");

    expect(utils.abort).toHaveBeenCalledWith("Error in 'cat' command: Erro de decriptação");
  });

  it('deve verificar a estrutura do comando exportado', () => {
    expect(gitSecretCat.name).toBe('cat');
    expect(gitSecretCat.description).toBe('Decrypts files passed on command line to stdout.');
    expect(typeof gitSecretCat.action).toBe('function');
  });
});
