import { notFound } from "next/navigation";
import { LearningMission } from "@/components/pages/learning-mission";
import { missionBySlug, missions } from "@/lib/learning-content";

export function generateStaticParams() { return missions.map(({ slug }) => ({ slug })); }

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!missionBySlug(slug)) notFound();
  return <LearningMission slug={slug} />;
}
