"use client";

import React, { useState, useEffect } from 'react';
import { useQuranStore } from '@/store/quran-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

// Function to fetch Quran text (replace with actual API call or file read)
async function fetchQuranText(): Promise<string> {
  // In a real app, you'd fetch this from `public/quran.txt` or an API
  // For now, using placeholder text.
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  try {
    const response = await fetch('/quran.txt');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    // Basic check if the file content looks like the placeholder
    if (text.includes('(This is Surah Al-Fatiha. Please replace this file with the full Quran text in the specified format.)')) {
        console.warn("Using placeholder Quran text. Please replace public/quran.txt with the full text.");
         return `
بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ (1)
ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ (2) ٱلرَّحْمَٰنِ ٱلرَّحِيمِ (3) مَٰلِكِ يَوْمِ ٱلدِّينِ (4) إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ (5) ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ (6) صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ (7)

هذا نص مؤقت. يرجى استبداله بالمحتوى الفعلي من quran.txt.
يتطلب تحميل نص القرآن الفعلي قراءة الملف أو التكامل مع واجهة برمجة تطبيقات.
يوضح هذا المكون عرض النص بخط قابل للتعديل واتجاه النص.
`.trim();
    }
    return text.trim();
  } catch (error) {
    console.error("Failed to fetch Quran text:", error);
    // Return placeholder text on error to avoid breaking the UI completely
     return `
بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ (1)
ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ (2) ٱلرَّحْمَٰنِ ٱلرَّحِيمِ (3) مَٰلِكِ يَوْمِ ٱلدِّينِ (4) إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ (5) ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ (6) صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ (7)

خطأ في تحميل النص القرآني.
`.trim();
    // Or re-throw if you want the error boundary to catch it: throw error;
  }
}


export function QuranDisplay() {
  const { fontSize, viewMode, selectedSurah } = useQuranStore();
  const [quranText, setQuranText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchQuranText()
      .then(text => {
        setQuranText(text);
        setLoading(false);
      })
      .catch(err => {
        console.error("فشل تحميل النص القرآني:", err);
        setError("فشل تحميل النص القرآني.");
        setLoading(false);
      });
  }, []); // Fetch only once on mount for now

  // Filter or process text when surah or viewMode changes
  // This part needs significant enhancement for actual functionality
  useEffect(() => {
    if (!quranText) return;

    console.log(`QuranDisplay: Surah selected: ${selectedSurah}, ViewMode: ${viewMode}`);
    // Placeholder for filtering logic:
    // If selectedSurah is defined, filter quranText to show only that surah.
    // If viewMode is 'verse', format the text accordingly.
    // This requires a structured format for quran.txt (e.g., markers for surah/ayah numbers)

  }, [selectedSurah, viewMode, quranText]);


  const getDisplayText = () => {
      if (!quranText) return '';

      // --- Enhanced Logic (Requires structured quran.txt) ---
      // 1. Find the start and end of the selected Surah.
      //    Need a reliable way to parse quran.txt (e.g., using markers like SURAH:1, AYAH:1:1)
      // 2. Extract the text for the selected Surah.
      // 3. If viewMode is 'verse', split the extracted text into verses.

      // --- Simplified Version (Shows all text for now) ---
      if (viewMode === 'verse') {
          // Simple verse splitting based on existing parenthesis numbering (highly inaccurate for real Quran)
          // Replace with proper logic based on quran.txt structure
          const verses = quranText.match(/^(.*?\((\d+)\))/gm); // Attempt to split by lines ending in (number)
          if (verses) {
            return verses.map((verse, index) => <p key={index} className="mb-2">{verse.trim()}</p>);
          }
          // Fallback if regex fails
          return quranText.split('\n').map((line, index) => <p key={index} className="mb-2">{line}</p>);
      }
      // Page view (show text paragraphs)
      return quranText.split('\n\n').map((paragraph, index) => <p key={index} className="mb-4">{paragraph}</p>);
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
          </div>
        )}
        {error && <p className="text-destructive text-center">{error}</p>}
        {!loading && !error && quranText && (
          <div
            className={cn(
              'quran-text text-right leading-loose', // Apply Quran font and right-to-left
              // Add spacing between verses if in verse mode
               viewMode === 'verse' ? 'flex flex-col' : ''
            )}
            style={{ fontSize: `${fontSize * 1.2}px` }} // Adjust multiplier as needed
            dir="rtl" // Ensure right-to-left direction
          >
            {getDisplayText()}
          </div>
        )}
         {!loading && !error && !quranText && (
           <p className="text-muted-foreground text-center">اختر سورة لعرض النص.</p>
         )}
      </CardContent>
    </Card>
  );
}
```