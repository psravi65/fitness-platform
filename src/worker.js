export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
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
    const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`).first();
    return json({ needsAdminBootstrap: Number(count?.count || 0) === 0 });
  }

  if (url.pathname === "/api/bootstrap-admin" && method === "POST") {
    const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`).first();
    if (Number(count?.count || 0) > 0) {
      return json({ error: "Admin already exists." }, 409);
    }
    const body = await readJson(request);
    const username = clean(body.username);
    const password = String(body.password || "");
    if (!username || password.length < 8) {
      return json({ error: "Username and password of at least 8 characters are required." }, 400);
    }
    await env.DB.prepare(`
      INSERT INTO users (id, username, password_hash, role, must_change_password)
      VALUES (?, ?, ?, 'admin', 0)
    `).bind(crypto.randomUUID(), username, await hashPassword(password)).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/auth/login" && method === "POST") {
    const body = await readJson(request);
    const username = clean(body.username);
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
    const row = await env.DB.prepare(`SELECT password_hash FROM users WHERE id = ?`).bind(session.user.id).first();
    const valid = await verifyPassword(currentPassword, row.password_hash);
    if (!valid) return json({ error: "Current password is incorrect." }, 401);
    const nextHash = await hashPassword(newPassword);
    await env.DB.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`)
      .bind(nextHash, session.user.id)
      .run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/admin/clients" && method === "GET") {
    assertRole(session, "admin");
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
      ORDER BY clients.created_at DESC
    `).all();
    const clients = (rows.results || []).map((client) => ({
      ...client,
      reviewFlags: buildReviewFlags(client)
    }));
    return json({ clients });
  }

  if (url.pathname === "/api/admin/clients" && method === "POST") {
    assertRole(session, "admin");
    const body = await readJson(request);
    const fullName = clean(body.fullName);
    const username = clean(body.username);
    if (!fullName || !username) return json({ error: "Full name and username are required." }, 400);

    const existing = await env.DB.prepare(`SELECT id FROM users WHERE username = ?`).bind(username).first();
    if (existing) return json({ error: "Username already exists." }, 409);

    const clientId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO clients (id, full_name, status) VALUES (?, ?, 'active')`).bind(clientId, fullName),
      env.DB.prepare(`
        INSERT INTO users (id, username, password_hash, role, client_id, must_change_password)
        VALUES (?, ?, ?, 'client', ?, 1)
      `).bind(userId, username, hash, clientId)
    ]);

    return json({ ok: true, clientId, temporaryPassword: tempPassword });
  }

  const adminClientMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)$/);
  if (adminClientMatch && method === "GET") {
    assertRole(session, "admin");
    return json(await getAdminClientDetail(env, adminClientMatch[1]));
  }

  if (adminClientMatch && method === "DELETE") {
    assertRole(session, "admin");
    await env.DB.prepare(`DELETE FROM clients WHERE id = ?`).bind(adminClientMatch[1]).run();
    return json({ ok: true });
  }

  const resetPasswordMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/reset-password$/);
  if (resetPasswordMatch && method === "POST") {
    assertRole(session, "admin");
    const user = await env.DB.prepare(`SELECT id FROM users WHERE client_id = ? AND role = 'client'`).bind(resetPasswordMatch[1]).first();
    if (!user) return json({ error: "Client user not found." }, 404);
    const tempPassword = generateTempPassword();
    await env.DB.prepare(`UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?`)
      .bind(await hashPassword(tempPassword), user.id)
      .run();
    return json({ ok: true, temporaryPassword: tempPassword });
  }

  const clientIntakeMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/intake$/);
  if (clientIntakeMatch && method === "POST") {
    assertRole(session, "admin");
    const body = await readJson(request);
    await upsertIntake(env, clientIntakeMatch[1], body.answers || {}, body.complete);
    return json({ ok: true });
  }

  const intakeEditMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/intake-edit$/);
  if (intakeEditMatch && method === "POST") {
    assertRole(session, "admin");
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
    const intake = await getLatestIntake(env, clientId);
    if (!intake) return json({ error: "Client intake is required before generating a plan." }, 400);
    const progressContext = await getProgressContext(env, clientId);
    const normalized = await generatePlanFromIntake(env, intake.answers_json, progressContext);
    const agentReviews = await runAgentPipeline(env, intake.answers_json, normalized);
    await saveDraftPlan(env, clientId, intake.id, normalized, agentReviews);
    return json({ ok: true });
  }

  const savePlanMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/plan$/);
  if (savePlanMatch && method === "PATCH") {
    assertRole(session, "admin");
    const clientId = savePlanMatch[1];
    const body = await readJson(request);
    const editedPlan = body.editedPlan;
    if (!editedPlan || typeof editedPlan !== "object") return json({ error: "editedPlan is required." }, 400);
    await updatePlanEdits(env, clientId, editedPlan);
    return json({ ok: true });
  }

  const publishPlanMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/publish-plan$/);
  if (publishPlanMatch && method === "POST") {
    assertRole(session, "admin");
    const body = await readJson(request);
    const publish = body.publish !== false;
    await setPlanPublished(env, publishPlanMatch[1], publish);
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

  if (url.pathname === "/api/admin/exports/google-sheets" && method === "POST") {
    assertRole(session, "admin");
    const body = await readJson(request);
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
  if (session.user.role !== role) throw new HttpError("Forbidden.", 403);
}

async function getAdminClientDetail(env, clientId) {
  const client = await env.DB.prepare(`SELECT * FROM clients WHERE id = ? LIMIT 1`).bind(clientId).first();
  if (!client) throw new HttpError("Client not found.", 404);
  const user = await env.DB.prepare(`SELECT id, username, must_change_password FROM users WHERE client_id = ? AND role = 'client' LIMIT 1`).bind(clientId).first();
  const intake = await getLatestIntake(env, clientId);
  const plan = await getLatestPlan(env, clientId);
  const dailyLogs = await selectJsonRows(env, `SELECT * FROM daily_logs WHERE client_id = ? ORDER BY log_date DESC LIMIT 7`, [clientId]);
  const checkins = await selectJsonRows(env, `SELECT * FROM checkins WHERE client_id = ? ORDER BY checkin_date DESC LIMIT 8`, [clientId]);
  const weeklyReview = await env.DB.prepare(`SELECT * FROM weekly_reviews WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1`).bind(clientId).first();
  return { client, user, intake, plan, dailyLogs, checkins, weeklyReview: parseStoredJsonRow(weeklyReview) };
}

async function getClientBootstrap(env, clientId) {
  const client = await env.DB.prepare(`SELECT * FROM clients WHERE id = ?`).bind(clientId).first();
  const intake = await getLatestIntake(env, clientId);
  const plan = await getPublishedPlan(env, clientId);
  const today = new Date().toISOString().slice(0, 10);
  const dailyLog = await env.DB.prepare(`SELECT * FROM daily_logs WHERE client_id = ? AND log_date = ?`).bind(clientId, today).first();
  const weeklyReview = await env.DB.prepare(`SELECT * FROM weekly_reviews WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1`).bind(clientId).first();
  const recentWorkoutLogs = await selectJsonRows(env, `SELECT * FROM daily_logs WHERE client_id = ? AND TRIM(COALESCE(workout_json, '')) <> '' ORDER BY log_date DESC LIMIT 20`, [clientId]);
  return {
    client,
    intake,
    plan,
    canEditIntake: client?.status === "intake_open" || !intake?.completed_at,
    dailyLog: parseStoredJsonRow(dailyLog),
    weeklyReview: parseStoredJsonRow(weeklyReview),
    checkins: await selectJsonRows(env, `SELECT * FROM checkins WHERE client_id = ? ORDER BY checkin_date DESC LIMIT 10`, [clientId]),
    recentWorkoutLogs
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
    ? [await env.DB.prepare(`SELECT * FROM clients WHERE id = ?`).bind(clientId).first()]
    : (await env.DB.prepare(`SELECT * FROM clients ORDER BY created_at DESC`).all()).results;

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

async function callGeminiAgent(env, agentName, systemPrompt, planJson, intakeJson) {
  if (!env.GEMINI_API_KEY) {
    return { status: "skipped", reason: "GEMINI_API_KEY not configured", issues: [], suggestions: [] };
  }
  const prompt = [
    systemPrompt,
    "INTAKE DATA:",
    JSON.stringify(intakeJson),
    "GENERATED PLAN:",
    JSON.stringify(planJson),
    "Return ONLY a JSON object in this exact shape — no prose, no markdown:",
    JSON.stringify({
      status: "approved | needs_attention | flagged",
      score: "1-10 integer",
      summary: "one sentence summary of your review",
      issues: ["list of specific problems found, empty array if none"],
      suggestions: ["list of specific improvements, empty array if none"]
    })
  ].join("\n");

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || "gemini-2.5-flash"}:generateContent?key=${env.GEMINI_API_KEY}`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    if (!res.ok) {
      return { status: "skipped", reason: `Agent API error: HTTP ${res.status}`, issues: [], suggestions: [] };
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    const parsed = safeJson(text, null);
    if (!parsed) {
      return { status: "skipped", reason: "Agent returned invalid JSON", issues: [], suggestions: [] };
    }
    return {
      status: parsed.status || "approved",
      score: Number(parsed.score) || 7,
      summary: parsed.summary || "",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      reviewedAt: nowIso()
    };
  } catch (err) {
    return { status: "skipped", reason: `Agent error: ${err.message}`, issues: [], suggestions: [] };
  }
}

async function runNutritionistAgent(env, intake, plan) {
  const systemPrompt = `You are a registered sports nutritionist reviewing an AI-generated fitness coaching plan.
Your job is to validate the nutrition section ONLY — macros, calories, meal options, and diet structure.
Focus on: calorie target vs goal and body weight, protein adequacy (minimum 1.6g/kg for muscle, 1.2g/kg for fat loss),
meal variety and cuisine alignment with client preferences, food allergies respected, meal frequency matching client preference,
any dangerous deficits (under 1200 kcal for women, under 1500 kcal for men).
Be specific and constructive. Score 1-10 where 10 is perfect.
Status rules: approved = no serious issues, needs_attention = minor fixes needed, flagged = serious nutritional problem.`;
  return callGeminiAgent(env, "nutritionist", systemPrompt, plan, intake);
}

async function runFitnessExpertAgent(env, intake, plan) {
  const systemPrompt = `You are a certified strength and conditioning coach (NSCA/NASM level) reviewing an AI-generated fitness plan.
Your job is to validate the workout section ONLY — exercise selection, training split, volume, and safety.
Focus on: training days matching client availability, exercise selection appropriate for gym access stated,
all injuries and movement restrictions fully respected, volume appropriate for experience level (beginner vs advanced),
compound vs isolation balance, rest day placement, warm-up and cool-down included.
Be specific and constructive. Score 1-10 where 10 is perfect.
Status rules: approved = no serious issues, needs_attention = minor fixes needed, flagged = unsafe or inappropriate plan.`;
  return callGeminiAgent(env, "fitnessExpert", systemPrompt, plan, intake);
}

async function runSportsScientistAgent(env, intake, plan) {
  const systemPrompt = `You are a sports scientist specialising in evidence-based training programme design.
Your job is to validate the overall structure of this fitness plan — periodisation, progressive overload, and recovery science.
Focus on: progressive overload protocol present (weekly load increases), periodisation structure (linear, undulating, or block),
deload weeks recommended for plans over 4 weeks, recovery days adequate relative to intensity,
milestones are measurable and realistic, success rules are evidence-based not anecdotal,
overall plan coherence — nutrition and training aligned toward the same goal.
Be specific and constructive. Score 1-10 where 10 is perfect.
Status rules: approved = well-structured evidence-based plan, needs_attention = missing some science principles, flagged = poor structure that will limit results.`;
  return callGeminiAgent(env, "sportsScientist", systemPrompt, plan, intake);
}

async function runAgentPipeline(env, intake, plan) {
  // Run sequentially to avoid rate limits on free Gemini tier
  const nutritionist = await runNutritionistAgent(env, intake, plan);
  const fitnessExpert = await runFitnessExpertAgent(env, intake, plan);
  const sportsScientist = await runSportsScientistAgent(env, intake, plan);
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

async function generatePlanFromIntake(env, intake, progressContext = {}) {
  if (!env.GEMINI_API_KEY) {
    return fallbackPlanFromIntake(intake, {
      source: "fallback",
      reason: "GEMINI_API_KEY is not configured.",
      generatedAt: nowIso()
    });
  }

  const prompt = [
    "You are generating a fitness coaching plan.",
    "Return JSON only.",
    "For each meal in mealOptions, provide 6 or 7 practical varieties.",
    "Each meal option list should mean the client chooses any 1 option for that meal, not all options together.",
    "Make the food options cuisine-aware and realistic for daily repetition.",
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
      workoutSplit: [{ day: "Day 1", exercises: ["exercise"] }],
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
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

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
  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
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
    workoutSplit: Array.isArray(plan.workoutSplit) ? plan.workoutSplit : [],
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

function clean(value) {
  return String(value || "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function safeJson(value, fallback) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
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
  return flags;
}

function daysSinceDate(value) {
  if (!value) return Infinity;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Infinity;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
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
