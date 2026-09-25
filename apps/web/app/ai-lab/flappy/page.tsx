import { FlappyPage } from "@/components/pages/flappy-page";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ replay?: string | string[] }>;
}) {
  const replay = (await searchParams).replay;
  return <FlappyPage initialReplayId={typeof replay === "string" ? replay : null} />;
}
