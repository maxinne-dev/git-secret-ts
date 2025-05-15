import * as utils from '../utils';
import path from 'path';
import fse from 'fs-extra';

const actionLogic = async (): Promise<void> => {
  try {
    const gitRoot: string | null = await utils.getGitRootPath();
    if (!gitRoot) {
      utils.abort('Not in a git repository. Please run `git init` first.');
    }

    const secretsDir: string = await utils.getSecretsDir();
    if (await utils.secretsDirExists()) {
      utils.abort(`'${utils.SECRETS_DIR_NAME}' already initialized.`);
    }

    if (!(await utils.secretsDirIsNotIgnored())) {
      utils.abort(
        `Entry '${utils.SECRETS_DIR_NAME}' seems to be in .gitignore. Please remove it first.`,
      );
    }

    await fse.ensureDir(secretsDir);
    const keysDir: string = await utils.getSecretsKeysDir();
    const pathsDir: string = await utils.getSecretsPathsDir();
    await fse.ensureDir(keysDir);
    await fse.ensureDir(pathsDir);

    await fse.chmod(keysDir, 0o700);

    const mappingFile: string = await utils.getSecretsPathMappingFile();
    await fse.writeFile(mappingFile, '');

    utils.message(`Init created: '${utils.SECRETS_DIR_NAME}/'`);

    const randomSeedPattern: string = path
      .join(utils.SECRETS_DIR_NAME, 'keys', 'random_seed')
      .replace(/\\/g, '/');
    await utils.addFileToGitignore(randomSeedPattern);
    await utils.addFileToGitignore(`!*${utils.SECRETS_EXTENSION}`);
    utils.message(`Updated .gitignore`);
  } catch (error: any) {
    utils.abort(`Error in 'init' command: ${error.message}`);
  }
};

export default utils.toCommand(
  'init',
  'Initializes git-secret repository.',
  actionLogic,
);
