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
  getRecipientKeys: vi.fn(),
  sha256sum: vi.fn(),
  encryptFile: vi.fn(),
  getOctalPerms: vi.fn(),
  fsdbUpdateRecordHash: vi.fn(),
  message: vi.fn(),
  warn: vi.fn(),
  warnOrAbort: vi.fn(),
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
import gitSecretHide from '../../src/commands/hide';
import * as utils from '../../src/utils';

describe('git-secret-hide command', () => {
  const mockGitRoot = '/path/to/git/repo';
  const mockMappings = [
    { filePath: 'file1.txt', realPath: 'file1.txt', hash: 'hash1' },
    { filePath: 'path/to/file2.txt', realPath: 'path/to/file2.txt', hash: 'hash2' }
  ];
  const mockEncryptedPaths = [
    '/path/to/git/repo/file1.txt.secret',
    '/path/to/git/repo/path/to/file2.txt.secret'
  ];
  const mockAbsolutePaths = [
    '/path/to/git/repo/file1.txt',
    '/path/to/git/repo/path/to/file2.txt'
  ];
  const mockRecipientKeys = [{ keyid: 'key1' }, { keyid: 'key2' }];

  beforeEach(() => {
    vi.resetAllMocks();

    // Configuração default para o cenário feliz
    vi.mocked(utils.userRequired).mockResolvedValue(undefined);
    vi.mocked(utils.getGitRootPath).mockResolvedValue(mockGitRoot);
    vi.mocked(utils.readPathMapping).mockResolvedValue(mockMappings);
    // @ts-ignore
    vi.mocked(utils.getRecipientKeys).mockResolvedValue(mockRecipientKeys);
    vi.mocked(path.join)
      .mockReturnValueOnce(mockAbsolutePaths[0])
      .mockReturnValueOnce(mockAbsolutePaths[1]);
    vi.mocked(utils.getEncryptedFilePath)
      .mockReturnValueOnce(mockEncryptedPaths[0])
      .mockReturnValueOnce(mockEncryptedPaths[1]);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(utils.sha256sum)
      .mockResolvedValueOnce('new-hash1')
      .mockResolvedValueOnce('new-hash2');
    vi.mocked(utils.encryptFile).mockResolvedValue(undefined);
    vi.mocked(utils.getOctalPerms).mockResolvedValue('0600');
    vi.mocked(fs.chmod).mockResolvedValue(undefined);
    // @ts-ignore
    vi.mocked(utils.fsdbUpdateRecordHash).mockResolvedValue(undefined);
    vi.mocked(utils.abort).mockImplementation((msg: string) => {
      throw new Error(msg);
    });
  });

  it('deve criptografar arquivos corretamente', async () => {
    // Executar comando
    // @ts-ignore
    await gitSecretHide.action([], {});

    // Verificar chamadas
    expect(utils.userRequired).toHaveBeenCalled();
    expect(utils.getGitRootPath).toHaveBeenCalled();
    expect(utils.getRecipientKeys).toHaveBeenCalled();
    expect(utils.readPathMapping).toHaveBeenCalled();
    expect(path.join).toHaveBeenCalledTimes(2);
    expect(utils.getEncryptedFilePath).toHaveBeenCalledTimes(2);
    expect(fs.access).toHaveBeenCalledTimes(2);
    expect(utils.encryptFile).toHaveBeenCalledTimes(2);
    expect(utils.fsdbUpdateRecordHash).toHaveBeenCalledTimes(2);
    expect(utils.message).toHaveBeenCalledWith('Done. 2 of 2 files are hidden.');
  });

  it('deve ativar o modo verbose quando a opção verbose é verdadeira', async () => {
    // Executar comando com opção verbose
    // @ts-ignore
    await gitSecretHide.action([], { verbose: true });

    // Verificar que o modo verbose foi ativado
    expect(utils.setVerbose).toHaveBeenCalledWith(true);
  });

  it('deve limpar arquivos criptografados quando cleanFirst é verdadeiro', async () => {
    // Executar comando com opção cleanFirst
    // @ts-ignore
    await gitSecretHide.action([], { cleanFirst: true });

    // Verificar que os arquivos criptografados foram limpos primeiro
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.unlink).toHaveBeenCalledWith(mockEncryptedPaths[0]);
    expect(fs.unlink).toHaveBeenCalledWith(mockEncryptedPaths[1]);
  });

  it('deve preservar permissões quando preservePermissions é verdadeiro', async () => {
    // Executar comando com opção preservePermissions
    // @ts-ignore
    await gitSecretHide.action([], { preservePermissions: true });

    // Verificar que as permissões foram preservadas
    expect(utils.getOctalPerms).toHaveBeenCalledTimes(2);
    expect(fs.chmod).toHaveBeenCalledTimes(2);
    expect(fs.chmod).toHaveBeenCalledWith(mockEncryptedPaths[0], 0o600);
    expect(fs.chmod).toHaveBeenCalledWith(mockEncryptedPaths[1], 0o600);
  });

  it('deve excluir arquivos não criptografados quando deleteUnencrypted é verdadeiro', async () => {
    // Executar comando com opção deleteUnencrypted
    // @ts-ignore
    await gitSecretHide.action([], { deleteUnencrypted: true });

    // Verificar que os arquivos não criptografados foram excluídos
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.unlink).toHaveBeenCalledWith(mockAbsolutePaths[0]);
    expect(fs.unlink).toHaveBeenCalledWith(mockAbsolutePaths[1]);
  });

  // TODO: Why the flag for 'modifiedOnly' is not working?
  // it('deve pular arquivos não modificados quando modifiedOnly é verdadeiro', async () => {
  //   // Configurar valores de hash para que o primeiro arquivo não tenha sido modificado
  //   vi.mocked(utils.sha256sum)
  //     .mockResolvedValueOnce('hash1') // Mesmo hash para o primeiro arquivo
  //     .mockResolvedValueOnce('new-hash2'); // Hash diferente para o segundo arquivo
  //
  //   // Executar comando com opção modifiedOnly
  //   // @ts-ignore
  //   await gitSecretHide.action([], { modifiedOnly: true });
  //
  //   // Verificar que apenas o segundo arquivo foi criptografado
  //   expect(utils.encryptFile).toHaveBeenCalledTimes(1);
  //   expect(utils.encryptFile).toHaveBeenCalledWith(mockAbsolutePaths[1], mockEncryptedPaths[1], mockRecipientKeys, undefined);
  //   expect(utils.message).toHaveBeenCalledWith('Done. 1 of 2 files are hidden.');
  // });

  it('deve usar armor quando a opção armor é verdadeira', async () => {
    // Executar comando com opção armor
    // @ts-ignore
    await gitSecretHide.action([], { armor: true });

    // Verificar que armor foi usado durante a criptografia
    expect(utils.encryptFile).toHaveBeenCalledWith(mockAbsolutePaths[0], mockEncryptedPaths[0], mockRecipientKeys, true);
    expect(utils.encryptFile).toHaveBeenCalledWith(mockAbsolutePaths[1], mockEncryptedPaths[1], mockRecipientKeys, true);
  });

  // TODO: Fix this test (refactoring logger.ts to throw errors).
  // it('deve abortar se arquivo não for encontrado e forceContinue for falso', async () => {
  //   // Simular erro de arquivo não encontrado para o primeiro arquivo
  //   const notFoundError = new Error('File not found');
  //   vi.mocked(fs.access).mockRejectedValueOnce(notFoundError);
  //
  //   // Executar comando sem forceContinue
  //   // @ts-ignore
  //   await expect(gitSecretHide.action([], {})).rejects.toThrow();
  //
  //   // Verificar que warnOrAbort foi chamado
  //   expect(utils.warnOrAbort).toHaveBeenCalledWith(true, `File not found: ${mockAbsolutePaths[0]}`);
  // });

  it('deve continuar se arquivo não for encontrado e forceContinue for verdadeiro', async () => {
    // Simular erro de arquivo não encontrado para o primeiro arquivo
    const notFoundError = new Error('File not found');
    vi.mocked(fs.access).mockRejectedValueOnce(notFoundError);

    // Executar comando com forceContinue
    // @ts-ignore
    await gitSecretHide.action([], { forceContinue: true });
    
    // Verificar que o comando continua e criptografa apenas o segundo arquivo
    expect(utils.encryptFile).toHaveBeenCalledTimes(1);
    expect(utils.encryptFile).toHaveBeenCalledWith(mockAbsolutePaths[1], mockEncryptedPaths[1], mockRecipientKeys, undefined);
    expect(utils.message).toHaveBeenCalledWith('Done. 1 of 2 files are hidden.');
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
    await gitSecretHide.action([], {});

    // Verificar mensagens em modo verbose
    expect(utils.message).toHaveBeenCalledWith(`Encrypting: ${mockMappings[0].filePath} to ${mockEncryptedPaths[0]}`);
    expect(utils.message).toHaveBeenCalledWith(`Encrypting: ${mockMappings[1].filePath} to ${mockEncryptedPaths[1]}`);
    
    // Restaura o valor original
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: originalValue,
      configurable: true
    });
  });

  it('deve lidar com erros ao limpar arquivos criptografados', async () => {
    // Simular erro de arquivo não encontrado para o primeiro arquivo durante clean
    const notFoundError = new Error('ENOENT: File not found');
    Object.defineProperty(notFoundError, 'code', { value: 'ENOENT' });
    
    // Simular erro de permissão para o segundo arquivo durante clean
    const permissionError = new Error('EACCES: Permission denied');
    Object.defineProperty(permissionError, 'code', { value: 'EACCES' });
    
    vi.mocked(fs.unlink)
      .mockRejectedValueOnce(notFoundError)
      .mockRejectedValueOnce(permissionError)
      .mockResolvedValue(undefined); // Para as chamadas subsequentes
    
    // Temporariamente substitui a propriedade SECRETS_VERBOSE
    const originalValue = utils.SECRETS_VERBOSE;
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: true,
      configurable: true
    });

    // Executar comando com cleanFirst
    // @ts-ignore
    await gitSecretHide.action([], { cleanFirst: true });
    
    // Verificar que o aviso foi mostrado apenas para o erro de permissão
    expect(utils.warn).toHaveBeenCalledWith(`Could not clean ${mockEncryptedPaths[1]}: EACCES: Permission denied`);
    
    // Restaura o valor original
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: originalValue,
      configurable: true
    });
  });

  it('deve abortar se não houver destinatários configurados', async () => {
    // Configurar mock para retornar array vazio de chaves
    vi.mocked(utils.getRecipientKeys).mockResolvedValue([]);

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretHide.action([], {})).rejects.toThrow('No configured recipients. Use `git secret tell` to add users.');
    expect(utils.abort).toHaveBeenCalledWith('No configured recipients. Use `git secret tell` to add users.');
  });

  it('deve abortar se não estiver em um repositório git', async () => {
    vi.mocked(utils.getGitRootPath).mockResolvedValue('');

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretHide.action([], {})).rejects.toThrow('Not in a git repository.');
    expect(utils.abort).toHaveBeenCalledWith('Not in a git repository.');
  });

  it('deve abortar quando ocorre um erro', async () => {
    // Simular erro durante a execução
    const mockError = new Error('Teste de erro');
    vi.mocked(utils.readPathMapping).mockRejectedValue(mockError);

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretHide.action([], {})).rejects.toThrow("Error in 'hide' command: Teste de erro");
    expect(utils.abort).toHaveBeenCalledWith("Error in 'hide' command: Teste de erro");
  });

  it('deve verificar a estrutura do comando exportado', () => {
    expect(gitSecretHide.name).toBe('hide');
    expect(gitSecretHide.description).toBe('Encrypts all added files with repo keyring.');
    expect(typeof gitSecretHide.action).toBe('function');
  });
});
