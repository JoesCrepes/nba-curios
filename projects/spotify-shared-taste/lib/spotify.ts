import type { TrackRef, Track } from '@/types';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

function getRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: 'user-library-read playlist-read-private playlist-modify-public user-read-private',
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

// ── User profile ──────────────────────────────────────────────────────────────

export async function getUserProfile(
  accessToken: string
): Promise<{ id: string; display_name: string; image_url: string | null }> {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
  const data = await res.json();
  return {
    id: data.id,
    display_name: data.display_name,
    image_url: (data.images as { url: string }[] | undefined)?.[0]?.url ?? null,
  };
}

// ── Liked songs (minimal refs only) ──────────────────────────────────────────

export async function fetchLikedTrackRefs(accessToken: string): Promise<TrackRef[]> {
  const refs: TrackRef[] = [];
  let url: string | null = 'https://api.spotify.com/v1/me/tracks?limit=50';

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? 2);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Liked songs fetch failed: ${res.status}`);
    const data = await res.json();
    for (const item of data.items) {
      const t = item.track;
      if (!t || t.is_local) continue;
      refs.push({ isrc: t.external_ids?.isrc ?? null, spotify_id: t.id });
    }
    url = data.next ?? null;
  }

  return refs;
}

// ── User-owned playlist tracks (minimal refs, with fields param for efficiency) ──

export async function fetchOwnedPlaylistTrackRefs(
  accessToken: string,
  userId: string
): Promise<TrackRef[]> {
  // 1. Collect all playlists owned by this user
  const ownedPlaylistIds: string[] = [];
  let listUrl: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';

  while (listUrl) {
    const res: Response = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? 2);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }
    if (!res.ok) break;
    const data = await res.json();
    for (const p of data.items) {
      if (p?.owner?.id === userId) ownedPlaylistIds.push(p.id);
    }
    listUrl = data.next ?? null;
  }

  // 2. Fetch tracks for each owned playlist using fields to minimize payload
  const refs: TrackRef[] = [];

  for (const playlistId of ownedPlaylistIds) {
    const fields = encodeURIComponent('items(track(id,external_ids(isrc))),next');
    let trackUrl: string | null =
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=${fields}`;

    while (trackUrl) {
      const res: Response = await fetch(trackUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After') ?? 2);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if (!res.ok) break;
      const data = await res.json();
      for (const item of data.items) {
        const t = item?.track;
        if (!t?.id) continue;
        refs.push({ isrc: t.external_ids?.isrc ?? null, spotify_id: t.id });
      }
      trackUrl = data.next ?? null;
    }
  }

  return refs;
}

// ── Track enrichment (batch fetch full details for a small matched set) ───────

export async function enrichTracks(
  accessToken: string,
  spotifyIds: string[]
): Promise<Track[]> {
  const tracks: Track[] = [];

  for (let i = 0; i < spotifyIds.length; i += 50) {
    const batch = spotifyIds.slice(i, i + 50);
    const res: Response = await fetch(
      `https://api.spotify.com/v1/tracks?ids=${batch.join(',')}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) continue;
    const data = await res.json();
    for (const t of data.tracks ?? []) {
      if (!t) continue;
      const images = t.album?.images as { url: string; width: number }[] | undefined;
      // Prefer 300px thumbnail; fall back to largest available
      const album_art =
        images?.find((img) => img.width === 300)?.url ?? images?.[0]?.url ?? null;
      tracks.push({
        isrc: t.external_ids?.isrc ?? null,
        spotify_id: t.id,
        name: t.name,
        artists: (t.artists as { name: string }[]).map((a) => a.name),
        album: t.album.name,
        album_art,
      });
    }
  }

  return tracks;
}

// ── Playlist creation ─────────────────────────────────────────────────────────

export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  spotifyTrackIds: string[]
): Promise<{ id: string; external_urls: { spotify: string } }> {
  const createRes = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, public: true }),
  });
  if (!createRes.ok) throw new Error(`Playlist creation failed: ${createRes.status}`);
  const playlist = await createRes.json();

  const uris = spotifyTrackIds.map((id) => `spotify:track:${id}`);
  for (let i = 0; i < uris.length; i += 100) {
    const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
    if (!addRes.ok) throw new Error(`Adding tracks failed: ${addRes.status}`);
  }

  return playlist;
}
