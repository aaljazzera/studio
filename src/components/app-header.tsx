
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
  const [autoplayNext, setAutoplayNext] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false); // Flag for initial setup completion

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMobile } = useSidebar();
  const { toast } = useToast();
  const lastErrorRef = useRef<string | null>(null);
  const hasUserInteracted = useRef(false);


  // Fetch reciters
  const { data: recitersData, isLoading: isLoadingReciters, error: recitersError } = useQuery({
    queryKey: ['reciters'],
    queryFn: () => fetchReciters('ar'),
    staleTime: Infinity, // Keep data fresh indefinitely
    gcTime: Infinity,    // Keep data in cache indefinitely
    retry: 1,
    refetchOnWindowFocus: false,
  });

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
        // Set playIntent=true to trigger playback in the useEffect
        setIsPlaying(true); // Keep playing state to trigger next track load/play
      } else {
        console.log("Autoplay: Reached last surah. Stopping.");
        setAutoplayNext(false); // Stop autoplay chain
       }
    } else {
      setAutoplayNext(false); // Ensure autoplay is off if not intended or at end
    }
  }, [autoplayNext, selectedAudioSurah]);

  const handleAudioError = useCallback((e: Event) => {
    console.error("Audio error event:", e); // Log the raw event
    const target = e.target as HTMLAudioElement;
    const error = target.error as MediaError;
    let errorMessage = "حدث خطأ غير معروف أثناء محاولة تشغيل الصوت.";

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
    setAutoplayNext(false); // Stop autoplay chain

    if (errorMessage) {
      showToast("خطأ في الصوت", errorMessage, "destructive");
    }
  }, [showToast]);

  const handleCanPlay = useCallback(() => {
    console.log("Audio canplay.");
    const audio = audioRef.current;
    if (!audio) return;

    setIsAudioLoading(false); // Stop loading indicator

    // If isPlaying is true (meaning user intended play or autoplay is active) and it's paused, play it
    if (isPlaying && audio.paused) {
      console.log(`Canplay: Attempting playback (isPlaying: ${isPlaying})`);
      audio.play().catch(err => {
        console.error("Error playing on canplay:", err);
        handleAudioError(new Event('error')); // Simulate error
      });
    }
  }, [isPlaying, handleAudioError]); // isPlaying reflects intent

  const handleWaiting = useCallback(() => {
    console.log("Audio waiting (buffering)...");
    if (isPlaying && !isAudioLoading) {
        setIsAudioLoading(true);
    }
  }, [isPlaying, isAudioLoading]);

  const handlePlaying = useCallback(() => {
    console.log("Audio playing...");
    if (isAudioLoading) setIsAudioLoading(false);
    if (!isPlaying) setIsPlaying(true); // Sync state if needed (e.g., external play)
  }, [isAudioLoading, isPlaying]);

  const handlePause = useCallback(() => {
     const audio = audioRef.current;
     if (audio && !audio.seeking && !audio.ended) {
       console.log("Audio paused event.");
       // Only update state if it's currently marked as playing
       if (isPlaying) {
         setIsPlaying(false);
       }
       if (isAudioLoading) setIsAudioLoading(false); // Stop loading on pause
     } else {
        console.log(`Pause event ignored (seeking/ended/null): seeking=${audio?.seeking}, ended=${audio?.ended}`);
     }
  }, [isPlaying, isAudioLoading]);

  const handleLoadStart = useCallback(() => {
     console.log("Audio loadstart event.");
     if (isPlaying && !isAudioLoading) {
         setIsAudioLoading(true);
     } else {
         console.log(`Loadstart: Ignoring, play not intended (isPlaying: ${isPlaying}, isAudioLoading: ${isAudioLoading}).`);
     }
  }, [isPlaying, isAudioLoading]);

  const handleStalled = useCallback(() => {
    console.warn("Audio stalled event.");
    if (isPlaying && !isAudioLoading ) {
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

    Object.entries(listeners).forEach(([event, handler]) => {
      audioElement.addEventListener(event, handler);
    });
    console.log("Event listeners added.");

    return () => {
      console.log("Cleaning up audio element listeners...");
      const audio = audioRef.current;
      if (audio) {
         Object.entries(listeners).forEach(([event, handler]) => {
             audio.removeEventListener(event, handler);
         });
         console.log("Event listeners removed.");
         audio.pause();
         audio.removeAttribute('src');
         audio.load();
      }
    };
  }, [handleAudioEnd, handleAudioError, handleCanPlay, handleWaiting, handlePlaying, handlePause, handleLoadStart, handleStalled]);

  // --- State Synchronization Effects ---

  // Reset Playback State Function
  const resetPlaybackState = useCallback(() => {
    console.log("Resetting playback state...");
    const audio = audioRef.current;
    if (audio) {
      if (!audio.paused) {
        audio.pause(); // Let pause handler update state if needed
      }
      audio.removeAttribute('src');
      audio.load(); // Important to reset internal state
      console.log("Audio source cleared and load() called.");
    }
    setIsPlaying(false);
    setIsAudioLoading(false);
    setCurrentAudioUrl(''); // Clear the tracked URL
    setAutoplayNext(false);
  }, []);


  // Effect to select the appropriate Moshaf WHEN reciter changes OR data loads
  useEffect(() => {
    console.log(`Reciter/Data Check: ID=${selectedReciterId}, Data loaded=${!!recitersData}, Loading=${isLoadingReciters}`);
    if (isLoadingReciters || !recitersData?.reciters || !selectedReciterId) {
        // If still loading or no data/selection, ensure Moshaf is undefined
        if (selectedMoshaf !== undefined) {
            console.log("Clearing selected Moshaf due to loading/missing data.");
            setSelectedMoshaf(undefined);
        }
        return; // Exit early if data isn't ready or no reciter selected
    }

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
      showToast("تنبيه", "لا توجد مصاحف متاحة لهذا القارئ.");
    }

    // Only update state if the selected Moshaf *actually* changes
    if (selectedMoshaf?.id !== moshafToSelect?.id) {
        console.log("Updating selected Moshaf state.");
        setSelectedMoshaf(moshafToSelect);
        // When Moshaf changes, reset playback immediately
        resetPlaybackState();
    } else {
       console.log("Selected Moshaf is already the correct one or no moshaf available.");
       // Mark as initialized if not already done and moshaf is stable
       if (!isInitialized && moshafToSelect) setIsInitialized(true);
    }

  }, [selectedReciterId, recitersData, isLoadingReciters, showToast, selectedMoshaf, resetPlaybackState, isInitialized]); // Added isInitialized


  // Effect to Prepare and Load Audio Source WHEN Moshaf or Surah changes
  useEffect(() => {
    console.log(`Source Prep Effect: Moshaf=${selectedMoshaf?.id}, Surah=${selectedAudioSurah}, CurrentURL='${currentAudioUrl}'`);
    const audio = audioRef.current;

    // Exit if audio element isn't ready OR if Moshaf/Surah is not selected
    if (!audio || !selectedMoshaf || !selectedAudioSurah) {
      console.log("Source prep effect skipped: Missing audio element, Moshaf, or Surah.");
      // If selections become invalid *after* initialization, reset
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
      console.log(`Source Prep: Setting new source: ${newAudioUrl}`);
      setCurrentAudioUrl(newAudioUrl); // Track the new URL
      audio.src = newAudioUrl; // Set the source on the audio element

      // Reset loading/playing state for the new source, but keep playIntent if it was set
      setIsAudioLoading(isPlaying); // Show loading immediately if play is intended
      console.log("Source Prep: Calling audio.load()...");
      audio.load(); // Initiate loading
      console.log("Source Prep: Audio load initiated.");
    } else {
      console.log("Source Prep: Audio source is already correct.");
       // Mark initialized here if the URL is stable after initial setup
      if (!isInitialized) setIsInitialized(true);
    }
  }, [selectedMoshaf, selectedAudioSurah, resetPlaybackState, showToast, currentAudioUrl, isInitialized, isPlaying]); // isPlaying helps set loading state


 // Effect to handle actual play/pause based ONLY on the isPlaying state intent
 useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isInitialized) { // Don't try to play/pause before initialization
        console.log(`Play/Pause Effect skipped: Audio element not ready or not initialized (isInitialized: ${isInitialized})`);
        return;
    }

    console.log(`Play/Pause Effect: isPlaying=${isPlaying}, paused=${audio.paused}, loading=${isAudioLoading}, readyState=${audio.readyState}, currentSrc='${audio.currentSrc}'`);

    if (isPlaying) {
      // Intention is to play
      if (audio.paused) {
        // Check if source is set and ready enough to play
        if (audio.currentSrc && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
          console.log("Play/Pause Effect: Intent=Play, Paused, Ready. Calling play().");
          // No need to set loading here, 'playing' event will handle it if successful
          audio.play().catch(err => {
            console.error("Error in play effect:", err);
            handleAudioError(new Event('error'));
          });
        } else if (!audio.currentSrc) {
           console.log("Play/Pause Effect: Intent=Play, Paused, No source. Waiting for selections/source prep.");
           // Don't revert isPlaying here, let the source prep handle state if invalid
           if (!isAudioLoading) setIsAudioLoading(true); // Show loading while waiting
        } else {
           // Source is set but not ready (readyState < HAVE_METADATA)
           console.log("Play/Pause Effect: Intent=Play, Paused, Not ready. Waiting for 'canplay'. Setting loading state.");
           if (!isAudioLoading) setIsAudioLoading(true);
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
        audio.pause(); // Let the 'pause' event handler manage state if needed
      } else {
        console.log("Play/Pause Effect: Intent=Pause, Already paused.");
      }
      // Ensure loading is off if pausing
      if (isAudioLoading) setIsAudioLoading(false);
    }
  }, [isPlaying, handleAudioError, isAudioLoading, isInitialized]); // Depend on isPlaying intent and initialization status

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
    hasUserInteracted.current = true;

    if (!selectedMoshaf || !selectedAudioSurah) {
      showToast("تنبيه", "الرجاء اختيار القارئ والسورة أولاً.");
      return;
    }
    if (!audio) {
      console.error("Play/Pause clicked but audio element is null!");
      return;
    }

    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying); // Toggle the desired state (intent)

    // If intending to play, but not loading and not ready, show loader immediately
    if (newIsPlaying && !isAudioLoading && audio.readyState < HTMLMediaElement.HAVE_METADATA) {
        console.log("Play/Pause Click: Intending to play, but source not ready. Setting loading.");
        setIsAudioLoading(true);
        // If network state looks bad, try reloading the source
        if (audio.networkState === HTMLMediaElement.NETWORK_IDLE || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
             console.log("Play/Pause Click: Network issue detected, attempting load().");
             audio.load();
         }
    }
    // Enable/disable autoplay based on the *new* playing state
    setAutoplayNext(newIsPlaying);

  }, [isPlaying, isAudioLoading, selectedMoshaf, selectedAudioSurah, showToast]); // Minimal dependencies


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
        setSelectedAudioSurah(value);
        // Playback state (isPlaying) remains, source prep effect handles loading new surah
        // Autoplay logic is handled within handleAudioEnd and handlePlayPause
        // Resetting playback state is handled by source prep effect
    }
  }, [selectedAudioSurah]);


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
  const isPlayDisabled = !isInitialized || (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah || isLoadingReciters );


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
            <div className="w-[180px] text-destructive text-xs px-2 py-1 border border-destructive rounded-md text-center font-cairo">
              {(recitersError as Error)?.message || 'خطأ تحميل القراء'}
            </div>
          ) : (
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
               <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={isPlayDisabled}>
                 {isAudioLoading ? <Loader2 className="animate-spin h-5 w-5" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                 <span className="sr-only">{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
               </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className='font-cairo'>{isPlayDisabled ? 'يرجى الانتظار أو تحديد القارئ/السورة' : (isAudioLoading ? 'جاري التحميل...' : (isPlaying ? 'إيقاف مؤقت' : 'تشغيل'))}</p>
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
          <DialogContent dir="rtl" className="sm:max-w-[525px] font-cairo">
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

