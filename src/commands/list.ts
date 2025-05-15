import * as utils from '../utils';

const actionLogic = async () => {
    try {
        await utils.userRequired();
        const mappings = await utils.readPathMapping();
        if (mappings.length === 0) {
            if (utils.SECRETS_VERBOSE) utils.message('No files are currently tracked by git-secret.');
            return;
        }
        mappings.forEach(mapping => console.log(mapping.filePath));
    } catch (error) {
        utils.abort(`Error in 'list' command: ${(error as Error).message}`);
    }
};

export default utils.toCommand(
    'list',
    'Prints all the added files.',
    actionLogic,
    [],
    []
);
