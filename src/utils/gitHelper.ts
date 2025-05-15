import {simpleGit} from "simple-git";
import path from "path";
import fsSync from "fs";
import fs from "fs/promises";
import { getGitRootPath, message, warn, SECRETS_VERBOSE } from ".";

export async function isInsideGitTree(): Promise<boolean> {
    try {
        const git = simpleGit(await getGitRootPath() || undefined); // Pass undefined if root is empty
        return await git.checkIsRepo();
    } catch (e) {
        return false;
    }
}

export async function checkIgnore(filePath: string): Promise<boolean> {
    try {
        const root = await getGitRootPath();
        if (!root) return false; // Not in a git repo
        const git = simpleGit(root);
        const relativeFilePath = path.relative(root, filePath);
        const ignored = await git.checkIgnore(relativeFilePath);
        return ignored.length > 0;
    } catch (e) {
        // If git check-ignore fails (e.g. file not in repo), assume not ignored for this tool's logic
        return false;
    }
}

export async function gitNormalizeFilename(filePath: string): Promise<string> {
    // This roughly corresponds to `git ls-files --full-name -o $filename`
    // For simplicity, we'll use path.resolve and then make it relative to git root
    // This might need refinement based on exact behavior of original.
    const root = await getGitRootPath();
    if (!root) return path.resolve(filePath); // Fallback if not in git repo

    // Check if file exists, otherwise ls-files might error
    // The original `git ls-files -o` lists other (i.e. untracked) files.
    // `simple-git` doesn't have a direct equivalent for just normalizing a potential path.
    // `git ls-files --full-name some/path` would only work if `some/path` is tracked or matches a pattern.
    // The closest might be to make it relative to root if it's inside.
    const absoluteFilePath = path.resolve(filePath);
    if (absoluteFilePath.startsWith(root)) {
        return path.relative(root, absoluteFilePath).replace(/\\/g, '/');
    }
    return filePath.replace(/\\/g, '/'); // Fallback
}

export async function isTrackedInGit(filePath: string): Promise<boolean> {
    try {
        const root = await getGitRootPath();
        if (!root) return false;
        const git = simpleGit(root);
        const relativeFilePath = path.relative(root, path.resolve(filePath));
        const status = await git.raw(['ls-files', '--error-unmatch', relativeFilePath]);
        return status !== null && status.trim() !== '';
    } catch (e) {
        return false; // Errors if not tracked
    }
}

export async function addFileToGitignore(filePathPattern: string): Promise<void> {
    const root = await getGitRootPath();
    if (!root) {
        warn('Cannot add to .gitignore: not in a git repository.');
        return;
    }
    const gitignorePath = path.join(root, '.gitignore');
    try {
        let content = '';
        if (fsSync.existsSync(gitignorePath)) {
            content = await fs.readFile(gitignorePath, 'utf8');
        }
        const lines = content.split('\n');
        if (!lines.includes(filePathPattern)) {
            // Ensure there's a newline before adding, if file is not empty
            const newContent = content + (content.endsWith('\n') || content === '' ? '' : '\n') + filePathPattern + '\n';
            await fs.writeFile(gitignorePath, newContent);
            if (SECRETS_VERBOSE) message(`Added '${filePathPattern}' to .gitignore`);
        }
    } catch (e) {
        warn(`Failed to update .gitignore: ${(e as Error).message}`);
    }
}