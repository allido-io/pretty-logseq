# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

Only the latest release is supported with security fixes. Legacy versions (pre-1.0)
are no longer maintained.

## Scope

Pretty Logseq is a client-side Logseq plugin. It runs inside Logseq's plugin
sandbox and has access to:

- The Logseq Editor API (read/write access to your graph)
- DOM manipulation within the Logseq UI
- No network access, no filesystem access, no external services

### In-scope vulnerabilities

- **DOM injection / XSS**: Unsanitized property values rendered into popovers or
  injected styles that could execute arbitrary code
- **Data exfiltration**: Any path where graph data could leak outside the plugin
  sandbox
- **Denial of service**: Input that causes the plugin to hang or crash Logseq
- **Dependency vulnerabilities**: Known CVEs in direct dependencies that are
  exploitable in this context

### Out-of-scope

- Vulnerabilities in Logseq itself or the Logseq Plugin API
- Issues requiring physical access to the user's machine
- Social engineering attacks

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities privately via one of:

1. **GitHub Security Advisories**: Use the "Report a vulnerability" button on the
   [Security tab](https://github.com/allido-io/pretty-logseq/security/advisories)
2. **Email**: Contact the maintainer directly at the email listed on the GitHub
   profile

### What to include

- Description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- The version(s) affected
- Any suggested fix (optional but appreciated)

### Response timeline

- **Acknowledgment**: Within 72 hours of report
- **Assessment**: Initial severity assessment within 1 week
- **Fix**: Critical issues patched as soon as possible; lower-severity issues
  addressed in the next release

### Disclosure

We follow coordinated disclosure. Please allow a reasonable window (typically 90
days) for a fix before public disclosure. Credit will be given to reporters in
the release notes unless anonymity is preferred.
