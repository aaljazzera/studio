"use client";

import React, { useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Book,
  FileText,
  Sun,
  Moon,
  Columns,
  Rows,
  PanelLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTheme } from 'next-themes';
import {
    SidebarContent,
    SidebarHeader,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarSeparator,
    SidebarTrigger,
    useSidebar,
} from '@/components/ui/sidebar';
import { useQuranStore } from '@/store/quran-store';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// Mock data - replace with actual data fetching/state management
const novels = [
  { id: 'novel1', name: 'Novel Example 1' },
  { id: 'novel2', name: 'Novel Example 2' },
];

const surahs = Array.from({ length: 114 }, (_, i) => ({
  id: `${i + 1}`,
  name: `Surah ${i + 1}`, // Replace with actual Surah names
}));

export function AppSidebar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { isMobile } = useSidebar();

  const {
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    viewMode,
    toggleViewMode,
    setSelectedSurah,
    selectedSurah,
  } = useQuranStore();

  const [selectedNovel, setSelectedNovel] = useState<string | undefined>(undefined);


  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) {
    // Avoid rendering mismatch during hydration
    return null;
  }


  return (
    <>
        <SidebarHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                 {/* Placeholder for Logo or App Name if needed */}
                <span className="font-semibold text-lg">Al-Kitab</span>
            </div>
            {!isMobile && <SidebarTrigger />}
        </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Reading Controls</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-4">
            <div>
                <Label htmlFor="novel-select" className="text-sm font-medium mb-1 block">Novels</Label>
                <Select value={selectedNovel} onValueChange={setSelectedNovel} disabled={novels.length === 0}>
                <SelectTrigger id="novel-select">
                    <SelectValue placeholder="Select Novel" />
                </SelectTrigger>
                <SelectContent>
                    {novels.map((novel) => (
                    <SelectItem key={novel.id} value={novel.id}>
                        {novel.name}
                    </SelectItem>
                    ))}
                     {novels.length === 0 && <SelectItem value="no-novels" disabled>No novels available</SelectItem>}
                </SelectContent>
                </Select>
            </div>

             <div>
                <Label htmlFor="surah-select" className="text-sm font-medium mb-1 block">Quran Surahs</Label>
                <Select value={selectedSurah} onValueChange={setSelectedSurah}>
                <SelectTrigger id="surah-select">
                    <SelectValue placeholder="Select Surah" />
                </SelectTrigger>
                <SelectContent>
                    {surahs.map((surah) => (
                    <SelectItem key={surah.id} value={surah.id}>
                        {surah.name} {/* Replace with actual Surah names */}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>

             <div className="flex items-center justify-between">
               <Label className="text-sm font-medium">Text Size</Label>
               <div className="flex items-center gap-1">
                 <Button variant="ghost" size="icon" onClick={decreaseFontSize} aria-label="Decrease text size">
                   <ZoomOut />
                 </Button>
                 <span className="text-sm w-6 text-center">{fontSize}</span>
                 <Button variant="ghost" size="icon" onClick={increaseFontSize} aria-label="Increase text size">
                   <ZoomIn />
                 </Button>
               </div>
             </div>

             <div className="flex items-center justify-between">
               <Label htmlFor="view-mode-toggle" className="text-sm font-medium">
                 View Mode: {viewMode === 'page' ? 'Page' : 'Verse'}
               </Label>
                <Switch
                    id="view-mode-toggle"
                    checked={viewMode === 'verse'}
                    onCheckedChange={toggleViewMode}
                    aria-label={`Switch to ${viewMode === 'page' ? 'Verse' : 'Page'} view`}
                />
             </div>

          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
            <SidebarGroupLabel>Appearance</SidebarGroupLabel>
             <SidebarGroupContent className="space-y-4">
                 <div className="flex items-center justify-between">
                    <Label htmlFor="theme-toggle" className="text-sm font-medium">
                        Theme: {theme === 'dark' ? 'Dark' : 'Light'}
                    </Label>
                     <Switch
                        id="theme-toggle"
                        checked={theme === 'dark'}
                        onCheckedChange={handleThemeToggle}
                        aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
                    />
                 </div>
             </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
       <SidebarFooter>
         {/* Optional Footer Content */}
       </SidebarFooter>
    </>
  );
}