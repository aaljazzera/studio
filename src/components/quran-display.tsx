
"use client";

import React, { useState, useEffect } from 'react';
import { useQuranStore } from '@/store/quran-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { quranSurahs } from '@/data/quran-surahs'; // Import surah data

// Function to fetch Quran text based on selected Riwaya
async function fetchQuranText(riwayaId: string = 'hafs'): Promise<string> {
  // Construct the filename based on the riwayaId
  const filename = `quran-${riwayaId}.txt`;
  console.log(`Attempting to fetch Quran text from: /${filename}`);

  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay

  try {
    const response = await fetch(`/${filename}`);
    if (!response.ok) {
      throw new Error(`خطأ HTTP! الحالة: ${response.status} - لم يتم العثور على ملف ${filename}`);
    }
    const text = await response.text();
    // Placeholder check removed, assuming correct files exist
    return text.trim();
  } catch (error) {
    console.error(`فشل تحميل النص القرآني (${filename}):`, error);
    // Return specific error message based on Riwaya
    return `
بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ (1)
ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ (2) ...

خطأ في تحميل النص القرآني لرواية "${riwayaId}".
يرجى التأكد من وجود ملف public/${filename}.
`.trim();
    // Or re-throw if you want the error boundary to catch it: throw error;
  }
}


export function QuranDisplay() {
  const { fontSize, viewMode, selectedSurah, selectedRiwaya } = useQuranStore();
  const [quranText, setQuranText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch text when selectedRiwaya changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    setQuranText(null); // Clear previous text
    fetchQuranText(selectedRiwaya)
      .then(text => {
        setQuranText(text);
        setLoading(false);
      })
      .catch(err => {
        console.error("فشل تحميل النص القرآني:", err);
        setError("فشل تحميل النص القرآني.");
        setLoading(false);
      });
  }, [selectedRiwaya]); // Dependency on selectedRiwaya

  const getSurahText = (surahId: string): string => {
    if (!quranText) return '';

    // Split by SURAH markers to find the correct segment
    // Assumes format: SURAH:1\n...text...\nSURAH:2\n...
    const surahStartMarker = `SURAH:${surahId}\n`;
    const nextSurahId = parseInt(surahId, 10) + 1;
    const nextSurahStartMarker = `SURAH:${nextSurahId}\n`;

    const startIndex = quranText.indexOf(surahStartMarker);
    if (startIndex === -1) return 'السورة غير موجودة في هذا النص.';

    let endIndex = quranText.indexOf(nextSurahStartMarker, startIndex);
    if (endIndex === -1) {
        endIndex = quranText.length; // Handle the last Surah
    }

    // Extract the text between the markers, removing the start marker itself
    let surahText = quranText.substring(startIndex + surahStartMarker.length, endIndex);

    // Remove AYAH markers if they exist in page view (optional, depends on desired format)
    // surahText = surahText.replace(/AYAH:\d+:\d+ /g, '');

    return surahText.trim();
  };


   const getAyahText = (surahText: string): JSX.Element[] | JSX.Element => {
        // Split by AYAH markers or newlines if markers are missing
        const ayahRegex = /AYAH:\d+:\d+\s?(.*?)(?=\nAYAH:|\nSURAH:|$)/gs;
        const matches: JSX.Element[] = [];
        let match;
        let lastIndex = 0;

        // Check if AYAH markers exist
        const hasAyahMarkers = /AYAH:\d+:\d+/.test(surahText);

        if (hasAyahMarkers) {
            while ((match = ayahRegex.exec(surahText)) !== null) {
                // Add text between markers if any (should ideally be empty with correct format)
                if (match.index > lastIndex) {
                     // This might capture text between surah marker and first ayah marker, or basmallah if not marked
                    const interAyahText = surahText.substring(lastIndex, match.index).trim();
                     if (interAyahText && !interAyahText.startsWith('SURAH:')) {
                         console.warn("Found text between AYAH markers:", interAyahText);
                         // Optionally display it, or ignore
                        // matches.push(<p key={`inter-${lastIndex}`} className="mb-2 text-muted-foreground">{interAyahText}</p>);
                     }
                }
                const ayahContent = match[1]?.trim() || '';
                if (ayahContent) {
                    matches.push(<p key={match.index} className="mb-2">{ayahContent}</p>);
                }
                lastIndex = match.index + match[0].length;
            }
             // Add any remaining text after the last marker (should ideally be empty)
             if (lastIndex < surahText.length) {
                const remainingText = surahText.substring(lastIndex).trim();
                if (remainingText) {
                     console.warn("Found text after last AYAH marker:", remainingText);
                    // Optionally display it
                    // matches.push(<p key="remaining" className="mb-2 text-muted-foreground">{remainingText}</p>);
                }
             }
        } else {
            // Fallback: If no AYAH markers, split by newline
            console.warn("AYAH markers not found in surah text, splitting by newline.");
            const lines = surahText.split('\n').filter(line => line.trim() !== '');
            lines.forEach((line, index) => {
                 // Basic filtering for potential unwanted lines if needed
                 if (!line.startsWith('SURAH:')) { // Avoid re-displaying the SURAH marker itself
                     matches.push(<p key={`line-${index}`} className="mb-2">{line.trim()}</p>);
                 }
            });
        }


        if (matches.length === 0 && surahText.trim()) {
             // If still no matches but text exists, display the whole text as one block
             console.warn("No verses extracted, displaying raw surah text.");
             return <p className="mb-2">{surahText}</p>;
        }

        return matches;
    };


  const getDisplayText = () => {
      // Ensure riwaya is selected, default to 'hafs' if undefined
      const currentRiwaya = selectedRiwaya || 'hafs';
      if (!quranText) return <p>جاري تحميل النص القرآني لرواية {currentRiwaya}...</p>;
      if (!selectedSurah) return <p className="text-center text-muted-foreground">الرجاء اختيار سورة لعرض نصها.</p>;

      const surahText = getSurahText(selectedSurah);

      if (surahText === 'السورة غير موجودة في هذا النص.') {
           return <p className="text-center text-destructive">{surahText}</p>;
      }

      if (viewMode === 'verse') {
          // وضع الآيات
          const verses = getAyahText(surahText);
          return Array.isArray(verses) && verses.length > 0 ? verses : <p className="text-center text-muted-foreground">لا توجد آيات لعرضها لهذه السورة بالصيغة المحددة.</p>;
      } else {
          // وضع الصفحة - Remove AYAH markers for page view
          const pageText = surahText.replace(/AYAH:\d+:\d+\s?/g, '').trim();
          // Split into paragraphs based on double newlines or single if none
          const paragraphs = pageText.includes('\n\n') ? pageText.split('\n\n') : pageText.split('\n');
          return paragraphs.map((paragraph, index) => (
              paragraph.trim() ? <p key={index} className="mb-4">{paragraph.trim()}</p> : null
          ));
      }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardContent className="p-6">
        {loading && (
          <div className="space-y-4" dir="rtl">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <p className="text-center text-muted-foreground">جاري تحميل النص...</p>
          </div>
        )}
        {error && <p className="text-destructive text-center">{error}</p>}
        {!loading && !error && (
          <div
            className={cn(
              'quran-text text-right leading-loose transition-opacity duration-300', // Apply Quran font and right-to-left
              viewMode === 'verse' ? 'flex flex-col' : ''
            )}
            style={{ fontSize: `${fontSize * 1.2}px` }} // Adjust multiplier as needed
            dir="rtl" // Ensure right-to-left direction
            key={selectedSurah} // Add key to force re-render on surah change
          >
            {getDisplayText()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
