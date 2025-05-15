import fs from "fs/promises";
import { getSecretsPathMappingFile} from ".";

interface PathMapping {
    filePath: string;
    hash: string | null;
}

export async function readPathMapping(): Promise<PathMapping[]> {
    const mappingFile = await getSecretsPathMappingFile();
    try {
        const content = await fs.readFile(mappingFile, 'utf8');
        return content.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => {
                const parts = line.split(':');
                return { filePath: parts[0], hash: parts[1] || null };
            });
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw e;
    }
}

export async function writePathMapping(mappings: PathMapping[]): Promise<void> {
    const mappingFile = await getSecretsPathMappingFile();
    const content = mappings.map(m => `${m.filePath}${m.hash ? `:${m.hash}` : ''}`).join('\n') + '\n';
    await fs.writeFile(mappingFile, content);
}

export async function fsdbHasRecord(filePath: string): Promise<boolean> {
    const mappings = await readPathMapping();
    return mappings.some(m => m.filePath === filePath);
}

export async function fsdbAddRecord(filePath: string, hash: string | null = null): Promise<boolean> {
    let mappings = await readPathMapping();
    if (!mappings.some(m => m.filePath === filePath)) {
        mappings.push({ filePath, hash });
        await writePathMapping(mappings);
        return true;
    }
    return false;
}

export async function fsdbRemoveRecord(filePath: string): Promise<boolean> {
    let mappings = await readPathMapping();
    const initialLength = mappings.length;
    mappings = mappings.filter(m => m.filePath !== filePath);
    if (mappings.length < initialLength) {
        await writePathMapping(mappings);
        return true;
    }
    return false;
}

export async function fsdbGetRecordHash(filePath: string): Promise<string | null> {
    const mappings = await readPathMapping();
    const record = mappings.find(m => m.filePath === filePath);
    return record ? record.hash : null;
}

export async function fsdbUpdateRecordHash(filePath: string, newHash: string): Promise<boolean> {
    let mappings = await readPathMapping();
    const record = mappings.find(m => m.filePath === filePath);
    if (record) {
        record.hash = newHash;
        await writePathMapping(mappings);
        return true;
    }
    return false;
}

export async function fsdbClearHashes(): Promise<void> {
    let mappings = await readPathMapping();
    mappings.forEach(m => m.hash = null);
    await writePathMapping(mappings);
}