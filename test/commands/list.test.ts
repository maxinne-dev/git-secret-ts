import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock das dependências
vi.mock('../../src/utils', () => ({
  userRequired: vi.fn(),
  readPathMapping: vi.fn(),
  message: vi.fn(),
  abort: vi.fn(),
  SECRETS_VERBOSE: false,
  toCommand: vi.fn((name, description, actionFn) => ({
    name,
    description,
    action: actionFn,
  })),
}));

// Importar após configurar os mocks
import gitSecretList from '../../src/commands/list';
import * as utils from '../../src/utils';

describe('git-secret-list command', () => {
  // Mock para console.log
  const originalConsoleLog = console.log;
  
  beforeEach(() => {
    vi.resetAllMocks();
    console.log = vi.fn();
    
    // Configuração default para o cenário feliz
    vi.mocked(utils.userRequired).mockResolvedValue(undefined);
    vi.mocked(utils.abort).mockImplementation((msg: string) => {
      throw new Error(msg);
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('deve listar os arquivos rastreados corretamente', async () => {
    // Configurar mock para retornar arquivos de teste
    const mockMappings = [
      { filePath: 'file1.txt', realPath: 'file1.txt' },
      { filePath: 'path/to/file2.txt', realPath: 'path/to/file2.txt' }
    ];
    // @ts-ignore
    vi.mocked(utils.readPathMapping).mockResolvedValue(mockMappings);

    // Executar comando
    // @ts-ignore
    await gitSecretList.action();

    // Verificar chamadas
    expect(utils.userRequired).toHaveBeenCalled();
    expect(utils.readPathMapping).toHaveBeenCalled();
    
    // Verificar que o comando lista os arquivos corretamente
    expect(console.log).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith('file1.txt');
    expect(console.log).toHaveBeenCalledWith('path/to/file2.txt');
  });

  it('não deve imprimir mensagem se não houver arquivos rastreados e SECRETS_VERBOSE for falso', async () => {
    // Configurar mock para retornar array vazio
    vi.mocked(utils.readPathMapping).mockResolvedValue([]);

    // Executar comando
    // @ts-ignore
    await gitSecretList.action();

    // Verificar que o comando não imprime nada
    expect(console.log).not.toHaveBeenCalled();
    expect(utils.message).not.toHaveBeenCalled();
  });

  it('deve imprimir mensagem se não houver arquivos rastreados e SECRETS_VERBOSE for verdadeiro', async () => {
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
    await gitSecretList.action();

    // Verificar que o comando imprime a mensagem correta
    expect(utils.message).toHaveBeenCalledWith('No files are currently tracked by git-secret.');
    expect(console.log).not.toHaveBeenCalled();
    
    // Restaura o valor original
    Object.defineProperty(utils, 'SECRETS_VERBOSE', {
      value: originalValue,
      configurable: true
    });
  });

  it('deve abortar quando ocorre um erro', async () => {
    // Simular erro durante a execução
    const mockError = new Error('Teste de erro');
    vi.mocked(utils.readPathMapping).mockRejectedValue(mockError);

    // Executar comando e verificar que ele aborta corretamente
    // @ts-ignore
    await expect(gitSecretList.action()).rejects.toThrow("Error in 'list' command: Teste de erro");
    expect(utils.abort).toHaveBeenCalledWith("Error in 'list' command: Teste de erro");
  });

  it('deve verificar a estrutura do comando exportado', () => {
    expect(gitSecretList.name).toBe('list');
    expect(gitSecretList.description).toBe('Prints all the added files.');
    expect(typeof gitSecretList.action).toBe('function');
  });
});
