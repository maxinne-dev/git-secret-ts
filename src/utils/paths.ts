import {simpleGit} from "simple-git";
import path from "path";
import {SECRETS_DIR_NAME, SECRETS_EXTENSION} from ".";

let gitRootPath: string | null = null;

export async function getGitRootPath(): Promise<string> {
    if (gitRootPath === null) {
        try {
            const git = simpleGit();
            gitRootPath = await git.revparse(['--show-toplevel']);
        } catch (e) {
            gitRootPath = ''; // Not in a git repo or git not found
        }
    }
    return gitRootPath;
}
export async function getSecretsDir(): Promise<string> {
    return path.join(await getGitRootPath(), SECRETS_DIR_NAME);
}
export async function getSecretsKeysDir(): Promise<string> {
    return path.join(await getSecretsDir(), 'keys');
}
export async function getSecretsPathsDir(): Promise<string> {
    return path.join(await getSecretsDir(), 'paths');
}
export async function getSecretsPathMappingFile(): Promise<string> {
    return path.join(await getSecretsPathsDir(), 'mapping.cfg');
}
export function getEncryptedFilePath(filePath: string): string {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, SECRETS_EXTENSION); // remove .secret if present
    return path.join(dir, `${base}${SECRETS_EXTENSION}`);
}
export function getDecryptedFilePath(filePath: string): string {
    if (filePath.endsWith(SECRETS_EXTENSION)) {
        return filePath.slice(0, -SECRETS_EXTENSION.length);
    }
    return filePath;
}

export function __resetGitRootPathCache(): void {
    gitRootPath = null;
}