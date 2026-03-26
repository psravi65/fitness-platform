// ─── Named constants (replace magic numbers) ────────────────────────────────
const LOGIN_RATE_LIMIT_MAX       = 10;    // max login attempts before lockout
const LOGIN_RATE_LIMIT_WINDOW_S  = 60;    // sliding window in seconds
const PLAN_GEN_RATE_LIMIT_MAX    = 20;    // max plan generations per client per hour
const PLAN_GEN_RATE_LIMIT_WINDOW_S = 3600;
const PLAN_GEN_LOCK_TTL_S        = 300;   // in-flight lock TTL (5 min)
const DEFAULT_CLEAN_MAX_LENGTH   = 200;   // default max chars for clean()
const GEMINI_TIMEOUT_MS          = 120000; // Gemini timeout — thinking model can take 60-90s
// ────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    if (env.APP_URL === "https://your-cloudflare-domain.workers.dev") {
      console.warn("[config] APP_URL is still the default placeholder. Email links will be broken. Update it in wrangler.toml.");
    }
    if (!env.GEMINI_API_KEY) {
      console.warn("[config] GEMINI_API_KEY is not set. Plans will use the deterministic fallback generator.");
    }
    if (!env.RESEND_API_KEY) {
      console.warn("[config] RESEND_API_KEY is not set. Welcome emails will only be logged to console.");
    }

    // Async cleanup: purge expired rate_limit rows without blocking the request
    ctx.waitUntil(
      env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < datetime('now', '-1 hour')`).run().catch(() => {})
    );

    try {
      const url = new URL(request.url);
      if (url.pathname === "/sw.js") {
        return new Response(
          `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
  e.respondWith(fetch(e.request));
});`,
          { headers: { "Content-Type": "application/javascript", "Cache-Control": "no-cache" } }
        );
      }

      if (url.pathname === "/manifest.json") {
        return new Response(JSON.stringify({
          name: "GymLog · Fitness Platform",
          short_name: "GymLog",
          description: "AI-powered fitness tracking and coaching platform",
          start_url: "/",
          display: "standalone",
          background_color: "#0b0b0b",
          theme_color: "#6bff8f",
          orientation: "portrait",
          icons: [
            { src: "/icon-512.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
          ]
        }), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" } });
      }

      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, ctx, url);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: error.message || "Unexpected error" }, error.status || 500);
    }
  }
};

async function handleApi(request, env, ctx, url) {
  const method = request.method.toUpperCase();

  // CSRF protection: all state-mutating requests must include this header.
  // Browsers never send X-Requested-With on cross-origin requests, so its
  // presence proves the request was initiated by our SPA, not a third-party site.
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    if (request.headers.get("X-Requested-With") !== "XMLHttpRequest") {
      return json({ error: "Forbidden: missing CSRF header." }, 403);
    }
  }

  const session = await getSession(request, env);

  if (
    session?.user?.role === "client" &&
    session.user.must_change_password &&
    ![
      "/api/me",
      "/api/auth/logout",
      "/api/auth/change-password"
    ].includes(url.pathname)
  ) {
    throw new HttpError("Password change required before accessing the app.", 403);
  }

  if (url.pathname === "/api/me" && method === "GET") {
    if (!session) return json({ user: null });
    return json({ user: sanitizeUser(session.user) });
  }

  if (url.pathname === "/api/bootstrap-admin-check" && method === "GET") {
    const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM users WHERE role IN ('admin','superadmin')`).first();
    return json({ needsAdminBootstrap: Number(count?.count || 0) === 0 });
  }

  if (url.pathname === "/api/bootstrap-admin" && method === "POST") {
    const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM users WHERE role IN ('admin','superadmin')`).first();
    if (Number(count?.count || 0) > 0) {
      return json({ error: "Admin already exists." }, 409);
    }
    const body = await readJson(request);
    const username = clean(body.username, 50);
    const password = String(body.password || "");
    const isSuperAdmin = body.superadmin === true;
    if (!username || password.length < 8) {
      return json({ error: "Username and password of at least 8 characters are required." }, 400);
    }
    await env.DB.prepare(`
      INSERT INTO users (id, username, password_hash, role, must_change_password)
      VALUES (?, ?, ?, ?, 0)
    `).bind(crypto.randomUUID(), username, await hashPassword(password), isSuperAdmin ? "superadmin" : "admin").run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/auth/login" && method === "POST") {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const limited = await checkRateLimit(env, `login:${ip}`, LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_S);
    if (limited) return json({ error: "Too many login attempts. Please wait a minute and try again." }, 429);

    const body = await readJson(request);
    const username = clean(body.username, 50);
    const password = String(body.password || "");
    if (!username || !password) return json({ error: "Username and password are required." }, 400);

    const user = await env.DB.prepare(`
      SELECT users.*, clients.full_name
      FROM users
      LEFT JOIN clients ON clients.id = users.client_id
      WHERE users.username = ?
      LIMIT 1
    `).bind(username).first();
    if (!user) return json({ error: "Invalid credentials." }, 401);

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return json({ error: "Invalid credentials." }, 401);

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    await env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
      .bind(sessionId, user.id, expiresAt)
      .run();

    return withCookie(json({ user: sanitizeUser(user) }), buildSessionCookie(sessionId, env, expiresAt));
  }

  if (url.pathname === "/api/auth/logout" && method === "POST") {
    const sessionId = getCookie(request, "fitness_session");
    if (sessionId) {
      await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
    }
    return withCookie(json({ ok: true }), clearSessionCookie(env));
  }

 if (url.pathname === "/api/auth/change-password" && method === "POST") {
    assertAuthenticated(session);
    const body = await readJson(request);
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (newPassword.length < 8) return json({ error: "New password must be at least 8 characters." }, 400);
    const row = await env.DB.prepare(`SELECT password_hash, must_change_password FROM users WHERE id = ?`).bind(session.user.id).first();
    // First-time login: skip current password check — they only have a temp password
    if (!row.must_change_password) {
      const valid = await verifyPassword(currentPassword, row.password_hash);
      if (!valid) return json({ error: "Current password is incorrect." }, 401);
    }
    const nextHash = await hashPassword(newPassword);
    await env.DB.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`)
      .bind(nextHash, session.user.id)
      .run();
    return json({ ok: true });
  }


  // ═══════════════════════════════════════════════════════════
  //  SUPERADMIN ROUTES — app owner only
  // ═══════════════════════════════════════════════════════════

  if (url.pathname === "/api/superadmin/gyms" && method === "GET") {
    assertRole(session, "superadmin");
    const gyms = await env.DB.prepare(`
      SELECT gyms.*,
        COUNT(DISTINCT clients.id) AS client_count,
        COUNT(DISTINCT CASE WHEN plans.status = 'published' THEN plans.id END) AS active_plans,
        MAX(daily_logs.updated_at) AS last_activity
      FROM gyms
      LEFT JOIN clients ON clients.gym_id = gyms.id
      LEFT JOIN plans ON plans.client_id = clients.id
      LEFT JOIN daily_logs ON daily_logs.client_id = clients.id
      GROUP BY gyms.id
      ORDER BY gyms.created_at DESC
    `).all();
    const totalClients = await env.DB.prepare(`SELECT COUNT(*) AS count FROM clients WHERE deleted_at IS NULL`).first();
    const totalPlans = await env.DB.prepare(`SELECT COUNT(*) AS count FROM plans WHERE status = 'published'`).first();
    return json({
      gyms: gyms.results || [],
      stats: {
        totalGyms: (gyms.results || []).length,
        totalClients: Number(totalClients?.count || 0),
        totalActivePlans: Number(totalPlans?.count || 0)
      }
    });
  }

  if (url.pathname === "/api/superadmin/gyms" && method === "POST") {
    assertRole(session, "superadmin");
    const body = await readJson(request);
    const gymName = clean(body.gymName, 100);
    const ownerName = clean(body.ownerName, 100);
    const email = clean(body.email, 254);
    const phone = clean(body.phone || "", 30);
    const city = clean(body.city || "", 100);
    const adminUsername = clean(body.adminUsername, 50);
    if (!gymName || !ownerName || !adminUsername) {
      return json({ error: "Gym name, owner name and admin username are required." }, 400);
    }
    const existing = await env.DB.prepare(`SELECT id FROM users WHERE username = ?`).bind(adminUsername).first();
    if (existing) return json({ error: "Username already taken." }, 409);

    const gymId = crypto.randomUUID();
    const adminId = crypto.randomUUID();
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO gyms (id, name, owner_name, email, phone, city, status) VALUES (?, ?, ?, ?, ?, ?, 'active')`).bind(gymId, gymName, ownerName, email, phone, city),
      env.DB.prepare(`INSERT INTO users (id, username, password_hash, role, gym_id, must_change_password) VALUES (?, ?, ?, 'admin', ?, 1)`).bind(adminId, adminUsername, hash, gymId),
    ]);
    return json({ ok: true, gymId, temporaryPassword: tempPassword });
  }

  const superadminGymMatch = url.pathname.match(/^\/api\/superadmin\/gyms\/([^/]+)$/);
  if (superadminGymMatch && method === "GET") {
    assertRole(session, "superadmin");
    const gymId = superadminGymMatch[1];
    const gym = await env.DB.prepare(`SELECT * FROM gyms WHERE id = ?`).bind(gymId).first();
    if (!gym) return json({ error: "Gym not found." }, 404);
    const clients = await env.DB.prepare(`
      SELECT clients.id, clients.full_name, clients.status, users.username,
        COALESCE((SELECT status FROM plans WHERE client_id = clients.id ORDER BY updated_at DESC LIMIT 1), 'none') AS plan_status,
        (SELECT log_date FROM daily_logs WHERE client_id = clients.id ORDER BY log_date DESC LIMIT 1) AS last_log_date
      FROM clients LEFT JOIN users ON users.client_id = clients.id
      WHERE clients.deleted_at IS NULL AND clients.gym_id = ? ORDER BY clients.created_at DESC
    `).bind(gymId).all();
    const admin = await env.DB.prepare(`SELECT id, username FROM users WHERE gym_id = ? AND role = 'admin' LIMIT 1`).bind(gymId).first();
    const unassignedRow = await env.DB.prepare(`SELECT COUNT(*) AS count FROM clients WHERE gym_id IS NULL AND deleted_at IS NULL`).first();
    return json({ gym, clients: clients.results || [], admin, unassignedCount: Number(unassignedRow?.count || 0) });
  }

  const superadminResetPwdMatch = url.pathname.match(/^\/api\/superadmin\/gyms\/([^/]+)\/reset-admin-password$/);
  if (superadminResetPwdMatch && method === "POST") {
    assertRole(session, "superadmin");
    const gId = superadminResetPwdMatch[1];
    const adminUser = await env.DB.prepare(`SELECT id FROM users WHERE gym_id = ? AND role = 'admin' LIMIT 1`).bind(gId).first();
    if (!adminUser) return json({ error: "No admin found for this gym." }, 404);
    const tempPwd = generateTempPassword();
    await env.DB.prepare(`UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?`).bind(await hashPassword(tempPwd), adminUser.id).run();
    return json({ ok: true, temporaryPassword: tempPwd });
  }

  const superadminClaimMatch = url.pathname.match(/^\/api\/superadmin\/gyms\/([^/]+)\/claim-unassigned$/);
  if (superadminClaimMatch && method === "POST") {
    assertRole(session, "superadmin");
    const gId = superadminClaimMatch[1];
    const unassigned = await env.DB.prepare(`SELECT COUNT(*) AS count FROM clients WHERE gym_id IS NULL AND deleted_at IS NULL`).first();
    const count = Number(unassigned?.count || 0);
    if (count === 0) return json({ ok: true, claimed: 0 });
    await env.DB.batch([
      env.DB.prepare(`UPDATE clients SET gym_id = ? WHERE gym_id IS NULL`).bind(gId),
      env.DB.prepare(`UPDATE users SET gym_id = ? WHERE gym_id IS NULL AND role = 'client'`).bind(gId),
    ]);
    return json({ ok: true, claimed: count });
  }

  if (superadminGymMatch && method === "PATCH") {
    assertRole(session, "superadmin");
    const body = await readJson(request);
    const gymId = superadminGymMatch[1];
    if (body.status) {
      await env.DB.prepare(`UPDATE gyms SET status = ? WHERE id = ?`).bind(body.status, gymId).run();
    }
    return json({ ok: true });
  }

  if (url.pathname === "/api/superadmin/me" && method === "GET") {
    assertRole(session, "superadmin");
    const stats = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM gyms WHERE status = 'active') AS active_gyms,
        (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL) AS total_clients,
        (SELECT COUNT(*) FROM plans WHERE status = 'published') AS active_plans,
        (SELECT COUNT(*) FROM daily_logs WHERE date(updated_at) = date('now')) AS logs_today
    `).first();
    return json({ stats });
  }

  if (url.pathname === "/api/admin/clients/all-for-household" && method === "GET") {
    assertRole(session, "admin");
    const gymId = getGymId(session);
    const rows = gymId
      ? await env.DB.prepare(`SELECT clients.id, clients.full_name, clients.household_id, users.username FROM clients LEFT JOIN users ON users.client_id = clients.id WHERE clients.deleted_at IS NULL AND clients.gym_id = ? ORDER BY clients.full_name ASC`).bind(gymId).all()
      : await env.DB.prepare(`SELECT clients.id, clients.full_name, clients.household_id, users.username FROM clients LEFT JOIN users ON users.client_id = clients.id WHERE clients.deleted_at IS NULL ORDER BY clients.full_name ASC`).all();
    return json({ clients: rows.results || [] });
  }

  if (url.pathname === "/api/admin/clients" && method === "GET") {
    assertRole(session, "admin");
    // For superadmin acting as gym admin, accept gym_scope query param
    const gymId = (session.user.role === "superadmin")
      ? (url.searchParams.get("gym_scope") || null)
      : getGymId(session);
    const rows = await env.DB.prepare(`
      SELECT clients.id, clients.full_name, clients.status, users.username,
        COALESCE((SELECT status FROM plans WHERE client_id = clients.id ORDER BY updated_at DESC LIMIT 1), 'none') AS plan_status,
        (SELECT log_date FROM daily_logs WHERE client_id = clients.id ORDER BY log_date DESC LIMIT 1) AS last_log_date,
        (SELECT updated_at FROM checkins WHERE client_id = clients.id ORDER BY updated_at DESC LIMIT 1) AS last_checkin_at,
        (SELECT updated_at FROM weekly_reviews WHERE client_id = clients.id ORDER BY updated_at DESC LIMIT 1) AS last_weekly_review_at,
        (SELECT notes FROM daily_logs WHERE client_id = clients.id AND TRIM(COALESCE(notes, '')) <> '' ORDER BY updated_at DESC LIMIT 1) AS latest_daily_note,
        (SELECT notes FROM checkins WHERE client_id = clients.id AND TRIM(COALESCE(notes, '')) <> '' ORDER BY updated_at DESC LIMIT 1) AS latest_checkin_note
      FROM clients
      LEFT JOIN users ON users.client_id = clients.id
      WHERE clients.deleted_at IS NULL ${gymId ? "AND clients.gym_id = ?" : ""}
      ORDER BY clients.created_at DESC
    `).bind(...(gymId ? [gymId] : [])).all();
    const clients = (rows.results || []).map((client) => ({
      ...client,
      reviewFlags: buildReviewFlags(client)
    }));
    return json({ clients });
  }

  if (url.pathname === "/api/admin/clients" && method === "POST") {
    assertRole(session, "admin");
    const body = await readJson(request);
    const fullName = clean(body.fullName, 100);
    const username = clean(body.username, 50);
    const email = clean(body.email || "", 254);
    if (!fullName || !username) return json({ error: "Full name and username are required." }, 400);

    const existing = await env.DB.prepare(`SELECT id FROM users WHERE username = ?`).bind(username).first();
    if (existing) return json({ error: "Username already exists." }, 409);

    const clientId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);

    const clientGymId = getGymId(session);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO clients (id, full_name, status, gym_id) VALUES (?, ?, 'active', ?)`).bind(clientId, fullName, clientGymId),
      env.DB.prepare(`INSERT INTO users (id, username, password_hash, role, client_id, gym_id, must_change_password) VALUES (?, ?, ?, 'client', ?, ?, 1)`).bind(userId, username, hash, clientId, clientGymId)
    ]);

    if (email) {
      await sendWelcomeEmail(env, email, fullName, username, tempPassword);
    }

    return json({ ok: true, clientId, temporaryPassword: tempPassword });
  }

  const adminClientMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)$/);
  if (adminClientMatch && method === "GET") {
    assertRole(session, "admin");
    await assertClientBelongsToGym(env, session, adminClientMatch[1]);
    return json(await getAdminClientDetail(env, adminClientMatch[1]));
  }

  if (adminClientMatch && method === "DELETE") {
    assertRole(session, "admin");
    await assertClientBelongsToGym(env, session, adminClientMatch[1]);
    await env.DB.prepare(`UPDATE clients SET deleted_at = datetime('now') WHERE id = ?`).bind(adminClientMatch[1]).run();
    await writeAuditLog(env, session, "client.delete", adminClientMatch[1]);
    return json({ ok: true });
  }

  const resetPasswordMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/reset-password$/);
  if (resetPasswordMatch && method === "POST") {
    assertRole(session, "admin");
    await assertClientBelongsToGym(env, session, resetPasswordMatch[1]);
    const user = await env.DB.prepare(`SELECT id FROM users WHERE client_id = ? AND role = 'client'`).bind(resetPasswordMatch[1]).first();
    if (!user) return json({ error: "Client user not found." }, 404);
    const tempPassword = generateTempPassword();
    await env.DB.prepare(`UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?`)
      .bind(await hashPassword(tempPassword), user.id)
      .run();
    await writeAuditLog(env, session, "client.reset_password", resetPasswordMatch[1]);
    return json({ ok: true, temporaryPassword: tempPassword });
  }

  const clientIntakeMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/intake$/);
  if (clientIntakeMatch && method === "POST") {
    assertRole(session, "admin");
    await assertClientBelongsToGym(env, session, clientIntakeMatch[1]);
    const body = await readJson(request);
    await upsertIntake(env, clientIntakeMatch[1], body.answers || {}, body.complete);
    return json({ ok: true });
  }

  const householdMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/household$/);
  if (householdMatch && method === "POST") {
    assertRole(session, "admin");
    const body = await readJson(request);
    const clientId = householdMatch[1];
    await assertClientBelongsToGym(env, session, clientId);
    if (body.householdId) {
      const householdId = body.householdId === "new" ? crypto.randomUUID() : body.householdId;
      await env.DB.prepare(`UPDATE clients SET household_id = ? WHERE id = ?`).bind(householdId, clientId).run();
      // If baseMealsOn is set, store it — this client's plan will be used as meal reference
      if (body.baseMealsOn) {
        await assertClientBelongsToGym(env, session, body.baseMealsOn);
        // Prevent silently moving a client out of a different household
        const baseMealsOnClient = await env.DB.prepare(`SELECT household_id FROM clients WHERE id = ?`).bind(body.baseMealsOn).first();
        const existingHousehold = baseMealsOnClient?.household_id?.replace(":base", "") || null;
        if (existingHousehold && existingHousehold !== householdId) {
          return json({ error: "baseMealsOn client already belongs to a different household." }, 409);
        }
        await env.DB.prepare(`UPDATE clients SET household_id = ? || ':base' WHERE id = ?`).bind(householdId, body.baseMealsOn).run();
      }
    } else {
      await env.DB.prepare(`UPDATE clients SET household_id = NULL WHERE id = ?`).bind(clientId).run();
    }
    return json({ ok: true });
  }

  const intakeEditMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/intake-edit$/);
  if (intakeEditMatch && method === "POST") {
    assertRole(session, "admin");
    await assertClientBelongsToGym(env, session, intakeEditMatch[1]);
    const body = await readJson(request);
    await env.DB.prepare(`UPDATE clients SET status = ? WHERE id = ?`)
      .bind(body.editable ? "intake_open" : "active", intakeEditMatch[1])
      .run();
    return json({ ok: true });
  }

  const generatePlanMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/generate-plan$/);
  if (generatePlanMatch && method === "POST") {
    assertRole(session, "admin");
    const clientId = generatePlanMatch[1];
    await assertClientBelongsToGym(env, session, clientId);
    // Check limit without incrementing — only count SUCCESSFUL generations (see incrementRateLimit call after saveDraftPlan)
    const planGenLimited = await isRateLimited(env, `generate-plan:${clientId}`, PLAN_GEN_RATE_LIMIT_MAX, PLAN_GEN_RATE_LIMIT_WINDOW_S);
    if (planGenLimited) return json({ error: "Plan generation limit reached for this client (20/hour). Please wait before generating again." }, 429);

    // Concurrency guard: prevent two simultaneous generations for the same client
    const lockKey = `plan-in-flight:${clientId}`;
    const lockTtl = PLAN_GEN_LOCK_TTL_S;
    const lockRecord = await env.DB.prepare(`SELECT attempts, window_start FROM rate_limits WHERE key = ?`).bind(lockKey).first();
    const lockActive = lockRecord && (Date.now() - new Date(lockRecord.window_start).getTime() < lockTtl * 1000);
    if (lockActive) return json({ error: "Plan generation is already in progress for this client." }, 409);
    await env.DB.prepare(`INSERT OR REPLACE INTO rate_limits (key, attempts, window_start) VALUES (?, 1, ?)`).bind(lockKey, new Date().toISOString()).run();

    let normalized;
    try {
    const intake = await getLatestIntake(env, clientId);
    if (!intake) return json({ error: "Client intake is required before generating a plan." }, 400);
    const progressContext = await getProgressContext(env, clientId);
    const householdContext = await getHouseholdContext(env, clientId);
    normalized = await generatePlanFromIntake(env, intake.answers_json, progressContext, householdContext);
    await saveDraftPlan(env, clientId, intake.id, normalized, null);
    await writeAuditLog(env, session, "plan.generate", clientId, { intakeId: intake.id, householdAware: !!householdContext });
    await incrementRateLimit(env, `generate-plan:${clientId}`, PLAN_GEN_RATE_LIMIT_WINDOW_S);
    } finally {
      await env.DB.prepare(`DELETE FROM rate_limits WHERE key = ?`).bind(lockKey).run().catch(() => {});
    }
    return json({ ok: true });
  }

  const runAgentReviewMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/run-agent-review$/);
  if (runAgentReviewMatch && method === "POST") {
    assertRole(session, "admin");
    const clientId = runAgentReviewMatch[1];
    await assertClientBelongsToGym(env, session, clientId);

    const body = await readJson(request);
    const agentKey = body.agent;
    if (!['nutritionist', 'fitnessExpert', 'sportsScientist'].includes(agentKey))
      return json({ error: "agent must be one of: nutritionist, fitnessExpert, sportsScientist" }, 400);

    const plan = await getLatestPlan(env, clientId);
    if (!plan) return json({ error: "No plan found. Generate a plan first." }, 404);
    const intake = await getLatestIntake(env, clientId);
    if (!intake) return json({ error: "Client intake is required." }, 400);
    const progressContext = await getProgressContext(env, clientId);
    const householdContext = await getHouseholdContext(env, clientId);

    let agentResult;
    if (agentKey === 'nutritionist')
      agentResult = await runNutritionistAgent(env, intake.answers_json, plan.effectivePlan, householdContext, progressContext);
    else if (agentKey === 'fitnessExpert')
      agentResult = await runFitnessExpertAgent(env, intake.answers_json, plan.effectivePlan, null, progressContext);
    else
      agentResult = await runSportsScientistAgent(env, intake.answers_json, plan.effectivePlan, null, progressContext);

    // Don't persist a rate-limit failure — return the error directly so the flash shows it
    if (agentResult.rateLimited) return json({ error: agentResult.reason }, 429);

    // Merge into existing reviews, preserving other agents' results
    const merged = { ...(plan.agent_reviews_json || {}), [agentKey]: agentResult, pipelineRunAt: nowIso() };
    const all = ['nutritionist', 'fitnessExpert', 'sportsScientist'].map(k => merged[k]).filter(Boolean);
    merged.overallStatus = all.some(a => a.status === 'flagged') ? 'flagged'
      : all.some(a => a.status === 'needs_attention') ? 'needs_attention'
      : all.every(a => a.status === 'approved') ? 'approved' : 'partial';

    await env.DB.prepare(
      `UPDATE plans SET agent_reviews_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(JSON.stringify(merged), plan.id).run();
    await writeAuditLog(env, session, "plan.agent_review", clientId, { agent: agentKey, status: agentResult.status });
    return json({ ok: true, review: agentResult, overallStatus: merged.overallStatus });
  }

  const refinePlanRouteMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/refine-plan$/);
  if (refinePlanRouteMatch && method === "POST") {
    assertRole(session, "admin");
    const clientId = refinePlanRouteMatch[1];
    await assertClientBelongsToGym(env, session, clientId);

    const lockKey = `plan-in-flight:${clientId}`;
    const lockRecord = await env.DB.prepare(`SELECT attempts, window_start FROM rate_limits WHERE key = ?`).bind(lockKey).first();
    const lockActive = lockRecord && (Date.now() - new Date(lockRecord.window_start).getTime() < PLAN_GEN_LOCK_TTL_S * 1000);
    if (lockActive) return json({ error: "A plan operation is already in progress for this client." }, 409);
    await env.DB.prepare(`INSERT OR REPLACE INTO rate_limits (key, attempts, window_start) VALUES (?, 1, ?)`).bind(lockKey, new Date().toISOString()).run();

    try {
      const plan = await getLatestPlan(env, clientId);
      if (!plan) return json({ error: "No plan found." }, 404);
      const agentReviews = plan.agent_reviews_json;
      if (!agentReviews || !['nutritionist', 'fitnessExpert', 'sportsScientist'].some(k => agentReviews[k]))
        return json({ error: "Run at least one agent review before refining." }, 400);

      const intake = await getLatestIntake(env, clientId);
      if (!intake) return json({ error: "Client intake is required." }, 400);
      const progressContext = await getProgressContext(env, clientId);
      const householdContext = await getHouseholdContext(env, clientId);

      const refined = await refinePlanWithAgentFeedback(
        env, intake.answers_json, plan.effectivePlan, agentReviews, progressContext, householdContext
      );
      // Save refined plan; clear reviews so coach re-runs agents on the new plan
      await env.DB.prepare(`
        UPDATE plans SET generated_json = ?, edited_json = NULL, agent_reviews_json = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(JSON.stringify(refined), plan.id).run();
      await writeAuditLog(env, session, "plan.refine", clientId, { planId: plan.id });
    } finally {
      await env.DB.prepare(`DELETE FROM rate_limits WHERE key = ?`).bind(lockKey).run().catch(() => {});
    }
    return json({ ok: true });
  }

  const savePlanMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/plan$/);
  if (savePlanMatch && method === "PATCH") {
    assertRole(session, "admin");
    const clientId = savePlanMatch[1];
    await assertClientBelongsToGym(env, session, clientId);
    const body = await readJson(request);
    const editedPlan = body.editedPlan;
    if (!editedPlan || typeof editedPlan !== "object") return json({ error: "editedPlan is required." }, 400);
    await updatePlanEdits(env, clientId, editedPlan);
    return json({ ok: true });
  }

  const publishPlanMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/publish-plan$/);
  if (publishPlanMatch && method === "POST") {
    assertRole(session, "admin");
    await assertClientBelongsToGym(env, session, publishPlanMatch[1]);
    const body = await readJson(request);
    const publish = body.publish !== false;
    await setPlanPublished(env, publishPlanMatch[1], publish);
    await writeAuditLog(env, session, publish ? "plan.publish" : "plan.unpublish", publishPlanMatch[1]);
    return json({ ok: true, published: publish });
  }

  if (url.pathname === "/api/app/bootstrap" && method === "GET") {
    assertRole(session, "client");
    return json(await getClientBootstrap(env, session.user.client_id));
  }

  if (url.pathname === "/api/app/intake" && method === "GET") {
    assertRole(session, "client");
    const intake = await getLatestIntake(env, session.user.client_id);
    return json({ intake });
  }

  if (url.pathname === "/api/app/intake" && method === "POST") {
    assertRole(session, "client");
    const client = await env.DB.prepare(`SELECT * FROM clients WHERE id = ?`).bind(session.user.client_id).first();
    const existing = await getLatestIntake(env, session.user.client_id);
    const canEdit = client?.status === "intake_open" || !existing?.completed_at;
    if (!canEdit) return json({ error: "Intake is locked. Ask your coach to enable edits." }, 403);
    const body = await readJson(request);
    await upsertIntake(env, session.user.client_id, body.answers || {}, body.complete);
    if (body.complete) {
      await env.DB.prepare(`UPDATE clients SET status = 'active' WHERE id = ?`).bind(session.user.client_id).run();
    }
    return json({ ok: true });
  }

  if (url.pathname === "/api/app/plan" && method === "GET") {
    assertRole(session, "client");
    const plan = await getPublishedPlan(env, session.user.client_id);
    return json({ plan });
  }

  const dailyLogMatch = url.pathname.match(/^\/api\/app\/daily-log\/(\d{4}-\d{2}-\d{2})$/);
  if (dailyLogMatch && method === "PUT") {
    assertRole(session, "client");
    const body = await readJson(request);
    await upsertDailyLog(env, session.user.client_id, dailyLogMatch[1], body);
    return json({ ok: true });
  }

  if (url.pathname === "/api/app/checkins" && method === "POST") {
    assertRole(session, "client");
    const body = await readJson(request);
    await upsertCheckin(env, session.user.client_id, body);
    return json({ ok: true });
  }

  const weeklyReviewMatch = url.pathname.match(/^\/api\/app\/weekly-review\/([^/]+)$/);
  if (weeklyReviewMatch && method === "PUT") {
    assertRole(session, "client");
    const body = await readJson(request);
    await upsertWeeklyReview(env, session.user.client_id, weeklyReviewMatch[1], body);
    return json({ ok: true });
  }

  if (url.pathname === "/api/app/progress-history" && method === "GET") {
    assertRole(session, "client");
    const clientId = session.user.client_id;
    const [logsRes, checkinsRes] = await Promise.all([
      env.DB.prepare(
        `SELECT log_date, macros_json, steps, hydration FROM daily_logs WHERE client_id = ? ORDER BY log_date DESC LIMIT 30`
      ).bind(clientId).all(),
      env.DB.prepare(
        `SELECT checkin_date, weight, body_fat FROM checkins WHERE client_id = ? ORDER BY checkin_date DESC LIMIT 12`
      ).bind(clientId).all()
    ]);
    return json({
      logs: (logsRes.results || []).map(r => ({ ...r, macros_json: safeJson(r.macros_json, {}) })),
      checkins: checkinsRes.results || []
    });
  }

  if (url.pathname === "/api/admin/compliance" && method === "GET") {
    assertRole(session, "admin");
    const gymId = getGymId(session);
    const scope = gymId ? "AND clients.gym_id = ?" : "";
    const b = gymId ? [gymId] : [];
    const [total, loggedThisWeek, inactive14d, unpublished, noCheckin14d, needsReplanRows] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as n FROM clients WHERE deleted_at IS NULL ${scope}`).bind(...b).first(),
      env.DB.prepare(`SELECT COUNT(DISTINCT dl.client_id) as n FROM daily_logs dl JOIN clients ON clients.id = dl.client_id WHERE clients.deleted_at IS NULL AND dl.log_date >= date('now','-7 days') ${scope}`).bind(...b).first(),
      env.DB.prepare(`SELECT COUNT(*) as n FROM clients WHERE deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM daily_logs WHERE client_id = clients.id AND log_date >= date('now','-14 days')) ${scope}`).bind(...b).first(),
      env.DB.prepare(`SELECT COUNT(*) as n FROM clients WHERE deleted_at IS NULL AND EXISTS (SELECT 1 FROM plans WHERE client_id = clients.id AND status = 'draft') ${scope}`).bind(...b).first(),
      env.DB.prepare(`SELECT COUNT(*) as n FROM clients WHERE deleted_at IS NULL AND EXISTS (SELECT 1 FROM plans WHERE client_id = clients.id AND status = 'published') AND NOT EXISTS (SELECT 1 FROM checkins WHERE client_id = clients.id AND checkin_date >= date('now','-14 days')) ${scope}`).bind(...b).first(),
      env.DB.prepare(`
        SELECT clients.id, clients.full_name, users.username,
          (SELECT MAX(checkin_date) FROM checkins WHERE client_id = clients.id) as last_checkin_date
        FROM clients
        LEFT JOIN users ON users.client_id = clients.id AND users.role = 'client'
        WHERE clients.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM plans WHERE client_id = clients.id AND status = 'published')
        AND NOT EXISTS (SELECT 1 FROM checkins WHERE client_id = clients.id AND checkin_date >= date('now','-21 days'))
        ${scope}
        ORDER BY CASE WHEN (SELECT MAX(checkin_date) FROM checkins WHERE client_id = clients.id) IS NULL THEN 0 ELSE 1 END ASC,
                 last_checkin_date ASC
        LIMIT 20
      `).bind(...b).all()
    ]);
    return json({
      totalClients: Number(total?.n || 0),
      loggedThisWeek: Number(loggedThisWeek?.n || 0),
      inactive14d: Number(inactive14d?.n || 0),
      unpublished: Number(unpublished?.n || 0),
      noCheckin14d: Number(noCheckin14d?.n || 0),
      needsReplan: needsReplanRows.results || []
    });
  }

  if (url.pathname === "/api/nutrition/search" && method === "GET") {
    assertRole(session, "client");
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2) return json({ results: [], source: null });

    // Helper: extract a nutrient value by USDA nutrient ID
    const getNutrient = (nutrients, id) => {
      const n = (nutrients || []).find(n => n.nutrientId === id);
      return n ? Math.round((n.value || 0) * 10) / 10 : 0;
    };

    // ── Primary: USDA FoodData Central ──────────────────────────────────────
    if (env.USDA_API_KEY) {
      try {
        const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&api_key=${env.USDA_API_KEY}&pageSize=10&dataType=Foundation,SR%20Legacy,Branded`;
        const res = await fetchWithTimeout(usdaUrl, {}, 8000);
        if (res.ok) {
          const data = await res.json();
          const results = (data.foods || []).map(food => ({
            name: food.description,
            calories: getNutrient(food.foodNutrients, 1008),
            protein:  getNutrient(food.foodNutrients, 1003),
            carbs:    getNutrient(food.foodNutrients, 1005),
            fat:      getNutrient(food.foodNutrients, 1004),
            per: "100g"
          })).filter(r => r.calories > 0 || r.protein > 0).slice(0, 8);
          if (results.length > 0) return json({ results, source: "usda" });
        }
      } catch {
        // fall through to Open Food Facts
      }
    }

    // ── Fallback: Open Food Facts (no API key required) ─────────────────────
    try {
      const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=true&page_size=10&fields=product_name,nutriments`;
      const res = await fetchWithTimeout(offUrl, {}, 8000);
      if (res.ok) {
        const data = await res.json();
        const results = (data.products || [])
          .filter(p => p.product_name)
          .map(p => ({
            name:     p.product_name,
            calories: Math.round(p.nutriments?.["energy-kcal_100g"] || p.nutriments?.["energy-kcal"] || 0),
            protein:  Math.round((p.nutriments?.proteins_100g     || 0) * 10) / 10,
            carbs:    Math.round((p.nutriments?.carbohydrates_100g || 0) * 10) / 10,
            fat:      Math.round((p.nutriments?.fat_100g           || 0) * 10) / 10,
            per: "100g"
          }))
          .filter(r => r.calories > 0 || r.protein > 0)
          .slice(0, 8);
        return json({ results, source: "openfoodfacts" });
      }
    } catch {
      // both sources failed
    }

    return json({ results: [], source: null });
  }

  if (url.pathname === "/api/admin/exports/google-sheets" && method === "POST") {
    assertRole(session, "admin");
    const body = await readJson(request);
    if (body.clientId) await assertClientBelongsToGym(env, session, body.clientId);
    const result = await exportToGoogleSheets(env, body.clientId || null);
    return json({ ok: true, result });
  }

  return json({ error: "Not found" }, 404);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    client_id: user.client_id || null,
    full_name: user.full_name || null,
    gym_id: user.gym_id || null,
    mustChangePassword: !!user.must_change_password
  };
}

async function getSession(request, env) {
  const sessionId = getCookie(request, "fitness_session");
  if (!sessionId) return null;
  const row = await env.DB.prepare(`
    SELECT sessions.id AS session_id, users.*, clients.full_name
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    LEFT JOIN clients ON clients.id = users.client_id
    WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `).bind(sessionId).first();
  if (!row) return null;
  return { id: row.session_id, user: row };
}

function assertAuthenticated(session) {
  if (!session) throw new HttpError("Authentication required.", 401);
}

function assertRole(session, role) {
  assertAuthenticated(session);
  // superadmin can access all admin routes
  if (session.user.role === "superadmin" && role === "admin") return;
  if (session.user.role !== role) throw new HttpError("Forbidden.", 403);
}

function getGymId(session) {
  // superadmin has no gym_id — returns null (used to bypass filtering)
  return session.user.gym_id || null;
}

async function assertClientBelongsToGym(env, session, clientId) {
  const gymId = getGymId(session);
  if (!gymId) return; // superadmin bypasses gym scope check
  const client = await env.DB.prepare(`SELECT id FROM clients WHERE id = ? AND gym_id = ? AND deleted_at IS NULL`).bind(clientId, gymId).first();
  if (!client) throw new HttpError("Client not found.", 404);
}

async function getAdminClientDetail(env, clientId) {
  const client = await env.DB.prepare(`SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1`).bind(clientId).first();
  if (!client) throw new HttpError("Client not found.", 404);
  const user = await env.DB.prepare(`SELECT id, username, must_change_password FROM users WHERE client_id = ? AND role = 'client' LIMIT 1`).bind(clientId).first();
  const intake = await getLatestIntake(env, clientId);
  const plan = await getLatestPlan(env, clientId);
  const dailyLogs = await selectJsonRows(env, `SELECT * FROM daily_logs WHERE client_id = ? ORDER BY log_date DESC LIMIT 7`, [clientId]);
  const checkins = await selectJsonRows(env, `SELECT * FROM checkins WHERE client_id = ? ORDER BY checkin_date DESC LIMIT 8`, [clientId]);
  const weeklyReview = await env.DB.prepare(`SELECT * FROM weekly_reviews WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1`).bind(clientId).first();
  // Get household members
  const householdMembers = client.household_id ? (await env.DB.prepare(`
    SELECT clients.id, clients.full_name, users.username
    FROM clients
    LEFT JOIN users ON users.client_id = clients.id AND users.role = 'client'
    WHERE clients.deleted_at IS NULL AND clients.household_id = ? AND clients.id != ?
  `).bind(client.household_id, clientId).all()).results : [];

  return { client, user, intake, plan, dailyLogs, checkins, weeklyReview: parseStoredJsonRow(weeklyReview), householdMembers };
}

async function getClientBootstrap(env, clientId) {
  const client = await env.DB.prepare(`SELECT * FROM clients WHERE id = ?`).bind(clientId).first();
  const intake = await getLatestIntake(env, clientId);
  const plan = await getPublishedPlan(env, clientId);
  const today = new Date().toISOString().slice(0, 10);
  const dailyLog = await env.DB.prepare(`SELECT * FROM daily_logs WHERE client_id = ? AND log_date = ?`).bind(clientId, today).first();
  const weeklyReview = await env.DB.prepare(`SELECT * FROM weekly_reviews WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1`).bind(clientId).first();
  const recentWorkoutLogs = await selectJsonRows(env, `SELECT * FROM daily_logs WHERE client_id = ? AND TRIM(COALESCE(workout_json, '')) <> '' ORDER BY log_date DESC LIMIT 20`, [clientId]);
  // Household: find meal scaling factor if client shares meals with household
  let householdScale = null;
  if (client?.household_id) {
    const householdMembers = await env.DB.prepare(`
      SELECT clients.id, clients.full_name FROM clients
      WHERE deleted_at IS NULL AND household_id = ? AND id != ?
    `).bind(client.household_id, clientId).all();
    if (householdMembers.results?.length > 0) {
      // Find the household member with a published plan to base portions on
      for (const member of householdMembers.results) {
        const memberPlan = await getPublishedPlan(env, member.id);
        if (memberPlan?.effectivePlan?.calorieTarget) {
          const myTarget = Number(String(plan?.effectivePlan?.calorieTarget || "0").replace(/[^0-9.]/g, "")) || 0;
          const theirTarget = Number(String(memberPlan.effectivePlan.calorieTarget).replace(/[^0-9.]/g, "")) || 0;
          if (myTarget > 0 && theirTarget > 0) {
            householdScale = {
              memberName: member.full_name,
              scale: Math.round((myTarget / theirTarget) * 100) / 100,
              myTarget,
              theirTarget
            };
          }
          break;
        }
      }
    }
  }

  return {
    client,
    intake,
    plan,
    canEditIntake: client?.status === "intake_open" || !intake?.completed_at,
    dailyLog: parseStoredJsonRow(dailyLog),
    weeklyReview: parseStoredJsonRow(weeklyReview),
    checkins: await selectJsonRows(env, `SELECT * FROM checkins WHERE client_id = ? ORDER BY checkin_date DESC LIMIT 10`, [clientId]),
    recentWorkoutLogs,
    householdScale
  };
}

async function upsertIntake(env, clientId, answers, complete) {
  const existing = await getLatestIntake(env, clientId);
  const payload = JSON.stringify(answers || {});
  if (existing) {
    await env.DB.prepare(`
      UPDATE intakes
      SET answers_json = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(payload, complete ? nowIso() : existing.completed_at, existing.id).run();
    return existing.id;
  }
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO intakes (id, client_id, answers_json, completed_at)
    VALUES (?, ?, ?, ?)
  `).bind(id, clientId, payload, complete ? nowIso() : null).run();
  return id;
}

async function getLatestIntake(env, clientId) {
  const row = await env.DB.prepare(`
    SELECT * FROM intakes
    WHERE client_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(clientId).first();
  return row ? parseStoredJsonRow(row) : null;
}

async function getLatestPlan(env, clientId) {
  const row = await env.DB.prepare(`
    SELECT * FROM plans
    WHERE client_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(clientId).first();
  return row ? hydratePlanRow(row) : null;
}

async function getPublishedPlan(env, clientId) {
  const row = await env.DB.prepare(`
    SELECT * FROM plans
    WHERE client_id = ? AND status = 'published'
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(clientId).first();
  return row ? hydratePlanRow(row) : null;
}

function hydratePlanRow(row) {
  const generated = safeJson(row.generated_json, {});
  const edited = row.edited_json ? safeJson(row.edited_json, null) : null;
  const agentReviews = row.agent_reviews_json ? safeJson(row.agent_reviews_json, null) : null;
  return {
    ...row,
    generated_json: generated,
    edited_json: edited,
    agent_reviews_json: agentReviews,
    effectivePlan: edited || generated
  };
}

async function saveDraftPlan(env, clientId, intakeId, generatedPlan, agentReviews = null) {
  const existing = await getLatestPlan(env, clientId);
  const payload = JSON.stringify(generatedPlan);
  const reviewsPayload = agentReviews ? JSON.stringify(agentReviews) : null;
  if (existing) {
    await env.DB.prepare(`
      UPDATE plans
      SET status = 'draft', source_intake_id = ?, generated_json = ?, edited_json = NULL, published_at = NULL, updated_at = CURRENT_TIMESTAMP, agent_reviews_json = ?
      WHERE id = ?
    `).bind(intakeId, payload, reviewsPayload, existing.id).run();
    return existing.id;
  }
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO plans (id, client_id, status, source_intake_id, generated_json, agent_reviews_json)
    VALUES (?, ?, 'draft', ?, ?, ?)
  `).bind(id, clientId, intakeId, payload, reviewsPayload).run();
  return id;
}

async function updatePlanEdits(env, clientId, editedPlan) {
  const plan = await getLatestPlan(env, clientId);
  if (!plan) throw new HttpError("Generate a draft first.", 400);
  await env.DB.prepare(`
    UPDATE plans
    SET edited_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(JSON.stringify(editedPlan), plan.id).run();
}

async function setPlanPublished(env, clientId, publish) {
  const plan = await getLatestPlan(env, clientId);
  if (!plan) throw new HttpError("No plan available.", 404);
  await env.DB.prepare(`
    UPDATE plans
    SET status = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(publish ? "published" : "draft", publish ? nowIso() : null, plan.id).run();
}

async function upsertDailyLog(env, clientId, logDate, payload) {
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO daily_logs (id, client_id, log_date, meals_json, workout_json, macros_json, hydration, steps, cardio, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(client_id, log_date) DO UPDATE SET
      meals_json = excluded.meals_json,
      workout_json = excluded.workout_json,
      macros_json = excluded.macros_json,
      hydration = excluded.hydration,
      steps = excluded.steps,
      cardio = excluded.cardio,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    id,
    clientId,
    logDate,
    JSON.stringify(payload.meals || {}),
    JSON.stringify(payload.workout || {}),
    JSON.stringify(payload.macros || {}),
    Number(payload.hydration || 0),
    Number(payload.steps || 0),
    payload.cardio || "",
    payload.notes || ""
  ).run();
}

async function upsertCheckin(env, clientId, payload) {
  const date = payload.checkinDate || new Date().toISOString().slice(0, 10);
  await env.DB.prepare(`
    INSERT INTO checkins (id, client_id, checkin_date, weight, body_fat, waist, hips, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(client_id, checkin_date) DO UPDATE SET
      weight = excluded.weight,
      body_fat = excluded.body_fat,
      waist = excluded.waist,
      hips = excluded.hips,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    crypto.randomUUID(),
    clientId,
    date,
    payload.weight ?? null,
    payload.bodyFat ?? null,
    payload.waist ?? null,
    payload.hips ?? null,
    payload.notes || ""
  ).run();
}

async function upsertWeeklyReview(env, clientId, weekKey, payload) {
  await env.DB.prepare(`
    INSERT INTO weekly_reviews (id, client_id, week_key, review_json, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(client_id, week_key) DO UPDATE SET
      review_json = excluded.review_json,
      updated_at = CURRENT_TIMESTAMP
  `).bind(crypto.randomUUID(), clientId, weekKey, JSON.stringify(payload || {})).run();
}

async function exportToGoogleSheets(env, clientId) {
  if (!env.GOOGLE_SHEETS_WEBHOOK) throw new HttpError("GOOGLE_SHEETS_WEBHOOK is not configured.", 400);
  const payload = await buildExportPayload(env, clientId);
  const exportId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO exports (id, client_id, export_type, target, status)
    VALUES (?, ?, 'google_sheets', ?, 'sent')
  `).bind(exportId, clientId, env.GOOGLE_SHEETS_WEBHOOK).run();

  const response = await fetch(env.GOOGLE_SHEETS_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new HttpError("Google Sheets export failed.", 502);
  return { exportId };
}

async function buildExportPayload(env, clientId) {
  const clients = clientId
    ? [await env.DB.prepare(`SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL`).bind(clientId).first()]
    : (await env.DB.prepare(`SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC`).all()).results;

  const output = [];
  for (const client of clients.filter(Boolean)) {
    const intake = await getLatestIntake(env, client.id);
    const plan = await getLatestPlan(env, client.id);
    const dailyLogs = await selectJsonRows(env, `SELECT * FROM daily_logs WHERE client_id = ? ORDER BY log_date DESC LIMIT 30`, [client.id]);
    const checkins = await selectJsonRows(env, `SELECT * FROM checkins WHERE client_id = ? ORDER BY checkin_date DESC LIMIT 30`, [client.id]);
    const weeklyReviews = await selectJsonRows(env, `SELECT * FROM weekly_reviews WHERE client_id = ? ORDER BY updated_at DESC LIMIT 12`, [client.id]);
    output.push({ client, intake, plan, dailyLogs, checkins, weeklyReviews });
  }
  return { exportedAt: nowIso(), clients: output };
}

async function getProgressContext(env, clientId) {
  const dailyLogs = await selectJsonRows(env, `SELECT * FROM daily_logs WHERE client_id = ? ORDER BY log_date DESC LIMIT 14`, [clientId]);
  const checkins = await selectJsonRows(env, `SELECT * FROM checkins WHERE client_id = ? ORDER BY checkin_date DESC LIMIT 8`, [clientId]);
  const weeklyReview = await env.DB.prepare(`SELECT * FROM weekly_reviews WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1`).bind(clientId).first();
  return {
    dailyLogs,
    checkins,
    weeklyReview: parseStoredJsonRow(weeklyReview)
  };
}


// ═══════════════════════════════════════════════════════════════
//  AGENT REVIEW PIPELINE
//  Three specialist agents review the Gemini-generated plan.
//  Each agent uses a focused system prompt and returns structured JSON.
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
//  HOUSEHOLD CONTEXT
//  Fetches the reference member's plan and intake for meal alignment
// ═══════════════════════════════════════════════════════════════

async function getHouseholdContext(env, clientId) {
  const client = await env.DB.prepare(`SELECT * FROM clients WHERE id = ?`).bind(clientId).first();
  if (!client?.household_id) return null;

  // Parse household_id — may have ":base" suffix to mark reference member
  const rawHouseholdId = client.household_id;
  const householdId = rawHouseholdId.replace(":base", "");

  // Get all household members except current client
  const members = await env.DB.prepare(`
    SELECT id, full_name, household_id FROM clients
    WHERE deleted_at IS NULL AND (household_id = ? OR household_id = ?) AND id != ?
  `).bind(householdId, householdId + ":base", clientId).all();

  if (!members.results?.length) return null;

  // Find the base member (marked with :base) or just pick the first with a published plan
  let baseMember = members.results.find(m => m.household_id?.endsWith(":base"));
  if (!baseMember) baseMember = members.results[0];

  const basePlan = await getPublishedPlan(env, baseMember.id);
  const baseIntake = await getLatestIntake(env, baseMember.id);

  if (!basePlan) return null;

  // Calculate portion scale
  const myCalorieTarget = null; // will be calculated after plan generation
  const theirCalorieTarget = Number(
    String(basePlan.effectivePlan?.calorieTarget || "0").replace(/[^0-9.]/g, "")
  ) || 0;

  return {
    memberName: baseMember.full_name,
    memberId: baseMember.id,
    basePlan: basePlan.effectivePlan || basePlan,
    baseIntake: baseIntake?.answers_json || {},
    theirCalorieTarget,
    isBase: rawHouseholdId.endsWith(":base") // current client is the base
  };
}

async function callGeminiAgent(env, agentName, systemPrompt, planJson, intakeJson, householdContext = null, progressContext = {}) {
  if (!env.GEMINI_API_KEY) {
    return { status: "skipped", reason: "GEMINI_API_KEY not configured", issues: [], suggestions: [] };
  }
  const parts = [systemPrompt];
  if (householdContext) {
    parts.push(
      "HOUSEHOLD MEAL ALIGNMENT — THIS IS CRITICAL:",
      `This client (${intakeJson?.profile?.fullName || "client"}) shares all meals with ${householdContext.memberName}.`,
      `ALL meal dishes in this plan MUST be identical to the household reference plan below — only portion sizes and macro numbers should differ.`,
      `${householdContext.memberName}'s calorie target: ${householdContext.theirCalorieTarget} kcal. Scale this client's portions proportionally.`,
      `Any dish that appears in this client's plan but NOT in the household reference plan is a FLAGGED issue.`,
      "HOUSEHOLD REFERENCE MEAL PLAN:",
      JSON.stringify({ mealOptions: householdContext.basePlan?.mealOptions || [], calorieTarget: householdContext.basePlan?.calorieTarget })
    );
  }
  const progressSummary = buildProgressSummary(progressContext);
  const hasProgress = progressSummary.dailyLogs.length > 0 || progressSummary.checkins.length > 0 || progressSummary.weeklyReview;
  parts.push(
    "INTAKE DATA:",
    JSON.stringify(intakeJson),
    "GENERATED PLAN TO REVIEW:",
    JSON.stringify(planJson),
    ...(hasProgress ? ["CLIENT PROGRESS DATA (last 14 daily logs, last 8 check-ins, latest weekly review):", JSON.stringify(progressSummary)] : []),
    "Return ONLY a JSON object in this exact shape — no prose, no markdown:",
    JSON.stringify({
      status: "approved | needs_attention | flagged",
      score: "1-10 integer",
      summary: "one sentence summary of your review",
      issues: ["list of specific problems found, empty array if none"],
      suggestions: ["list of specific improvements, empty array if none"]
    })
  );
  const prompt = parts.join("\n");

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || "gemini-2.5-flash"}:generateContent?key=${env.GEMINI_API_KEY}`;
    const body = JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    // Retry up to 2 times on 429 (rate limit) with 15s backoff
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 15000 * attempt));
      res = await fetchWithTimeout(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      }, Number(env.GEMINI_TIMEOUT_MS) || GEMINI_TIMEOUT_MS);
      if (res.status !== 429) break;
      console.warn(`[agent:${agentName}] 429 rate limit — retrying (attempt ${attempt + 1})`);
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[agent:${agentName}] HTTP ${res.status}`, errBody.slice(0, 500));
      const isQuotaExhausted = errBody.includes("quota") || errBody.includes("RESOURCE_EXHAUSTED");
      const reason = res.status === 429
        ? (isQuotaExhausted
            ? "Gemini daily quota reached (250 req/day on free tier). Try again tomorrow or upgrade to a paid API key."
            : "Gemini rate limit hit. Wait 60 seconds and try again.")
        : `Agent API error: HTTP ${res.status}`;
      return { status: "skipped", reason, rateLimited: res.status === 429, issues: [], suggestions: [] };
    }
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || "").join("") || "";
    const parsed = safeJson(text, null);
    if (!parsed) {
      return { status: "skipped", reason: "Agent returned invalid JSON", issues: [], suggestions: [] };
    }
    const validStatuses = ["approved", "needs_attention", "flagged"];
    const statusVal = parsed.status;
    const scoreVal = Number(parsed.score);
    const malformed = !validStatuses.includes(statusVal) || !(scoreVal >= 1 && scoreVal <= 10);
    return {
      status: validStatuses.includes(statusVal) ? statusVal : "needs_attention",
      score: (scoreVal >= 1 && scoreVal <= 10) ? scoreVal : 5,
      summary: parsed.summary || "",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      reviewedAt: nowIso(),
      ...(malformed ? { malformed: true, malformedFields: Object.keys(parsed) } : {})
    };
  } catch (err) {
    return { status: "skipped", reason: `Agent error: ${err.message}`, issues: [], suggestions: [] };
  }
}

async function runNutritionistAgent(env, intake, plan, householdContext = null, progressContext = {}) {
  const householdExtra = householdContext
    ? `\nHOUSEHOLD RULE: This client shares all meals with ${householdContext.memberName}. Meal DISHES must be IDENTICAL to the household reference plan. Macro values should be proportionally scaled to this client's calorie target. Flag ANY dish mismatch as a critical issue.`
    : "";
  const systemPrompt = `You are a registered sports nutritionist reviewing an AI-generated fitness coaching plan.
Your job is to validate the nutrition section ONLY — macros, calories, meal options, and diet structure.
Focus on: calorie target vs goal and body weight, protein adequacy (minimum 1.6g/kg for muscle, 1.2g/kg for fat loss),
meal variety and cuisine alignment with client preferences, food allergies respected, meal frequency matching client preference,
any dangerous deficits (under 1200 kcal for women, under 1500 kcal for men).
If progress data is provided, use it: flag if actual logged macros show consistent shortfalls, if weight check-ins show a plateau suggesting calorie adjustment is needed, or if the client is consistently not hitting meal targets.
Be specific and constructive. Score 1-10 where 10 is perfect.
Status rules: approved = no serious issues, needs_attention = minor fixes needed, flagged = serious nutritional problem.${householdExtra}`;
  return callGeminiAgent(env, "nutritionist", systemPrompt, plan, intake, householdContext, progressContext);
}

async function runFitnessExpertAgent(env, intake, plan, householdContext = null, progressContext = {}) {
  const systemPrompt = `You are a certified strength and conditioning coach (NSCA/NASM level) reviewing an AI-generated fitness plan.
Your job is to validate the workout section ONLY — exercise selection, training split, volume, and safety.
Focus on: training days matching client availability, exercise selection appropriate for gym access stated,
all injuries and movement restrictions fully respected, volume appropriate for experience level (beginner vs advanced),
compound vs isolation balance, rest day placement, warm-up and cool-down included.
If progress data is provided, use it: flag if logged workouts show the client is consistently skipping sessions, struggling with certain exercises, or if cardio/steps data suggests the volume is too high or too low.
Be specific and constructive. Score 1-10 where 10 is perfect.
Status rules: approved = no serious issues, needs_attention = minor fixes needed, flagged = unsafe or inappropriate plan.`;
  return callGeminiAgent(env, "fitnessExpert", systemPrompt, plan, intake, null, progressContext);
}

async function runSportsScientistAgent(env, intake, plan, householdContext = null, progressContext = {}) {
  const systemPrompt = `You are a sports scientist specialising in evidence-based training programme design.
Your job is to validate the overall structure of this fitness plan — periodisation, progressive overload, and recovery science.
Focus on: progressive overload protocol present (weekly load increases), periodisation structure (linear, undulating, or block),
deload weeks recommended for plans over 4 weeks, recovery days adequate relative to intensity,
milestones are measurable and realistic, success rules are evidence-based not anecdotal,
overall plan coherence — nutrition and training aligned toward the same goal.
If progress data is provided, use it: flag if check-in trends show no body composition change over multiple weeks (suggesting the plan needs structural adjustment), or if recovery indicators suggest the client is under-recovering.
Be specific and constructive. Score 1-10 where 10 is perfect.
Status rules: approved = well-structured evidence-based plan, needs_attention = missing some science principles, flagged = poor structure that will limit results.`;
  return callGeminiAgent(env, "sportsScientist", systemPrompt, plan, intake, null, progressContext);
}


async function runAgentPipeline(env, intake, plan, householdContext = null, progressContext = {}) {
  // Run sequentially with a short delay between calls to stay within Gemini free-tier RPM limits
  const nutritionist = await runNutritionistAgent(env, intake, plan, householdContext, progressContext);
  await new Promise(r => setTimeout(r, 5000));
  const fitnessExpert = await runFitnessExpertAgent(env, intake, plan, null, progressContext);
  await new Promise(r => setTimeout(r, 5000));
  const sportsScientist = await runSportsScientistAgent(env, intake, plan, null, progressContext);
  return {
    nutritionist,
    fitnessExpert,
    sportsScientist,
    pipelineRunAt: nowIso(),
    overallStatus: [nutritionist, fitnessExpert, sportsScientist].some(a => a.status === "flagged")
      ? "flagged"
      : [nutritionist, fitnessExpert, sportsScientist].some(a => a.status === "needs_attention")
        ? "needs_attention"
        : "approved"
  };
}
async function refinePlanWithAgentFeedback(env, intake, plan, agentReviews, progressContext = {}, householdContext = null) {
  if (!env.GEMINI_API_KEY) return plan;

  // Collect issues per domain — only from agents that need attention or are flagged
  const nutritionIssues = [];
  const fitnessIssues = [];
  const scienceIssues = [];

  const nutritionist = agentReviews?.nutritionist;
  const fitnessExpert = agentReviews?.fitnessExpert;
  const sportsScientist = agentReviews?.sportsScientist;

  if (nutritionist && nutritionist.status !== "approved") {
    if (Array.isArray(nutritionist.issues)) nutritionIssues.push(...nutritionist.issues);
    if (Array.isArray(nutritionist.suggestions)) nutritionIssues.push(...nutritionist.suggestions);
  }
  if (fitnessExpert && fitnessExpert.status !== "approved") {
    if (Array.isArray(fitnessExpert.issues)) fitnessIssues.push(...fitnessExpert.issues);
    if (Array.isArray(fitnessExpert.suggestions)) fitnessIssues.push(...fitnessExpert.suggestions);
  }
  if (sportsScientist && sportsScientist.status !== "approved") {
    if (Array.isArray(sportsScientist.issues)) scienceIssues.push(...sportsScientist.issues);
    if (Array.isArray(sportsScientist.suggestions)) scienceIssues.push(...sportsScientist.suggestions);
  }

  const totalIssues = nutritionIssues.length + fitnessIssues.length + scienceIssues.length;
  if (totalIssues === 0) return plan;

  const householdInstruction = householdContext
    ? `HOUSEHOLD MEAL ALIGNMENT — MANDATORY: This client shares all meals with ${householdContext.memberName} (calorie target: ${householdContext.theirCalorieTarget} kcal). You MUST use the EXACT SAME meal dishes as the household reference plan — only scale portions and macros.\nHOUSEHOLD REFERENCE MEALS: ${JSON.stringify(householdContext.basePlan?.mealOptions || [])}`
    : null;

  const domainRules = [
    nutritionIssues.length > 0
      ? `NUTRITION FIXES (only change: calorieTarget, macros, mealOptions, weeklyMealStructure, supplements):\n${nutritionIssues.map((i, n) => `${n + 1}. ${i}`).join("\n")}`
      : `NUTRITION: Already approved — do NOT change calorieTarget, macros, mealOptions, weeklyMealStructure, or supplements.`,

    fitnessIssues.length > 0
      ? `FITNESS FIXES (only change: workoutSplit exercises, warmup, cooldown):\n${fitnessIssues.map((i, n) => `${n + 1}. ${i}`).join("\n")}`
      : `FITNESS: Already approved — do NOT change workoutSplit, exercises, warmup, or cooldown.`,

    scienceIssues.length > 0
      ? `PERIODISATION FIXES (only change: periodisation, deloadProtocol, progressionProtocol, progressMilestones, successRules):\n${scienceIssues.map((i, n) => `${n + 1}. ${i}`).join("\n")}`
      : `PERIODISATION: Already approved — do NOT change periodisation, deloadProtocol, progressionProtocol, progressMilestones, or successRules.`
  ];

  const prompt = [
    "You are refining an AI-generated fitness coaching plan based on domain-specific expert feedback.",
    "Return JSON only — same structure as the original plan.",
    "CRITICAL RULE: Each domain fix is strictly isolated. Only touch the fields listed under each domain's fix section.",
    "If a domain says 'Already approved — do NOT change', leave every field in that domain exactly as it is in the original plan.",
    "Copy approved sections verbatim from the original plan. Do not paraphrase or regenerate them.",
    ...(householdInstruction ? [householdInstruction] : []),
    "",
    ...domainRules,
    "",
    "ORIGINAL PLAN (copy approved sections exactly):",
    JSON.stringify(plan),
    "INTAKE DATA:",
    JSON.stringify(intake),
    "Return the refined plan in this exact shape:",
    JSON.stringify({
      profileSummary: "string",
      calorieTarget: "string",
      macros: { protein: "string", carbs: "string", fat: "string" },
      mealOptions: [{ meal: "Breakfast", options: [{ label: "opt1", calories: 450, protein: 35, carbs: 50, fat: 12 }] }],
      weeklyMealStructure: ["Mon - ..."],
      supplements: ["item"],
      workoutSplit: [{ day: "Day 1", warmup: ["5 min light cardio"], exercises: ["exercise 3x8"], cooldown: ["stretch 30s"] }],
      periodisation: "string",
      deloadProtocol: "string",
      progressionProtocol: "string",
      progressMilestones: ["milestone"],
      successRules: ["rule"],
      cautions: ["caution"]
    })
  ].join("\n");

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || "gemini-2.5-flash"}:generateContent?key=${env.GEMINI_API_KEY}`;
    const res = await fetchWithTimeout(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    }, Number(env.GEMINI_TIMEOUT_MS) || GEMINI_TIMEOUT_MS);
    if (!res.ok) return plan;
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || "").join("") || "";
    const parsed = safeJson(text, null);
    if (!parsed || typeof parsed !== "object") return plan;
    const refined = normalizePlan(parsed, intake, {
      source: "gemini-refined",
      reason: "Plan refined with agent feedback.",
      model: env.GEMINI_MODEL || "gemini-2.5-flash",
      generatedAt: nowIso(),
      issuesAddressed: totalIssues
    });
    // Fall back to original if refinement lost critical content
    const hasMeals = Array.isArray(refined.mealOptions) && refined.mealOptions.length > 0;
    const hasWorkouts = Array.isArray(refined.workoutSplit) && refined.workoutSplit.length > 0;
    if (!hasMeals || !hasWorkouts) return plan;
    return refined;
  } catch {
    return plan;
  }
}
async function generatePlanFromIntake(env, intake, progressContext = {}, householdContext = null) {
  if (!env.GEMINI_API_KEY) {
    return fallbackPlanFromIntake(intake, {
      source: "fallback",
      reason: "GEMINI_API_KEY is not configured.",
      generatedAt: nowIso()
    });
  }

  const householdInstruction = householdContext
    ? `HOUSEHOLD MEAL ALIGNMENT — MANDATORY: This client shares all meals with ${householdContext.memberName} (calorie target: ${householdContext.theirCalorieTarget} kcal). You MUST use the EXACT SAME meal dishes as in the household reference plan below — only scale the portion sizes and macro numbers to this client's calorie target. Do not invent new dishes.\nHOUSEHOLD REFERENCE MEALS: ${JSON.stringify(householdContext.basePlan?.mealOptions || [])}`
    : null;

  const prompt = [
    "You are generating a fitness coaching plan.",
    "Return JSON only.",
    "For each meal in mealOptions, provide 6 or 7 practical varieties.",
    "Each meal option list should mean the client chooses any 1 option for that meal, not all options together.",
    "Make the food options cuisine-aware and realistic for daily repetition.",
    ...(householdInstruction ? [householdInstruction] : []),
    "If progress data is provided, use it to adjust calories, macros, adherence guidance, meal simplicity, recovery, and training recommendations.",
    "Pay attention to client notes, daily adherence, check-in trends, and weekly review consistency.",
    "Use this exact shape:",
    JSON.stringify({
      profileSummary: "string",
      calorieTarget: "string",
      macros: { protein: "string", carbs: "string", fat: "string" },
      mealOptions: [{ meal: "Breakfast", options: [{ label: "opt1", calories: 450, protein: 35, carbs: 50, fat: 12 }] }],
      weeklyMealStructure: ["Mon - ..."],
      supplements: ["item"],
      workoutSplit: [{ day: "Day 1", warmup: ["5 min light cardio", "dynamic stretch"], exercises: ["exercise 3x8"], cooldown: ["quad stretch 30s", "hamstring stretch 30s"] }],
      periodisation: "string — describe the mesocycle structure, e.g. 6-week linear: weeks 1-2 adaptation, 3-4 strength, 5-6 intensity, week 7 deload",
      deloadProtocol: "string — describe when and how to deload, e.g. Every 5th week: reduce all weights by 50%, cut sets in half, focus on form",
      progressionProtocol: "string — specific week-to-week progression rules, e.g. 2-for-2 rule: when you complete 2 extra reps on last set for 2 consecutive sessions, increase weight by 2.5kg",
      progressMilestones: ["milestone"],
      successRules: ["rule"],
      cautions: ["caution"]
    }),
    "Base the plan on this intake JSON:",
    JSON.stringify(intake),
    "Also use this recent progress JSON:",
    JSON.stringify(buildProgressSummary(progressContext))
  ].join("\n");

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || "gemini-2.5-flash"}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetchWithTimeout(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  }, Number(env.GEMINI_TIMEOUT_MS) || GEMINI_TIMEOUT_MS);

  if (!res.ok) {
    return fallbackPlanFromIntake(intake, {
      source: "fallback",
      reason: `Gemini request failed with HTTP ${res.status}.`,
      details: trimForStorage(await res.text(), 500),
      model: env.GEMINI_MODEL || "gemini-2.5-flash",
      generatedAt: nowIso(),
      usedProgressData: true
    });
  }

  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || "").join("") || "";
  const parsed = safeJson(text, null);
  if (!parsed || typeof parsed !== "object") {
    return fallbackPlanFromIntake(intake, {
      source: "fallback",
      reason: "Gemini returned invalid JSON.",
      details: trimForStorage(text, 500),
      model: env.GEMINI_MODEL || "gemini-2.5-flash",
      generatedAt: nowIso(),
      usedProgressData: true
    });
  }
  return normalizePlan(parsed, intake, {
    source: "gemini",
    reason: "Gemini plan generated successfully.",
    model: env.GEMINI_MODEL || "gemini-2.5-flash",
    generatedAt: nowIso(),
    usedProgressData: true
  });
}

function buildProgressSummary(progressContext = {}) {
  const dailyLogs = Array.isArray(progressContext.dailyLogs) ? progressContext.dailyLogs : [];
  const checkins = Array.isArray(progressContext.checkins) ? progressContext.checkins : [];
  const weeklyReview = progressContext.weeklyReview || null;
  return {
    dailyLogs: dailyLogs.map(log => ({
      date: log.log_date,
      meals: log.meals_json || {},
      macros: log.macros_json || {},
      hydration: log.hydration,
      steps: log.steps,
      cardio: log.cardio,
      workout: log.workout_json || {},
      notes: log.notes || ""
    })),
    checkins: checkins.map(item => ({
      date: item.checkin_date,
      weight: item.weight,
      bodyFat: item.body_fat,
      waist: item.waist,
      hips: item.hips,
      notes: item.notes || ""
    })),
    weeklyReview: weeklyReview ? {
      weekKey: weeklyReview.week_key,
      review: weeklyReview.review_json || {}
    } : null
  };
}

function fallbackPlanFromIntake(intake, generationMeta = {}) {
  const profile = intake.profile || {};
  const training = intake.training || {};
  const body = intake.bodyComposition || {};
  const diet = intake.diet || {};
  const injuries = intake.injuriesMedical || {};
  return normalizePlan({
    profileSummary: `${profile.fullName || "Client"} is pursuing ${body.goalType || "body recomposition"} with ${training.daysPerWeek || "3-5"} training days per week and ${diet.cuisineStyle || "preferred"} meals.`,
    calorieTarget: "Coach review required",
    macros: { protein: "High protein", carbs: "Moderate carbs", fat: "Balanced fats" },
    mealOptions: [
      { meal: "Breakfast", options: [
        { label: "Eggs with idli or dosa", calories: 430, protein: 28, carbs: 38, fat: 18 },
        { label: "Greek yogurt or curd bowl", calories: 360, protein: 26, carbs: 34, fat: 10 },
        { label: "Oats with whey", calories: 390, protein: 32, carbs: 42, fat: 9 },
        { label: "Paneer or tofu breakfast wrap", calories: 410, protein: 30, carbs: 30, fat: 18 },
        { label: "Upma with added protein", calories: 400, protein: 24, carbs: 46, fat: 12 },
        { label: "Poha with eggs or soy", calories: 420, protein: 27, carbs: 48, fat: 11 },
        { label: "Smoothie with whey and fruit", calories: 350, protein: 30, carbs: 35, fat: 7 }
      ] },
      { meal: "Lunch", options: [
        { label: "Rice with lean protein and vegetables", calories: 620, protein: 42, carbs: 68, fat: 18 },
        { label: "Chapati with chicken or paneer curry", calories: 580, protein: 40, carbs: 48, fat: 22 },
        { label: "Millet bowl with dal and vegetables", calories: 540, protein: 28, carbs: 70, fat: 14 },
        { label: "Fish curry meal with controlled rice", calories: 560, protein: 38, carbs: 52, fat: 20 },
        { label: "Curd rice plus grilled protein", calories: 590, protein: 36, carbs: 58, fat: 21 },
        { label: "South Indian balanced thali plate", calories: 610, protein: 30, carbs: 74, fat: 18 },
        { label: "Salad bowl with carb side and protein", calories: 500, protein: 38, carbs: 40, fat: 18 }
      ] },
      { meal: "Dinner", options: [
        { label: "Lean protein with vegetables", calories: 460, protein: 42, carbs: 20, fat: 20 },
        { label: "Chapati with egg or paneer curry", calories: 520, protein: 30, carbs: 40, fat: 24 },
        { label: "Grilled fish with rice and veg", calories: 540, protein: 40, carbs: 46, fat: 18 },
        { label: "Chicken stir fry with light carbs", calories: 480, protein: 38, carbs: 28, fat: 20 },
        { label: "Tofu or paneer bowl", calories: 450, protein: 28, carbs: 24, fat: 24 },
        { label: "Soup plus protein side", calories: 380, protein: 34, carbs: 18, fat: 16 },
        { label: "Post-workout balanced plate", calories: 560, protein: 42, carbs: 48, fat: 18 }
      ] }
    ],
    weeklyMealStructure: ["Choose any 1 breakfast, 1 lunch, and 1 dinner option each day.", "Follow 3 structured meals daily and repeat high-protein options through the week."],
    supplements: [injuries.medications || "Continue prescribed medication", injuries.supplements || "Supplements per coach review"].filter(Boolean),
    workoutSplit: [
      { day: "Day 1", exercises: ["Lower body strength", "Accessory work", "Short cardio finisher"] },
      { day: "Day 2", exercises: ["Upper body / push or rehab aware work", "Accessory work"] },
      { day: "Day 3", exercises: ["Conditioning or posterior chain"] },
      { day: "Day 4", exercises: ["Upper pull / hypertrophy"] },
      { day: "Day 5", exercises: ["Fat-loss conditioning or optional active recovery"] }
    ],
    progressMilestones: ["Track scale, measurements, and photos weekly.", "Review adherence after 2 weeks."],
    successRules: ["Protein at each meal", "Train consistently", "Sleep and hydration matter", "Track adherence weekly"],
    cautions: [injuries.injuries || "Respect injury constraints and use coach-approved exercise substitutions."]
  }, intake, generationMeta);
}

function normalizePlan(plan, intake, generationMetaOverride) {
  return {
    profileSummary: plan.profileSummary || "Structured coaching plan generated from intake.",
    calorieTarget: plan.calorieTarget || "Coach review required",
    macros: {
      protein: plan.macros?.protein || "",
      carbs: plan.macros?.carbs || "",
      fat: plan.macros?.fat || ""
    },
    mealOptions: Array.isArray(plan.mealOptions) ? plan.mealOptions.map(normalizeMealSection) : [],
    weeklyMealStructure: Array.isArray(plan.weeklyMealStructure) ? plan.weeklyMealStructure : [],
    supplements: Array.isArray(plan.supplements) ? plan.supplements : [],
    workoutSplit: Array.isArray(plan.workoutSplit) ? plan.workoutSplit.map(day => ({
      day: day.day || "",
      warmup: Array.isArray(day.warmup) ? day.warmup : [],
      exercises: Array.isArray(day.exercises) ? day.exercises : [],
      cooldown: Array.isArray(day.cooldown) ? day.cooldown : []
    })) : [],
    periodisation: plan.periodisation || "",
    deloadProtocol: plan.deloadProtocol || "",
    progressionProtocol: plan.progressionProtocol || "",
    progressMilestones: Array.isArray(plan.progressMilestones) ? plan.progressMilestones : [],
    successRules: Array.isArray(plan.successRules) ? plan.successRules : [],
    cautions: Array.isArray(plan.cautions) ? plan.cautions : [],
    generationMeta: plan.generationMeta || generationMetaOverride || null,
    intakeSnapshot: intake
  };
}

function normalizeMealSection(section) {
  return {
    meal: section?.meal || "",
    options: Array.isArray(section?.options) ? section.options.map(normalizeMealOption).filter(Boolean) : []
  };
}

function normalizeMealOption(option) {
  if (!option) return null;
  if (typeof option === "string") {
    return { label: option, calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  return {
    label: option.label || option.name || "",
    calories: Number(option.calories || 0),
    protein: Number(option.protein || 0),
    carbs: Number(option.carbs || 0),
    fat: Number(option.fat || 0)
  };
}

async function selectJsonRows(env, sql, binds) {
  const stmt = env.DB.prepare(sql).bind(...binds);
  const rows = await stmt.all();
  return (rows.results || []).map(parseStoredJsonRow);
}

function parseStoredJsonRow(row) {
  if (!row) return null;
  const out = { ...row };
  for (const key of ["answers_json", "generated_json", "edited_json", "meals_json", "workout_json", "macros_json", "review_json", "agent_reviews_json"]) {
    if (out[key] && typeof out[key] === "string") out[key] = safeJson(out[key], {});
  }
  return out;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function withCookie(response, cookie) {
  response.headers.append("Set-Cookie", cookie);
  return response;
}

function buildSessionCookie(sessionId, env, expiresAt) {
  const secure = String(env.COOKIE_SECURE || "true") !== "false";
  return `fitness_session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure ? "; Secure" : ""}`;
}

function clearSessionCookie(env) {
  const secure = String(env.COOKIE_SECURE || "true") !== "false";
  return `fitness_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const parts = cookie.split(/;\s*/);
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError("Invalid JSON body.", 400);
  }
}

function clean(value, maxLength = DEFAULT_CLEAN_MAX_LENGTH) {
  const s = String(value || "").trim();
  if (s.length > maxLength) throw new HttpError(`Input too long (max ${maxLength} characters).`, 400);
  return s;
}

function nowIso() {
  return new Date().toISOString();
}

function fetchWithTimeout(url, options, timeoutMs = GEMINI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function writeAuditLog(env, session, action, targetId, meta = {}) {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_id, actor_username, action, target_id, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      crypto.randomUUID(),
      session?.user?.id || null,
      session?.user?.username || null,
      action,
      targetId || null,
      JSON.stringify(meta)
    ).run();
  } catch (err) {
    console.error("[audit] Failed to write audit log — action:", action, "target:", targetId, "error:", err.message, err.stack);
  }
}

async function checkRateLimit(env, key, maxAttempts, windowSeconds) {
  try {
    const now = Date.now();
    const record = await env.DB.prepare(
      `SELECT attempts, window_start FROM rate_limits WHERE key = ?`
    ).bind(key).first();
    const windowExpired = !record || (now - new Date(record.window_start).getTime() >= windowSeconds * 1000);
    if (windowExpired) {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO rate_limits (key, attempts, window_start) VALUES (?, 1, ?)`
      ).bind(key, new Date(now).toISOString()).run();
      return false; // not limited
    }
    if (record.attempts >= maxAttempts) return true; // limited
    await env.DB.prepare(
      `UPDATE rate_limits SET attempts = attempts + 1 WHERE key = ?`
    ).bind(key).run();
    return false; // not limited
  } catch (err) {
    console.error("[rate-limit] DB error — failing closed to prevent brute force bypass:", err.message);
    return true; // fail closed — block requests if rate-limit table is unavailable
  }
}

// Read-only check — does NOT increment. Use for operations where only successes should count.
async function isRateLimited(env, key, maxAttempts, windowSeconds) {
  try {
    const now = Date.now();
    const record = await env.DB.prepare(
      `SELECT attempts, window_start FROM rate_limits WHERE key = ?`
    ).bind(key).first();
    if (!record) return false;
    const windowExpired = now - new Date(record.window_start).getTime() >= windowSeconds * 1000;
    if (windowExpired) return false;
    return record.attempts >= maxAttempts;
  } catch (err) {
    console.error("[rate-limit] DB error — failing closed:", err.message);
    return true;
  }
}

// Increment the counter for a key (or start a fresh window). Call after a successful operation.
async function incrementRateLimit(env, key, windowSeconds) {
  try {
    const now = Date.now();
    const record = await env.DB.prepare(
      `SELECT attempts, window_start FROM rate_limits WHERE key = ?`
    ).bind(key).first();
    const windowExpired = !record || (now - new Date(record.window_start).getTime() >= windowSeconds * 1000);
    if (windowExpired) {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO rate_limits (key, attempts, window_start) VALUES (?, 1, ?)`
      ).bind(key, new Date(now).toISOString()).run();
    } else {
      await env.DB.prepare(
        `UPDATE rate_limits SET attempts = attempts + 1 WHERE key = ?`
      ).bind(key).run();
    }
  } catch (err) {
    // Don't fail the successful operation just because accounting failed
    console.error("[rate-limit] Failed to increment counter for key:", key, err.message);
  }
}

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function safeJson(value, fallback) {
  try {
    if (typeof value !== "string") return value;
    // Strip markdown code fences that thinking models add (```json ... ``` or ``` ... ```)
    const stripped = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    return JSON.parse(stripped);
  } catch {
    return fallback;
  }
}

function buildReviewFlags(client) {
  const flags = [];
  if (client.status === "intake_open") flags.push("intake open");
  if (client.plan_status === "draft") flags.push("needs publish");
  if (client.latest_daily_note) flags.push("new note");
  if (client.last_checkin_at) flags.push("check-in");
  if (client.last_weekly_review_at) flags.push("weekly review");
  if (!client.last_log_date || daysSinceDate(client.last_log_date) >= 3) flags.push("inactive");
  if (client.plan_status === "published" && daysSinceDate(client.last_checkin_at) >= 21) flags.push("needs replan");
  return flags;
}

function daysSinceDate(value) {
  if (!value) return Infinity;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Infinity;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function validateHouseholdMealAlignment(plan, householdContext) {
  const mismatches = [];
  const baseMeals = householdContext?.basePlan?.mealOptions;
  const generatedMeals = plan?.mealOptions;
  if (!Array.isArray(baseMeals) || !Array.isArray(generatedMeals)) return mismatches;
  const baseDishes = new Set(baseMeals.map(m => String(m?.name || m || "").toLowerCase().trim()));
  for (const meal of generatedMeals) {
    const dish = String(meal?.name || meal || "").toLowerCase().trim();
    if (dish && !baseDishes.has(dish)) {
      mismatches.push(dish);
    }
  }
  return mismatches;
}

function trimForStorage(value, limit = 500) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  return `pbkdf2$100000$${toBase64(salt)}$${toBase64(new Uint8Array(key))}`;
}

async function verifyPassword(password, stored) {
  const [scheme, iterations, saltB64, hashB64] = String(stored || "").split("$");
  if (scheme !== "pbkdf2") return false;
  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const key = await deriveKey(password, salt, Number(iterations));
  return timingSafeEqual(new Uint8Array(key), expected);
}

async function deriveKey(password, salt, iterations = 100000) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, 256);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}
// --- EMAIL UTILITY (RESEND INTEGRATION) ---
async function sendWelcomeEmail(env, email, fullName, username, tempPassword) {
  // If no API key is set, we mock the email (great for local testing/setup!)
  if (!env.RESEND_API_KEY) {
    console.log(`\n📧 [MOCK EMAIL DISPATCHED]`);
    console.log(`To: ${email}`);
    console.log(`Subject: Welcome to GymLog! Your Access Details`);
    console.log(`Body: Hi ${fullName}, your coach has invited you. Username: ${username}, Password: ${tempPassword}\n`);
    return true; 
  }

  // If API key exists, send the real email via Resend
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'GymLog Coaching <onboarding@gymlog.app>',
        to: email,
        subject: 'Welcome to GymLog! Your Access Details',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to the team, ${fullName}!</h2>
            <p>Your coach has set up your private GymLog dashboard.</p>
            <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Login URL:</strong> ${env.APP_URL || 'https://your-cloudflare-domain.workers.dev'}</p>
              <p style="margin: 0 0 10px 0;"><strong>Username:</strong> ${username}</p>
              <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
            </div>
            <p>You will be prompted to create a new secure password upon your first login.</p>
            <p>Let's get to work!</p>
          </div>
        `
      })
    });
    if (!res.ok) console.error("Resend API Error:", await res.text());
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
