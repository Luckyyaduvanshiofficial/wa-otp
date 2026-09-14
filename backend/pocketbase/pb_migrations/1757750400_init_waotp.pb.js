/// <reference path="../pb_data/types.d.ts" />
/**
 * WA OTP control-plane schema (PRD §5).
 *
 * ISOLATION — read this before editing.
 * This PocketBase instance may be shared with other projects, so every
 * collection this migration touches lives under a prefix. The prefix is read
 * from WAOTP_PB_COLLECTIONS_PREFIX and defaults to "waotp_" — the same default
 * as `pb_collections_prefix` in `app/core/config.py` and
 * PB_COLLECTIONS_PREFIX in `frontend/src/lib/pb.ts`. All three must agree, or
 * the app will address collections that do not exist.
 *
 * With a prefix set (the default, and the only safe mode on a shared
 * instance) wa-otp gets its OWN auth collection, `{prefix}users`, and the
 * stock `users` collection — which belongs to whatever other project lives on
 * this instance — is NEVER read or modified. With the prefix explicitly set to
 * empty (dedicated instance), `plan`/`status` are added to the stock `users`
 * collection instead, matching `scripts/provision_pb.py`.
 *
 * Index NAMES embed the physical collection name on purpose: SQLite index
 * names are unique across the whole database file, so an unprefixed
 * `idx_api_keys_hash` would collide with another project's identically-named
 * index and fail to apply.
 *
 * All collections are admin-only (list/view/create/update/delete rules = null):
 * FastAPI holds the superuser token; end users never touch PocketBase records
 * directly. The dashboard reads via FastAPI's /v1/keys and /v1/usage.
 *
 * Gotcha (PocketBase v0.40): collections created inside migrations must declare
 * `created`/`updated` as explicit autodate fields, or indexes referencing them
 * fail to apply.
 */
migrate((app) => {
  const PREFIX = ($os.getenv("WAOTP_PB_COLLECTIONS_PREFIX") || "waotp_").trim()
  const physical = (logical) => PREFIX + logical

  const CREATED = { name: "created", type: "autodate", onCreate: true }
  const UPDATED = { name: "updated", type: "autodate", onCreate: true, onUpdate: true }

  // ---- developer auth collection -------------------------------------------
  // Prefixed: wa-otp's own login pool, separate from every other app's users.
  // Unprefixed (dedicated instance only): extend the stock `users` collection.
  let users
  if (PREFIX) {
    try {
      users = app.findCollectionByNameOrId(physical("users"))
    } catch (e) {
      users = new Collection({
        name: physical("users"),
        type: "auth",
        listRule: "id = @request.auth.id",
        viewRule: "id = @request.auth.id",
        // public developer signup; set to null for invite-only operation
        createRule: "",
        updateRule: "id = @request.auth.id",
        deleteRule: null,
        passwordAuth: { enabled: true, identityFields: ["email"] },
        authRule: "",
        manageRule: null,
        fields: [
          {
            name: "plan",
            type: "select",
            values: ["free", "paid"],
            maxSelect: 1,
          },
          {
            name: "status",
            type: "select",
            values: ["active", "suspended"],
            maxSelect: 1,
          },
        ],
        indexes: [
          `CREATE UNIQUE INDEX idx_${physical("users")}_tokenKey ON \`${physical("users")}\` (\`tokenKey\`)`,
          `CREATE UNIQUE INDEX idx_${physical("users")}_email ON \`${physical("users")}\` (\`email\`) WHERE \`email\` != ''`,
        ],
      })
      app.save(users)
    }
  } else {
    users = app.findCollectionByNameOrId("users")
    if (!users.fields.getByName("plan")) {
      users.fields.add(new Field({
        name: "plan",
        type: "select",
        values: ["free", "paid"],
        maxSelect: 1,
      }))
    }
    if (!users.fields.getByName("status")) {
      users.fields.add(new Field({
        name: "status",
        type: "select",
        values: ["active", "suspended"],
        maxSelect: 1,
      }))
    }
    app.save(users)
  }
  const usersId = users.id

  // ---- api_keys ------------------------------------------------------------
  const apiKeys = new Collection({
    name: physical("api_keys"),
    type: "base",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      CREATED,
      UPDATED,
      { name: "owner", type: "relation", collectionId: usersId, cascadeDelete: true, maxSelect: 1, required: true },
      { name: "key_hash", type: "text", required: true, min: 64, max: 64 },
      { name: "last4", type: "text", max: 4 },
      { name: "label", type: "text", max: 50 },
      { name: "active", type: "bool" },
    ],
    indexes: [
      `CREATE UNIQUE INDEX idx_${physical("api_keys")}_hash ON \`${physical("api_keys")}\` (\`key_hash\`)`,
    ],
  })
  app.save(apiKeys)
  const apiKeysId = apiKeys.id

  // ---- otp_codes -----------------------------------------------------------
  app.save(new Collection({
    name: physical("otp_codes"),
    type: "base",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      CREATED,
      UPDATED,
      { name: "owner", type: "relation", collectionId: usersId, cascadeDelete: true, maxSelect: 1, required: true },
      { name: "api_key", type: "relation", collectionId: apiKeysId, cascadeDelete: true, maxSelect: 1 },
      { name: "phone", type: "text", required: true, max: 15 },
      { name: "code_hash", type: "text", required: true, min: 64, max: 64 },
      { name: "expires", type: "date", required: true },
      { name: "attempts", type: "number", onlyInt: true },
    ],
    indexes: [
      `CREATE INDEX idx_${physical("otp_codes")}_lookup ON \`${physical("otp_codes")}\` (\`owner\`, \`phone\`, \`created\`)`,
    ],
  }))

  // ---- messages (append-only audit; quota source) ---------------------------
  app.save(new Collection({
    name: physical("messages"),
    type: "base",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      CREATED,
      UPDATED,
      { name: "owner", type: "relation", collectionId: usersId, cascadeDelete: true, maxSelect: 1, required: true },
      { name: "api_key", type: "relation", collectionId: apiKeysId, cascadeDelete: true, maxSelect: 1 },
      { name: "phone", type: "text", required: true, max: 15 },
      // provider message id: WhatsApp "wamid..." or Telegram message id
      { name: "wa_message_id", type: "text", max: 128 },
      { name: "channel", type: "select", values: ["whatsapp", "telegram"], maxSelect: 1 },
      { name: "status", type: "select", values: ["sent", "failed"], maxSelect: 1 },
      { name: "cost_type", type: "select", values: ["free", "paid"], maxSelect: 1 },
      { name: "error", type: "text", max: 500 },
    ],
    indexes: [
      `CREATE INDEX idx_${physical("messages")}_owner_created ON \`${physical("messages")}\` (\`owner\`, \`created\`)`,
    ],
  }))

  // ---- wallet_txns (append-only ledger; Phase 2) ----------------------------
  app.save(new Collection({
    name: physical("wallet_txns"),
    type: "base",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      CREATED,
      UPDATED,
      { name: "owner", type: "relation", collectionId: usersId, cascadeDelete: true, maxSelect: 1, required: true },
      { name: "txn_type", type: "select", values: ["topup", "free", "spend", "refund"], maxSelect: 1 },
      { name: "amount", type: "number" },
      { name: "balance_after", type: "number" },
      { name: "note", type: "text", max: 200 },
    ],
    indexes: [
      `CREATE INDEX idx_${physical("wallet_txns")}_owner ON \`${physical("wallet_txns")}\` (\`owner\`, \`created\`)`,
    ],
  }))

  // ---- rate_cards (Phase 2: weekly cron refresh) -----------------------------
  app.save(new Collection({
    name: physical("rate_cards"),
    type: "base",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      CREATED,
      UPDATED,
      { name: "country_iso", type: "text", required: true, max: 2 },
      { name: "country_name", type: "text", max: 100 },
      { name: "meta_rate_usd", type: "number" },
      { name: "our_rate_inr", type: "number" },
    ],
    indexes: [
      `CREATE UNIQUE INDEX idx_${physical("rate_cards")}_iso ON \`${physical("rate_cards")}\` (\`country_iso\`)`,
    ],
  }))

  // ---- tg_links (platform-wide phone -> Telegram mapping) -------------------
  app.save(new Collection({
    name: physical("tg_links"),
    type: "base",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      CREATED,
      UPDATED,
      { name: "phone", type: "text", required: true, max: 15 },
      { name: "chat_id", type: "text", required: true, max: 32 },
      { name: "tg_user_id", type: "text", max: 32 },
      { name: "linked_at", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      `CREATE UNIQUE INDEX idx_${physical("tg_links")}_phone ON \`${physical("tg_links")}\` (\`phone\`)`,
    ],
  }))

  // ---- settings (single operator-edited row) ---------------------------------
  const settings = new Collection({
    name: physical("settings"),
    type: "base",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      CREATED,
      UPDATED,
      { name: "meta_phone_number_id", type: "text", max: 64 },
      // Fernet-encrypted at rest; even a PB dump should not leak the Meta token.
      { name: "meta_token_enc", type: "text", max: 500 },
      { name: "meta_template", type: "text", max: 64 },
      { name: "meta_template_lang", type: "text", max: 16 },
      { name: "tg_bot_token", type: "text", max: 128 },
      { name: "tg_bot_username", type: "text", max: 64 },
      { name: "free_monthly_limit", type: "number", onlyInt: true },
      { name: "per_phone_hourly", type: "number", onlyInt: true },
      { name: "code_ttl_seconds", type: "number", onlyInt: true },
      { name: "max_attempts", type: "number", onlyInt: true },
      { name: "ratelimit_per_min", type: "number", onlyInt: true },
    ],
  })
  app.save(settings)

  // seed the single settings row with PRD §7 defaults
  const seed = new Record(settings)
  seed.set("meta_phone_number_id", "")
  seed.set("meta_token_enc", "")
  seed.set("meta_template", "verification_code")
  seed.set("meta_template_lang", "en_US")
  seed.set("tg_bot_token", "")
  seed.set("tg_bot_username", "")
  seed.set("free_monthly_limit", 500)
  seed.set("per_phone_hourly", 5)
  seed.set("code_ttl_seconds", 300)
  seed.set("max_attempts", 3)
  seed.set("ratelimit_per_min", 10)
  app.save(seed)
}, (app) => {
  const PREFIX = ($os.getenv("WAOTP_PB_COLLECTIONS_PREFIX") || "waotp_").trim()
  const physical = (logical) => PREFIX + logical

  // down: drop wa-otp's own collections, prefixed like the up-migration
  for (const logical of ["settings", "tg_links", "rate_cards", "wallet_txns",
                         "messages", "otp_codes", "api_keys"]) {
    try {
      app.delete(app.findCollectionByNameOrId(physical(logical)))
    } catch (e) {
      // already gone
    }
  }

  if (PREFIX) {
    // wa-otp's own auth collection goes with them
    try {
      app.delete(app.findCollectionByNameOrId(physical("users")))
    } catch (e) {
      // already gone
    }
  } else {
    // dedicated instance: only undo what we added to the stock `users`
    try {
      const users = app.findCollectionByNameOrId("users")
      users.fields.removeByName("plan")
      users.fields.removeByName("status")
      app.save(users)
    } catch (e) {
      // fields already gone
    }
  }
})
