import * as utils from '../utils';
import path from 'path';
import fs from 'fs/promises';

interface AddCommandOptions {
  verbose?: boolean;
}

const actionLogic = async (pathspecs: string[], options: AddCommandOptions) => {
  if (options.verbose) utils.setVerbose(true);

  try {
    await utils.userRequired();
    const gitRoot = await utils.getGitRootPath();
    if (!gitRoot) {
      utils.abort('Not in a git repository.');
    }

    let addedCount = 0;
    for (const item of pathspecs) {
      const normalizedPath = await utils.gitNormalizeFilename(item);
      const absolutePath = path.join(gitRoot, normalizedPath);

      if (await utils.isTrackedInGit(absolutePath)) {
        utils.abort(
          `File '${item}' is tracked in git. Consider using 'git rm --cached ${item}'.`,
        );
      }

      try {
        await fs.access(absolutePath);
      } catch (e) {
        utils.abort(`File not found: ${item}`);
      }

      if (!(await utils.checkIgnore(absolutePath))) {
        utils.message(`File not in .gitignore, adding: ${normalizedPath}`);
        await utils.addFileToGitignore(normalizedPath);
      }

      if (await utils.fsdbAddRecord(normalizedPath)) {
        if (utils.SECRETS_VERBOSE)
          utils.message(`Adding file: ${normalizedPath}`);
        addedCount++;
      }
    }
    utils.message(`${addedCount} item(s) added.`);
  } catch (error) {
    utils.abort(`Error in 'add' command: ${(error as Error).message}`);
  }
};

export default utils.toCommand(
  'add',
  'Starts to track added files.',
  actionLogic,
  [['-v, --verbose', 'Verbose, shows extra information.']],
  ['<pathspec...>', 'File(s) to add to git-secret tracking.'],
);
