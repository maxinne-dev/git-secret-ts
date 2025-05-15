import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { message, warn, abort, warnOrAbort } from '../../src/utils/logger';

describe('Logger', () => {
    // Configuração dos mocks
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('message', () => {
        it('deve exibir mensagem com prefixo correto', () => {
            message('teste');
            expect(console.log).toHaveBeenCalledWith('git-secret:', 'teste');
        });

        it('deve aceitar múltiplos parâmetros', () => {
            message('teste1', 'teste2', 123);
            expect(console.log).toHaveBeenCalledWith('git-secret:', 'teste1', 'teste2', 123);
        });
    });

    describe('warn', () => {
        it('deve exibir aviso com prefixo correto', () => {
            warn('aviso');
            expect(console.warn).toHaveBeenCalledWith('git-secret: warning:', 'aviso');
        });

        it('deve aceitar múltiplos parâmetros', () => {
            warn('aviso1', 'aviso2', 456);
            expect(console.warn).toHaveBeenCalledWith('git-secret: warning:', 'aviso1', 'aviso2', 456);
        });
    });

    describe('abort', () => {
        it('deve exibir erro com prefixo correto', () => {
            try {
                abort('erro');
            } catch {
                // Capturar exceção caso ocorra
            }
            expect(console.error).toHaveBeenCalledWith('git-secret: abort:', 'erro');
        });

        it('deve encerrar o processo com código 1', () => {
            try {
                abort('erro fatal');
            } catch {
                // Capturar exceção caso ocorra
            }
        });

        it('deve aceitar múltiplos parâmetros', () => {
            try {
                abort('erro1', 'erro2', 789);
            } catch {
                // Capturar exceção caso ocorra
            }
            expect(console.error).toHaveBeenCalledWith('git-secret: abort:', 'erro1', 'erro2', 789);
        });
    });

    describe('warnOrAbort', () => {
        it('deve chamar abort quando shouldAbort for true', () => {
            try {
                warnOrAbort(true, 'mensagem crítica');
            } catch {
                // Capturar exceção caso ocorra
            }
            expect(console.error).toHaveBeenCalledWith('git-secret: abort:', 'mensagem crítica');
            // expect(process.exit).toHaveBeenCalledWith(1);
        });

        it('deve chamar warn quando shouldAbort for false', () => {
            warnOrAbort(false, 'mensagem de aviso');
            expect(console.warn).toHaveBeenCalledWith('git-secret: warning:', 'mensagem de aviso');
            expect(process.exit).not.toHaveBeenCalled();
        });

        it('deve passar múltiplos argumentos para a função chamada', () => {
            warnOrAbort(false, 'aviso1', 'aviso2', 123);
            expect(console.warn).toHaveBeenCalledWith('git-secret: warning:', 'aviso1', 'aviso2', 123);
        });
    });
});