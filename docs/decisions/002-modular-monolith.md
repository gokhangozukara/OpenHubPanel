# ADR-002: Modular monolith

Status: accepted.

Start with a TypeScript modular monolith: Next.js web, a separate worker process, PostgreSQL, and Redis. Share contracts, security helpers, database access, and observability through a pnpm workspace.

Separate domain/use-case rules from routes/UI and infrastructure adapters. Isolate external services behind a connector boundary. Use transactions for local invariants and an outbox for remote writes.

This keeps setup/deployment manageable while preserving module boundaries. Extract a service only when measured load or team needs justify it. Microservices are outside P0.
