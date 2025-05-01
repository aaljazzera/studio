
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useQuranStore } from '@/store/quran-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { quranSurahs } from '@/data/quran-surahs'; // Import surah data

// Define the structure of the parsed Quran data
interface QuranData {
  [surahId: string]: {
    [ayahId: string]: string; // ayahId includes surah:ayah, e.g., "1:1"
  };
}


// Function to fetch and parse Quran text based on selected Riwaya
async function fetchAndParseQuran(riwayaId: string): Promise<QuranData> {
  // Construct the filename based on the riwayaId
  const filename = `quran-${riwayaId}.txt`; // e.g., quran-hafs.txt
  console.log(`Attempting to fetch Quran text from: /${filename}`);

  // Simulate network delay for loading state visibility
  // await new Promise(resolve => setTimeout(resolve, 300));

  try {
    const response = await fetch(`/${filename}`);
    if (!response.ok) {
      throw new Error(`خطأ HTTP! الحالة: ${response.status} - لم يتم العثور على ملف ${filename}`);
    }
    const text = await response.text();

    // Parse the text into a structured format
    const lines = text.trim().split('\n');
    const quranData: QuranData = {};
    let currentSurahId: string | null = null;

    lines.forEach(line => {
      if (line.startsWith('SURAH:')) {
        currentSurahId = line.split(':')[1];
        if (currentSurahId && !quranData[currentSurahId]) {
          quranData[currentSurahId] = {};
        }
      } else if (line.startsWith('AYAH:') && currentSurahId) {
        // Example line: AYAH:1:1 بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        const parts = line.match(/^AYAH:(\d+:\d+)\s?(.*)/);
        if (parts && parts[1] && parts[2]) {
          const ayahId = parts[1]; // e.g., "1:1"
          const ayahText = parts[2].trim();
          quranData[currentSurahId][ayahId] = ayahText;
        } else {
           console.warn(`Skipping malformed AYAH line: ${line}`);
        }
      } else if (line.trim() !== '' && !line.startsWith('(') ) { // Ignore empty lines and comments
          console.warn(`Skipping unexpected line format: ${line}`);
      }
    });

     console.log(`Successfully parsed Quran data for Riwaya: ${riwayaId}`);
    return quranData;

  } catch (error) {
    console.error(`فشل تحميل أو تحليل النص القرآني (${filename}):`, error);
    // Return an empty object or re-throw, depending on how you want to handle errors
     // Returning an empty object will lead to "No text" messages in the display
     // Throwing will show the generic error message
    throw new Error(`فشل تحميل بيانات القرآن لرواية "${riwayaId}". تأكد من وجود الملف /${filename}.`);
  }
}


export function QuranDisplay() {
  const { fontSize, viewMode, selectedSurah, selectedRiwaya } = useQuranStore();
  const [quranData, setQuranData] = useState<QuranData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch text when selectedRiwaya changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    setQuranData(null); // Clear previous data

    // Fetch and parse data for the selected riwaya
    fetchAndParseQuran(selectedRiwaya)
      .then(data => {
        setQuranData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching/parsing Quran data:", err);
        setError((err as Error).message || "فشل تحميل النص القرآني.");
        setLoading(false);
      });
  }, [selectedRiwaya]); // Dependency on selectedRiwaya


  // Memoize the displayed content to avoid re-calculation on every render
  const displayedContent = useMemo(() => {
      if (!quranData) return null; // Return null if data is not loaded yet
      if (!selectedSurah) return <p className="text-center text-muted-foreground">الرجاء اختيار سورة لعرض نصها.</p>;

      const surahAyahs = quranData[selectedSurah];

      if (!surahAyahs || Object.keys(surahAyahs).length === 0) {
          // Check if the surah exists in the loaded data
          const surahInfo = quranSurahs.find(s => s.id.toString() === selectedSurah);
          const surahName = surahInfo ? surahInfo.name : `رقم ${selectedSurah}`;
           return <p className="text-center text-muted-foreground">لا يوجد نص لسورة {surahName} في الرواية المحددة.</p>;
      }

       // Get sorted Ayah IDs (e.g., "1:1", "1:2", ..., "2:1", "2:2", ...)
       // We need to sort numerically, not alphabetically
       const sortedAyahIds = Object.keys(surahAyahs).sort((a, b) => {
           const [surahA, ayahA] = a.split(':').map(Number);
           const [surahB, ayahB] = b.split(':').map(Number);
           if (surahA !== surahB) return surahA - surahB; // Should be same surah, but for safety
           return ayahA - ayahB;
       });


      if (viewMode === 'verse') {
          // وضع الآيات: Display each ayah in its own paragraph
          return sortedAyahIds.map(ayahId => (
              <p key={ayahId} className="mb-2">
                  {surahAyahs[ayahId]}
                   {/* Optionally add Ayah number */}
                   <span className="text-xs text-muted-foreground mx-1">({ayahId.split(':')[1]})</span>
              </p>
          ));
      } else {
          // وضع الصفحة: Join all ayahs of the surah with a space or appropriate separator
          // Adding the ayah number in parentheses after each verse for page view
           const surahTextWithNumbers = sortedAyahIds.map(ayahId =>
                `${surahAyahs[ayahId]} (${ayahId.split(':')[1]})`
           ).join(' '); // Join with a space

          // Display the concatenated text in a single paragraph for page view
          return <p>{surahTextWithNumbers}</p>;
      }

  }, [quranData, selectedSurah, viewMode]);


  return (
    <Card className="w-full shadow-lg">
      <CardContent className="p-6">
        {loading && (
          <div className="space-y-4" dir="rtl">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <p className="text-center text-muted-foreground">جاري تحميل نص القرآن لرواية {selectedRiwaya}...</p>
          </div>
        )}
        {error && <p className="text-destructive text-center">{error}</p>}
        {!loading && !error && quranData && (
          <div
            className={cn(
              'quran-text text-right leading-loose transition-opacity duration-300', // Base Quran styles
              viewMode === 'verse' ? 'flex flex-col' : '' // Layout adjustment for verse mode
            )}
            style={{ fontSize: `${fontSize * 1.2}px` }} // Dynamic font size
            dir="rtl" // Force Right-to-Left
            data-riwaya={selectedRiwaya} // Add data attribute for CSS font selection
            key={`${selectedRiwaya}-${selectedSurah}-${viewMode}`} // Force re-render on key changes
          >
            {displayedContent}
          </div>
        )}
         {!loading && !error && !quranData && !error && (
            // Handle case where data might be null after loading finishes (e.g., empty file)
            <p className="text-center text-muted-foreground">لم يتم العثور على بيانات قرآنية للرواية المحددة.</p>
         )}
      </CardContent>
    </Card>
  );
}
