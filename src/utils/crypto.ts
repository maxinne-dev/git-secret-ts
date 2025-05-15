import fs from "fs/promises";
import crypto from "crypto";
import {tmpName} from "tmp-promise";

export async function sha256sum(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

export async function getOctalPerms(filePath: string): Promise<string> {
    const stats = await fs.stat(filePath);
    return (stats.mode & 0o777).toString(8).padStart(3, '0');
}

export function epochToDateISO(epochSeconds: number | null | undefined): string {
    if (!epochSeconds) return 'never';
    return new Date(epochSeconds * 1000).toISOString().split('T')[0];
}

export async function createTempFile(prefix: string = 'git-secret-'): Promise<string> {
    return tmpName({ prefix });
}