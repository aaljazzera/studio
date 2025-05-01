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
  Download, // Added for the dialog link
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
  DialogClose, // Added for the close button
  DialogFooter, // Added for the footer
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { quranSurahs } from '@/data/quran-surahs';
import { fetchReciters, getAudioUrl } from '@/services/mp3quran';
import type { Reciter, Moshaf } from '@/types/mp3quran';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export function AppHeader() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedReciterId, setSelectedReciterId] = useState<string>('7'); // Default to Ahmed Saud
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string>('1'); // Default to Al-Fatiha
  const [selectedMoshaf, setSelectedMoshaf] = useState<Moshaf | undefined>(undefined);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [playIntent, setPlayIntent] = useState(false); // User's explicit intent to play/pause
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMobile } = useSidebar();
  const { toast } = useToast();
  const lastErrorRef = useRef<string | null>(null);
  const isPreparingSource = useRef(false); // Prevent concurrent source preparation
  const isResettingPlayback = useRef(false); // Flag to prevent effects during reset


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

    // Autoplay next surah if playback was active
    if (playIntent && selectedAudioSurah) {
      const currentSurahId = parseInt(selectedAudioSurah, 10);
      if (!isNaN(currentSurahId) && currentSurahId < 114) {
        const nextSurahId = (currentSurahId + 1).toString();
        console.log(`Autoplay: Setting next surah to ${nextSurahId}`);
        setSelectedAudioSurah(nextSurahId); // This triggers the source update effect
        // Keep playIntent true to continue playback
      } else {
        console.log("Autoplay: Reached last surah or invalid ID. Stopping intent.");
        setPlayIntent(false); // Stop intent if last surah reached
      }
    } else {
      // If not playing or no surah, ensure intent is false
      if (playIntent) setPlayIntent(false);
    }
  }, [selectedAudioSurah, playIntent]);

  const handleAudioError = useCallback((e: Event) => {
    console.error("Audio error event:", e);
    const target = e.target as HTMLAudioElement;
    const error = target.error;
    let errorMessage = "حدث خطأ غير معروف أثناء محاولة تشغيل الصوت.";

    console.error(`Audio Error Details: readyState=${target.readyState}, currentSrc='${target.currentSrc}', networkState=${target.networkState}`);

    if (error) {
      console.error(`MediaError code: ${error.code}, message: ${error.message || 'N/A'}`);
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = playIntent ? 'تم إجهاض عملية جلب الصوت.' : ''; // Only show if user intended play
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = `حدث خطأ في الشبكة أثناء جلب الصوت. تحقق من اتصالك.`;
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = `حدث خطأ أثناء فك تشفير ملف الصوت. قد يكون الملف تالفًا أو غير مدعوم.`;
          console.error(`Detailed DECODE error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = `تعذر تحميل أو فك تشفير مصدر الصوت. قد يكون الرابط غير صالح (${target.src}) أو أن التنسيق غير مدعوم.`;
          console.error(`Detailed SRC_NOT_SUPPORTED error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
          break;
        default:
          errorMessage = `حدث خطأ غير معروف في الصوت (الكود: ${error.code}).`;
          console.error(`Detailed UNKNOWN error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
      }
    } else {
      console.error("Audio error occurred but MediaError object is null. Source:", target.src, "ReadyState:", target.readyState, "NetworkState:", target.networkState);
      errorMessage = `حدث خطأ غير متوقع مع مصدر الصوت.`;
    }

    setIsPlaying(false);
    setPlayIntent(false); // Crucial: Stop trying to play on error
    setIsAudioLoading(false);

    if (errorMessage) {
      showToast("خطأ في الصوت", errorMessage, "destructive");
    }
  }, [showToast, playIntent]);

  const handleCanPlay = useCallback(() => {
    console.log("Audio canplay.");
    const audio = audioRef.current;
    if (!audio) return;

    setIsAudioLoading(false); // Stop loading indicator

    // If playback was intended, start playing now *only if paused*
    if (playIntent && audio.paused) {
      console.log("Canplay: Attempting to resume intended playback.");
      audio.play().catch(err => {
        console.error("Error resuming playback on canplay:", err);
        handleAudioError(new Event('error')); // Simulate error
      });
    } else if (!playIntent && !audio.paused) {
        console.log("Canplay: Pausing because playIntent is false.");
        audio.pause();
    }
  }, [playIntent, handleAudioError]);

  const handleWaiting = useCallback(() => {
    console.log("Audio waiting (buffering)...");
    if (playIntent && !isAudioLoading) {
      setIsAudioLoading(true);
    }
  }, [playIntent, isAudioLoading]);

  const handlePlaying = useCallback(() => {
    console.log("Audio playing.");
    if (isAudioLoading) setIsAudioLoading(false);
    if (!isPlaying) setIsPlaying(true);
  }, [isAudioLoading, isPlaying]);

  const handlePause = useCallback(() => {
     const audio = audioRef.current;
     // Check if pause is legitimate (not due to seeking, ending, or error handling/reset)
     if (audio && !audio.seeking && !audio.ended && !isResettingPlayback.current) {
       console.log("Audio paused.");
       if (isPlaying) setIsPlaying(false);
       if (isAudioLoading) setIsAudioLoading(false);
     } else {
        console.log("Pause event ignored (seeking/ended/resetting/null).");
     }
  }, [isPlaying, isAudioLoading]);

  const handleLoadStart = useCallback(() => {
    console.log("Audio loadstart event.");
    // Show loader immediately if playback is intended and not already resetting.
    if (playIntent && !isAudioLoading && !isResettingPlayback.current) {
        console.log("Loadstart: Play intended, setting loading true.");
        setIsAudioLoading(true);
    } else {
         console.log(`Loadstart: Detected, state unchanged (playIntent: ${playIntent}, isAudioLoading: ${isAudioLoading}, resetting: ${isResettingPlayback.current}).`);
    }
  }, [playIntent, isAudioLoading]);

  const handleStalled = useCallback(() => {
    console.warn("Audio stalled event.");
    if (playIntent && !isAudioLoading) {
        setIsAudioLoading(true);
    }
  }, [playIntent, isAudioLoading]);

  // --- Effects ---

  // Initialize Audio Element & Attach Listeners
  useEffect(() => {
    console.log("Initializing audio element...");
    const audioElement = new Audio();
    audioElement.preload = 'metadata';
    audioRef.current = audioElement;

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

    Object.entries(listeners).forEach(([event, handler]) => {
      audioElement.addEventListener(event, handler);
    });

    // Cleanup
    return () => {
      console.log("Cleaning up audio element...");
      const currentAudio = audioRef.current;
      if (currentAudio) {
        Object.entries(listeners).forEach(([event, handler]) => {
          currentAudio.removeEventListener(event, handler);
        });
        try {
          isResettingPlayback.current = true;
          currentAudio.pause();
          currentAudio.removeAttribute('src');
          currentAudio.load(); // Important to release resources
          isResettingPlayback.current = false;
        } catch (e) { console.warn("Error during audio cleanup:", e); isResettingPlayback.current = false; }
      }
      audioRef.current = null;
    };
  }, [handleAudioEnd, handleAudioError, handleCanPlay, handleWaiting, handlePlaying, handlePause, handleLoadStart, handleStalled]); // Stable refs

  // Effect to select the appropriate Moshaf
  useEffect(() => {
    console.log(`Reciter/Data Check: ID=${selectedReciterId}, Data loaded=${!!recitersData}, Loading=${isLoadingReciters}`);
    if (!selectedReciterId || !recitersData?.reciters || isLoadingReciters) {
      if (selectedMoshaf) { // Only reset if there was a moshaf before
        setSelectedMoshaf(undefined);
        resetPlaybackState();
      }
      return;
    }

    const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
    console.log("Found reciter:", reciter?.name);
    const moshafs = reciter?.moshaf ?? [];
    console.log("Available Moshafs:", moshafs.map(m => ({id: m.id, name: m.name})));

    let moshafToSelect: Moshaf | undefined = undefined;

    if (moshafs.length > 0) {
      // Try to find the *first* Moshaf marked as 'مرتل' (Murattal - continuous recitation)
      const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
      moshafToSelect = murattalMoshaf || moshafs[0]; // Fallback to the first available Moshaf
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
        setSelectedMoshaf(moshafToSelect); // This triggers the source prep effect
        resetPlaybackState(); // Reset playback whenever the moshaf changes
    } else {
        console.log("Selected Moshaf is already the correct one or no moshaf available.");
    }

  }, [selectedReciterId, recitersData, isLoadingReciters, showToast]); // Removed resetPlaybackState and selectedMoshaf from deps


  // Function to reset playback state (stable reference)
  const resetPlaybackState = useCallback(() => {
    console.log("Resetting playback state...");
    isResettingPlayback.current = true; // Signal reset start
    const audio = audioRef.current;
    if (audio) {
        try {
          if (!audio.paused) audio.pause();
          if (audio.currentSrc || audio.src) { // Check if src exists
              audio.removeAttribute('src');
              audio.load(); // Reset internal state
          }
        } catch(e) { console.warn("Minor error during playback reset:", e); }
    }
    setIsPlaying(false);
    setPlayIntent(false); // Reset user intent
    setIsAudioLoading(false);
    setCurrentAudioUrl(null); // Clear URL state

    // Allow effects to run again after a very short delay
    setTimeout(() => { isResettingPlayback.current = false; }, 50);
  }, []);


  // Prepare Audio Source (stable reference)
  const prepareAudioSource = useCallback(async (forceLoad = false) => {
    if (isResettingPlayback.current || isPreparingSource.current) {
        console.warn(`prepareAudioSource skipped: Resetting=${isResettingPlayback.current}, Preparing=${isPreparingSource.current}`);
        return false;
    }
    isPreparingSource.current = true;

    const audio = audioRef.current;
    console.log(`Attempting to prepare audio source (forceLoad: ${forceLoad})...`);
    console.log("Current state:", { reciterId: selectedReciterId, moshafId: selectedMoshaf?.id, surah: selectedAudioSurah, currentSrc: audio?.currentSrc ?? '', isPlaying, isAudioLoading, playIntent, readyState: audio?.readyState ?? -1 });

    if (!audio) {
      console.error("prepareAudioSource: Audio element not ready.");
      isPreparingSource.current = false;
      return false;
    }
    if (!selectedMoshaf || !selectedAudioSurah) {
      console.log("Moshaf or Surah not selected, skipping source prep.");
       // If something was playing or loading, reset it
       if (isPlaying || isAudioLoading) resetPlaybackState();
      isPreparingSource.current = false;
      return false;
    }

    let newAudioUrl: string;
    try {
        newAudioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
        console.log("Generated audio URL:", newAudioUrl);
        if (!newAudioUrl) throw new Error("Generated URL is invalid.");
    } catch (error) {
        console.error("Error generating audio URL:", error);
        showToast("خطأ", `فشل في بناء رابط الصوت: ${(error as Error).message}`, "destructive");
        setCurrentAudioUrl(null);
        resetPlaybackState();
        isPreparingSource.current = false;
        return false;
    }

    const currentSrc = audio.currentSrc || audio.src;
    const isSrcSet = !!currentSrc; // Is any source currently set?
    const urlMismatch = newAudioUrl !== currentSrc;

    console.log(`URL check: New='${newAudioUrl}', Current='${currentSrc}', Mismatch=${urlMismatch}, SrcSet=${isSrcSet}`);

    // When to set src: If URL is different OR if forceLoad is true (e.g., user clicked play on same track)
    // OR if no src is currently set (initial load or after error/reset)
    if (urlMismatch || forceLoad || !isSrcSet) {
        console.log(`Setting new audio source: ${newAudioUrl} (forceLoad: ${forceLoad}, urlMismatch: ${urlMismatch}, isSrcSet: ${isSrcSet})`);

        // Always pause before changing src if playing
        if (!audio.paused) {
            console.log("Pausing current playback before setting new source.");
            audio.pause(); // Let pause handler manage isPlaying state
        }
         // Ensure loading state is accurate before load()
         // Show loader if user intends to play OR if forceLoad is true (implying intent)
         if ((playIntent || forceLoad) && !isAudioLoading) {
             console.log("prepareAudioSource: Setting loading true (playIntent or forceLoad)");
             setIsAudioLoading(true);
         }

        setCurrentAudioUrl(newAudioUrl);
        audio.src = newAudioUrl;

        try {
            console.log("Calling audio.load()...");
            audio.load(); // Crucial: This initiates the loading process for the new src
            console.log("Audio load initiated.");
            isPreparingSource.current = false;
            return true; // Source setting initiated
        } catch (e) {
            console.error("Error calling load():", e);
            handleAudioError(new Event('error')); // Simulate error for consistent handling
            isPreparingSource.current = false;
            return false;
        }
    } else {
        console.log("Audio source is already correct. No preparation needed.");
        // Ensure loading state is correct if source is correct but might be buffering
        if (isAudioLoading && audio.readyState >= HTMLMediaElement.HAVE_METADATA && audio.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
             console.log("Source correct, but still buffering.");
             // Keep loading state true
        } else if (isAudioLoading && audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
             console.log("Source correct and ready, setting loading false.");
             setIsAudioLoading(false);
        }
        isPreparingSource.current = false;
        return true; // Source is correct
    }
  }, [selectedMoshaf, selectedAudioSurah, isPlaying, isAudioLoading, playIntent, showToast, handleAudioError, resetPlaybackState]); // Added resetPlaybackState dependency


  // Effect to trigger source preparation when selections change
  useEffect(() => {
    if (isResettingPlayback.current) {
         console.log("Source prep effect skipped: Playback reset in progress.");
         return;
     }
     // Always prepare source when moshaf or surah changes.
     // forceLoad=true is handled by the play/pause logic.
     console.log(`Selection/Moshaf changed, preparing audio source (force load only if needed)...`);
     prepareAudioSource(false); // Don't force load here, only prepare

  }, [selectedMoshaf, selectedAudioSurah, prepareAudioSource]);


  // Effect to handle actual playback based on playIntent and audio state
  useEffect(() => {
      if (isResettingPlayback.current) {
           console.log("Play/Pause Effect skipped: Playback reset in progress.");
           return;
       }
      const audio = audioRef.current;
      if (!audio) return;

      console.log(`Play/Pause Effect: playIntent=${playIntent}, isPlaying=${isPlaying}, paused=${audio.paused}, loading=${isAudioLoading}, readyState=${audio.readyState}, currentSrc='${audio.currentSrc}'`);

      if (playIntent) {
          if (audio.paused) {
              // Need to ensure source is set before playing
              if (!audio.currentSrc && selectedMoshaf && selectedAudioSurah) {
                  console.log("Play/Pause Effect: Intent=true, Paused, No source. Triggering prepareAudioSource(true).");
                   prepareAudioSource(true); // Force load if src is missing but selections are valid
              }
              // Check readiness state
              else if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                   console.log("Play/Pause Effect: Intent=true, Paused, Ready. Calling play().");
                   audio.play().catch(err => {
                       console.error("Error in play effect:", err);
                       handleAudioError(new Event('error'));
                   });
              } else if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
                   console.log("Play/Pause Effect: Intent=true, Paused, Not ready. Waiting for 'canplay'. Setting loading state if needed.");
                   if (!isAudioLoading) setIsAudioLoading(true);
                    // Maybe call load() again if stuck? Needs careful consideration.
                    // if (audio.networkState === HTMLMediaElement.NETWORK_IDLE || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
                    //     console.log("Play/Pause Effect: Network idle/no source, re-triggering load().");
                    //     audio.load();
                    // }
              }
          } else {
               // Already playing, ensure loading indicator is off
               console.log("Play/Pause Effect: Intent=true, Already playing.");
               if (isAudioLoading) setIsAudioLoading(false);
          }
      } else {
          // Intent is to pause
          if (!audio.paused) {
              console.log("Play/Pause Effect: Intent=false, Playing. Calling pause().");
              audio.pause(); // Let 'pause' event handler manage isPlaying state
          } else {
               console.log("Play/Pause Effect: Intent=false, Already paused.");
          }
          // Ensure loading is off if pausing
          if (isAudioLoading) setIsAudioLoading(false);
      }
  }, [playIntent, isAudioLoading, isPlaying, selectedMoshaf, selectedAudioSurah, prepareAudioSource, handleAudioError]); // Added dependencies


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

    if (!selectedMoshaf || !selectedAudioSurah) {
      showToast("تنبيه", "الرجاء اختيار القارئ والسورة أولاً.");
      return;
    }
    if (!audio) {
      console.error("Play/Pause clicked but audio element is null!");
      return;
    }

    // Toggle the user's intent
    const newPlayIntent = !playIntent;
    setPlayIntent(newPlayIntent);

    // If intending to play and src is not set or needs reload, force prepare source
    if (newPlayIntent && (!audio.currentSrc || audio.currentSrc !== getAudioUrl(selectedMoshaf.server, selectedAudioSurah))) {
        console.log("Play/Pause clicked: Forcing source preparation due to missing/mismatched src.");
        prepareAudioSource(true); // Force load
    } else if (newPlayIntent && audio.paused) {
        // If source is likely okay and paused, attempt play directly (effect will handle)
        console.log("Play/Pause clicked: Attempting to play existing source.");
        // The useEffect based on playIntent will handle calling play()
    } else if (!newPlayIntent && !audio.paused) {
        // If intending to pause and playing, pause it (effect will handle)
        console.log("Play/Pause clicked: Attempting to pause.");
        // The useEffect based on playIntent will handle calling pause()
    }


  }, [playIntent, isPlaying, isAudioLoading, selectedMoshaf, selectedAudioSurah, showToast, prepareAudioSource]);


  const handleReciterChange = useCallback((value: string) => {
    console.log("Selected Reciter changed:", value);
    resetPlaybackState(); // Reset playback *before* changing state
    setSelectedReciterId(value);
    // Moshaf selection and source preparation will follow in effects
  }, [resetPlaybackState]);

  const handleSurahChange = useCallback((value: string) => {
    console.log("Selected Audio Surah changed:", value);
    resetPlaybackState(); // Reset playback *before* changing state
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
    if (!newMutedState && volume === 0) setVolume(10);
  };

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
            <Select value={selectedReciterId} onValueChange={handleReciterChange} dir="rtl">
              <SelectTrigger className="w-[180px] font-cairo">
                <SelectValue placeholder="اختر القارئ" />
              </SelectTrigger>
              <SelectContent>
                {recitersData?.reciters?.map((reciter) => (
                  <SelectItem key={reciter.id} value={reciter.id.toString()} className="font-cairo">
                    {reciter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                {isAudioLoading ? <Loader2 className="animate-spin h-5 w-5" /> : playIntent ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                <span className="sr-only">{playIntent ? 'إيقاف مؤقت' : 'تشغيل'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-cairo">{isPlayDisabled ? 'يرجى تحديد القارئ والسورة' : (isAudioLoading ? 'جاري التحميل...' : (playIntent ? 'إيقاف مؤقت' : 'تشغيل'))}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Volume Control */}
        <div className="flex items-center gap-2 w-32">
          <Slider
            dir="ltr"
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
          <DialogContent dir="rtl" className="font-cairo sm:max-w-[525px]"> {/* Adjusted width */}
            <DialogHeader>
              <DialogTitle className="font-cairo text-right text-xl mb-4">المصادر والمراجع</DialogTitle> {/* Increased margin */}
            </DialogHeader>
             <DialogDescription asChild>
               <div className="space-y-5 text-right pr-2"> {/* Added padding-right */}
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
                  <hr className="my-4 border-border" /> {/* Separator */}
                  <div>
                   <h3 className="font-semibold text-lg mb-2">للتواصل والاستفسارات:</h3>
                   <a href="mailto:darrati10@gmail.com" className="text-primary underline hover:text-primary/80 block break-words">
                     darrati10@gmail.com
                   </a>
                  </div>
                 <p className="text-sm text-muted-foreground pt-4">تم بناء هذا التطبيق باستخدام Next.js و Shadcn/UI و Tailwind CSS.</p>
               </div>
             </DialogDescription>
            <DialogFooter className="mt-6"> {/* Increased top margin */}
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