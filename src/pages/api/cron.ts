export const prerender = false;

/**
 * Cloudflare Workers Scheduled Handler (Cron Trigger)
 *
 * Runs automatically at: 06:00, 12:00, 18:00 UTC (configured in wrangler.json)
 *
 * To trigger manually: GET /api/cron?secret=<CRON_SECRET>
 */

import type { APIRoute } from "astro";

interface CronEnv {
  RESEND_API_KEY?: string;
  OWNER_EMAIL?: string;
  CRON_SECRET?: string;
}

interface Edital {
  titulo: string;
  url: string;
  fonte: string;
  publicado: string;
  status: string;
}

const SOURCES = [
  { name: "Detran SP", url: "https://www.detran.sp.gov.br" },
  { name: "Detran RJ", url: "https://www.detran.rj.gov.br" },
  { name: "Concursos BR", url: "https://www.concursosnobrasil.com.br/concursos/busca/?q=habilitacao+detran" },
  { name: "PCI Concursos", url: "https://www.pciconcursos.com.br/concursos/nacional/todos/detran" },
];

const KEYWORDS = ["edital", "habilitação", "habilitacao", "concurso", "credenciamento", "cfc", "cnh"];

async function fetchSource(name: string, url: string): Promise<Edital[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "FabioAI-Monitor/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    const lowerHtml = html.toLowerCase();

    if (!KEYWORDS.some((kw) => lowerHtml.includes(kw))) return [];

    const linkRx = /<a[^>]+href="([^"]*)"[^>]*>([^<]{10,200})<\/a>/gi;
    const editais: Edital[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkRx.exec(html)) !== null && editais.length < 3) {
      const text = m[2]?.trim() ?? "";
      if (KEYWORDS.some((kw) => text.toLowerCase().includes(kw))) {
        editais.push({
          titulo: text,
          url: m[1]?.startsWith("http") ? m[1] : new URL(m[1] ?? "/", url).href,
          fonte: name,
          publicado: new Date().toLocaleDateString("pt-BR"),
          status: "ativo",
        });
      }
    }
    return editais;
  } catch {
    return [];
  }
}

async function buildDailySummaryHtml(
  editais: Edital[],
  tasksCount: number,
  ownerName: string
): Promise<string> {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const editaisHtml =
    editais.length > 0
      ? editais
          .map(
            (e) =>
              `<div style="padding:10px;border-left:3px solid #2563eb;margin:8px 0;background:#f0f9ff;border-radius:0 6px 6px 0;">
            <strong style="color:#1e293b;">${e.titulo}</strong><br/>
            <span style="color:#64748b;font-size:13px;">📍 ${e.fonte} · ${e.publicado}</span><br/>
            <a href="${e.url}" style="color:#2563eb;font-size:13px;">Ver edital →</a>
          </div>`
          )
          .join("")
      : `<p style="color:#64748b;font-style:italic;">Nenhum novo edital encontrado hoje.</p>`;

  return `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#1e40af,#065f46);padding:28px 24px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:20px;">🤖 FabioAI – Resumo Diário</h1>
        <p style="color:#bfdbfe;margin:6px 0 0;font-size:13px;">${hoje}</p>
      </div>
      <div style="background:white;padding:28px 24px;border-radius:0 0 12px 12px;">
        <h2 style="color:#0f172a;font-size:18px;">Bom dia, ${ownerName}! ☀️</h2>
        <p style="color:#475569;">Aqui está o resumo do seu dia:</p>

        <div style="display:flex;gap:12px;margin:16px 0;">
          <div style="flex:1;padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#059669;">${editais.length}</div>
            <div style="font-size:12px;color:#064e3b;">Editais encontrados</div>
          </div>
          <div style="flex:1;padding:16px;background:#eff6ff;border-radius:8px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#2563eb;">${tasksCount}</div>
            <div style="font-size:12px;color:#1e40af;">Tarefas para hoje</div>
          </div>
          <div style="flex:1;padding:16px;background:#fff7ed;border-radius:8px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#d97706;">3x</div>
            <div style="font-size:12px;color:#92400e;">Verificações hoje</div>
          </div>
        </div>

        <h3 style="color:#0f172a;margin-top:24px;">📋 Editais de Hoje</h3>
        ${editaisHtml}

        <h3 style="color:#0f172a;margin-top:24px;">✅ Sugestão de Tarefas</h3>
        <ul style="color:#475569;font-size:14px;line-height:2;">
          <li>🔍 Verificar novos editais do Detran</li>
          <li>📚 Estudar Legislação de Trânsito (30 min)</li>
          <li>📧 Responder e-mails pendentes</li>
          <li>📊 Revisar insights de negócios do dia</li>
        </ul>

        <div style="margin-top:24px;padding:16px;background:#fef3c7;border-radius:8px;">
          <p style="margin:0;font-size:13px;color:#92400e;">
            ⏰ Lembre-se: inscrições para o Concurso Detran MG encerram em breve!
          </p>
        </div>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
        <p style="color:#94a3b8;font-size:11px;text-align:center;margin:0;">
          FabioAI Assistente Pessoal · ${new Date().toLocaleString("pt-BR")}
        </p>
      </div>
    </div>
  `;
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: CronEnv } }).runtime?.env ?? {};
  const cronSecret = env["CRON_SECRET"] ?? "";
  const url = new URL(request.url);
  const providedSecret = url.searchParams.get("secret");

  if (cronSecret && providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resendKey = env["RESEND_API_KEY"] ?? "";
  const ownerEmail = env["OWNER_EMAIL"] ?? "kleinschmittfabio84@gmail.com";

  const results = await Promise.allSettled(
    SOURCES.map((s) => fetchSource(s.name, s.url))
  );

  const allEditais: Edital[] = [];
  results.forEach((r) => {
    if (r.status === "fulfilled") allEditais.push(...r.value);
  });

  const isEarlyMorning = new Date().getUTCHours() === 6;

  let emailSent = false;
  if (resendKey) {
    const assunto = isEarlyMorning
      ? `☀️ Resumo diário – FabioAI (${new Date().toLocaleDateString("pt-BR")})`
      : allEditais.length > 0
      ? `🎉 ${allEditais.length} novo(s) edital(is) encontrado(s) – FabioAI`
      : null;

    if (assunto) {
      const html = isEarlyMorning
        ? await buildDailySummaryHtml(allEditais, 5, "Fabio")
        : `<div style="font-family:sans-serif;padding:24px;">
            <h2>🎉 Novos editais encontrados!</h2>
            ${allEditais.map((e) => `<p><strong>${e.titulo}</strong><br/>${e.fonte} · <a href="${e.url}">Ver →</a></p>`).join("")}
          </div>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "FabioAI <noreply@fabioai.dev>",
          to: [ownerEmail],
          subject: assunto,
          html,
        }),
      });
      emailSent = res.ok;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      sourcesChecked: SOURCES.length,
      editaisFound: allEditais.length,
      emailSent,
      emailConfigured: !!resendKey,
      editais: allEditais,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
