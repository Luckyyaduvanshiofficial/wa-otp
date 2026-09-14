# Deployment

This app deploys to Vercel, or anywhere Docker runs. `next.config.ts` sets
`output: 'standalone'` when `BUILD_STANDALONE=true`, which is what the Dockerfiles expect.

The backend is deployed separately — see [`../../backend/README.md`](../../backend/README.md)
and PRD §10. This app is only the dashboard and public site.

## Before you deploy

Three things bite in production and none of them are obvious from a successful build:

> [!IMPORTANT]
> **Set `DASHBOARD_ORIGIN` on the FastAPI backend to this app's origin.** Without it, CORS
> blocks every browser call the dashboard makes — and it presents as a dead backend, not a
> configuration mistake. This is the single most common deployment failure.

> [!IMPORTANT]
> **`NEXT_PUBLIC_*` variables are baked in at build time.** They are not read at runtime, so
> changing one requires a rebuild. Set them in the build environment, not after.

> [!WARNING]
> **`NEXT_PUBLIC_PB_COLLECTIONS_PREFIX` must match `WAOTP_PB_COLLECTIONS_PREFIX` on the
> backend.** Never leave it empty against a shared PocketBase instance — an unprefixed build
> addresses the stock `users` and `api_keys` collections, which belong to another project.

## Vercel

This dashboard lives at `frontend/` in a monorepo, which changes two things from Vercel's
default flow. Both are required — a default import of this repository does not build.

1. **Import the repository** at [vercel.com/new](https://vercel.com/new).
2. **Set Root Directory to `frontend`** (Settings → General → Root Directory). There is no
   `package.json` at the repo root, so a project rooted there detects no framework and fails
   with *"No Next.js version detected"*. This is the monorepo step, and it is dashboard-only —
   no file in this repo can set it.
3. **Leave Framework Preset and the build commands alone.** Vercel finds `frontend/bun.lock`
   and uses Bun for install and build with no configuration.
4. **Add the environment variables below before the first deploy.** `NEXT_PUBLIC_*` values are
   baked into the bundle at build time, so adding one afterwards does nothing until you
   redeploy.
5. **Deploy**, then set `DASHBOARD_ORIGIN` on the backend to the origin Vercel gives you.

No `vercel.json` is checked in, deliberately. Everything it could express is either already
auto-detected, or — in the case of Root Directory — not a `vercel.json` field at all. A
checked-in copy would only become a second source of truth that silently disagrees with the
dashboard.

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_PB_URL` | `https://pb.codaipro.com` | the shared PocketBase instance |
| `NEXT_PUBLIC_PB_COLLECTIONS_PREFIX` | `waotp_` | must equal `WAOTP_PB_COLLECTIONS_PREFIX` |
| `NEXT_PUBLIC_API_URL` | `https://wa-otp-api.onrender.com` | the Render service URL, no trailing slash |
| `NEXT_PUBLIC_APP_URL` | `https://app.example.com` | the PocketBase password-reset return address, so it must be the origin your users actually reach |
| `NEXT_PUBLIC_GITHUB_REPO` | `owner/repo` | optional; unset hides the star count and footer link rather than inventing a number |
| `NEXT_PUBLIC_SENTRY_DISABLED` | `1` | set this unless Sentry is actually configured |

### Preview deployments and CORS

`DASHBOARD_ORIGIN` is a single origin, but Vercel gives every branch and PR its own hostname.
Browser calls from a preview URL therefore fail CORS until `DASHBOARD_ORIGIN` names that
preview origin — which looks exactly like a dead backend. Either test against the production
domain, or point `DASHBOARD_ORIGIN` at the preview origin you are testing and set it back
after. The match is exact: scheme included, no trailing slash, no path. `app.vercel.app` and
`app-git-main.vercel.app` are different origins.

For other platforms, see the [Next.js deployment docs](https://nextjs.org/docs/app/getting-started/deploying).

## Docker

Two production Dockerfiles are included: `Dockerfile` (Node.js) and `Dockerfile.bun` (Bun).
`NEXT_PUBLIC_*` variables are build-time arguments; runtime-only values are passed with `-e`.

```bash
# Node.js
docker build \
  --build-arg NEXT_PUBLIC_PB_URL=https://pb.example.com \
  --build-arg NEXT_PUBLIC_PB_COLLECTIONS_PREFIX=waotp_ \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com \
  -t wa-otp-dashboard .

# or Bun
docker build -f Dockerfile.bun \
  --build-arg NEXT_PUBLIC_PB_URL=https://pb.example.com \
  --build-arg NEXT_PUBLIC_PB_COLLECTIONS_PREFIX=waotp_ \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com \
  -t wa-otp-dashboard .
```

```bash
docker run -d -p 3000:3000 \
  --restart unless-stopped \
  --name wa-otp-dashboard \
  wa-otp-dashboard
```

If you build with `BUILD_STANDALONE=true`, the Dockerfiles' `output: 'standalone'` path is
used. Without it, `next build` produces a normal build and the image will not start.
