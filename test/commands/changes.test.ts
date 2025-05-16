import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { diffChars } from 'diff';

// Mock das dependências
vi.mock('path');
vi.mock('fs/promises');
vi.mock('diff');
vi.mock('../../src/utils', () => ({
  userRequired: vi.fn(),
  getGitRootPath: vi.fn(),
  gitNormalizeFilename: vi.fn(),
  getEncryptedFilePath: vi.fn(),
  readPathMapping: vi.fn(), // Adicionando esta dependência que estava faltando
  decryptFile: vi.fn(),
  message: vi.fn(),
  abort: vi.fn(),
  toCommand: vi.fn((name, description, actionFn) => ({
    name,
    description,
    action: actionFn,
  })),
}));

// Importar após configurar os mocks
import gitSecretChanges from '../../src/commands/changes';
import * as utils from '../../src/utils';

describe('git-secret-changes command', () => {
  const mockGitRoot = '/path/to/git/repo';
  const mockPathspec = 'file.txt';
  const mockNormalizedPath = 'file.txt';
  const mockAbsolutePath = '/path/to/git/repo/file.txt';
  const mockEncryptedPath = '/path/to/git/repo/file.txt.secret';
  const mockPrivateKeyPath = '/path/to/private/key.gpg';
  const mockPrivateKey = '-----BEGIN PGP PRIVATE KEY BLOCK-----\nMOCK_KEY\n-----END PGP PRIVATE KEY BLOCK-----';
  const mockPassphrase = 'secret-passphrase';
  const mockFileContent = Buffer.from('Current file content');
  const mockDecryptedContent = 'Decrypted content';

  // Mock para process.stderr.write
  const originalStderrWrite = process.stderr.write;
  // Backup das variáveis de ambiente originais
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    vi.resetAllMocks();
    process.stderr.write = vi.fn();
    
    // Configuração default para o cenário feliz
    vi.mocked(utils.userRequired).mockResolvedValue(undefined);
    vi.mocked(utils.getGitRootPath).mockResolvedValue(mockGitRoot);
    vi.mocked(utils.gitNormalizeFilename).mockResolvedValue(mockNormalizedPath);
    vi.mocked(path.join).mockReturnValue(mockAbsolutePath);
    vi.mocked(utils.getEncryptedFilePath).mockReturnValue(mockEncryptedPath);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(mockPrivateKey)  // Leitura da chave privada
      .mockResolvedValueOnce(mockFileContent); // Leitura do conteúdo atual do arquivo
    vi.mocked(utils.decryptFile).mockResolvedValue(mockDecryptedContent);
    vi.mocked(utils.abort).mockImplementation((msg: string) => {
      throw new Error(msg);
    });
    
    // Mock para diffChars
    // @ts-ignore
    vi.mocked(diffChars).mockReturnValue([
      { value: 'Common part', added: undefined, removed: undefined },
      { value: 'Added part', added: true, removed: undefined },
      { value: 'Removed part', added: undefined, removed: true }
    ]);

    // Manejar as variáveis de ambiente de forma segura
    // Em vez de deletar as propriedades, definimos como undefined
    const envBackup = { ...process.env };
    process.env = { ...envBackup };
    process.env.GPG_PRIVATE_KEY = undefined;
    process.env.GPG_PASSPHRASE = undefined;
  });

  afterEach(() => {
    process.stderr.write = originalStderrWrite;
    // Restaurar as variáveis de ambiente originais
    process.env = { ...originalEnv };
  });

  it('deve verificar alterações em um arquivo específico corretamente', async () => {
    // Executar comando
    // @ts-ignore
    await gitSecretChanges.action([mockPathspec], { privateKey: mockPrivateKeyPath, passphrase: mockPassphrase });

    // Verificar chamadas
    expect(utils.userRequired).toHaveBeenCalled();
    expect(utils.getGitRootPath).toHaveBeenCalled();
    expect(utils.gitNormalizeFilename).toHaveBeenCalledWith(mockPathspec);
    expect(utils.getEncryptedFilePath).toHaveBeenCalledWith(mockAbsolutePath);
    expect(fs.access).toHaveBeenCalledTimes(2);
    expect(fs.readFile).toHaveBeenCalledWith(mockPrivateKeyPath, 'utf8');
    expect(utils.decryptFile).toHaveBeenCalledWith(mockEncryptedPath, mockPrivateKey, mockPassphrase);

    // Verificar que as diferenças foram mostradas
    expect(diffChars).toHaveBeenCalledWith(mockFileContent.toString(), mockDecryptedContent.toString());
    expect(process.stderr.write).toHaveBeenCalledTimes(4); // 3 partes + 1 nova linha
  });

  // TODO: Fix this test
  // it('deve verificar todos os arquivos rastreados quando nenhum pathspec é fornecido', async () => {
  //   const mockMappings = [
  //     { filePath: 'file1.txt', realPath: 'file1.txt' },
  //     { filePath: 'file2.txt', realPath: 'file2.txt' }
  //   ];
  //
  //   // Configurar mock para diferentes arquivos
  //   vi.mocked(utils.readPathMapping).mockResolvedValue(mockMappings);
  //   vi.mocked(utils.gitNormalizeFilename)
  //     .mockResolvedValueOnce('file1.txt')
  //     .mockResolvedValueOnce('file2.txt');
  //
  //   const mockAbsolutePaths = [
  //     '/path/to/git/repo/file1.txt',
  //     '/path/to/git/repo/file2.txt'
  //   ];
  //   const mockEncryptedPaths = [
  //     '/path/to/git/repo/file1.txt.secret',
  //     '/path/to/git/repo/file2.txt.secret'
  //   ];
  //
  //   vi.mocked(path.join)
  //     .mockReturnValueOnce(mockAbsolutePaths[0])
  //     .mockReturnValueOnce(mockAbsolutePaths[1]);
  //
  //   vi.mocked(utils.getEncryptedFilePath)
  //     .mockReturnValueOnce(mockEncryptedPaths[0])
  //     .mockReturnValueOnce(mockEncryptedPaths[1]);
  //
  //   // Conteúdos iguais para o primeiro arquivo, diferentes para o segundo
  //   const identicalContent = Buffer.from('Identical content');
  //   vi.mocked(utils.decryptFile)
  //     .mockResolvedValueOnce(identicalContent.toString())
  //     .mockResolvedValueOnce(mockDecryptedContent);
  //
  //   vi.mocked(fs.readFile)
  //     .mockResolvedValueOnce(mockPrivateKey) // Leitura da chave privada
  //     .mockResolvedValueOnce(identicalContent) // Conteúdo do primeiro arquivo (idêntico)
  //     .mockResolvedValueOnce(mockFileContent); // Conteúdo do segundo arquivo (diferente)
  //
  //   // Mock para comparação de buffers
  //   vi.mocked(Buffer.compare) // TODO: Throwing 'mockReturnValueOnce' is not a function
  //     .mockReturnValueOnce(0) // Primeiro arquivo: sem diferenças
  //     .mockReturnValueOnce(1); // Segundo arquivo: com diferenças
  //
  //   // Executar comando sem pathspec
  //   // @ts-ignore
  //   await gitSecretChanges.action([], { privateKey: mockPrivateKeyPath, passphrase: mockPassphrase });
  //
  //   // Verificar que ambos os arquivos foram verificados
  //   expect(utils.gitNormalizeFilename).toHaveBeenCalledTimes(2);
  //   expect(utils.getEncryptedFilePath).toHaveBeenCalledTimes(2);
  //   expect(utils.decryptFile).toHaveBeenCalledTimes(2);
  //
  //   // Verificar mensagens apropriadas
  //   expect(utils.message).toHaveBeenCalledWith('No changes in file1.txt');
  //   expect(utils.message).toHaveBeenCalledWith('Changes in file2.txt:');
  // });

  // TODO: Test currently casts strings where it should be buffers
  // it('deve usar a chave privada da variável de ambiente quando não fornecida por parâmetro', async () => {
  //   // Configurar variável de ambiente de forma segura
  //   process.env.GPG_PRIVATE_KEY = mockPrivateKey;
  //   process.env.GPG_PASSPHRASE = mockPassphrase;
  //
  //   // Executar comando sem fornecer a chave privada
  //   // @ts-ignore
  //   await gitSecretChanges.action([mockPathspec], {});
  //
  //   // Verificar que a chave privada da variável de ambiente foi usada
  //   expect(fs.readFile).not.toHaveBeenCalledWith(mockPrivateKeyPath, 'utf8');
  //   expect(utils.decryptFile).toHaveBeenCalledWith(mockEncryptedPath, mockPrivateKey, mockPassphrase);
  // });

  it('deve abortar se não encontrar o arquivo criptografado', async () => {
    // Simular erro ao acessar o arquivo criptografado
    const notFoundError = new Error('File not found');
    vi.mocked(fs.access).mockRejectedValueOnce(notFoundError);

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretChanges.action([mockPathspec], { privateKey: mockPrivateKeyPath }))
      .rejects.toThrow(`Cannot find encrypted version of file: ${mockEncryptedPath}`);
    
    expect(utils.abort).toHaveBeenCalledWith(`Cannot find encrypted version of file: ${mockEncryptedPath}`);
  });

  it('deve abortar se não encontrar o arquivo original', async () => {
    // Simular erro ao acessar o arquivo original
    const notFoundError = new Error('File not found');
    vi.mocked(fs.access)
      .mockResolvedValueOnce(undefined) // primeiro acesso (arquivo criptografado) passa
      .mockRejectedValueOnce(notFoundError); // segundo acesso (arquivo original) falha

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretChanges.action([mockPathspec], { privateKey: mockPrivateKeyPath }))
      .rejects.toThrow(`File not found. Consider using 'git secret reveal': ${mockAbsolutePath}`);
    
    expect(utils.abort).toHaveBeenCalledWith(`File not found. Consider using 'git secret reveal': ${mockAbsolutePath}`);
  });

  it('deve abortar se não receber uma chave privada', async () => {
    // Garantir que não há chave privada no ambiente
    process.env.GPG_PRIVATE_KEY = undefined;
    
    // Executar comando sem fornecer a chave privada
    // @ts-ignore
    await expect(gitSecretChanges.action([mockPathspec], {}))
      .rejects.toThrow('Private key must be provided via --private-key option or GPG_PRIVATE_KEY env variable.');
    
    expect(utils.abort).toHaveBeenCalledWith('Private key must be provided via --private-key option or GPG_PRIVATE_KEY env variable.');
  });

  it('deve abortar se não estiver em um repositório git', async () => {
    vi.mocked(utils.getGitRootPath).mockResolvedValue('');

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretChanges.action([mockPathspec], { privateKey: mockPrivateKeyPath }))
      .rejects.toThrow('Not in a git repository.');
    
    expect(utils.abort).toHaveBeenCalledWith('Not in a git repository.');
  });

  it('deve abortar quando ocorre um erro', async () => {
    // Simular erro durante a execução
    const mockError = new Error('Teste de erro');
    vi.mocked(utils.gitNormalizeFilename).mockRejectedValue(mockError);

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretChanges.action([mockPathspec], { privateKey: mockPrivateKeyPath }))
      .rejects.toThrow("Error in 'changes' command: Teste de erro");
    
    expect(utils.abort).toHaveBeenCalledWith("Error in 'changes' command: Teste de erro");
  });

  it('deve verificar a estrutura do comando exportado', () => {
    expect(gitSecretChanges.name).toBe('changes');
    expect(gitSecretChanges.description).toBe('View diff of the hidden files.');
    expect(typeof gitSecretChanges.action).toBe('function');
  });
});
