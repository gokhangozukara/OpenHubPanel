# Security Policy

## Project status

OpenHubPanel (`v0.1.0`) is in early development. It includes a multi-user PostgreSQL workspace MVP (`/workspace`), a separate local synthetic-data preview (`/preview`, disabled in production), and a separate single-owner compatibility adapter. Review [PROJECT_STATUS.md](PROJECT_STATUS.md) and the [acceptance evidence](docs/research/general-workspace-mvp.md) before using real customer data. Architecture documents include planned controls; only the checks explicitly listed in project status have been implemented and verified.

## Report a vulnerability

Please report security vulnerabilities privately using GitHub Private Vulnerability Reporting on this repository, or by emailing **Gokhan Gozukara** at [gokhangozukara@gmail.com](mailto:gokhangozukara@gmail.com) with the subject `OpenHubPanel security report`.

Include the affected version or file, potential impact, and minimal reproduction steps using synthetic data. Do not send live credentials, private keys, customer data, or destructive proof-of-concept payloads. Do not post vulnerability details in a public issue before coordinating disclosure.

No response-time commitment or bug bounty program has been established.

This policy does not authorize testing against live services, third-party systems, or systems you do not own. Local reference copies are outside the OpenHubPanel release scope; concerns about another project should be reported to its maintainer.

## Maintainer handling

The maintainer reviews reports, requests clarification when needed, and coordinates remediation and disclosure with the reporter. Reporter credit is given only with their consent.
