"use client";

import React, { useState, useRef, useEffect } from 'react';
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
import { quranSurahs } from '@/data/quran-surahs'; // Import surah data

// Mock data - replace with actual data fetching
const reciters = [
  { id: '1', name: 'مشاري راشد العفاسي' },
  { id: '2', name: 'عبد الباسط عبد الصمد' },
  { id: '3', name: 'سعد الغامدي' },
];


export function AppHeader() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedReciter, setSelectedReciter] = useState<string | undefined>(undefined);
  const [selectedAudioSurah, setSelectedAudioSurah] = useState<string | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMobile } = useSidebar();

  useEffect(() => {
    // Create audio element only on the client side
    audioRef.current = new Audio();

    // Add event listener for when audio ends
     const handleAudioEnd = () => setIsPlaying(false);
     audioRef.current.addEventListener('ended', handleAudioEnd);


    return () => {
      // Cleanup audio element and listener on unmount
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnd);
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

   useEffect(() => {
     // Update audio source when selections change
     if (audioRef.current && selectedReciter && selectedAudioSurah) {
       // In a real app, construct the correct URL
       // Example: audioRef.current.src = `/audio/${selectedReciter}/${selectedAudioSurah}.mp3`;
       console.log(`Setting audio source: Reciter ${selectedReciter}, Surah ${selectedAudioSurah}`);
       // Placeholder: Stop current playback if source changes
       if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
       }
       // Set a dummy source for now, replace with actual path format
       // audioRef.current.src = `https://example.com/audio/${selectedReciter}/${selectedAudioSurah}.mp3`;
       audioRef.current.src = ''; // Clear src to avoid unintended playback until play is clicked
     }
   }, [selectedReciter, selectedAudioSurah, isPlaying]); // Add isPlaying dependency


  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (!audioRef.current.src && selectedReciter && selectedAudioSurah) {
           // Set the src only when play is clicked if not already set
           // Replace with actual path format
           // audioRef.current.src = `https://example.com/audio/${selectedReciter}/${selectedAudioSurah}.mp3`;
           console.warn("Audio source not set, please provide actual audio file paths.");
           // Set a placeholder src to allow play attempt (will likely fail without real audio)
           // audioRef.current.src = `https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/${selectedAudioSurah}.mp3`; // Example - NEEDS CORS or proxy
           return; // Prevent playing without a valid source
        } else if (!selectedReciter || !selectedAudioSurah) {
             console.warn("الرجاء اختيار القارئ والسورة الصوتية");
             return;
        }

        audioRef.current.play().then(() => {
          // Playback started successfully
        }).catch(error => {
          console.error("خطأ في تشغيل الصوت:", error);
          setIsPlaying(false); // Reset state if playback fails
        });
      }
      setIsPlaying(!isPlaying);
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

  // Placeholder functions for window controls (not functional in browser)
  const handleMinimize = () => console.log("تصغير");
  const handleMaximize = () => console.log("تكبير/استعادة");
  const handleClose = () => console.log("إغلاق");

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
         {/* Window Controls (Right side for RTL) - Non-functional placeholders */}
        <div className="flex items-center gap-1">
            <TooltipProvider>
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
              سيحتوي هذا القسم على معلومات حول المصادر والمراجع المستخدمة في التطبيق. (سيتم إضافة المحتوى لاحقاً)
            </DialogDescription>
            {/* Add sources content here */}
          </DialogContent>
        </Dialog>

         <div className="hidden md:flex items-center gap-2">
            <Select value={selectedAudioSurah} onValueChange={setSelectedAudioSurah}>
                <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="اختر سورة صوتية" />
                </SelectTrigger>
                <SelectContent>
                {quranSurahs.map((surah) => (
                    <SelectItem key={surah.id} value={surah.id.toString()}>
                    {surah.name}
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>

             <Select value={selectedReciter} onValueChange={setSelectedReciter}>
                 <SelectTrigger className="w-[180px]">
                 <SelectValue placeholder="اختر القارئ" />
                 </SelectTrigger>
                 <SelectContent>
                 {reciters.map((reciter) => (
                     <SelectItem key={reciter.id} value={reciter.id}>
                     {reciter.name}
                     </SelectItem>
                 ))}
                 </SelectContent>
             </Select>
        </div>


        <div className="flex items-center gap-2 w-32">
          <Slider
            dir="rtl" // Set direction for slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className="w-full"
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

         <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={!selectedReciter || !selectedAudioSurah}>
                {isPlaying ? <Pause /> : <Play />}
                <span className="sr-only">{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'} الصوت</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

         {/* Only show SidebarTrigger if needed (e.g., on mobile or specific layouts) */}
         {isMobile && <SidebarTrigger />}
       </div>

    </header>
  );
}
