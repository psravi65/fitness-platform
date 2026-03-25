const ICON_192 = "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";
const ICON_512 = "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";

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/manifest.json") {
        return new Response(JSON.stringify({
          name: "GymLog",
          short_name: "GymLog",
          description: "Your personal fitness coaching app",
          start_url: "/",
          display: "standalone",
          background_color: "#0d0d0d",
          theme_color: "#FF5C28",
          orientation: "portrait-primary",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
          ]
        }), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" } });
      }

      if (url.pathname === "/icon-192.png" || url.pathname === "/icon-512.png") {
        const b64 = url.pathname.includes("512") ? ICON_512 : ICON_192;
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Response(bytes.buffer, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
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
    const username = clean(body.username);
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
    const totalClients = await env.DB.prepare(`SELECT COUNT(*) AS count FROM clients`).first();
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
    const gymName = clean(body.gymName);
    const ownerName = clean(body.ownerName);
    const email = clean(body.email);
    const phone = clean(body.phone || "");
    const city = clean(body.city || "");
    const adminUsername = clean(body.adminUsername);
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
      WHERE clients.gym_id = ? ORDER BY clients.created_at DESC
    `).bind(gymId).all();
    const admin = await env.DB.prepare(`SELECT id, username FROM users WHERE gym_id = ? AND role = 'admin' LIMIT 1`).bind(gymId).first();
    const unassignedRow = await env.DB.prepare(`SELECT COUNT(*) AS count FROM clients WHERE gym_id IS NULL`).first();
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
    const unassigned = await env.DB.prepare(`SELECT COUNT(*) AS count FROM clients WHERE gym_id IS NULL`).first();
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
        (SELECT COUNT(*) FROM clients) AS total_clients,
        (SELECT COUNT(*) FROM plans WHERE status = 'published') AS active_plans,
        (SELECT COUNT(*) FROM daily_logs WHERE date(updated_at) = date('now')) AS logs_today
    `).first();
    return json({ stats });
  }

  if (url.pathname === "/api/admin/clients/all-for-household" && method === "GET") {
    assertRole(session, "admin");
    const gymId = getGymId(session);
    const rows = gymId
      ? await env.DB.prepare(`SELECT clients.id, clients.full_name, clients.household_id, users.username FROM clients LEFT JOIN users ON users.client_id = clients.id WHERE clients.gym_id = ? ORDER BY clients.full_name ASC`).bind(gymId).all()
      : await env.DB.prepare(`SELECT clients.id, clients.full_name, clients.household_id, users.username FROM clients LEFT JOIN users ON users.client_id = clients.id ORDER BY clients.full_name ASC`).all();
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
      ${gymId ? "WHERE clients.gym_id = ?" : ""}
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
    const fullName = clean(body.fullName);
    const username = clean(body.username);
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

  const householdMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/household$/);
  if (householdMatch && method === "POST") {
    assertRole(session, "admin");
    const body = await readJson(request);
    const clientId = householdMatch[1];
    if (body.householdId) {
      const householdId = body.householdId === "new" ? crypto.randomUUID() : body.householdId;
      await env.DB.prepare(`UPDATE clients SET household_id = ? WHERE id = ?`).bind(householdId, clientId).run();
      // If baseMealsOn is set, store it — this client's plan will be used as meal reference
      if (body.baseMealsOn) {
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

    // ── Household context: find reference member's plan if household exists
    const householdContext = await getHouseholdContext(env, clientId);

    const normalized = await generatePlanFromIntake(env, intake.answers_json, progressContext, householdContext);
    const draftReviews = await runAgentPipeline(env, intake.answers_json, normalized, householdContext);
    const finalPlan = await refinePlanWithAgentFeedback(env, intake.answers_json, normalized, draftReviews, progressContext, householdContext);
    const finalReviews = await runAgentPipeline(env, intake.answers_json, finalPlan, householdContext);
    finalReviews.refinedFrom = draftReviews;
    if (householdContext) finalReviews.householdAware = true;
    await saveDraftPlan(env, clientId, intake.id, finalPlan, finalReviews);
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

async function getAdminClientDetail(env, clientId) {
  const client = await env.DB.prepare(`SELECT * FROM clients WHERE id = ? LIMIT 1`).bind(clientId).first();
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
    WHERE clients.household_id = ? AND clients.id != ?
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
      WHERE household_id = ? AND id != ?
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
    WHERE (household_id = ? OR household_id = ?) AND id != ?
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

async function callGeminiAgent(env, agentName, systemPrompt, planJson, intakeJson, householdContext = null) {
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
  parts.push(
    "INTAKE DATA:",
    JSON.stringify(intakeJson),
    "GENERATED PLAN TO REVIEW:",
    JSON.stringify(planJson),
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

async function runNutritionistAgent(env, intake, plan, householdContext = null) {
  const householdExtra = householdContext
    ? `\nHOUSEHOLD RULE: This client shares all meals with ${householdContext.memberName}. Meal DISHES must be IDENTICAL to the household reference plan. Macro values should be proportionally scaled to this client's calorie target. Flag ANY dish mismatch as a critical issue.`
    : "";
  const systemPrompt = `You are a registered sports nutritionist reviewing an AI-generated fitness coaching plan.
Your job is to validate the nutrition section ONLY — macros, calories, meal options, and diet structure.
Focus on: calorie target vs goal and body weight, protein adequacy (minimum 1.6g/kg for muscle, 1.2g/kg for fat loss),
meal variety and cuisine alignment with client preferences, food allergies respected, meal frequency matching client preference,
any dangerous deficits (under 1200 kcal for women, under 1500 kcal for men).
Be specific and constructive. Score 1-10 where 10 is perfect.
Status rules: approved = no serious issues, needs_attention = minor fixes needed, flagged = serious nutritional problem.${householdExtra}`;
  return callGeminiAgent(env, "nutritionist", systemPrompt, plan, intake, householdContext);
}

async function runFitnessExpertAgent(env, intake, plan, householdContext = null) {
  const systemPrompt = `You are a certified strength and conditioning coach (NSCA/NASM level) reviewing an AI-generated fitness plan.
Your job is to validate the workout section ONLY — exercise selection, training split, volume, and safety.
Focus on: training days matching client availability, exercise selection appropriate for gym access stated,
all injuries and movement restrictions fully respected, volume appropriate for experience level (beginner vs advanced),
compound vs isolation balance, rest day placement, warm-up and cool-down included.
Be specific and constructive. Score 1-10 where 10 is perfect.
Status rules: approved = no serious issues, needs_attention = minor fixes needed, flagged = unsafe or inappropriate plan.`;
  return callGeminiAgent(env, "fitnessExpert", systemPrompt, plan, intake, null);
}

async function runSportsScientistAgent(env, intake, plan, householdContext = null) {
  const systemPrompt = `You are a sports scientist specialising in evidence-based training programme design.
Your job is to validate the overall structure of this fitness plan — periodisation, progressive overload, and recovery science.
Focus on: progressive overload protocol present (weekly load increases), periodisation structure (linear, undulating, or block),
deload weeks recommended for plans over 4 weeks, recovery days adequate relative to intensity,
milestones are measurable and realistic, success rules are evidence-based not anecdotal,
overall plan coherence — nutrition and training aligned toward the same goal.
Be specific and constructive. Score 1-10 where 10 is perfect.
Status rules: approved = well-structured evidence-based plan, needs_attention = missing some science principles, flagged = poor structure that will limit results.`;
  return callGeminiAgent(env, "sportsScientist", systemPrompt, plan, intake, null);
}


async function runAgentPipeline(env, intake, plan, householdContext = null) {
  // Run sequentially to avoid rate limits on free Gemini tier
  const nutritionist = await runNutritionistAgent(env, intake, plan, householdContext);
  const fitnessExpert = await runFitnessExpertAgent(env, intake, plan, null);
  const sportsScientist = await runSportsScientistAgent(env, intake, plan, null);
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
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    if (!res.ok) return plan;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    const parsed = safeJson(text, null);
    if (!parsed || typeof parsed !== "object") return plan;
    return normalizePlan(parsed, intake, {
      source: "gemini-refined",
      reason: "Plan refined with agent feedback.",
      model: env.GEMINI_MODEL || "gemini-2.5-flash",
      generatedAt: nowIso(),
      issuesAddressed: totalIssues
    });
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
        from: 'GymLog Coaching <onboarding@gymlog.app>', // Update with your domain later
        to: email,
        subject: 'Welcome to GymLog! Your Access Details',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to the team, ${fullName}! 💪</h2>
            <p>Your coach has set up your private GymLog dashboard.</p>
            <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Login URL:</strong> https://your-cloudflare-domain.workers.dev</p>
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
