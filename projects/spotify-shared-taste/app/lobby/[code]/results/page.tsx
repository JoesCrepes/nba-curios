import { ResultsView } from '@/components/ResultsView';

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ResultsView code={code} />;
}
