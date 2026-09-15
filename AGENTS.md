# AGENTS.md — AI Agent Guidelines & Branch Rules

This document defines the architecture, branch structure, and **strict operational rules** for all AI coding agents (Claude, Cursor, Antigravity, Copilot, Windsurf, Roo Code, etc.) working in the **WA OTP** repository.

---

## 🚨 CRITICAL RULE: NEVER MERGE `feat/self-host` INTO `main`

> [!CAUTION]
> **ABSOLUTE RULE FOR ALL AGENTS:**
> **NEVER** merge branch `feat/self-host` into `main`.
> **NEVER** run commands such as:
> - `git merge feat/self-host` (while on `main`)
> - `git checkout main && git merge ...`
> - `gh pr merge 1`
> - `git push origin feat/self-host:main`
>
> The `main` branch powers an **active, live production deployment** on the public internet. Merging `feat/self-host` into `main` will trigger automated deployments and break the currently running hosted service for live users.

---

## Branch Architecture & Roles

This repository operates with two distinct branch tracks:

| Branch | Purpose | Status | Deploy Target | Target Audience |
|---|---|---|---|---|
| **`main`** | **Hosted Live Service** | 🟢 ACTIVE PRODUCTION | Render / Vercel / Live VPS | Existing users testing the live hosted version |
| **`feat/self-host`** | **Free & Self-Hostable Gateway** | 🛠️ SELF-HOST DEVELOPMENT | Docker Compose / Self-host VPS | Developers deploying on their own infrastructure |

### 1. The `main` Branch (Production Live)
- **Model:** Hosted WhatsApp OTP SaaS / trial gateway.
- **Characteristics:** Runs with hosted service configurations, live domains (`waotp.codaipro.com`, Render API), and shared hosted database.
- **Rule:** Only critical production bug fixes may be made on `main`. Do NOT refactor or delete hosted service files on `main`.

### 2. The `feat/self-host` Branch (Open-Source Self-Hosted)
- **Model:** 100% Free & Open-Source, Self-Hostable OTP Gateway.
- **Characteristics:**
  - Zero dependency on `codaipro.com` or any private infrastructure.
  - Providers abstracted (`app/providers/base.py`, `meta.py`).
  - Configuration-first via root `.env.example` and `docker-compose.yml`.
  - Hashed OTP storage (SHA-256), auto-invalidation on resend, rate limits, and non-root Docker security.
  - Tracked under **Draft Pull Request #1**.
- **Rule:** All self-hosting improvements, Docker enhancements, and open-source documentation must be committed **strictly** to `feat/self-host`.

---

## Instructions for AI Agents

Whenever you start a task in this repository, follow this protocol:

### Step 1: Check Current Branch
Before modifying any files or running commands, verify which branch is checked out:
```bash
git branch --show-current
```

### Step 2: Understand User Intent
- **If the user is asking about self-hosting, Docker, Meta credentials, open source, or local testing:**
  - Verify you are on `feat/self-host`:
    ```bash
    git checkout feat/self-host
    ```
  - Commit all changes to `feat/self-host`.
  - Push to `origin feat/self-host`.
- **If the user is explicitly asking to fix or maintain the live production app:**
  - Verify you are on `main`:
    ```bash
    git checkout main
    ```
  - Only make targeted hotfixes. **NEVER** cherry-pick or merge self-hosting breaking changes into `main`.

### Step 3: Verify Pull Request Status
- Pull Request #1 is a **Draft Pull Request**.
- **Do not mark it ready for review or merge it** unless the human repository owner explicitly types: `"Merge feat/self-host into main now"`.

---

## Development & Test Commands

### Backend (`backend/`)
```bash
cd backend
./.venv/bin/pytest tests/ -q                 # Run all 87 tests (mock delivery, no external calls)
./.venv/bin/uvicorn app.main:app --port 8000  # Run API locally
```

### Frontend (`frontend/`)
```bash
cd frontend
npm run typecheck    # tsc --noEmit
npm run lint         # oxlint
npm run build        # Production Next.js build
```

---

## Safety Checklist Before Finishing Any Turn

1. [ ] Did I verify `git branch` is correct for the requested task?
2. [ ] Did I avoid running `git merge` into `main`?
3. [ ] Are all `.env` files and real API credentials kept out of git tracking?
4. [ ] Did all tests pass (`pytest` and `tsc --noEmit`)?
