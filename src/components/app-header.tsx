
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
  const [selectedReciterId, setSelectedReciterId] = useState<string | undefined>('37'); // Default to Fares Abbad (ID 37)
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string | undefined>('1'); // Default to Al-Fatiha (ID 1)
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


  // Effect to handle autoplay logic when selectedAudioSurah changes due to autoplay
  useEffect(() => {
    if (isAutoplaying && audioRef.current && selectedAudioSurah) {
      console.log(`Autoplay: Attempting to play Surah ${selectedAudioSurah}`);
      const sourceReady = prepareAudioSource(true); // Force load for autoplay
      if (sourceReady) {
        console.log("Autoplay: Source prepared/preparing, attempting play...");
        setIsAudioLoading(true); // Set loading to true
        audioRef.current.play().catch(err => {
          console.error("Autoplay: Error playing next surah:", err);
          setIsPlaying(false);
          setIsAudioLoading(false);
          setIsAutoplaying(false); // Reset autoplay flag on error
          toast({
            title: "خطأ في التشغيل التلقائي",
            description: "لم يتمكن من تشغيل السورة التالية تلقائيًا.",
            variant: "destructive",
          });
        });
      } else {
        console.error("Autoplay: Failed to prepare source for next surah.");
        setIsAudioLoading(false);
        setIsAutoplaying(false);
        toast({
          title: "خطأ في التشغيل التلقائي",
          description: "فشل في تحضير السورة التالية.",
          variant: "destructive",
        });
      }
      // Do NOT reset isAutoplaying here; let the playing/ended/error events handle it
    }
  }, [selectedAudioSurah, isAutoplaying, toast]); // Dependencies include selectedAudioSurah and isAutoplaying


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
        setIsAutoplaying(true); // Set flag to trigger useEffect for autoplay
        setSelectedAudioSurah(nextSurahId.toString());
        // The useEffect hook watching selectedAudioSurah and isAutoplaying will handle the actual playback
      } else {
        console.log("Autoplay: Reached last surah or current surah ID invalid.");
        // Optionally, stop playback or loop back to Surah 1
      }
    } else {
        console.log("Autoplay: No current surah selected, cannot autoplay.");
    }
  };


  useEffect(() => {
    // Create audio element only on the client side
    console.log("Initializing audio element...");
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata'; // Preload metadata only

    // Add event listener for when audio ends
    const handleAudioError = (e: Event) => {
        console.error("Audio error event:", e);
        const target = e.target as HTMLAudioElement;
        const error = target.error;
        let errorMessage = "حدث خطأ غير معروف أثناء محاولة تشغيل الصوت.";
        if (error) {
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
                    errorMessage = `مصدر الصوت (${target.src}) غير مدعوم أو لا يمكن العثور عليه.`;
                    break;
                default:
                    errorMessage = `حدث خطأ غير معروف (الكود: ${error.code}).`;
            }
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
         // Only set loading to false if we were actually trying to play/load
         // If autoplaying, play() was likely called, let 'playing' event handle state
         // If manually playing, play() was called, let 'playing' handle state
         // If just loading source, we can set loading to false.
         if (isAudioLoading && !isPlaying && !isAutoplaying) {
            setIsAudioLoading(false);
         }
         // If autoplaying, don't set loading false here, wait for 'playing'
     };

     const handleWaiting = () => {
         console.log("Audio waiting event (buffering)...");
         // Only set loading if we are actually trying to play or actively loading
          if (isPlaying || isAutoplaying) {
            setIsAudioLoading(true);
          }
     };

      const handlePlaying = () => {
          console.log("Audio playing event.");
          setIsAudioLoading(false); // Should be loaded if playing starts
          setIsPlaying(true); // Ensure playing state is true
          setIsAutoplaying(false); // Reset autoplay flag once playing starts
      };

      const handlePause = () => {
        console.log("Audio pause event.");
        setIsPlaying(false);
        // Don't set loading false here, might be paused due to buffering (waiting event follows)
        // Only set loading false if it wasn't buffering before pause.
        // If (isAudioLoading) { /* maybe don't change */ } else { setIsAudioLoading(false); } - difficult logic, rely on other events
        setIsAutoplaying(false); // Stop autoplay if manually paused
      };

       const handleLoadStart = () => {
           console.log("Audio loadstart event.");
           // Indicate loading ONLY if we intend to play or are autoplaying
            if (isPlaying || isAutoplaying) {
              setIsAudioLoading(true);
            }
       };

        const handleLoadedMetadata = () => {
            console.log("Audio loadedmetadata event.");
            // Metadata loaded, might still be buffering. Don't change loading state here.
        };

        const handleLoadedData = () => {
            console.log("Audio loadeddata event.");
            // Enough data loaded to start playing (maybe). Don't change loading state here.
        };


    audioRef.current.addEventListener('ended', handleAudioEnd);
    audioRef.current.addEventListener('error', handleAudioError);
    audioRef.current.addEventListener('canplay', handleCanPlay);
    audioRef.current.addEventListener('waiting', handleWaiting);
    audioRef.current.addEventListener('playing', handlePlaying);
    audioRef.current.addEventListener('pause', handlePause);
    audioRef.current.addEventListener('loadstart', handleLoadStart); // Added
    audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata); // Added
    audioRef.current.addEventListener('loadeddata', handleLoadedData); // Added


    return () => {
      // Cleanup audio element and listeners on unmount
      console.log("Cleaning up audio element...");
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnd);
        audioRef.current.removeEventListener('error', handleAudioError);
        audioRef.current.removeEventListener('canplay', handleCanPlay);
        audioRef.current.removeEventListener('waiting', handleWaiting);
        audioRef.current.removeEventListener('playing', handlePlaying);
        audioRef.current.removeEventListener('pause', handlePause);
        audioRef.current.removeEventListener('loadstart', handleLoadStart); // Added
        audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata); // Added
        audioRef.current.removeEventListener('loadeddata', handleLoadedData); // Added
        audioRef.current.pause();
        audioRef.current.src = ''; // Clear src
        audioRef.current.removeAttribute('src'); // Fully remove source attribute
        // audioRef.current.load(); // Abort current/pending network requests - might not be needed with null assignment
        audioRef.current = null;
      }
    };
  }, [toast]); // Add toast dependency


  // Update selectedMoshaf when selectedReciterId or recitersData changes
  useEffect(() => {
    console.log("Reciter ID changed or data loaded:", selectedReciterId);
    if (selectedReciterId && recitersData?.reciters) {
      const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
      const moshafs = reciter?.moshaf ?? [];
      console.log("Available Moshafs for selected reciter:", moshafs);
      if (moshafs.length > 0) {
        // Prioritize 'مرتل' if available, otherwise take the first
        const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
        const moshafToSelect = murattalMoshaf || moshafs[0];
        console.log("Auto-selecting Moshaf:", moshafToSelect);
        // Only update if the selected Moshaf is different or not set yet
        if (selectedMoshaf?.id !== moshafToSelect.id || selectedMoshaf?.server !== moshafToSelect.server) {
           console.log("Setting selected Moshaf state.");
          setSelectedMoshaf(moshafToSelect);
           // Reset audio state when moshaf changes (implicitly due to reciter change) only if audio was playing
            if (isPlaying && audioRef.current) {
                console.log("Pausing audio due to reciter/moshaf change.");
                audioRef.current.pause();
                // State updates handled by 'pause' event listener
            } else if (audioRef.current) {
                // Clear the source if paused/stopped and reciter changes
                 console.log("Clearing audio source due to reciter/moshaf change while paused.");
                 audioRef.current.src = '';
                 setIsAudioLoading(false); // Ensure loading is false
            }
        } else {
           console.log("Selected Moshaf is already correct, no state change needed.");
        }
      } else {
        console.log("No Moshafs available for this reciter.");
        if (selectedMoshaf) { // Only reset if it was previously set
           console.log("Resetting selected Moshaf state.");
          setSelectedMoshaf(undefined);
          if (isPlaying && audioRef.current) {
             console.log("Pausing audio due to lack of moshaf.");
             audioRef.current.pause();
          } else if (audioRef.current) {
             console.log("Clearing audio source due to lack of moshaf.");
             audioRef.current.src = '';
             setIsAudioLoading(false);
          }
        }
        // Avoid redundant toast if loading
        if(!isLoadingReciters) {
            toast({
              title: "تنبيه",
              description: "لا توجد مصاحف متاحة لهذا القارئ.",
              variant: "default",
            });
        }
      }
    } else if (!isLoadingReciters) { // Only log/reset if not loading
      console.log("No reciter selected or data not loaded, clearing selected Moshaf.");
      if (selectedMoshaf) { // Only reset if it was previously set
         console.log("Resetting selected Moshaf state.");
        setSelectedMoshaf(undefined);
         if (isPlaying && audioRef.current) {
             console.log("Pausing audio due to cleared reciter.");
             audioRef.current.pause();
          } else if (audioRef.current) {
              console.log("Clearing audio source due to cleared reciter.");
             audioRef.current.src = '';
             setIsAudioLoading(false);
          }
      }
    }
  }, [selectedReciterId, recitersData, toast, isPlaying, selectedMoshaf, isLoadingReciters]); // Added selectedMoshaf and isLoadingReciters


  // Update audio volume
  useEffect(() => {
    if (audioRef.current) {
        const newVolume = isMuted ? 0 : volume / 100;
        // console.log(`Setting audio volume to: ${newVolume} (muted: ${isMuted})`); // Less verbose log
      audioRef.current.volume = newVolume;
    }
  }, [volume, isMuted]);


  // Prepare audio source (called before play or when selections change)
   const prepareAudioSource = (forceLoad: boolean = false) => {
       console.log("Attempting to prepare audio source...");
       console.log("Current selections:", { selectedReciterId, selectedMoshaf, selectedAudioSurah });
       if (audioRef.current && selectedReciterId && selectedMoshaf && selectedAudioSurah) {
           console.log("Selected Moshaf found:", selectedMoshaf);
           try {
              const audioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
               console.log(`Generated audio URL: ${audioUrl}`);
               // Check if the source needs updating or if forceLoad is true
               if (forceLoad || !audioRef.current.src || audioRef.current.src !== audioUrl) {
                    console.log(`Setting new audio source: ${audioUrl}`);
                    // Reset state before loading new source
                    if (isPlaying) setIsPlaying(false); // Update state immediately if it was playing
                    // Set loading state immediately when changing source
                    // No need to set to false here, let events handle it
                    setIsAudioLoading(true);
                    audioRef.current.src = audioUrl;
                    console.log("Calling audio.load()...");
                    audioRef.current.load(); // Explicitly load the new source
                    console.log("Audio load initiated.");
                    return true; // Source prepared
               }
               console.log("Audio source is already correct.");
               // If source is correct, but we are not loading/playing, ensure loading is false
                if (!isPlaying && isAudioLoading && !isAutoplaying) { // Check if it was loading unnecessarily
                    console.log("Source correct, clearing unnecessary loading state.");
                   setIsAudioLoading(false);
                }
               return true; // Source is already correct
           } catch (error) {
              console.error("Error preparing audio source:", error);
              toast({
                  title: "خطأ في إعداد الصوت",
                  description: (error as Error).message || "حدث خطأ أثناء تحضير رابط الصوت.",
                  variant: "destructive",
              });
               setIsAudioLoading(false);
               setIsAutoplaying(false);
              return false; // Source preparation failed
           }
       } else {
            console.warn("Cannot prepare audio source: Missing selections, Moshaf, or audioRef not ready.");
            if (!selectedReciterId || !selectedAudioSurah) {
                 // Don't toast if just selections are missing, handle via button disable
            } else if (!selectedMoshaf && recitersData?.reciters.find(r => r.id.toString() === selectedReciterId)?.moshaf.length === 0) {
                // Toast only if reciter is selected but no valid moshaf found (and data is loaded)
                 // toast({ title: "تنبيه", description: "لم يتم العثور على مصحف متاح لهذا القارئ.", variant: "default" }); // Already handled in effect
            }
            setIsAudioLoading(false);
            setIsAutoplaying(false);
            return false; // Not enough info to prepare source
       }
   };

   // Effect to prepare source when selections change (but don't play automatically)
    useEffect(() => {
        // Prepare source but don't force load unless necessary (e.g., if src is empty)
         console.log("Selection changed, preparing audio source (no force load)...");
        prepareAudioSource(!audioRef.current?.src);
    }, [selectedReciterId, selectedMoshaf, selectedAudioSurah]); // Keep dependencies


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
            description: "الرجاء اختيار القارئ والسورة الصوتية أولاً.",
            variant: "default",
        });
        return;
      }

      // Prepare the source again, force loading if necessary (e.g., URL might be same but load failed before)
      const sourceReady = prepareAudioSource(true); // Force load on explicit play attempt
      console.log(`Source preparation result: ${sourceReady}`);

      if (sourceReady && audioRef.current.src) {
        console.log("Source ready or preparing. Attempting play...");
        setIsAudioLoading(true); // Assume loading until 'canplay' or 'playing'
        try {
          // Check if audio is already playing (e.g., from auto-play after load)
           if (audioRef.current.paused) {
                console.log("Audio is paused, calling play()...");
                await audioRef.current.play();
                console.log("play() promise resolved.");
                // State will be updated by 'playing' event listener
           } else {
               console.log("Audio is already playing or will play automatically.");
               // If it's already playing, ensure state reflects this
               // setIsPlaying(true); // Let 'playing' event handle this
               // setIsAudioLoading(false);
           }
        } catch (error) {
          console.error("Error calling play() explicitly:", error);
          // Error handling is now mainly done by the 'error' event listener
           setIsPlaying(false);
           setIsAudioLoading(false); // Reset loading state on explicit play error
           setIsAutoplaying(false);
           // Optional: Show toast here as a fallback if the event listener fails
             toast({
                 title: "خطأ في التشغيل",
                 description: "لم يتمكن من بدء تشغيل الصوت.",
                 variant: "destructive",
             });
        }
      } else if (!sourceReady) {
           console.error("Play clicked, but source preparation failed.");
           // Toast should have been shown by prepareAudioSource or other checks
            setIsAudioLoading(false);
            setIsAutoplaying(false);
      } else if (!audioRef.current.src) {
           console.error("Play clicked, source seems ready, but audioRef.current.src is empty.");
           toast({
              title: "خطأ",
              description: "لم يتم تحديد مصدر الصوت بشكل صحيح.",
              variant: "destructive",
           });
            setIsAudioLoading(false);
            setIsAutoplaying(false);
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
         {isMobile && <SidebarTrigger />}

         {/* Selectors moved to the left (start in LTR) for better grouping */}
         <div className="hidden md:flex items-center gap-2">
             {/* Reciter Selector */}
             {isLoadingReciters ? (
                 <Skeleton className="h-10 w-[180px]" />
             ) : recitersError ? (
                 <div className="w-[180px] text-destructive text-xs px-2 py-1 border border-destructive rounded-md text-center font-cairo">
                     {/* @ts-ignore */}
                     {recitersError?.message || 'خطأ في تحميل القراء'}
                 </div>
             ) : (
                 <Select value={selectedReciterId} onValueChange={setSelectedReciterId} dir="rtl">
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
                 // Pause audio when changing Surah only if it was playing
                 if (isPlaying && audioRef.current) {
                     console.log("Pausing audio due to Surah change.");
                     audioRef.current.pause();
                     // State updates handled by 'pause' event listener
                 } else if (audioRef.current) {
                     // If paused or stopped, still prepare the new source without playing
                      console.log("Preparing new source after manual Surah change (no force load).");
                      prepareAudioSource(false); // Prepare source for potential future play, don't force load
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

      {/* Audio Controls and Dialog (Right side for RTL) */}
       <div className="flex items-center gap-2">

        {/* Play/Pause Button */}
         <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
               <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={isPlayDisabled} className="font-cairo">
                 {isAudioLoading ? <Loader2 className="animate-spin" /> : isPlaying ? <Pause /> : <Play />}
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
                  {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="font-cairo">
                    <BookOpen />
                    <span className="sr-only">المصادر والمراجع</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-cairo">المصادر والمراجع</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle className="font-cairo text-right">المصادر والمراجع</DialogTitle>
            </DialogHeader>
            <DialogDescription className="font-cairo text-right space-y-2">
              <p> مصدر واجهة برمجة التطبيقات الصوتية للقرآن الكريم: <a href="https://mp3quran.net/api" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">mp3quran.net</a> </p>
               <p>مصدر بيانات السور والقراء مأخوذ من واجهة برمجة التطبيقات المذكورة أعلاه.</p>
               <p>نصوص القرآن المستخدمة للعرض مأخوذة من ملفات نصية محلية.</p>
               <p>تم بناء هذا التطبيق باستخدام Next.js و Shadcn/UI و Tailwind CSS.</p>
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

    