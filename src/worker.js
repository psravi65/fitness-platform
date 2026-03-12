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
        COALESCE((SELECT status FROM plans WHERE client_id = clients.id ORDER BY updated_at DESC LIMIT 1), 'none') AS plan_status
      FROM clients
      LEFT JOIN users ON users.client_id = clients.id
      ORDER BY clients.created_at DESC
    `).all();
    return json({ clients: rows.results || [] });
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

  const generatePlanMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/generate-plan$/);
  if (generatePlanMatch && method === "POST") {
    assertRole(session, "admin");
    const clientId = generatePlanMatch[1];
    const intake = await getLatestIntake(env, clientId);
    if (!intake) return json({ error: "Client intake is required before generating a plan." }, 400);
    const normalized = await generatePlanFromIntake(env, intake.answers_json);
    await saveDraftPlan(env, clientId, intake.id, normalized);
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
    const body = await readJson(request);
    await upsertIntake(env, session.user.client_id, body.answers || {}, body.complete);
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
  return { client, user, intake, plan, dailyLogs, checkins };
}

async function getClientBootstrap(env, clientId) {
  const client = await env.DB.prepare(`SELECT * FROM clients WHERE id = ?`).bind(clientId).first();
  const intake = await getLatestIntake(env, clientId);
  const plan = await getPublishedPlan(env, clientId);
  const today = new Date().toISOString().slice(0, 10);
  const dailyLog = await env.DB.prepare(`SELECT * FROM daily_logs WHERE client_id = ? AND log_date = ?`).bind(clientId, today).first();
  const weeklyReview = await env.DB.prepare(`SELECT * FROM weekly_reviews WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1`).bind(clientId).first();
  return {
    client,
    intake,
    plan,
    dailyLog: parseStoredJsonRow(dailyLog),
    weeklyReview: parseStoredJsonRow(weeklyReview),
    checkins: await selectJsonRows(env, `SELECT * FROM checkins WHERE client_id = ? ORDER BY checkin_date DESC LIMIT 10`, [clientId])
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
  return {
    ...row,
    generated_json: generated,
    edited_json: edited,
    effectivePlan: edited || generated
  };
}

async function saveDraftPlan(env, clientId, intakeId, generatedPlan) {
  const existing = await getLatestPlan(env, clientId);
  const payload = JSON.stringify(generatedPlan);
  if (existing) {
    await env.DB.prepare(`
      UPDATE plans
      SET status = 'draft', source_intake_id = ?, generated_json = ?, edited_json = NULL, published_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(intakeId, payload, existing.id).run();
    return existing.id;
  }
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO plans (id, client_id, status, source_intake_id, generated_json)
    VALUES (?, ?, 'draft', ?, ?)
  `).bind(id, clientId, intakeId, payload).run();
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

async function generatePlanFromIntake(env, intake) {
  if (!env.GEMINI_API_KEY) {
    return fallbackPlanFromIntake(intake);
  }

  const prompt = [
    "You are generating a fitness coaching plan.",
    "Return JSON only.",
    "Use this exact shape:",
    JSON.stringify({
      profileSummary: "string",
      calorieTarget: "string",
      macros: { protein: "string", carbs: "string", fat: "string" },
      mealOptions: [{ meal: "Breakfast", options: ["opt1", "opt2"] }],
      weeklyMealStructure: ["Mon - ..."],
      supplements: ["item"],
      workoutSplit: [{ day: "Day 1", exercises: ["exercise"] }],
      progressMilestones: ["milestone"],
      successRules: ["rule"],
      cautions: ["caution"]
    }),
    "Base the plan on this intake JSON:",
    JSON.stringify(intake)
  ].join("\n");

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || "gemini-2.0-flash"}:generateContent?key=${env.GEMINI_API_KEY}`;
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
    return fallbackPlanFromIntake(intake);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
  const parsed = safeJson(text, null);
  if (!parsed || typeof parsed !== "object") {
    return fallbackPlanFromIntake(intake);
  }
  return normalizePlan(parsed, intake);
}

function fallbackPlanFromIntake(intake) {
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
      { meal: "Breakfast", options: ["Protein-rich breakfast", "Eggs / yogurt / oats rotation"] },
      { meal: "Lunch", options: ["Main protein + carb + vegetables", "Cuisine-specific balanced plate"] },
      { meal: "Dinner", options: ["Lean protein + vegetables", "Lighter carb focus post-workout"] }
    ],
    weeklyMealStructure: ["Follow 3 structured meals daily and repeat high-protein options through the week."],
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
  }, intake);
}

function normalizePlan(plan, intake) {
  return {
    profileSummary: plan.profileSummary || "Structured coaching plan generated from intake.",
    calorieTarget: plan.calorieTarget || "Coach review required",
    macros: {
      protein: plan.macros?.protein || "",
      carbs: plan.macros?.carbs || "",
      fat: plan.macros?.fat || ""
    },
    mealOptions: Array.isArray(plan.mealOptions) ? plan.mealOptions : [],
    weeklyMealStructure: Array.isArray(plan.weeklyMealStructure) ? plan.weeklyMealStructure : [],
    supplements: Array.isArray(plan.supplements) ? plan.supplements : [],
    workoutSplit: Array.isArray(plan.workoutSplit) ? plan.workoutSplit : [],
    progressMilestones: Array.isArray(plan.progressMilestones) ? plan.progressMilestones : [],
    successRules: Array.isArray(plan.successRules) ? plan.successRules : [],
    cautions: Array.isArray(plan.cautions) ? plan.cautions : [],
    intakeSnapshot: intake
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
  for (const key of ["answers_json", "generated_json", "edited_json", "meals_json", "workout_json", "macros_json", "review_json"]) {
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
