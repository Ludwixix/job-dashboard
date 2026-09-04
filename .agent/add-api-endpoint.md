# Component Workflow: Adding a New Backend API Endpoint

Strict engineering rules and context boundaries when creating or exposing REST API routes in `job-dashboard`.

## 1. Architectural Boundaries
- **Routing Layer**: Define HTTP route parsing strictly in `backend/src/job_dashboard/web.py` within `do_GET` or `do_POST`.
- **Domain Facade**: Route handlers must delegate business logic to `DashboardApp` (`app`) or `JobRepository` (`app.repository`), never directly executing raw SQL strings or importing foreign modules inside the handler.
- **Contract Boundary**: Expose any new methods via `backend/src/job_dashboard/api/gateway.py` (`ApiGateway`).
- **Context Limits**: Do not refactor unrelated routes or rewrite existing JSON response signatures when adding a new endpoint.

## 2. Endpoint Implementation Checklist
1. **Request Parsing & Validation**:
   - Parse query strings with `parse_qs(parsed.query)` in `do_GET`.
   - Read JSON bodies safely in `do_POST` with error handling for malformed JSON.
   - Return clean JSON error payloads with appropriate HTTP status codes (e.g. 400 Bad Request, 404 Not Found, 500 Internal Error).
2. **Response Standardization**:
   - All responses must be valid JSON sent via `self.send_json(status_code, payload)`.
3. **OpenAPI Documentation**:
   - Add the path, parameters, request body schema, and response schemas to `backend/src/job_dashboard/openapi.py`.
   - Run `npm run generate-openapi` to synchronize `packages/shared/openapi.json`.
4. **Frontend Client Update**:
   - Add the client method to `frontend/src/api/` (`jobsApi.js`, `applicationsApi.js`, etc.) using `apiRequest()`.

## 3. Verification & Testing
1. Add backend test in `backend/tests/test_backend_persistence.py` or a dedicated test file:
   `cd backend && python3 -m pytest tests/test_backend_persistence.py -v`
2. Validate OpenAPI spec generation:
   `npm run generate-openapi`
3. If applicable, add smoke test check in `scripts/smoke-test.sh`.
