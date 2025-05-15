import os from "os";

export const SECRETS_DIR_NAME: string = process.env.SECRETS_DIR || ".gitsecret";
export const SECRETS_EXTENSION: string = process.env.SECRETS_EXTENSION || ".secret";
export let SECRETS_VERBOSE: boolean = (process.env.SECRETS_VERBOSE && process.env.SECRETS_VERBOSE !== '0') || false;
export const TMPDIR: string = process.env.TMPDIR || os.tmpdir();

export function setVerbose(verbose: boolean): void {
    SECRETS_VERBOSE = verbose;
}