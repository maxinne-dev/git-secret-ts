import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as openpgp from 'openpgp';

// Mock das dependências
vi.mock('../../src/utils', () => ({
    userRequired: vi.fn(),
    listUserPublicKeys: vi.fn(),
    message: vi.fn(),
    abort: vi.fn(),
    toCommand: vi.fn((name, description, actionFn) => ({ 
        name, description, action: actionFn 
    }))
}));

// Importar após configurar os mocks
import gitSecretWhoknows from '../../src/commands/whoknows';
import * as utils from '../../src/utils';

describe('git-secret-whoknows command', () => {
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

    it('deve listar usuários corretamente no formato padrão', async () => {
        // Criar mock para chaves públicas
        const mockKeys = [
            createMockPublicKey(['user1@example.com', 'User One'], 'abcd1234', null),
            createMockPublicKey(['User Two <user2@example.com>'], 'efgh5678', new Date('2025-01-01'))
        ];
        
        vi.mocked(utils.listUserPublicKeys).mockResolvedValue(mockKeys as unknown as openpgp.PublicKey[]);

        // Executar comando sem opções
        // @ts-ignore
        await gitSecretWhoknows.action({ long: false });

        // Verificar que o comando lista os usuários corretamente
        expect(utils.userRequired).toHaveBeenCalled();
        expect(utils.listUserPublicKeys).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledTimes(2);
        expect(console.log).toHaveBeenCalledWith('user1@example.com');
        expect(console.log).toHaveBeenCalledWith('User Two <user2@example.com>');
    });

    it('deve listar usuários com informações detalhadas quando a opção --long é fornecida', async () => {
        // Criar mock para chaves públicas
        const mockKeys = [
            createMockPublicKey(['user1@example.com'], 'abcd1234', null),
            createMockPublicKey(['user2@example.com'], 'efgh5678', new Date('2025-01-01'))
        ];
        
        vi.mocked(utils.listUserPublicKeys).mockResolvedValue(mockKeys as unknown as openpgp.PublicKey[]);

        // Executar comando com opção --long
        // @ts-ignore
        await gitSecretWhoknows.action({ long: true });

        // Verificar que o comando lista os usuários com informações detalhadas
        expect(console.log).toHaveBeenCalledTimes(2);
        expect(console.log).toHaveBeenCalledWith('user1@example.com (KeyID: abcd1234, Expires: never)');
        expect(console.log).toHaveBeenCalledWith('user2@example.com (KeyID: efgh5678, Expires: 2025-01-01)');
    });

    it('deve exibir mensagem quando não há usuários configurados', async () => {
        // Configurar mock para retornar array vazio
        vi.mocked(utils.listUserPublicKeys).mockResolvedValue([]);

        // Executar comando
        // @ts-ignore
        await gitSecretWhoknows.action({});

        // Verificar que o comando exibe a mensagem correta
        expect(utils.message).toHaveBeenCalledWith('No users are configured to know the secret.');
        expect(console.log).not.toHaveBeenCalled();
    });

    it('deve selecionar o ID de usuário principal corretamente', async () => {
        // Criar mock para chave com múltiplos user IDs
        const mockKeys = [
            createMockPublicKey(['John Doe', 'john.doe@example.com', 'Johnny'], 'abcd1234', null)
        ];
        
        vi.mocked(utils.listUserPublicKeys).mockResolvedValue(mockKeys as unknown as openpgp.PublicKey[]);

        // Executar comando
        // @ts-ignore
        await gitSecretWhoknows.action({});

        // Verificar que o comando seleciona o email como ID principal
        expect(console.log).toHaveBeenCalledWith('john.doe@example.com');
    });

    it('deve usar o primeiro ID de usuário quando não há email', async () => {
        // Criar mock para chave sem email nos user IDs
        const mockKeys = [
            createMockPublicKey(['John Doe', 'Johnny'], 'abcd1234', null)
        ];
        
        vi.mocked(utils.listUserPublicKeys).mockResolvedValue(mockKeys as unknown as openpgp.PublicKey[]);

        // Executar comando
        // @ts-ignore
        await gitSecretWhoknows.action({});

        // Verificar que o comando usa o primeiro ID
        expect(console.log).toHaveBeenCalledWith('John Doe');
    });

    it('deve lidar com infinity como data de expiração "never"', async () => {
        // Criar mock para chave com expiração Infinity
        const mockKeys = [
            createMockPublicKey(['user1@example.com'], 'abcd1234', Infinity)
        ];
        
        vi.mocked(utils.listUserPublicKeys).mockResolvedValue(mockKeys as unknown as openpgp.PublicKey[]);

        // Executar comando com opção --long
        // @ts-ignore
        await gitSecretWhoknows.action({ long: true });

        // Verificar que o comando formata corretamente a data
        expect(console.log).toHaveBeenCalledWith('user1@example.com (KeyID: abcd1234, Expires: never)');
    });

    it('deve mostrar "Unknown User" quando não há IDs de usuário', async () => {
        // Criar mock para chave sem user IDs
        const mockKeys = [
            createMockPublicKey([], 'abcd1234', null)
        ];
        
        vi.mocked(utils.listUserPublicKeys).mockResolvedValue(mockKeys as unknown as openpgp.PublicKey[]);

        // Executar comando
        // @ts-ignore
        await gitSecretWhoknows.action({});

        // Verificar que o comando mostra "Unknown User"
        expect(console.log).toHaveBeenCalledWith('Unknown User');
    });

    it('deve abortar quando ocorre um erro', async () => {
        // Simular erro durante a execução
        const mockError = new Error('Teste de erro');
        vi.mocked(utils.userRequired).mockRejectedValue(mockError);

        // Executar comando e verificar que ele aborta corretamente
        // @ts-ignore
        await expect(gitSecretWhoknows.action({})).rejects.toThrow("Error in 'whoknows' command: Teste de erro");
        expect(utils.abort).toHaveBeenCalledWith("Error in 'whoknows' command: Teste de erro");
    });

    it('deve verificar a estrutura do comando exportado', () => {
        expect(gitSecretWhoknows.name).toBe('whoknows');
        expect(gitSecretWhoknows.description).toBe('Print email for each key in the keyring.');
        expect(typeof gitSecretWhoknows.action).toBe('function');
    });

    // Função auxiliar para criar mocks de chaves públicas
    function createMockPublicKey(userIds: string[], keyId: string, expirationTime: Date | null | number): object {
        return {
            getUserIDs: () => userIds,
            getKeyID: () => ({
                toHex: () => keyId
            }),
            getExpirationTime: async () => expirationTime
        };
    }
});
