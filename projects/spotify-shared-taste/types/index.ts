// Minimal track reference — stored in DB during OAuth callback
export interface TrackRef {
  isrc: string | null;
  spotify_id: string;
}

// Full track with display details — constructed at results time via Spotify batch API
export interface Track extends TrackRef {
  name: string;
  artists: string[];
  album: string;
  album_art: string | null;
}

// Used server-side before enrichment
export interface IntersectionRef {
  key: string;
  spotify_id: string;
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
