
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
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [autoplayNext, setAutoplayNext] = useState<boolean>(false); // Flag for autoplaying next surah

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

    if (autoplayNext && selectedAudioSurah) {
      const currentSurahId = parseInt(selectedAudioSurah, 10);
      if (!isNaN(currentSurahId) && currentSurahId < 114) {
        const nextSurahId = (currentSurahId + 1).toString();
        console.log(`Autoplay: Setting next surah to ${nextSurahId}`);
        setSelectedAudioSurah(nextSurahId);
        // Keep autoplayNext true to continue playback chain
      } else {
        console.log("Autoplay: Reached last surah. Stopping.");
        setAutoplayNext(false); // Stop autoplay chain
      }
    } else {
      setAutoplayNext(false); // Ensure autoplay is off if not intended or at end
    }
  }, [autoplayNext, selectedAudioSurah]); // Added autoplayNext

  const handleAudioError = useCallback((e: Event) => {
    console.error("Audio error event:", e); // Log the raw event
    const target = e.target as HTMLAudioElement;
    const error = target.error;
    let errorMessage = "حدث خطأ غير معروف أثناء محاولة تشغيل الصوت.";

    // Log additional details for debugging
    console.error(`Audio Error Details: readyState=${target.readyState}, currentSrc='${target.currentSrc}', networkState=${target.networkState}`);

    if (error) {
      console.error(`MediaError code: ${error.code}, message: ${error.message || 'N/A'}`);
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = hasUserInteracted.current ? 'تم إجهاض عملية جلب الصوت.' : ''; // Only show if user intended play
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = `حدث خطأ في الشبكة أثناء جلب الصوت. تحقق من اتصالك.`;
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
      }
    } else {
      console.error("Audio error occurred but MediaError object is null.");
      errorMessage = `حدث خطأ غير متوقع مع مصدر الصوت.`;
    }

    setIsPlaying(false);
    setIsAudioLoading(false);
    setAutoplayNext(false); // Stop autoplay on error

    if (errorMessage) {
      showToast("خطأ في الصوت", errorMessage, "destructive");
    }
  }, [showToast]); // Removed hasUserInteracted ref dependency


  const handleCanPlay = useCallback(() => {
    console.log("Audio canplay.");
    const audio = audioRef.current;
    if (!audio) return;

    setIsAudioLoading(false); // Stop loading indicator

    // If autoplay was intended for the *next* track, start playing.
    // Or if the user explicitly clicked play (isPlaying reflects this intent now)
    if ((autoplayNext || isPlaying) && audio.paused) {
      console.log(`Canplay: Attempting playback (autoplayNext: ${autoplayNext}, isPlaying: ${isPlaying})`);
      audio.play().catch(err => {
        console.error("Error resuming playback on canplay:", err);
        handleAudioError(new Event('error')); // Simulate error
      });
    } else if (!isPlaying && !audio.paused) {
        console.log("Canplay: Pausing because isPlaying is false.");
        audio.pause();
    }
  }, [isPlaying, autoplayNext, handleAudioError]); // Added isPlaying, autoplayNext

  const handleWaiting = useCallback(() => {
    console.log("Audio waiting (buffering)...");
    if (isPlaying && !isAudioLoading) { // Show loading only if we intend to play
        setIsAudioLoading(true);
    }
  }, [isPlaying, isAudioLoading]);

  const handlePlaying = useCallback(() => {
    console.log("Audio playing.");
    if (isAudioLoading) setIsAudioLoading(false);
    if (!isPlaying) setIsPlaying(true); // Sync state if play starts unexpectedly
  }, [isAudioLoading, isPlaying]);

  const handlePause = useCallback(() => {
     const audio = audioRef.current;
     // Check if pause is legitimate (not due to seeking, ending, error handling/reset)
     if (audio && !audio.seeking && !audio.ended) {
       console.log("Audio paused event.");
       // Only update state if it's currently marked as playing
       if (isPlaying) setIsPlaying(false);
       if (isAudioLoading) setIsAudioLoading(false); // Also stop loading indicator on pause
     } else {
        console.log("Pause event ignored (seeking/ended/resetting/null).");
     }
  }, [isPlaying, isAudioLoading]);

  const handleLoadStart = useCallback(() => {
    console.log("Audio loadstart event.");
    // Show loader immediately only if playback is currently intended
    if (isPlaying && !isAudioLoading) {
        console.log("Loadstart: Play intended, setting loading true.");
        setIsAudioLoading(true);
    } else {
         console.log(`Loadstart: Detected, state unchanged (isPlaying: ${isPlaying}, isAudioLoading: ${isAudioLoading}).`);
    }
  }, [isPlaying, isAudioLoading]);

  const handleStalled = useCallback(() => {
    console.warn("Audio stalled event.");
    if (isPlaying && !isAudioLoading) { // Show loading if playing and stalled
        setIsAudioLoading(true);
    }
  }, [isPlaying, isAudioLoading]);

  // --- Effects ---

  // Initialize Audio Element & Attach Listeners
  useEffect(() => {
    console.log("Initializing audio element...");
    // Ensure only one audio element is created
    if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.preload = 'metadata'; // Start loading metadata immediately
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

    // Cleanup: remove listeners
    return () => {
      console.log("Cleaning up audio element listeners...");
      const currentAudio = audioRef.current; // Use ref in cleanup
      if (currentAudio) {
          Object.entries(listeners).forEach(([event, handler]) => {
            currentAudio.removeEventListener(event, handler);
          });
          // Don't destroy the audio element here, just remove listeners
          // Optionally pause and reset src if component unmounts entirely
          // currentAudio.pause();
          // currentAudio.removeAttribute('src');
      }
    };
  }, [handleAudioEnd, handleAudioError, handleCanPlay, handleWaiting, handlePlaying, handlePause, handleLoadStart, handleStalled]); // Stable handler refs

  // Reset Playback State Function (Used when reciter/surah changes)
  const resetPlaybackState = useCallback(() => {
    console.log("Resetting playback state...");
    const audio = audioRef.current;
    if (audio) {
      if (!audio.paused) {
        audio.pause(); // Let pause handler update state
      }
      // Explicitly clear src and force internal reset
      audio.removeAttribute('src');
      audio.load(); // Resets the media element to its initial state
      console.log("Audio source cleared and load() called.");
    }
    setIsPlaying(false);
    setIsAudioLoading(false);
    setCurrentAudioUrl(null);
    setAutoplayNext(false); // Stop autoplay chain on manual change
  }, []);

  // Effect to select the appropriate Moshaf
  useEffect(() => {
    console.log(`Reciter/Data Check: ID=${selectedReciterId}, Data loaded=${!!recitersData}, Loading=${isLoadingReciters}`);
    if (!selectedReciterId || !recitersData?.reciters || isLoadingReciters) {
        if (selectedMoshaf) { // Reset only if a moshaf was previously selected
            setSelectedMoshaf(undefined);
            // No need to call resetPlaybackState here, subsequent effect will handle it
        }
      return;
    }

    const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
    console.log("Found reciter:", reciter?.name);
    const moshafs = reciter?.moshaf ?? [];
    console.log("Available Moshafs:", moshafs.map(m => ({id: m.id, name: m.name})));

    let moshafToSelect: Moshaf | undefined = undefined;

    if (moshafs.length > 0) {
      // Prefer 'Murattal' (continuous recitation)
      const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
      moshafToSelect = murattalMoshaf || moshafs[0]; // Fallback to first
      console.log("Auto-selecting Moshaf:", {id: moshafToSelect?.id, name: moshafToSelect?.name});
    } else {
      console.log("No Moshafs available for this reciter.");
      if (!isLoadingReciters) {
          showToast("تنبيه", "لا توجد مصاحف متاحة لهذا القارئ.");
      }
    }

    // Update state only if the selected Moshaf needs to change
    if (selectedMoshaf?.id !== moshafToSelect?.id) {
        console.log("Updating selected Moshaf state.");
        setSelectedMoshaf(moshafToSelect);
        // resetPlaybackState(); // Don't reset here, let the next effect handle source change
    } else {
        console.log("Selected Moshaf is already the correct one or no moshaf available.");
    }

  }, [selectedReciterId, recitersData, isLoadingReciters, showToast, selectedMoshaf]); // Added selectedMoshaf

  // Effect to Prepare and Load Audio Source when selections change or autoplay triggers
  useEffect(() => {
    const audio = audioRef.current;
    console.log(`Source Prep Effect: Reciter=${selectedReciterId}, Moshaf=${selectedMoshaf?.id}, Surah=${selectedAudioSurah}, Autoplay=${autoplayNext}`);

    if (!audio) {
      console.error("Source Prep: Audio element not ready.");
      return;
    }
    if (!selectedMoshaf || !selectedAudioSurah) {
      console.log("Source Prep: Moshaf or Surah not selected, skipping.");
      // Ensure playback is stopped if selections become invalid
      if (isPlaying || isAudioLoading) {
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

    const currentSrc = audio.currentSrc;
    const urlMismatch = newAudioUrl !== currentSrc;

    console.log(`Source Prep: URL check: New='${newAudioUrl}', Current='${currentSrc}', Mismatch=${urlMismatch}`);

    // If URL needs to change, or if it's the first load (currentSrc is empty)
    if (urlMismatch || !currentSrc) {
      console.log(`Source Prep: Setting new source: ${newAudioUrl}`);
      resetPlaybackState(); // Reset fully before setting new src
      setCurrentAudioUrl(newAudioUrl);
      audio.src = newAudioUrl;

      // Immediately set loading state if autoplay is intended for this new source
      if (autoplayNext) {
          console.log("Source Prep: Autoplay intended for new source, setting loading true.");
          setIsAudioLoading(true);
          // isPlaying will be handled by canplay event
      } else if (isPlaying) {
          // If user was playing but changed src, show loading
           console.log("Source Prep: isPlaying is true during src change, setting loading true.");
          setIsAudioLoading(true);
      }


      console.log("Source Prep: Calling audio.load()...");
      audio.load(); // Initiate loading the new source
      console.log("Source Prep: Audio load initiated.");
    } else {
      console.log("Source Prep: Audio source is already correct.");
      // If autoplaying the *same* track (e.g., replay after end), ensure playback starts
      if (autoplayNext && audio.paused) {
          console.log("Source Prep: Autoplay intended for *same* source, calling play().");
          setIsAudioLoading(true); // Show loading briefly
           audio.play().catch(err => {
                console.error("Error playing same source on autoplay:", err);
                handleAudioError(new Event('error'));
            });
      }
       // If user clicks play on the same track, handle in handlePlayPause
    }
  }, [selectedMoshaf, selectedAudioSurah, autoplayNext, resetPlaybackState, showToast, handleAudioError, isPlaying]); // Added isPlaying dependency

  // Effect to handle actual play/pause based ONLY on the isPlaying state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log(`Play/Pause Effect: isPlaying=${isPlaying}, paused=${audio.paused}, loading=${isAudioLoading}, readyState=${audio.readyState}, currentSrc='${audio.currentSrc}'`);

    if (isPlaying) {
      // Intention is to play
      if (audio.paused) {
        // Check if source is set and ready enough to play
        if (audio.currentSrc && audio.readyState >= HTMLMediaElement.HAVE_METADATA) { // HAVE_METADATA is often enough
          console.log("Play/Pause Effect: Intent=Play, Paused, Ready. Calling play().");
          setIsAudioLoading(true); // Show loading indicator until 'playing' event
          audio.play().catch(err => {
            console.error("Error in play effect:", err);
            handleAudioError(new Event('error'));
          });
        } else if (!audio.currentSrc) {
            console.warn("Play/Pause Effect: Intent=Play, Paused, but no source set. Waiting for source prep.");
            // The source prep effect should handle loading the source
             setIsAudioLoading(true); // Show loading
        } else {
          // Source is set but not ready (readyState < HAVE_METADATA)
          console.log("Play/Pause Effect: Intent=Play, Paused, Not ready. Waiting for 'canplay'. Setting loading state.");
          if (!isAudioLoading) setIsAudioLoading(true);
          // Attempting load() again might be necessary if stalled, but be cautious
          if (audio.networkState === HTMLMediaElement.NETWORK_IDLE || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
               console.log("Play/Pause Effect: Network idle/no source, re-triggering load().");
               audio.load();
          }
        }
      } else {
        // Already playing, ensure loading indicator is off
        console.log("Play/Pause Effect: Intent=Play, Already playing.");
        if (isAudioLoading) setIsAudioLoading(false);
      }
    } else {
      // Intention is to pause
      if (!audio.paused) {
        console.log("Play/Pause Effect: Intent=Pause, Playing. Calling pause().");
        audio.pause(); // Let 'pause' event handler update isPlaying state if needed
      } else {
        console.log("Play/Pause Effect: Intent=Pause, Already paused.");
      }
      // Ensure loading is off if pausing
      if (isAudioLoading) setIsAudioLoading(false);
    }
  }, [isPlaying, handleAudioError, isAudioLoading]); // Depend only on isPlaying and handlers


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
    console.log(`Play/Pause clicked. Current state: isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}, src=${audio?.currentSrc}, readyState=${audio?.readyState}`);
    hasUserInteracted.current = true; // Mark user interaction

    if (!selectedMoshaf || !selectedAudioSurah) {
      showToast("تنبيه", "الرجاء اختيار القارئ والسورة أولاً.");
      return;
    }
    if (!audio) {
      console.error("Play/Pause clicked but audio element is null!");
      return;
    }

    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying); // Set the desired state

    // If intending to play the *same* source again and it's ready, manually trigger play
    // This handles the case where user pauses then immediately plays the same track.
    const targetUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
    if (newIsPlaying && audio.currentSrc === targetUrl && audio.readyState >= HTMLMediaElement.HAVE_METADATA && audio.paused) {
        console.log("Play/Pause Click: Re-playing same ready source.");
         setIsAudioLoading(true); // Show loading until 'playing' fires
         audio.play().catch(err => {
            console.error("Error re-playing same source:", err);
            handleAudioError(new Event('error'));
        });
    } else if (newIsPlaying && (!audio.currentSrc || audio.currentSrc !== targetUrl)) {
        // If source is missing or different, the source prep effect will handle loading and playing
        console.log("Play/Pause Click: Source needs change or is missing. Triggering source prep effect (implicitly).");
        // Ensure loading indicator shows immediately if needed
        if(!isAudioLoading) setIsAudioLoading(true);
    } else if (newIsPlaying) {
        // Intending to play, source might be loading or not ready
         console.log("Play/Pause Click: Intending to play, source might be loading. Setting loading state.");
         if(!isAudioLoading) setIsAudioLoading(true);
    }


    // If playing, enable autoplay for the next track; if pausing, disable it.
    setAutoplayNext(newIsPlaying);

  }, [isPlaying, isAudioLoading, selectedMoshaf, selectedAudioSurah, showToast, handleAudioError]); // Keep dependencies minimal


  const handleReciterChange = useCallback((value: string) => {
    console.log("Selected Reciter changed:", value);
    resetPlaybackState(); // Reset playback state fully
    setSelectedReciterId(value);
    // Moshaf selection and source preparation will follow in effects
  }, [resetPlaybackState]);

  const handleSurahChange = useCallback((value: string) => {
    console.log("Selected Audio Surah changed:", value);
    resetPlaybackState(); // Reset playback state fully
    setSelectedAudioSurah(value);
    // Source preparation will follow in effects
  }, [resetPlaybackState]);

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
  const isPlayDisabled = (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah || isLoadingReciters);


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        {isMobile && <SidebarTrigger icon={Menu} />}
         {/* Title removed */}
      </div>

      <div className="flex items-center gap-4">
        {/* Reciter and Surah Selectors */}
        <div className="flex items-center gap-2">
          {isLoadingReciters ? (
            <Skeleton className="h-10 w-[180px]" />
          ) : recitersError ? (
            <div className="w-[180px] text-destructive text-xs px-2 py-1 border border-destructive rounded-md text-center font-cairo">
              {(recitersError as Error)?.message || 'خطأ في تحميل القراء'}
            </div>
          ) : (
             // Ensure Select components rerender if recitersData changes by using a key or checking data length
            recitersData?.reciters?.length > 0 ? (
              <Select value={selectedReciterId} onValueChange={handleReciterChange} dir="rtl">
                <SelectTrigger className="w-[180px] font-cairo">
                  <SelectValue placeholder="اختر القارئ" />
                </SelectTrigger>
                <SelectContent>
                  {recitersData.reciters.map((reciter) => (
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
               <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={isPlayDisabled} className="font-cairo">
                 {isAudioLoading ? <Loader2 className="animate-spin h-5 w-5" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                 <span className="sr-only">{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
               </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-cairo">{isPlayDisabled ? 'يرجى تحديد القارئ والسورة' : (isAudioLoading ? 'جاري التحميل...' : (isPlaying ? 'إيقاف مؤقت' : 'تشغيل'))}</p>
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
                <Button variant="ghost" size="icon" onClick={toggleMute} className="font-cairo">
                  {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  <span className="sr-only">{isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-cairo">{isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Sources and References Dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="font-cairo">
              <BookOpen className="h-5 w-5" />
              <span className="sr-only">المصادر والمراجع</span>
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="font-cairo sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle className="font-cairo text-right text-xl mb-4">المصادر والمراجع</DialogTitle>
            </DialogHeader>
             <DialogDescription asChild>
               <div className="space-y-5 text-right pr-2">
                 <div>
                   <h3 className="font-semibold text-lg mb-2">مصادر النصوص القرآنية (الملفات):</h3>
                   <a href="https://qurancomplex.gov.sa/techquran/dev/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block break-words">
                     بوابة المصحف الإلكتروني بمجمع الملك فهد لطباعة المصحف الشريف
                   </a>
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
                   <span className="text-xs text-muted-foreground block mt-1">(ملاحظة: سيتم فتح الرابط في نافذة جديدة)</span>
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

    