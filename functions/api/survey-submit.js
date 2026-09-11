export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const toText = (v) => (Array.isArray(v) ? JSON.stringify(v) : v ?? null);

  await env.DB.prepare(
    `INSERT INTO submissions
      (submitted_at, name, email, phone, sjvg_interest, jorgenclaw_interest,
       services, service_models, user_type, other_services, follow_up)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      new Date().toISOString(),
      toText(data.name),
      toText(data.email),
      toText(data.phone),
      data.sjvg_interest ? Number(data.sjvg_interest) : null,
      data.jorgenclaw_interest ? Number(data.jorgenclaw_interest) : null,
      toText(data["services[]"] ?? data.services),
      toText(data["service_models[]"] ?? data.service_models),
      toText(data["user_type[]"] ?? data.user_type),
      toText(data.other_services),
      toText(data.follow_up)
    )
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
