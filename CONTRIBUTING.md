# Contributing to react-native-ai-hooks

Thank you for your interest in contributing to react-native-ai-hooks.

We are building a practical, provider-agnostic AI hooks toolkit for React Native, and contributions from the community are a big part of making it better. Whether you are fixing a bug, improving docs, adding a new hook, or integrating a new provider, your help is welcome.

## Ways to Contribute

- Report bugs and edge cases
- Suggest new features or API improvements
- Improve examples and documentation
- Add support for new AI providers (for example Groq, Perplexity, or Mistral)
- Create new hooks for common AI workflows
- Add or improve tests

## Reporting Bugs

Please report bugs through GitHub Issues:

- https://github.com/nikapkh/react-native-ai-hooks/issues

Before opening an issue:

- Check existing issues to avoid duplicates
- Confirm the problem on the latest version if possible

When opening a bug report, include:

- A clear title and short summary
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, React Native version, package version)
- Minimal code snippet or repo that reproduces the problem
- Relevant logs, stack traces, or screenshots

## Development Setup

1. Fork the repository on GitHub.
2. Clone your fork.
3. Install dependencies:

```bash
npm install
```

4. Run tests:

```bash
npm test
```

## Git Workflow

Use this workflow for all contributions:

1. Fork repository
2. Create branch
3. Commit changes
4. Push branch
5. Open pull request

Example commands:

```bash
git checkout -b feat/add-mistral-provider
# make changes
git add .
git commit -m "feat: add mistral provider adapter"
git push origin feat/add-mistral-provider
```

## Pull Request Guidelines

- Keep PRs focused and small when possible
- Write clear commit messages
- Describe the problem and solution in the PR description
- Link related issues when relevant
- Update docs when behavior or API changes

All pull requests must pass existing tests before they can be merged.

## Testing

We use Jest for testing.

- Test command: `npm test`
- New functionality should include tests where practical
- Bug fixes should include a regression test when possible

Relevant test setup files:

- [jest.config.cjs](jest.config.cjs)
- [jest.setup.ts](jest.setup.ts)

## Adding a New Provider

If you want to add a provider such as Groq, Perplexity, or Mistral, a typical path is:

- Add provider types and interfaces in [src/types/index.ts](src/types/index.ts)
- Add request/response adapter logic in [src/utils/providerFactory.ts](src/utils/providerFactory.ts)
- Ensure resilience behavior remains compatible with [src/utils/fetchWithRetry.ts](src/utils/fetchWithRetry.ts)
- Add tests in [src/utils/__tests__](src/utils/__tests__)
- Update docs in [README.md](README.md) and [docs/README.md](docs/README.md)

## Adding a New Hook

If you want to add a new hook:

- Create the hook in [src/hooks](src/hooks)
- Export it from [src/index.ts](src/index.ts)
- Add or update relevant types in [src/types/index.ts](src/types/index.ts)
- Add tests and docs for the new behavior

## Communication and Conduct

Please be respectful and constructive in issues and pull requests. Thoughtful feedback and collaboration help everyone ship better software.

## Thank You

Thanks again for helping improve react-native-ai-hooks.
Your contributions make the library more reliable, more useful, and more accessible for the entire community.
