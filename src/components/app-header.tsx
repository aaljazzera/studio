
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
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { quranSurahs } from '@/data/quran-surahs';
import { fetchReciters, getAudioUrl } from '@/services/mp3quran'; // Import service functions
import type { Reciter, Moshaf } from '@/types/mp3quran'; // Import types
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton


export function AppHeader() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false); // Track audio loading state
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  // Default to Reciter ID 7 (Ahmad Saud) and Al-Fatiha (ID 1)
  const [selectedReciterId, setSelectedReciterId] = useState<string>('7');
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string>('1');
  const [selectedMoshaf, setSelectedMoshaf] = useState<Moshaf | undefined>(undefined); // Store the selected moshaf object
  const [isAutoplaying, setIsAutoplaying] = useState(false); // State to manage autoplay
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playIntentRef = useRef<boolean>(false); // Ref to track explicit play intention
  const { isMobile } = useSidebar();
  const { toast } = useToast(); // Initialize toast

  // Fetch reciters using react-query
  const { data: recitersData, isLoading: isLoadingReciters, error: recitersError } = useQuery({
    queryKey: ['reciters'],
    queryFn: () => fetchReciters('ar'),
    staleTime: Infinity, // Data is fairly static, cache indefinitely
    gcTime: Infinity,
    retry: 1, // Retry once on failure
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

   // Function to handle audio end event
  const handleAudioEnd = () => {
    console.log("Audio ended.");
    setIsPlaying(false);
    setIsAudioLoading(false); // Ensure loading is off
    playIntentRef.current = false; // Reset play intent

    // Autoplay next surah logic
    if (selectedAudioSurah) {
      const currentSurahId = parseInt(selectedAudioSurah, 10);
      if (!isNaN(currentSurahId) && currentSurahId < 114) {
        const nextSurahId = currentSurahId + 1;
        console.log(`Autoplay: Setting next surah to ${nextSurahId}`);
        setSelectedAudioSurah(nextSurahId.toString());
        setIsAutoplaying(true); // Set flag to trigger useEffect for autoplay
      } else {
        console.log("Autoplay: Reached last surah or current surah ID invalid.");
        setIsAutoplaying(false); // Ensure autoplay flag is off if we don't proceed
      }
    } else {
        console.log("Autoplay: No current surah selected, cannot autoplay.");
        setIsAutoplaying(false); // Ensure autoplay flag is off
    }
  };

  // Effect to initialize audio element and add listeners
  useEffect(() => {
    console.log("Initializing audio element...");
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata'; // Preload metadata only

    const audioElement = audioRef.current;

    // Wrap play() in a helper with better error handling
    const tryPlaying = async () => {
        if (!audioRef.current || audioRef.current.readyState < 2) { // HAVE_METADATA or less
            console.log("tryPlaying: Aborted, audio not ready or ref missing.");
            return;
        }
        try {
            console.log("tryPlaying: Attempting to execute play()...");
            await audioRef.current.play();
            console.log("tryPlaying: play() promise resolved.");
            // 'playing' event should handle state updates
        } catch (err) {
            console.error("tryPlaying: Error executing play():", err);
            // Error is primarily handled by the 'error' event listener now
            // Reset state here as a fallback in case 'error' event doesn't fire reliably
            setIsPlaying(false);
            setIsAudioLoading(false);
            setIsAutoplaying(false);
            playIntentRef.current = false;
            if (err instanceof DOMException) {
                console.error(`tryPlaying: DOMException during play: ${err.name} - ${err.message}`);
                // Avoid duplicate toast if handled by the error listener
                if (err.name === 'NotSupportedError') {
                     // Toast likely shown by 'error' handler, maybe add context here if needed
                     console.error("tryPlaying: Media source not supported.");
                } else if (err.name === 'NotAllowedError') {
                     toast({ title: "خطأ في التشغيل", description: "لم يسمح المتصفح بالتشغيل التلقائي. الرجاء النقر على زر التشغيل.", variant: "destructive" });
                } else if (err.name !== 'AbortError') { // AbortError might happen if we change source quickly
                    // Avoid toast if already handled by error event?
                    // toast({ title: "خطأ في التشغيل", description: `لم يتمكن من بدء تشغيل الصوت. (${err.name})`, variant: "destructive" });
                }
            } else {
                 // Avoid toast if already handled by error event?
                 // toast({ title: "خطأ في التشغيل", description: `لم يتمكن من بدء تشغيل الصوت. (${(err as Error).message})`, variant: "destructive" });
            }
        }
    };


    // Add event listeners for audio events
    const handleAudioError = (e: Event) => {
        console.error("Audio error event:", e); // Log the raw event
        const target = e.target as HTMLAudioElement;
        const error = target.error;
        let errorMessage = "حدث خطأ غير معروف أثناء محاولة تشغيل الصوت.";
        if (error) {
             console.error(`MediaError code: ${error.code}, message: ${error.message || 'N/A'}`);
             switch (error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                    errorMessage = 'تم إجهاض عملية جلب الصوت.';
                    break;
                case MediaError.MEDIA_ERR_NETWORK:
                    errorMessage = 'حدث خطأ في الشبكة أثناء جلب الصوت.';
                    break;
                case MediaError.MEDIA_ERR_DECODE:
                     errorMessage = `حدث خطأ أثناء فك تشفير ملف الصوت. قد يكون الملف تالفًا أو بتنسيق غير مدعوم جزئيًا. (الكود: ${error.code})`;
                     console.error(`Detailed error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                     errorMessage = `مصدر الصوت (${target.src || 'غير متوفر'}) غير مدعوم أو لا يمكن العثور عليه أو بتنسيق غير مدعوم تمامًا. (الكود: ${error.code})`;
                     console.error(`Detailed error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
                    break;
                default:
                    errorMessage = `حدث خطأ غير معروف (الكود: ${error.code}).`;
                    console.error(`Detailed error: Code=${error.code}, Message='${error.message}', Source='${target.src}'`);
            }
        } else if (!target.src || target.src === window.location.href) {
             errorMessage = "لم يتم تعيين مصدر صوت صالح. الرجاء التأكد من اختيار القارئ والسورة.";
             console.error("Audio error occurred but MediaError object is null or src is invalid/missing.");
        } else {
             errorMessage = `حدث خطأ غير متوقع أثناء التعامل مع مصدر الصوت: ${target.src}`;
             console.error("Audio error occurred but MediaError object is null. Source:", target.src);
        }

        toast({
            title: "خطأ في الصوت",
            description: errorMessage,
            variant: "destructive",
        });
        setIsPlaying(false);
        setIsAudioLoading(false);
        setIsAutoplaying(false);
        playIntentRef.current = false; // Reset play intent on error
    };

     const handleCanPlay = () => {
         console.log("Audio canplay event. ReadyState:", audioElement.readyState);
         // If we intended to play (manual or autoplay), and canplay fires, try playing now.
         // This is the primary place where playback should start after intent is set.
         if (playIntentRef.current) {
            if (audioElement.paused) { // Only play if paused
                console.log("canplay: Play intent detected, attempting play...");
                playIntentRef.current = false; // Consume the intent
                tryPlaying();
            } else {
                console.log("canplay: Play intent detected but audio is already playing.");
                 // If it's already playing (e.g., resumed after buffering), ensure states are correct
                 setIsAudioLoading(false);
                 setIsPlaying(true);
                 setIsAutoplaying(false); // Should be off if manually triggered intent led to playing
            }
         } else {
             console.log("canplay: Audio ready, but no active play intent.");
              // If it became ready without intent, ensure loading is off
             if (isAudioLoading && !isPlaying) {
                 setIsAudioLoading(false);
             }
         }
     };

     const handleWaiting = () => {
         console.log("Audio waiting event (buffering)...");
         // Indicate loading ONLY if we are actively trying to play OR if it's already playing and buffers
          if (playIntentRef.current || isPlaying) {
            setIsAudioLoading(true);
          }
     };

      const handlePlaying = () => {
          console.log("Audio playing event.");
          setIsAudioLoading(false); // Should be loaded if playing starts
          setIsPlaying(true); // Ensure playing state is true
          setIsAutoplaying(false); // Reset autoplay flag once playing starts successfully
          playIntentRef.current = false; // Clear intent once playing starts
      };

      const handlePause = () => {
        console.log("Audio pause event.");
        // Only set isPlaying false if not currently loading (could be buffering pause)
        // and not trying to autoplay (pause might occur during loading of next track)
        // and no remaining play intent (e.g., pause triggered before 'canplay')
        if (!isAudioLoading && !isAutoplaying && !playIntentRef.current) {
            setIsPlaying(false);
        } else {
             console.log("Pause event ignored for state update due to loading/autoplay/intent.");
        }
        // If user pauses manually (not due to buffering/autoplay), clear the play intent.
        // Check if the pause was likely user-initiated (not loading/autoplaying).
        if (!isAudioLoading && !isAutoplaying && playIntentRef.current) {
             console.log("Manual-like pause detected, clearing play intent.");
             playIntentRef.current = false;
        }
        // If autoplay was in progress, stop it on manual pause.
        if (isAutoplaying) {
            console.log("Autoplay stopped due to manual pause.");
            setIsAutoplaying(false);
        }
      };

       const handleLoadStart = () => {
           console.log("Audio loadstart event.");
           // Set loading true ONLY if there's an active intent to play or autoplay is active.
           if (playIntentRef.current || isAutoplaying) {
                console.log("loadstart: Setting isAudioLoading true due to play intent/autoplay.");
                setIsAudioLoading(true);
           } else {
               console.log("loadstart: Detected, but not showing loader as play wasn't intended.");
                // If src is changed but no play intent, ensure loading is off
                setIsAudioLoading(false);
           }
       };

        const handleLoadedMetadata = () => {
            console.log("Audio loadedmetadata event. Duration:", audioElement.duration);
            // Metadata loaded. Check if we need to play.
            // 'canplay' is generally a better trigger for starting playback.
            // If loading state was on, but we got metadata, maybe turn off loader if readyState allows.
            if (isAudioLoading && audioElement.readyState >= 2 && !playIntentRef.current && !isPlaying) {
                 console.log("loadedmetadata: Turning off loader as metadata is loaded and no active play intent.");
                // setIsAudioLoading(false); // Let canplay handle this more reliably
            }
        };

        // Removed loadeddata handler as 'canplay' is more robust

        // Attach listeners
        audioElement.addEventListener('ended', handleAudioEnd);
        audioElement.addEventListener('error', handleAudioError);
        audioElement.addEventListener('canplay', handleCanPlay);
        audioElement.addEventListener('waiting', handleWaiting);
        audioElement.addEventListener('playing', handlePlaying);
        audioElement.addEventListener('pause', handlePause);
        audioElement.addEventListener('loadstart', handleLoadStart);
        audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        // audioElement.addEventListener('loadeddata', handleLoadedData);


    return () => {
      console.log("Cleaning up audio element...");
      if (audioElement) {
        audioElement.removeEventListener('ended', handleAudioEnd);
        audioElement.removeEventListener('error', handleAudioError);
        audioElement.removeEventListener('canplay', handleCanPlay);
        audioElement.removeEventListener('waiting', handleWaiting);
        audioElement.removeEventListener('playing', handlePlaying);
        audioElement.removeEventListener('pause', handlePause);
        audioElement.removeEventListener('loadstart', handleLoadStart);
        audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        // audioElement.removeEventListener('loadeddata', handleLoadedData);
        audioElement.pause();
        // Setting src to empty string is often recommended for cleanup
        audioElement.src = '';
        audioElement.removeAttribute('src');
        audioElement.load(); // Reset
      }
      playIntentRef.current = false; // Ensure reset on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); // Add toast dependency, effect should run only once on mount


  // Effect to select the appropriate Moshaf when reciter changes or data loads
  useEffect(() => {
    console.log(`Reciter/Data Check: ID=${selectedReciterId}, Data loaded=${!!recitersData}, Loading=${isLoadingReciters}`);
    if (selectedReciterId && recitersData?.reciters) {
      const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
       console.log("Found reciter:", reciter?.name);
      const moshafs = reciter?.moshaf ?? [];
      console.log("Available Moshafs for selected reciter:", moshafs.map(m => ({id: m.id, name: m.name, server: m.server})));

      if (moshafs.length > 0) {
        // Prioritize 'مرتل' if available, otherwise take the first
        const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
        const moshafToSelect = murattalMoshaf || moshafs[0];
        const oldMoshafId = selectedMoshaf?.id;
        const oldServer = selectedMoshaf?.server;
        console.log("Auto-selecting Moshaf:", {id: moshafToSelect.id, name: moshafToSelect.name, server: moshafToSelect.server});

        if (oldMoshafId !== moshafToSelect.id || oldServer !== moshafToSelect.server) {
           console.log("Setting selected Moshaf state.");
          setSelectedMoshaf(moshafToSelect);
           // Clear current source and state if reciter/moshaf changes and audio is paused
           if (audioRef.current && audioRef.current.paused) {
                console.log("Clearing audio source/state due to reciter/moshaf change while paused.");
                // Let prepareAudioSource handle setting the new src
                setIsPlaying(false);
                setIsAudioLoading(false); // Reset loading state
                playIntentRef.current = false; // Reset intent
                // prepareAudioSource will be called by the next effect
           } else if (audioRef.current && !audioRef.current.paused) {
               // If playing, pause first before changing source implicitly later
                console.log("Pausing audio due to reciter/moshaf change while playing.");
               audioRef.current.pause();
               playIntentRef.current = false; // Explicitly stop any pending play
           }
        } else {
           console.log("Selected Moshaf is already the correct one, no state change needed.");
        }
      } else {
        console.log("No Moshafs available for this reciter. Resetting selection.");
        if (selectedMoshaf) { // Only reset if it was previously set
          setSelectedMoshaf(undefined);
           if (audioRef.current) { // Check if audioRef exists
               console.log("Clearing audio source/state due to no moshafs available.");
                if (!audioRef.current.paused) audioRef.current.pause(); // Pause if playing
                // Setting src to empty string is better for cleanup
                audioRef.current.src = '';
                audioRef.current.removeAttribute('src');
                audioRef.current.load(); // Reset audio element state
                setIsPlaying(false);
                setIsAudioLoading(false);
                playIntentRef.current = false;
           }
        }
         if(!isLoadingReciters) {
            toast({
              title: "تنبيه",
              description: "لا توجد مصاحف متاحة لهذا القارئ.",
              variant: "default",
            });
        }
      }
    } else if (!isLoadingReciters && selectedReciterId && !recitersData?.reciters) {
        console.error("Reciter selected, but reciters data is unavailable.");
         toast({
              title: "خطأ",
              description: "فشل في تحميل بيانات القراء.",
              variant: "destructive",
         });
         setSelectedMoshaf(undefined);
         if (audioRef.current) { // Clear audio state if data fails
             if (!audioRef.current.paused) audioRef.current.pause();
             audioRef.current.src = '';
             audioRef.current.removeAttribute('src');
             audioRef.current.load();
             setIsPlaying(false);
             setIsAudioLoading(false);
             playIntentRef.current = false;
         }
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReciterId, recitersData, toast, isLoadingReciters]); // Removed selectedMoshaf dependency


  // Prepare audio source function (DOES NOT PLAY)
  // Returns true if source was set/updated, false otherwise.
   const prepareAudioSource = React.useCallback((forceLoad: boolean = false): boolean => {
       console.log("Attempting to prepare audio source...");
       console.log("Current state:", { reciterId: selectedReciterId, moshaf: selectedMoshaf?.id, surah: selectedAudioSurah, currentSrc: audioRef.current?.src, isPlaying, isAudioLoading, playIntent: playIntentRef.current });

       if (!audioRef.current) {
           console.error("prepareAudioSource: audioRef is null.");
           return false;
       }

        // Check if selections are missing
       if (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah) {
           console.warn("prepareAudioSource: Cannot prepare source: Missing selections (Reciter, Moshaf, or Surah).");
            if (audioRef.current.src && audioRef.current.src !== window.location.href && audioRef.current.src !== '') {
                console.log("Clearing potentially invalid audio source due to missing selections.");
                if (!audioRef.current.paused) audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current.removeAttribute('src');
                audioRef.current.load();
                setIsPlaying(false);
                setIsAudioLoading(false);
                playIntentRef.current = false;
            }
           return false;
       }

       console.log("Selected Moshaf found:", selectedMoshaf);
        if (!selectedMoshaf.server || typeof selectedMoshaf.server !== 'string' || !(selectedMoshaf.server.startsWith('http://') || selectedMoshaf.server.startsWith('https://'))) {
            console.error(`prepareAudioSource: Invalid server URL in selected Moshaf: ${selectedMoshaf.server}`);
            toast({ title: "خطأ", description: `رابط المصحف (${selectedMoshaf.name}) غير صالح أو مفقود.`, variant: "destructive"});
            if (audioRef.current.src && audioRef.current.src !== window.location.href && audioRef.current.src !== '') {
                 if (!audioRef.current.paused) audioRef.current.pause();
                 audioRef.current.src = '';
                 audioRef.current.removeAttribute('src');
                 audioRef.current.load();
                 setIsPlaying(false);
                 setIsAudioLoading(false);
                 playIntentRef.current = false;
            }
            return false;
        }

       try {
           const audioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
           console.log(`Generated audio URL: ${audioUrl}`);

           if (!audioUrl) {
               console.error("prepareAudioSource: Generated audio URL is invalid (empty string).");
                toast({ title: "خطأ", description: "فشل في بناء رابط الصوت.", variant: "destructive"});
                if (audioRef.current.src && audioRef.current.src !== window.location.href && audioRef.current.src !== '') {
                     if (!audioRef.current.paused) audioRef.current.pause();
                     audioRef.current.src = '';
                     audioRef.current.removeAttribute('src');
                     audioRef.current.load();
                     setIsPlaying(false);
                     setIsAudioLoading(false);
                     playIntentRef.current = false;
                }
                return false;
           }

           const currentSrc = audioRef.current.src;
           // Consider empty string or page URL as not set
           const isSrcEffectivelySet = currentSrc && currentSrc !== window.location.href && currentSrc !== '';
           const needsUpdate = forceLoad || !isSrcEffectivelySet || currentSrc !== audioUrl;

           if (needsUpdate) {
                console.log(`Setting new audio source: ${audioUrl} (forceLoad: ${forceLoad}, isSrcSet: ${isSrcEffectivelySet}, urlMismatch: ${currentSrc !== audioUrl})`);
                // Pause might not be necessary if load() is called, but belt-and-suspenders
                if (!audioRef.current.paused) {
                     console.log("Pausing before changing source.");
                     audioRef.current.pause();
                     // State updates handled by pause event
                }
                // Reset state related to the old source BEFORE setting new src
                setIsPlaying(false); // Ensure isPlaying is false before loading new source
                // If forceLoad is true, it implies an intent (like autoplay), so keep playIntentRef.current as is.
                // If forceLoad is false, clear any old intent.
                if (!forceLoad) {
                    playIntentRef.current = false;
                }
                 // Let loadstart event handle setting isAudioLoading = true if needed based on intent
                // setIsAudioLoading(true); // Set loading immediately? Handled by loadstart now
                audioRef.current.src = audioUrl;
                console.log("Calling audio.load()...");
                audioElement.load(); // Use the element from the outer scope
                console.log("Audio load initiated.");
                return true;
           } else {
               console.log("Audio source is already correct. No preparation needed.");
                // Ensure loading state is correct if source is already set
                if (isAudioLoading && audioRef.current.readyState >= 3) { // HAVE_CURRENT_DATA or more
                   console.log("Source correct, ready state sufficient, ensuring loading is false.");
                   setIsAudioLoading(false);
                }
               return true;
           }
       } catch (error) {
           console.error("Error preparing audio source:", error);
           toast({
               title: "خطأ في إعداد الصوت",
               description: (error as Error).message || "حدث خطأ أثناء تحضير رابط الصوت.",
               variant: "destructive",
           });
           setIsPlaying(false);
           setIsAudioLoading(false);
           setIsAutoplaying(false);
           playIntentRef.current = false;
           return false;
       }
       // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [selectedReciterId, selectedMoshaf, selectedAudioSurah, toast]); // Added audioElement to dependencies


   // Effect to prepare the source when selections change OR on initial load with defaults
   useEffect(() => {
       if (selectedMoshaf) {
            console.log("Selection/Moshaf changed, preparing audio source (no force play)...");
            // Force load only if src is currently empty, points to the page URL, or is actually empty string
            const shouldForceLoad = !audioRef.current?.src || audioRef.current.src === window.location.href || audioRef.current.src === '';
            prepareAudioSource(shouldForceLoad);
       } else {
           console.log("Moshaf not yet selected, skipping source preparation.");
            if (audioRef.current?.src && audioRef.current.src !== window.location.href && audioRef.current.src !== '') {
                console.log("Clearing audio source because Moshaf is undefined.");
                if (!audioRef.current.paused) audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current.removeAttribute('src');
                audioRef.current.load();
                setIsPlaying(false);
                setIsAudioLoading(false);
                playIntentRef.current = false;
            }
       }
       // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [selectedMoshaf, selectedAudioSurah]); // Trigger when Moshaf or Surah changes, prepareAudioSource is memoized

   // Effect to handle autoplay logic
  useEffect(() => {
    if (isAutoplaying && audioRef.current && selectedMoshaf && selectedAudioSurah) {
      console.log(`Autoplay: Triggered for Surah ${selectedAudioSurah}`);
       playIntentRef.current = true; // Set intent to play for autoplay
      // Force load the new surah source
      const sourcePrepared = prepareAudioSource(true);
      if (sourcePrepared) {
          console.log("Autoplay: Source prepared/preparing. Play intent is set, waiting for 'canplay'.");
           // DO NOT call play() directly. Rely on 'canplay' event triggered by load()
           // The loadstart event handler should set isAudioLoading = true because playIntentRef is true
      } else {
        console.error("Autoplay: Failed to prepare source for next surah.");
        setIsAudioLoading(false);
        setIsAutoplaying(false); // Stop autoplay if preparation fails
        playIntentRef.current = false;
        toast({
          title: "خطأ في التشغيل التلقائي",
          description: "فشل في تحضير السورة التالية.",
          variant: "destructive",
        });
      }
    } else if (isAutoplaying) {
        console.log("Autoplay: Triggered but conditions not met (missing refs/selections). Aborting.");
        setIsAutoplaying(false); // Turn off flag if we can't proceed
        playIntentRef.current = false;
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoplaying]); // Only depend on isAutoplaying to trigger this specific logic


  // Update audio volume effect
  useEffect(() => {
    if (audioRef.current) {
        const newVolume = isMuted ? 0 : volume / 100;
      audioRef.current.volume = newVolume;
    }
  }, [volume, isMuted]);


  // Play/Pause Handler
  const handlePlayPause = () => {
    if (!audioRef.current) {
        console.error("Play/Pause clicked but audioRef is null.");
        return;
    }

    const readyState = audioRef.current.readyState;
    console.log(`Play/Pause clicked. Current state: isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}, src=${audioRef.current.src}, readyState=${readyState}, playIntent=${playIntentRef.current}`);

    if (isPlaying) {
      console.log("Pausing audio...");
      playIntentRef.current = false; // Clear intent if user explicitly pauses
      audioRef.current.pause();
      // State updates handled by 'pause' event listener
    } else {
      console.log("Attempting to play audio...");
      // Ensure selections are made
      if (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah) {
         console.warn("Play clicked, but required selections are missing.");
        toast({
            title: "تنبيه",
            description: "الرجاء اختيار القارئ والمصحف والسورة الصوتية أولاً.",
            variant: "default",
        });
        return;
      }

       // Set the intent to play
       playIntentRef.current = true;

      // Ensure the source is prepared/updated, force load if src is invalid or missing
      const src = audioRef.current.src;
      const shouldForceLoad = !src || src === window.location.href || src === '';
      const sourceReadyOrPreparing = prepareAudioSource(shouldForceLoad);
      console.log(`Source preparation result: ${sourceReadyOrPreparing}`);

      if (sourceReadyOrPreparing) {
          console.log("Source ready or preparing. Play intent set, waiting for 'canplay'.");
         // Set loading only if the audio isn't already ready to play enough
         // readyState 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
         // Use HAVE_METADATA (1) as threshold, 'canplay' will trigger play later if intent is set.
         if (readyState < 2 && !isAudioLoading) {
            console.log("readyState < 2, setting isAudioLoading true");
            setIsAudioLoading(true);
         } else if (readyState >= 3) {
             // If already ready enough, try playing immediately (might still need 'canplay' in some browsers)
             console.log("readyState >= 3, attempting immediate play (fallback)...");
             if (audioRef.current.paused) {
                // tryPlaying(); // Let canplay handle primarily
             } else {
                 console.log("readyState >= 3, but audio is not paused. Events should sync state.");
                 if (isAudioLoading) setIsAudioLoading(false); // Ensure loading off if playing
                 if (!isPlaying) setIsPlaying(true); // Ensure playing is true
                 playIntentRef.current = false; // Consume intent if already playing
             }
         }
          // DO NOT call play() directly here. Rely on 'canplay'.
      } else {
           console.error("Play clicked, but source preparation failed.");
           setIsAudioLoading(false);
           playIntentRef.current = false; // Clear intent if prep failed
           // prepareAudioSource likely showed a toast
      }
    }
  };


  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (isMuted && newVolume > 0) {
        console.log("Unmuting due to volume change.");
      setIsMuted(false);
    } else if (!isMuted && newVolume === 0) {
        console.log("Muting due to volume set to 0.");
        setIsMuted(true);
    }
  };

  const toggleMute = () => {
      const newMutedState = !isMuted;
      console.log(`Toggling mute. New state: ${newMutedState}`);
      setIsMuted(newMutedState);
       if (!newMutedState && volume === 0) {
            console.log("Unmuting with 0 volume, setting volume to 10.");
            setVolume(10);
       }
  };

   // Determine if the play button should be disabled
   const isPlayDisabled = !selectedReciterId || !selectedMoshaf || !selectedAudioSurah || (isAudioLoading && !isPlaying); // Allow pausing while loading

   // Get selected reciter name for display (optional)
    const selectedReciterName = recitersData?.reciters.find(r => r.id.toString() === selectedReciterId)?.name;


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
         {isMobile && <SidebarTrigger icon={Menu} />}
         {/* Removed "قارئ الكتاب" text */}

         <div className="flex items-center gap-2 ml-auto md:ml-0">
             {isLoadingReciters ? (
                 <Skeleton className="h-10 w-[180px]" />
             ) : recitersError ? (
                 <div className="w-[180px] text-destructive text-xs px-2 py-1 border border-destructive rounded-md text-center font-cairo">
                     {/* @ts-ignore */}
                     {(recitersError as Error)?.message || 'خطأ في تحميل القراء'}
                 </div>
             ) : (
                 <Select value={selectedReciterId} onValueChange={(value) => {
                    console.log("Selected Reciter changed:", value);
                    setSelectedReciterId(value);
                    // Stop autoplay and clear intent immediately
                    setIsAutoplaying(false);
                    playIntentRef.current = false;
                     if (audioRef.current && !audioRef.current.paused) {
                        console.log("Pausing due to reciter change.");
                        audioRef.current.pause();
                        // State handled by pause event
                     } else {
                         // If paused, the useEffect for selectedReciterId will handle moshaf/source update
                         console.log("Reciter changed while paused/stopped.");
                     }
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
                 // Stop autoplay and clear intent immediately
                 setIsAutoplaying(false);
                 playIntentRef.current = false;
                  if (audioRef.current && !audioRef.current.paused) {
                       console.log("Pausing due to surah change.");
                      audioRef.current.pause();
                      // State handled by pause event
                  } else {
                       // If paused, the useEffect for selectedAudioSurah will handle source update
                       console.log("Surah changed while paused/stopped.");
                  }
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
               <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={isPlayDisabled} className="font-cairo">
                 {isAudioLoading ? <Loader2 className="animate-spin h-5 w-5" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                 <span className="sr-only">{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
               </Button>
            </TooltipTrigger>
            <TooltipContent>
               <p className="font-cairo">{isAudioLoading ? 'جاري التحميل...' : (isPlaying ? 'إيقاف مؤقت' : 'تشغيل')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
             <div className="space-y-2 text-right">
                <p>
                    مصادر النصوص القرآنية (الملفات):
                    <a href="https://qurancomplex.gov.sa/techquran/dev/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block">
                    بوابة المصحف الإلكتروني بمجمع الملك فهد
                    </a>
                </p>
                <p>
                    مصدر واجهة برمجة التطبيقات الصوتية للقرآن الكريم:
                    <a href="https://mp3quran.net/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block">
                    mp3quran.net
                    </a>
                </p>
                 <p>
                    تحميل خطوط القرآن المستخدمة في التطبيق (KFGQPC):
                    <a href="https://drive.google.com/file/d/1x4JKWT7Sq1F-rZL0cbe38G_10FuD5dQc/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 block">
                      <Download className="inline-block h-4 w-4 ml-1" />
                      رابط التحميل (Google Drive)
                    </a>
                     <span className="text-xs text-muted-foreground block">(ملاحظة: سيتم فتح الرابط في نافذة جديدة)</span>
                </p>
                <p>تم بناء هذا التطبيق باستخدام Next.js و Shadcn/UI و Tailwind CSS.</p>
                <p>
                    للتواصل والاستفسارات: <a href="mailto:darrati10@gmail.com" className="text-primary underline hover:text-primary/80">darrati10@gmail.com</a>
                </p>
              </div>
            </DialogDescription>
             <DialogClose asChild>
                 <Button type="button" variant="secondary" className="font-cairo mt-4">
                    إغلاق
                 </Button>
             </DialogClose>
          </DialogContent>
        </Dialog>

       </div>
    </header>
  );
}
 