import type { Track } from '@/types';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

function getRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: 'user-library-read playlist-modify-public user-read-private',
    state,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  return res.json();
}

// ── Liked songs ─────────────────────────────────────────────────────────────

export async function fetchAllLikedTracks(accessToken: string): Promise<Track[]> {
  const tracks: Track[] = [];
  let url: string | null = 'https://api.spotify.com/v1/me/tracks?limit=50';

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? 2);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (!res.ok) throw new Error(`Spotify tracks fetch failed: ${res.status}`);

    const data = await res.json();
    for (const item of data.items) {
      const t = item.track;
      if (!t || t.is_local) continue;
      tracks.push({
        isrc: t.external_ids?.isrc ?? null,
        spotify_id: t.id,
        name: t.name,
        artists: (t.artists as { name: string }[]).map((a) => a.name),
        album: t.album.name,
      });
    }
    url = data.next ?? null;
  }

  return tracks;
}

// ── User profile ─────────────────────────────────────────────────────────────

export async function getUserProfile(
  accessToken: string
): Promise<{ id: string; display_name: string }> {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
  return res.json();
}

// ── Playlist creation ────────────────────────────────────────────────────────

export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  spotifyTrackIds: string[]
): Promise<{ id: string; external_urls: { spotify: string } }> {
  // 1. Create the playlist
  const createRes = await fetch(
    `https://api.spotify.com/v1/users/${userId}/playlists`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, public: true }),
    }
  );
  if (!createRes.ok) throw new Error(`Playlist creation failed: ${createRes.status}`);
  const playlist = await createRes.json();

  // 2. Add tracks in batches of 100
  const uris = spotifyTrackIds.map((id) => `spotify:track:${id}`);
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    const addRes = await fetch(
      `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: batch }),
      }
    );
    if (!addRes.ok) throw new Error(`Adding tracks failed: ${addRes.status}`);
  }

  return playlist;
}
