import * as utils from '../utils';
import path from 'path';
import fs from 'fs/promises';
import { diffChars } from 'diff';

interface ChangesCommandOptions {
  homedir?: string;
  passphrase?: string;
  privateKey?: string;
}

const actionLogic = async (
  pathspecs: string[],
  options: ChangesCommandOptions,
) => {
  try {
    await utils.userRequired();
    const gitRoot = await utils.getGitRootPath();
    if (!gitRoot) utils.abort('Not in a git repository.');

    const privateKeyArmored = options.privateKey
      ? await fs.readFile(options.privateKey, 'utf8')
      : process.env.GPG_PRIVATE_KEY;

    if (!privateKeyArmored) {
      utils.abort(
        'Private key must be provided via --private-key option or GPG_PRIVATE_KEY env variable.',
      );
    }
    const passphrase = options.passphrase || process.env.GPG_PASSPHRASE;

    let filesToCheck = pathspecs;
    if (!filesToCheck || filesToCheck.length === 0) {
      const mappings = await utils.readPathMapping();
      filesToCheck = mappings.map(m => m.filePath);
    }

    for (const file of filesToCheck) {
      const normalizedPath = await utils.gitNormalizeFilename(file);
      const absolutePath = path.join(gitRoot, normalizedPath);
      const encryptedPath = utils.getEncryptedFilePath(absolutePath);

      try {
        await fs.access(encryptedPath);
      } catch (e) {
        utils.abort(`Cannot find encrypted version of file: ${encryptedPath}`);
      }
      try {
        await fs.access(absolutePath);
      } catch (e) {
        utils.abort(
          `File not found. Consider using 'git secret reveal': ${absolutePath}`,
        );
      }

      const decryptedData = await utils.decryptFile(
        encryptedPath,
        privateKeyArmored,
        passphrase,
      );
      const currentContent = await fs.readFile(absolutePath);

      if (Buffer.compare(Buffer.from(decryptedData), currentContent) === 0) {
        utils.message(`No changes in ${normalizedPath}`);
      } else {
        utils.message(`Changes in ${normalizedPath}:`);

        const differences = diffChars(
          currentContent.toString(),
          Buffer.from(decryptedData).toString(),
        );
        differences.forEach(part => {
          const color = part.added
            ? '\x1b[32m'
            : part.removed
            ? '\x1b[31m'
            : '\x1b[0m';
          process.stderr.write(`${color}${part.value}\x1b[0m`);
        });
        process.stderr.write('\n');
      }
    }
  } catch (error) {
    utils.abort(`Error in 'changes' command: ${(error as Error).message}`);
  }
};

export default utils.toCommand(
  'changes',
  'View diff of the hidden files.',
  actionLogic,
  [
    ['-d, --homedir <dir>', 'Custom GPG home directory (ignored).'],
    ['-p, --passphrase <password>', 'Passphrase for the private key.'],
    ['--private-key <key_path>', 'Path to the armored private key file.'],
  ],
  [
    '[pathspec...]',
    'File(s) to check changes for. Checks all if none specified.',
  ],
);
