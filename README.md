# git-secret-ts

[![npm version](https://badge.fury.io/js/git-secret-ts.svg)](https://badge.fury.io/js/git-secret-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js->=22.15.0-green.svg)](https://nodejs.org/)

A TypeScript re-implementation of [git-secret](https://github.com/sobolevn/git-secret) that works cross-platform, including Windows environments.

## Table of Contents

- [What is git-secret-ts?](#what-is-git-secret-ts)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Available Commands](#available-commands)
- [Is this a replacement to git-secret?](#is-this-a-replacement-to-git-secret)
- [Requirements](#requirements)
- [Security](#security)
- [Todo](#todo)
- [Changelog](#changelog)
- [AI Disclaimer](#ai-disclaimer)

## What is git-secret-ts?

git-secret-ts is a cross-platform TypeScript re-implementation of [git-secret](https://github.com/sobolevn/git-secret). While the original git-secret is designed for Unix and Bash-compatible environments, git-secret-ts works on Windows, macOS, and Linux.

This project was created to solve the cross-platform compatibility limitations of the original git-secret while providing the same core functionality for encrypting and managing sensitive files in Git repositories. Instead of executing system commands like `git` and `gpg`, git-secret-ts uses TypeScript libraries to provide the same functionality programmatically.

## Installation

Install git-secret-ts globally using npm:

```bash
npm install -g git-secret-ts
```

Or use it directly with npx:

```bash
npx git-secret-ts --help
```

## Quick Start

1. **Initialize git-secret in your repository:**
   ```bash
   git-secret init
   ```

2. **Add a user who can decrypt secrets:**
   ```bash
   git-secret tell user@example.com
   ```

3. **Add files to be encrypted:**
   ```bash
   git-secret add secret-file.txt
   ```

4. **Encrypt the files:**
   ```bash
   git-secret hide
   ```

5. **Decrypt the files:**
   ```bash
   git-secret reveal
   ```

## Available Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize git-secret in the current repository |
| `add <file>` | Add a file to be encrypted |
| `remove <file>` | Remove a file from encryption |
| `list` | List all files that will be encrypted |
| `tell <email>` | Add a user who can decrypt secrets |
| `killperson <email>` | Remove a user's access to secrets |
| `whoknows` | List all users who can decrypt secrets |
| `hide` | Encrypt all added files |
| `reveal` | Decrypt all encrypted files |
| `changes` | Show changes in encrypted files |
| `clean` | Clean encrypted files |
| `cat <file>` | Show the contents of an encrypted file |
| `usage` | Show usage information |

Use `git-secret <command> --help` for detailed information about each command.

## Is this a replacement to git-secret?

**No**, this is an alternative implementation for cross-platform compatibility.

While git-secret-ts provides the same core functionality as git-secret, if you're in a Unix/Bash-compatible environment, the original git-secret is the more mature choice. However, git-secret-ts is perfect for:

- **Windows users** who need git-secret functionality
- **Cross-platform teams** working across different operating systems  
- **Projects requiring Node.js/TypeScript integration**

Future plans include extending functionality beyond what the original offers (see [Todo](#todo) section).

### Requirements

- **Node.js** >= 22.15.0 (tested on LTS)
- **tsx** for running TypeScript without transpilation
- **Git** repository (initialized with `git init`)
- **GPG key pair** for encryption/decryption

### Security

> **Important Security Notice** (adapted from git-secret):

In order to encrypt files only when modified (`git-secret hide -m`), the path mappings file tracks SHA256 checksums of added files. Although SHA collision chances are low, it's recommended to:

- Pad files with random data for greater security
- Avoid using the `-m` option for critical secrets
- Use longer secret files rather than single passwords

Since this implementation uses different dependencies than the original git-secret, please report any security issues to: [git-secret-ts@maxinne.me](mailto:git-secret-ts@maxinne.me).

## Changelog

git-secret-ts follows [semantic versioning](https://semver.org/). 

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## Todo

### Known Issues

- [ ] Retrieving the public key uses the `gpg` command instead of an exported key ([#1](https://github.com/maxinne-dev/git-secret-ts/issues/1))
- [ ] Private key needs to be exported to use ([#4](https://github.com/maxinne-dev/git-secret-ts/issues/4))  
- [ ] Finish implementing unit tests ([#2](https://github.com/maxinne-dev/git-secret-ts/issues/2))

### Next Steps

- [ ] Implement integration tests ([#6](https://github.com/maxinne-dev/git-secret-ts/issues/6))
- [ ] Implement keypair creation to remove GPG dependency ([#5](https://github.com/maxinne-dev/git-secret-ts/issues/5))
- [ ] Implement KBX file reading for key retrieval ([#3](https://github.com/maxinne-dev/git-secret-ts/issues/3))

## AI Disclaimer

This project uses AI assistance for some function implementations and unit tests. All AI-generated code has been reviewed, tested, and modified as needed. The use of AI tools is disclosed here to:

- Maintain transparency and ethical standards
- Demonstrate how AI can enhance (not replace) human development work
- Provide a clear path forward for AI-assisted development

The project maintains the MIT license from the original git-secret implementation.
