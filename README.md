# Bunoraa Admin v2

Refine-powered admin workspace for Bunoraa.

This app is intentionally separate from the Django server and separate from the storefront frontend so a `v2` admin release can fail or roll back independently without taking down `v1` Django admin or the public site.

## What is implemented

- MFA-aware login against the existing Django JWT flow
- Dynamic admin bootstrap from `/api/v1/admin/bootstrap/`
- Dynamic navigation built from backend resource metadata
- Generic list, show, create, and edit screens for registered admin resources
- Search compatibility for both DRF `search` endpoints and existing Bunoraa `q` endpoints
- Dedicated order operations panel for status changes, tracking updates, and shipment actions
- Custom pages for:
  - `dashboard`
  - `health`
  - `health/details`
  - `realtime/events`
  - `cms/site-settings`
  - `shipping/settings`
- Refine `dataProvider`, `authProvider`, and live websocket provider
- Production build verified with `next build`

## Backend support added

The Django backend now exposes:

- `/api/v1/admin/bootstrap/`

It also centralizes admin resource definitions in:

- `bunoraa-backend/apps/admin_api/api/resource_registry.py`

That registry is used for both router registration and `v2` navigation metadata.

## Local development

1. Start the Django backend.
2. In `bunoraa-admin-v2`, create `.env.local` from `.env.example`.
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

The app runs on `http://localhost:3001`.

## Required environment variables

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
NEXT_PUBLIC_ADMIN_APP_URL=http://localhost:3001
NEXT_PUBLIC_ADMIN_WS_URL=ws://127.0.0.1:8000/ws/admin/updates/
```

## Production deployment recommendation

Deploy this as a dedicated frontend service, for example:

- `ops.bunoraa.com`
- `admin-v2.bunoraa.com`

Do not bundle this app into the Django deployment artifact.

That separation keeps:

- Django admin `v1` available at `/admin`
- storefront releases independent
- admin `v2` build failures isolated

## Important note

This foundation is production-grade for the shell, auth, routing, bootstrap, generic CRUD, and operational pages.

Some high-touch business workflows can still benefit from dedicated screens rather than generic forms, especially:

- advanced catalog product editing
- payments and refund review flows
- support conversation tooling

The current architecture is set up so those can be added incrementally without reworking the base app.
