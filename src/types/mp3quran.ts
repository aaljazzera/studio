/**
 * @fileOverview Type definitions for the mp3quran.net API.
 */

/**
 * Represents a Moshaf (recitation style and server details) for a reciter.
 */
export interface Moshaf {
  id: number;
  name: string; // e.g., "مرتل" (Murattal)
  server: string; // Base URL for audio files, e.g., "https://server11.mp3quran.net/a_afasy"
  surah_list: string; // Comma-separated string of available surah IDs "1,2,3,..."
  surah_total: number;
  moshaf_type: string; // Identifier for the type of Moshaf
}

/**
 * Represents a Reciter (Qari).
 */
export interface Reciter {
  id: number;
  name: string; // Name of the reciter, e.g., "مشاري راشد العفاسي"
  letter: string; // Starting letter of the reciter's name
  moshaf: Moshaf[]; // Array of available Moshafs for this reciter
}

/**
 * Represents the structure of the response from the /reciters endpoint.
 */
export interface RecitersResponse {
  reciters: Reciter[];
}

/**
 * Represents a Surah (chapter) of the Quran, as provided by the API.
 */
export interface ApiSurah {
  id: number;
  name: string; // Name of the Surah
  // Potentially add other fields like transliteration, type (Meccan/Medinan) if needed
}

/**
 * Represents the structure of the response from the /suwar endpoint.
 */
export interface SurahsResponse {
  suwar: ApiSurah[];
}

/**
 * Represents a Radio station from the API.
 */
export interface Radio {
    id: number;
    name: string; // Name of the radio station
    url: string; // Streaming URL
    recent_date: string; // Date information, format might vary
}

/**
 * Represents the structure of the response from the /radios endpoint.
 */
export interface RadiosResponse {
    radios: Radio[];
}

// Add other interfaces for Riwayat, Tafasir, etc., if needed
