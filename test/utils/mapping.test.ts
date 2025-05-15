import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';

// Mock das dependências
vi.mock('fs/promises');
vi.mock('../../src/utils', () => ({
    getSecretsPathMappingFile: vi.fn()
}));

import {
    readPathMapping,
    writePathMapping,
    fsdbHasRecord,
    fsdbAddRecord,
    fsdbRemoveRecord,
    fsdbGetRecordHash,
    fsdbUpdateRecordHash,
    fsdbClearHashes
} from '../../src/utils/mapping';
import { getSecretsPathMappingFile } from '../../src/utils';

describe('Mapping Utilities', () => {
    const mockMappingFilePath = '/path/to/.gitsecret/paths/mapping.txt';

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getSecretsPathMappingFile).mockResolvedValue(mockMappingFilePath);
    });

    describe('readPathMapping', () => {
        it('deve ler e analisar o arquivo de mapeamento corretamente', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\npath/to/file3.txt:\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await readPathMapping();

            expect(getSecretsPathMappingFile).toHaveBeenCalled();
            expect(fs.readFile).toHaveBeenCalledWith(mockMappingFilePath, 'utf8');
            expect(result).toEqual([
                { filePath: 'path/to/file1.txt', hash: 'hash1' },
                { filePath: 'path/to/file2.txt', hash: 'hash2' },
                { filePath: 'path/to/file3.txt', hash: null }
            ]);
        });

        it('deve retornar um array vazio quando o arquivo não existe', async () => {
            const mockError = new Error('ENOENT: arquivo não encontrado');
            (mockError as NodeJS.ErrnoException).code = 'ENOENT';
            vi.mocked(fs.readFile).mockRejectedValue(mockError);

            const result = await readPathMapping();

            expect(fs.readFile).toHaveBeenCalledWith(mockMappingFilePath, 'utf8');
            expect(result).toEqual([]);
        });

        it('deve propagar outros erros ao ler o arquivo', async () => {
            const mockError = new Error('Erro de permissão');
            (mockError as NodeJS.ErrnoException).code = 'EPERM';
            vi.mocked(fs.readFile).mockRejectedValue(mockError);

            await expect(readPathMapping()).rejects.toThrow('Erro de permissão');
        });

        it('deve ignorar linhas vazias no arquivo de mapeamento', async () => {
            const mockContent = 'path/to/file1.txt:hash1\n\n\npath/to/file2.txt:hash2\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await readPathMapping();

            expect(result).toEqual([
                { filePath: 'path/to/file1.txt', hash: 'hash1' },
                { filePath: 'path/to/file2.txt', hash: 'hash2' }
            ]);
        });
    });

    describe('writePathMapping', () => {
        it('deve escrever os mapeamentos no arquivo corretamente', async () => {
            const mappings = [
                { filePath: 'path/to/file1.txt', hash: 'hash1' },
                { filePath: 'path/to/file2.txt', hash: 'hash2' },
                { filePath: 'path/to/file3.txt', hash: null }
            ];
            const expectedContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\npath/to/file3.txt\n';

            await writePathMapping(mappings);

            expect(getSecretsPathMappingFile).toHaveBeenCalled();
            expect(fs.writeFile).toHaveBeenCalledWith(mockMappingFilePath, expectedContent);
        });

        it('deve lidar com array vazio', async () => {
            await writePathMapping([]);

            expect(fs.writeFile).toHaveBeenCalledWith(mockMappingFilePath, '\n');
        });
    });

    describe('fsdbHasRecord', () => {
        it('deve retornar true quando o caminho existe no mapeamento', async () => {
            vi.mocked(fs.readFile).mockResolvedValue('path/to/file1.txt:hash1\npath/to/file2.txt:hash2\n');

            const result = await fsdbHasRecord('path/to/file1.txt');

            expect(result).toBe(true);
        });

        it('deve retornar false quando o caminho não existe no mapeamento', async () => {
            vi.mocked(fs.readFile).mockResolvedValue('path/to/file1.txt:hash1\npath/to/file2.txt:hash2\n');

            const result = await fsdbHasRecord('path/to/file3.txt');

            expect(result).toBe(false);
        });
    });

    describe('fsdbAddRecord', () => {
        it('deve adicionar um novo registro com hash', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await fsdbAddRecord('path/to/file3.txt', 'hash3');

            expect(result).toBe(true);
            expect(fs.writeFile).toHaveBeenCalledWith(
                mockMappingFilePath,
                'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\npath/to/file3.txt:hash3\n'
            );
        });

        it('deve adicionar um novo registro sem hash', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await fsdbAddRecord('path/to/file3.txt');

            expect(result).toBe(true);
            expect(fs.writeFile).toHaveBeenCalledWith(
                mockMappingFilePath,
                'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\npath/to/file3.txt\n'
            );
        });

        it('não deve adicionar um registro duplicado', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await fsdbAddRecord('path/to/file1.txt', 'new-hash');

            expect(result).toBe(false);
            expect(fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('fsdbRemoveRecord', () => {
        it('deve remover um registro existente', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\npath/to/file3.txt:hash3\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await fsdbRemoveRecord('path/to/file2.txt');

            expect(result).toBe(true);
            expect(fs.writeFile).toHaveBeenCalledWith(
                mockMappingFilePath,
                'path/to/file1.txt:hash1\npath/to/file3.txt:hash3\n'
            );
        });

        it('deve retornar false quando o registro não existe', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await fsdbRemoveRecord('path/to/file3.txt');

            expect(result).toBe(false);
            expect(fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('fsdbGetRecordHash', () => {
        it('deve retornar o hash de um registro existente', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await fsdbGetRecordHash('path/to/file1.txt');

            expect(result).toBe('hash1');
        });

        it('deve retornar null quando o registro não existe', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await fsdbGetRecordHash('path/to/file3.txt');

            expect(result).toBe(null);
        });

        it('deve retornar null quando o registro existe mas não tem um hash', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await fsdbGetRecordHash('path/to/file2.txt');

            expect(result).toBe(null);
        });
    });

    describe('fsdbUpdateRecordHash', () => {
        it('deve atualizar o hash de um registro existente', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await fsdbUpdateRecordHash('path/to/file1.txt', 'new-hash');

            expect(result).toBe(true);
            expect(fs.writeFile).toHaveBeenCalledWith(
                mockMappingFilePath,
                'path/to/file1.txt:new-hash\npath/to/file2.txt:hash2\n'
            );
        });

        it('deve retornar false quando o registro não existe', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            const result = await fsdbUpdateRecordHash('path/to/file3.txt', 'new-hash');

            expect(result).toBe(false);
            expect(fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('fsdbClearHashes', () => {
        it('deve limpar todos os hashes no mapeamento', async () => {
            const mockContent = 'path/to/file1.txt:hash1\npath/to/file2.txt:hash2\npath/to/file3.txt:hash3\n';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);

            await fsdbClearHashes();

            expect(fs.writeFile).toHaveBeenCalledWith(
                mockMappingFilePath,
                'path/to/file1.txt\npath/to/file2.txt\npath/to/file3.txt\n'
            );
        });

        it('deve funcionar com mapeamento vazio', async () => {
            vi.mocked(fs.readFile).mockResolvedValue('');

            await fsdbClearHashes();

            expect(fs.writeFile).toHaveBeenCalledWith(mockMappingFilePath, '\n');
        });
    });
});
