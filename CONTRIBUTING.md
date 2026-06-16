# Contributing to KOZMO Core

Thank you for considering contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/yusuf-mohamed0/KOZMO Core.git
cd KOZMO Core
npm install
cd frontend && npm install && cd ..
cp .env.example .env
```

## Code Style

- TypeScript strict mode — no `any` types, no implicit `any`
- 2-space indentation
- Semicolons required
- Descriptive variable names over comments

## Pull Request Process

1. Ensure all tests pass: `npm test && npm run typecheck`
2. Update the README or docs if adding new features
3. Update API references for any route changes
4. PRs require at least one review before merging

## Testing

```bash
npm test                       # Unit tests
npm run test:e2e               # E2E integration tests
npm run typecheck              # TypeScript type check
cd frontend && npx tsc --noEmit  # Frontend type check
```

## Project Structure

```
backend/          # Express API + services + pipeline
frontend/         # React SPA
scripts/          # Utility scripts
docker/           # Docker & Nginx configs
n8n/              # n8n automation workflows
```

## Questions?

Open an issue or reach out via the discussions tab.
