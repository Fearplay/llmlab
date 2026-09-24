import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppProvider } from "@/components/app-provider";
import { FlappyPage } from "./flappy-page";

const response = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("llmlab.locale", "cs");
  localStorage.setItem("llmlab.mode", "local");
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows saved DQN evidence and starts the recommended training length", async () => {
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/game/train") && init?.method === "POST") {
      requests.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return response({ id: "train_new", status: "queued" });
    }
    if (url.endsWith("/game/train/latest")) return response({
      id: "train_old", status: "completed", seed: 42,
      episodes_requested: 1000, episodes_completed: 1000, error: null,
      result: {
        training: { episodes: Array.from({ length: 50 }, (_, index) => ({ score: index < 25 ? 0 : 2, frames: 100 })), total_steps: 5000, updates: 4900, epsilon: 0.05, mean_loss: 0.1 },
        evaluation_before: { mean_score: 0 },
        evaluation: { mean_score: 2.4, episodes: [] },
      },
    });
    if (url.endsWith("/game/checkpoint")) return response({ ready: true, episodes: 1000 });
    if (url.includes("/game/showcase")) return response({
      attempts: Array.from({ length: 20 }, (_, index) => ({ seed: 100042 + index, score: index === 2 ? 21 : index % 3, steps: [{ frame: 12, y: 250, score: 0, alive: true, pipe_x: 400, gap_top: 160, gap_bottom: 334 }, { frame: 24, y: 255, score: index === 2 ? 21 : index % 3, alive: false, pipe_x: 370, gap_top: 160, gap_bottom: 334 }] })),
      winner_index: 2, best_score: 21, target_score: 20, target_met: true, checkpoint_episodes: 1000,
      replay: { steps: [{ action: "WAIT", result: { observation: { frame: 12, score: 0, alive: true, floor_y: 568, bird: { x: 120, y: 250, radius: 14 }, pipes: [] } } }, { action: "FLAP", result: { observation: { frame: 24, score: 21, alive: false, floor_y: 568, bird: { x: 120, y: 255, radius: 14 }, pipes: [] } } }], final_state: {} },
    });
    if (url.includes("/game/episodes")) return response({ episodes: [{ id: "ep_1", agent: "dqn", model_key: null, status: "completed", seed: 42, score: 3, frames: 300, decision_count: 25, input_tokens: 0, output_tokens: 0, cost_usd: 0, decision_latency_ms: 0, death_reason: "pipe", error: null }] });
    if (url.includes("/game/leaderboard")) return response({ rows: [{ key: "dqn", agent: "dqn", model_key: null, runs: 1, best: 3, average: 3, input_tokens: 0, output_tokens: 0, cost_usd: 0 }] });
    if (url.endsWith("/models")) return response({ models: [], providers: [] });
    return response([]);
  }));

  render(<AppProvider><FlappyPage /></AppProvider>);
  expect(await screen.findByRole("region", { name: "Dvacet pokusů DQN" })).toBeInTheDocument();
  expect(screen.getAllByRole("img", { name: /^Pták \d+, skóre/ })).toHaveLength(20);
  expect(screen.getByText(/Cíl splněn: pták #3/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pozastavit" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Více informací: Jak se počítá skóre" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Více informací: Učí se jazykový model?" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Více informací: Co dělá DQN" })).toBeInTheDocument();
  expect(screen.queryByText(/Pták získá bod za každou proletěnou trubku/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Více informací: Jak se počítá skóre" }));
  expect(screen.getByRole("tooltip")).toHaveTextContent("Pták získá bod za každou proletěnou trubku");
  expect(screen.getByText(/Uložený model: 1000 epizod/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Trénovat 1000 epizod" }));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0]).toMatchObject({ seed: 42, episodes: 1000, max_decisions: 200 });
});
