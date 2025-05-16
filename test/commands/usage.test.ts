import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock das dependências
vi.mock('../../src/utils', () => ({
  toCommand: vi.fn((name, description, actionFn) => ({
    name,
    description,
    action: actionFn,
  })),
}));

// Importar após configurar os mocks
import gitSecretUsage from '../../src/commands/usage';

describe('git-secret-usage command', () => {
  // Mock para console.log
  const originalConsoleLog = console.log;

  beforeEach(() => {
    vi.resetAllMocks();
    console.log = vi.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('deve imprimir informações de uso corretamente', async () => {
    // Executar comando
    // @ts-ignore
    await gitSecretUsage.action();

    // Verificar que o comando imprime as mensagens corretas
    expect(console.log).toHaveBeenCalledWith(
      "Run 'git-secret --help' to see all available commands and options.",
    );
    expect(console.log).toHaveBeenCalledWith(
      "Run 'git-secret <command> --help' for help on a specific command.",
    );
    expect(console.log).toHaveBeenCalledWith(
      '\nusage: git secret [--version] [command] [command-options]',
    );
    expect(console.log).toHaveBeenCalledWith('');
    expect(console.log).toHaveBeenCalledWith('options:');
    expect(console.log).toHaveBeenCalledWith(
      ' --version                 - prints the version number',
    );
    expect(console.log).toHaveBeenCalledWith('');
    expect(console.log).toHaveBeenCalledWith(
      "commands (use 'git-secret <command> --help' for more details):",
    );

    // Verificar que todos os comandos são listados
    const expectedCommands = [
      'add',
      'cat',
      'changes',
      'clean',
      'hide',
      'init',
      'list',
      'remove',
      'removeperson',
      'reveal',
      'tell',
      'usage',
      'whoknows',
    ];

    expectedCommands.forEach(cmd => {
      expect(console.log).toHaveBeenCalledWith(` ${cmd.padEnd(25)}`);
    });

    // Verificar o número total de chamadas ao console.log (5 linhas iniciais + 13 comandos)
    expect(console.log).toHaveBeenCalledTimes(5 + 3 + expectedCommands.length);
  });

  it('deve verificar a estrutura do comando exportado', () => {
    expect(gitSecretUsage.name).toBe('usage');
    expect(gitSecretUsage.description).toBe(
      'Prints all the available commands.',
    );
    expect(typeof gitSecretUsage.action).toBe('function');
  });
});
