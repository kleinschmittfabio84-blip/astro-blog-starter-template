export const prerender = false;

import type { APIRoute } from "astro";

interface Edital {
  titulo: string;
  url: string;
  fonte: string;
  publicado: string;
  prazoInscricao?: string;
  dataProva?: string;
  status: "novo" | "ativo" | "encerrado";
}

interface CheckResult {
  success: boolean;
  found: number;
  sources: number;
  novos: number;
  editais: Edital[];
  checkedAt: string;
  error?: string;
}

const KEYWORDS = [
  "edital", "habilitação", "habilitacao", "concurso", "credenciamento",
  "cfc", "centro de formação", "motorista", "cnh", "detran",
];

function extractEditais(html: string, sourceName: string, sourceUrl: string): Edital[] {
  const editais: Edital[] = [];
  const lowerHtml = html.toLowerCase();

  let hasContent = false;
  for (const kw of KEYWORDS) {
    if (lowerHtml.includes(kw)) {
      hasContent = true;
      break;
    }
  }

  if (!hasContent) return editais;

  const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([^<]{5,200})<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1] ?? "";
    const text = match[2]?.trim() ?? "";
    const textLower = text.toLowerCase();

    const isEdital = KEYWORDS.some((kw) => textLower.includes(kw));
    if (!isEdital || text.length < 10) continue;

    const fullUrl = href.startsWith("http")
      ? href
      : href.startsWith("/")
      ? new URL(href, sourceUrl).href
      : sourceUrl;

    editais.push({
      titulo: text,
      url: fullUrl,
      fonte: sourceName,
      publicado: new Date().toLocaleDateString("pt-BR"),
      status: "ativo",
    });

    if (editais.length >= 5) break;
  }

  return editais;
}

async function checkSource(
  name: string,
  url: string,
  env: Record<string, string>
): Promise<Edital[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FabioAI-Monitor/1.0; +https://fabioai.workers.dev)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const html = await response.text();
    return extractEditais(html, name, url);
  } catch {
    return [];
  }
}

async function sendEmailAlert(
  editais: Edital[],
  resendKey: string,
  toEmail: string
): Promise<boolean> {
  if (!resendKey || editais.length === 0) return false;

  const editaisHtml = editais
    .map(
      (e) =>
        `<div style="margin:12px 0;padding:12px;background:#f8fafc;border-left:4px solid #2563eb;border-radius:4px;">
          <strong>${e.titulo}</strong><br/>
          <span style="color:#64748b;font-size:14px;">📍 ${e.fonte} · ${e.publicado}</span><br/>
          <a href="${e.url}" style="color:#2563eb;font-size:14px;">Ver edital →</a>
        </div>`
    )
    .join("");

  const body = {
    from: "FabioAI <noreply@fabioai.dev>",
    to: [toEmail],
    subject: `🎉 ${editais.length} novo(s) edital(is) encontrado(s) – FabioAI`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:linear-gradient(135deg,#1e40af,#065f46);padding:24px;border-radius:12px;margin-bottom:24px;">
          <h1 style="color:white;margin:0;font-size:24px;">🤖 FabioAI</h1>
          <p style="color:#bfdbfe;margin:8px 0 0;">Assistente Pessoal – Alerta de Editais</p>
        </div>
        <h2 style="color:#1e293b;">Novos editais encontrados!</h2>
        <p style="color:#475569;">Fabio, identificamos <strong>${editais.length} novo(s) edital(is)</strong> nas fontes monitoradas:</p>
        ${editaisHtml}
        <div style="margin-top:24px;padding:16px;background:#f0fdf4;border-radius:8px;">
          <p style="color:#166534;margin:0;font-size:14px;">
            ⏰ Verifique os prazos de inscrição e organize-se para não perder nenhuma oportunidade!
          </p>
        </div>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
          Enviado automaticamente pelo FabioAI · <a href="https://fabioai.workers.dev/notificacoes" style="color:#2563eb;">Gerenciar notificações</a>
        </p>
      </div>
    `,
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return res.ok;
}

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, string> } }).runtime?.env ?? {};
  const resendKey = env["RESEND_API_KEY"] ?? "";
  const ownerEmail = env["OWNER_EMAIL"] ?? "kleinschmittfabio84@gmail.com";

  const sources = [
    { name: "Detran SP", url: "https://www.detran.sp.gov.br" },
    { name: "Detran RJ", url: "https://www.detran.rj.gov.br" },
    { name: "Concursos no Brasil", url: "https://www.concursosnobrasil.com.br/concursos/busca/?q=habilitacao+detran" },
    { name: "PCI Concursos", url: "https://www.pciconcursos.com.br/concursos/nacional/todos/detran" },
  ];

  const results = await Promise.allSettled(
    sources.map((s) => checkSource(s.name, s.url, env))
  );

  const allEditais: Edital[] = [];
  results.forEach((r) => {
    if (r.status === "fulfilled") {
      allEditais.push(...r.value);
    }
  });

  const novos = allEditais.filter((e) => e.status === "novo" || e.status === "ativo");

  if (novos.length > 0 && resendKey) {
    await sendEmailAlert(novos, resendKey, ownerEmail);
  }

  const result: CheckResult = {
    success: true,
    found: allEditais.length,
    sources: sources.length,
    novos: novos.length,
    editais: allEditais.slice(0, 10),
    checkedAt: new Date().toISOString(),
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
