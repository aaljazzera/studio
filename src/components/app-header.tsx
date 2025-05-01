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

// Mock data - replace with actual data fetching
const reciters = [
  { id: '1', name: 'Mishary Rashid Alafasy' },
  { id: '2', name: 'Abdul Basit Abdus Samad' },
  { id: '3', name: 'Saad Al-Ghamdi' },
];

const audioSurahs = Array.from({ length: 114 }, (_, i) => ({
  id: `${i + 1}`,
  name: `Surah ${i + 1}`,
})); // Replace with actual Surah names

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

    return () => {
      // Cleanup audio element on unmount
      if (audioRef.current) {
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

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // In a real app, set the src based on selectedReciter and selectedAudioSurah
        // Example: audioRef.current.src = `/audio/${selectedReciter}/${selectedAudioSurah}.mp3`;
        if (!audioRef.current.src) {
          // Set a default/placeholder source if none selected, or show an error
          console.warn("No audio source selected");
          return;
        }
        audioRef.current.play().catch(error => console.error("Audio playback error:", error));
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
  const handleMinimize = () => console.log("Minimize");
  const handleMaximize = () => console.log("Maximize/Restore");
  const handleClose = () => console.log("Close");

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
         {/* Only show SidebarTrigger if needed (e.g., on mobile or specific layouts) */}
         {isMobile && <SidebarTrigger />}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={!selectedReciter || !selectedAudioSurah}>
                {isPlaying ? <Pause /> : <Play />}
                <span className="sr-only">{isPlaying ? 'Pause' : 'Play'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPlaying ? 'Pause' : 'Play'} Audio</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-2 w-32">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                  <span className="sr-only">{isMuted ? 'Unmute' : 'Mute'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isMuted ? 'Unmute' : 'Mute'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className="w-full"
            aria-label="Volume control"
            disabled={isMuted}
          />
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Select value={selectedReciter} onValueChange={setSelectedReciter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Reciter" />
            </SelectTrigger>
            <SelectContent>
              {reciters.map((reciter) => (
                <SelectItem key={reciter.id} value={reciter.id}>
                  {reciter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedAudioSurah} onValueChange={setSelectedAudioSurah}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Audio Surah" />
            </SelectTrigger>
            <SelectContent>
              {audioSurahs.map((surah) => (
                <SelectItem key={surah.id} value={surah.id}>
                  {surah.name} {/* Replace with actual Surah names */}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <BookOpen />
                    <span className="sr-only">Sources and References</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sources and References</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sources and References</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              This section will contain information about the sources and references used in the application. (Content to be added)
            </DialogDescription>
            {/* Add sources content here */}
          </DialogContent>
        </Dialog>
      </div>

      {/* Window Controls - Non-functional placeholders */}
      <div className="flex items-center gap-1">
         <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleMinimize} className="hover:bg-muted">
                    <Minimize2 className="h-4 w-4" />
                    <span className="sr-only">Minimize</span>
                </Button>
                </TooltipTrigger>
                <TooltipContent><p>Minimize</p></TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleMaximize} className="hover:bg-muted">
                    <Maximize2 className="h-4 w-4" />
                    <span className="sr-only">Maximize</span>
                </Button>
                </TooltipTrigger>
                <TooltipContent><p>Maximize</p></TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleClose} className="hover:bg-destructive/80 hover:text-destructive-foreground">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </Button>
                </TooltipTrigger>
                 <TooltipContent><p>Close</p></TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}