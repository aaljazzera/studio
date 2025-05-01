
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
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [playIntent, setPlayIntent] = useState(false); // Track explicit user play requests OR autoplay intent
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMobile } = useSidebar();
  const { toast } = useToast();

  // Fetch reciters
  const { data: recitersData, isLoading: isLoadingReciters, error: recitersError } = useQuery({
    queryKey: ['reciters'],
    queryFn: () => fetchReciters('ar'),
    staleTime: Infinity,
    gcTime: Infinity,
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
        setIsAutoplaying(true); // Flag to trigger useEffect for autoplay
      } else {
        console.log("Autoplay: Reached last surah or current ID invalid.");
        setIsAutoplaying(false);
      }
    } else {
      console.log("Autoplay: No current surah selected.");
      setIsAutoplaying(false);
    }
  }, [selectedAudioSurah]); // Add dependency

  // Initialize audio element and listeners
  useEffect(() => {
    console.log("Initializing audio element...");
    const audioElement = new Audio();
    audioElement.preload = 'auto'; // Ensure browser tries to load metadata/data
    audioRef.current = audioElement;

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
            errorMessage = `مصدر الصوت غير مدعوم من قبل المتصفح أو لا يمكن العثور عليه.`;
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
         // Handle cases where the error object might be null but networkState gives a clue
         console.error("Audio error occurred but MediaError object is null. Source:", target.src, "ReadyState:", target.readyState, "NetworkState:", target.networkState);
         if (!target.src || target.src === window.location.href) {
            errorMessage = "لم يتم تعيين مصدر صوت صالح.";
         } else if (target.networkState === HTMLMediaElement.NETWORK_EMPTY) {
             // This usually means the resource was found but couldn't be loaded (e.g., 404, 403)
             errorMessage = `فشل تحميل ملف الصوت من الخادم.`;
             console.error(`Audio Error: NETWORK_EMPTY for src: ${target.src}`);
         } else if (target.networkState === HTMLMediaElement.NETWORK_IDLE && target.readyState === HTMLMediaElement.HAVE_NOTHING) {
             // Idle but nothing loaded - likely indicates network issue or invalid URL before loading started
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
      setIsAutoplaying(false);
      setPlayIntent(false); // Reset play intent on error
    };


    // Can Play Handler
    const handleCanPlay = () => {
      const currentAudioRef = audioRef.current;
       if (!currentAudioRef) return;
      console.log("Audio canplay event. ReadyState:", currentAudioRef.readyState);
      // If we were loading (due to src change or buffering), mark as not loading now.
      if (isAudioLoading) {
        console.log("Canplay: Audio ready, setting isAudioLoading false.");
        setIsAudioLoading(false);
      }
      // Only play if user explicitly clicked play OR autoplay is active AND it's currently paused
      if (playIntent && currentAudioRef.paused) {
        console.log("Canplay: Play intent detected and audio is paused, attempting play...");
        currentAudioRef.play().then(() => {
            console.log("Canplay: Playback started successfully.");
             // Ensure state consistency
             setIsPlaying(true);
             setIsAudioLoading(false); // Should be false if playing
        }).catch(err => {
          console.error("Play failed during canplay:", err);
           // Error handler (handleAudioError) will be triggered by the failed play promise
           setIsPlaying(false);
           setIsAudioLoading(false);
           setPlayIntent(false); // Reset intent on failure
           toast({ title: "خطأ في التشغيل", description: `فشل بدء تشغيل الصوت. ${err.message}`, variant: "destructive"});
        });
      } else if (playIntent && !currentAudioRef.paused) {
          console.log("Canplay: Play intent detected, but audio is already playing.");
          // Ensure state reflects reality
          setIsPlaying(true);
          setIsAudioLoading(false);
      } else {
          console.log(`Canplay: No play intent (${playIntent}) or already playing (${!currentAudioRef.paused}), doing nothing.`);
      }
    };


    // Waiting Handler (Buffering)
    const handleWaiting = () => {
        const currentAudioRef = audioRef.current;
        if (!currentAudioRef) return;
        console.log("Audio waiting event (buffering)... ReadyState:", currentAudioRef.readyState);
        // Show loader only if play was intended
        if (playIntent && !isAudioLoading) {
            console.log("Waiting: Buffering started, setting isAudioLoading true.");
            setIsAudioLoading(true);
        }
    };

    // Playing Handler
    const handlePlaying = () => {
      console.log("Audio playing event.");
      setIsAudioLoading(false); // Should be false if playing starts
      setIsPlaying(true);
      // No need to touch playIntent here, it signifies the initial request
    };

    // Pause Handler
    const handlePause = () => {
       const currentAudioRef = audioRef.current;
       if (!currentAudioRef) return;
      // Only log pause events that happen when we weren't expecting them (e.g., not during loading)
      if (!isAudioLoading) {
          console.log("Audio pause event. ReadyState:", currentAudioRef.readyState);
          console.log("Pause: Setting isPlaying false.");
          setIsPlaying(false);
          // If user explicitly paused, cancel any pending play intent or autoplay
          if (playIntent) {
               console.log("Pause: Resetting play intent due to explicit pause.");
               setPlayIntent(false);
          }
           if (isAutoplaying) {
                console.log("Pause: Autoplay stopped due to pause event.");
                setIsAutoplaying(false);
           }
      } else {
           console.log("Pause event occurred during buffering/loading, ignoring state change for now.");
      }
    };

    // Load Start Handler
    const handleLoadStart = () => {
        console.log("Audio loadstart event.");
        // Set loading true immediately when load starts, IF play was intended.
        // Relies on 'canplay' or 'error' to clear it.
        if (playIntent && !isAudioLoading) {
            console.log("Loadstart: Play intended, setting isAudioLoading true.");
            setIsAudioLoading(true);
        } else if (!playIntent && isAudioLoading) {
            // If somehow loading is true but play wasn't intended (e.g., changing src while paused)
            console.log("Loadstart: Play not intended, resetting isAudioLoading.");
            setIsAudioLoading(false);
        } else {
             console.log(`Loadstart: Detected, but not changing loading state (playIntent: ${playIntent}, isAudioLoading: ${isAudioLoading}).`);
        }
    };


    // Attach Listeners
    audioElement.addEventListener('ended', handleAudioEnd);
    audioElement.addEventListener('error', handleAudioError);
    audioElement.addEventListener('canplay', handleCanPlay);
    audioElement.addEventListener('waiting', handleWaiting);
    audioElement.addEventListener('playing', handlePlaying);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('loadstart', handleLoadStart);


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
           // Stop playback and clear resources
           try {
             if (!currentAudioElement.paused) {
                 currentAudioElement.pause();
             }
             currentAudioElement.removeAttribute('src'); // Detach source
             currentAudioElement.load(); // Abort network requests and reset state
             console.log("Audio element resources released.");
           } catch(e) { console.warn("Error during audio cleanup:", e); }
           audioRef.current = null;
       }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, handleAudioEnd]); // Added handleAudioEnd dependency



  // Effect to select the appropriate Moshaf
  useEffect(() => {
    console.log(`Reciter/Data Check: ID=${selectedReciterId}, Data loaded=${!!recitersData}, Loading=${isLoadingReciters}`);
    if (selectedReciterId && recitersData?.reciters) {
      const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
      console.log("Found reciter:", reciter?.name);
      const moshafs = reciter?.moshaf ?? [];
      console.log("Available Moshafs:", moshafs.map(m => ({id: m.id, name: m.name, server: m.server})));

      if (moshafs.length > 0) {
        // Prefer 'مرتل' if available
        const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
        const moshafToSelect = murattalMoshaf || moshafs[0]; // Fallback to the first one
        const oldMoshafId = selectedMoshaf?.id;
        const oldServer = selectedMoshaf?.server;
        console.log("Auto-selecting Moshaf:", {id: moshafToSelect.id, name: moshafToSelect.name, server: moshafToSelect.server});

        if (oldMoshafId !== moshafToSelect.id || oldServer !== moshafToSelect.server) {
          console.log("Setting selected Moshaf state and resetting audio.");
          setSelectedMoshaf(moshafToSelect);
           // Reset audio state completely when moshaf changes
            setPlayIntent(false);
            setIsAutoplaying(false);
            setIsPlaying(false);
            setIsAudioLoading(false);
            if (audioRef.current) {
                console.log("Clearing audio source/state due to reciter/moshaf change.");
                 if (!audioRef.current.paused) {
                     audioRef.current.pause();
                 }
                 audioRef.current.removeAttribute('src'); // Detach source
                 try { audioRef.current.load(); } catch(e) { console.warn("Load error on moshaf change:", e); } // Reset internal state
            }
        } else {
          console.log("Selected Moshaf is already the correct one.");
        }
      } else {
        console.log("No Moshafs available for this reciter. Resetting selection.");
        if (selectedMoshaf) {
          setSelectedMoshaf(undefined);
           setPlayIntent(false);
           setIsAutoplaying(false);
           setIsPlaying(false);
           setIsAudioLoading(false);
          if (audioRef.current) {
            console.log("Clearing audio source/state because no moshafs available.");
            if (!audioRef.current.paused) audioRef.current.pause();
             audioRef.current.removeAttribute('src');
             try { audioRef.current.load(); } catch(e) { console.warn("Load error on no moshaf:", e); }
          }
        }
        if(!isLoadingReciters) {
          toast({ title: "تنبيه", description: "لا توجد مصاحف متاحة لهذا القارئ.", variant: "default"});
        }
      }
    } else if (!isLoadingReciters && selectedReciterId && !recitersData?.reciters?.length) {
      console.error("Reciter selected, but reciters data is unavailable.");
      toast({ title: "خطأ", description: "فشل في تحميل بيانات القراء.", variant: "destructive"});
      setSelectedMoshaf(undefined);
       setPlayIntent(false);
       setIsAutoplaying(false);
       setIsPlaying(false);
       setIsAudioLoading(false);
      if (audioRef.current) {
         console.log("Clearing audio source/state due to reciter data failure.");
         if (!audioRef.current.paused) audioRef.current.pause();
         audioRef.current.removeAttribute('src');
         try { audioRef.current.load(); } catch(e) { console.warn("Load error on reciter data fail:", e); }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReciterId, recitersData, toast, isLoadingReciters]);



  // Prepare audio source function (DOES NOT PLAY)
  const prepareAudioSource = React.useCallback((forceLoad: boolean = false): boolean => {
    console.log(`Attempting to prepare audio source (forceLoad: ${forceLoad})...`);
    const currentAudioRef = audioRef.current;
    console.log(`Current state: reciterId=${selectedReciterId}, moshafId=${selectedMoshaf?.id}, surah=${selectedAudioSurah}, currentSrc='${currentAudioRef?.currentSrc}', isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}, playIntent=${playIntent}, readyState=${currentAudioRef?.readyState}`);

    if (!currentAudioRef) {
      console.error("prepareAudioSource: audioRef is null.");
      return false;
    }

    if (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah) {
      console.warn("prepareAudioSource: Cannot prepare: Missing selections.");
       // Clear source if selections become invalid and it wasn't already cleared
       if (currentAudioRef.currentSrc && currentAudioRef.currentSrc !== window.location.href) {
            console.log("Clearing potentially invalid audio source due to missing selections.");
            if (!currentAudioRef.paused) currentAudioRef.pause();
            currentAudioRef.removeAttribute('src');
            try { currentAudioRef.load(); } catch(e) { console.warn("Load error on missing selections:", e); }
            setIsPlaying(false);
            setIsAudioLoading(false);
            setPlayIntent(false);
            setIsAutoplaying(false);
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
               setIsAutoplaying(false);
           }
          return false;
      }

    try {
      const audioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
      console.log(`Generated audio URL: ${audioUrl}`);

      if (!audioUrl) {
        console.error("prepareAudioSource: Generated audio URL is invalid.");
        toast({ title: "خطأ", description: "فشل في بناء رابط الصوت.", variant: "destructive"});
         if (currentAudioRef.currentSrc && currentAudioRef.currentSrc !== window.location.href) {
             if (!currentAudioRef.paused) currentAudioRef.pause();
             currentAudioRef.removeAttribute('src');
             try { currentAudioRef.load(); } catch(e) { console.warn("Load error on invalid audio URL:", e); }
             setIsPlaying(false);
             setIsAudioLoading(false);
             setPlayIntent(false);
             setIsAutoplaying(false);
         }
        return false;
      }

      const currentSrc = currentAudioRef.currentSrc; // Use currentSrc for loaded source
      const isSrcEffectivelySet = currentSrc && currentSrc !== window.location.href;
      const needsUpdate = forceLoad || !isSrcEffectivelySet || currentSrc !== audioUrl;

       if (needsUpdate) {
            console.log(`Setting new audio source: ${audioUrl} (forceLoad: ${forceLoad}, isSrcSet: ${!!isSrcEffectivelySet}, urlMismatch: ${currentSrc !== audioUrl})`);
            if (!currentAudioRef.paused) {
                console.log("Pausing before changing source.");
                // Pause triggers state changes via its event listener
                currentAudioRef.pause();
            }
            // Reset state related to the OLD source BEFORE setting new src
            setIsPlaying(false); // Visually stop playback
            // Do NOT set loading true yet. 'loadstart' will handle it if play is intended.
            //setIsAudioLoading(true);
            // Do NOT reset playIntent here, it might be needed if a play follows immediately

            // --- Critical change: Set src and call load() ---
            currentAudioRef.src = audioUrl;
            console.log("Calling audio.load() to fetch new source...");
            // Explicitly call load() after setting src to initiate loading
            currentAudioRef.load();
            console.log("Audio load initiated.");
            return true;
        } else {
            console.log("Audio source is already correct. No source update needed.");
            // Ensure loading state is correct if source is already set but wasn't playing/loading
            if (isAudioLoading && currentAudioRef.readyState >= 2) { // HAVE_METADATA or more
                console.log("Source correct, ensuring loading is false as readyState indicates some data available.");
                setIsAudioLoading(false);
            }
            return true;
        }
    } catch (error) {
      console.error("Error preparing audio source:", error);
      toast({ title: "خطأ في إعداد الصوت", description: (error as Error).message, variant: "destructive"});
      setIsPlaying(false);
      setIsAudioLoading(false);
      setPlayIntent(false);
      setIsAutoplaying(false);
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReciterId, selectedMoshaf, selectedAudioSurah, toast]); // Removed isPlaying, isAudioLoading, playIntent


  // Effect to prepare the source when selections change
  useEffect(() => {
    if (selectedMoshaf && selectedAudioSurah) {
      console.log("Selection/Moshaf changed, preparing audio source (force load if src empty)...");
      // Force load is generally needed when selections change unless the URL happens to be identical
      const shouldForceLoad = !audioRef.current?.currentSrc || audioRef.current.currentSrc === window.location.href;
      prepareAudioSource(true); // Force load to ensure the new selection is loaded
    } else {
      console.log("Moshaf or Surah not selected, skipping source prep.");
       // Clear source if selections become undefined
       if (audioRef.current?.currentSrc && audioRef.current.currentSrc !== window.location.href) {
            console.log("Clearing audio source because Moshaf or Surah is undefined.");
            if (!audioRef.current.paused) audioRef.current.pause();
            audioRef.current.removeAttribute('src');
            try { audioRef.current.load(); } catch(e) { console.warn("Load error on undefined selection:", e); }
            setIsPlaying(false);
            setIsAudioLoading(false);
            setPlayIntent(false); // Reset intent
            setIsAutoplaying(false); // Stop autoplay
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMoshaf, selectedAudioSurah]); // Trigger when Moshaf or Surah changes



  // Effect to handle autoplay logic
  useEffect(() => {
    if (isAutoplaying && audioRef.current && selectedMoshaf && selectedAudioSurah) {
      console.log(`Autoplay: Triggered for Surah ${selectedAudioSurah}`);
      // Force load is necessary for the next track
      const sourcePrepared = prepareAudioSource(true);
      if (sourcePrepared) {
        console.log("Autoplay: Source prepared/preparing. Setting play intent for 'canplay'.");
        setPlayIntent(true); // Set intent to play when ready
        // Play attempt moved to 'canplay' handler, triggered by load() in prepareAudioSource
      } else {
        console.error("Autoplay: Failed to prepare source.");
        setIsAudioLoading(false);
        setIsAutoplaying(false);
        setPlayIntent(false);
        toast({ title: "خطأ في التشغيل التلقائي", description: "فشل في تحضير السورة التالية.", variant: "destructive"});
      }
    } else if (isAutoplaying) {
      console.log("Autoplay: Triggered but conditions not met (missing refs/selections). Aborting.");
      setIsAutoplaying(false); // Turn off flag
      setPlayIntent(false); // Reset intent
    }
  }, [isAutoplaying, selectedMoshaf, selectedAudioSurah, prepareAudioSource, toast]); // Dependencies


  // Update audio volume effect
  useEffect(() => {
    if (audioRef.current) {
      const newVolume = isMuted ? 0 : volume / 100;
      audioRef.current.volume = newVolume;
    }
  }, [volume, isMuted]);


 // Play/Pause Handler
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
      console.log("Pausing audio...");
      setPlayIntent(false); // Cancel any pending play intent if user pauses
      setIsAutoplaying(false); // Explicit pause stops autoplay
      currentAudioRef.pause(); // Pause event listener handles state changes (sets isPlaying=false)
    } else {
      console.log("Attempting to play audio...");
      // Ensure selections are made
      if (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah) {
        toast({ title: "تنبيه", description: "الرجاء اختيار القارئ والسورة أولاً.", variant: "default"});
        return;
      }

       // Determine if source needs loading/reloading
      const targetAudioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
      const sourceIsCorrect = currentSrc && currentSrc !== window.location.href && currentSrc === targetAudioUrl;
      const needsSourcePrep = !sourceIsCorrect;

      console.log(`Play action: Source is correct: ${sourceIsCorrect}, Needs prep: ${needsSourcePrep}, Target URL: ${targetAudioUrl}`);

      // Ensure source is prepared (loads if necessary)
      const sourceReadyOrPreparing = prepareAudioSource(needsSourcePrep); // Force load if needed

      if (sourceReadyOrPreparing) {
        console.log("Source ready or preparing. Setting play intent.");
        setPlayIntent(true); // Signal intention to play

        // --- Critical change: Rely on 'canplay' event ---
        // Instead of trying to play immediately (which might fail if not ready),
        // we set the playIntent and let the 'canplay' event handler trigger the actual play().
        // If the audio is *already* playable (readyState >= 3 HAVE_FUTURE_DATA), we can *try* playing,
        // but the canplay handler is the more robust approach.

        if (readyState >= 3 && currentAudioRef.paused) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
             console.log(`Ready state is ${readyState}, attempting immediate play (might still buffer)...`);
             currentAudioRef.play().catch(err => {
                console.error("Immediate play attempt failed (will retry on canplay):", err);
                // If play fails here, the 'canplay' handler might still succeed later.
                // Ensure loading is shown if it fails immediately.
                 if (!isAudioLoading) setIsAudioLoading(true);
             });
        } else {
           // If not ready enough, or already playing, just ensure loading state is set.
           // The 'canplay' event will handle the play attempt.
           console.log(`Ready state is ${readyState}, waiting for 'canplay' to trigger play. Setting loading state if needed.`);
           if (!isAudioLoading && readyState < 3) { // Only set loading if not already loading and not yet playable
               setIsAudioLoading(true);
           }
        }
      } else {
        console.error("Play clicked, but source preparation failed.");
        // toast likely shown by prepareAudioSource
        setIsPlaying(false);
        setIsAudioLoading(false);
        setPlayIntent(false);
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
  const isPlayDisabled = (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah);
  const selectedReciterName = recitersData?.reciters.find(r => r.id.toString() === selectedReciterId)?.name;


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        {isMobile && <SidebarTrigger icon={Menu} />}

        <div className="flex items-center gap-2 ml-auto md:ml-0">
          {isLoadingReciters ? (
            <Skeleton className="h-10 w-[180px]" />
          ) : recitersError ? (
            <div className="w-[180px] text-destructive text-xs px-2 py-1 border border-destructive rounded-md text-center font-cairo">
              {(recitersError as Error)?.message || 'خطأ في تحميل القراء'}
            </div>
          ) : (
            <Select value={selectedReciterId} onValueChange={(value) => {
              console.log("Selected Reciter changed:", value);
              setSelectedReciterId(value);
              // Resetting audio state is handled by the Moshaf selection effect
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
            setSelectedAudioSurah(value);
            // Reset state when surah changes manually
            setIsPlaying(false); // Stop visually
            setIsAudioLoading(false); // Reset loading
            setPlayIntent(false); // Cancel any pending intent
            setIsAutoplaying(false); // Stop autoplay if user changes surah
             if (audioRef.current && !audioRef.current.paused) {
                 audioRef.current.pause(); // Pause event handles actual stop
             }
             // Source preparation is handled by the useEffect watching selectedAudioSurah
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
      </div>

      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
               {/* Show loader if explicitly loading OR if play intended and not yet playing */}
              <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={isPlayDisabled} className="font-cairo">
                 {(isAudioLoading || (playIntent && !isPlaying)) ? <Loader2 className="animate-spin h-5 w-5" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                <span className="sr-only">{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-cairo">{isPlayDisabled ? 'يرجى تحديد القارئ والسورة' : (isAudioLoading ? 'جاري التحميل...' : (isPlaying ? 'إيقاف مؤقت' : 'تشغيل'))}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
