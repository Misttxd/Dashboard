import { PageHeader } from "@/components/ui";
import { CoachChat } from "@/components/CoachChat";
import { coachAvailable } from "@/lib/ai/coach";
import { env } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function CoachPage() {
  const enabled = coachAvailable();

  return (
    <div className="settle">
      <PageHeader
        title="Coach"
        subtitle={
          enabled
            ? "Reads your actual numbers before answering. Read-only — it can't change data or place a trade."
            : "Not configured yet."
        }
        domain="coach"
        action={
          enabled ? (
            <span className="nums font-mono text-2xs tabular-nums text-fg-faint">
              {env.anthropic.model}
            </span>
          ) : undefined
        }
      />
      <CoachChat enabled={enabled} />
    </div>
  );
}
