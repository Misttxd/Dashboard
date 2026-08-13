import { NextResponse } from "next/server";
import { z } from "zod";
import { askCoach, coachAvailable } from "@/lib/ai/coach";
import { all, get, run } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  message: z.string().min(1).max(8000),
  conversationId: z.number().int().positive().nullable().optional(),
});

interface Row {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  if (!coachAvailable()) {
    return NextResponse.json(
      { error: "No ANTHROPIC_API_KEY set. Add one to .env.local and restart the server." },
      { status: 400 },
    );
  }

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { message } = parsed.data;
  const now = new Date().toISOString();

  // Start a conversation on first message; the title is just the opening line.
  let conversationId = parsed.data.conversationId ?? null;
  if (!conversationId) {
    const res = run(
      "INSERT INTO coach_conversations (title, created_at) VALUES (?, ?)",
      message.slice(0, 80),
      now,
    );
    conversationId = Number(res.lastInsertRowid);
  }

  run(
    "INSERT INTO coach_messages (conversation_id, role, content, created_at) VALUES (?, 'user', ?, ?)",
    conversationId,
    message,
    now,
  );

  // Replay the stored conversation so the coach keeps its context across turns.
  const history = all<Row>(
    "SELECT role, content FROM coach_messages WHERE conversation_id = ? ORDER BY id",
    conversationId,
  );

  try {
    const result = await askCoach(history);

    run(
      `INSERT INTO coach_messages
         (conversation_id, role, content, created_at, input_tokens, output_tokens)
       VALUES (?, 'assistant', ?, ?, ?, ?)`,
      conversationId,
      result.reply,
      new Date().toISOString(),
      result.inputTokens,
      result.outputTokens,
    );

    return NextResponse.json({
      conversationId,
      reply: result.reply,
      toolsUsed: result.toolsUsed,
      usage: { input: result.inputTokens, output: result.outputTokens },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, conversationId }, { status: 500 });
  }
}

/** Latest conversation, so the Coach page can restore where you left off. */
export async function GET() {
  const conversation = get<{ id: number }>(
    "SELECT id FROM coach_conversations ORDER BY id DESC LIMIT 1",
  );

  if (!conversation) return NextResponse.json({ conversationId: null, messages: [] });

  const messages = all<Row>(
    "SELECT role, content FROM coach_messages WHERE conversation_id = ? ORDER BY id",
    conversation.id,
  );

  return NextResponse.json({ conversationId: conversation.id, messages });
}
