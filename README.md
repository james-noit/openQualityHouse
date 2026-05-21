# Open Quality House

Open Quality House is a frontend-only web app for building a modern House of Quality, prioritising customer needs against technical responses, and optionally using an AI chatbot to generate a first draft.

## Framework choice

React is the best fit for this project.

- **Interactive matrix editing:** the House of Quality is a highly dynamic grid with immediate recalculation of weighted scores and correlations, which maps cleanly to React state updates.
- **Optional AI integrations:** React + Vite keeps the app lightweight while still making it easy to integrate browser-side calls to providers such as OpenAI, Anthropic, Gemini, OpenRouter, or any OpenAI-compatible endpoint.
- **Fast frontend-only delivery:** compared with Angular, React has less framework overhead for a small SPA; compared with Vue, React offers the broadest ecosystem for AI-centric UI patterns while staying simple to deploy as static assets.

## Features

- Modern single-page House of Quality editor
- Editable customer needs and technical requirements
- Relationship matrix with weighted opportunity scoring
- Technical correlation roof
- Optional AI chatbot panel with provider presets and custom endpoint/API key support
- Local browser persistence via `localStorage`

## Development

```bash
npm install
npm run dev
```

### Validation

```bash
npm run lint
npm run build
```
