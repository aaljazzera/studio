/**
 * @fileOverview Service functions for interacting with the mp3quran.net API.
 */
import type { RecitersResponse, SurahsResponse, RadiosResponse } from '@/types/mp3quran';

const API_BASE_URL = 'https://mp3quran.net/api/v3';

/**
 * Fetches the list of reciters for a given language.
 * @param language - The language code (e.g., 'ar', 'eng'). Defaults to 'ar'.
 * @returns A promise that resolves to the RecitersResponse.
 * @throws Throws an error if the fetch operation fails.
 */
export async function fetchReciters(language: string = 'ar'): Promise<RecitersResponse> {
  const response = await fetch(`${API_BASE_URL}/reciters?language=${language}`);
  if (!response.ok) {
    // Provide a more user-friendly error message
    const errorData = await response.text(); // Attempt to get more error details
    console.error("API Error Details:", errorData);
    throw new Error(`فشل جلب بيانات القراء من الخادم (الحالة: ${response.status})`);
  }
  try {
    return await response.json();
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
    throw new Error("حدث خطأ أثناء معالجة بيانات القراء.");
  }
}

/**
 * Fetches the list of Surahs for a given language.
 * Note: The application currently uses a static list in quran-surahs.ts.
 * This function is provided for completeness if API-based surah lists are needed later.
 * @param language - The language code (e.g., 'ar', 'eng'). Defaults to 'ar'.
 * @returns A promise that resolves to the SurahsResponse.
 * @throws Throws an error if the fetch operation fails.
 */
export async function fetchSurahs(language: string = 'ar'): Promise<SurahsResponse> {
    const response = await fetch(`${API_BASE_URL}/suwar?language=${language}`);
    if (!response.ok) {
         const errorData = await response.text();
         console.error("API Error Details:", errorData);
        throw new Error(`فشل جلب بيانات السور من الخادم (الحالة: ${response.status})`);
    }
     try {
        return await response.json();
    } catch (e) {
        console.error("Failed to parse JSON response:", e);
        throw new Error("حدث خطأ أثناء معالجة بيانات السور.");
    }
}

/**
 * Fetches the list of Radios for a given language.
 * @param language - The language code (e.g., 'ar', 'eng'). Defaults to 'ar'.
 * @returns A promise that resolves to the RadiosResponse.
 * @throws Throws an error if the fetch operation fails.
 */
export async function fetchRadios(language: string = 'ar'): Promise<RadiosResponse> {
    const response = await fetch(`${API_BASE_URL}/radios?language=${language}`);
     if (!response.ok) {
         const errorData = await response.text();
         console.error("API Error Details:", errorData);
        throw new Error(`فشل جلب بيانات الإذاعات من الخادم (الحالة: ${response.status})`);
    }
    try {
        return await response.json();
    } catch (e) {
        console.error("Failed to parse JSON response:", e);
        throw new Error("حدث خطأ أثناء معالجة بيانات الإذاعات.");
    }
}


/**
 * Formats a Surah ID number into a 3-digit string (e.g., 1 -> "001", 114 -> "114").
 * @param id - The Surah ID as a number or string.
 * @returns The formatted 3-digit Surah ID string.
 * @throws Throws an error if the ID is invalid.
 */
export function formatSurahId(id: number | string): string {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numId) || numId < 1 || numId > 114) {
        // Provide a more specific error message
        throw new Error(`رقم السورة غير صالح: ${id}. يجب أن يكون بين 1 و 114.`);
    }
    return numId.toString().padStart(3, '0');
}

/**
 * Constructs the full audio URL for a specific Surah by a specific reciter.
 * @param serverUrl - The base server URL/path for the reciter's audio files (from the Moshaf object).
 * @param surahId - The ID of the Surah (1-114).
 * @returns The full URL to the MP3 audio file.
 * @throws Throws an error if the Surah ID is invalid.
 */
export function getAudioUrl(serverUrl: string, surahId: string | number): string {
    // Validate serverUrl (basic check)
    if (!serverUrl || typeof serverUrl !== 'string' || !serverUrl.startsWith('http')) {
         console.warn(`عنوان خادم غير صالح مقدم: ${serverUrl}`);
         // Return an empty string or throw an error, depending on desired handling
         return ''; // Prevents constructing an invalid URL
    }

    try {
        const formattedSurahId = formatSurahId(surahId);
        // Ensure serverUrl doesn't end with a slash before appending
        const cleanServerUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
        return `${cleanServerUrl}/${formattedSurahId}.mp3`;
    } catch (error) {
        console.error("خطأ في بناء رابط الصوت:", error);
        // Re-throw or return an empty string/handle as appropriate
        throw error; // Re-throw the specific error from formatSurahId
    }
}
