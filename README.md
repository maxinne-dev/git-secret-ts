# git-secrets-ts


## What is `git-secret-ts`?

Simply put, it is a re-implementation of [git-secret](https://github.com/sobolevn/git-secret) in TypeScript. I decided to implement this due to `git-secret` being usable only in Unix and Bash compatible environments, while I was using windows. The challenge was other motivation, as I wanted to avoid executing system commands, like `git` and `gpg`, as libraries existed to replace the need.

## Is this a replacement to `git-secret`?

No.

Well, while I'm fairly confident on this implementation, if you are in an environment compatible with `git-secret`, it would be better to stick with it. I intend on eventually improving (see [#Todo](#todo)) the functionality of this plugin beyond what the original currently offer.

## Demo

> Todo

## how to use?

> Todo

### Requirements

 - `Node` -- Tested on the latest LTS (22.15.0) 
 - `tsx`  -- Allow us to run without _transpiling_ to JavaScript.

### Security

I took the liberty to copy this disclaimer from `git-secret` as it has an important consideration:

> In order to encrypt (git-secret hide -m) files only when modified, the path
mappings file tracks sha256sum checksums of the files added (git-secret add) to
git-secret's path mappings filesystem database. Although, the chances of
encountering a sha collision are low, it is recommend that you pad files with
random data for greater security. Or avoid using  the `-m` option altogether.
If your secret file holds more data than just a single password these
precautions should not be necessary, but could be followed for greater
security.

Since my implementation works with other dependecies than the original, in case you find any security
issues, please contact me on [git-secret-ts@maxinne.me](mailto:git-secret-ts@maxinne.me).

## Changelog

`git-secret-ts` uses [semver](https://semver.org/). See [CHANGELOG.md](CHANGELOG.md).

## Todo

Known Issues:
 - Retrieving the public key uses the `gpg` command instead of an exported key. [Issue Link](http://link)
 - Private key needs to be exported to use. [Issue Link](http://link)
 - Finish implementing unit tests. [Issue Link](http://link)

Next steps:
 - Implement integration tests. [Issue Link](http://link)
 - Implement a way to create a keypair, so removing the need to use GPG. [Issue Link](http://link)
 - Implement a way to read the kbx file to retrieve keys. [Issue Link](http://link)

## AI Disclaimer

To be clear, I used AI to help implement some functions and in all unit tests. I claim no ownership
 of any code it generated but my corrections. As I kept the MIT license from the original code, this
should not be an issue. It is my opinion that any use of AI should be clearly marked to both: maintain
ethical worries at bay, and to propose a path forward where AI is used to improve work conditions 
instead of a replacement to human work.
