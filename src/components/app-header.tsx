
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
  Minimize2,
  Maximize2,
  X,
  Loader2, // Import Loader icon
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
  const [selectedReciterId, setSelectedReciterId] = useState<string | undefined>(undefined);
  const [selectedMoshafId, setSelectedMoshafId] = useState<string | undefined>(undefined);
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string | undefined>(undefined);
  const [availableMoshafs, setAvailableMoshafs] = useState<Moshaf[]>([]);
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

  useEffect(() => {
    // Create audio element only on the client side
    console.log("Initializing Audio element...");
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata'; // Preload metadata only

    // Add event listener for when audio ends
    const handleAudioEnd = () => {
        console.log("Audio ended.");
        setIsPlaying(false);
        setIsAudioLoading(false);
    }
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
    };

     const handleCanPlay = () => {
         console.log("Audio can play.");
         // Only set loading to false if we were actually trying to play
         if (isAudioLoading) {
            setIsAudioLoading(false);
            // Attempt to play again if needed (e.g., user clicked play while loading)
             if (audioRef.current && !audioRef.current.paused) {
                // Already playing or will play automatically
             } else if (audioRef.current) {
                // If paused after loading, maybe play was clicked earlier
                 audioRef.current.play().then(() => {
                     setIsPlaying(true);
                     console.log("Playback started after canplay event.");
                 }).catch(err => {
                      console.error("Error playing after canplay:", err);
                      setIsPlaying(false);
                      setIsAudioLoading(false);
                 });
             }
         }
     };

     const handleWaiting = () => {
         console.log("Audio waiting for data (buffering)...");
         setIsAudioLoading(true);
     };

      const handlePlaying = () => {
          console.log("Audio playback started/resumed.");
          setIsAudioLoading(false); // Should be loaded if playing starts
          setIsPlaying(true); // Ensure playing state is true
      };


    audioRef.current.addEventListener('ended', handleAudioEnd);
    audioRef.current.addEventListener('error', handleAudioError);
    audioRef.current.addEventListener('canplay', handleCanPlay);
    audioRef.current.addEventListener('waiting', handleWaiting);
    audioRef.current.addEventListener('playing', handlePlaying);


    return () => {
      // Cleanup audio element and listeners on unmount
      console.log("Cleaning up Audio element...");
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnd);
        audioRef.current.removeEventListener('error', handleAudioError);
        audioRef.current.removeEventListener('canplay', handleCanPlay);
        audioRef.current.removeEventListener('waiting', handleWaiting);
        audioRef.current.removeEventListener('playing', handlePlaying);
        audioRef.current.pause();
        audioRef.current.src = ''; // Clear src
        audioRef.current.removeAttribute('src'); // Fully remove source attribute
        audioRef.current.load(); // Abort current/pending network requests
        audioRef.current = null;
      }
    };
  }, [toast]); // Add toast dependency


  // Update available Moshafs when selectedReciterId changes
  useEffect(() => {
    console.log("Selected Reciter ID changed:", selectedReciterId);
    if (selectedReciterId && recitersData) {
      const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
      const moshafs = reciter?.moshaf ?? [];
      console.log("Available Moshafs for selected reciter:", moshafs);
      setAvailableMoshafs(moshafs);
      // Automatically select the first available Moshaf if only one exists, or reset if none
       if (moshafs.length === 1) {
         console.log("Auto-selecting the only available Moshaf:", moshafs[0].id.toString());
         setSelectedMoshafId(moshafs[0].id.toString());
       } else {
          console.log("Multiple or no Moshafs available, resetting selection.");
         setSelectedMoshafId(undefined); // Reset if multiple or no Moshafs
       }
    } else {
      console.log("No reciter selected or data not loaded, clearing Moshafs.");
      setAvailableMoshafs([]);
      setSelectedMoshafId(undefined);
    }
     // Reset audio state when reciter changes
     if (audioRef.current) {
        console.log("Pausing audio due to reciter change.");
        audioRef.current.pause();
        setIsPlaying(false);
        setIsAudioLoading(false);
        // Optionally clear the source immediately
        // audioRef.current.src = '';
     }
  }, [selectedReciterId, recitersData]);


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
       console.log("Current selections:", { selectedReciterId, selectedMoshafId, selectedAudioSurah });
       console.log("Available Moshafs:", availableMoshafs);
       if (audioRef.current && selectedReciterId && selectedMoshafId && selectedAudioSurah && availableMoshafs.length > 0) {
           const selectedMoshaf = availableMoshafs.find(m => m.id.toString() === selectedMoshafId);
           if (selectedMoshaf) {
               console.log("Selected Moshaf found:", selectedMoshaf);
               try {
                  const audioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
                   console.log(`Generated audio URL: ${audioUrl}`);
                   // Check if the source needs updating
                   if (!audioRef.current.src || audioRef.current.src !== audioUrl) {
                        console.log(`Setting new audio source: ${audioUrl}`);
                        setIsAudioLoading(true); // Set loading state before changing source
                        audioRef.current.src = audioUrl;
                        audioRef.current.load(); // Explicitly load the new source
                        console.log("Audio load initiated.");
                        return true; // Source prepared
                   }
                   console.log("Audio source is already correct.");
                   return true; // Source is already correct
               } catch (error) {
                  console.error("Error preparing audio source:", error);
                  toast({
                      title: "خطأ في إعداد الصوت",
                      description: (error as Error).message || "حدث خطأ أثناء تحضير رابط الصوت.",
                      variant: "destructive",
                  });
                   setIsAudioLoading(false);
                  return false; // Source preparation failed
               }
           } else {
               console.warn("Selected Moshaf not found in availableMoshafs.");
               toast({ title: "خطأ", description: "لم يتم العثور على المصحف المحدد.", variant: "destructive"});
               setIsAudioLoading(false);
                return false;
           }
       } else {
            console.warn("Cannot prepare audio source: Missing selections or audioRef not ready.");
            setIsAudioLoading(false);
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
      setIsPlaying(false);
      setIsAudioLoading(false); // Should not be loading if paused
      console.log("Audio paused.");
    } else {
      console.log("Attempting to play audio...");
      // Ensure selections are made
      if (!selectedReciterId || !selectedMoshafId || !selectedAudioSurah) {
         console.warn("Play clicked, but required selections are missing.");
        toast({
            title: "تنبيه",
            description: "الرجاء اختيار القارئ والمصحف والسورة الصوتية أولاً.",
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
        }
      } else if (!sourceReady) {
           console.error("Play clicked, but source preparation failed.");
           // Toast should have been shown by prepareAudioSource
            setIsAudioLoading(false);
      } else if (!audioRef.current.src) {
           console.error("Play clicked, source seems ready, but audioRef.current.src is empty.");
           toast({
              title: "خطأ",
              description: "لم يتم تحديد مصدر الصوت بشكل صحيح.",
              variant: "destructive",
           });
            setIsAudioLoading(false);
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

  // Placeholder functions for window controls
  const handleMinimize = () => console.log("تصغير");
  const handleMaximize = () => console.log("تكبير/استعادة");
  const handleClose = () => console.log("إغلاق");

   // Determine if the play button should be disabled
   const isPlayDisabled = !selectedReciterId || !selectedMoshafId || !selectedAudioSurah || isAudioLoading;

   // Get selected reciter name for display (optional)
    const selectedReciterName = recitersData?.reciters.find(r => r.id.toString() === selectedReciterId)?.name;

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
         {/* Window Controls (Right side for RTL) - Placeholders */}
        <div className="flex items-center gap-1">
            <TooltipProvider>
                {/* Tooltips remain the same */}
                <Tooltip>
                    <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleClose} className="hover:bg-destructive/80 hover:text-destructive-foreground">
                        <X className="h-4 w-4" />
                        <span className="sr-only">إغلاق</span>
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>إغلاق</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleMaximize} className="hover:bg-muted">
                        <Maximize2 className="h-4 w-4" />
                        <span className="sr-only">تكبير</span>
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>تكبير</p></TooltipContent>
                </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleMinimize} className="hover:bg-muted">
                        <Minimize2 className="h-4 w-4" />
                        <span className="sr-only">تصغير</span>
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>تصغير</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
      </div>

      {/* Audio Controls and Selectors (Left side for RTL) */}
       <div className="flex items-center gap-2">

        {/* Sources Dialog Trigger */}
        <Dialog>
          <DialogTrigger asChild>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <BookOpen />
                    <span className="sr-only">المصادر والمراجع</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>المصادر والمراجع</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>المصادر والمراجع</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              <p> مصدر واجهة برمجة التطبيقات الصوتية للقرآن الكريم: <a href="https://mp3quran.net/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">mp3quran.net</a> </p>
               <p>تم بناء هذا التطبيق باستخدام Next.js و Shadcn/UI و Tailwind CSS.</p>
               <p>(سيتم إضافة تفاصيل إضافية عن المصادر لاحقاً)</p>
            </DialogDescription>
          </DialogContent>
        </Dialog>

         {/* Selectors */}
         <div className="hidden md:flex items-center gap-2">
              {/* Surah Selector */}
              <Select value={selectedAudioSurah} onValueChange={(value) => {
                 console.log("Selected Audio Surah changed:", value);
                 setSelectedAudioSurah(value);
                 // Optionally pause audio when changing Surah
                 if (audioRef.current) {
                     console.log("Pausing audio due to Surah change.");
                     audioRef.current.pause();
                     setIsPlaying(false);
                     setIsAudioLoading(false);
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

             {/* Moshaf Selector */}
              <Select
                value={selectedMoshafId}
                onValueChange={(value) => {
                    console.log("Selected Moshaf ID changed:", value);
                    setSelectedMoshafId(value);
                    // Optionally pause audio when changing Moshaf
                    if (audioRef.current) {
                        console.log("Pausing audio due to Moshaf change.");
                        audioRef.current.pause();
                        setIsPlaying(false);
                        setIsAudioLoading(false);
                    }
                }}
                disabled={!selectedReciterId || availableMoshafs.length === 0}
                dir="rtl"
              >
                <SelectTrigger className="w-[150px] font-cairo">
                    <SelectValue placeholder={selectedReciterId ? (availableMoshafs.length > 0 ? "اختر المصحف" : "لا يوجد مصحف") : "اختر القارئ أولاً"} />
                </SelectTrigger>
                <SelectContent>
                  {availableMoshafs.map((moshaf) => (
                    <SelectItem key={moshaf.id} value={moshaf.id.toString()} className="font-cairo">
                      {moshaf.name}
                    </SelectItem>
                  ))}
                  {selectedReciterId && availableMoshafs.length === 0 && (
                     <SelectItem value="no-moshaf" disabled className="font-cairo">
                       لا توجد مصاحف متاحة
                     </SelectItem>
                  )}
                </SelectContent>
              </Select>

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
        </div>


        {/* Volume Controls */}
        <div className="flex items-center gap-2 w-32">
          <Slider
            dir="rtl"
            value={[volume]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className="w-full cursor-pointer"
            aria-label="التحكم في مستوى الصوت"
            disabled={isMuted}
          />
           <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                  <span className="sr-only">{isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

         {/* Play/Pause Button */}
         <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
               <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={isPlayDisabled}>
                 {isAudioLoading ? <Loader2 className="animate-spin" /> : isPlaying ? <Pause /> : <Play />}
                 <span className="sr-only">{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
               </Button>
            </TooltipTrigger>
            <TooltipContent>
               <p>{isAudioLoading ? 'جاري التحميل...' : (isPlaying ? 'إيقاف مؤقت' : 'تشغيل')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

         {/* Sidebar Trigger on Mobile */}
         {isMobile && <SidebarTrigger />}
       </div>
    </header>
  );
}
