
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
  // Default to Ahmed Saud (ID 7) and Al-Fatiha (ID 1)
  const [selectedReciterId, setSelectedReciterId] = useState<string>('7');
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string>('1');
  const [selectedMoshaf, setSelectedMoshaf] = useState<Moshaf | undefined>(undefined);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [playIntent, setPlayIntent] = useState(false); // Track if user intends to play
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMobile } = useSidebar();
  const { toast } = useToast();
  const lastErrorRef = useRef<string | null>(null);
  const isPreparingSource = useRef(false); // Ref to prevent race conditions


  // Fetch reciters
  const { data: recitersData, isLoading: isLoadingReciters, error: recitersError } = useQuery({
    queryKey: ['reciters'],
    queryFn: () => fetchReciters('ar'),
    staleTime: Infinity, // Cache forever
    gcTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const showToast = useCallback((title: string, description: string, variant: "default" | "destructive" = "default") => {
    // Prevent duplicate toasts for the same error message quickly
    if (variant === "destructive" && description === lastErrorRef.current) {
      return;
    }
    toast({ title, description, variant });
    if (variant === "destructive") {
      lastErrorRef.current = description;
      // Clear the last error after a delay to allow re-showing if it happens again later
      setTimeout(() => { lastErrorRef.current = null; }, 3000);
    }
  }, [toast]);


  // --- Audio Event Handlers ---

  // Audio Ended Handler
  const handleAudioEnd = useCallback(() => {
    console.log("Audio ended.");
    setIsPlaying(false);
    setPlayIntent(false); // Reset intent
    setIsAudioLoading(false);

    // Autoplay next surah
    if (selectedAudioSurah) {
      const currentSurahId = parseInt(selectedAudioSurah, 10);
      if (!isNaN(currentSurahId) && currentSurahId < 114) {
        const nextSurahId = currentSurahId + 1;
        console.log(`Autoplay: Setting next surah to ${nextSurahId}`);
        setSelectedAudioSurah(nextSurahId.toString());
        setPlayIntent(true); // Set intent to play the next one automatically
      } else {
        console.log("Autoplay: Reached last surah or current ID invalid.");
      }
    } else {
      console.log("Autoplay: No current surah selected.");
    }
  }, [selectedAudioSurah]);

  // Error Handler
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
          // Ignore transient loading errors unless playback was intended
          if (playIntent) {
              errorMessage = `حدث خطأ أثناء تحميل بيانات الصوت الأولية.`;
              console.error(`Audio Error: NETWORK_LOADING and readyState < 2 for src: ${target.currentSrc}`);
          } else {
              console.warn("Ignoring transient loading error as playback was not intended.");
              errorMessage = ''; // Don't show toast
          }
      } else if (target.networkState === HTMLMediaElement.NETWORK_IDLE && target.readyState === HTMLMediaElement.HAVE_NOTHING && !target.currentSrc) {
            console.warn("Audio Error: NETWORK_IDLE and HAVE_NOTHING, no source set.");
            errorMessage = ''; // Don't show toast for initial empty state
       } else {
         console.error("Audio error occurred but MediaError object is null or state is unusual. Source:", target.src, "ReadyState:", target.readyState, "NetworkState:", target.networkState);
         errorMessage = `حدث خطأ غير متوقع مع مصدر الصوت.`;
      }

       if (errorMessage) { // Only show toast if there's a message
           showToast("خطأ في الصوت", errorMessage, "destructive");
       }

      setIsPlaying(false);
      setPlayIntent(false); // Reset intent on error
      setIsAudioLoading(false);
  }, [showToast, playIntent]); // Add playIntent dependency


  // Can Play Handler
  const handleCanPlay = useCallback(() => {
    console.log("Audio canplay.");
    setIsAudioLoading(false); // Stop loading indicator

    // If playback was intended, start playing now
    if (playIntent && audioRef.current && audioRef.current.paused) {
      console.log("Canplay: Attempting to resume intended playback.");
      audioRef.current.play().then(() => {
          setIsPlaying(true); // Set playing state ONCE play succeeds
      }).catch(err => {
        console.error("Error resuming playback on canplay:", err);
        handleAudioError(new Event('error')); // Simulate error event
      });
    } else if (!playIntent && audioRef.current && !audioRef.current.paused) {
        // If somehow playing but intent is false, pause it
        console.log("Canplay: Pausing because playIntent is false.");
        audioRef.current.pause();
        setIsPlaying(false);
    }
  }, [playIntent, handleAudioError]);


  // Waiting Handler
  const handleWaiting = useCallback(() => {
    console.log("Audio waiting (buffering)...");
    if (!isAudioLoading && (isPlaying || playIntent)) { // Show loader only if playing or intending to play
      setIsAudioLoading(true);
    }
  }, [isAudioLoading, isPlaying, playIntent]); // Added playIntent

  // Playing Handler
  const handlePlaying = useCallback(() => {
    console.log("Audio playing.");
    if (isAudioLoading) setIsAudioLoading(false);
    if (!isPlaying) setIsPlaying(true); // Ensure playing state is true
    if (!playIntent) setPlayIntent(true); // Ensure intent is also true if playing starts
  }, [isAudioLoading, isPlaying, playIntent]); // Added playIntent

  // Pause Handler
  const handlePause = useCallback(() => {
     const audio = audioRef.current;
     // Ignore pause events during seeking or when audio has ended naturally
     if (audio && !audio.seeking && !audio.ended) {
       console.log("Audio paused.");
       if (isPlaying) setIsPlaying(false); // Always set isPlaying false on pause event
        // Do NOT reset playIntent here, user might just be pausing temporarily
        if (isAudioLoading) setIsAudioLoading(false); // Stop loading indicator on explicit pause
     } else {
        console.log("Pause event ignored (seeking/ended/null).");
     }
  }, [isPlaying, isAudioLoading]);

  // Load Start Handler
   const handleLoadStart = useCallback(() => {
        console.log("Audio loadstart event.");
        // Show loader only if playback is intended (playIntent is true)
        if (playIntent && !isAudioLoading && audioRef.current?.paused) {
            console.log("Loadstart: Play intended, setting loading true.");
            setIsAudioLoading(true);
        } else {
             console.log(`Loadstart: Detected, state unchanged (playIntent: ${playIntent}, isAudioLoading: ${isAudioLoading}).`);
        }
    }, [playIntent, isAudioLoading]);

    // Stalled Handler
    const handleStalled = useCallback(() => {
        console.warn("Audio stalled event.");
        // If stalled during intended playback, show loader
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

    // Attach listeners
    audioElement.addEventListener('ended', handleAudioEnd);
    audioElement.addEventListener('error', handleAudioError);
    audioElement.addEventListener('canplay', handleCanPlay);
    audioElement.addEventListener('waiting', handleWaiting);
    audioElement.addEventListener('playing', handlePlaying);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('loadstart', handleLoadStart);
    audioElement.addEventListener('stalled', handleStalled);

    // Cleanup
    return () => {
      console.log("Cleaning up audio element...");
      const currentAudio = audioRef.current;
      if (currentAudio) {
        currentAudio.removeEventListener('ended', handleAudioEnd);
        currentAudio.removeEventListener('error', handleAudioError);
        currentAudio.removeEventListener('canplay', handleCanPlay);
        currentAudio.removeEventListener('waiting', handleWaiting);
        currentAudio.removeEventListener('playing', handlePlaying);
        currentAudio.removeEventListener('pause', handlePause);
        currentAudio.removeEventListener('loadstart', handleLoadStart);
        currentAudio.removeEventListener('stalled', handleStalled);
        try {
          currentAudio.pause();
          currentAudio.removeAttribute('src');
          currentAudio.load();
        } catch (e) {
          console.warn("Error during audio cleanup:", e);
        }
        audioRef.current = null;
      }
    };
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
            // Prioritize 'مرتل' (Murattal)
            const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
            const moshafToSelect = murattalMoshaf || moshafs[0]; // Fallback to the first one
            const previousMoshafId = selectedMoshaf?.id;

            console.log("Auto-selecting Moshaf:", {id: moshafToSelect.id, name: moshafToSelect.name});

            if (previousMoshafId !== moshafToSelect.id) {
                console.log("Setting selected Moshaf state.");
                setSelectedMoshaf(moshafToSelect);
                // Reset playback state when reciter/moshaf changes
                if (isPlaying || playIntent) {
                     console.log("Clearing audio source/state due to reciter/moshaf change.");
                     audioRef.current?.pause();
                     audioRef.current?.removeAttribute('src');
                     try { audioRef.current?.load(); } catch(e) {} // Reset element
                     setIsPlaying(false);
                     setPlayIntent(false);
                     setIsAudioLoading(false);
                     setCurrentAudioUrl(null); // Clear URL immediately
                 }
            } else {
                console.log("Selected Moshaf is already the correct one.");
            }
        } else {
            console.log("No Moshafs available for this reciter. Resetting selection.");
            setSelectedMoshaf(undefined);
            if (isPlaying || playIntent) {
                audioRef.current?.pause();
                audioRef.current?.removeAttribute('src');
                try { audioRef.current?.load(); } catch(e) {} // Reset element
                setIsPlaying(false);
                setPlayIntent(false);
                setIsAudioLoading(false);
                setCurrentAudioUrl(null); // Clear URL immediately
            }
            if (!isLoadingReciters) {
                showToast("تنبيه", "لا توجد مصاحف متاحة لهذا القارئ.");
            }
        }
    } else if (!isLoadingReciters && selectedReciterId && !recitersData?.reciters?.length) {
        console.error("Reciter selected, but reciters data is unavailable.");
        setSelectedMoshaf(undefined); // Reset moshaf if data failed
        if (isPlaying || playIntent) {
             audioRef.current?.pause();
             audioRef.current?.removeAttribute('src');
             try { audioRef.current?.load(); } catch(e) {} // Reset element
             setIsPlaying(false);
             setPlayIntent(false);
             setIsAudioLoading(false);
             setCurrentAudioUrl(null); // Clear URL immediately
         }
    }
   }, [selectedReciterId, recitersData, isLoadingReciters, selectedMoshaf, isPlaying, playIntent, showToast]);


   // Prepare Audio Source: Generates URL and sets it on the audio element
   const prepareAudioSource = useCallback(async (forceLoad = false) => {
       if (isPreparingSource.current) {
           console.warn("prepareAudioSource called while already preparing. Skipping.");
           return false;
       }
       isPreparingSource.current = true;

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
           setCurrentAudioUrl(null);
           setIsPlaying(false);
           setPlayIntent(false);
           setIsAudioLoading(false);
           isPreparingSource.current = false;
           return false;
       }

       const currentSrc = audio.src; // Use audio.src to check what *should* be loaded
       const urlMismatch = newAudioUrl !== currentSrc;
       const isSrcSet = !!currentSrc;

       console.log(`Setting new audio source: ${newAudioUrl} (forceLoad: ${forceLoad}, isSrcSet: ${isSrcSet}, urlMismatch: ${urlMismatch})`);

       // Set the new URL if it's different OR if forceLoad is true
       if (urlMismatch || forceLoad) {
           // Stop current playback and reset states before changing src
           if (isPlaying) {
               console.log("Pausing current playback before setting new source.");
               audio.pause(); // This should trigger handlePause
               setIsPlaying(false); // Explicitly set playing false
               // Do NOT reset playIntent here
           }
           if (isAudioLoading) setIsAudioLoading(false);

           setCurrentAudioUrl(newAudioUrl); // Update state

           if (playIntent || forceLoad) { // Show loader immediately if intending to play or forcing load
               console.log(`prepareAudioSource: Setting loading true (playIntent: ${playIntent}, forceLoad: ${forceLoad})`);
               setIsAudioLoading(true);
           }

           // Set the src attribute *after* state updates
           audio.src = newAudioUrl;

           // Explicitly call load() to ensure the browser fetches the new source
           try {
               console.log("Calling audio.load()...");
               audio.load();
               console.log("Audio load initiated.");
           } catch (e) {
               console.error("Error calling load():", e);
               handleAudioError(new Event('error')); // Simulate error
               isPreparingSource.current = false;
               return false;
           }
       } else {
           console.log("Audio source is already correct. No preparation needed.");
           // If URL is correct but not loading/playing, ensure loading is false
           if (isAudioLoading && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
               setIsAudioLoading(false);
           }
       }

       isPreparingSource.current = false;
       return true; // Indicate preparation was attempted/successful
   }, [selectedMoshaf, selectedAudioSurah, isPlaying, isAudioLoading, playIntent, showToast, handleAudioError]); // Dependencies


  // Effect to trigger source preparation when selections or play intent change
  useEffect(() => {
      // Prepare source whenever selections change OR when playIntent becomes true
      // The `forceLoad` parameter is true only if playIntent just became true
      const force = playIntent && !isPlaying && !isAudioLoading;
      console.log(`Selection/Moshaf/Intent changed, preparing audio source (force load: ${force})...`);
      prepareAudioSource(force);
      // This effect should react to the *desire* to load/play, not the loading state itself
  }, [selectedMoshaf, selectedAudioSurah, playIntent, prepareAudioSource]);


  // Effect to handle play/pause based ONLY on playIntent
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log(`Play/Pause Effect: playIntent=${playIntent}, isPlaying=${isPlaying}, paused=${audio.paused}, loading=${isAudioLoading}, readyState=${audio.readyState}, currentSrc='${audio.currentSrc}'`);

    if (playIntent) {
      // We want to play
      if (audio.paused) {
          // Only play if we have a valid source and are ready enough (or expect to be soon)
         if (audio.currentSrc && audio.networkState !== HTMLMediaElement.NETWORK_NO_SOURCE) {
             console.log("Play/Pause Effect: Attempting to play...");
             // If readyState is low, 'canplay' handler will eventually trigger play
             if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA && !isAudioLoading) {
                 console.log("Play/Pause Effect: Buffering likely needed, setting loading true.");
                 setIsAudioLoading(true);
             }
             // Initiate play - browser might delay until ready
             audio.play().then(() => {
                 // Don't set isPlaying here, let 'playing' event handle it
             }).catch(err => {
                console.error("Error calling play() from effect:", err);
                handleAudioError(new Event('error')); // Simulate error event
                setPlayIntent(false); // Reset intent on play error
             });
          } else {
             console.warn("Play/Pause Effect: Cannot play - No valid source or network error state.");
             // Don't reset playIntent here, maybe the source will load later
             if (!audio.currentSrc && currentAudioUrl) {
                console.log("Play/Pause Effect: URL exists but src missing. Re-preparing source.");
                prepareAudioSource(true); // Force reload
             } else if (!currentAudioUrl) {
                console.log("Play/Pause Effect: No URL selected.");
                setPlayIntent(false); // Reset intent if no URL
             }
          }
      } else {
          console.log("Play/Pause Effect: Already playing or play initiated.");
          // Ensure loading is false if playing starts and data is available
           if (isAudioLoading && audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
               setIsAudioLoading(false);
           }
           // Ensure isPlaying reflects the actual state if 'playing' event was missed
           if (!isPlaying) setIsPlaying(true);
      }
    } else { // playIntent is false
      if (!audio.paused) {
        console.log("Play/Pause Effect: Pausing audio due to playIntent false...");
        audio.pause(); // The 'pause' event handler will manage isPlaying state
      } else {
         console.log("Play/Pause Effect: Already paused.");
      }
       // If paused while loading, stop the loading indicator
      if (isAudioLoading) {
            setIsAudioLoading(false);
      }
    }
  // Only react to playIntent changes directly
  }, [playIntent, currentAudioUrl, handleAudioError, prepareAudioSource]);


  // Update audio volume effect
  useEffect(() => {
    if (audioRef.current) {
      const newVolume = isMuted ? 0 : volume / 100;
      console.log(`Setting volume: ${newVolume} (muted: ${isMuted}, slider: ${volume})`)
      audioRef.current.volume = newVolume;
    }
  }, [volume, isMuted]);


  // --- UI Event Handlers ---

  const handlePlayPause = () => {
    const audio = audioRef.current;
    console.log(`Play/Pause clicked. Current state: isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}, src=${audio?.currentSrc}, readyState=${audio?.readyState}, playIntent=${playIntent}`);

    if (!selectedMoshaf || !selectedAudioSurah) {
      showToast("تنبيه", "الرجاء اختيار القارئ والسورة أولاً.");
      return;
    }

    // Toggle the user's *intent* to play/pause
    const newPlayIntent = !playIntent;
    setPlayIntent(newPlayIntent);

    // If trying to play immediately and source isn't ready, prepare it forcefully
    if (newPlayIntent && (!audio || !audio.currentSrc || audio.readyState < HTMLMediaElement.HAVE_METADATA)) {
        console.log("Play clicked, preparing source...");
        prepareAudioSource(true); // Force load if needed
    } else if (!newPlayIntent && audio) {
        // If pausing, directly pause the element
        audio.pause();
    }
  };

   const handleReciterChange = (value: string) => {
     console.log("Selected Reciter changed:", value);
     // Reset playback state *before* changing selections
     if (isPlaying || playIntent) {
         audioRef.current?.pause();
         setIsPlaying(false);
         setPlayIntent(false);
         setIsAudioLoading(false);
         setCurrentAudioUrl(null); // Ensure URL is cleared
     }
     setSelectedReciterId(value);
     // Moshaf selection and URL update will follow in effects
   };

   const handleSurahChange = (value: string) => {
     console.log("Selected Audio Surah changed:", value);
     // Reset playback state *before* changing selections
     if (isPlaying || playIntent) {
       audioRef.current?.pause();
       setIsPlaying(false);
       setPlayIntent(false); // Reset intent when surah changes
       setIsAudioLoading(false);
       setCurrentAudioUrl(null); // Ensure URL is cleared
     }
     setSelectedAudioSurah(value);
     // URL update and source preparation will follow in effects
   };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    // If unmuting via slider, also update isMuted state
    if (isMuted && newVolume > 0) setIsMuted(false);
    // If volume is zeroed by slider, update isMuted state
    else if (!isMuted && newVolume === 0) setIsMuted(true);
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    // If unmuting and volume was 0, set a minimum volume
    if (!newMutedState && volume === 0) setVolume(10);
  };

  // Determine if the play button should be disabled
  const isPlayDisabled = (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah || isLoadingReciters);


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
                 {isAudioLoading ? <Loader2 className="animate-spin h-5 w-5" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                 <span className="sr-only">{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
               </Button>
            </TooltipTrigger>
             <TooltipContent>
               <p className="font-cairo">{isPlayDisabled ? 'يرجى تحديد القارئ والمصحف والسورة' : (isAudioLoading ? 'جاري التحميل...' : (isPlaying ? 'إيقاف مؤقت' : 'تشغيل'))}</p>
             </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Volume Control */}
        <div className="flex items-center gap-2 w-32">
          <Slider
            dir="ltr" // Keep LTR for standard slider behavior
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
              {/* Ensure DialogTitle is present for accessibility */}
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

