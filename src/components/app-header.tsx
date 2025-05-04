"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  BookOpen,
  Menu,
  Loader2,
  Download, // Import Download icon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { quranSurahs } from '@/data/quran-surahs';
import { fetchReciters, getAudioUrl } from '@/services/mp3quran';
import type { Reciter, Moshaf } from '@/types/mp3quran';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils'; // Import cn

export function AppHeader() {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedReciterId, setSelectedReciterId] = useState<string>('7'); // Default: Ahmed Saud
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string>('1'); // Default: Al-Fatiha
  const [selectedMoshaf, setSelectedMoshaf] = useState<Moshaf | undefined>(undefined);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string>('');
  const [autoplayNext, setAutoplayNext] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false); // Flag for initial setup completion
  const [playbackResetting, setPlaybackResetting] = useState(false); // Flag to indicate reset in progress

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMobile } = useSidebar();
  const { toast } = useToast();
  const lastErrorRef = useRef<string | null>(null);
  const hasUserInteracted = useRef(false);
  const playIntentRef = useRef(false); // Ref to track explicit play intent


  // Fetch reciters
  const { data: recitersData, isLoading: isLoadingReciters, error: recitersError } = useQuery({
    queryKey: ['reciters'],
    queryFn: () => fetchReciters('ar'),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
  });

   // Find the default reciter 'أحمد سعود' (ID 7) after data loads
   const defaultReciter = recitersData?.reciters?.find(r => r.id.toString() === '7');

   // Memoize sorted reciters list, placing default at the top if found
   const sortedReciters = React.useMemo(() => {
     if (!recitersData?.reciters) return [];
     const reciters = [...recitersData.reciters];
     reciters.sort((a, b) => a.name.localeCompare(b.name, 'ar')); // Sort alphabetically in Arabic

     if (defaultReciter) {
       const defaultIndex = reciters.findIndex(r => r.id === defaultReciter.id);
       if (defaultIndex > -1) {
         // Move default reciter to the beginning
         const [removed] = reciters.splice(defaultIndex, 1);
         reciters.unshift(removed);
       }
     }
     return reciters;
   }, [recitersData?.reciters, defaultReciter]);

  // --- Utility Functions ---
  const showToast = useCallback((title: string, description: string, variant: "default" | "destructive" = "default") => {
    if (variant === "destructive" && description === lastErrorRef.current) {
      return;
    }
    toast({ title, description, variant });
    if (variant === "destructive") {
      lastErrorRef.current = description;
      setTimeout(() => { lastErrorRef.current = null; }, 5000);
    }
  }, [toast]);

  // --- Audio Event Handlers ---

  // Audio ended handler
    const handleAudioEnd = useCallback(() => {
        console.log("Audio ended.");
        setIsPlaying(false);
        setIsAudioLoading(false);
        playIntentRef.current = false; // Reset intent

        if (autoplayNext && selectedAudioSurah) {
        const currentSurahId = parseInt(selectedAudioSurah, 10);
        if (!isNaN(currentSurahId) && currentSurahId < 114) {
            const nextSurahId = (currentSurahId + 1).toString();
            console.log(`Autoplay: Setting next surah to ${nextSurahId}`);
            setSelectedAudioSurah(nextSurahId); // Trigger source prep effect
             playIntentRef.current = true; // Set intent to play next
             setIsPlaying(true); // Keep isPlaying true to trigger play in effect
        } else {
            console.log("Autoplay: Reached last surah. Stopping.");
            setAutoplayNext(false);
             playIntentRef.current = false;
        }
        } else {
        console.log("Autoplay is off or no surah selected.");
        setAutoplayNext(false);
         playIntentRef.current = false;
        }
    }, [autoplayNext, selectedAudioSurah]);


    // Error Handler
    const handleAudioError = (e: Event) => {
      console.error("Audio error event:", e); // Log the raw event
      const target = e.target as HTMLAudioElement;
      const error = target.error as MediaError;
      let errorMessage = "حدث خطأ غير معروف أثناء محاولة تشغيل الصوت.";

       // Log additional details for debugging
      console.error(`Audio Error Details: readyState=${target.readyState}, currentSrc='${target.currentSrc}', networkState=${target.networkState}`);

      if (error) {
        console.error(`MediaError code: ${error.code}, message: ${error.message || 'N/A'}`);
        switch (error?.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = hasUserInteracted.current ? 'تم إجهاض عملية جلب الصوت.' : ''; // Only show if user intended play
          break;
          case MediaError.MEDIA_ERR_NETWORK:
             errorMessage = `حدث خطأ في الشبكة أثناء جلب الصوت. تحقق من اتصالك بالإنترنت.`;
          break;
          case MediaError.MEDIA_ERR_DECODE:
             errorMessage = `حدث خطأ أثناء فك تشفير ملف الصوت. قد يكون الملف تالفًا أو غير مدعوم.`;
          console.error(`Detailed DECODE error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
          break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
             errorMessage = `تعذر تحميل أو فك تشفير مصدر الصوت. قد يكون الرابط غير صالح أو أن التنسيق غير مدعوم.`;
           console.error(`Detailed SRC_NOT_SUPPORTED error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
          break;
          default:
            errorMessage = `حدث خطأ غير معروف في الصوت (الكود: ${error.code}).`;
            console.error(`Detailed UNKNOWN error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
          // No break needed for default
        }
      } else {
        console.error("Audio error occurred but MediaError object is null.");
        errorMessage = `حدث خطأ غير متوقع مع مصدر الصوت.`;
      }

      // Reset state consistently on error
      setIsPlaying(false);
      setIsAudioLoading(false);
      setAutoplayNext(false);
      playIntentRef.current = false; // Reset play intent on error

      if (errorMessage) {
        showToast("خطأ في الصوت", errorMessage, "destructive");
      }
    }; // Removed useCallback dependency issue

    // Can Play Handler
    const handleCanPlay = useCallback(() => {
        console.log("Audio canplay.");
        const audio = audioRef.current;
        if (!audio) return;

        setIsAudioLoading(false); // Stop loading indicator

        // If play was intended (user click or autoplay) and it's paused, play it
        if (playIntentRef.current && audio.paused) {
        console.log(`Canplay: Attempting playback (playIntent: true)`);
        audio.play().catch(err => {
            console.error("Error playing on canplay:", err);
            handleAudioError(new Event('error'));
        });
        } else {
             console.log(`Canplay: Play not attempted (playIntent: ${playIntentRef.current}, paused: ${audio.paused})`);
        }
    }, [handleAudioError]); // Removed isPlaying dependency

    // Waiting Handler
    const handleWaiting = useCallback(() => {
        console.log("Audio waiting (buffering)...");
        if (isPlaying && !isAudioLoading) { // Show loader only if actively playing
            setIsAudioLoading(true);
        }
    }, [isPlaying, isAudioLoading]);

    // Playing Handler
    const handlePlaying = useCallback(() => {
        console.log("Audio playing...");
         if (isAudioLoading) setIsAudioLoading(false); // Hide loader once playing starts
         if (!isPlaying) setIsPlaying(true); // Sync state if it starts playing unexpectedly
    }, [isAudioLoading, isPlaying]);

    // Pause Handler
    const handlePause = useCallback(() => {
        const audio = audioRef.current;
        if (audio && !audio.seeking && !audio.ended && !playbackResetting) { // Ignore if resetting
            console.log("Audio paused event.");
            if (isPlaying) {
                setIsPlaying(false); // Reflect paused state
            }
             playIntentRef.current = false; // Reset intent on pause
             if (isAudioLoading) setIsAudioLoading(false); // Stop loading on pause
        } else {
            console.log(`Pause event ignored (seeking/ended/resetting): seeking=${audio?.seeking}, ended=${audio?.ended}, resetting=${playbackResetting}`);
        }
    }, [isPlaying, isAudioLoading, playbackResetting]); // Added playbackResetting

    // Load Start Handler
    const handleLoadStart = useCallback(() => {
        console.log("Audio loadstart event.");
         // Only show loader if play is intended and not already loading
        if (playIntentRef.current && !isAudioLoading) {
            console.log("Loadstart: Play intended, setting loading true.");
            setIsAudioLoading(true);
        } else {
            console.log(`Loadstart: Detected, state unchanged (playIntent: ${playIntentRef.current}, isAudioLoading: ${isAudioLoading}, resetting: ${playbackResetting}).`);
        }
    }, [isAudioLoading, playbackResetting]); // Removed isPlaying dependency

    // Stalled Handler
    const handleStalled = useCallback(() => {
        console.warn("Audio stalled event.");
        if (isPlaying && !isAudioLoading) { // Show loader if playing and stalled
            setIsAudioLoading(true);
        }
    }, [isPlaying, isAudioLoading]);


  // --- Audio Element Initialization and Cleanup ---
  useEffect(() => {
    console.log("Initializing audio element...");
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "metadata"; // Preload metadata only initially
      console.log("Audio element created.");
    }
    const audioElement = audioRef.current;

    const listeners = {
      error: handleAudioError,
      canplay: handleCanPlay,
      waiting: handleWaiting,
      playing: handlePlaying,
      pause: handlePause,
       ended: handleAudioEnd,
      loadstart: handleLoadStart,
      stalled: handleStalled,
    };

    // Add listeners
    Object.entries(listeners).forEach(([event, handler]) => {
      audioElement.addEventListener(event, handler);
    });
    console.log("Event listeners added.");

    // Cleanup function
    return () => {
      console.log("Cleaning up audio element...");
      const audio = audioRef.current;
      if (audio) {
         // Remove listeners
         Object.entries(listeners).forEach(([event, handler]) => {
             audio.removeEventListener(event, handler);
         });
         console.log("Event listeners removed.");
         // Stop playback and release resources
         audio.pause();
         audio.removeAttribute('src'); // Important to prevent memory leaks
         audio.load(); // Reset internal state
         audioRef.current = null; // Allow garbage collection
         console.log("Audio element cleaned up.");
      }
    };
  }, [handleAudioEnd, handleAudioError, handleCanPlay, handleWaiting, handlePlaying, handlePause, handleLoadStart, handleStalled]); // Use stable handlers


  // Reset Playback State Function
    const resetPlaybackState = useCallback(() => {
        console.log("Resetting playback state...");
        setPlaybackResetting(true); // Signal reset start
        const audio = audioRef.current;
        if (audio) {
            if (!audio.paused) {
                audio.pause(); // Let pause handler update state if needed
            }
             // Explicitly clear src and force internal reset BEFORE state updates
            audio.removeAttribute('src');
            audio.load();
            console.log("Audio source cleared and load() called.");
        }
        // Reset state *after* audio element changes
        setIsPlaying(false);
        setIsAudioLoading(false);
        setCurrentAudioUrl('');
        setAutoplayNext(false);
         playIntentRef.current = false;
         // Defer resetting the flag to allow effects to settle
         setTimeout(() => setPlaybackResetting(false), 0);
         console.log("Playback state reset complete.");
    }, []);


  // Effect to select the appropriate Moshaf WHEN reciter changes OR data loads
   useEffect(() => {
     console.log(`Reciter/Data Check: ID=${selectedReciterId}, Data loaded=${!!recitersData}, Loading=${isLoadingReciters}`);
     if (isLoadingReciters || !recitersData?.reciters || !selectedReciterId) {
         if (selectedMoshaf !== undefined) {
             console.log("Clearing selected Moshaf due to loading/missing data.");
             setSelectedMoshaf(undefined);
         }
         return;
     }

     const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
     console.log("Found reciter:", reciter?.name);
     const moshafs = reciter?.moshaf ?? [];
     console.log("Available Moshafs:", moshafs.map(m => ({id: m.id, name: m.name})));

     let moshafToSelect: Moshaf | undefined = undefined;

     if (moshafs.length > 0) {
       // Prefer 'مرتل' if available, otherwise take the first one
       const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
       moshafToSelect = murattalMoshaf || moshafs[0];
       console.log("Auto-selecting Moshaf:", {id: moshafToSelect?.id, name: moshafToSelect?.name});
     } else {
       console.log("No Moshafs available for this reciter.");
        if (isInitialized) { // Only show toast if it wasn't the initial load
            showToast("تنبيه", "لا توجد مصاحف متاحة لهذا القارئ.");
        }
     }

     // Only update state and reset playback if the selected Moshaf *actually* changes
     if (selectedMoshaf?.id !== moshafToSelect?.id) {
         console.log("Updating selected Moshaf state.");
         setSelectedMoshaf(moshafToSelect);
         // When Moshaf changes, reset playback immediately
          resetPlaybackState();
     } else {
        console.log("Selected Moshaf is already the correct one or no moshaf available.");
     }

      // Mark as initialized after the first successful check, even if no moshaf found
      if (!isInitialized) setIsInitialized(true);

   }, [selectedReciterId, recitersData, isLoadingReciters, showToast, selectedMoshaf, resetPlaybackState, isInitialized]); // Added isInitialized


   // Effect to Prepare Audio Source WHEN Moshaf or Surah changes
   useEffect(() => {
        if (playbackResetting) {
            console.log("Source prep effect skipped: Playback reset in progress.");
            return;
        }
        console.log(`Source Prep Effect: Moshaf=${selectedMoshaf?.id}, Surah=${selectedAudioSurah}, CurrentURL='${currentAudioUrl}'`);
        const audio = audioRef.current;

        if (!audio || !selectedMoshaf || !selectedAudioSurah) {
            console.log("Source prep effect skipped: Missing audio element, Moshaf, or Surah.");
             // If selections become invalid after initialization, reset
             if (isInitialized && currentAudioUrl) {
                resetPlaybackState();
            }
            return;
        }

        let newAudioUrl: string;
        try {
            newAudioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
            console.log("Source Prep: Generated URL:", newAudioUrl);
            if (!newAudioUrl) throw new Error("Generated URL is invalid.");
        } catch (error) {
            console.error("Source Prep: Error generating URL:", error);
            showToast("خطأ", `فشل في بناء رابط الصوت: ${(error as Error).message}`, "destructive");
             resetPlaybackState();
            return;
        }

        // Only set source and load if URL is different
        if (newAudioUrl !== currentAudioUrl) {
            console.log(`Source Prep: Setting new audio source: ${newAudioUrl}`);
             // Don't reset playback state here, let the selection change trigger it
            setCurrentAudioUrl(newAudioUrl);
            audio.src = newAudioUrl;
            console.log("Source Prep: Calling audio.load()...");
            audio.load(); // Initiate loading
            console.log("Source Prep: Audio load initiated.");
             // Set loading state immediately if play is intended for this new source
             if (playIntentRef.current) {
                console.log("Source Prep: Play intended for new source, setting loading state.");
                if (!isAudioLoading) setIsAudioLoading(true);
            }
        } else {
            console.log("Source Prep: Audio source is already correct.");
        }
    }, [selectedMoshaf, selectedAudioSurah, currentAudioUrl, resetPlaybackState, showToast, playbackResetting, isAudioLoading]); // Removed isPlaying dependency


   // Effect to handle Play/Pause based on isPlaying *intent* state
   useEffect(() => {
     const audio = audioRef.current;
     if (!audio || playbackResetting) { // Skip if resetting
        console.log(`Play Intent Effect skipped: Audio element not ready or resetting (resetting: ${playbackResetting})`);
         return;
     }

     console.log(`Play Intent Effect: playIntent=${playIntentRef.current}, isPlaying=${isPlaying}, paused=${audio.paused}, loading=${isAudioLoading}, readyState=${audio.readyState}, currentSrc='${audio.currentSrc}'`);

     if (playIntentRef.current) { // Check intent ref
       // Intention is to play
       if (audio.paused) {
         // Check if source is set and ready enough to play
         if (audio.currentSrc && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
           console.log("Play Intent Effect: Intent=Play, Paused, Ready. Calling play().");
           audio.play().catch(err => {
             console.error("Error in play intent effect:", err);
             handleAudioError(new Event('error'));
           });
           // 'playing' event will handle isAudioLoading=false
         } else if (!audio.currentSrc) {
            console.log("Play Intent Effect: Intent=Play, Paused, No source. Waiting for source prep.");
             // If no src, loading should be handled by source prep
         } else {
           // Source is set but not ready (readyState < HAVE_METADATA)
           console.log("Play Intent Effect: Intent=Play, Paused, Not ready. Waiting for 'canplay'. Setting loading state.");
           if (!isAudioLoading) setIsAudioLoading(true);
         }
       } else {
         // Already playing, ensure loading indicator is off
         console.log("Play Intent Effect: Intent=Play, Already playing.");
         if (isAudioLoading) setIsAudioLoading(false);
          if (!isPlaying) setIsPlaying(true); // Sync if needed
       }
     } else {
       // Intention is to pause
       if (!audio.paused) {
         console.log("Play Intent Effect: Intent=Pause, Playing. Calling pause().");
         audio.pause(); // Let the 'pause' event handler manage state
       } else {
         console.log("Play Intent Effect: Intent=Pause, Already paused.");
          if (isPlaying) setIsPlaying(false); // Sync if needed
       }
       // Ensure loading is off if pausing
       if (isAudioLoading) setIsAudioLoading(false);
     }
   }, [isPlaying, handleAudioError, isAudioLoading, playbackResetting]); // Depend on isPlaying, handlers, loading state, and reset flag


  // Update audio volume effect
  useEffect(() => {
    if (audioRef.current) {
      const newVolume = isMuted ? 0 : volume / 100;
      console.log(`Setting volume: ${newVolume} (muted: ${isMuted}, slider: ${volume})`)
      audioRef.current.volume = newVolume;
    }
  }, [volume, isMuted]);


  // --- UI Event Handlers ---
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    console.log(`Play/Pause clicked. Current state: isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}, src=${audio?.currentSrc}, readyState=${audio?.readyState}, playIntent=${playIntentRef.current}`);
    hasUserInteracted.current = true;

    if (!selectedMoshaf || !selectedAudioSurah) {
      showToast("تنبيه", "الرجاء اختيار القارئ والسورة أولاً.");
      return;
    }
    if (!audio) {
      console.error("Play/Pause clicked but audio element is null!");
      return;
    }

    const newPlayIntent = !playIntentRef.current; // Toggle the *intent*
    playIntentRef.current = newPlayIntent;
    setIsPlaying(newPlayIntent); // Update the state to reflect the new intent


    // If intending to play, but not loading and not ready, show loader immediately
    if (newPlayIntent && !isAudioLoading && audio.readyState < HTMLMediaElement.HAVE_METADATA) {
        console.log("Play/Pause Click: Intending to play, but source not ready. Setting loading.");
        setIsAudioLoading(true);
        // If network state looks bad, try reloading the source
        if (audio.networkState === HTMLMediaElement.NETWORK_IDLE || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
             console.log("Play/Pause Click: Network issue detected, attempting load().");
             audio.load();
         }
    }
     // Enable/disable autoplay based on the *new* playing intent
    setAutoplayNext(newPlayIntent);

  }, [isPlaying, isAudioLoading, selectedMoshaf, selectedAudioSurah, showToast]);


  const handleReciterChange = useCallback((value: string) => {
    console.log("Selected Reciter changed:", value);
    if (value !== selectedReciterId) {
      setSelectedReciterId(value);
      // Moshaf selection and playback reset are handled by the useEffect hooks
    }
  }, [selectedReciterId]);

  const handleSurahChange = useCallback((value: string) => {
    console.log("Selected Audio Surah changed:", value);
    if (value !== selectedAudioSurah) {
         // Keep the current play intent, source prep effect handles loading new surah
         setSelectedAudioSurah(value);
          // If currently playing, set intent to continue playing the new surah
         if (isPlaying) {
            playIntentRef.current = true;
        }
        // Resetting playback state is handled implicitly by source prep effect triggering a reset
    }
  }, [selectedAudioSurah, isPlaying]);


  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (isMuted && newVolume > 0) setIsMuted(false);
    else if (!isMuted && newVolume === 0) setIsMuted(true);
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (!newMutedState && volume === 0) setVolume(10); // Unmute to a minimum volume
  };

  // Download Handler
  const handleDownload = useCallback(() => {
    if (!currentAudioUrl) {
      showToast("تنبيه", "لا يوجد ملف صوتي محدد للتحميل.");
      return;
    }
    if (!selectedMoshaf || !selectedAudioSurah || !recitersData) {
         showToast("تنبيه", "معلومات القارئ أو السورة غير متوفرة للتحميل.");
         return;
    }

    try {
        const reciterName = recitersData.reciters.find(r => r.id.toString() === selectedReciterId)?.name || 'Reciter';
        const surahName = quranSurahs.find(s => s.id.toString() === selectedAudioSurah)?.name || 'Surah';
        const surahNumber = selectedAudioSurah.padStart(3, '0'); // Format to 001, 002 etc.

        const suggestedFilename = `${surahNumber}_${surahName}_${reciterName.replace(/\s+/g, '_')}.mp3`;

         // Create a temporary link element
        const link = document.createElement('a');
        link.href = currentAudioUrl;
         // Set the download attribute with the suggested filename
         link.download = suggestedFilename;

         // Append to the document, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log(`Download initiated for: ${suggestedFilename}`);
    } catch (error) {
         console.error("Error initiating download:", error);
         showToast("خطأ", "فشل في بدء عملية التحميل.", "destructive");
    }
  }, [currentAudioUrl, selectedReciterId, selectedAudioSurah, selectedMoshaf, recitersData, showToast]);


  // Determine if play/download buttons should be disabled
  const isControlDisabled = !isInitialized || (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah || isLoadingReciters );


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        {isMobile && <SidebarTrigger icon={Menu} />}
      </div>

      <div className="flex items-center gap-4">
        {/* Reciter and Surah Selectors */}
        <div className="flex items-center gap-2">
          {isLoadingReciters ? (
            <Skeleton className="h-10 w-[180px]" />
          ) : recitersError ? (
            <div className="w-[180px] text-destructive text-xs px-2 py-1 border border-destructive rounded-md text-center font-cairo">
              {(recitersError as Error)?.message || 'خطأ تحميل القراء'}
            </div>
          ) : (
            sortedReciters.length > 0 ? (
              <Select value={selectedReciterId} onValueChange={handleReciterChange} dir="rtl">
                <SelectTrigger className="w-[180px] font-cairo">
                  <SelectValue placeholder="اختر القارئ" />
                </SelectTrigger>
                <SelectContent>
                  {sortedReciters.map((reciter) => (
                    <SelectItem key={reciter.id} value={reciter.id.toString()} className="font-cairo">
                      {reciter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
                 <Skeleton className="h-10 w-[180px]" /> // Show skeleton if data is empty after load
            )
          )}

          <Select value={selectedAudioSurah} onValueChange={handleSurahChange} dir="rtl">
            <SelectTrigger className="w-[150px] font-cairo">
              <SelectValue placeholder="اختر سورة" />
            </SelectTrigger>
            <SelectContent>
              {quranSurahs.map((surah) => (
                <SelectItem key={surah.id} value={surah.id.toString()} className="font-cairo">
                  {surah.id}. {surah.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Play/Pause Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
               <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={isControlDisabled}>
                 {isAudioLoading ? <Loader2 className="animate-spin h-5 w-5" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                 <span className="sr-only">{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
               </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className='font-cairo'>{isControlDisabled ? 'يرجى الانتظار أو تحديد القارئ/السورة' : (isAudioLoading ? 'جاري التحميل...' : (isPlaying ? 'إيقاف مؤقت' : 'تشغيل'))}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

         {/* Download Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleDownload} disabled={isControlDisabled || !currentAudioUrl}>
                <Download className="h-5 w-5" />
                <span className="sr-only">تحميل</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className='font-cairo'>{isControlDisabled || !currentAudioUrl ? 'التحميل غير متاح' : 'تحميل التلاوة الحالية'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>


        {/* Volume Control */}
        <div className="flex items-center gap-2 w-32">
          <Slider
            dir="ltr" // Keep LTR for visual slider direction
            value={[isMuted ? 0 : volume]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className="w-full cursor-pointer"
            aria-label="التحكم في مستوى الصوت"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  <span className="sr-only">{isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className='font-cairo'>{isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Sources and References Dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <BookOpen className="h-5 w-5" />
              <span className="sr-only">المصادر والمراجع</span>
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="sm:max-w-[525px] font-cairo bg-card text-card-foreground border-border">
            <DialogHeader>
              <DialogTitle className="text-right text-xl mb-4 font-cairo">المصادر والمراجع</DialogTitle>
            </DialogHeader>
             <DialogDescription asChild>
               <div className="space-y-5 text-right pr-2">
                 <div>
                   <h3 className="font-semibold text-lg mb-2 font-cairo">مصادر النصوص القرآنية (الملفات):</h3>
                   <a href="https://qurancomplex.gov.sa/techquran/dev/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block break-words font-cairo">
                     بوابة المصحف الإلكتروني بمجمع الملك فهد لطباعة المصحف الشريف
                   </a>
                   <p className="text-sm text-muted-foreground mt-1 font-cairo">تم استخدام ملفات النصوص المتوفرة للروايات المختلفة (حفص، ورش، قالون).</p>
                 </div>
                 <div>
                   <h3 className="font-semibold text-lg mb-2 font-cairo">مصدر واجهة برمجة التطبيقات الصوتية للقرآن الكريم:</h3>
                   <a href="https://mp3quran.net/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block break-words font-cairo">
                     mp3quran.net
                   </a>
                 </div>
                 <div>
                   <h3 className="font-semibold text-lg mb-2 font-cairo">تحميل خطوط القرآن المستخدمة في التطبيق (KFGQPC):</h3>
                   <a href="https://drive.google.com/file/d/1x4JKWT7Sq1F-rZL0cbe38G_10FuD5dQc/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block break-words font-cairo">
                     <Download className="inline-block h-4 w-4 ml-1" />
                     رابط التحميل (Google Drive)
                   </a>
                   <span className="text-xs text-muted-foreground block mt-1 font-cairo">(ملاحظة: سيتم فتح الرابط في نافذة جديدة. تأكد من وضع الخطوط في مجلد `public/fonts`.)</span>
                 </div>
                  <hr className="my-4 border-border" />
                  <div>
                   <h3 className="font-semibold text-lg mb-2 font-cairo">للتواصل والاستفسارات:</h3>
                   <a href="mailto:darrati10@gmail.com" className="text-primary underline hover:text-primary/80 block break-words font-cairo">
                     darrati10@gmail.com
                   </a>
                  </div>
                 <p className="text-sm text-muted-foreground pt-4 font-cairo">تم بناء هذا التطبيق باستخدام Next.js و Shadcn/UI و Tailwind CSS.</p>
               </div>
             </DialogDescription>
            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button type="button" variant="secondary" className="font-cairo">
                  إغلاق
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
