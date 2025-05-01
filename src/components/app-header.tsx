
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMobile } = useSidebar();
  const { toast } = useToast();
  const lastErrorRef = useRef<string | null>(null);

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
  const handleAudioEnd = useCallback(() => {
    console.log("Audio ended.");
    setIsPlaying(false);
    setIsAudioLoading(false);

    // Autoplay next surah
    if (selectedAudioSurah) {
      const currentSurahId = parseInt(selectedAudioSurah, 10);
      if (!isNaN(currentSurahId) && currentSurahId < 114) {
        const nextSurahId = currentSurahId + 1;
        console.log(`Autoplay: Setting next surah to ${nextSurahId}`);
        setSelectedAudioSurah(nextSurahId.toString());
        // The change in selectedAudioSurah will trigger the URL update effect
        // The URL update effect will trigger the source load effect
        // The source load effect will auto-play if appropriate
      } else {
        console.log("Autoplay: Reached last surah or current ID invalid.");
      }
    } else {
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
          errorMessage = `حدث خطأ أثناء تحميل بيانات الصوت الأولية.`;
          console.error(`Audio Error: NETWORK_LOADING and readyState < 2 for src: ${target.currentSrc}`);
      } else if (target.networkState === HTMLMediaElement.NETWORK_IDLE && target.readyState === HTMLMediaElement.HAVE_NOTHING && !target.currentSrc) {
            // This often happens when src is unset or invalid initially
            errorMessage = `لم يتم تحميل أي مصدر صوت.`;
            console.warn("Audio Error: NETWORK_IDLE and HAVE_NOTHING, no source set.");
            // Don't show a toast for this common initial state unless a load was attempted
            if(isAudioLoading) showToast("خطأ في الصوت", errorMessage, "destructive");
       } else {
         console.error("Audio error occurred but MediaError object is null or state is unusual. Source:", target.src, "ReadyState:", target.readyState, "NetworkState:", target.networkState);
         errorMessage = `حدث خطأ غير متوقع مع مصدر الصوت.`;
         showToast("خطأ في الصوت", errorMessage, "destructive");
      }


       if (errorMessage !== `لم يتم تحميل أي مصدر صوت.`) { // Avoid toast for initial empty state
           showToast("خطأ في الصوت", errorMessage, "destructive");
       }


      setIsPlaying(false);
      setIsAudioLoading(false);
  }, [showToast, isAudioLoading]); // Added isAudioLoading dependency


  const handleCanPlay = useCallback(() => {
    console.log("Audio canplay.");
    if (isAudioLoading) {
      setIsAudioLoading(false);
    }
    // If playback was intended (isPlaying was true), start playing now
    if (isPlaying && audioRef.current && audioRef.current.paused) {
      console.log("Canplay: Attempting to resume intended playback.");
      audioRef.current.play().catch(err => {
        console.error("Error resuming playback on canplay:", err);
        handleAudioError(new Event('error')); // Simulate error event
      });
    }
  }, [isAudioLoading, isPlaying, handleAudioError]); // Added isPlaying


  const handleWaiting = useCallback(() => {
    console.log("Audio waiting (buffering)...");
    if (!isAudioLoading) {
      setIsAudioLoading(true);
    }
  }, [isAudioLoading]);

  const handlePlaying = useCallback(() => {
    console.log("Audio playing.");
    if (isAudioLoading) {
      setIsAudioLoading(false);
    }
    if (!isPlaying) { // Should ideally be true already, but ensures consistency
        setIsPlaying(true);
    }
  }, [isAudioLoading, isPlaying]);

  const handlePause = useCallback(() => {
     const audio = audioRef.current;
     // Ignore pause events during seeking or when audio has ended naturally
     if (audio && !audio.seeking && !audio.ended) {
       console.log("Audio paused.");
       if (isPlaying) { // Only change state if it was playing
         setIsPlaying(false);
       }
        if (isAudioLoading) { // Stop loading indicator on explicit pause
            setIsAudioLoading(false);
        }
     } else {
        console.log("Pause event ignored (seeking/ended/null).");
     }
  }, [isPlaying, isAudioLoading]);

   const handleLoadStart = useCallback(() => {
        console.log("Audio loadstart event.");
        // Show loader *only* if playback is currently intended (isPlaying is true)
        // and we aren't already loading or playing.
        if (isPlaying && !isAudioLoading && audioRef.current?.paused) {
            console.log("Loadstart: Play intended, setting loading true.");
            setIsAudioLoading(true);
        } else {
             console.log(`Loadstart: Detected, state unchanged (isPlaying: ${isPlaying}, isAudioLoading: ${isAudioLoading}).`);
        }
    }, [isPlaying, isAudioLoading]); // Depend on isPlaying

    const handleStalled = useCallback(() => {
        console.warn("Audio stalled event.");
        // If stalled during intended playback, show loader
        if (isPlaying && !isAudioLoading) {
            setIsAudioLoading(true);
        }
    }, [isPlaying, isAudioLoading]); // Depend on isPlaying


  // --- Effects ---

  // Initialize Audio Element & Attach Listeners
  useEffect(() => {
    console.log("Initializing audio element...");
    const audioElement = new Audio();
    audioElement.preload = 'metadata'; // Preload only metadata initially
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
          currentAudio.removeAttribute('src'); // Release resource
          currentAudio.load(); // Reset element state
        } catch (e) {
          console.warn("Error during audio cleanup:", e);
        }
        audioRef.current = null;
      }
    };
    // Re-run only if handlers change (should be stable due to useCallback)
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
                // Reset playing state when reciter/moshaf changes
                 if (isPlaying) {
                     setIsPlaying(false);
                     setIsAudioLoading(false); // Ensure loader stops
                     // Audio pause will be handled by src change or explicit pause call
                 }
            } else {
                console.log("Selected Moshaf is already the correct one.");
            }
        } else {
            console.log("No Moshafs available for this reciter. Resetting selection.");
            setSelectedMoshaf(undefined);
            if (isPlaying) {
                setIsPlaying(false);
                setIsAudioLoading(false);
            }
            if (!isLoadingReciters) {
                showToast("تنبيه", "لا توجد مصاحف متاحة لهذا القارئ.");
            }
        }
    } else if (!isLoadingReciters && selectedReciterId && !recitersData?.reciters?.length) {
        console.error("Reciter selected, but reciters data is unavailable.");
        setSelectedMoshaf(undefined); // Reset moshaf if data failed
         if (isPlaying) {
             setIsPlaying(false);
             setIsAudioLoading(false);
         }
    }
   }, [selectedReciterId, recitersData, isLoadingReciters, selectedMoshaf, isPlaying, showToast]); // Add isPlaying


  // Effect to generate the audio URL when selections change
  useEffect(() => {
    console.log("Checking selections to generate URL...");
    if (selectedMoshaf && selectedAudioSurah) {
      try {
        const url = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
        console.log(`Generated URL: ${url}`);
        if (url && url !== currentAudioUrl) {
          console.log("Setting new currentAudioUrl state.");
          setCurrentAudioUrl(url);
          // Stop playback if the URL changes
           if (isPlaying) {
               setIsPlaying(false); // Stop playback intent
               setIsAudioLoading(false); // Ensure loader stops
               audioRef.current?.pause(); // Explicitly pause if URL changes mid-play
           }
        } else if (!url) {
             console.warn("Generated URL is invalid, clearing currentAudioUrl.");
             setCurrentAudioUrl(null);
             if (isPlaying) {
                 setIsPlaying(false);
                 setIsAudioLoading(false);
             }
        } else {
            console.log("Generated URL is the same as current, no URL state change.");
        }
      } catch (error) {
        console.error("Error generating audio URL:", error);
        showToast("خطأ", `فشل في بناء رابط الصوت: ${(error as Error).message}`, "destructive");
        setCurrentAudioUrl(null);
         if (isPlaying) {
             setIsPlaying(false);
             setIsAudioLoading(false);
         }
      }
    } else {
      console.log("Moshaf or Surah not selected, clearing currentAudioUrl.");
      setCurrentAudioUrl(null);
       if (isPlaying) {
           setIsPlaying(false);
           setIsAudioLoading(false);
       }
    }
    // Dependency on the actual selections
  }, [selectedMoshaf, selectedAudioSurah, isPlaying, currentAudioUrl, showToast]); // Added isPlaying, currentAudioUrl


   // Effect to load the audio source when the URL changes
   useEffect(() => {
       const audio = audioRef.current;
       if (!audio) {
           console.error("Load Effect: Audio element not ready.");
           return;
       }

       const currentSrc = audio.currentSrc; // Get the actual current source

       console.log(`Load Effect: currentAudioUrl='${currentAudioUrl}', currentSrc='${currentSrc}', readyState=${audio.readyState}`);

       if (currentAudioUrl && currentAudioUrl !== currentSrc) {
           console.log(`Load Effect: Setting new src: ${currentAudioUrl}`);
           audio.src = currentAudioUrl;
           console.log("Load Effect: Calling audio.load()...");
           setIsAudioLoading(true); // Show loading indicator immediately when changing src
           setIsPlaying(false); // Reset playing state until 'canplay' or 'playing'
           try {
             audio.load();
           } catch (e) {
             console.error("Error calling load():", e);
             handleAudioError(new Event('error')); // Simulate error
           }
       } else if (!currentAudioUrl && currentSrc) {
           console.log("Load Effect: Clearing src attribute.");
           audio.removeAttribute('src');
            setIsPlaying(false);
            setIsAudioLoading(false);
           try {
               audio.load(); // Reset the audio element state
           } catch (e) {
                console.warn("Error calling load() after clearing src:", e);
           }
       } else if (currentAudioUrl && currentAudioUrl === currentSrc) {
           console.log("Load Effect: Source already set correctly.");
           // If URL is correct but not loading/playing, ensure loading is false
           if (isAudioLoading && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
              setIsAudioLoading(false);
           }
       } else {
            console.log("Load Effect: No URL and no current source, nothing to do.");
             if (isAudioLoading) setIsAudioLoading(false); // Ensure loading stops if URL becomes null
             if (isPlaying) setIsPlaying(false);
       }
   }, [currentAudioUrl, handleAudioError, isAudioLoading, isPlaying]); // Added isAudioLoading, isPlaying


  // Effect to handle play/pause based on isPlaying state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log(`Play/Pause Effect: isPlaying=${isPlaying}, paused=${audio.paused}, loading=${isAudioLoading}, readyState=${audio.readyState}, currentSrc='${audio.currentSrc}'`);

    if (isPlaying) {
      if (audio.paused) {
         // Only play if we have a valid source and are not in an error state
         if (audio.currentSrc && audio.networkState !== HTMLMediaElement.NETWORK_NO_SOURCE && audio.readyState >= HTMLMediaElement.HAVE_NOTHING) {
             console.log("Play/Pause Effect: Attempting to play...");
             if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA && !isAudioLoading) {
                // Show loader if we intend to play but data isn't ready
                console.log("Play/Pause Effect: Buffering needed, setting loading true.");
                setIsAudioLoading(true);
             }
              audio.play().catch(err => {
                console.error("Error calling play():", err);
                handleAudioError(new Event('error')); // Simulate error event
                setIsPlaying(false); // Reset state on play error
                setIsAudioLoading(false);
              });
          } else {
             console.warn("Play/Pause Effect: Cannot play - No valid source or network error state.");
             setIsPlaying(false); // Reset state if play is impossible
             setIsAudioLoading(false);
             if (!audio.currentSrc && currentAudioUrl) {
                // If URL is set but src isn't, maybe load didn't trigger? Retry load.
                console.log("Play/Pause Effect: Retrying load due to missing src.");
                audio.load();
             } else if (!currentAudioUrl) {
                showToast("تنبيه", "الرجاء اختيار القارئ والسورة أولاً.");
             }
          }
      } else {
          console.log("Play/Pause Effect: Already playing.");
          // Ensure loading is false if playing starts
           if (isAudioLoading && audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
               setIsAudioLoading(false);
           }
      }
    } else { // isPlaying is false
      if (!audio.paused) {
        console.log("Play/Pause Effect: Pausing audio...");
        audio.pause(); // The 'pause' event handler will manage state
      } else {
         console.log("Play/Pause Effect: Already paused.");
         // If paused externally while loading, stop the loading indicator
          if (isAudioLoading) {
              setIsAudioLoading(false);
          }
      }
    }
  }, [isPlaying, isAudioLoading, currentAudioUrl, handleAudioError, showToast]); // Add dependencies


  // Update audio volume effect
  useEffect(() => {
    if (audioRef.current) {
      const newVolume = isMuted ? 0 : volume / 100;
      audioRef.current.volume = newVolume;
    }
  }, [volume, isMuted]);


  // --- UI Event Handlers ---

  const handlePlayPause = () => {
    console.log(`Play/Pause clicked. Current state: isPlaying=${isPlaying}, isAudioLoading=${isAudioLoading}, currentAudioUrl=${currentAudioUrl}`);

    if (!currentAudioUrl) {
      showToast("تنبيه", "الرجاء اختيار القارئ والسورة أولاً.");
      return;
    }

    // Toggle the desired state. The useEffect hook will handle the actual play/pause.
    setIsPlaying(prevIsPlaying => !prevIsPlaying);
  };

   const handleReciterChange = (value: string) => {
     console.log("Selected Reciter changed:", value);
     // Stop playback *before* changing selections
     if (isPlaying) {
       setIsPlaying(false);
       audioRef.current?.pause();
     }
     setSelectedReciterId(value);
     // Moshaf selection and URL update will follow in effects
   };

   const handleSurahChange = (value: string) => {
     console.log("Selected Audio Surah changed:", value);
      // Stop playback *before* changing selections
     if (isPlaying) {
       setIsPlaying(false);
       audioRef.current?.pause();
     }
     setSelectedAudioSurah(value);
     // URL update will follow in effects
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
  const isPlayDisabled = (!selectedReciterId || !selectedMoshaf || !selectedAudioSurah || isLoadingReciters || !currentAudioUrl);


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
