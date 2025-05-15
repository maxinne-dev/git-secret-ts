import * as utils from '../utils';
import path from 'path';
import fs from 'fs/promises';

interface CatCommandOptions {
  homedir?: string;
  passphrase?: string;
  privateKey?: string;
}

const actionLogic = async (filenames: string[], options: CatCommandOptions) => {
  try {
    await utils.userRequired();
    const gitRoot = await utils.getGitRootPath();
    if (!gitRoot) {
      utils.abort('Not in a git repository.');
    }

    const privateKeyArmored = options.privateKey
      ? options.privateKey
      : process.env.GPG_PRIVATE_KEY;

    if (!privateKeyArmored) {
      utils.abort(
        'Private key must be provided via --private-key option or GPG_PRIVATE_KEY env variable.',
      );
    }

    const passphrase = options.passphrase || process.env.GPG_PASSPHRASE;

    for (const file of filenames) {
      const normalizedPath = await utils.gitNormalizeFilename(file);
      const absolutePath = path.join(gitRoot, normalizedPath);
      const encryptedPath = utils.getEncryptedFilePath(absolutePath);

      try {
        await fs.access(encryptedPath);
      } catch (e) {
        utils.warnOrAbort(
          false,
          `Cannot find file to decrypt: ${encryptedPath}`,
        );
        continue;
      }

      const decryptedData = await utils.decryptFile(
        encryptedPath,
        privateKeyArmored,
        passphrase,
      );
      process.stdout.write(decryptedData);
    }
  } catch (error) {
    utils.abort(`Error in 'cat' command: ${(error as Error).message}`);
  }
};

export default utils.toCommand(
  'cat',
  'Decrypts files passed on command line to stdout.',
  actionLogic,
  [
    [
      '-d, --homedir <dir>',
      'Custom GPG home directory (ignored if using OpenPGP.js for decryption).',
    ],
    ['-p, --passphrase <password>', 'Passphrase for the private key.'],
    ['--private-key <key_path>', 'Path to the armored private key file.'],
  ],
  ['<filenames...>', 'File(s) to decrypt and print.'],
);
