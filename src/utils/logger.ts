// TODO: Change this to use winston or something similar.

export function message(...msg: any[]): void {
    console.log('git-secret:', ...msg);
}
export function warn(...msg: any[]): void {
    console.warn('git-secret: warning:', ...msg);
}
export function abort(...msg: any[]): never {
    console.error('git-secret: abort:', ...msg);
    throw new Error('aborted');
}
export function warnOrAbort(shouldAbort: boolean, ...params: any[]): void {
    if (shouldAbort) {
        abort(...params);
    } else {
        warn(...params);
    }
}