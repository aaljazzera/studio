
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
  Download,
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
  const [autoplayNext, setAutoplayNext] = useState<boolean>(false); // Flag for autoplaying next surah
  const [resetting, setResetting] = useState<boolean>(false); // Track if resetting playback
  const [playIntent, setPlayIntent] = useState(false); // Explicit intent to play

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMobile } = useSidebar();
  const { toast } = useToast();
  const lastErrorRef = useRef<string | null>(null);
  const hasUserInteracted = useRef(false); // Track if user explicitly clicked play/pause


  // Fetch reciters
  const { data: recitersData, isLoading: isLoadingReciters, error: recitersError } = useQuery({
    queryKey: ['reciters'],
    queryFn: () => fetchReciters('ar'),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // --- Utility Functions ---
  const showToast = useCallback((title: string, description: string, variant: "default" | "destructive" = "default") => {
    // Debounce destructive toasts with the same message
    if (variant === "destructive" && description === lastErrorRef.current) {
      return;
    }
    toast({ title, description, variant });
    if (variant === "destructive") {
      lastErrorRef.current = description;
      setTimeout(() => { lastErrorRef.current = null; }, 5000);
    }
  }, [toast]);

  // --- Audio Event Handlers (Stable References) ---
  const handleAudioEnd = useCallback(() => {
    console.log("Audio ended.");
    setIsPlaying(false);
    setIsAudioLoading(false);
    setPlayIntent(false); // Reset play intent

    if (autoplayNext && selectedAudioSurah) {
      const currentSurahId = parseInt(selectedAudioSurah, 10);
      if (!isNaN(currentSurahId) && currentSurahId < 114) {
        const nextSurahId = (currentSurahId + 1).toString();
        console.log(`Autoplay: Setting next surah to ${nextSurahId}`);
        setSelectedAudioSurah(nextSurahId);
        setPlayIntent(true); // Set intent to play next surah
        // Keep autoplayNext true to continue playback chain
      } else {
        console.log("Autoplay: Reached last surah. Stopping.");
        setAutoplayNext(false); // Stop autoplay chain
       }
    } else {
      setAutoplayNext(false); // Ensure autoplay is off if not intended or at end
    }
  }, [autoplayNext, selectedAudioSurah]);

  // Error Handler
    const handleAudioError = useCallback((e: Event) => {
      console.error("Audio error event:", e); // Log the raw event
      const target = e.target as HTMLAudioElement;
      const error = target.error as MediaError; // Cast error to MediaError
      let errorMessage = "حدث خطأ غير معروف أثناء محاولة تشغيل الصوت.";

      // Log additional details for debugging
      console.error(`Audio Error Details: readyState=${target.readyState}, currentSrc='${target.currentSrc}', networkState=${target.networkState}`);

      if (error) { // Check if error object exists
        console.error(`MediaError code: ${error.code}, message: ${error.message || 'N/A'}`);
        switch (error?.code) { // Use error.code directly
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = hasUserInteracted.current ? 'تم إجهاض عملية جلب الصوت.' : ''; // Only show if user intended play
            break; // Added break statement
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = `حدث خطأ في الشبكة أثناء جلب الصوت. تحقق من اتصالك بالإنترنت.`;
            break; // Added break statement
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = `حدث خطأ أثناء فك تشفير ملف الصوت. قد يكون الملف تالفًا أو غير مدعوم.`;
            console.error(`Detailed DECODE error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
            break; // Added break statement
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = `تعذر تحميل أو فك تشفير مصدر الصوت. قد يكون الرابط غير صالح أو أن التنسيق غير مدعوم.`;
            console.error(`Detailed SRC_NOT_SUPPORTED error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
            break; // Added break statement
          default:
            errorMessage = `حدث خطأ غير معروف في الصوت (الكود: ${error.code}).`;
            console.error(`Detailed UNKNOWN error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
            // No break needed for default
        }
      } else {
        console.error("Audio error occurred but MediaError object is null.");
        errorMessage = `حدث خطأ غير متوقع مع مصدر الصوت.`;
      }

      // Always reset state on error
      setIsPlaying(false);
      setIsAudioLoading(false);
      setAutoplayNext(false); // Stop autoplay on error
      setPlayIntent(false); // Reset play intent

      // Show toast only if there's a relevant error message
      if (errorMessage) {
        showToast("خطأ في الصوت", errorMessage, "destructive");
      }
    }, [showToast]); // Dependency array


  const handleCanPlay = useCallback(() => {
    console.log("Audio canplay.");
    const audio = audioRef.current;
    if (!audio || resetting) return;

    setIsAudioLoading(false); // Stop loading indicator

    // If playIntent is true and the audio is paused, attempt to play
    if (playIntent && audio.paused) {
      console.log(`Canplay: Attempting playback (playIntent: ${playIntent})`);
      audio.play().catch(err => {
        console.error("Error playing on canplay:", err);
        handleAudioError(new Event('error')); // Simulate error
      });
    } else if (!playIntent && !audio.paused) {
       console.log("Canplay: Pausing because playIntent is false.");
       audio.pause();
    }
  }, [playIntent, handleAudioError, resetting]); // Added resetting

  const handleWaiting = useCallback(() => {
    console.log("Audio waiting (buffering)...");
    if (playIntent && !isAudioLoading && !resetting) { // Show loading only if we intend to play and not resetting
        setIsAudioLoading(true);
    }
  }, [playIntent, isAudioLoading, resetting]); // Added resetting

  const handlePlaying = useCallback(() => {
    console.log("Audio playing...");
    if (resetting) return; // Ignore during reset
    if (isAudioLoading) setIsAudioLoading(false);
    if (!isPlaying) setIsPlaying(true); // Sync playing state
  }, [isAudioLoading, isPlaying, resetting]); // Added resetting

  const handlePause = useCallback(() => {
     const audio = audioRef.current;
     if (audio && !audio.seeking && !audio.ended && !resetting) { // Ignore if seeking, ended, or resetting
       console.log("Audio paused event.");
       if (isPlaying) setIsPlaying(false); // Sync playing state
       if (isAudioLoading) setIsAudioLoading(false); // Also stop loading indicator on pause
       setPlayIntent(false); // Explicitly set intent to false on pause
     } else {
        console.log(`Pause event ignored (seeking/ended/resetting/null): seeking=${audio?.seeking}, ended=${audio?.ended}, resetting=${resetting}`);
     }
  }, [isPlaying, isAudioLoading, resetting]); // Added resetting

  const handleLoadStart = useCallback(() => {
     console.log("Audio loadstart event.");
     if (playIntent && !isAudioLoading && !resetting) { // Only show loader if intending to play and not resetting
         setIsAudioLoading(true);
     } else {
         console.log(`Loadstart: Detected, state unchanged (playIntent: ${playIntent}, isAudioLoading: ${isAudioLoading}, resetting: ${resetting}).`);
     }
  }, [playIntent, isAudioLoading, resetting]); // Added resetting

  const handleStalled = useCallback(() => {
    console.warn("Audio stalled event.");
    if (playIntent && !isAudioLoading && !resetting ) { // Show loading if intending to play, not loading, and not resetting
        setIsAudioLoading(true);
    }
  }, [playIntent, isAudioLoading, resetting]); // Added resetting

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

    // Cleanup: remove listeners and potentially pause/reset audio
    return () => {
      console.log("Cleaning up audio element...");
      const audio = audioRef.current; // Capture ref before potential async cleanup
      if (audio) {
         Object.entries(listeners).forEach(([event, handler]) => {
             audio.removeEventListener(event, handler);
         });
         console.log("Event listeners removed.");
        // Consider pausing and removing src on unmount if appropriate
        // audio.pause();
        // audio.removeAttribute('src');
        // audio.load();
      }
      // audioRef.current = null; // Optionally nullify ref on unmount
    };
  }, [handleAudioEnd, handleAudioError, handleCanPlay, handleWaiting, handlePlaying, handlePause, handleLoadStart, handleStalled]); // Stable handler refs

  // Reset Playback State Function
  const resetPlaybackState = useCallback(() => {
    console.log("Resetting playback state...");
    setResetting(true); // Mark start of reset
    const audio = audioRef.current;
    if (audio) {
      audio.pause(); // Let pause handler update state
      audio.removeAttribute('src');
      audio.load(); // Important: tells browser to reset internal state
      console.log("Audio source cleared and load() called.");
    }
    setIsPlaying(false);
    setIsAudioLoading(false);
    setCurrentAudioUrl('');
    setPlayIntent(false); // Reset intent
    setAutoplayNext(false); // Stop autoplay chain on manual change
    // Finish reset after a short delay
    setTimeout(() => setResetting(false), 50);
  }, []); // Empty dependency array, relies on current scope

  // Effect to select the appropriate Moshaf
  useEffect(() => {
    console.log(`Reciter/Data Check: ID=${selectedReciterId}, Data loaded=${!!recitersData}, Loading=${isLoadingReciters}`);
    if (!selectedReciterId || !recitersData?.reciters || isLoadingReciters) return;

    const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
    console.log("Found reciter:", reciter?.name);
    const moshafs = reciter?.moshaf ?? [];
    console.log("Available Moshafs:", moshafs.map(m => ({id: m.id, name: m.name})));

    let moshafToSelect: Moshaf | undefined = undefined;

    if (moshafs.length > 0) {
      const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
      moshafToSelect = murattalMoshaf || moshafs[0];
      console.log("Auto-selecting Moshaf:", {id: moshafToSelect?.id, name: moshafToSelect?.name});
    } else {
      console.log("No Moshafs available for this reciter.");
      if (!isLoadingReciters) {
          showToast("تنبيه", "لا توجد مصاحف متاحة لهذا القارئ.");
      }
    }

    if (selectedMoshaf?.id !== moshafToSelect?.id) {
        console.log("Updating selected Moshaf state.");
        setSelectedMoshaf(moshafToSelect);
        // Resetting playback state here ensures clean transition when Moshaf changes
        // Especially if the previous Moshaf was playing.
        resetPlaybackState();
    } else {
      console.log("Selected Moshaf is already the correct one.");
    }
  }, [selectedReciterId, recitersData, isLoadingReciters, showToast, selectedMoshaf, resetPlaybackState]); // Added resetPlaybackState

  // Effect to Prepare and Load Audio Source
  useEffect(() => {
    const audio = audioRef.current;
    console.log(`Source Prep Effect: Moshaf=${selectedMoshaf?.id}, Surah=${selectedAudioSurah}, CurrentURL='${currentAudioUrl}'`);

    if (resetting || !audio) {
      console.log("Source prep effect skipped: Playback reset in progress or no audio element.");
      return; // Skip if resetting or no audio element
    }
    if (!selectedMoshaf || !selectedAudioSurah) {
      console.log("Source Prep: Moshaf or Surah not selected, skipping.");
      if (currentAudioUrl) {
        resetPlaybackState(); // Reset if selections become invalid
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

    // Only update if URL is different
    if (newAudioUrl !== currentAudioUrl) {
      console.log(`Source Prep: Setting new audio source: ${newAudioUrl}`);
      setCurrentAudioUrl(newAudioUrl);
      audio.src = newAudioUrl;
      // Don't auto-load here, let play intent or user action trigger load
      // If playIntent is true, load will be triggered by play() attempt
      if (playIntent) {
          console.log("Source Prep: Play intent is true, setting loading state.");
          if (!isAudioLoading) setIsAudioLoading(true);
      }
       console.log("Source Prep: Calling audio.load()...");
       audio.load(); // Initiate loading the new source
       console.log("Source Prep: Audio load initiated.");
    } else {
      console.log("Source Prep: Audio source is already correct.");
       // If play intent is set for the *same* track (e.g., replay), ensure it plays
       if (playIntent && audio.paused && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            console.log("Source Prep: Play intent for same ready source, attempting play.");
            if (!isAudioLoading) setIsAudioLoading(true); // Show loading briefly
            audio.play().catch(err => {
                console.error("Error retrying play:", err);
                handleAudioError(new Event('error'));
            });
       }
    }
  }, [selectedMoshaf, selectedAudioSurah, currentAudioUrl, resetPlaybackState, showToast, playIntent, isAudioLoading, handleAudioError, resetting]); // Added resetting

  // Effect to trigger playback based on playIntent
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    console.log(`Play Intent Effect: playIntent=${playIntent}, isPlaying=${isPlaying}, paused=${audio.paused}, loading=${isAudioLoading}, readyState=${audio.readyState}, currentSrc='${audio.currentSrc}'`);

    if (playIntent && audio.paused) {
       if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            console.log("Play Intent Effect: Intent=Play, Paused, Ready. Calling play().");
             if (!isAudioLoading) setIsAudioLoading(true); // Show loading until 'playing' event
             audio.play().catch(err => {
                 console.error("Error in play intent effect:", err);
                 handleAudioError(new Event('error')); // Use the generic error handler
             });
        } else if (audio.readyState === HTMLMediaElement.HAVE_NOTHING && audio.currentSrc) {
            // If source is set but nothing loaded, trigger load again
             console.log("Play Intent Effect: Intent=Play, Paused, HAVE_NOTHING. Re-triggering load().");
             if (!isAudioLoading) setIsAudioLoading(true);
             audio.load();
        } else {
           // Not ready enough to play, wait for 'canplay'
           console.log("Play Intent Effect: Intent=Play, Paused, Not ready enough. Waiting for 'canplay'.");
           if (!isAudioLoading) setIsAudioLoading(true); // Ensure loading indicator is shown
        }
    } else if (!playIntent && !audio.paused) {
       console.log("Play Intent Effect: Intent=Pause, Playing. Calling pause().");
       audio.pause();
       if (isAudioLoading) setIsAudioLoading(false); // Ensure loading indicator is off
    } else if (playIntent && !audio.paused) {
        console.log("Play Intent Effect: Intent=Play, Already playing.");
        if (isAudioLoading) setIsAudioLoading(false); // Ensure loading indicator is off
    } else { // !playIntent && audio.paused
        console.log("Play Intent Effect: Intent=Pause, Already paused.");
         if (isAudioLoading) setIsAudioLoading(false); // Ensure loading indicator is off
    }
  }, [playIntent, handleAudioError, isAudioLoading]); // Depend on playIntent and handler


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
    console.log(`Play/Pause clicked. Current state: isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}, src=${audio?.currentSrc}, readyState=${audio?.readyState}, playIntent=${playIntent}`);
    hasUserInteracted.current = true; // Mark user interaction

    if (!selectedMoshaf || !selectedAudioSurah) {
      showToast("تنبيه", "الرجاء اختيار القارئ والسورة أولاً.");
      return;
    }
    if (!audio) {
      console.error("Play/Pause clicked but audio element is null!");
      return;
    }

    const newPlayIntent = !playIntent;
    setPlayIntent(newPlayIntent); // Toggle the play intent
    setAutoplayNext(newPlayIntent); // Sync autoplay with intent

    // If intending to play, but source isn't ready/set, ensure loading shows
     const targetUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
     if (newPlayIntent && (!audio.currentSrc || audio.currentSrc !== targetUrl || audio.readyState < HTMLMediaElement.HAVE_METADATA)) {
         console.log("Play/Pause Click: Intending to play, but source not ready/mismatched. Setting loading.");
         if (!isAudioLoading) setIsAudioLoading(true);
          // Trigger load if necessary (e.g., if networkState indicates idle or error)
          if (audio.networkState === HTMLMediaElement.NETWORK_IDLE || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
             console.log("Play/Pause Click: Re-triggering load() due to network state.");
             audio.load();
          }
     }

  }, [playIntent, isAudioLoading, selectedMoshaf, selectedAudioSurah, showToast]); // Depend on playIntent


  const handleReciterChange = useCallback((value: string) => {
    console.log("Selected Reciter changed:", value);
    resetPlaybackState(); // Reset fully before changing reciter
    setSelectedReciterId(value);
    // Moshaf selection and source preparation will follow in effects
  }, [resetPlaybackState]); // Added resetPlaybackState

  const handleSurahChange = useCallback((value: string) => {
    console.log("Selected Audio Surah changed:", value);
    const wasPlaying = playIntent; // Capture intent before reset
    resetPlaybackState();
    setSelectedAudioSurah(value);
     // Restore play intent if user was playing before changing surah
     if (wasPlaying) {
       console.log("Restoring play intent after surah change.");
       setPlayIntent(true);
       setAutoplayNext(true); // Also ensure autoplay continues if it was active
     }
  }, [resetPlaybackState, playIntent]); // Added playIntent


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

  // Determine if play button should be disabled
  const isPlayDisabled = (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah || isLoadingReciters || resetting);


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        {isMobile && <SidebarTrigger icon={Menu} />}
      </div>

      <div className="flex items-center gap-4">
        {/* Reciter and Surah Selectors */}
        <div className="flex items-center gap-2">
          {isLoadingReciters ? (
            <Skeleton className="h-10 w-[180px]" />
          ) : recitersError ? (
            <div className="w-[180px] text-destructive text-xs px-2 py-1 border border-destructive rounded-md text-center">
              {(recitersError as Error)?.message || 'خطأ في تحميل القراء'}
            </div>
          ) : (
             // Ensure Select components rerender if recitersData changes by using a key or checking data length
            recitersData?.reciters?.length > 0 ? (
              <Select value={selectedReciterId} onValueChange={handleReciterChange} dir="rtl">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="اختر القارئ" />
                </SelectTrigger>
                <SelectContent>
                  {recitersData.reciters.map((reciter) => (
                    <SelectItem key={reciter.id} value={reciter.id.toString()}>
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
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="اختر سورة" />
            </SelectTrigger>
            <SelectContent>
              {quranSurahs.map((surah) => (
                <SelectItem key={surah.id} value={surah.id.toString()}>
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
               {/* Use isPlaying state to determine icon */}
               <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={isPlayDisabled}>
                 {isAudioLoading ? <Loader2 className="animate-spin h-5 w-5" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                 <span className="sr-only">{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
               </Button>
            </TooltipTrigger>
            <TooltipContent>
              {/* Use isPlaying state for tooltip text */}
              <p>{isPlayDisabled ? 'يرجى تحديد القارئ والسورة' : (isAudioLoading ? 'جاري التحميل...' : (isPlaying ? 'إيقاف مؤقت' : 'تشغيل'))}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Volume Control */}
        <div className="flex items-center gap-2 w-32">
          <Slider
            dir="ltr" // Keep LTR for slider directionality
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
                <p>{isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}</p>
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
          <DialogContent dir="rtl" className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle className="text-right text-xl mb-4">المصادر والمراجع</DialogTitle>
            </DialogHeader>
             <DialogDescription asChild>
               <div className="space-y-5 text-right pr-2">
                 <div>
                   <h3 className="font-semibold text-lg mb-2">مصادر النصوص القرآنية (الملفات):</h3>
                   <a href="https://qurancomplex.gov.sa/techquran/dev/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block break-words">
                     بوابة المصحف الإلكتروني بمجمع الملك فهد لطباعة المصحف الشريف
                   </a>
                   <p className="text-sm text-muted-foreground mt-1">تم استخدام ملفات النصوص المتوفرة للروايات المختلفة (حفص، ورش، قالون).</p>
                 </div>
                 <div>
                   <h3 className="font-semibold text-lg mb-2">مصدر واجهة برمجة التطبيقات الصوتية للقرآن الكريم:</h3>
                   <a href="https://mp3quran.net/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block break-words">
                     mp3quran.net
                   </a>
                 </div>
                 <div>
                   <h3 className="font-semibold text-lg mb-2">تحميل خطوط القرآن المستخدمة في التطبيق (KFGQPC):</h3>
                   <a href="https://drive.google.com/file/d/1x4JKWT7Sq1F-rZL0cbe38G_10FuD5dQc/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block break-words">
                     <Download className="inline-block h-4 w-4 ml-1" />
                     رابط التحميل (Google Drive)
                   </a>
                   <span className="text-xs text-muted-foreground block mt-1">(ملاحظة: سيتم فتح الرابط في نافذة جديدة. تأكد من وضع الخطوط في مجلد `public/fonts`.)</span>
                 </div>
                  <hr className="my-4 border-border" />
                  <div>
                   <h3 className="font-semibold text-lg mb-2">للتواصل والاستفسارات:</h3>
                   <a href="mailto:darrati10@gmail.com" className="text-primary underline hover:text-primary/80 block break-words">
                     darrati10@gmail.com
                   </a>
                  </div>
                 <p className="text-sm text-muted-foreground pt-4">تم بناء هذا التطبيق باستخدام Next.js و Shadcn/UI و Tailwind CSS.</p>
               </div>
             </DialogDescription>
            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
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
