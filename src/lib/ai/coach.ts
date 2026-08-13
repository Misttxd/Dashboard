import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config";
import { getSettingJson } from "../db";
import {
  activeGoals,
  bodyweightSeries,
  dividendTotal,
  exerciseProgress,
  nutritionAverages,
  nutritionDays,
  overview,
  portfolioSeries,
  positions,
  recentActivities,
  recentWorkouts,
  sportTotals,
  topExercises,
  weeklyCardio,
  weeklyVolume,
} from "../queries";
import { todayLocal } from "../util/date";

/**
 * The coach is strictly read-only: every tool below is a SELECT. There is no
 * tool that writes to the database, and nothing here can reach Strava, Hevy,
 * Kalorické tabulky or Trading 212 — it only sees what has already been synced
 * into the local mirror.
 */

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_snapshot",
    description:
      "Overall snapshot: training volume this week, cardio, average calories and protein, latest bodyweight and 30-day change, portfolio value, plus the user's active goals and macro targets. Call this first for any broad question about how things are going.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_gym",
    description:
      "Strength training detail: recent gym sessions with sets and volume, weekly training volume for the last 12 weeks, and the most-trained exercises with their best estimated 1RM. Use for questions about lifting, progress, programming or training load.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_exercise_history",
    description:
      "Session-by-session history for one exercise: best estimated 1RM, best weight and total volume per day. Use when the user asks about a specific lift. Get valid exercise_key values from get_gym first.",
    input_schema: {
      type: "object",
      properties: {
        exercise_key: {
          type: "string",
          description:
            "Normalised exercise name, lowercased (e.g. 'bench press'). Must come from get_gym.",
        },
      },
      required: ["exercise_key"],
    },
  },
  {
    name: "get_cardio",
    description:
      "Cardio from Strava: per-sport totals for the last 90 days, weekly distance and hours for 12 weeks, and recent activities with distance, time and average heart rate.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_nutrition",
    description:
      "Nutrition and bodyweight: daily calories and macros for the last 30 days, 7- and 30-day averages, the user's macro targets, and the bodyweight trend. Use for anything about eating, cutting, bulking or weight.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "How many days of daily detail to return (default 30, max 90).",
        },
      },
      required: [],
    },
  },
  {
    name: "get_finance",
    description:
      "Trading 212 portfolio: current holdings with quantity, average price, current price, value and percentage return; the account snapshot; the portfolio value history; and total dividends received. Read-only — you cannot place trades.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

interface Targets {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

function runTool(name: string, input: Record<string, unknown>): unknown {
  switch (name) {
    case "get_snapshot":
      return {
        today: todayLocal(),
        overview: overview(),
        goals: activeGoals(),
        macro_targets: getSettingJson<Targets>("nutrition:targets", {
          kcal: null,
          protein: null,
          carbs: null,
          fat: null,
        }),
      };

    case "get_gym":
      return {
        recent_workouts: recentWorkouts(15),
        weekly_volume_kg: weeklyVolume(12),
        top_exercises: topExercises(20),
      };

    case "get_exercise_history": {
      const key = String(input.exercise_key ?? "").trim().toLowerCase();
      if (!key) return { error: "exercise_key is required" };
      const points = exerciseProgress(key, 60);
      return points.length === 0
        ? { error: `No sets logged for "${key}". Check get_gym for valid keys.` }
        : { exercise_key: key, history: points };
    }

    case "get_cardio":
      return {
        sport_totals_90d: sportTotals(90),
        weekly_cardio: weeklyCardio(12),
        recent_activities: recentActivities(15),
      };

    case "get_nutrition": {
      const raw = Number(input.days ?? 30);
      const days = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 90) : 30;
      return {
        daily: nutritionDays(days),
        average_7d: nutritionAverages(7),
        average_30d: nutritionAverages(30),
        targets: getSettingJson<Targets>("nutrition:targets", {
          kcal: null,
          protein: null,
          carbs: null,
          fat: null,
        }),
        bodyweight: bodyweightSeries(180),
      };
    }

    case "get_finance":
      return {
        holdings: positions(),
        value_history: portfolioSeries(180),
        dividends: dividendTotal(),
      };

    default:
      return { error: `Unknown tool ${name}` };
  }
}

const SYSTEM = `You are the user's personal coach and mentor, built into their private dashboard. You can see their gym training (Hevy), cardio (Strava), nutrition and bodyweight (Kalorické tabulky or manual entry), and their Trading 212 portfolio.

How to work:
- Look at the actual data before answering. Call the tools rather than speaking in generalities — a question like "how am I doing?" deserves real numbers from their log, not textbook advice.
- Be concrete and specific. "Your squat e1RM went 100 → 112.5 kg over 8 weeks but you've only trained legs twice in the last three weeks" beats "keep up the consistency".
- Say plainly when the data isn't there. Empty or sparse data is a finding worth reporting, not something to paper over — if they've logged three days of food in a month, say so rather than analysing the three days as if they were representative.
- Lead with the answer, then the reasoning. Keep it brief unless they ask for depth.
- Note the limits of what you can see: estimated 1RM is a formula, not a tested max; Strava calories are estimates; a portfolio snapshot is one moment in time.

Boundaries:
- On money: describe what their portfolio has actually done — allocation, concentration, returns, cost of trades. Do not tell them what to buy or sell, and do not predict prices. You have read-only access and cannot trade.
- On health: you are a training and nutrition coach, not a doctor. Point them to a professional for pain, injury, medication or anything clinical.
- Be honest rather than flattering. If they are undereating protein, deloading forever, or their portfolio is 80% one stock, say it directly and kindly.`;

export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CoachResult {
  reply: string;
  inputTokens: number;
  outputTokens: number;
  toolsUsed: string[];
}

export function coachAvailable(): boolean {
  return Boolean(env.anthropic.apiKey);
}

export async function askCoach(history: CoachTurn[]): Promise<CoachResult> {
  if (!coachAvailable()) {
    throw new Error(
      "No ANTHROPIC_API_KEY set. Add one to .env.local and restart the server to enable the coach.",
    );
  }

  const client = new Anthropic({ apiKey: env.anthropic.apiKey });

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolsUsed: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  // Bounded agentic loop: the coach may look things up a few times before
  // answering, but can never spin indefinitely on the user's credits.
  for (let i = 0; i < 8; i++) {
    const response = await client.messages.create({
      model: env.anthropic.model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      tools: TOOLS,
      messages,
    });

    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    if (response.stop_reason === "refusal") {
      return {
        reply:
          "I wasn't able to answer that one. Try rephrasing, or ask me something else about your training, food or portfolio.",
        inputTokens,
        outputTokens,
        toolsUsed,
      };
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUses.length === 0) {
      const reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      return {
        reply: reply || "(no response)",
        inputTokens,
        outputTokens,
        toolsUsed,
      };
    }

    messages.push({ role: "assistant", content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = toolUses.map((tool) => {
      toolsUsed.push(tool.name);
      try {
        return {
          type: "tool_result",
          tool_use_id: tool.id,
          content: JSON.stringify(runTool(tool.name, tool.input as Record<string, unknown>)),
        };
      } catch (err) {
        return {
          type: "tool_result",
          tool_use_id: tool.id,
          content: err instanceof Error ? err.message : String(err),
          is_error: true,
        };
      }
    });

    messages.push({ role: "user", content: results });
  }

  return {
    reply:
      "I got stuck looking things up and ran out of steps. Try asking something more specific.",
    inputTokens,
    outputTokens,
    toolsUsed,
  };
}
