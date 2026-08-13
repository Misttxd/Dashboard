import { NextResponse } from "next/server";
import { z } from "zod";
import { run, tx } from "@/lib/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date"),
  calories_kcal: z.number().nonnegative().nullable().optional(),
  protein_g: z.number().nonnegative().nullable().optional(),
  carbs_g: z.number().nonnegative().nullable().optional(),
  fat_g: z.number().nonnegative().nullable().optional(),
  weight_kg: z.number().positive().nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const b = parsed.data;
  const now = new Date().toISOString();
  const hasMacros =
    b.calories_kcal != null ||
    b.protein_g != null ||
    b.carbs_g != null ||
    b.fat_g != null;

  if (!hasMacros && b.weight_kg == null) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  tx(() => {
    if (hasMacros) {
      // source='manual' is what stops a later Kalorické tabulky sync
      // overwriting a day you entered by hand.
      run(
        `INSERT INTO nutrition_days
           (local_date, source, calories_kcal, protein_g, carbs_g, fat_g, updated_at)
         VALUES (?, 'manual', ?, ?, ?, ?, ?)
         ON CONFLICT(local_date) DO UPDATE SET
           source        = 'manual',
           calories_kcal = excluded.calories_kcal,
           protein_g     = excluded.protein_g,
           carbs_g       = excluded.carbs_g,
           fat_g         = excluded.fat_g,
           updated_at    = excluded.updated_at`,
        b.day,
        b.calories_kcal ?? null,
        b.protein_g ?? null,
        b.carbs_g ?? null,
        b.fat_g ?? null,
        now,
      );
    }

    if (b.weight_kg != null) {
      run(
        `INSERT INTO body_metrics (local_date, weight_kg, source, updated_at)
         VALUES (?, ?, 'manual', ?)
         ON CONFLICT(local_date) DO UPDATE SET
           weight_kg = excluded.weight_kg,
           source = 'manual',
           updated_at = excluded.updated_at`,
        b.day,
        b.weight_kg,
        now,
      );
    }
  });

  return NextResponse.json({ ok: true });
}
