import { LobbyRoom } from '@/components/LobbyRoom';

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <LobbyRoom code={code} />;
}
