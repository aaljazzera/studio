
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
  DialogFooter, // Added DialogFooter
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
  // Default to Reciter ID 7 (Ahmed Saud) and Al-Fatiha (ID 1)
  const [selectedReciterId, setSelectedReciterId] = useState<string>('7'); // Default to Ahmed Saud
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string>('1'); // Default to Al-Fatiha
  const [selectedMoshaf, setSelectedMoshaf] = useState<Moshaf | undefined>(undefined); // Store the selected moshaf object
  const [isAutoplaying, setIsAutoplaying] = useState(false); // State to manage autoplay
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // const playIntentRef = useRef<boolean>(false); // Ref to track explicit play intention - Removed, rely on state
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

    const audioElement = audioRef.current; // Capture for use in cleanup

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
                     // More specific message for format/source issues
                     errorMessage = `مصدر الصوت (${target.src || 'غير متوفر'}) غير مدعوم، لا يمكن العثور عليه، أو بتنسيق غير مدعوم. جرب اختيار قارئ أو سورة أخرى. (الكود: ${error.code})`;
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
    };

     const handleCanPlay = () => {
         console.log("Audio canplay event. ReadyState:", audioElement?.readyState);
         // If we were loading (either from initial play or buffering),
         // and the audio is now ready, stop showing the loading indicator.
         if (isAudioLoading) {
             console.log("Canplay: Audio ready, setting isAudioLoading false.");
             setIsAudioLoading(false);
         }
         // If autoplay was intended, try playing now that it's ready.
         if (isAutoplaying && audioElement?.paused) {
             console.log("Canplay: Autoplay intent detected, attempting play...");
             audioElement.play().catch(err => {
                console.error("Autoplay failed during canplay:", err);
                setIsPlaying(false);
                setIsAudioLoading(false);
                setIsAutoplaying(false);
                // Show toast for autoplay failure?
                 toast({ title: "فشل التشغيل التلقائي", description: (err as Error).message, variant: "destructive"});
             });
             // 'playing' event will set isPlaying=true
         }
     };

     const handleWaiting = () => {
         console.log("Audio waiting event (buffering)...");
         // Indicate loading ONLY if we are actively trying to play OR if it's already playing and buffers
         // Check if we are not already loading to avoid redundant state updates
          if ((isPlaying || isAutoplaying) && !isAudioLoading) {
            console.log("Waiting: Buffering started, setting isAudioLoading true.");
            setIsAudioLoading(true);
          }
     };

      const handlePlaying = () => {
          console.log("Audio playing event.");
          setIsAudioLoading(false); // Should be loaded if playing starts
          setIsPlaying(true); // Ensure playing state is true
          setIsAutoplaying(false); // Reset autoplay flag once playing starts successfully
      };

      const handlePause = () => {
        console.log("Audio pause event.");
        // Check if the pause was user-initiated or due to ending/error/source change
        // We set isPlaying false unless it's just buffering (isAudioLoading is true)
        if (!isAudioLoading) {
             console.log("Pause: Setting isPlaying false.");
             setIsPlaying(false);
             // If autoplay was in progress, stop it on manual-like pause.
             if (isAutoplaying) {
                 console.log("Pause: Autoplay stopped due to pause event.");
                 setIsAutoplaying(false);
             }
        } else {
             console.log("Pause event ignored for state update due to buffering.");
        }
      };

       const handleLoadStart = () => {
           console.log("Audio loadstart event.");
           // Only set loading if play was intended (isPlaying or isAutoplaying flag)
           // Avoid setting loading just because src changed
           if ((isPlaying || isAutoplaying) && !isAudioLoading) {
                console.log("Loadstart: Setting isAudioLoading true due to playing/autoplay intent.");
                setIsAudioLoading(true);
           } else {
               console.log("Loadstart: Detected, but not showing loader as play wasn't intended or already loading.");
               // If src changes while paused, ensure loading is off.
                if (!isPlaying && !isAutoplaying && isAudioLoading) {
                   setIsAudioLoading(false);
                }
           }
       };

        // Attach listeners
        audioElement?.addEventListener('ended', handleAudioEnd);
        audioElement?.addEventListener('error', handleAudioError);
        audioElement?.addEventListener('canplay', handleCanPlay);
        audioElement?.addEventListener('waiting', handleWaiting);
        audioElement?.addEventListener('playing', handlePlaying);
        audioElement?.addEventListener('pause', handlePause);
        audioElement?.addEventListener('loadstart', handleLoadStart);


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
        audioElement.pause();
        audioElement.src = '';
        audioElement.removeAttribute('src');
        try {
           audioElement.load(); // Reset
        } catch (e) {
            console.warn("Error during audio cleanup load():", e);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); // Effect should run only once on mount


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

        // Only update state and potentially audio if the moshaf actually changes
        if (oldMoshafId !== moshafToSelect.id || oldServer !== moshafToSelect.server) {
           console.log("Setting selected Moshaf state.");
          setSelectedMoshaf(moshafToSelect); // This triggers the next useEffect to prepare source

          // Clear current source and state if reciter/moshaf changes and audio is paused
           if (audioRef.current && audioRef.current.paused) {
                console.log("Clearing audio source/state due to reciter/moshaf change while paused.");
                // Let prepareAudioSource handle setting the new src in the next effect
                setIsPlaying(false);
                setIsAudioLoading(false); // Reset loading state
                setIsAutoplaying(false); // Stop autoplay on reciter change
           } else if (audioRef.current && !audioRef.current.paused) {
               // If playing, pause first before changing source implicitly later
                console.log("Pausing audio due to reciter/moshaf change while playing.");
               audioRef.current.pause();
               setIsAutoplaying(false); // Stop autoplay on reciter change
               // State update handled by pause event listener
           }
        } else {
           console.log("Selected Moshaf is already the correct one, no state change needed.");
        }
      } else {
        console.log("No Moshafs available for this reciter. Resetting selection.");
        if (selectedMoshaf) { // Only reset if it was previously set
          setSelectedMoshaf(undefined);
           if (audioRef.current) {
               console.log("Clearing audio source/state due to no moshafs available.");
                if (!audioRef.current.paused) audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current.removeAttribute('src');
                audioRef.current.load();
                setIsPlaying(false);
                setIsAudioLoading(false);
                setIsAutoplaying(false);
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
             setIsAutoplaying(false);
         }
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReciterId, recitersData, toast, isLoadingReciters]);


  // Prepare audio source function (DOES NOT PLAY)
  // Returns true if source was set/updated, false otherwise.
   const prepareAudioSource = React.useCallback((forceLoad: boolean = false): boolean => {
       console.log("Attempting to prepare audio source...");
       const currentAudioRef = audioRef.current; // Capture ref for stability
       console.log("Current state:", { reciterId: selectedReciterId, moshaf: selectedMoshaf?.id, surah: selectedAudioSurah, currentSrc: currentAudioRef?.src, isPlaying, isAudioLoading });

       if (!currentAudioRef) {
           console.error("prepareAudioSource: audioRef is null.");
           return false;
       }

        // Check if selections are missing
       if (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah) {
           console.warn("prepareAudioSource: Cannot prepare source: Missing selections (Reciter, Moshaf, or Surah).");
            if (currentAudioRef.src && currentAudioRef.src !== window.location.href && currentAudioRef.src !== '') {
                console.log("Clearing potentially invalid audio source due to missing selections.");
                if (!currentAudioRef.paused) currentAudioRef.pause();
                currentAudioRef.src = '';
                currentAudioRef.removeAttribute('src');
                currentAudioRef.load();
                setIsPlaying(false);
                setIsAudioLoading(false);
                setIsAutoplaying(false);
            }
           return false;
       }

       console.log("Selected Moshaf found:", selectedMoshaf);
        if (!selectedMoshaf.server || typeof selectedMoshaf.server !== 'string' || !(selectedMoshaf.server.startsWith('http://') || selectedMoshaf.server.startsWith('https://'))) {
            console.error(`prepareAudioSource: Invalid server URL in selected Moshaf: ${selectedMoshaf.server}`);
            toast({ title: "خطأ", description: `رابط المصحف (${selectedMoshaf.name}) غير صالح أو مفقود.`, variant: "destructive"});
            if (currentAudioRef.src && currentAudioRef.src !== window.location.href && currentAudioRef.src !== '') {
                 if (!currentAudioRef.paused) currentAudioRef.pause();
                 currentAudioRef.src = '';
                 currentAudioRef.removeAttribute('src');
                 currentAudioRef.load();
                 setIsPlaying(false);
                 setIsAudioLoading(false);
                 setIsAutoplaying(false);
            }
            return false;
        }

       try {
           const audioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
           console.log(`Generated audio URL: ${audioUrl}`);

           if (!audioUrl) {
               console.error("prepareAudioSource: Generated audio URL is invalid (empty string).");
                toast({ title: "خطأ", description: "فشل في بناء رابط الصوت.", variant: "destructive"});
                if (currentAudioRef.src && currentAudioRef.src !== window.location.href && currentAudioRef.src !== '') {
                     if (!currentAudioRef.paused) currentAudioRef.pause();
                     currentAudioRef.src = '';
                     currentAudioRef.removeAttribute('src');
                     currentAudioRef.load();
                     setIsPlaying(false);
                     setIsAudioLoading(false);
                     setIsAutoplaying(false);
                }
                return false;
           }

           const currentSrc = currentAudioRef.src;
           // Consider empty string or page URL as not set
           const isSrcEffectivelySet = currentSrc && currentSrc !== window.location.href && currentSrc !== '';
           const needsUpdate = forceLoad || !isSrcEffectivelySet || currentSrc !== audioUrl;

           if (needsUpdate) {
                console.log(`Setting new audio source: ${audioUrl} (forceLoad: ${forceLoad}, isSrcSet: ${isSrcEffectivelySet}, urlMismatch: ${currentSrc !== audioUrl})`);
                // Pause might not be necessary if load() is called, but belt-and-suspenders
                if (!currentAudioRef.paused) {
                     console.log("Pausing before changing source.");
                     currentAudioRef.pause();
                     // State updates handled by pause event
                }
                // Reset state related to the old source BEFORE setting new src
                setIsPlaying(false); // Ensure isPlaying is false before loading new source
                setIsAudioLoading(false); // Ensure loading is off initially

                currentAudioRef.src = audioUrl;
                console.log("Calling audio.load()...");
                currentAudioRef.load(); // This should trigger 'loadstart' if play is intended later
                console.log("Audio load initiated.");
                return true;
           } else {
               console.log("Audio source is already correct. No preparation needed.");
                // Ensure loading state is correct if source is already set
                if (isAudioLoading && currentAudioRef.readyState >= 3) { // HAVE_CURRENT_DATA or more
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
           return false;
       }
       // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [selectedReciterId, selectedMoshaf, selectedAudioSurah, toast, isPlaying, isAudioLoading]);


   // Effect to prepare the source when selections change OR on initial load with defaults
   useEffect(() => {
       if (selectedMoshaf && selectedAudioSurah) {
            console.log("Selection/Moshaf changed, preparing audio source (force load only if needed)...");
             const shouldForceLoad = !audioRef.current?.src || audioRef.current.src === window.location.href || audioRef.current.src === '';
            prepareAudioSource(shouldForceLoad);
       } else {
           console.log("Moshaf or Surah not yet selected, skipping source preparation.");
            if (audioRef.current?.src && audioRef.current.src !== window.location.href && audioRef.current.src !== '') {
                console.log("Clearing audio source because Moshaf or Surah is undefined.");
                if (!audioRef.current.paused) audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current.removeAttribute('src');
                audioRef.current.load();
                setIsPlaying(false);
                setIsAudioLoading(false);
                setIsAutoplaying(false);
            }
       }
       // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [selectedMoshaf, selectedAudioSurah]); // Trigger when Moshaf or Surah changes


   // Effect to handle autoplay logic
  useEffect(() => {
    if (isAutoplaying && audioRef.current && selectedMoshaf && selectedAudioSurah) {
      console.log(`Autoplay: Triggered for Surah ${selectedAudioSurah}`);
      // Force load the new surah source
      const sourcePrepared = prepareAudioSource(true);
      if (sourcePrepared) {
          console.log("Autoplay: Source prepared/preparing. Waiting for 'canplay' to attempt play.");
          // Set loading true here because autoplay intends to play immediately
          setIsAudioLoading(true);
           // Play attempt moved to 'canplay' handler
      } else {
        console.error("Autoplay: Failed to prepare source for next surah.");
        setIsAudioLoading(false);
        setIsAutoplaying(false); // Stop autoplay if preparation fails
        toast({
          title: "خطأ في التشغيل التلقائي",
          description: "فشل في تحضير السورة التالية.",
          variant: "destructive",
        });
      }
    } else if (isAutoplaying) {
        console.log("Autoplay: Triggered but conditions not met (missing refs/selections). Aborting.");
        setIsAutoplaying(false); // Turn off flag if we can't proceed
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
    const currentAudioRef = audioRef.current;
    if (!currentAudioRef) {
        console.error("Play/Pause clicked but audioRef is null.");
        return;
    }

    const readyState = currentAudioRef.readyState;
    const currentSrc = currentAudioRef.src;
    console.log(`Play/Pause clicked. Current state: isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}, src=${currentSrc || 'null'}, readyState=${readyState}`);

    if (isPlaying) {
      console.log("Pausing audio...");
      setIsAutoplaying(false); // Explicit pause stops autoplay
      currentAudioRef.pause();
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

      // Ensure the source is prepared/updated, force load if src is invalid or missing
      const shouldForceLoad = !currentSrc || currentSrc === window.location.href || currentSrc === '';
      const sourceReadyOrPreparing = prepareAudioSource(shouldForceLoad);
      console.log(`Source preparation result: ${sourceReadyOrPreparing}`);

      if (sourceReadyOrPreparing) {
           console.log("Source ready or preparing. Attempting play...");
           setIsAudioLoading(true); // Set loading immediately on play intent

            // Try to play
            currentAudioRef.play()
              .then(() => {
                  console.log("Play promise resolved.");
                  // 'playing' event will set isPlaying=true and isAudioLoading=false
              })
              .catch((err) => {
                console.error("Error calling play() explicitly:", err);
                setIsPlaying(false);
                setIsAudioLoading(false);
                setIsAutoplaying(false);
                // Show specific error toast
                 if (err instanceof DOMException) {
                     console.error(`DOMException during play: ${err.name} - ${err.message}`);
                     if (err.name === 'NotAllowedError') {
                          toast({ title: "خطأ في التشغيل", description: "لم يسمح المتصفح بالتشغيل التلقائي. الرجاء التفاعل مع الصفحة أولاً.", variant: "destructive" });
                     } else if (err.name === 'NotSupportedError') {
                         toast({ title: "خطأ في التشغيل", description: `مصدر الصوت غير مدعوم أو تعذر تحميله. (${err.message})`, variant: "destructive"});
                     } else {
                          toast({ title: "خطأ في التشغيل", description: `حدث خطأ غير متوقع: ${err.message}`, variant: "destructive"});
                     }
                 } else {
                     toast({ title: "خطأ في التشغيل", description: "حدث خطأ غير متوقع أثناء محاولة التشغيل.", variant: "destructive"});
                 }
              });
      } else {
           console.error("Play clicked, but source preparation failed.");
           setIsAudioLoading(false);
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
    // Disable if required selections are missing.
    // Loading state is handled by showing the spinner instead of the play/pause icon.
   const isPlayDisabled = (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah);

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
                    setIsAutoplaying(false); // Stop autoplay on change
                    if (audioRef.current && !audioRef.current.paused) {
                        console.log("Pausing due to reciter change.");
                        audioRef.current.pause();
                        // State handled by pause event
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
                 setIsAutoplaying(false); // Stop autoplay on change
                  if (audioRef.current && !audioRef.current.paused) {
                       console.log("Pausing due to surah change.");
                      audioRef.current.pause();
                      // State handled by pause event
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
               <p className="font-cairo">{isPlayDisabled ? 'يرجى تحديد القارئ والسورة' : (isAudioLoading ? 'جاري التحميل...' : (isPlaying ? 'إيقاف مؤقت' : 'تشغيل'))}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-2 w-32">
          <Slider
            dir="ltr" // Keep LTR for volume slider
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
             <div className="space-y-4 text-right"> {/* Increased spacing */}
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
             <DialogFooter className="mt-4"> {/* Added DialogFooter */}
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
