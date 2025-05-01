
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
  // Default to Ahmed Saud (ID 7) and Al-Fatiha (ID 1) - Changed default Reciter
  const [selectedReciterId, setSelectedReciterId] = useState<string>('7'); // Default to Ahmed Saud initially
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string>('1'); // Default Al-Fatiha
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
        // Set play intent for autoplay - This will trigger the useEffect below
        setPlayIntent(true);
      } else {
        console.log("Autoplay: Reached last surah or current ID invalid.");
      }
    } else {
      console.log("Autoplay: No current surah selected.");
    }
  }, [selectedAudioSurah]);

  // Initialize audio element and listeners
  useEffect(() => {
    console.log("Initializing audio element...");
    const audioElementInstance = new Audio();
    audioElementInstance.preload = 'metadata'; // Load only metadata initially
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
            errorMessage = `تعذر تحميل أو فك تشفير مصدر الصوت. قد يكون الرابط غير صالح أو أن التنسيق غير مدعوم (${target.src}).`;
            console.error(`Detailed SRC_NOT_SUPPORTED error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
            break;
          default:
            errorMessage = `حدث خطأ غير معروف في الصوت (الكود: ${error.code}).`;
             console.error(`Detailed UNKNOWN error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
        }
      } else if (target.networkState === HTMLMediaElement.NETWORK_NO_SOURCE && target.readyState === HTMLMediaElement.HAVE_NOTHING) {
          // This case often happens when the initial src attribute is invalid or load() hasn't been called properly.
          errorMessage = `تعذر العثور على مصدر الصوت أو أن التنسيق غير مدعوم. تحقق من الرابط: ${target.currentSrc}`;
          console.error(`Audio Error: NETWORK_NO_SOURCE for src: ${target.currentSrc}`);
      } else {
         console.error("Audio error occurred but MediaError object is null. Source:", target.src, "ReadyState:", target.readyState, "NetworkState:", target.networkState);
         if (!target.src || target.src === window.location.href) {
            errorMessage = "لم يتم تعيين مصدر صوت صالح.";
         } else if (target.networkState === HTMLMediaElement.NETWORK_IDLE && target.readyState === HTMLMediaElement.HAVE_NOTHING) {
             // Might occur if loading stopped prematurely
             errorMessage = `توقف تحميل الصوت. تحقق من اتصال الشبكة والرابط: ${target.currentSrc}`;
             console.error(`Audio Error: NETWORK_IDLE and HAVE_NOTHING for src: ${target.currentSrc}`);
         } else if (target.networkState === HTMLMediaElement.NETWORK_LOADING && target.readyState < 2) {
             // Loading but hit an error before metadata was available
             errorMessage = `حدث خطأ أثناء تحميل بيانات الصوت الأولية.`;
             console.error(`Audio Error: NETWORK_LOADING and readyState < 2 for src: ${target.currentSrc}`);
         } else {
            errorMessage = `حدث خطأ غير متوقع مع مصدر الصوت.`;
            console.error(`Audio Error: Unknown state - readyState=${target.readyState}, networkState=${target.networkState}, src=${target.currentSrc}`);
         }
      }

      // Avoid duplicate toasts for the same issue
      if (errorMessage !== (window as any).__lastAudioError) {
          toast({
            title: "خطأ في الصوت",
            description: errorMessage,
            variant: "destructive",
          });
          (window as any).__lastAudioError = errorMessage;
          // Clear the last error after a delay to allow re-reporting if it happens again
          setTimeout(() => { (window as any).__lastAudioError = null; }, 3000);
      }

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
        // Ignore waiting event if seeking or if play wasn't intended (e.g., just loading metadata)
        if (!currentAudioRef || currentAudioRef.seeking || !playIntent) return;
        console.log("Audio waiting event (buffering)... ReadyState:", currentAudioRef.readyState);
        if (!isAudioLoading) {
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
       // Ignore if seeking or if audio ended (ended event handles state)
       if (!currentAudioRef || currentAudioRef.seeking || currentAudioRef.ended) {
           console.log(`Pause event ignored (seeking: ${currentAudioRef?.seeking}, ended: ${currentAudioRef?.ended}).`);
           return;
       }
       console.log("Audio pause event. ReadyState:", currentAudioRef.readyState);
       if (isPlaying) {
         setIsPlaying(false);
         console.log("Pause: Setting isPlaying false.");
       }
       // Don't reset playIntent here unless it was a user-initiated pause (handled in handlePlayPause)
    };

    // Load Start Handler - Fired when the browser begins loading the media data *after src is set and load() is called*
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

     // Stalled handler - Fired when the browser is trying to fetch media data, but data is unexpectedly not forthcoming.
    const handleStalled = () => {
        const currentAudioRef = audioRef.current;
        if (!currentAudioRef) return;
        console.warn("Audio stalled event. Browser trying to fetch data, but not receiving it. Source:", currentAudioRef.currentSrc);
        // Optionally show a specific message or just let the 'waiting' handler manage the loader
        // You might want to trigger a check of network status here.
         if (playIntent && !isAudioLoading) {
            // Show loader if play was intended but we stalled before getting enough data
            setIsAudioLoading(true);
        }
    };

    // Attach Listeners
    audioElementInstance.addEventListener('ended', handleAudioEnd);
    audioElementInstance.addEventListener('error', handleAudioError);
    audioElementInstance.addEventListener('canplay', handleCanPlay); // Enough data to start
    audioElementInstance.addEventListener('waiting', handleWaiting);
    audioElementInstance.addEventListener('playing', handlePlaying);
    audioElementInstance.addEventListener('pause', handlePause);
    audioElementInstance.addEventListener('loadstart', handleLoadStart);
    audioElementInstance.addEventListener('stalled', handleStalled); // Add stalled listener

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
           currentAudioElement.removeEventListener('stalled', handleStalled); // Remove stalled listener
           try {
             if (!currentAudioElement.paused) currentAudioElement.pause();
             currentAudioElement.removeAttribute('src'); // Remove src to stop potential network activity
             currentAudioElement.load(); // Reset internal state and potentially abort network requests
             console.log("Audio element resources released.");
           } catch(e) { console.warn("Error during audio cleanup:", e); }
           audioRef.current = null;
       }
    };
  }, [toast, handleAudioEnd, isPlaying, isAudioLoading, playIntent]); // Added dependencies that affect listener logic


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

        console.log("Auto-selecting Moshaf:", {id: moshafToSelect.id, name: moshafToSelect.name, server: moshafToSelect.server});

        if (previousMoshafId !== moshafToSelect.id) {
            console.log("Setting selected Moshaf state.");
            setSelectedMoshaf(moshafToSelect);
            // Reset audio state *before* preparing the new source in the next effect
            if (audioRef.current) {
                console.log("Clearing audio source/state due to reciter/moshaf change.");
                if (!audioRef.current.paused) audioRef.current.pause(); // Pause handled by listener
                audioRef.current.removeAttribute('src');
                 try { audioRef.current.load(); } catch(e) { console.warn("Load error on moshaf change:", e); } // Abort loading
            }
            setIsPlaying(false);
            setIsAudioLoading(false);
            setPlayIntent(false); // Cancel previous intent
        } else {
            console.log("Selected Moshaf is already the correct one.");
        }
      } else {
        console.log("No Moshafs available for this reciter. Resetting selection.");
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
      // toast({ title: "خطأ", description: "فشل في تحميل بيانات القراء.", variant: "destructive"}); // Consider if needed
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReciterId, recitersData, isLoadingReciters, toast]);


  // Prepare audio source function (sets src and calls load)
  const prepareAudioSource = React.useCallback((forceLoad: boolean = false): boolean => {
    const currentAudioRef = audioRef.current;
    console.log(`Attempting to prepare audio source (forceLoad: ${forceLoad})...`);
    console.log(`Current state: reciterId=${selectedReciterId}, moshafId=${selectedMoshaf?.id}, surah=${selectedAudioSurah}, currentSrc='${currentAudioRef?.currentSrc}', isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}, playIntent=${playIntent}, readyState=${currentAudioRef?.readyState}`);

    if (!currentAudioRef) {
      console.error("prepareAudioSource: audioRef is null.");
      return false;
    }

    if (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah) {
      console.warn("prepareAudioSource: Cannot prepare - Missing selections (Reciter, Moshaf, or Surah).");
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
      const needsUpdate = forceLoad || !isSrcEffectivelySet || currentSrc !== audioUrl;

       if (needsUpdate) {
            console.log(`Setting new audio source: ${audioUrl} (forceLoad: ${forceLoad}, isSrcSet: ${!!isSrcEffectivelySet}, urlMismatch: ${currentSrc !== audioUrl})`);

            // Pause if playing before changing source - rely on pause listener
            if (!currentAudioRef.paused) {
                console.log("Pausing before changing source.");
                currentAudioRef.pause();
            }

            // Explicitly reset relevant state *before* setting new src
            setIsPlaying(false);
            // Only set loading if we intend to play *or* are forcing a load (like on first load/selection change)
            if (playIntent || forceLoad) {
                 console.log(`prepareAudioSource: Setting loading true (playIntent: ${playIntent}, forceLoad: ${forceLoad})`);
                 setIsAudioLoading(true);
            } else {
                 // If just preparing metadata without intent to play, don't show loader yet
                 setIsAudioLoading(false);
                 console.log(`prepareAudioSource: Not setting loading (playIntent: ${playIntent}, forceLoad: ${forceLoad})`);
            }


            // --- Set src and call load() ---
            currentAudioRef.src = audioUrl;
            console.log("Calling audio.load()...");
            currentAudioRef.load(); // THIS triggers loading process ('loadstart' event)
            console.log("Audio load initiated.");
            return true; // Indicates source was set/load initiated
        } else {
            console.log("Audio source is already correct. No preparation needed.");
            // Ensure loading state is false if source is correct and ready enough (HAVE_METADATA or more)
            if (isAudioLoading && currentAudioRef.readyState >= 2) {
                console.log("Source correct, ensuring loading is false as readyState >= HAVE_METADATA.");
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
  }, [selectedReciterId, selectedMoshaf, selectedAudioSurah, toast, playIntent, isPlaying, isAudioLoading]); // Added isPlaying, isAudioLoading


 // Effect to prepare the source when selections (Moshaf or Surah) change OR playIntent becomes true for autoplay
 useEffect(() => {
    if (selectedMoshaf && selectedAudioSurah) {
       // Always force load when moshaf or surah changes, or when autoplay intent is set
       const shouldForceLoad = true;
       console.log(`Selection/Moshaf/Intent changed, preparing audio source (force load: ${shouldForceLoad})...`);
       prepareAudioSource(shouldForceLoad);
    } else {
       console.log("Moshaf or Surah not selected, skipping source prep.");
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
 }, [selectedMoshaf, selectedAudioSurah, playIntent, prepareAudioSource]); // Added prepareAudioSource dependency


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
      setPlayIntent(false); // Explicit user pause cancels any pending play intent
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
      // Force load source check on play click to be sure.
      const sourceReadyOrPreparing = prepareAudioSource(true);

      if (sourceReadyOrPreparing) {
          console.log("Source ready or preparing after play click. Play intent set.");

          // 3. Attempt Play (relying on 'canplay' event or immediate play if possible)
          // If the audio has enough data (HAVE_ENOUGH_DATA), try playing immediately.
          if (readyState >= 4 && currentAudioRef.paused) { // HAVE_ENOUGH_DATA
              console.log(`Ready state is ${readyState}, attempting immediate play...`);
              currentAudioRef.play().catch(err => {
                  console.error("Immediate play attempt failed (will rely on 'canplay' or 'playing' events):", err);
                  // Let the 'error' event handler manage state and toast if it fails
              });
          }
          // If readyState is less than HAVE_ENOUGH_DATA, we *must* wait for 'canplay' or 'playing'
          else if (readyState < 3) { // HAVE_NOTHING, HAVE_METADATA, HAVE_CURRENT_DATA
               console.log(`Ready state is ${readyState}, waiting for 'canplay'/'playing'. Setting loading state.`);
               if (!isAudioLoading) {
                   setIsAudioLoading(true); // Show loader if not already loading
               }
          } else { // HAVE_FUTURE_DATA or more, but might still be buffering or paused
               console.log(`Ready state is ${readyState}. Play intent set. Relying on events or already playing.`);
               // If paused but should be playing (playIntent is true), try playing again.
               // This can happen if buffering paused it temporarily.
               if (currentAudioRef.paused && playIntent) {
                    console.log("Audio paused but play intended, attempting play again...");
                    currentAudioRef.play().catch(err => {
                        console.error("Retry play attempt failed:", err);
                     });
               } else if (currentAudioRef.paused && !playIntent) {
                   console.log("Audio paused, play not intended currently.")
               }
               // Ensure loading indicator is shown if buffering is likely
               if (!isPlaying && !isAudioLoading && readyState < 4) {
                   setIsAudioLoading(true);
               }
          }
      } else {
        console.error("Play clicked, but source preparation failed.");
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
               // Pause playback and reset intent when user changes reciter
               if (audioRef.current && !audioRef.current.paused) {
                   audioRef.current.pause(); // Pause event listener handles state
               }
               setPlayIntent(false); // Cancel any pending play
               // No need to manually set isPlaying/isAudioLoading false, listeners handle this
               setSelectedReciterId(value); // This triggers useEffect for moshaf selection
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
            // Pause playback and reset intent when user changes surah
            if (audioRef.current && !audioRef.current.paused) {
                audioRef.current.pause();
            }
            setPlayIntent(false);
            setSelectedAudioSurah(value); // This triggers useEffect for source preparation
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
 