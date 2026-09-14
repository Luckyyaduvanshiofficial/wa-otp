# Deployment

This app deploys to Vercel out of the box, or anywhere Docker runs. `next.config.ts` sets
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

1. Connect the repository to Vercel.
2. Set the environment variables below in the project settings.
3. Deploy.

Set the root directory to `frontend/` if you are deploying from the monorepo.

| Variable | Example |
|---|---|
| `NEXT_PUBLIC_PB_URL` | `https://pb.example.com` |
| `NEXT_PUBLIC_PB_COLLECTIONS_PREFIX` | `waotp_` |
| `NEXT_PUBLIC_API_URL` | `https://api.example.com` |
| `NEXT_PUBLIC_APP_URL` | `https://app.example.com` |
| `NEXT_PUBLIC_GITHUB_REPO` | `owner/repo` (optional) |

`NEXT_PUBLIC_APP_URL` is the PocketBase password-reset return address, so it must be the
origin your users actually reach.

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
