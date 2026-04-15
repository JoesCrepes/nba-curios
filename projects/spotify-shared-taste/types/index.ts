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
  created_at: string;
}

export interface Track {
  isrc: string | null;
  spotify_id: string;
  name: string;
  artists: string[];
  album: string;
}

export interface IntersectionEntry {
  key: string;
  count: number;
  track: Track;
  likedBy: string[];
}

export interface LobbyStatus {
  lobby: Lobby;
  participants: Participant[];
}
