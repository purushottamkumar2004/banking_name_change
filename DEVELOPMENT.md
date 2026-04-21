# Development Guide

## Quick Start (5 minutes with mock data)

The fastest way to see the full UI running is with mock mode — no Google/Gemini
API keys required.

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Backend
cd backend
npm install
cp .env.example .env
# Edit .env: set DB_HOST=localhost, DB_PASSWORD=rootpassword, MOCK_PIPELINE=true

npm run migrate   # Create MySQL tables
npm run seed      # Insert 10 realistic test cases
npm run dev:mock  # Start backend in mock mode (port 3001)

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev       # Start Vite dev server (port 5173)
```

Open http://localhost:5173 — you'll see the intake form and the checker dashboard
pre-populated with 10 test cases in various states.

---

## Project Layout

```
name-change-system/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   ├── state.js                  Shared LangGraph state
│   │   │   ├── intakeValidationAgent.js  Agent 1
│   │   │   ├── documentProcessorAgent.js Agent 2 (Doc AI + Gemini)
│   │   │   ├── fieldValidationAgent.js   Agent 3a (parallel)
│   │   │   ├── forgeryDetectionAgent.js  Agent 3b (parallel)
│   │   │   ├── confidenceScorerAgent.js  Agent 4
│   │   │   ├── summaryAgent.js           Agent 5
│   │   │   ├── pipeline.js               LangGraph orchestrator
│   │   │   ├── mockPipeline.js           Synthetic data for dev
│   │   │   └── auditLogger.js            DB audit trail helper
│   │   ├── db/
│   │   │   ├── pool.js                   MySQL connection pool
│   │   │   ├── migrate.js                Schema creation
│   │   │   ├── seed.js                   Test data
│   │   │   └── chroma.js                 Vector DB for similarity
│   │   ├── middleware/
│   │   │   ├── validate.js               Zod request validation
│   │   │   └── security.js               Rate limiting, headers, UUID check
│   │   ├── routes/
│   │   │   ├── requests.js               All API endpoints
│   │   │   └── coreBanking.js            Mock RPS (HITL gate)
│   │   └── server.js                     Express entry point
│   ├── tests/
│   │   └── integration.test.js           End-to-end test suite
│   ├── .env.example
│   └── package.json
│
└── frontend/
    └── src/
        ├── api/
        │   └── client.js                 Axios API wrapper
        ├── components/
        │   ├── ScoreCard.jsx             Confidence score visual
        │   ├── SimilarCases.jsx          Chroma similar case results
        │   ├── ProcessingBanner.jsx      Pipeline stage progress
        │   └── MetricsDashboard.jsx      Ops stats bar
        ├── hooks/
        │   └── usePolling.js             Auto-polling with terminal stop
        ├── pages/
        │   ├── IntakeForm.jsx            Page 1: Submit request
        │   ├── CheckerDashboard.jsx      Page 2: Request list
        │   └── RequestDetail.jsx         Page 3: Full review + HITL
        ├── App.jsx
        ├── main.jsx
        └── styles.css
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DB_HOST` | Yes | MySQL host |
| `DB_PASSWORD` | Yes | MySQL root password |
| `GOOGLE_APPLICATION_CREDENTIALS` | Live only | Path to GCP service account JSON |
| `GOOGLE_DOCUMENT_AI_PROCESSOR_ID` | Live only | Document AI processor ID |
| `GEMINI_API_KEY` | Live only | Gemini 1.5 Pro API key |
| `LANGCHAIN_API_KEY` | Optional | LangSmith tracing |
| `MOCK_PIPELINE` | Dev | `true` = use synthetic data |
| `CHROMA_URL` | Optional | Chroma vector DB URL |

---

## Switching from Mock to Live

1. Set `MOCK_PIPELINE=false` in `.env`
2. Fill in `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`, `GEMINI_API_KEY`
3. Run `npm run dev` (not `dev:mock`)

The pipeline will now use real Google Document AI OCR and Gemini 1.5 Pro extraction.

---

## Running Tests

```bash
cd backend
npm test
```

Runs 20 integration tests covering:
- State object creation
- Mock pipeline output structure
- HITL enforcement (AI never sets decision)
- Scoring weights (sum to 1.0)
- Penalty application
- Intake validation edge cases (Unicode names, identical names)

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/requests` | None | Submit new request (multipart) |
| `GET` | `/api/requests` | None | List requests (paginated, filterable) |
| `GET` | `/api/requests/:id` | None | Full request detail |
| `GET` | `/api/requests/:id/document` | None | Pre-signed doc URL |
| `POST` | `/api/requests/:id/approve` | Checker | Approve (HITL gate) |
| `POST` | `/api/requests/:id/reject` | Checker | Reject with reason |
| `GET` | `/health` | None | DB health check |
| `GET` | `/metrics` | None | Operational stats |

---

## Google Cloud Setup (for live mode)

1. Create a Google Cloud project
2. Enable the Document AI API
3. Create a Document AI processor (type: "Document OCR" or "Form Parser")
4. Create a service account with "Document AI User" role
5. Download the JSON key → set `GOOGLE_APPLICATION_CREDENTIALS` to its path
6. Copy project ID, location, processor ID to `.env`

---

## MinIO Console

Access the MinIO S3 console at http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin`
- Bucket: `name-change-docs`

Uploaded documents and extracted JSON files are stored here.

---

## LangSmith Tracing

Set in `.env`:
```
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_key
LANGCHAIN_PROJECT=name-change-verification
```

Every agent execution (intake, OCR, field validation, forgery, scoring, summary)
is traced individually. View at https://smith.langchain.com

---

## HITL Enforcement — How It Works

The AI pipeline ALWAYS ends with `decision: "AI_VERIFIED_PENDING_HUMAN"`.

The only code path that calls the core banking mock API is:
```
POST /api/requests/:id/approve  →  mockCoreBankingUpdate()
```

This endpoint validates:
1. Request exists
2. Status is exactly `AI_VERIFIED_PENDING_HUMAN`
3. `checker_id` is present

If any check fails, the banking call is never made.
The AI agents have no import of `coreBanking.js` — it's architecturally impossible
for them to trigger a banking update.
