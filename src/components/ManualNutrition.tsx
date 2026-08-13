"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, TriangleAlert } from "lucide-react";
import { buttonVariants, fieldClass } from "./ui";

interface Targets {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function Field({
  label,
  suffix,
  ...props
}: { label: string; suffix?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-fg-subtle">{label}</span>
      <div className="relative">
        <input className={`${fieldClass} ${suffix ? "pr-9" : ""}`} {...props} />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-fg-faint">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

/**
 * Manual day entry and macro targets.
 *
 * A day saved here is marked source='manual', which the Kalorické tabulky sync
 * refuses to overwrite — hand-entered data always wins.
 */
export function ManualNutrition({ targets }: { targets: Targets }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [day, setDay] = useState(today());
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [weight, setWeight] = useState("");

  const [t, setT] = useState({
    kcal: targets.kcal?.toString() ?? "",
    protein: targets.protein?.toString() ?? "",
    carbs: targets.carbs?.toString() ?? "",
    fat: targets.fat?.toString() ?? "",
  });

  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: unknown, okMsg: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      setMsg(okMsg);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div className="space-y-8">
      <div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Field label="Date" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          <Field
            label="Calories"
            type="number"
            inputMode="numeric"
            placeholder="2400"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
          <Field
            label="Protein"
            suffix="g"
            type="number"
            placeholder="180"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
          <Field
            label="Carbs"
            suffix="g"
            type="number"
            placeholder="250"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
          <Field
            label="Fat"
            suffix="g"
            type="number"
            placeholder="70"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
          <Field
            label="Weight"
            suffix="kg"
            type="number"
            step="0.1"
            placeholder="82.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>

        <button
          disabled={busy}
          onClick={() =>
            post(
              "/api/nutrition/day",
              {
                day,
                calories_kcal: num(kcal),
                protein_g: num(protein),
                carbs_g: num(carbs),
                fat_g: num(fat),
                weight_kg: num(weight),
              },
              "Day saved.",
            )
          }
          className={`${buttonVariants.primary} mt-4`}
        >
          Save day
        </button>
      </div>

      <div className="border-t border-line pt-7">
        <h3 className="mb-4 text-sm font-medium text-fg">Daily targets</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field
            label="Calories"
            type="number"
            value={t.kcal}
            onChange={(e) => setT({ ...t, kcal: e.target.value })}
          />
          <Field
            label="Protein"
            suffix="g"
            type="number"
            value={t.protein}
            onChange={(e) => setT({ ...t, protein: e.target.value })}
          />
          <Field
            label="Carbs"
            suffix="g"
            type="number"
            value={t.carbs}
            onChange={(e) => setT({ ...t, carbs: e.target.value })}
          />
          <Field
            label="Fat"
            suffix="g"
            type="number"
            value={t.fat}
            onChange={(e) => setT({ ...t, fat: e.target.value })}
          />
        </div>

        <button
          disabled={busy}
          onClick={() =>
            post(
              "/api/nutrition/targets",
              {
                kcal: num(t.kcal),
                protein: num(t.protein),
                carbs: num(t.carbs),
                fat: num(t.fat),
              },
              "Targets saved.",
            )
          }
          className={`${buttonVariants.secondary} mt-4`}
        >
          Save targets
        </button>
      </div>

      {msg && (
        <p className="flex items-center gap-1.5 text-sm text-[var(--color-pos)]">
          <Check size={14} aria-hidden="true" />
          {msg}
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-[var(--color-neg)]">
          <TriangleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
