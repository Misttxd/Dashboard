"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import { buttonVariants } from "./ui";

/**
 * Triggers a provider sync and refreshes the server components on success.
 * Errors surface inline and stay put — a failing integration is never silent,
 * and the message names the problem rather than "something went wrong".
 */
export function SyncButton({
  provider,
  label,
  disabled,
  disabledReason,
}: {
  provider: string;
  label?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const working = busy || pending;

  async function sync() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/sync/${provider}`, { method: "POST" });
      const body = (await res.json()) as { records?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? `Sync failed (${res.status})`);
      setOk(`${body.records ?? 0} records`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <span className="text-xs text-fg-faint" title={disabledReason}>
        {disabledReason ?? "Not configured"}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={sync}
        disabled={working}
        className={`${buttonVariants.secondary} px-3 py-1.5 text-xs`}
      >
        <RefreshCw
          size={13}
          aria-hidden="true"
          className={working ? "animate-spin" : ""}
        />
        {working ? "Syncing…" : (label ?? "Sync")}
      </button>

      {ok && (
        <span className="flex items-center gap-1 text-2xs text-[var(--color-pos)]">
          <Check size={11} aria-hidden="true" />
          {ok}
        </span>
      )}
      {error && (
        <span
          role="alert"
          className="flex max-w-[22rem] items-start gap-1 text-right text-2xs leading-relaxed text-[var(--color-neg)]"
        >
          <TriangleAlert size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}
