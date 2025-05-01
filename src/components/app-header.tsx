
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedReciterId, setSelectedReciterId] = useState<string>('7'); // Default to Ahmed Saud
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string>('1'); // Default to Al-Fatiha
  const [selectedMoshaf, setSelectedMoshaf] = useState<Moshaf | undefined>(undefined);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [playIntent, setPlayIntent] = useState(false); // User's intent to play
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMobile } = useSidebar();
  const { toast } = useToast();
  const lastErrorRef = useRef<string | null>(null);
  const isPreparingSource = useRef(false);


  // Fetch reciters
  const { data: recitersData, isLoading: isLoadingReciters, error: recitersError } = useQuery({
    queryKey: ['reciters'],
    queryFn: () => fetchReciters('ar'),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const showToast = useCallback((title: string, description: string, variant: "default" | "destructive" = "default") => {
    if (variant === "destructive" && description === lastErrorRef.current) {
      return;
    }
    toast({ title, description, variant });
    if (variant === "destructive") {
      lastErrorRef.current = description;
      setTimeout(() => { lastErrorRef.current = null; }, 3000);
    }
  }, [toast]);


  // --- Audio Event Handlers ---

  const handleAudioEnd = useCallback(() => {
    console.log("Audio ended.");
    setIsPlaying(false);
    setIsAudioLoading(false);

    if (selectedAudioSurah) {
      const currentSurahId = parseInt(selectedAudioSurah, 10);
      if (!isNaN(currentSurahId) && currentSurahId < 114) {
        const nextSurahId = currentSurahId + 1;
        console.log(`Autoplay: Setting next surah to ${nextSurahId}`);
        setSelectedAudioSurah(nextSurahId.toString());
        // Don't set playIntent here directly, let the useEffect handle it
        // This ensures the source prepares *before* intent is potentially set by user interaction
      } else {
        setPlayIntent(false); // Stop intent if last surah reached
        console.log("Autoplay: Reached last surah or current ID invalid.");
      }
    } else {
      setPlayIntent(false); // Stop intent if no surah selected
      console.log("Autoplay: No current surah selected.");
    }
  }, [selectedAudioSurah]);

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
            errorMessage = 'تم إجهاض عملية جلب الصوت.';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = `حدث خطأ في الشبكة أثناء جلب الصوت. تحقق من اتصالك.`;
            break;
          case MediaError.MEDIA_ERR_DECODE:
             errorMessage = `حدث خطأ أثناء فك تشفير ملف الصوت. قد يكون الملف تالفًا أو غير مدعوم.`;
             console.error(`Detailed DECODE error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = `تعذر تحميل أو فك تشفير مصدر الصوت. قد يكون الرابط غير صالح أو أن التنسيق غير مدعوم. (${target.src})`;
            console.error(`Detailed SRC_NOT_SUPPORTED error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
            break;
          default:
            errorMessage = `حدث خطأ غير معروف في الصوت (الكود: ${error.code}).`;
             console.error(`Detailed UNKNOWN error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
        }
      } else if (target.networkState === HTMLMediaElement.NETWORK_NO_SOURCE && target.readyState === HTMLMediaElement.HAVE_NOTHING && target.currentSrc) {
          errorMessage = `تعذر العثور على مصدر الصوت أو أن التنسيق غير مدعوم. تحقق من الرابط: ${target.currentSrc}`;
          console.error(`Audio Error: NETWORK_NO_SOURCE for src: ${target.currentSrc}`);
      } else if (target.networkState === HTMLMediaElement.NETWORK_LOADING && target.readyState < HTMLMediaElement.HAVE_METADATA) {
         // Errors during loading are common and might resolve, only log if intent was to play
         if (playIntent) {
             errorMessage = `حدث خطأ أثناء تحميل بيانات الصوت الأولية.`;
             console.error(`Audio Error: NETWORK_LOADING and readyState < 2 for src: ${target.currentSrc}`);
         } else {
             console.warn("Ignoring transient loading error as playback was not intended.");
             errorMessage = ''; // Don't show toast
         }
      } else if (target.networkState === HTMLMediaElement.NETWORK_IDLE && target.readyState === HTMLMediaElement.HAVE_NOTHING && !target.currentSrc) {
           // Normal state when no source is set yet, don't show error
           console.warn("Audio Error: NETWORK_IDLE and HAVE_NOTHING, no source set.");
           errorMessage = ''; // Don't show toast
      } else {
         console.error("Audio error occurred but MediaError object is null or state is unusual. Source:", target.src, "ReadyState:", target.readyState, "NetworkState:", target.networkState);
         errorMessage = `حدث خطأ غير متوقع مع مصدر الصوت.`;
      }

       // Reset states on error
       setIsPlaying(false);
       setPlayIntent(false); // Crucial: Reset intent on error
       setIsAudioLoading(false);

       if (errorMessage) {
           showToast("خطأ في الصوت", errorMessage, "destructive");
       }

  }, [showToast, playIntent]);

  const handleCanPlay = useCallback(() => {
    console.log("Audio canplay.");
    const audio = audioRef.current;
    if (!audio) return;

    if (isAudioLoading) setIsAudioLoading(false); // Stop loading indicator

    // If playback was intended, start playing now *only if paused*
    if (playIntent && audio.paused) {
      console.log("Canplay: Attempting to resume intended playback.");
      audio.play().then(() => {
          // Let the 'playing' event handle setIsPlaying(true)
      }).catch(err => {
        console.error("Error resuming playback on canplay:", err);
        handleAudioError(new Event('error')); // Simulate error event
      });
    } else if (!playIntent && !audio.paused) {
        // If somehow playing but intent is false, pause it
        console.log("Canplay: Pausing because playIntent is false.");
        audio.pause();
    }
  }, [playIntent, isAudioLoading, handleAudioError]);

  const handleWaiting = useCallback(() => {
    console.log("Audio waiting (buffering)...");
    if (playIntent && !isAudioLoading) { // Show loader only if intending to play
      setIsAudioLoading(true);
    }
  }, [isAudioLoading, playIntent]);

  const handlePlaying = useCallback(() => {
    console.log("Audio playing.");
    if (isAudioLoading) setIsAudioLoading(false);
    if (!isPlaying) setIsPlaying(true);
  }, [isAudioLoading, isPlaying]);

  const handlePause = useCallback(() => {
     const audio = audioRef.current;
     if (audio && !audio.seeking && !audio.ended) {
       console.log("Audio paused.");
       if (isPlaying) setIsPlaying(false);
        // Keep playIntent as is, user might resume
        if (isAudioLoading) setIsAudioLoading(false);
     } else {
        console.log("Pause event ignored (seeking/ended/null).");
     }
  }, [isPlaying, isAudioLoading]);

   const handleLoadStart = useCallback(() => {
        console.log("Audio loadstart event.");
        // Show loader only if playback is intended AND audio is not already playing/loading
        if (playIntent && !isAudioLoading && audioRef.current?.paused) {
            console.log("Loadstart: Play intended and paused, setting loading true.");
            setIsAudioLoading(true);
        } else {
             console.log(`Loadstart: Detected, state unchanged (playIntent: ${playIntent}, isAudioLoading: ${isAudioLoading}).`);
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
    // Use functional update to avoid stale closure issues if needed, though not strictly necessary here
    const audioElement = audioRef.current ?? new Audio();
    audioElement.preload = 'metadata'; // Preload only metadata initially
    audioRef.current = audioElement;

    // Define listeners here to ensure they capture the latest state handlers
    const onError = (e: Event) => handleAudioError(e);
    const onCanPlay = () => handleCanPlay();
    const onWaiting = () => handleWaiting();
    const onPlaying = () => handlePlaying();
    const onPause = () => handlePause();
    const onEnded = () => handleAudioEnd();
    const onLoadStart = () => handleLoadStart();
    const onStalled = () => handleStalled();

    audioElement.addEventListener('error', onError);
    audioElement.addEventListener('canplay', onCanPlay);
    audioElement.addEventListener('waiting', onWaiting);
    audioElement.addEventListener('playing', onPlaying);
    audioElement.addEventListener('pause', onPause);
    audioElement.addEventListener('ended', onEnded);
    audioElement.addEventListener('loadstart', onLoadStart);
    audioElement.addEventListener('stalled', onStalled);

    // Cleanup
    return () => {
      console.log("Cleaning up audio element...");
      const currentAudio = audioRef.current; // Capture ref in cleanup closure
      if (currentAudio) {
        currentAudio.removeEventListener('error', onError);
        currentAudio.removeEventListener('canplay', onCanPlay);
        currentAudio.removeEventListener('waiting', onWaiting);
        currentAudio.removeEventListener('playing', onPlaying);
        currentAudio.removeEventListener('pause', onPause);
        currentAudio.removeEventListener('ended', onEnded);
        currentAudio.removeEventListener('loadstart', onLoadStart);
        currentAudio.removeEventListener('stalled', onStalled);
        try {
          currentAudio.pause();
          currentAudio.removeAttribute('src'); // Remove src
          currentAudio.load(); // Reset element state
        } catch (e) {
          console.warn("Error during audio cleanup:", e);
        }
        // Do not nullify audioRef.current here if it's created outside useEffect
      }
    };
    // Re-run if any handler changes - ensures listeners have fresh state
  }, [handleAudioEnd, handleAudioError, handleCanPlay, handleWaiting, handlePlaying, handlePause, handleLoadStart, handleStalled]);


   // Effect to select the appropriate Moshaf when reciter changes
   useEffect(() => {
    console.log(`Reciter/Data Check: ID=${selectedReciterId}, Data loaded=${!!recitersData}, Loading=${isLoadingReciters}`);
    if (selectedReciterId && recitersData?.reciters) {
        const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
        console.log("Found reciter:", reciter?.name);
        const moshafs = reciter?.moshaf ?? [];
        console.log("Available Moshafs:", moshafs.map(m => ({id: m.id, name: m.name, server: m.server})));

        if (moshafs.length > 0) {
            const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
            const moshafToSelect = murattalMoshaf || moshafs[0];
            const previousMoshafId = selectedMoshaf?.id;

            console.log("Auto-selecting Moshaf:", {id: moshafToSelect.id, name: moshafToSelect.name});

            if (previousMoshafId !== moshafToSelect.id) {
                console.log("Setting selected Moshaf state.");
                setSelectedMoshaf(moshafToSelect);
                // Reset playback state when reciter/moshaf changes
                if (isPlaying || playIntent) {
                     console.log("Clearing audio source/state due to reciter/moshaf change.");
                     const audio = audioRef.current;
                     if (audio) {
                       audio.pause();
                       audio.removeAttribute('src');
                       try { audio.load(); } catch(e) {}
                     }
                     setIsPlaying(false);
                     setPlayIntent(false); // Reset intent on change
                     setIsAudioLoading(false);
                     setCurrentAudioUrl(null);
                 }
            } else {
                console.log("Selected Moshaf is already the correct one.");
            }
        } else {
            console.log("No Moshafs available for this reciter. Resetting selection.");
            setSelectedMoshaf(undefined);
            if (isPlaying || playIntent) {
                const audio = audioRef.current;
                if (audio) {
                    audio.pause();
                    audio.removeAttribute('src');
                    try { audio.load(); } catch(e) {}
                }
                setIsPlaying(false);
                setPlayIntent(false); // Reset intent
                setIsAudioLoading(false);
                setCurrentAudioUrl(null);
            }
            if (!isLoadingReciters) {
                showToast("تنبيه", "لا توجد مصاحف متاحة لهذا القارئ.");
            }
        }
    } else if (!isLoadingReciters && selectedReciterId && !recitersData?.reciters?.length) {
        console.error("Reciter selected, but reciters data is unavailable.");
        setSelectedMoshaf(undefined);
        if (isPlaying || playIntent) {
             const audio = audioRef.current;
             if (audio) {
                 audio.pause();
                 audio.removeAttribute('src');
                 try { audio.load(); } catch(e) {}
             }
             setIsPlaying(false);
             setPlayIntent(false); // Reset intent
             setIsAudioLoading(false);
             setCurrentAudioUrl(null);
         }
    }
   }, [selectedReciterId, recitersData, isLoadingReciters, showToast]); // Removed selectedMoshaf, isPlaying, playIntent dependencies


   // Prepare Audio Source: Generates URL and sets it on the audio element
   const prepareAudioSource = useCallback(async (forceLoad = false) => {
       if (isPreparingSource.current) {
           console.warn("prepareAudioSource called while already preparing. Skipping.");
           return false;
       }
       isPreparingSource.current = true;
       let success = false;

       console.log(`Attempting to prepare audio source (forceLoad: ${forceLoad})...`);
       const audio = audioRef.current;
       console.log("Current state:", {
           reciterId: selectedReciterId,
           moshafId: selectedMoshaf?.id,
           surah: selectedAudioSurah,
           currentSrc: audio?.currentSrc ?? '',
           isPlaying,
           isAudioLoading,
           playIntent,
           readyState: audio?.readyState ?? -1
       });

       if (!audio) {
           console.error("prepareAudioSource: Audio element not ready.");
           isPreparingSource.current = false;
           return false;
       }
       if (!selectedMoshaf || !selectedAudioSurah) {
           console.log("Moshaf or Surah not selected, skipping source prep.");
           isPreparingSource.current = false;
           return false;
       }

       let newAudioUrl: string | null = null;
       try {
           newAudioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
           console.log("Generated audio URL:", newAudioUrl);
           if (!newAudioUrl) {
               throw new Error("Generated URL is invalid.");
           }
       } catch (error) {
           console.error("Error generating audio URL:", error);
           showToast("خطأ", `فشل في بناء رابط الصوت: ${(error as Error).message}`, "destructive");
           setCurrentAudioUrl(null); // Clear URL state
           // Do not change playback states here, let error handler do it
           isPreparingSource.current = false;
           return false;
       }

       const currentSrc = audio.src;
       const urlMismatch = newAudioUrl !== currentSrc;

       console.log(`Setting new audio source: ${newAudioUrl} (forceLoad: ${forceLoad}, isSrcSet: ${!!currentSrc}, urlMismatch: ${urlMismatch})`);

       if (urlMismatch || forceLoad) {
            // Always pause before changing src
           if (!audio.paused) {
               console.log("Pausing current playback before setting new source.");
               audio.pause(); // Let the 'pause' event handle isPlaying state
           }
           // Reset loading state before setting src
           if (isAudioLoading) setIsAudioLoading(false);


           setCurrentAudioUrl(newAudioUrl); // Update URL state

           // Show loader immediately if forcing load (usually means play intent is active)
           if (forceLoad && !isAudioLoading) {
               console.log(`prepareAudioSource: Setting loading true (forceLoad: ${forceLoad})`);
               setIsAudioLoading(true);
           }

           audio.src = newAudioUrl; // Set the new source

           // Explicitly call load() to fetch the new source
           try {
               console.log("Calling audio.load()...");
               audio.load();
               console.log("Audio load initiated.");
               success = true; // Mark as potentially successful
           } catch (e) {
               console.error("Error calling load():", e);
               handleAudioError(new Event('error')); // Simulate error
               success = false;
           }
       } else {
           console.log("Audio source is already correct. No preparation needed.");
           // Ensure loading is false if state is inconsistent
           if (isAudioLoading && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
               setIsAudioLoading(false);
           }
           success = true; // Source is already correct
       }

       isPreparingSource.current = false;
       return success; // Indicate if preparation was attempted/successful
   }, [selectedMoshaf, selectedAudioSurah, isPlaying, isAudioLoading, playIntent, showToast, handleAudioError]);


  // Effect to trigger source preparation when selections change
  // Removed playIntent dependency to prevent loop with handlePlayPause
  useEffect(() => {
      // Prepare source whenever selections change
      // forceLoad is true if intent is to play (set by handlePlayPause)
      const shouldForceLoad = playIntent;
      console.log(`Selection/Moshaf/Intent changed, preparing audio source (force load: ${shouldForceLoad})...`);
      prepareAudioSource(shouldForceLoad);
  }, [selectedMoshaf, selectedAudioSurah, prepareAudioSource, playIntent]); // Add playIntent back


  // Update audio volume effect
  useEffect(() => {
    if (audioRef.current) {
      const newVolume = isMuted ? 0 : volume / 100;
      console.log(`Setting volume: ${newVolume} (muted: ${isMuted}, slider: ${volume})`)
      audioRef.current.volume = newVolume;
    }
  }, [volume, isMuted]);


  // --- UI Event Handlers ---

  const handlePlayPause = useCallback(async () => {
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

    const newPlayIntent = !playIntent;
    setPlayIntent(newPlayIntent); // Toggle intent immediately

    if (newPlayIntent) {
        // Intention is to play
        setIsAudioLoading(true); // Optimistically set loading
        const sourceReady = await prepareAudioSource(true); // Ensure source is loaded/reloaded

        if (sourceReady && audio.paused) {
             console.log("Play/Pause Handler: Source ready/prepared, attempting play.");
             try {
                 await audio.play();
                 // Let 'playing' event handle state updates
             } catch (error) {
                 console.error("Error calling play() from handlePlayPause:", error);
                 handleAudioError(new Event('error')); // Simulate error
                 setPlayIntent(false); // Reset intent on error
             } finally {
                 // Ensure loading is false if play starts or fails quickly
                  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA || !newPlayIntent) {
                     setIsAudioLoading(false);
                 }
             }
        } else if (!sourceReady) {
            console.warn("Play/Pause Handler: Source preparation failed. Play aborted.");
            setIsAudioLoading(false);
            setPlayIntent(false); // Reset intent if source fails
        } else {
            // Source was ready, audio might already be playing or about to
            console.log("Play/Pause Handler: Audio might already be playing or preparing.");
             // Ensure loading is false if play intent is set but audio is already playing
             if (!audio.paused) {
                 setIsAudioLoading(false);
                 setIsPlaying(true); // Sync state if needed
             }
        }
    } else {
        // Intention is to pause
        if (!audio.paused) {
            console.log("Play/Pause Handler: Pausing audio.");
            audio.pause(); // Let 'pause' event handle state updates
        }
         if (isAudioLoading) {
            setIsAudioLoading(false); // Stop loading if pausing
        }
    }
  }, [audioRef, isPlaying, isAudioLoading, playIntent, selectedMoshaf, selectedAudioSurah, showToast, prepareAudioSource, handleAudioError]);


   const handleReciterChange = (value: string) => {
     console.log("Selected Reciter changed:", value);
     // Reset playback state *before* changing selections
     const audio = audioRef.current;
     if (audio && (isPlaying || playIntent)) {
         audio.pause();
         setIsPlaying(false);
         setPlayIntent(false); // Reset intent
         setIsAudioLoading(false);
         setCurrentAudioUrl(null);
     }
     setSelectedReciterId(value);
     // Moshaf selection and source preparation will follow in effects
   };

   const handleSurahChange = (value: string) => {
     console.log("Selected Audio Surah changed:", value);
     const audio = audioRef.current;
     if (audio && (isPlaying || playIntent)) {
       audio.pause();
       setIsPlaying(false);
       setPlayIntent(false); // Reset intent
       setIsAudioLoading(false);
       setCurrentAudioUrl(null);
     }
     setSelectedAudioSurah(value);
     // Source preparation will follow in effects
   };

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
         {/* Title removed as requested */}
         {/* <h1 className="text-lg font-semibold font-cairo">قارئ الكتاب</h1> */}
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
               <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={isPlayDisabled || (!currentAudioUrl && !playIntent)} className="font-cairo">
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
          <DialogContent dir="rtl" className="font-cairo">
            <DialogHeader>
              <DialogTitle className="font-cairo text-right">المصادر والمراجع</DialogTitle>
            </DialogHeader>
             <DialogDescription asChild>
               <div className="space-y-4 text-right">
                 <p>
                   <span className="font-semibold block">مصادر النصوص القرآنية (الملفات):</span>
                   <a href="https://qurancomplex.gov.sa/techquran/dev/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block">
                     بوابة المصحف الإلكتروني بمجمع الملك فهد
                   </a>
                 </p>
                 <p>
                   <span className="font-semibold block">مصدر واجهة برمجة التطبيقات الصوتية للقرآن الكريم:</span>
                   <a href="https://mp3quran.net/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block">
                     mp3quran.net
                   </a>
                 </p>
                 <p>
                   <span className="font-semibold block">تحميل خطوط القرآن المستخدمة في التطبيق (KFGQPC):</span>
                   <a href="https://drive.google.com/file/d/1x4JKWT7Sq1F-rZL0cbe38G_10FuD5dQc/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block">
                     <Download className="inline-block h-4 w-4 ml-1" />
                     رابط التحميل (Google Drive)
                   </a>
                   <span className="text-xs text-muted-foreground block">(ملاحظة: سيتم فتح الرابط في نافذة جديدة)</span>
                 </p>
                 <p>تم بناء هذا التطبيق باستخدام Next.js و Shadcn/UI و Tailwind CSS.</p>
                 <p>
                   <span className="font-semibold block">للتواصل والاستفسارات:</span>
                   <a href="mailto:darrati10@gmail.com" className="text-primary underline hover:text-primary/80">darrati10@gmail.com</a>
                 </p>
               </div>
             </DialogDescription>
            <DialogFooter className="mt-4">
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

