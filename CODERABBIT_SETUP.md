# CodeRabbit AI Setup Guide

This guide explains how to set up CodeRabbit AI for automated code reviews on this repository.

## Overview

[CodeRabbit](https://coderabbit.ai) is an AI-powered code reviewer that provides intelligent feedback on pull requests. It's **free for open source projects**, making it perfect for this repository.

## Features

- 🤖 **AI-Powered Code Review** - Intelligent analysis of code changes
- 🔍 **Line-by-Line Feedback** - Comments on specific lines of code
- 📝 **Change Summaries** - High-level summaries of PR changes
- 🎯 **Performance Analysis** - Performance insights for native code
- 🛡️ **Security Detection** - Identifies potential security issues
- 💬 **Interactive Chat** - Reply to the AI for clarifications
- 🎭 **Multi-Language Support** - Reviews both C++ and JavaScript code

## Setup Instructions

### Step 1: Install CodeRabbit GitHub App

1. Go to [GitHub Apps - CodeRabbit](https://github.com/apps/coderabbitai)
2. Click "Configure" or "Install"
3. Select your GitHub account
4. Choose repository access:
   - Select "Only select repositories"
   - Check `faiss-node-native`
5. Click "Install & Request"

### Step 2: Verify Configuration

The repository already includes `.coderabbit.yml` with optimized settings for this project. The configuration includes:

- **C++ Specific Reviews** - Memory management, thread safety, N-API best practices
- **JavaScript Reviews** - Async error handling, type validation, API ergonomics
- **Test Reviews** - Coverage analysis, edge case detection
- **Documentation Reviews** - Accuracy and clarity checks
- **Security Focus** - Vulnerability detection in native code

### Step 3: Test the Integration

1. Create a new pull request (or update an existing one)
2. Watch for CodeRabbit's review to appear automatically
3. Review the feedback provided

### Step 4: Customize (Optional)

Edit `.coderabbit.yml` to modify:
- Review depth and focus areas
- Language settings
- Auto-review triggers
- Ignore patterns

## Usage Guidelines

### For Maintainers

- Reviews appear automatically on all PRs
- Reply to CodeRabbit comments using `@coderabbitai` mentions
- Use `[skip review]` or `[no review]` in PR title to skip when needed
- Customize review behavior via `.coderabbit.yml`

### For Contributors

- CodeRabbit will automatically review your PRs
- Read the feedback carefully and address suggestions
- Reply to CodeRabbit comments if you need clarification
- Use feedback to improve code quality before maintainer review

## Configuration Details

The `.coderabbit.yml` file includes:

### C++ Review Focus
- Memory leak detection
- Thread safety analysis
- N-API compliance
- Exception handling
- Resource management
- Performance optimization

### JavaScript Review Focus
- Input validation
- Async/Promise handling
- Error propagation
- Type safety
- Native module boundaries
- Resource cleanup

### Security Review
- Buffer overflow detection
- Race condition identification
- Proper mutex usage
- Secure string handling
- Validate vector dimensions

## Best Practices

1. **Don't rely solely on AI review** - It's a tool, not a replacement for human review
2. **Consider context** - AI may miss project-specific requirements
3. **Test native code thoroughly** - AI can't easily detect runtime memory issues
4. **Use for early feedback** - Catch issues early in the PR process
5. **Iterate** - Apply suggestions to improve code quality
6. **Be specific in replies** - Help the AI provide better feedback

## Cost

**Free for Open Source!** Since this is a public repository, CodeRabbit provides automated reviews at no cost. For private repositories, there are paid tiers available.

## Troubleshooting

### CodeRabbit isn't posting reviews

1. Verify the app is installed: https://github.com/settings/installations
2. Check repository settings for installed apps
3. Ensure `.coderabbit.yml` exists in the repository root
4. Check GitHub Actions logs for the `coderabbit.yml` workflow
5. Make sure the PR doesn't have `[skip review]` in the title

### Reviews seem incomplete

- Check `.coderabbit.yml` path filters for exclusions
- Verify sufficient diff context (large PRs may be truncated)
- Ensure necessary secrets are available (none needed for opensource)

### False positives in C++ code

- The `.coderabbit.yml` file has specific C++ review prompts
- Adjust the instructions in the config file if needed
- Use inline comments to explain complex native code patterns

## Examples

CodeRabbit will provide feedback like:

```diff
- float* raw_ptr = new float[100];
+ // CodeRabbit: Consider using std::unique_ptr<float[]> for automatic memory management
```

```javascript
// CodeRabbit: After add(), verify return value or catch potential errors
await index.add(vectors);
```

## Further Reading

- [CodeRabbit Documentation](https://docs.coderabbit.ai)
- [Configuration Options](https://docs.coderabbit.ai/guides/configure-coderabbit)
- [GitHub App Installation](https://github.com/apps/coderabbitai)

## Support

For CodeRabbit-specific issues:
- Check the [documentation](https://docs.coderabbit.ai)
- Contact [support@coderabbit.ai](mailto:support@coderabbit.ai)
- Report issues: https://github.com/coderabbitai/coderabbitai/issues

For this repository:
- Open an issue: [faiss-node-native issues](https://github.com/anupammaurya6767/faiss-node-native/issues)
- Discussions: [GitHub Discussions](https://github.com/anupammaurya6767/faiss-node-native/discussions)
