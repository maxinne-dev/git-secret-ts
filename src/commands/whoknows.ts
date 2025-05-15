import { Command } from 'commander';
import * as utils from '../utils';

interface WhoknowsCommandOptions {
  long?: boolean;
}

const actionLogic = async (options: WhoknowsCommandOptions) => {
  try {
    await utils.userRequired();
    const publicKeys = await utils.listUserPublicKeys();

    if (publicKeys.length === 0) {
      utils.message('No users are configured to know the secret.');
      return;
    }

    for (const pubKey of publicKeys) {
      const userIds = pubKey.getUserIDs();
      const primaryUserId =
        userIds.find(uid => uid.includes('@')) || userIds[0] || 'Unknown User';

      let output = primaryUserId;

      if (options.long) {
        const expirationTime = await pubKey.getExpirationTime();

        output += ` (KeyID: ${pubKey.getKeyID().toHex()}`;
        if (expirationTime instanceof Date) {
          output += `, Expires: ${expirationTime.toISOString().split('T')[0]}`;
        } else if (expirationTime === null || expirationTime === Infinity) {
          output += `, Expires: never`;
        } else {
          output += `, Expiration: varies/unknown`;
        }
        output += ')';
      }
      console.log(output);
    }
  } catch (error) {
    utils.abort(`Error in 'whoknows' command: ${(error as Error).message}`);
  }
};

export default utils.toCommand(
  'whoknows',
  'Print email for each key in the keyring.',
  actionLogic,
  [['-l, --long', "'long' output, shows key expiration dates."]],
);
