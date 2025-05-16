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
  getOctalPerms: vi.fn(),
  readPathMapping: vi.fn(),
  decryptFile: vi.fn(),
  message: vi.fn(),
  warn: vi.fn(),
  warnOrAbort: vi.fn(),
  abort: vi.fn(),
  setVerbose: vi.fn(),
  SECRETS_VERBOSE: false,
  SECRETS_EXTENSION: '.secret',
  toCommand: vi.fn((name, description, actionFn) => ({
    name,
    description,
    action: actionFn,
  })),
}));

// Importar após configurar os mocks
import gitSecretReveal from '../../src/commands/reveal';
import * as utils from '../../src/utils';

describe('git-secret-reveal command', () => {
  const mockGitRoot = '/path/to/git/repo';
  const mockPathspec = 'file.txt';
  const mockNormalizedPath = 'file.txt';
  const mockAbsolutePath = '/path/to/git/repo/file.txt';
  const mockEncryptedPath = '/path/to/git/repo/file.txt.secret';
  const mockPrivateKey = '-----BEGIN PGP PRIVATE KEY BLOCK-----\nMOCK_KEY\n-----END PGP PRIVATE KEY BLOCK-----';
  const mockPassphrase = 'test-passphrase';
  const mockDecryptedData = 'decrypted content';
  
  // Backup das variáveis de ambiente originais
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();

    // Configuração default para o cenário feliz
    vi.mocked(utils.userRequired).mockResolvedValue(undefined);
    vi.mocked(utils.getGitRootPath).mockResolvedValue(mockGitRoot);
    vi.mocked(utils.gitNormalizeFilename).mockResolvedValue(mockNormalizedPath);
    vi.mocked(path.join).mockReturnValue(mockAbsolutePath);
    vi.mocked(utils.getEncryptedFilePath).mockReturnValue(mockEncryptedPath);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(utils.decryptFile).mockResolvedValue(mockDecryptedData);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(utils.getOctalPerms).mockResolvedValue('0600');
    vi.mocked(fs.chmod).mockResolvedValue(undefined);
    vi.mocked(utils.abort).mockImplementation((msg: string) => {
      throw new Error(msg);
    });
    vi.mocked(utils.warnOrAbort).mockImplementation((shouldAbort: boolean, msg: string) => {
      if (shouldAbort) throw new Error(msg);
    });
    
    // Manejar as variáveis de ambiente de forma segura
    const envBackup = { ...process.env };
    process.env = { ...envBackup };
    process.env.GPG_PRIVATE_KEY = undefined;
    process.env.GPG_PASSPHRASE = undefined;
  });

  afterEach(() => {
    // Restaurar as variáveis de ambiente originais
    process.env = { ...originalEnv };
  });

  it('deve descriptografar um arquivo específico corretamente', async () => {
    // Executar comando com um pathspec
    // @ts-ignore
    await gitSecretReveal.action([mockPathspec], { privateKey: mockPrivateKey, passphrase: mockPassphrase });

    // Verificar chamadas
    expect(utils.userRequired).toHaveBeenCalled();
    expect(utils.getGitRootPath).toHaveBeenCalled();
    expect(utils.gitNormalizeFilename).toHaveBeenCalledWith(mockPathspec);
    expect(utils.getEncryptedFilePath).toHaveBeenCalledWith(mockAbsolutePath);
    expect(fs.access).toHaveBeenCalledWith(mockEncryptedPath);
    expect(utils.decryptFile).toHaveBeenCalledWith(mockEncryptedPath, mockPrivateKey, mockPassphrase);
    expect(fs.writeFile).toHaveBeenCalledWith(mockAbsolutePath, mockDecryptedData);
    expect(utils.message).toHaveBeenCalledWith('Done. 1 of 1 files are revealed.');
  });

  it('deve descriptografar todos os arquivos rastreados quando nenhum pathspec é fornecido', async () => {
    const mockMappings = [
      { filePath: 'file1.txt', realPath: 'file1.txt' },
      { filePath: 'file2.txt', realPath: 'file2.txt' }
    ];
    
    const mockNormalizedPaths = ['file1.txt', 'file2.txt'];
    const mockAbsolutePaths = [
      '/path/to/git/repo/file1.txt',
      '/path/to/git/repo/file2.txt'
    ];
    const mockEncryptedPaths = [
      '/path/to/git/repo/file1.txt.secret',
      '/path/to/git/repo/file2.txt.secret'
    ];

    // @ts-ignore
    vi.mocked(utils.readPathMapping).mockResolvedValue(mockMappings);
    vi.mocked(utils.gitNormalizeFilename)
      .mockResolvedValueOnce(mockNormalizedPaths[0])
      .mockResolvedValueOnce(mockNormalizedPaths[1]);

    vi.mocked(path.join)
      .mockReturnValueOnce(mockAbsolutePaths[0])
      .mockReturnValueOnce(mockAbsolutePaths[1]);

    vi.mocked(utils.getEncryptedFilePath)
      .mockReturnValueOnce(mockEncryptedPaths[0])
      .mockReturnValueOnce(mockEncryptedPaths[1]);

    // Executar comando sem pathspec
    // @ts-ignore
    await gitSecretReveal.action([], { privateKey: mockPrivateKey });

    // Verificar que ambos os arquivos foram processados
    expect(utils.readPathMapping).toHaveBeenCalled();
    expect(utils.gitNormalizeFilename).toHaveBeenCalledTimes(2);
    expect(utils.decryptFile).toHaveBeenCalledTimes(2);
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(utils.message).toHaveBeenCalledWith('Done. 2 of 2 files are revealed.');
  });

  it('deve usar a chave privada da variável de ambiente quando não fornecida por parâmetro', async () => {
    // Configurar variável de ambiente
    process.env.GPG_PRIVATE_KEY = mockPrivateKey;
    process.env.GPG_PASSPHRASE = mockPassphrase;

    // Executar comando sem fornecer a chave privada
    // @ts-ignore
    await gitSecretReveal.action([mockPathspec], {});

    // Verificar que a chave privada da variável de ambiente foi usada
    expect(utils.decryptFile).toHaveBeenCalledWith(mockEncryptedPath, mockPrivateKey, mockPassphrase);
  });

  it('deve ativar o modo verbose quando a opção verbose é verdadeira', async () => {
    // Executar comando com opção verbose
    // @ts-ignore
    await gitSecretReveal.action([mockPathspec], { privateKey: mockPrivateKey, verbose: true });

    // Verificar que o modo verbose foi ativado
    expect(utils.setVerbose).toHaveBeenCalledWith(true);
  });

  // TODO: Find out why the flag 'forceOverwrite' is ignored.
  // it('deve abortar se o arquivo de saída já existir e forceOverwrite for falso', async () => {
  //   // Configurar que o arquivo não criptografado já existe
  //   // Primeiro acesso é para o arquivo criptografado, segundo para o arquivo não criptografado
  //   vi.mocked(fs.access)
  //     .mockResolvedValueOnce(undefined)  // arquivo criptografado existe
  //     .mockResolvedValueOnce(undefined); // arquivo não criptografado também existe
  //
  //   // Executar comando sem forceOverwrite
  //   // @ts-ignore
  //   await gitSecretReveal.action([mockPathspec], { privateKey: mockPrivateKey });
  //
  //   // Verificar que warnOrAbort foi chamado
  //   expect(utils.warnOrAbort).toHaveBeenCalledWith(
  //     true,
  //     `Unencrypted file ${mockAbsolutePath} already exists. Use -f to overwrite.`
  //   );
  //   // Verificar que não houve descriptografia
  //   expect(utils.decryptFile).not.toHaveBeenCalled();
  // });

  it('deve sobrescrever arquivo existente quando forceOverwrite é verdadeiro', async () => {
    // Configurar que o arquivo não criptografado já existe
    vi.mocked(fs.access)
      .mockResolvedValueOnce(undefined)  // arquivo criptografado existe
      .mockResolvedValueOnce(undefined); // arquivo não criptografado também existe

    // Executar comando com forceOverwrite
    // @ts-ignore
    await gitSecretReveal.action([mockPathspec], { privateKey: mockPrivateKey, forceOverwrite: true });

    // Verificar que o processo continuou mesmo com o arquivo existente
    expect(utils.decryptFile).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('deve preservar permissões quando preservePermissions é verdadeiro', async () => {
    // Executar comando com preservePermissions
    // @ts-ignore
    await gitSecretReveal.action([mockPathspec], { privateKey: mockPrivateKey, preservePermissions: true });

    // Verificar que as permissões foram preservadas
    expect(utils.getOctalPerms).toHaveBeenCalledWith(mockEncryptedPath);
    expect(fs.chmod).toHaveBeenCalledWith(mockAbsolutePath, 0o600);
  });

  it('deve exibir mensagens detalhadas no modo verbose', async () => {
    // Configurar modo verbose
    const originalValue = utils.SECRETS_VERBOSE;
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: true,
      configurable: true
    });

    // Executar comando
    // @ts-ignore
    await gitSecretReveal.action([mockPathspec], { privateKey: mockPrivateKey, preservePermissions: true });

    // Verificar mensagens em modo verbose
    expect(utils.message).toHaveBeenCalledWith(`Revealed: ${mockAbsolutePath}`);
    expect(utils.message).toHaveBeenCalledWith(`Set permissions of ${mockAbsolutePath} to 0600`);

    // Restaurar original
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: originalValue,
      configurable: true
    });
  });

  it('deve lidar com erros ao preservar permissões', async () => {
    // Simular erro durante chmod
    const permissionError = new Error('Permission denied');
    vi.mocked(fs.chmod).mockRejectedValue(permissionError);

    // Executar comando com preservePermissions
    // @ts-ignore
    await gitSecretReveal.action([mockPathspec], { privateKey: mockPrivateKey, preservePermissions: true });

    // Verificar aviso
    expect(utils.warn).toHaveBeenCalledWith(`Could not preserve permissions for ${mockAbsolutePath}: Permission denied`);
    // Processo deve continuar
    expect(utils.message).toHaveBeenCalledWith('Done. 1 of 1 files are revealed.');
  });

  // TODO: Fix these tests
  // it('deve ignorar arquivos com extensão .secret', async () => {
  //   // Configurar pathspec com extensão .secret
  //   const secretPathspec = 'file.txt.secret';
  //   vi.mocked(utils.gitNormalizeFilename).mockResolvedValue(secretPathspec);
  //
  //   // Executar comando
  //   // @ts-ignore
  //   await gitSecretReveal.action([secretPathspec], { privateKey: mockPrivateKey });
  //
  //   // Verificar que warnOrAbort foi chamado
  //   expect(utils.warnOrAbort).toHaveBeenCalledWith(
  //     true,
  //     expect.stringContaining('Cannot decrypt to secret version of file:')
  //   );
  //   // Nenhuma descriptografia deve ocorrer
  //   expect(utils.decryptFile).not.toHaveBeenCalled();
  // });
  //
  // it('deve abortar se não encontrar o arquivo criptografado', async () => {
  //   // Simular erro ao acessar o arquivo criptografado
  //   const notFoundError = new Error('File not found');
  //   vi.mocked(fs.access).mockRejectedValue(notFoundError);
  //
  //   // Executar comando
  //   // @ts-ignore
  //   await gitSecretReveal.action([mockPathspec], { privateKey: mockPrivateKey });
  //
  //   // Verificar que warnOrAbort foi chamado
  //   expect(utils.warnOrAbort).toHaveBeenCalledWith(
  //     true,
  //     `Cannot find file to decrypt: ${mockEncryptedPath}`
  //   );
  //   // Nenhuma descriptografia deve ocorrer
  //   expect(utils.decryptFile).not.toHaveBeenCalled();
  // });
  //
  // it('deve continuar para o próximo arquivo se forceContinue for verdadeiro e ocorrer um erro', async () => {
  //   const mockMappings = [
  //     { filePath: 'file1.txt', realPath: 'file1.txt' },
  //     { filePath: 'file2.txt', realPath: 'file2.txt' }
  //   ];
  //
  //   // @ts-ignore
  //   vi.mocked(utils.readPathMapping).mockResolvedValue(mockMappings);
  //
  //   // Simular erro durante a descriptografia do primeiro arquivo
  //   const decryptError = new Error('Decryption failed');
  //   vi.mocked(utils.decryptFile)
  //     .mockRejectedValueOnce(decryptError)
  //     .mockResolvedValueOnce(mockDecryptedData);
  //
  //   // Executar comando com forceContinue
  //   // @ts-ignore
  //   await gitSecretReveal.action([], { privateKey: mockPrivateKey, forceContinue: true });
  //
  //   // Verificar que warnOrAbort foi chamado, mas o processo continuou
  //   expect(utils.warnOrAbort).toHaveBeenCalledWith(
  //     false,
  //     expect.stringContaining('Failed to decrypt')
  //   );
  //
  //   // O segundo arquivo deve ter sido processado
  //   expect(utils.decryptFile).toHaveBeenCalledTimes(2);
  //   expect(fs.writeFile).toHaveBeenCalledTimes(1);
  //
  //   // Mensagem final deve refletir o sucesso parcial
  //   expect(utils.message).toHaveBeenCalledWith('Done. 1 of 2 files are revealed.');
  // });

  it('deve abortar se não receber uma chave privada', async () => {
    // Garantir que não há chave privada no ambiente
    process.env.GPG_PRIVATE_KEY = undefined;
    
    // Executar comando sem fornecer a chave privada
    // @ts-ignore
    await expect(gitSecretReveal.action([mockPathspec], {}))
      .rejects.toThrow('Private key must be provided via --private-key option or GPG_PRIVATE_KEY env variable.');
    
    expect(utils.abort).toHaveBeenCalledWith('Private key must be provided via --private-key option or GPG_PRIVATE_KEY env variable.');
  });

  it('deve abortar se não estiver em um repositório git', async () => {
    vi.mocked(utils.getGitRootPath).mockResolvedValue('');

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretReveal.action([mockPathspec], { privateKey: mockPrivateKey }))
      .rejects.toThrow('Not in a git repository.');
    
    expect(utils.abort).toHaveBeenCalledWith('Not in a git repository.');
  });

  it('deve abortar quando ocorre um erro', async () => {
    // Simular erro durante a execução
    const mockError = new Error('Teste de erro');
    vi.mocked(utils.gitNormalizeFilename).mockRejectedValue(mockError);

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretReveal.action([mockPathspec], { privateKey: mockPrivateKey }))
      .rejects.toThrow("Error in 'reveal' command: Teste de erro");
    
    expect(utils.abort).toHaveBeenCalledWith("Error in 'reveal' command: Teste de erro");
  });

  it('deve verificar a estrutura do comando exportado', () => {
    expect(gitSecretReveal.name).toBe('reveal');
    expect(gitSecretReveal.description).toBe('Decrypts all added files.');
    expect(typeof gitSecretReveal.action).toBe('function');
  });
});
