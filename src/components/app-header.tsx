
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
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata'; // Preload metadata only

    // Add event listener for when audio ends
    const handleAudioEnd = () => setIsPlaying(false);
    const handleAudioError = (e: Event) => {
        console.error("خطأ في تشغيل الصوت:", e);
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
    };


    audioRef.current.addEventListener('ended', handleAudioEnd);
    audioRef.current.addEventListener('error', handleAudioError);

    return () => {
      // Cleanup audio element and listeners on unmount
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnd);
        audioRef.current.removeEventListener('error', handleAudioError);
        audioRef.current.pause();
        audioRef.current.src = ''; // Clear src
        audioRef.current = null;
      }
    };
  }, [toast]); // Add toast dependency


  // Update available Moshafs when selectedReciterId changes
  useEffect(() => {
    if (selectedReciterId && recitersData) {
      const reciter = recitersData.reciters.find(r => r.id.toString() === selectedReciterId);
      const moshafs = reciter?.moshaf ?? [];
      setAvailableMoshafs(moshafs);
      // Automatically select the first available Moshaf if only one exists, or reset if none
       if (moshafs.length === 1) {
         setSelectedMoshafId(moshafs[0].id.toString());
       } else {
         setSelectedMoshafId(undefined); // Reset if multiple or no Moshafs
       }
    } else {
      setAvailableMoshafs([]);
      setSelectedMoshafId(undefined);
    }
  }, [selectedReciterId, recitersData]);


  // Update audio volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);


  // Prepare audio source (called before play)
   const prepareAudioSource = () => {
       if (audioRef.current && selectedReciterId && selectedMoshafId && selectedAudioSurah && availableMoshafs.length > 0) {
           const selectedMoshaf = availableMoshafs.find(m => m.id.toString() === selectedMoshafId);
           if (selectedMoshaf) {
               try {
                  const audioUrl = getAudioUrl(selectedMoshaf.server, selectedAudioSurah);
                   // Check if the source needs updating
                   if (audioRef.current.src !== audioUrl) {
                        console.log(`Setting audio source: ${audioUrl}`);
                        audioRef.current.src = audioUrl;
                        audioRef.current.load(); // Explicitly load the new source
                        return true; // Source prepared
                   }
                   return true; // Source is already correct
               } catch (error) {
                  console.error("خطأ في إعداد مصدر الصوت:", error);
                  toast({
                      title: "خطأ في إعداد الصوت",
                      description: (error as Error).message || "حدث خطأ أثناء تحضير رابط الصوت.",
                      variant: "destructive",
                  });
                  return false; // Source preparation failed
               }
           } else {
               console.warn("لم يتم العثور على المصحف المحدد.");
               toast({ title: "خطأ", description: "لم يتم العثور على المصحف المحدد.", variant: "destructive"});
                return false;
           }
       }
        return false; // Not enough info to prepare source
   };

  const handlePlayPause = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Ensure selections are made
      if (!selectedReciterId || !selectedMoshafId || !selectedAudioSurah) {
        toast({
            title: "تنبيه",
            description: "الرجاء اختيار القارئ والمصحف والسورة الصوتية أولاً.",
            variant: "default", // Use default or a specific variant like "warning" if defined
        });
        return;
      }

      // Prepare the source if not already set or if it changed
      const sourceReady = prepareAudioSource();

      if (sourceReady && audioRef.current.src) {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (error) {
          console.error("خطأ في تشغيل الصوت:", error);
          // Error handling is now done by the 'error' event listener
           setIsPlaying(false); // Ensure state is reset
        }
      } else if (!audioRef.current.src) {
           toast({
              title: "خطأ",
              description: "لم يتم تحديد مصدر الصوت. قد تكون هناك مشكلة في بناء الرابط.",
              variant: "destructive",
           });
      }
    }
  };


  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (isMuted && value[0] > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Placeholder functions for window controls
  const handleMinimize = () => console.log("تصغير");
  const handleMaximize = () => console.log("تكبير/استعادة");
  const handleClose = () => console.log("إغلاق");

   // Determine if the play button should be disabled
   const isPlayDisabled = !selectedReciterId || !selectedMoshafId || !selectedAudioSurah;

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
              <Select value={selectedAudioSurah} onValueChange={setSelectedAudioSurah} dir="rtl">
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="اختر سورة" />
                </SelectTrigger>
                <SelectContent>
                  {quranSurahs.map((surah) => (
                    <SelectItem key={surah.id} value={surah.id.toString()}>
                      {surah.id}. {surah.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

             {/* Moshaf Selector */}
              <Select
                value={selectedMoshafId}
                onValueChange={setSelectedMoshafId}
                disabled={!selectedReciterId || availableMoshafs.length === 0}
                dir="rtl"
              >
                <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder={selectedReciterId ? (availableMoshafs.length > 0 ? "اختر المصحف" : "لا يوجد مصحف") : "اختر القارئ أولاً"} />
                </SelectTrigger>
                <SelectContent>
                  {availableMoshafs.map((moshaf) => (
                    <SelectItem key={moshaf.id} value={moshaf.id.toString()}>
                      {moshaf.name}
                    </SelectItem>
                  ))}
                  {selectedReciterId && availableMoshafs.length === 0 && (
                     <SelectItem value="no-moshaf" disabled>
                       لا توجد مصاحف متاحة لهذا القارئ
                     </SelectItem>
                  )}
                </SelectContent>
              </Select>

             {/* Reciter Selector */}
             {isLoadingReciters ? (
                 <Skeleton className="h-10 w-[180px]" />
             ) : recitersError ? (
                 <div className="w-[180px] text-destructive text-xs px-2 py-1 border border-destructive rounded-md text-center">
                     خطأ في تحميل القراء
                 </div>
             ) : (
                 <Select value={selectedReciterId} onValueChange={setSelectedReciterId} dir="rtl">
                     <SelectTrigger className="w-[180px]">
                     <SelectValue placeholder="اختر القارئ" />
                     </SelectTrigger>
                     <SelectContent>
                     {recitersData?.reciters?.map((reciter) => (
                         <SelectItem key={reciter.id} value={reciter.id.toString()}>
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
                {isPlaying ? <Pause /> : <Play />}
                <span className="sr-only">{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'} الصوت</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

         {/* Sidebar Trigger on Mobile */}
         {isMobile && <SidebarTrigger />}
       </div>
    </header>
  );
}
