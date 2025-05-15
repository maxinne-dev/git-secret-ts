import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import crypto from 'crypto';
import { tmpName } from 'tmp-promise';
import { sha256sum, getOctalPerms, epochToDateISO, createTempFile } from '../../src/utils/crypto';

// Mock das dependências
vi.mock('fs/promises');
vi.mock('crypto');
vi.mock('tmp-promise');

describe('Crypto Utilities', () => {
    const mockFilePath = '/path/to/file.txt';

    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('sha256sum', () => {
        it('deve calcular o hash SHA-256 de um arquivo corretamente', async () => {
            const mockContent = Buffer.from('conteúdo do arquivo de teste');
            const mockHash = {
                update: vi.fn().mockReturnThis(),
                digest: vi.fn().mockReturnValue('hash-sha256-simulado')
            };

            vi.mocked(fs.readFile).mockResolvedValue(mockContent);
            vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);

            const result = await sha256sum(mockFilePath);

            expect(fs.readFile).toHaveBeenCalledWith(mockFilePath);
            expect(crypto.createHash).toHaveBeenCalledWith('sha256');
            expect(mockHash.update).toHaveBeenCalledWith(mockContent);
            expect(mockHash.digest).toHaveBeenCalledWith('hex');
            expect(result).toBe('hash-sha256-simulado');
        });

        it('deve propagar erros na leitura do arquivo', async () => {
            const mockError = new Error('Erro ao ler arquivo');
            vi.mocked(fs.readFile).mockRejectedValue(mockError);

            await expect(sha256sum(mockFilePath)).rejects.toThrow('Erro ao ler arquivo');
        });
    });

    describe('getOctalPerms', () => {
        it('deve retornar permissões em formato octal de 3 dígitos', async () => {
            // Mock para permissões 644 (rw-r--r--)
            vi.mocked(fs.stat).mockResolvedValue({
                mode: 0o100644 // 644 em octal com bit de arquivo regular
            } as any);

            const result = await getOctalPerms(mockFilePath);

            expect(fs.stat).toHaveBeenCalledWith(mockFilePath);
            expect(result).toBe('644');
        });

        it('deve retornar permissões com zeros à esquerda para completar 3 dígitos', async () => {
            // Mock para permissões 7 (------rwx)
            vi.mocked(fs.stat).mockResolvedValue({
                mode: 0o100007 // 7 em octal com bit de arquivo regular
            } as any);

            const result = await getOctalPerms(mockFilePath);

            expect(result).toBe('007');
        });

        it('deve propagar erros na obtenção das estatísticas do arquivo', async () => {
            const mockError = new Error('Arquivo não encontrado');
            vi.mocked(fs.stat).mockRejectedValue(mockError);

            await expect(getOctalPerms(mockFilePath)).rejects.toThrow('Arquivo não encontrado');
        });
    });

    describe('epochToDateISO', () => {
        it('deve converter timestamp para formato ISO de data (YYYY-MM-DD)', () => {
            // 1 de janeiro de 2023 00:00:00 UTC
            const timestamp = 1672531200;
            const result = epochToDateISO(timestamp);

            expect(result).toBe('2023-01-01');
        });

        it('deve retornar "never" quando o timestamp for nulo', () => {
            expect(epochToDateISO(null)).toBe('never');
        });

        it('deve retornar "never" quando o timestamp for undefined', () => {
            expect(epochToDateISO(undefined)).toBe('never');
        });
    });

    describe('createTempFile', () => {
        it('deve criar um arquivo temporário com prefixo padrão', async () => {
            const mockTempPath = '/tmp/git-secret-abc123';
            vi.mocked(tmpName).mockResolvedValue(mockTempPath);

            const result = await createTempFile();

            expect(tmpName).toHaveBeenCalledWith({ prefix: 'git-secret-' });
            expect(result).toBe(mockTempPath);
        });

        it('deve criar um arquivo temporário com prefixo personalizado', async () => {
            const mockTempPath = '/tmp/custom-prefix-xyz789';
            vi.mocked(tmpName).mockResolvedValue(mockTempPath);

            const result = await createTempFile('custom-prefix-');

            expect(tmpName).toHaveBeenCalledWith({ prefix: 'custom-prefix-' });
            expect(result).toBe(mockTempPath);
        });

        it('deve propagar erros na criação do arquivo temporário', async () => {
            const mockError = new Error('Erro ao criar arquivo temporário');
            vi.mocked(tmpName).mockRejectedValue(mockError);

            await expect(createTempFile()).rejects.toThrow('Erro ao criar arquivo temporário');
        });
    });
});