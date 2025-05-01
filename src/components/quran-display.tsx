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
  // Example: const response = await fetch('/quran.txt'); return await response.text();
  return `
بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ (1)
ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ (2) ٱلرَّحْمَٰنِ ٱلرَّحِيمِ (3) مَٰلِكِ يَوْمِ ٱلدِّينِ (4) إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ (5) ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ (6) صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ (7)

This is placeholder text. Replace with actual content from quran.txt.
Loading the actual Quran text requires file reading or API integration.
This component demonstrates displaying the text with adjustable font size and direction.
`.trim();
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
        console.error("Failed to load Quran text:", err);
        setError("Failed to load Quran text.");
        setLoading(false);
      });
  }, [selectedSurah]); // Refetch when Surah changes (if fetching specific surah)

  const getDisplayText = () => {
      if (!quranText) return '';
      // In a real app, filter text based on selectedSurah and viewMode (page/verse)
      // This is a simplified version just showing the whole text for now.
      if (viewMode === 'verse') {
          // Simple verse splitting (replace with proper logic)
          return quranText.split('\n').map((line, index) => <p key={index}>{line}</p>);
      }
      // Page view (just show text as is for now)
      return <p>{quranText}</p>;
  };

  return (
    <Card className="w-full shadow-lg">
      <CardContent className="p-6">
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
          </div>
        )}
        {error && <p className="text-destructive">{error}</p>}
        {!loading && !error && quranText && (
          <div
            className={cn(
              'quran-text text-right leading-loose', // Apply Quran font and right-to-left
              viewMode === 'verse' ? 'space-y-4' : ''
            )}
            style={{ fontSize: `${fontSize * 1.2}px` }} // Adjust multiplier as needed
            dir="rtl" // Ensure right-to-left direction
          >
            {getDisplayText()}
          </div>
        )}
         {!loading && !error && !quranText && (
           <p className="text-muted-foreground">Select a Surah to display text.</p>
         )}
      </CardContent>
    </Card>
  );
}