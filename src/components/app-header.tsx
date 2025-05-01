
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
  Download, // Import Download icon
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
  // Default to Fares Abbad (ID 37) and Al-Fatiha (ID 1)
  const [selectedReciterId, setSelectedReciterId] = useState<string>('37'); // Default Fares Abbad
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string>('1'); // Default Al-Fatiha
  const [selectedMoshaf, setSelectedMoshaf] = useState<Moshaf | undefined>(undefined); // Store the selected moshaf object
  const [isAutoplaying, setIsAutoplaying] = useState(false); // State to manage autoplay
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
    setIsAudioLoading(false); // Ensure loading is false when ended
    setIsAutoplaying(false); // Reset autoplay flag if it was active

    // Autoplay next surah logic
    if (selectedAudioSurah) {
      const currentSurahId = parseInt(selectedAudioSurah, 10);
      if (!isNaN(currentSurahId) && currentSurahId < 114) { // Check if it's not the last surah
        const nextSurahId = currentSurahId + 1;
        console.log(`Autoplay: Setting next surah to ${nextSurahId}`);
        setSelectedAudioSurah(nextSurahId.toString());
        setIsAutoplaying(true); // Set flag to trigger useEffect for autoplay
        // The useEffect hook watching selectedAudioSurah and isAutoplaying will handle the actual playback
      } else {
        console.log("Autoplay: Reached last surah or current surah ID invalid.");
        // Optionally, stop playback or loop back to Surah 1
      }
    } else {
        console.log("Autoplay: No current surah selected, cannot autoplay.");
    }
  };

  // Effect to initialize audio element and add listeners
  useEffect(() => {
    // Create audio element only on the client side
    console.log("Initializing audio element...");
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata'; // Preload metadata only

    const audioElement = audioRef.current; // Capture current ref value

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
                    errorMessage = 'حدث خطأ أثناء فك تشفير ملف الصوت.';
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage = `مصدر الصوت (${target.src || 'غير متوفر'}) غير مدعوم أو لا يمكن العثور عليه. قد يكون الرابط غير صحيح أو هناك مشكلة في الخادم.`;
                    break;
                default:
                    errorMessage = `حدث خطأ غير معروف (الكود: ${error.code}).`;
            }
        } else if (!target.src || target.src === window.location.href) { // Check if src is missing or points to the page itself
             errorMessage = "لم يتم تعيين مصدر صوت صالح. الرجاء التأكد من اختيار القارئ والسورة.";
             console.error("Audio error occurred but MediaError object is null or src is invalid/missing.");
        } else {
             // Generic error if no error code and src seems present
             errorMessage = `حدث خطأ غير متوقع أثناء التعامل مع مصدر الصوت: ${target.src}`;
             console.error("Audio error occurred but MediaError object is null. Source:", target.src);
        }

        toast({
            title: "خطأ في الصوت",
            description: errorMessage,
            variant: "destructive",
        });
        setIsPlaying(false); // Reset playing state on error
        setIsAudioLoading(false);
        setIsAutoplaying(false); // Reset autoplay on error
    };

     const handleCanPlay = () => {
         console.log("Audio canplay event.");
         // If we are attempting to play (either manually or autoplay), and canplay fires,
         // it means buffering likely completed, or enough data is available.
         // We might still be in a loading state visually until 'playing' fires.
         if (isAudioLoading && !isPlaying && !isAutoplaying) {
             console.log("Audio canplay: Buffering likely complete or sufficient, but not playing yet.");
         }
         // If autoplay was intended and we can play, attempt to play now.
         // This helps in scenarios where 'loadeddata' might not be sufficient.
         if (isAutoplaying && audioRef.current && !audioRef.current.paused) {
             console.log("Autoplay: 'canplay' received, attempting play...");
             audioRef.current.play().catch(err => {
                 console.error("Autoplay: Error during play attempt after 'canplay':", err);
                 // Error listener should handle this
             });
         }
     };

     const handleWaiting = () => {
         console.log("Audio waiting event (buffering)...");
         // Indicate loading ONLY if we are actively trying to play or autoplaying
          if (isPlaying || isAutoplaying) {
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
        setIsPlaying(false);
        // Don't set isAudioLoading false here, could be a pause due to buffering ('waiting' might follow)
        // If autoplay was in progress, stop it on manual pause.
        if (isAutoplaying) {
            console.log("Autoplay stopped due to manual pause.");
            setIsAutoplaying(false);
        }
      };

       const handleLoadStart = () => {
           console.log("Audio loadstart event.");
           // Set loading true whenever a new source starts loading,
           // but only if play was intended or autoplay is active.
           if (isPlaying || isAutoplaying) {
                setIsAudioLoading(true);
           } else {
               // If not intending to play, just note that loading started, but don't show spinner yet.
               console.log("Loadstart detected, but not showing loader as play wasn't intended.");
           }
       };

        const handleLoadedMetadata = () => {
            console.log("Audio loadedmetadata event. Duration:", audioElement.duration);
            // Metadata loaded, but might still need more data. Don't change loading state yet.
        };

        const handleLoadedData = () => {
            console.log("Audio loadeddata event.");
            // Enough data loaded to potentially start playing soon.
             // If autoplaying, try playing now that some data is loaded
            if (isAutoplaying && audioRef.current && !audioRef.current.paused) {
                console.log("Autoplay: 'loadeddata' received, attempting play...");
                audioRef.current.play().catch(err => {
                    console.error("Autoplay: Error during play attempt after 'loadeddata':", err);
                    // Error listener should handle this
                });
            }
        };

        // Attach listeners
        audioElement.addEventListener('ended', handleAudioEnd);
        audioElement.addEventListener('error', handleAudioError);
        audioElement.addEventListener('canplay', handleCanPlay);
        audioElement.addEventListener('waiting', handleWaiting);
        audioElement.addEventListener('playing', handlePlaying);
        audioElement.addEventListener('pause', handlePause);
        audioElement.addEventListener('loadstart', handleLoadStart);
        audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        audioElement.addEventListener('loadeddata', handleLoadedData);


    return () => {
      // Cleanup audio element and listeners on unmount
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
        audioElement.removeEventListener('loadeddata', handleLoadedData);
        audioElement.pause();
        audioElement.removeAttribute('src'); // Remove src attribute
        audioElement.load(); // Abort pending loads and reset state
        // audioRef.current = null; // We don't nullify ref here, React handles it.
      }
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
      console.log("Available Moshafs for selected reciter:", moshafs.map(m => ({id: m.id, name: m.name, server: m.server}))); // Log key details

      if (moshafs.length > 0) {
        // Prioritize 'مرتل' if available, otherwise take the first
        const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
        const moshafToSelect = murattalMoshaf || moshafs[0];
        console.log("Auto-selecting Moshaf:", {id: moshafToSelect.id, name: moshafToSelect.name, server: moshafToSelect.server});

        // Only update if the selected Moshaf is different or not set yet
        // Compare relevant fields like id and server
        if (!selectedMoshaf || selectedMoshaf.id !== moshafToSelect.id || selectedMoshaf.server !== moshafToSelect.server) {
           console.log("Setting selected Moshaf state.");
          setSelectedMoshaf(moshafToSelect);
          // We will prepare the source in a separate effect triggered by moshaf change.
          // Avoid pausing/clearing here directly.
        } else {
           console.log("Selected Moshaf is already the correct one, no state change needed.");
        }
      } else {
        console.log("No Moshafs available for this reciter. Resetting selection.");
        if (selectedMoshaf) { // Only reset if it was previously set
          setSelectedMoshaf(undefined);
          // Source clearing will be handled by the source preparation effect
        }
         if(!isLoadingReciters) { // Avoid toast if data is still loading
            toast({
              title: "تنبيه",
              description: "لا توجد مصاحف متاحة لهذا القارئ.",
              variant: "default",
            });
        }
      }
    } else if (!isLoadingReciters && selectedReciterId && !recitersData?.reciters) {
        // Handle case where reciter ID is selected but data failed to load
        console.error("Reciter selected, but reciters data is unavailable.");
         toast({
              title: "خطأ",
              description: "فشل في تحميل بيانات القراء.",
              variant: "destructive",
         });
         setSelectedMoshaf(undefined); // Reset moshaf if data failed
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReciterId, recitersData, toast, isLoadingReciters]); // Removed selectedAudioSurah dependency

  // Prepare audio source function (DOES NOT PLAY)
  // Returns true if source was set/updated, false otherwise.
   const prepareAudioSource = React.useCallback((forceLoad: boolean = false): boolean => {
       console.log("Attempting to prepare audio source...");
       console.log("Current state:", { reciterId: selectedReciterId, moshaf: selectedMoshaf?.id, surah: selectedAudioSurah, currentSrc: audioRef.current?.src, isPlaying, isAudioLoading });

       if (!audioRef.current) {
           console.error("prepareAudioSource: audioRef is null.");
           return false;
       }

        // Check if selections are missing
       if (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah) {
           console.warn("prepareAudioSource: Cannot prepare audio source: Missing selections (Reciter, Moshaf, or Surah).");
           // If missing selections, clear current source if it exists and is valid
            if (audioRef.current.src && audioRef.current.src !== window.location.href) {
                console.log("Clearing invalid audio source due to missing selections.");
                audioRef.current.pause();
                audioRef.current.removeAttribute('src');
                audioRef.current.load();
                setIsPlaying(false);
                setIsAudioLoading(false);
            }
           return false;
       }

       console.log("Selected Moshaf found:", selectedMoshaf);
        // Validate Moshaf server URL
        if (!selectedMoshaf.server || typeof selectedMoshaf.server !== 'string' || !(selectedMoshaf.server.startsWith('http://') || selectedMoshaf.server.startsWith('https://'))) {
            console.error(`prepareAudioSource: Invalid server URL in selected Moshaf: ${selectedMoshaf.server}`);
            toast({ title: "خطأ", description: `رابط المصحف (${selectedMoshaf.name}) غير صالح أو مفقود.`, variant: "destructive"});
             // Clear existing source if potentially based on invalid Moshaf
            if (audioRef.current.src && audioRef.current.src !== window.location.href) {
                 audioRef.current.pause();
                 audioRef.current.removeAttribute('src');
                 audioRef.current.load();
                 setIsPlaying(false);
                 setIsAudioLoading(false);
            }
            return false;
        }

       try {
           const audioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
           console.log(`Generated audio URL: ${audioUrl}`);

           if (!audioUrl) {
               console.error("prepareAudioSource: Generated audio URL is invalid (empty string).");
                toast({ title: "خطأ", description: "فشل في بناء رابط الصوت.", variant: "destructive"});
                // Clear potentially invalid source
                if (audioRef.current.src && audioRef.current.src !== window.location.href) {
                     audioRef.current.pause();
                     audioRef.current.removeAttribute('src');
                     audioRef.current.load();
                     setIsPlaying(false);
                     setIsAudioLoading(false);
                }
                return false;
           }

           // Check if the source needs updating or if forceLoad is true
           const currentSrc = audioRef.current.src;
           const isSrcSet = currentSrc && currentSrc !== window.location.href; // Check if src is validly set
           const needsUpdate = forceLoad || !isSrcSet || currentSrc !== audioUrl;

           if (needsUpdate) {
                console.log(`Setting new audio source: ${audioUrl} (forceLoad: ${forceLoad}, isSrcSet: ${isSrcSet}, urlMismatch: ${currentSrc !== audioUrl})`);
                audioRef.current.pause(); // Pause before changing source
                setIsPlaying(false); // Update state immediately
                // Let loadstart event handle setting isAudioLoading = true if needed
                audioRef.current.src = audioUrl;
                console.log("Calling audio.load()...");
                audioRef.current.load(); // Explicitly load the new source
                console.log("Audio load initiated.");
                return true; // Source prepared/updated
           } else {
               console.log("Audio source is already correct. No preparation needed.");
                // If source is correct, ensure loading state is false if not playing/autoplay
                if (isAudioLoading && !isPlaying && !isAutoplaying) {
                   setIsAudioLoading(false);
                }
               return true; // Source was already correct
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
           return false; // Source preparation failed
       }
       // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [selectedReciterId, selectedMoshaf, selectedAudioSurah, toast, isPlaying, isAutoplaying, isAudioLoading]); // Added state dependencies


   // Effect to prepare the source when selections change OR on initial load with defaults
   useEffect(() => {
       // Prepare source only if Moshaf is actually selected
       if (selectedMoshaf) {
            console.log("Selection/Moshaf changed, preparing audio source (no force play)...");
            // Prepare source, force load only if src is currently empty or points to the page URL
            const shouldForceLoad = !audioRef.current?.src || audioRef.current.src === window.location.href;
            prepareAudioSource(shouldForceLoad);
       } else {
           console.log("Moshaf not yet selected, skipping source preparation.");
           // If moshaf becomes undefined (e.g., reciter has no moshafs), clear the source
            if (audioRef.current?.src && audioRef.current.src !== window.location.href) {
                console.log("Clearing audio source because Moshaf is undefined.");
                audioRef.current.pause();
                audioRef.current.removeAttribute('src');
                audioRef.current.load();
                setIsPlaying(false);
                setIsAudioLoading(false);
            }
       }
   }, [selectedMoshaf, selectedAudioSurah, prepareAudioSource]); // Trigger when Moshaf or Surah changes

   // Effect to handle autoplay logic when selectedAudioSurah changes *due to autoplay*
  useEffect(() => {
    if (isAutoplaying && audioRef.current && selectedMoshaf && selectedAudioSurah) {
      console.log(`Autoplay: Triggered for Surah ${selectedAudioSurah}`);
      // Force load the new surah source
      const sourcePrepared = prepareAudioSource(true);
      if (sourcePrepared) {
          console.log("Autoplay: Source prepared/preparing, attempting play...");
          setIsAudioLoading(true); // Show loader immediately for autoplay
          // Don't call play() immediately, rely on 'canplay' or 'loadeddata' events to trigger play
          // This avoids race conditions with loading.
          // The play logic is now within handleCanPlay and handleLoadedData
      } else {
        console.error("Autoplay: Failed to prepare source for next surah.");
        setIsAudioLoading(false); // Ensure loading is off if preparation failed
        setIsAutoplaying(false); // Stop autoplay sequence
        toast({
          title: "خطأ في التشغيل التلقائي",
          description: "فشل في تحضير السورة التالية.",
          variant: "destructive",
        });
      }
    } else if (isAutoplaying) {
        console.log("Autoplay: Triggered but conditions not met (missing refs/selections). Aborting.");
        setIsAutoplaying(false); // Reset flag if conditions aren't right
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAudioSurah, isAutoplaying]); // Depend only on these, prepareAudioSource runs via other effects


  // Update audio volume effect
  useEffect(() => {
    if (audioRef.current) {
        const newVolume = isMuted ? 0 : volume / 100;
      audioRef.current.volume = newVolume;
    }
  }, [volume, isMuted]);


  // Play/Pause Handler
  const handlePlayPause = async () => {
    if (!audioRef.current) {
        console.error("Play/Pause clicked but audioRef is null.");
        return;
    }

    console.log(`Play/Pause clicked. Current state: isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}`);

    if (isPlaying) {
      console.log("Pausing audio...");
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

      // Ensure the source is prepared/updated, force load if src is invalid or missing
      const shouldForceLoad = !audioRef.current.src || audioRef.current.src === window.location.href;
      const sourceReady = prepareAudioSource(shouldForceLoad);
      console.log(`Source preparation result: ${sourceReady}`);

      if (sourceReady && audioRef.current.src && audioRef.current.src !== window.location.href) {
        console.log("Source ready or preparing. Attempting play...");
         // Set loading only if the audio isn't already ready to play
         // readyState 4 indicates HAVE_ENOUGH_DATA
         if (audioRef.current.readyState < 4) {
            setIsAudioLoading(true);
         }
        try {
           console.log("Audio state is paused or ended, calling play()...");
          await audioRef.current.play();
          console.log("play() promise resolved.");
          // 'playing' event listener should set isPlaying = true and isAudioLoading = false
        } catch (error) {
          console.error("Error calling play() explicitly:", error);
          // Error is primarily handled by the 'error' event listener now
           // Reset state here as a fallback
           setIsPlaying(false);
           setIsAudioLoading(false);
           setIsAutoplaying(false); // Ensure autoplay stops on error
           // Log the specific error name
            if (error instanceof DOMException) {
                console.error(`DOMException during play: ${error.name} - ${error.message}`);
                // Avoid duplicate toast if handled by the error listener
                if (error.name !== 'NotSupportedError' && error.name !== 'AbortError') { // AbortError might happen if we change source quickly
                    toast({ title: "خطأ في التشغيل", description: `لم يتمكن من بدء تشغيل الصوت. (${error.name})`, variant: "destructive" });
                }
            } else {
                 toast({ title: "خطأ في التشغيل", description: `لم يتمكن من بدء تشغيل الصوت. (${(error as Error).message})`, variant: "destructive" });
            }
        }
      } else {
           console.error("Play clicked, but source is not ready or src is empty/invalid.");
           setIsAudioLoading(false); // Ensure loading is off if we can't even attempt play
           if (!sourceReady) {
                // prepareAudioSource likely showed a toast
           } else if (!audioRef.current.src || audioRef.current.src === window.location.href) {
                toast({ title: "خطأ", description: "لم يتم تحميل مصدر الصوت بشكل صحيح.", variant: "destructive"});
           }
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
       // If unmuting and volume is 0, set volume to a default (e.g., 10)
       if (!newMutedState && volume === 0) {
            console.log("Unmuting with 0 volume, setting volume to 10.");
            setVolume(10);
       }
  };

   // Determine if the play button should be disabled
   const isPlayDisabled = !selectedReciterId || !selectedMoshaf || !selectedAudioSurah || isAudioLoading;

   // Get selected reciter name for display (optional)
    const selectedReciterName = recitersData?.reciters.find(r => r.id.toString() === selectedReciterId)?.name;

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
         {/* Sidebar Trigger on Mobile */}
         {isMobile && <SidebarTrigger icon={Menu} />} {/* Use Menu icon for mobile trigger */}

         {/* Selectors container */}
         <div className="flex items-center gap-2 ml-auto md:ml-0"> {/* Adjust margins */}
             {/* Reciter Selector */}
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
                    // Reset moshaf selection first to ensure the effect runs correctly
                    // Setting moshaf to undefined triggers the useEffect to find the new one
                    setSelectedMoshaf(undefined);
                    setSelectedReciterId(value);
                    setIsAutoplaying(false); // Stop autoplay on manual change
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

              {/* Surah Selector */}
              <Select value={selectedAudioSurah} onValueChange={(value) => {
                 console.log("Selected Audio Surah changed:", value);
                 setSelectedAudioSurah(value);
                 setIsAutoplaying(false); // Stop autoplay when manually changing Surah
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

      {/* Audio Controls and Dialog (Right side for RTL) */}
       <div className="flex items-center gap-2">

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
               <p className="font-cairo">{isAudioLoading ? 'جاري التحميل...' : (isPlaying ? 'إيقاف مؤقت' : 'تشغيل')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Volume Controls */}
        <div className="flex items-center gap-2 w-32">
          <Slider
            dir="ltr" // LTR for visual volume slider makes more sense generally
            value={[isMuted ? 0 : volume]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className="w-full cursor-pointer"
            aria-label="التحكم في مستوى الصوت"
            //disabled={isMuted} // Keep slider enabled, just show 0 when muted
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


        {/* Sources Dialog Trigger */}
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
             <div className="space-y-2 text-right"> {/* Added text-right */}
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
