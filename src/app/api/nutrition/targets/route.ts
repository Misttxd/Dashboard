import { NextResponse } from "next/server";
import { z } from "zod";
import { setSettingJson } from "@/lib/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  kcal: z.number().positive().nullable(),
  protein: z.number().positive().nullable(),
  carbs: z.number().positive().nullable(),
  fat: z.number().positive().nullable(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid targets" }, { status: 400 });
  }

  setSettingJson("nutrition:targets", parsed.data);
  return NextResponse.json({ ok: true });
}
