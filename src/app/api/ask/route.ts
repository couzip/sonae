import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findByCode } from '@/lib/sonae';
import { buildChatTools, CHAT_SYSTEM_PROMPT } from '@/lib/sonae/chat';
import { getLlm } from '@/lib/sonae/llmRoles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const RequestSchema = z.object({
  municipality_code: z.string(),
  messages: z.array(z.unknown()),
});

const MAX_TOOL_STEPS = 8;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { municipality_code, messages } = parsed.data;

  const muni = findByCode(municipality_code);
  if (!muni) {
    return NextResponse.json(
      { error: 'unknown municipality_code', municipality_code },
      { status: 404 },
    );
  }

  const modelMessages = await convertToModelMessages(messages as UIMessage[]);

  const result = streamText({
    model: getLlm('chat').languageModel,
    system: CHAT_SYSTEM_PROMPT,
    messages: modelMessages,
    tools: buildChatTools({ municipality: muni }),
    stopWhen: stepCountIs(MAX_TOOL_STEPS),
  });

  return result.toUIMessageStreamResponse();
}
