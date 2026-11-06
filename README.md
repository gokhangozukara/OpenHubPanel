# OpenHubPanel

**All in one panel.**

Too many projects means too many admin panels. OpenHubPanel is being built to bring websites, applications, and the people who manage them into one place.

Use it as an application's admin panel, or as a hub for several. Connect a project, give your team the access they need, and get daily work done without rebuilding the same management screens each time.

This is early development. You can run the local interface today; real sign-in, invitations, and application connections are still being built. **Do not use it to manage production or customer data yet.**

![OpenHubPanel local preview with synthetic workspace, application, and team data](docs/screenshots/local-preview.png)

## Try it locally

You need Git and Node.js 24. The preview needs no Docker, API keys, or cloud account. Repository access is currently restricted while development continues.

```sh
git clone https://github.com/gokhangozukara/OpenHubPanel.git
cd OpenHubPanel
npx --yes pnpm@12.18.0 install --frozen-lockfile
npx --yes pnpm@12.18.0 dev
```

Open http://127.0.0.1:3000/preview. It uses sample data, and changes stay in browser memory. The preview is disabled in production.

The interface supports **English, Turkish, and German**. Use the language selector to switch; your preference is remembered. Project files, code, comments, and documentation are written in English.

## Where it is headed

- Separate workspaces for clients and teams, with scoped memberships and application access.
- Secure sign-in with required authenticator codes, recovery, and revocable server sessions.
- A documented HTTP/JSON contract that developers can implement in their own applications.
- Shared lists, details, and forms for supported management tasks, with audit records.
- A responsive interface that works on a phone as well as a desktop.

An API integration will let you work inside OpenHubPanel using one local session. Opening another application's own panel without signing in again requires that application's SSO support; adding a link alone cannot provide it.

## What works now

The repository includes a Next.js interface, application search, workspace switching, team and activity previews, themes, three interface languages, and sample dialogs. Underneath it are shared schemas, initial security helpers, PostgreSQL row-level security, a minimal worker, and CI checks. These are foundations, not a finished administration system.

Read the [project status](PROJECT_STATUS.md) for the boundary between working code and planned features. Start development with the [setup guide](docs/DEVELOPMENT.md). See the [vision](docs/product/vision.md), [roadmap](docs/roadmap/implementation.md), and [security design](docs/architecture/security.md) for the intended product.

## Contribute

Bug reports, code, documentation, accessibility fixes, and translations all help. Small improvements count. See [CONTRIBUTING.md](CONTRIBUTING.md), and use the [security policy](SECURITY.md) for private vulnerability reports.

OpenHubPanel's application code and visual design are written for this project. Local research copies of other panels are excluded from the repository and build context.

## License and contact

[MIT](LICENSE). You can use, modify, redistribute, and include OpenHubPanel in commercial work under the license terms. Contributions, stars, and sharing your changes are welcome, but voluntary. Contributors retain copyright in their own work; third-party notices must be preserved.

Created and maintained by [Gokhan Gozukara](https://github.com/gokhangozukara). Contact: [gokhangozukara@gmail.com](mailto:gokhangozukara@gmail.com).
