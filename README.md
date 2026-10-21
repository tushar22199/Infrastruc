# InfraSight AI
### AI-Powered Infrastructure Inspection & Auditing Platform

InfraSight AI is a full-stack platform for managing infrastructure inspections, identifying defects, tracking inspection status, and turning inspection data into actionable insights. It combines a field-inspection workflow with AI-assisted analysis, standards-aware retrieval, reporting, and operational dashboards.

**Live application:** https://infrastruc.vercel.app  
**API:** https://infrastruc.onrender.com  
**Repository:** https://github.com/tushar22199/Infrastruc

---

## Highlights

- **Inspection management:** Create and manage infrastructure inspection records, track statuses, and organize findings.
- **AI inspection assistance:** OpenAI-powered conversational assistance and retrieval-augmented generation (RAG) grounded in ingested engineering standards and relevant inspection information.
- **Image analysis:** AI-assisted analysis of defect images to support inspection workflows.
- **Automated PDF reports:** Generate inspection reports, with report generation designed to complete in under 10 seconds.
- **Analytics dashboard:** View inspection metrics and regional infrastructure health indicators.
- **Regional Health Score:** Server-side score from 0–100 that reflects recorded issue severity; deductions are Critical −15, Medium −5, and Low −2.
- **Map view:** View inspection information geographically.
- **Offline-first inspections:** IndexedDB (Dexie)-backed queue stores pending inspection submissions and syncs them in batches when connectivity returns.
- **Authentication and access control:** JWT-based authentication and role-based access control (RBAC).
- **API protection:** Dedicated rate limits for authentication attempts and AI requests.
- **InfraSight Voice:** A voice-oriented interface backed by a read-only Model Context Protocol (MCP) tool for searching inspection records.
- **Automated quality checks:** GitHub Actions CI validates types, runs API-server unit tests, builds the project, and builds the Docker image.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js, TypeScript |
| Data | PostgreSQL, Neon, Drizzle ORM |
| AI | OpenAI API, RAG/retrieval pipeline, image analysis |
| Authentication | JWT, RBAC, bcryptjs |
| Offline support | IndexedDB, Dexie |
| AI tool integration | Model Context Protocol (MCP) |
| Testing and quality | Unit tests, TypeScript typechecking, GitHub Actions |
| Deployment and packaging | Vercel, Render, Docker |

## AI and Engineering Knowledge Retrieval

InfraSight AI includes a retrieval pipeline for searching relevant inspection information and engineering knowledge. The standards ingestion work includes:

- **IS 800:2007** — 676 chunks verified.
- **IS 456:2000** — 445 chunks verified after duplicate records/chunks were removed.
- **IS 1893:2016** — downloaded for ingestion as a standards document.

The retrieval-augmented assistant is intended to help users find relevant context; AI output should be reviewed by a qualified professional before it is used for safety-critical engineering decisions.

## InfraSight Voice and MCP

InfraSight Voice connects the application to an authenticated MCP endpoint at `/mcp`.

The current MCP server exposes a read-only tool:

- `search_inspections` — searches inspection records using a natural-language query, including issue type, severity, and status.

The MCP proxy restricts supported operations and forwards authenticated requests. The inspection search tool does not create, update, or delete inspection records.

## API Rate Limiting

The backend uses `express-rate-limit` with separate configurations for authentication and AI requests.

| Limiter | Window | Maximum requests | Error response |
|---|---:|---:|---|
| `authLimiter` | 15 minutes | 10 | `Too many authentication attempts. Please try again later.` |
| `aiLimiter` | 15 minutes | 30 | `AI request limit exceeded. Please try again later.` |

Both configurations enable standard rate-limit headers (`standardHeaders: true`) and disable legacy headers (`legacyHeaders: false`). The middleware must be mounted on the corresponding routes for these limits to apply.

## Security and Reliability

- JWT-based authentication and role-based access control.
- Password hashing with `bcryptjs`.
- Rate limiting configurations for authentication and AI request flows.
- Authenticated MCP access and an allowlisted MCP proxy operation set.
- Automated checks for TypeScript, API-server unit tests, project build, and Docker image build.
- Offline queueing to reduce data loss when field connectivity is interrupted.

## Architecture at a Glance

1. The React client provides inspection workflows, dashboards, map views, and AI-assisted interfaces.
2. The Express API handles application requests, authentication, access control, inspection operations, and report generation.
3. PostgreSQL stores application data, accessed through Drizzle ORM and hosted on Neon.
4. AI retrieval uses indexed knowledge and inspection records to supply relevant context for assistant responses.
5. Offline inspection submissions are queued locally and synchronized when the client reconnects.
6. InfraSight Voice calls the authenticated MCP endpoint to run read-only inspection searches.

## Local Development

This repository uses a pnpm workspace.

### Prerequisites

- Node.js 22
- pnpm 10
- PostgreSQL/Neon database access
- The API credentials and environment configuration required by the services you want to run

### Install dependencies

```bash
pnpm install --frozen-lockfile
```

### Configure environment

Configure the environment variables required by the API server and frontend in your local development environment. Keep credentials and secrets out of source control; use deployment-platform environment settings for hosted environments.

### Run checks

```bash
# Typecheck workspace libraries and applications
pnpm run typecheck

# Run API-server unit tests
pnpm --filter @workspace/api-server test

# Build and typecheck the workspace
pnpm run build
```

Use the package-level scripts in the relevant workspace when you need to start the frontend or API server for local development.

## Docker

A root-level `Dockerfile` is included. Build the image with:

```bash
docker build -t infrastructure-auditor .
```

Provide the runtime environment variables and external service configuration required by the application when running the container.

## Continuous Integration

The GitHub Actions workflow at `.github/workflows/ci.yml` runs on pushes to `main`, `master`, and `develop`, and on pull requests. It installs dependencies with the frozen lockfile, runs TypeScript typechecking and API-server unit tests, builds the project, and builds the Docker image.

## Deployment

- **Frontend:** https://infrastruc.vercel.app
- **Backend API:** https://infrastruc.onrender.com

Hosted deployments require the appropriate environment variables, database connectivity, and AI-provider configuration.

## Important Note

InfraSight AI is an inspection-support tool, not a replacement for on-site assessment, applicable codes, or professional engineering judgment. Verify AI-generated findings and reports before making structural, safety, or compliance decisions.
