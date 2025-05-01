
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
  const isResettingPlayback = useRef(false); // Flag to prevent effects during reset

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
    // Debounce destructive toasts with the same message
    if (variant === "destructive" && description === lastErrorRef.current) {
      return;
    }
    toast({ title, description, variant });
    if (variant === "destructive") {
      lastErrorRef.current = description;
      // Clear the last error after a delay to allow re-showing if it happens again later
      setTimeout(() => { lastErrorRef.current = null; }, 5000);
    }
  }, [toast]);

  // --- Audio Event Handlers ---
  // Wrap handlers in useCallback to stabilize references
  const handleAudioEnd = useCallback(() => {
    console.log("Audio ended.");
    setIsPlaying(false);
    setIsAudioLoading(false); // Should already be false, but ensure

    // Autoplay next surah
    if (selectedAudioSurah) {
      const currentSurahId = parseInt(selectedAudioSurah, 10);
      if (!isNaN(currentSurahId) && currentSurahId < 114) {
        const nextSurahId = (currentSurahId + 1).toString();
        console.log(`Autoplay: Setting next surah to ${nextSurahId}`);
        setSelectedAudioSurah(nextSurahId);
        // Let the useEffect triggered by selectedAudioSurah handle the source preparation
        // If the user intended to play (playIntent was true), keep it true
        // This ensures playback continues automatically if it was already playing
        if (playIntent) {
            // No need to set playIntent again, it should persist
             console.log("Autoplay: Keeping playIntent true for next track.");
        } else {
            console.log("Autoplay: playIntent is false, won't start next track automatically.");
        }

      } else {
        console.log("Autoplay: Reached last surah or current ID invalid. Stopping intent.");
        setPlayIntent(false); // Stop intent if last surah reached
      }
    } else {
       console.log("Autoplay: No current surah selected. Stopping intent.");
       setPlayIntent(false); // Stop intent if no surah selected
    }
  }, [selectedAudioSurah, playIntent]); // Include playIntent

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
            // Often triggered by changing src, usually not a critical error unless playback was intended
            errorMessage = playIntent ? 'تم إجهاض عملية جلب الصوت.' : '';
            if(playIntent) console.warn("Audio fetch aborted while playback was intended.");
            else console.log("Audio fetch aborted (likely due to src change).");
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = `حدث خطأ في الشبكة أثناء جلب الصوت. تحقق من اتصالك.`;
            break;
          case MediaError.MEDIA_ERR_DECODE:
             errorMessage = `حدث خطأ أثناء فك تشفير ملف الصوت. قد يكون الملف تالفًا أو غير مدعوم.`;
             console.error(`Detailed DECODE error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
             // This is the most likely error based on logs: "Format error" or "No supported sources"
             errorMessage = `تعذر تحميل أو فك تشفير مصدر الصوت. قد يكون الرابط غير صالح (${target.src}) أو أن التنسيق غير مدعوم من المتصفح.`;
             console.error(`Detailed SRC_NOT_SUPPORTED error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
             break;
          default:
            errorMessage = `حدث خطأ غير معروف في الصوت (الكود: ${error.code}).`;
             console.error(`Detailed UNKNOWN error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
        }
      } else {
          // Handle cases where error object is null but state indicates a problem
          console.error("Audio error occurred but MediaError object is null. Source:", target.src, "ReadyState:", target.readyState, "NetworkState:", target.networkState);
          errorMessage = `حدث خطأ غير متوقع مع مصدر الصوت.`;
      }

       // Reset states reliably on any significant error
       setIsPlaying(false);
       setPlayIntent(false); // Crucial: Stop trying to play on error
       setIsAudioLoading(false);

       if (errorMessage) {
           showToast("خطأ في الصوت", errorMessage, "destructive");
       }

  }, [showToast, playIntent]); // Include playIntent

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
        // Simulate error event for consistent handling
        handleAudioError(new Event('error'));
      });
    } else if (!playIntent && !audio.paused) {
        // If somehow playing but intent is false, pause it
        console.log("Canplay: Pausing because playIntent is false.");
        audio.pause();
    }
  }, [playIntent, handleAudioError]); // Depend on playIntent and error handler

  const handleWaiting = useCallback(() => {
    console.log("Audio waiting (buffering)...");
    // Show loader only if intending to play and not already marked as loading
    if (playIntent && !isAudioLoading) {
      setIsAudioLoading(true);
    }
  }, [playIntent, isAudioLoading]); // Depend on playIntent and loading state

  const handlePlaying = useCallback(() => {
    console.log("Audio playing.");
    // Ensure loading indicator is off and playing state is true
    if (isAudioLoading) setIsAudioLoading(false);
    if (!isPlaying) setIsPlaying(true);
  }, [isAudioLoading, isPlaying]); // Depend on loading and playing states

  const handlePause = useCallback(() => {
     const audio = audioRef.current;
     // Check if pause is legitimate (not due to seeking, ending, or error handling)
     if (audio && !audio.seeking && !audio.ended && !isResettingPlayback.current) {
       console.log("Audio paused.");
       if (isPlaying) setIsPlaying(false);
       // Don't reset playIntent here, user might resume
       if (isAudioLoading) setIsAudioLoading(false); // Stop loading indicator if paused during buffer
     } else {
        console.log("Pause event ignored (seeking/ended/resetting/null).");
     }
  }, [isPlaying, isAudioLoading]); // Depend on relevant states

   const handleLoadStart = useCallback(() => {
        console.log("Audio loadstart event.");
        // Show loader immediately if playback is intended.
        // This covers cases where src changes and we intend to play immediately.
        if (playIntent && !isAudioLoading) {
            console.log("Loadstart: Play intended, setting loading true.");
            setIsAudioLoading(true);
        } else {
             console.log(`Loadstart: Detected, state unchanged (playIntent: ${playIntent}, isAudioLoading: ${isAudioLoading}).`);
        }
    }, [playIntent, isAudioLoading]); // Depend on intent and loading state

    const handleStalled = useCallback(() => {
        console.warn("Audio stalled event.");
        // If playback was intended, show loading indicator as buffering might be needed
        if (playIntent && !isAudioLoading) {
            setIsAudioLoading(true);
        }
    }, [playIntent, isAudioLoading]); // Depend on intent and loading state


  // --- Effects ---

  // Initialize Audio Element & Attach Listeners
  useEffect(() => {
    console.log("Initializing audio element...");
    const audioElement = new Audio();
    audioElement.preload = 'metadata'; // Preload only metadata initially
    audioRef.current = audioElement;

    // Define listeners using the useCallback handlers
    const onError = (e: Event) => handleAudioError(e);
    const onCanPlay = () => handleCanPlay();
    const onWaiting = () => handleWaiting();
    const onPlaying = () => handlePlaying();
    const onPause = () => handlePause();
    const onEnded = () => handleAudioEnd();
    const onLoadStart = () => handleLoadStart();
    const onStalled = () => handleStalled();

    // Attach listeners
    audioElement.addEventListener('error', onError);
    audioElement.addEventListener('canplay', onCanPlay);
    audioElement.addEventListener('waiting', onWaiting);
    audioElement.addEventListener('playing', onPlaying);
    audioElement.addEventListener('pause', onPause);
    audioElement.addEventListener('ended', onEnded);
    audioElement.addEventListener('loadstart', onLoadStart);
    audioElement.addEventListener('stalled', onStalled);

    // Cleanup function
    return () => {
      console.log("Cleaning up audio element...");
      const currentAudio = audioRef.current; // Capture ref in closure
      if (currentAudio) {
        // Remove listeners
        currentAudio.removeEventListener('error', onError);
        currentAudio.removeEventListener('canplay', onCanPlay);
        currentAudio.removeEventListener('waiting', onWaiting);
        currentAudio.removeEventListener('playing', onPlaying);
        currentAudio.removeEventListener('pause', onPause);
        currentAudio.removeEventListener('ended', onEnded);
        currentAudio.removeEventListener('loadstart', onLoadStart);
        currentAudio.removeEventListener('stalled', onStalled);

        // Stop playback and release resources
        try {
          isResettingPlayback.current = true; // Signal that we are resetting
          currentAudio.pause();
          currentAudio.removeAttribute('src'); // Remove src to stop potential background loading
          currentAudio.load(); // Reset internal state
          isResettingPlayback.current = false;
        } catch (e) {
          console.warn("Error during audio cleanup:", e);
          isResettingPlayback.current = false; // Ensure flag is reset even on error
        }
      }
       // Prevent memory leak by nullifying the ref
      audioRef.current = null;
    };
    // Rerun only if the handler references change (which they shouldn't due to useCallback)
  }, [handleAudioEnd, handleAudioError, handleCanPlay, handleWaiting, handlePlaying, handlePause, handleLoadStart, handleStalled]);


  // Effect to select the appropriate Moshaf when reciter changes or data loads
  useEffect(() => {
    console.log(`Reciter/Data Check: ID=${selectedReciterId}, Data loaded=${!!recitersData}, Loading=${isLoadingReciters}`);
    if (!selectedReciterId || !recitersData?.reciters || isLoadingReciters) {
        // If no reciter selected, data not loaded, or still loading, do nothing or reset
        if (!isLoadingReciters && selectedReciterId && !recitersData?.reciters?.length) {
            console.error("Reciter selected, but reciters data is unavailable or empty.");
            setSelectedMoshaf(undefined);
             // Reset playback if necessary (only if changing from a valid state)
            if (selectedMoshaf) resetPlaybackState();
        }
        return; // Exit early
    }

    const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
    console.log("Found reciter:", reciter?.name);
    const moshafs = reciter?.moshaf ?? [];
    console.log("Available Moshafs:", moshafs.map(m => ({id: m.id, name: m.name})));

    const previousMoshafId = selectedMoshaf?.id;
    let moshafToSelect: Moshaf | undefined = undefined;

    if (moshafs.length > 0) {
      const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
      moshafToSelect = murattalMoshaf || moshafs[0]; // Prioritize Murattal, fallback to first
      console.log("Auto-selecting Moshaf:", {id: moshafToSelect.id, name: moshafToSelect.name});
    } else {
      console.log("No Moshafs available for this reciter.");
      if (!isLoadingReciters) { // Avoid toast spam during initial load
          showToast("تنبيه", "لا توجد مصاحف متاحة لهذا القارئ.");
      }
    }

    // Update state only if the selected Moshaf needs to change
    if (selectedMoshaf?.id !== moshafToSelect?.id) {
        console.log("Updating selected Moshaf state.");
        setSelectedMoshaf(moshafToSelect); // This will trigger the source preparation effect if needed
        resetPlaybackState(); // Reset playback whenever the moshaf changes
    } else {
        console.log("Selected Moshaf is already the correct one or no moshaf available.");
    }

  }, [selectedReciterId, recitersData, isLoadingReciters, showToast]); // Removed selectedMoshaf dependency to avoid loops


  // Function to reset playback state
  const resetPlaybackState = useCallback(() => {
      console.log("Resetting playback state...");
      isResettingPlayback.current = true;
      const audio = audioRef.current;
      if (audio) {
         try {
            if (!audio.paused) audio.pause();
            // Check if src exists before removing and loading
            if (audio.currentSrc || audio.src) {
                audio.removeAttribute('src');
                audio.load(); // Reset the element state
            }
         } catch(e) {
             console.warn("Minor error during playback reset:", e);
         }
      }
      setIsPlaying(false);
      setPlayIntent(false); // Reset intent
      setIsAudioLoading(false);
      setCurrentAudioUrl(null); // Clear the URL state
      // Introduce a tiny delay before allowing effects to run again
       setTimeout(() => { isResettingPlayback.current = false; }, 50);
  }, []);


  // Prepare Audio Source: Generates URL and sets it on the audio element
  const prepareAudioSource = useCallback(async (forceLoad = false) => {
     if (isResettingPlayback.current) {
         console.warn("prepareAudioSource skipped: Playback reset in progress.");
         return false;
     }
     if (isPreparingSource.current) {
         console.warn("prepareAudioSource called while already preparing. Skipping.");
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
         resetPlaybackState(); // Reset on URL generation failure
         isPreparingSource.current = false;
         return false;
     }

     const currentSrc = audio.currentSrc || audio.src; // Check both properties
     const urlMismatch = newAudioUrl !== currentSrc;

     console.log(`URL check: New='${newAudioUrl}', Current='${currentSrc}', Mismatch=${urlMismatch}`);

     if (urlMismatch || forceLoad) {
         console.log(`Setting new audio source: ${newAudioUrl} (forceLoad: ${forceLoad}, urlMismatch: ${urlMismatch})`);

         // Pause and reset state *before* changing src
         if (!audio.paused) {
             console.log("Pausing current playback before setting new source.");
             audio.pause();
         }
         setIsPlaying(false); // Ensure playing state is false before loading new src
         if (playIntent && !isAudioLoading) setIsAudioLoading(true); // Show loader if intent is to play

         setCurrentAudioUrl(newAudioUrl); // Update URL state

         // Set the new source
         audio.src = newAudioUrl;

         // Explicitly call load() to fetch the new source
         try {
             console.log("Calling audio.load()...");
             audio.load();
             console.log("Audio load initiated.");
             isPreparingSource.current = false;
             return true; // Indicate success
         } catch (e) {
             console.error("Error calling load():", e);
             handleAudioError(new Event('error')); // Simulate error
             isPreparingSource.current = false;
             return false; // Indicate failure
         }
     } else {
         console.log("Audio source is already correct. No preparation needed.");
         // Ensure loading state is consistent if source is correct
         if (isAudioLoading && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
             setIsAudioLoading(false);
         }
         isPreparingSource.current = false;
         return true; // Source is correct
     }
  }, [selectedMoshaf, selectedAudioSurah, isPlaying, isAudioLoading, playIntent, showToast, handleAudioError, resetPlaybackState]); // Added resetPlaybackState


  // Effect to trigger source preparation when selections or play intent change
  useEffect(() => {
      if (isResettingPlayback.current) {
           console.log("Source prep effect skipped: Playback reset in progress.");
           return;
       }
      // Determine if forceLoad is needed (i.e., if intent is to play)
      const shouldForceLoad = playIntent;
      console.log(`Selection/Moshaf/Intent changed, preparing audio source (force load: ${shouldForceLoad})...`);
      prepareAudioSource(shouldForceLoad);
  }, [selectedMoshaf, selectedAudioSurah, playIntent, prepareAudioSource]); // Re-added playIntent


  // Effect to handle actual playback based on playIntent and audio state
  useEffect(() => {
      if (isResettingPlayback.current) {
           console.log("Play effect skipped: Playback reset in progress.");
           return;
       }
      const audio = audioRef.current;
      if (!audio) return;

      console.log(`Play/Pause Effect: playIntent=${playIntent}, isPlaying=${isPlaying}, paused=${audio.paused}, loading=${isAudioLoading}, readyState=${audio.readyState}, currentSrc='${audio.currentSrc}'`);

      if (playIntent) {
          if (audio.paused) {
              // Only attempt to play if ready or potentially ready
              if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                   console.log("Play/Pause Effect: Intent=true, Paused, Ready. Calling play().");
                   audio.play().catch(err => {
                       console.error("Error in play effect:", err);
                       handleAudioError(new Event('error'));
                   });
              } else if (audio.readyState === HTMLMediaElement.HAVE_NOTHING && audio.networkState === HTMLMediaElement.NETWORK_IDLE && audio.currentSrc) {
                  // If src is set but nothing loaded, call load() again if forceLoad was used
                  console.log("Play/Pause Effect: Intent=true, Paused, Nothing loaded. Re-calling load().");
                   // Show loading indicator if not already shown
                   if (!isAudioLoading) setIsAudioLoading(true);
                   try { audio.load(); } catch (e) { handleAudioError(new Event('error')); }
              } else if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
                  console.log("Play/Pause Effect: Intent=true, Paused, Not ready. Waiting for 'canplay'. Setting loading state.");
                  // Show loading indicator if not already shown by loadstart
                   if (!isAudioLoading) setIsAudioLoading(true);
              }
          } else {
               console.log("Play/Pause Effect: Intent=true, Already playing.");
               // Ensure loading is off if playing
                if (isAudioLoading) setIsAudioLoading(false);
          }
      } else {
          // Intent is to pause
          if (!audio.paused) {
              console.log("Play/Pause Effect: Intent=false, Playing. Calling pause().");
              audio.pause(); // Let 'pause' event handle state updates
          } else {
               console.log("Play/Pause Effect: Intent=false, Already paused.");
          }
          // Ensure loading is off if pausing
          if (isAudioLoading) setIsAudioLoading(false);
      }
  }, [playIntent, isPlaying, isAudioLoading, handleAudioError]); // Dependencies


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
    setPlayIntent(prev => !prev);

  }, [audioRef, isPlaying, isAudioLoading, playIntent, selectedMoshaf, selectedAudioSurah, showToast]); // Minimal dependencies


   const handleReciterChange = useCallback((value: string) => {
     console.log("Selected Reciter changed:", value);
     // Reset playback state *before* changing selections to prevent race conditions
     resetPlaybackState();
     setSelectedReciterId(value);
     // Moshaf selection and source preparation will follow in effects
   }, [resetPlaybackState]); // Depend on reset function

   const handleSurahChange = useCallback((value: string) => {
     console.log("Selected Audio Surah changed:", value);
     // Reset playback state *before* changing selections
     resetPlaybackState();
     setSelectedAudioSurah(value);
     // Source preparation will follow in effects
   }, [resetPlaybackState]); // Depend on reset function

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (isMuted && newVolume > 0) setIsMuted(false);
    else if (!isMuted && newVolume === 0) setIsMuted(true);
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (!newMutedState && volume === 0) setVolume(10); // Unmute to a minimum volume if slider is at 0
  };

  const isPlayDisabled = (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah || isLoadingReciters);


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        {isMobile && <SidebarTrigger icon={Menu} />}
         {/* Title removed as requested */}
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

