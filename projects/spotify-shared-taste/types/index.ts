// Minimal track reference — stored in DB during OAuth callback.
// Includes name + primary artist so server-side search works without enrichment.
export interface TrackRef {
  isrc: string | null;
  spotify_id: string;
  name: string;
  artist: string; // first artist only, for search
}

// Full track with display details — constructed at results time via Spotify batch API
export interface Track extends TrackRef {
  artists: string[]; // full artist list for display
  album: string;
  album_art: string | null;
}

// Used server-side before enrichment (includes name+artist for filtering)
export interface IntersectionRef {
  key: string;
  spotify_id: string;
  name: string;
  artist: string;
  count: number;
  likedBy: string[];
}

// Returned to client (track is fully enriched)
export interface IntersectionEntry {
  key: string;
  count: number;
  track: Track;
  likedBy: string[];
}

export interface Lobby {
  id: string;
  created_at: string;
  status: 'waiting' | 'done';
}

export interface Participant {
  id: string;
  lobby_id: string;
  name: string;
  is_organizer: boolean;
  connected_at: string | null;
  track_count: number | null;
  profile_image_url: string | null;
  created_at: string;
}

export interface LobbyStatus {
  lobby: Lobby;
  participants: Participant[];
}
