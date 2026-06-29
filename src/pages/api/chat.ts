export const prerender = false;

import type { APIRoute } from "astro";

type MsgContent = string | Array<Record<string, unknown>>;

interface ChatMessage {
  role: "user" | "assistant";
  content: MsgContent;
}

interface ChatRequest {
  message: string;
  image?: string | null;
  history?: ChatMessage[];
}

interface ChatResponse {
  response?: string;
  error?: string;
  info?: string;
}

const SYSTEM_PROMPT = `Você é FabioAI, o assistente de inteligência artificial pessoal e exclusivo de Fabio Kleinschmitt.

MODO: Assistente de Voz e Visão em tempo real — o Fabio pode te mostrar a câmera e falar com você.

PERFIL DO FABIO:
- Estuda para CNH/habilitação e acompanha editais do Detran
- Busca oportunidades de negócio em transporte e logística
- E-mail: kleinschmittfabio84@gmail.com — Brasil

REGRAS DE RESPOSTA:
- Sempre em português brasileiro natural, como um amigo próximo
- Respostas MUITO CURTAS (máximo 2-3 frases) — serão lidas em voz alta
- Chame sempre pelo nome "Fabio"
- Se receber imagem da câmera, comente o que vê de forma natural e empática
- Seja proativo, bem-humorado e direto
- Para assuntos complexos, responda resumidamente e ofereça continuar`;

export const POST: APIRoute = async ({ request, locals }) => {
  const env =
    (locals as { runtime?: { env?: Record<string, string> } }).runtime?.env ??
    {};
  const apiKey = env["ANTHROPIC_API_KEY"] ?? "";

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "ANTHROPIC_API_KEY não configurada. Adicione sua chave Anthropic nas variáveis de ambiente do Cloudflare Workers para ativar a IA.",
        info: "Acesse: Cloudflare Dashboard → Workers → Settings → Environment Variables",
      } satisfies ChatResponse),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return new Response(
      JSON.stringify({ error: "Payload inválido" } satisfies ChatResponse),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { message, image, history = [] } = body;

  const userContent: MsgContent = image
    ? [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: image,
          },
        },
        { type: "text", text: message || "O que você vê?" },
      ]
    : message;

  const messages: ChatMessage[] = [
    ...history.slice(-14),
    { role: "user", content: userContent },
  ];

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } };
      return new Response(
        JSON.stringify({
          error: err.error?.message ?? `Erro ${res.status} na API`,
        } satisfies ChatResponse),
        { status: res.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text: string }>;
    };
    const text =
      data.content?.find((c) => c.type === "text")?.text ??
      "Desculpe, não consegui processar.";

    return new Response(
      JSON.stringify({ response: text } satisfies ChatResponse),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: `Erro de conexão: ${String(err)}`,
      } satisfies ChatResponse),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ error: "Use POST /api/chat" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
