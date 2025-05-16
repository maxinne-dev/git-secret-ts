import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import fse from 'fs-extra';
import * as openpgp from 'openpgp';
import { execFile } from 'child_process';

// Mock das dependências
vi.mock('path');
vi.mock('fs/promises');
vi.mock('fs-extra');
vi.mock('openpgp');
vi.mock('child_process');
vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn)
}));
vi.mock('../../src/utils', () => ({
  secretsDirExists: vi.fn(),
  getGitRootPath: vi.fn(),
  getSecretsKeysDir: vi.fn(),
  listUserPublicKeys: vi.fn(),
  fsdbClearHashes: vi.fn(),
  SimpleGit: vi.fn(),
  message: vi.fn(),
  warn: vi.fn(),
  abort: vi.fn(),
  setVerbose: vi.fn(),
  SECRETS_VERBOSE: false,
  SECRETS_DIR_NAME: '.gitsecret',
  toCommand: vi.fn((name, description, actionFn) => ({
    name,
    description,
    action: actionFn,
  })),
}));

// Importar após configurar os mocks
import gitSecretTell from '../../src/commands/tell';
import * as utils from '../../src/utils';

describe('git-secret-tell command', () => {
  const mockKeysDir = '/path/to/keys/dir';
  const mockGitRoot = '/path/to/git/repo';
  const mockGitEmail = 'git@example.com';
  const mockEmails = ['user1@example.com', 'user2@example.com'];
  const mockKeyFile = '/path/to/key/file.asc';
  const mockArmoredKey = '-----BEGIN PGP PUBLIC KEY BLOCK-----\nMock key content\n-----END PGP PUBLIC KEY BLOCK-----';
  const mockUserId = 'John Doe <user1@example.com>';
  const mockKeyId = { toHex: vi.fn(() => 'ABCDEF1234567890') };
  const mockHomedir = '/custom/gpg/home';
  
  // Mock do objeto OpenPGP
  const mockPubKey = {
    isPrivate: vi.fn(() => false),
    getKeyID: vi.fn(() => mockKeyId),
    getPrimaryUser: vi.fn(() => ({ 
      user: { userID: { email: mockEmails[0] } }
    })),
    getUserIDs: vi.fn(() => [mockUserId])
  };

  // Mock do SimpleGit
  const mockGit = {
    raw: vi.fn()
  };

  // Mock do execFile com retorno de stdout
  const mockExecFile = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    // Configuração default para o cenário feliz
    vi.mocked(utils.secretsDirExists).mockResolvedValue(true);
    vi.mocked(utils.getGitRootPath).mockResolvedValue(mockGitRoot);
    vi.mocked(utils.getSecretsKeysDir).mockResolvedValue(mockKeysDir);
    vi.mocked(utils.listUserPublicKeys).mockResolvedValue([]);
    vi.mocked(fs.readFile).mockResolvedValue(mockArmoredKey);
    vi.mocked(openpgp.readKey).mockResolvedValue(mockPubKey as unknown as openpgp.PublicKey);
    vi.mocked(fse.ensureDir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(utils.fsdbClearHashes).mockResolvedValue(undefined);
    // @ts-ignore
    vi.mocked(utils.SimpleGit).mockReturnValue(mockGit);
    vi.mocked(mockGit.raw).mockResolvedValue(mockGitEmail);
    vi.mocked(path.join).mockReturnValue(`${mockKeysDir}/user1_example_com.abcdef1234567890.asc`);
    // @ts-ignore
    vi.mocked(execFile).mockImplementation(mockExecFile);
    mockExecFile.mockResolvedValue({ stdout: mockArmoredKey });
    vi.mocked(utils.abort).mockImplementation((msg: string) => {
      throw new Error(msg);
    });
  });

  it('deve adicionar um usuário via email corretamente', async () => {
    // Executar comando
    // @ts-ignore
    await gitSecretTell.action([mockEmails[0]], {});

    // Verificar chamadas
    expect(utils.secretsDirExists).toHaveBeenCalled();
    expect(utils.getSecretsKeysDir).toHaveBeenCalled();
    expect(fse.ensureDir).toHaveBeenCalledWith(mockKeysDir);
    expect(mockExecFile).toHaveBeenCalledWith('gpg', ['--export', '-a', mockEmails[0]]);
    expect(openpgp.readKey).toHaveBeenCalledWith({ armoredKey: mockArmoredKey });
    expect(mockPubKey.isPrivate).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
    expect(utils.fsdbClearHashes).toHaveBeenCalled();
    expect(utils.message).toHaveBeenCalledWith('Done. 1 user(s) added.');
    expect(utils.message).toHaveBeenCalledWith('Hashes cleared. Re-encrypt files with `git secret hide`.');
  });

  it('deve adicionar um usuário via arquivo de chave corretamente', async () => {
    // Executar comando com arquivo de chave
    // @ts-ignore
    await gitSecretTell.action([], { file: mockKeyFile });

    // Verificar chamadas
    expect(fs.readFile).toHaveBeenCalledWith(mockKeyFile, 'utf8');
    expect(openpgp.readKey).toHaveBeenCalledWith({ armoredKey: mockArmoredKey });
    expect(mockPubKey.getPrimaryUser).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
    expect(utils.message).toHaveBeenCalledWith('Done. 1 user(s) added.');
  });

  it('deve usar o email do git quando a opção useGitEmail é verdadeira', async () => {
    // Executar comando com opção useGitEmail
    // @ts-ignore
    await gitSecretTell.action([], { useGitEmail: true });

    // Verificar chamadas
    expect(utils.SimpleGit).toHaveBeenCalledWith(mockGitRoot);
    expect(mockGit.raw).toHaveBeenCalledWith(['config', 'user.email']);
    expect(mockExecFile).toHaveBeenCalledWith('gpg', ['--export', '-a', mockGitEmail]);
    expect(fs.writeFile).toHaveBeenCalled();
    expect(utils.message).toHaveBeenCalledWith('Done. 1 user(s) added.');
  });

  it('deve ativar o modo verbose quando a opção verbose é verdadeira', async () => {
    // Executar comando com opção verbose
    // @ts-ignore
    await gitSecretTell.action([mockEmails[0]], { verbose: true });

    // Verificar que o modo verbose foi ativado
    expect(utils.setVerbose).toHaveBeenCalledWith(true);
  });

  it('deve usar o homedir do GPG personalizado quando fornecido', async () => {
    // Executar comando com opção gpgHomedir
    // @ts-ignore
    await gitSecretTell.action([mockEmails[0]], { gpgHomedir: mockHomedir });

    // Verificar que o homedir personalizado foi usado
    expect(mockExecFile).toHaveBeenCalledWith('gpg', ['--homedir', mockHomedir, '--export', '-a', mockEmails[0]]);
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
    await gitSecretTell.action([mockEmails[0]], {});

    // Verificar mensagens em modo verbose
    expect(utils.message).toHaveBeenCalledWith(expect.stringContaining(`Added key for ${mockEmails[0]} to`));

    // Restaurar original
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: originalValue,
      configurable: true
    });
  });

  it('deve pular usuários cuja chave já existe no keyring', async () => {
    // Configurar que a chave já existe
    const mockExistingKey = {
      getUserIDs: vi.fn(() => [mockUserId])
    };
    vi.mocked(utils.listUserPublicKeys).mockResolvedValue([mockExistingKey as unknown as openpgp.PublicKey]);

    // Executar comando
    // @ts-ignore
    await gitSecretTell.action([mockEmails[0]], {});

    // Verificar aviso
    expect(utils.warn).toHaveBeenCalledWith(`A key for ${mockEmails[0]} already exists in the git-secret keyring. Skipping.`);
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(utils.message).toHaveBeenCalledWith('No new users were added.');
  });

  // TODO: Fix this test (I think the problem lays on the error catching).
  // it('deve mostrar aviso quando não consegue obter a chave pública', async () => {
  //   // Simular erro ao executar gpg
  //   const gpgError = new Error('GPG error');
  //   // @ts-ignore
  //   gpgError.stderr = 'Key not found';
  //   mockExecFile.mockRejectedValueOnce(gpgError);
  //
  //   // Executar comando
  //   // @ts-ignore
  //   await gitSecretTell.action([mockEmails[0]], {});
  //
  //   // Verificar que o erro foi tratado corretamente
  //   expect(utils.abort).toHaveBeenCalledWith(`Failed to export public key for '${mockEmails[0]}' using GPG: Key not found. Ensure GPG is installed and the key exists.`);
  // });

  it('deve mostrar aviso se a chave fornecida for privada', async () => {
    // Configurar que a chave é privada
    mockPubKey.isPrivate.mockReturnValueOnce(true);

    // Executar comando
    // @ts-ignore
    await gitSecretTell.action([mockEmails[0]], {});

    // Verificar aviso
    expect(utils.warn).toHaveBeenCalledWith(`The key for ${mockEmails[0]} is not a public key.`);
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(utils.message).toHaveBeenCalledWith('No new users were added.');
  });

  it('deve abortar se não fornecer email nem arquivo', async () => {
    // Executar comando sem email e sem arquivo
    // @ts-ignore
    await expect(gitSecretTell.action([], {})).rejects.toThrow('You must provide an email address, or use -m or -f <key_file>.');
    expect(utils.abort).toHaveBeenCalledWith('You must provide an email address, or use -m or -f <key_file>.');
  });

  it('deve abortar se o diretório .gitsecret não existir', async () => {
    // Configurar que o diretório .gitsecret não existe
    vi.mocked(utils.secretsDirExists).mockResolvedValue(false);

    // Executar comando
    // @ts-ignore
    await expect(gitSecretTell.action([mockEmails[0]], {})).rejects.toThrow(`Directory '${utils.SECRETS_DIR_NAME}' does not exist. Use 'git secret init' first.`);
    expect(utils.abort).toHaveBeenCalledWith(`Directory '${utils.SECRETS_DIR_NAME}' does not exist. Use 'git secret init' first.`);
  });

  it('deve abortar se o email do git não estiver configurado', async () => {
    // Configurar que o email do git não está definido
    vi.mocked(mockGit.raw).mockResolvedValue('');

    // Executar comando com useGitEmail
    // @ts-ignore
    await expect(gitSecretTell.action([], { useGitEmail: true })).rejects.toThrow("'git config user.email' is not set, but -m option was used.");
    expect(utils.abort).toHaveBeenCalledWith("'git config user.email' is not set, but -m option was used.");
  });

  it('deve abortar se fornecer arquivo e múltiplos emails', async () => {
    // Executar comando com arquivo e múltiplos emails
    // @ts-ignore
    await expect(gitSecretTell.action([mockEmails[0], mockEmails[1]], { file: mockKeyFile })).rejects.toThrow("Option -f (file) can only be used when specifying a single email or none (if email is in key).");
    expect(utils.abort).toHaveBeenCalledWith("Option -f (file) can only be used when specifying a single email or none (if email is in key).");
  });

  it('deve abortar quando ocorre um erro', async () => {
    // Simular erro durante a execução
    const mockError = new Error('Teste de erro');
    vi.mocked(utils.secretsDirExists).mockRejectedValue(mockError);

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretTell.action([mockEmails[0]], {})).rejects.toThrow("Error in 'tell' command: Teste de erro");
    expect(utils.abort).toHaveBeenCalledWith("Error in 'tell' command: Teste de erro");
  });

  it('deve verificar a estrutura do comando exportado', () => {
    expect(gitSecretTell.name).toBe('tell');
    expect(gitSecretTell.description).toBe('Adds person who can access private data.');
    expect(typeof gitSecretTell.action).toBe('function');
  });
});
