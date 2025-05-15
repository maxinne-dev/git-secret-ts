import { simpleGit } from 'simple-git';

import {
    SECRETS_DIR_NAME,
    SECRETS_EXTENSION,
    SECRETS_VERBOSE,
    TMPDIR,
    setVerbose
} from './vars'

import {
    getGitRootPath,
    getSecretsDir,
    getSecretsKeysDir,
    getSecretsPathsDir,
    getSecretsPathMappingFile,
    getEncryptedFilePath,
    getDecryptedFilePath,
    __resetGitRootPathCache
} from './paths'

import {
    message,
    warn,
    abort,
    warnOrAbort
} from './logger'

import {
    isInsideGitTree,
    checkIgnore,
    gitNormalizeFilename,
    isTrackedInGit,
    addFileToGitignore
} from './gitHelper'

import {
    readPathMapping,
    writePathMapping,
    fsdbHasRecord,
    fsdbAddRecord,
    fsdbRemoveRecord,
    fsdbGetRecordHash,
    fsdbUpdateRecordHash,
    fsdbClearHashes
} from './mapping'

import {
    sha256sum,
    getOctalPerms,
    epochToDateISO,
    createTempFile
} from './crypto'

import {
    secretsDirExists,
    secretsDirIsNotIgnored,
    listUserPublicKeys,
    userRequired
} from './validation'

import {
    getRecipientKeys,
    encryptFile,
    decryptFile
} from './pgpOperations'

import { toCommand } from "./command";

const SimpleGit = simpleGit;

export {
    SimpleGit,
    SECRETS_DIR_NAME,
    SECRETS_EXTENSION,
    SECRETS_VERBOSE,
    TMPDIR,
    setVerbose,
    getGitRootPath,
    getSecretsDir,
    getSecretsKeysDir,
    getSecretsPathsDir,
    getSecretsPathMappingFile,
    getEncryptedFilePath,
    getDecryptedFilePath,
    __resetGitRootPathCache,
    message,
    warn,
    abort,
    warnOrAbort,
    isInsideGitTree,
    checkIgnore,
    gitNormalizeFilename,
    isTrackedInGit,
    addFileToGitignore,
    readPathMapping,
    writePathMapping,
    fsdbHasRecord,
    fsdbAddRecord,
    fsdbRemoveRecord,
    fsdbGetRecordHash,
    fsdbUpdateRecordHash,
    fsdbClearHashes,
    sha256sum,
    getOctalPerms,
    epochToDateISO,
    createTempFile,
    secretsDirExists,
    secretsDirIsNotIgnored,
    listUserPublicKeys,
    userRequired,
    getRecipientKeys,
    encryptFile,
    decryptFile,
    toCommand
}