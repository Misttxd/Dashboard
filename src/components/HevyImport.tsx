"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, TriangleAlert, Upload } from "lucide-react";
import { buttonVariants } from "./ui";

interface Result {
  workouts: number;
  sets: number;
  warnings: string[];
}

export function HevyImport() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // Sent as raw text rather than multipart: it's a plain CSV, and this
      // keeps the route handler trivial.
      const res = await fetch("/api/hevy/import", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: await file.text(),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Import failed (${res.status})`);
      setResult(body as Result);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <label
        className={`${buttonVariants.secondary} cursor-pointer ${busy ? "pointer-events-none opacity-45" : ""}`}
      >
        <Upload size={14} aria-hidden="true" />
        {busy ? "Importing…" : "Choose CSV file"}
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </label>

      {result && (
        <div className="mt-3.5">
          <p className="flex items-center gap-1.5 text-sm text-[var(--color-pos)]">
            <Check size={14} aria-hidden="true" />
            Imported {result.workouts} workouts and {result.sets} sets.
          </p>
          {result.warnings.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-[var(--color-warn)]">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3.5 flex items-start gap-1.5 text-sm leading-relaxed text-[var(--color-neg)]"
        >
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
