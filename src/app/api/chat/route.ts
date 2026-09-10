import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { LEXIO_SYSTEM_PROMPT } from "@/lib/lexio-prompt";

const anthropic = new Anthropic();

// GET /api/chat — Chat-Verlauf laden
export async function GET() {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/chat — Nachricht senden + Claude-Antwort streamen
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const { content } = body;

  if (!content) return badRequest("Pflichtfeld: content");

  const { error: userMsgError } = await supabase.from("chat_messages").insert({
    tenant_id: tenantId,
    created_by: user.id,
    role: "user",
    content,
  });

  if (userMsgError) {
    return NextResponse.json({ error: userMsgError.message }, { status: 500 });
  }

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(50);

  const messages: Anthropic.MessageParam[] = (history ?? []).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system: LEXIO_SYSTEM_PROMPT,
    messages,
  });

  const encoder = new TextEncoder();
  let fullResponse = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        await supabase.from("chat_messages").insert({
          tenant_id: tenantId,
          created_by: user.id,
          role: "assistant",
          content: fullResponse,
        });

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Claude API Fehler";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// DELETE /api/chat — Chat-Verlauf soft-löschen
export async function DELETE() {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { error } = await supabase
    .from("chat_messages")
    .update({ deleted_at: new Date().toISOString() })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
