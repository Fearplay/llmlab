import { notFound } from "next/navigation";
import { labEntries } from "@/lib/lab-catalog";
import { ConceptLab } from "@/components/pages/concepts/concept-lab";

export function generateStaticParams() {
  return labEntries.map(({ slug }) => ({ slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!labEntries.some((entry) => entry.slug === slug)) notFound();
  return <ConceptLab slug={slug} />;
}
