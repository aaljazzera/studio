
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
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string | undefined>(undefined);
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
      const sourceReady = prepareAudioSource();
      if (sourceReady) {
        console.log("Autoplay: Source prepared, attempting play...");
        setIsAudioLoading(true); // Set loading true
        audioRef.current.play().catch(err => {
          console.error("Autoplay: Error playing next surah:", err);
          setIsPlaying(false);
          setIsAudioLoading(false);
          toast({
            title: "خطأ في التشغيل التلقائي",
            description: "لم يتمكن من تشغيل السورة التالية تلقائيًا.",
            variant: "destructive",
          });
        });
      } else {
        console.error("Autoplay: Failed to prepare source for next surah.");
        toast({
          title: "خطأ في التشغيل التلقائي",
          description: "فشل في تحضير السورة التالية.",
          variant: "destructive",
        });
      }
      setIsAutoplaying(false); // Reset autoplay flag
    }
  }, [selectedAudioSurah, isAutoplaying, toast]); // Dependencies include selectedAudioSurah and isAutoplaying


  // Function to handle audio end event
  const handleAudioEnd = () => {
    console.log("Audio ended.");
    setIsPlaying(false);
    setIsAudioLoading(false);

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
        console.log("Autoplay: Last surah reached or invalid current surah ID.");
        // Optionally, stop playback or loop back to Surah 1
      }
    } else {
        console.log("Autoplay: No current surah selected, cannot autoplay.");
    }
  };


  useEffect(() => {
    // Create audio element only on the client side
    console.log("Initializing Audio element...");
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata'; // Preload metadata only

    // Add event listener for when audio ends
    const handleAudioError = (e: Event) => {
        console.error("Audio playback error event:", e);
        const error = (e.target as HTMLAudioElement).error;
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
                    errorMessage = 'مصدر الصوت غير مدعوم أو لا يمكن العثور عليه.';
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
         console.log("Audio can play.");
         // Only set loading to false if we were actually trying to play/load
         if (isAudioLoading) {
            setIsAudioLoading(false);
             // If it was autoplaying, play should have been called already
             // If manually playing, check if play was intended
             if (audioRef.current && !audioRef.current.paused) {
                 setIsPlaying(true); // Already playing or will play automatically
             }
         }
     };

     const handleWaiting = () => {
         console.log("Audio waiting for data (buffering)...");
         // Only set loading if we are actually trying to play or actively loading
          if (isPlaying || isAutoplaying) {
            setIsAudioLoading(true);
          }
     };

      const handlePlaying = () => {
          console.log("Audio playback started/resumed.");
          setIsAudioLoading(false); // Should be loaded if playing starts
          setIsPlaying(true); // Ensure playing state is true
      };

      const handlePause = () => {
        console.log("Audio paused.");
        setIsPlaying(false);
        setIsAudioLoading(false);
        setIsAutoplaying(false); // Stop autoplay if manually paused
      };


    audioRef.current.addEventListener('ended', handleAudioEnd);
    audioRef.current.addEventListener('error', handleAudioError);
    audioRef.current.addEventListener('canplay', handleCanPlay);
    audioRef.current.addEventListener('waiting', handleWaiting);
    audioRef.current.addEventListener('playing', handlePlaying);
    audioRef.current.addEventListener('pause', handlePause);


    return () => {
      // Cleanup audio element and listeners on unmount
      console.log("Cleaning up Audio element...");
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnd);
        audioRef.current.removeEventListener('error', handleAudioError);
        audioRef.current.removeEventListener('canplay', handleCanPlay);
        audioRef.current.removeEventListener('waiting', handleWaiting);
        audioRef.current.removeEventListener('playing', handlePlaying);
        audioRef.current.removeEventListener('pause', handlePause);
        audioRef.current.pause();
        audioRef.current.src = ''; // Clear src
        audioRef.current.removeAttribute('src'); // Fully remove source attribute
        // audioRef.current.load(); // Abort current/pending network requests - might not be needed with null assignment
        audioRef.current = null;
      }
    };
  }, [toast]); // Add toast dependency


  // Update selectedMoshaf when selectedReciterId changes
  useEffect(() => {
    console.log("Selected Reciter ID changed:", selectedReciterId);
    if (selectedReciterId && recitersData) {
      const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
      const moshafs = reciter?.moshaf ?? [];
      console.log("Available Moshafs for selected reciter:", moshafs);
      if (moshafs.length > 0) {
        // Prioritize 'مرتل' if available, otherwise take the first
        const murattalMoshaf = moshafs.find(m => m.name.includes('مرتل'));
        const moshafToSelect = murattalMoshaf || moshafs[0];
        console.log("Auto-selecting Moshaf:", moshafToSelect);
        setSelectedMoshaf(moshafToSelect);
      } else {
        console.log("No Moshafs available for this reciter.");
        setSelectedMoshaf(undefined); // Reset if no Moshafs
        toast({
          title: "تنبيه",
          description: "لا توجد مصاحف متاحة لهذا القارئ.",
          variant: "default",
        });
      }
    } else {
      console.log("No reciter selected or data not loaded, clearing Moshaf selection.");
      setSelectedMoshaf(undefined);
    }
     // Reset audio state when reciter changes
     if (audioRef.current) {
        console.log("Pausing audio due to reciter change.");
        audioRef.current.pause();
        // State updates handled by 'pause' event listener
        // Optionally clear the source immediately
        // audioRef.current.src = '';
     }
  }, [selectedReciterId, recitersData, toast]);


  // Update audio volume
  useEffect(() => {
    if (audioRef.current) {
        const newVolume = isMuted ? 0 : volume / 100;
        console.log(`Setting audio volume to: ${newVolume} (Muted: ${isMuted})`);
      audioRef.current.volume = newVolume;
    }
  }, [volume, isMuted]);


  // Prepare audio source (called before play)
   const prepareAudioSource = () => {
       console.log("Attempting to prepare audio source...");
       console.log("Current selections:", { selectedReciterId, selectedMoshaf, selectedAudioSurah });
       if (audioRef.current && selectedReciterId && selectedMoshaf && selectedAudioSurah) {
           console.log("Selected Moshaf found:", selectedMoshaf);
           try {
              const audioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
               console.log(`Generated audio URL: ${audioUrl}`);
               // Check if the source needs updating
               if (!audioRef.current.src || audioRef.current.src !== audioUrl) {
                    console.log(`Setting new audio source: ${audioUrl}`);
                    // Reset state before loading new source
                    setIsPlaying(false);
                    setIsAudioLoading(true); // Set loading state before changing source
                    audioRef.current.src = audioUrl;
                    audioRef.current.load(); // Explicitly load the new source
                    console.log("Audio load initiated.");
                    return true; // Source prepared
               }
               console.log("Audio source is already correct.");
               // If source is correct, but we are not loading/playing, ensure loading is false
                if (!isPlaying && !isAudioLoading) {
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
            console.warn("Cannot prepare audio source: Missing selections, Moshaf or audioRef not ready.");
            if (!selectedReciterId || !selectedAudioSurah) {
                 // Don't toast if just selections are missing, handle via button disable
            } else if (!selectedMoshaf) {
                // Toast only if reciter is selected but no valid moshaf found
                 toast({ title: "تنبيه", description: "لم يتم العثور على مصحف متاح لهذا القارئ.", variant: "default" });
            }
            setIsAudioLoading(false);
            setIsAutoplaying(false);
            return false; // Not enough info to prepare source
       }
   };

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

      // Prepare the source if not already set or if it changed
      const sourceReady = prepareAudioSource();
      console.log(`Source preparation result: ${sourceReady}`);

      if (sourceReady && audioRef.current.src) {
        console.log("Source is ready or preparing. Attempting to play...");
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
               setIsPlaying(true);
               setIsAudioLoading(false);
           }
        } catch (error) {
          console.error("Error explicitly calling play():", error);
          // Error handling is now mainly done by the 'error' event listener
           setIsPlaying(false);
           setIsAudioLoading(false); // Reset loading state on explicit play error
           setIsAutoplaying(false);
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
    setVolume(value[0]);
    if (isMuted && value[0] > 0) {
        console.log("Unmuting due to volume change.");
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
      console.log(`Toggling mute. Current state: ${isMuted}`);
    setIsMuted(!isMuted);
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
                     خطأ في تحميل القراء
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
                      prepareAudioSource(); // Prepare source for potential future play
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

    