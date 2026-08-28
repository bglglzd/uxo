# Security Policy

UXO processes microphone audio and speech-to-text data locally by default. Security and privacy reports are therefore treated with particular care.

## Supported Versions

Only the newest published preview is currently supported with security fixes.

| Version                | Supported |
| ---------------------- | --------- |
| Latest `0.1.x` preview | Yes       |
| Older builds           | No        |

## Reporting a Vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/bglglzd/uxo/security/advisories/new). This keeps the report and any proof of concept private while a fix is prepared.

If private reporting is unavailable, open a public issue that asks the maintainer to establish a private contact channel. Do not include vulnerability details in that issue.

Please include, when safe:

- the affected UXO version and Windows version;
- a concise description of the impact and prerequisites;
- minimal reproduction steps or a proof of concept;
- whether the issue could expose microphone audio, transcripts, clipboard data, or credentials.

We will acknowledge reports on a best-effort basis, investigate them privately, and coordinate disclosure after a fix or mitigation is available. Please do not publicly disclose an unresolved vulnerability.

## Protect Sensitive Data

Never attach raw recordings or unredacted transcripts to a public issue. Before sharing logs, screenshots, settings, or diagnostic output, remove:

- spoken or transcribed personal content;
- API keys, access tokens, cookies, and authorization headers;
- local usernames, home-directory paths, machine names, and email addresses;
- microphone names, device identifiers, and other hardware details that are not essential;
- clipboard contents and post-processing prompts.

Use synthetic audio and placeholder credentials whenever possible. If sensitive data was posted accidentally, rotate any exposed credentials immediately and ask a repository maintainer to remove the content from GitHub.

## Scope

Good-faith research against software and accounts you own is welcome. Do not access other people's data, degrade services, distribute malware, or test against third-party model hosts beyond their published terms. Dependencies and model files should be reported to their upstream maintainers as well when the issue originates there.
