
"use client";

import React, { useState, useRef, useEffect } from 'react';
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
  const [playIntent, setPlayIntent] = useState(false); // Track explicit user play requests OR autoplay intent
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMobile } = useSidebar();
  const { toast } = useToast();

  // Fetch reciters
  const { data: recitersData, isLoading: isLoadingReciters, error: recitersError } = useQuery({
    queryKey: ['reciters'],
    queryFn: () => fetchReciters('ar'),
    staleTime: Infinity, // Cache indefinitely
    gcTime: Infinity,    // Cache indefinitely
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Handle audio end
  const handleAudioEnd = React.useCallback(() => {
    console.log("Audio ended.");
    setIsPlaying(false);
    setIsAudioLoading(false);
    setPlayIntent(false); // Reset play intent

    // Autoplay next surah
    if (selectedAudioSurah) {
      const currentSurahId = parseInt(selectedAudioSurah, 10);
      if (!isNaN(currentSurahId) && currentSurahId < 114) {
        const nextSurahId = currentSurahId + 1;
        console.log(`Autoplay: Setting next surah to ${nextSurahId}`);
        setSelectedAudioSurah(nextSurahId.toString());
        // Set play intent for autoplay
        setPlayIntent(true);
        // The useEffect for selection change will handle loading,
        // and the 'canplay' event will trigger play if playIntent is true.
      } else {
        console.log("Autoplay: Reached last surah or current ID invalid.");
      }
    } else {
      console.log("Autoplay: No current surah selected.");
    }
  }, [selectedAudioSurah]); // Add dependency

  // Initialize audio element and listeners
  useEffect(() => {
    console.log("Initializing audio element...");
    const audioElementInstance = new Audio();
    audioElementInstance.preload = 'auto'; // Allow browser to decide how much to load initially
    audioRef.current = audioElementInstance;

    // --- Event Listeners ---

    // Error Handler
    const handleAudioError = (e: Event) => {
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
            errorMessage = `حدث خطأ في الشبكة أثناء جلب الصوت.`;
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
      } else if (target.networkState === HTMLMediaElement.NETWORK_NO_SOURCE && target.readyState === HTMLMediaElement.HAVE_NOTHING) {
          errorMessage = `تعذر العثور على مصدر الصوت أو أن التنسيق غير مدعوم.`;
          console.error(`Audio Error: NETWORK_NO_SOURCE for src: ${target.currentSrc}`);
      } else {
         console.error("Audio error occurred but MediaError object is null. Source:", target.src, "ReadyState:", target.readyState, "NetworkState:", target.networkState);
         if (!target.src || target.src === window.location.href) {
            errorMessage = "لم يتم تعيين مصدر صوت صالح.";
         } else if (target.networkState === HTMLMediaElement.NETWORK_EMPTY) {
             errorMessage = `فشل تحميل ملف الصوت من الخادم.`;
             console.error(`Audio Error: NETWORK_EMPTY for src: ${target.src}`);
         } else if (target.networkState === HTMLMediaElement.NETWORK_IDLE && target.readyState === HTMLMediaElement.HAVE_NOTHING) {
             errorMessage = `توقف تحميل الصوت. تحقق من اتصال الشبكة.`;
             console.error(`Audio Error: NETWORK_IDLE and HAVE_NOTHING for src: ${target.src}`);
         } else {
            errorMessage = `حدث خطأ غير متوقع مع مصدر الصوت.`;
            console.error(`Audio Error: Unknown state - readyState=${target.readyState}, networkState=${target.networkState}, src=${target.currentSrc}`);
         }
      }

      toast({
        title: "خطأ في الصوت",
        description: errorMessage,
        variant: "destructive",
      });
      setIsPlaying(false);
      setIsAudioLoading(false);
      setPlayIntent(false); // Reset intent on error
    };


    // Can Play Handler - Indicates enough data is loaded to start playing
    const handleCanPlay = () => {
      const currentAudioRef = audioRef.current;
       if (!currentAudioRef) return;
      console.log("Audio canplay event. ReadyState:", currentAudioRef.readyState);

       // If we were loading, mark as not loading now.
      if (isAudioLoading) {
          console.log("Canplay: Audio ready enough, setting isAudioLoading false.");
          setIsAudioLoading(false);
      }

       // Only play if play was intended AND the audio is currently paused
      if (playIntent && currentAudioRef.paused) {
        console.log("Canplay: Play intent active and audio paused, attempting play...");
        currentAudioRef.play().then(() => {
            console.log("Canplay: Playback started successfully.");
             setIsPlaying(true); // Ensure state consistency
             if(isAudioLoading) setIsAudioLoading(false); // Should be false
        }).catch(err => {
          console.error("Play failed during canplay handler:", err);
           // The 'error' event listener will handle the toast and state changes
        });
      } else {
          console.log(`Canplay: Conditions not met for play (playIntent: ${playIntent}, paused: ${currentAudioRef.paused}).`);
          // Ensure loading is false if we reached canplay
           if (isAudioLoading) setIsAudioLoading(false);
      }
    };


    // Waiting Handler (Buffering)
    const handleWaiting = () => {
        const currentAudioRef = audioRef.current;
        if (!currentAudioRef || currentAudioRef.seeking) return;
        console.log("Audio waiting event (buffering)... ReadyState:", currentAudioRef.readyState);
        // Show loader only if play was intended (meaning we expect it to play soon)
        if (playIntent && !isAudioLoading) {
            console.log("Waiting: Buffering started, setting isAudioLoading true.");
            setIsAudioLoading(true);
        }
    };

    // Playing Handler - Fired when playback actually starts/resumes
    const handlePlaying = () => {
      const currentAudioRef = audioRef.current;
      if (!currentAudioRef || currentAudioRef.seeking) return; // Ignore if seeking
      console.log("Audio playing event.");
      // Ensure states reflect reality
      if (isAudioLoading) setIsAudioLoading(false);
      if (!isPlaying) setIsPlaying(true);
    };

    // Pause Handler - Fired when audio pauses (explicitly or implicitly)
    const handlePause = () => {
       const currentAudioRef = audioRef.current;
       if (!currentAudioRef || currentAudioRef.seeking) {
           console.log(`Pause event ignored during seek (${currentAudioRef?.seeking}).`);
           return;
       }
       console.log("Audio pause event. ReadyState:", currentAudioRef.readyState);
       // Only update state if it's currently playing
       if (isPlaying) {
         setIsPlaying(false);
         console.log("Pause: Setting isPlaying false.");
       }
        // Important: Don't reset playIntent here automatically.
        // A pause could be temporary (buffering). Reset playIntent only on explicit user pause or error/end.
    };

    // Load Start Handler - Fired when the browser begins loading the media data
    const handleLoadStart = () => {
        const currentAudioRef = audioRef.current;
        if (!currentAudioRef) return;
        console.log("Audio loadstart event.");
        // Show loader immediately IF play is intended. 'canplay' or 'error' will resolve this.
        if (playIntent && !isAudioLoading) {
            console.log("Loadstart: Play intended, setting isAudioLoading true.");
            setIsAudioLoading(true);
        } else {
             console.log(`Loadstart: Detected, state unchanged (playIntent: ${playIntent}, isAudioLoading: ${isAudioLoading}).`);
        }
    };

    // Attach Listeners
    audioElementInstance.addEventListener('ended', handleAudioEnd);
    audioElementInstance.addEventListener('error', handleAudioError);
    audioElementInstance.addEventListener('canplay', handleCanPlay); // Enough data to start
    // audioElement.addEventListener('canplaythrough', handleCanPlay); // Enough data to play to end (alternative)
    audioElementInstance.addEventListener('waiting', handleWaiting);
    audioElementInstance.addEventListener('playing', handlePlaying);
    audioElementInstance.addEventListener('pause', handlePause);
    audioElementInstance.addEventListener('loadstart', handleLoadStart);

    // Cleanup
    return () => {
      console.log("Cleaning up audio element...");
      const currentAudioElement = audioRef.current;
       if (currentAudioElement) {
           currentAudioElement.removeEventListener('ended', handleAudioEnd);
           currentAudioElement.removeEventListener('error', handleAudioError);
           currentAudioElement.removeEventListener('canplay', handleCanPlay);
           currentAudioElement.removeEventListener('waiting', handleWaiting);
           currentAudioElement.removeEventListener('playing', handlePlaying);
           currentAudioElement.removeEventListener('pause', handlePause);
           currentAudioElement.removeEventListener('loadstart', handleLoadStart);
           try {
             if (!currentAudioElement.paused) currentAudioElement.pause();
             currentAudioElement.removeAttribute('src');
             currentAudioElement.load(); // Reset internal state
             console.log("Audio element resources released.");
           } catch(e) { console.warn("Error during audio cleanup:", e); }
           audioRef.current = null;
       }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, handleAudioEnd]); // Re-evaluate dependencies if necessary


  // Effect to select the appropriate Moshaf when reciter changes
  useEffect(() => {
    console.log(`Reciter/Data Check: ID=${selectedReciterId}, Data loaded=${!!recitersData}, Loading=${isLoadingReciters}`);
    if (selectedReciterId && recitersData?.reciters) {
      const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
      console.log("Found reciter:", reciter?.name);
      const moshafs = reciter?.moshaf ?? [];
      console.log("Available Moshafs:", moshafs.map(m => ({id: m.id, name: m.name, server: m.server})));

      if (moshafs.length > 0) {
        // Prefer 'مرتل' (Murattal) if available, otherwise take the first one
        const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
        const moshafToSelect = murattalMoshaf || moshafs[0];
        const previousMoshafId = selectedMoshaf?.id;

        console.log("Auto-selecting Moshaf:", {id: moshafToSelect.id, name: moshafToSelect.name, server: moshafToSelect.server});

        // Update state only if the moshaf actually changes
        if (previousMoshafId !== moshafToSelect.id) {
            console.log("Setting selected Moshaf state.");
            setSelectedMoshaf(moshafToSelect);
            // Reset audio state when moshaf changes
            if (audioRef.current) {
                console.log("Clearing audio source/state due to reciter/moshaf change.");
                if (!audioRef.current.paused) audioRef.current.pause();
                audioRef.current.removeAttribute('src');
                try { audioRef.current.load(); } catch(e) { console.warn("Load error on moshaf change:", e); }
            }
            setIsPlaying(false);
            setIsAudioLoading(false);
            setPlayIntent(false); // Cancel any previous intent
        } else {
            console.log("Selected Moshaf is already the correct one.");
        }
      } else {
        console.log("No Moshafs available for this reciter. Resetting selection.");
        // Only reset if a moshaf was previously selected
        if (selectedMoshaf) {
            setSelectedMoshaf(undefined);
            if (audioRef.current) {
                console.log("Clearing audio source/state because no moshafs available.");
                if (!audioRef.current.paused) audioRef.current.pause();
                audioRef.current.removeAttribute('src');
                try { audioRef.current.load(); } catch(e) { console.warn("Load error on no moshaf:", e); }
            }
            setIsPlaying(false);
            setIsAudioLoading(false);
            setPlayIntent(false);
        }
        if(!isLoadingReciters) {
          toast({ title: "تنبيه", description: "لا توجد مصاحف متاحة لهذا القارئ.", variant: "default"});
        }
      }
    } else if (!isLoadingReciters && selectedReciterId && !recitersData?.reciters?.length) {
      console.error("Reciter selected, but reciters data is unavailable.");
      // Handle UI indication of data loading failure if needed
      // toast({ title: "خطأ", description: "فشل في تحميل بيانات القراء.", variant: "destructive"});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReciterId, recitersData, isLoadingReciters, toast]); // Removed selectedMoshaf


  // Prepare audio source function (sets src and calls load)
  const prepareAudioSource = React.useCallback((forceLoad: boolean = false): boolean => {
    console.log(`Attempting to prepare audio source (forceLoad: ${forceLoad})...`);
    const currentAudioRef = audioRef.current;
    console.log(`Current state: reciterId=${selectedReciterId}, moshafId=${selectedMoshaf?.id}, surah=${selectedAudioSurah}, currentSrc='${currentAudioRef?.currentSrc}', isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}, playIntent=${playIntent}, readyState=${currentAudioRef?.readyState}`);

    if (!currentAudioRef) {
      console.error("prepareAudioSource: audioRef is null.");
      return false;
    }

    if (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah) {
      console.warn("prepareAudioSource: Cannot prepare - Missing selections (Reciter, Moshaf, or Surah).");
       // Clear src if selections invalid & src exists
       if (currentAudioRef.currentSrc && currentAudioRef.currentSrc !== window.location.href) {
            console.log("Clearing potentially invalid audio source due to missing selections.");
            if (!currentAudioRef.paused) currentAudioRef.pause();
            currentAudioRef.removeAttribute('src');
            try { currentAudioRef.load(); } catch(e) { console.warn("Load error on missing selections:", e); }
            setIsPlaying(false);
            setIsAudioLoading(false);
            setPlayIntent(false);
       }
      return false;
    }

    if (!selectedMoshaf.server || typeof selectedMoshaf.server !== 'string' || !(selectedMoshaf.server.startsWith('http://') || selectedMoshaf.server.startsWith('https://'))) {
          console.error(`prepareAudioSource: Invalid server URL: ${selectedMoshaf.server}`);
          toast({ title: "خطأ", description: `رابط المصحف (${selectedMoshaf.name}) غير صالح.`, variant: "destructive"});
           if (currentAudioRef.currentSrc && currentAudioRef.currentSrc !== window.location.href) {
               if (!currentAudioRef.paused) currentAudioRef.pause();
               currentAudioRef.removeAttribute('src');
               try { currentAudioRef.load(); } catch(e) { console.warn("Load error on invalid server URL:", e); }
               setIsPlaying(false);
               setIsAudioLoading(false);
               setPlayIntent(false);
           }
          return false;
    }

    try {
      const audioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
      console.log(`Generated audio URL: ${audioUrl}`);

      if (!audioUrl) {
        console.error("prepareAudioSource: Generated audio URL is invalid.");
        toast({ title: "خطأ", description: "فشل في بناء رابط الصوت.", variant: "destructive"});
        // Clear potentially invalid src
         if (currentAudioRef.currentSrc && currentAudioRef.currentSrc !== window.location.href) {
             if (!currentAudioRef.paused) currentAudioRef.pause();
             currentAudioRef.removeAttribute('src');
             try { currentAudioRef.load(); } catch(e) { console.warn("Load error on invalid audio URL:", e); }
             setIsPlaying(false);
             setIsAudioLoading(false);
             setPlayIntent(false);
         }
        return false;
      }

      const currentSrc = currentAudioRef.currentSrc;
      const isSrcEffectivelySet = currentSrc && currentSrc !== window.location.href;
      // Needs update if forced, src not set, or URL mismatch
      const needsUpdate = forceLoad || !isSrcEffectivelySet || currentSrc !== audioUrl;

       if (needsUpdate) {
            console.log(`Setting new audio source: ${audioUrl} (forceLoad: ${forceLoad}, isSrcSet: ${!!isSrcEffectivelySet}, urlMismatch: ${currentSrc !== audioUrl})`);

            // Pause if playing before changing source
            if (!currentAudioRef.paused) {
                console.log("Pausing before changing source.");
                currentAudioRef.pause(); // Pause event listener handles state update
            }

            // Reset relevant state *before* setting new src
            setIsPlaying(false);
            // Set loading true *only if play is intended* or forcing load.
            // loadstart will also set it if play is intended.
            if (playIntent || forceLoad) {
                 console.log(`prepareAudioSource: Setting loading true (playIntent: ${playIntent}, forceLoad: ${forceLoad})`);
                 setIsAudioLoading(true);
            } else {
                 setIsAudioLoading(false); // Reset if not intending to play immediately
            }


            // --- Set src and call load() ---
            currentAudioRef.src = audioUrl;
            console.log("Calling audio.load()...");
            currentAudioRef.load(); // THIS is crucial - triggers loading process
            console.log("Audio load initiated.");
            return true; // Indicates source was set/load initiated
        } else {
            console.log("Audio source is already correct. No preparation needed.");
            // Ensure loading state is false if source is correct and ready
             if (isAudioLoading && currentAudioRef.readyState >= 2) { // HAVE_METADATA or more
                console.log("Source correct, ensuring loading is false as readyState indicates data available.");
                setIsAudioLoading(false);
            }
            return true; // Indicates source is ready/correct
        }
    } catch (error) {
      console.error("Error preparing audio source:", error);
      toast({ title: "خطأ في إعداد الصوت", description: (error as Error).message, variant: "destructive"});
      setIsPlaying(false);
      setIsAudioLoading(false);
      setPlayIntent(false);
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReciterId, selectedMoshaf, selectedAudioSurah, toast, playIntent]); // Added playIntent dependency


  // Effect to prepare the source when selections (Moshaf or Surah) change OR playIntent becomes true for autoplay
  useEffect(() => {
     // Only prepare source if selections are valid
    if (selectedMoshaf && selectedAudioSurah) {
       // Force load if the selections changed OR if playIntent is true (for autoplay)
       const shouldForceLoad = true; // Always force load on selection change or autoplay intent
       console.log(`Selection/Moshaf/Intent changed, preparing audio source (force load: ${shouldForceLoad})...`);
       prepareAudioSource(shouldForceLoad);
    } else {
       console.log("Moshaf or Surah not selected, skipping source prep.");
       // Clear source if selections become invalid
       if (audioRef.current?.currentSrc && audioRef.current.currentSrc !== window.location.href) {
         console.log("Clearing audio source because Moshaf or Surah is undefined.");
         if (!audioRef.current.paused) audioRef.current.pause();
         audioRef.current.removeAttribute('src');
         try { audioRef.current.load(); } catch (e) { console.warn("Load error on undefined selection:", e); }
         setIsPlaying(false);
         setIsAudioLoading(false);
         setPlayIntent(false);
       }
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMoshaf, selectedAudioSurah, playIntent]); // Trigger also when playIntent changes for autoplay


  // Update audio volume effect
  useEffect(() => {
    if (audioRef.current) {
      const newVolume = isMuted ? 0 : volume / 100;
      audioRef.current.volume = newVolume;
    }
  }, [volume, isMuted]);


 // --- Play/Pause Handler ---
const handlePlayPause = () => {
    const currentAudioRef = audioRef.current;
    if (!currentAudioRef) {
      console.error("Play/Pause clicked but audioRef is null.");
      return;
    }

    const readyState = currentAudioRef.readyState;
    const currentSrc = currentAudioRef.currentSrc;
    console.log(`Play/Pause clicked. Current state: isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}, src=${currentSrc || 'null'}, readyState=${readyState}, playIntent=${playIntent}`);

    if (isPlaying) {
      // --- Pause Action ---
      console.log("Pausing audio...");
      setPlayIntent(false); // Explicit pause cancels any pending play intent
      currentAudioRef.pause(); // The 'pause' event listener handles setIsPlaying(false)
    } else {
      // --- Play Action ---
      console.log("Attempting to play audio...");
      setPlayIntent(true); // Signal intention to play *before* preparing source

      // 1. Ensure selections are made
      if (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah) {
        toast({ title: "تنبيه", description: "الرجاء اختيار القارئ والمصحف والسورة أولاً.", variant: "default"});
        console.warn("Play aborted: Missing selections.");
        setPlayIntent(false); // Reset intent if selections missing
        return;
      }

      // 2. Ensure the source is correct and initiate loading if needed
      // Force loading the source when play is clicked to ensure it's fresh
      const sourceReadyOrPreparing = prepareAudioSource(true); // FORCE LOAD on play click

      if (sourceReadyOrPreparing) {
          console.log("Source ready or preparing after play click.");

          // 3. Attempt Play (relying on 'canplay' event or immediate play)
          // If the audio can already play (readyState >= 3), try playing immediately.
          // Otherwise, the 'canplay' event listener (triggered by load()) will handle the play attempt.
          if (readyState >= 3 && currentAudioRef.paused) { // HAVE_FUTURE_DATA or more
              console.log(`Ready state is ${readyState}, attempting immediate play...`);
              currentAudioRef.play().catch(err => {
                  console.error("Immediate play attempt failed (will rely on canplay):", err);
                  // Let the 'error' event handler manage state and toast
              });
          } else if (readyState < 2 ) { // HAVE_NOTHING or HAVE_METADATA
              console.log(`Ready state is ${readyState}, waiting for 'canplay' event. Setting loading state.`);
              // Show loading indicator immediately if not already loading
               if (!isAudioLoading) {
                   setIsAudioLoading(true);
               }
          } else { // HAVE_CURRENT_DATA or more, but might not be enough to play yet, or already playing
               console.log(`Ready state is ${readyState}. Play intent set. Relying on 'canplay' or already playing.`);
               // If paused but enough data, try play, otherwise let canplay handle it
                if (currentAudioRef.paused && readyState >= 2) {
                     currentAudioRef.play().catch(err => {
                        console.error("Play attempt failed (readyState >= 2, paused):", err);
                     });
                } else if (!isPlaying && readyState >= 3) { // If not playing but ready, sync state
                    setIsPlaying(true);
                }
               if (isAudioLoading && readyState >= 3) setIsAudioLoading(false); // Hide loader if enough data
          }
      } else {
        console.error("Play clicked, but source preparation failed.");
        // toast likely shown by prepareAudioSource
        setIsPlaying(false);
        setIsAudioLoading(false);
        setPlayIntent(false); // Reset intent
      }
    }
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
    if (!newMutedState && volume === 0) setVolume(10); // Unmute to a minimum volume
  };

  // Determine if the play button should be disabled
  const isPlayDisabled = (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah || isLoadingReciters);
  const selectedReciterName = recitersData?.reciters.find(r => r.id.toString() === selectedReciterId)?.name;


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        {isMobile && <SidebarTrigger icon={Menu} />}
        {/* Removed the "قارئ الكتاب" text */}
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
             <Select value={selectedReciterId} onValueChange={(value) => {
               console.log("Selected Reciter changed:", value);
               // Stop playback and reset intent when user changes reciter
               if (audioRef.current && !audioRef.current.paused) {
                   audioRef.current.pause();
               }
               setPlayIntent(false);
               setIsPlaying(false); // Visually stop
               setIsAudioLoading(false); // Reset loading
               setSelectedReciterId(value);
               // Moshaf selection and source prep are handled by useEffect
             }} dir="rtl">
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

          <Select value={selectedAudioSurah} onValueChange={(value) => {
            console.log("Selected Audio Surah changed:", value);
            // Stop playback and reset intent when user changes surah
            if (audioRef.current && !audioRef.current.paused) {
                audioRef.current.pause();
            }
            setPlayIntent(false);
            setIsPlaying(false); // Visually stop
            setIsAudioLoading(false); // Reset loading
            setSelectedAudioSurah(value);
            // Source preparation is handled by the useEffect watching selectedAudioSurah/playIntent
          }} dir="rtl">
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

