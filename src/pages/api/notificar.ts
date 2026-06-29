export const prerender = false;

import type { APIRoute } from "astro";

interface NotifPayload {
  tipo: "email" | "teste" | "alerta" | "resumo";
  para?: string;
  assunto?: string;
  mensagem?: string;
  dados?: Record<string, unknown>;
}

interface NotifResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  info?: string;
}

async function enviarEmail(
  para: string,
  assunto: string,
  htmlBody: string,
  resendKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!resendKey) {
    return {
      success: false,
      error: "RESEND_API_KEY não configurada. Acesse o dashboard do Cloudflare Workers e adicione a variável de ambiente.",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FabioAI <noreply@fabioai.dev>",
        to: [para],
        subject: assunto,
        html: htmlBody,
      }),
    });

    const data = await res.json() as { id?: string; message?: string };

    if (res.ok) {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data.message ?? "Erro ao enviar e-mail" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function buildEmailHtml(assunto: string, mensagem: string, tipo: string): string {
  const emojiMap: Record<string, string> = {
    teste: "🧪",
    alerta: "🚨",
    resumo: "📋",
    email: "📧",
  };
  const emoji = emojiMap[tipo] ?? "📧";

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:0;background:#f8fafc;">
      <div style="background:linear-gradient(135deg,#1e40af,#065f46);padding:32px 24px;border-radius:12px 12px 0 0;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:32px;">🤖</span>
          <div>
            <h1 style="color:white;margin:0;font-size:22px;font-weight:700;">FabioAI</h1>
            <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Assistente Pessoal Inteligente</p>
          </div>
        </div>
      </div>

      <div style="background:white;padding:32px 24px;border-radius:0 0 12px 12px;">
        <h2 style="color:#0f172a;font-size:20px;margin:0 0 16px;">
          ${emoji} ${assunto}
        </h2>
        <div style="color:#475569;font-size:15px;line-height:1.7;white-space:pre-wrap;">${mensagem}</div>

        <div style="margin-top:32px;padding:16px;background:#f0f9ff;border-left:4px solid #2563eb;border-radius:4px;">
          <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">
            💡 Dica: Configure verificações automáticas em
            <a href="/notificacoes" style="color:#2563eb;">Configurações de Notificações</a>
          </p>
        </div>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
          Enviado pelo FabioAI · ${new Date().toLocaleString("pt-BR")} ·
          <a href="/notificacoes" style="color:#2563eb;">Gerenciar preferências</a>
        </p>
      </div>
    </div>
  `;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, string> } }).runtime?.env ?? {};
  const resendKey = env["RESEND_API_KEY"] ?? "";

  let payload: NotifPayload;
  try {
    payload = (await request.json()) as NotifPayload;
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Payload inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const {
    tipo = "email",
    para = "kleinschmittfabio84@gmail.com",
    assunto = "Notificação FabioAI",
    mensagem = "",
  } = payload;

  const html = buildEmailHtml(assunto, mensagem, tipo);
  const result = await enviarEmail(para, assunto, html, resendKey);

  const response: NotifResponse = {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    info: result.success
      ? `E-mail enviado para ${para}`
      : "Configure RESEND_API_KEY nas variáveis de ambiente do Cloudflare Workers",
  };

  return new Response(JSON.stringify(response), {
    status: result.success ? 200 : 422,
    headers: { "Content-Type": "application/json" },
  });
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Método não permitido. Use POST.",
      exemplo: {
        method: "POST",
        body: {
          tipo: "email",
          para: "voce@email.com",
          assunto: "Assunto do e-mail",
          mensagem: "Corpo da mensagem",
        },
      },
    }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
};
