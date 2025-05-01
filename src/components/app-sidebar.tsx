
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
  PanelRight
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
import { quranSurahs } from '@/data/quran-surahs'; // Import surah data
import { quranRiwayat } from '@/data/quran-riwayat'; // Import riwaya data

// // Mock data - replace with actual data fetching/state management for novels if needed
// const novels = [
//   { id: 'novel1', name: 'رواية مثال 1' },
//   { id: 'novel2', name: 'رواية مثال 2' },
// ];


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
    setSelectedSurah, // For displaying Quran text
    selectedSurah,   // For displaying Quran text
    selectedRiwaya, // State for Riwaya selection
    setSelectedRiwaya, // Setter for Riwaya selection
  } = useQuranStore();

  // const [selectedNovel, setSelectedNovel] = useState<string | undefined>(undefined);


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
             {!isMobile && <SidebarTrigger icon={PanelRight} />}
             {/* Removed "قارئ الكتاب" text */}
        </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>التحكم بالنص</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-4">
             {/* Novel Selection - Disabled for now */}
            {/* <div>
                <Label htmlFor="novel-select" className="text-sm font-medium mb-1 block font-cairo">الروايات (غير مفعّل)</Label>
                <Select value={selectedNovel} onValueChange={setSelectedNovel} disabled={true} dir="rtl">
                <SelectTrigger id="novel-select">
                    <SelectValue placeholder="اختر رواية" />
                </SelectTrigger>
                <SelectContent>
                     <SelectItem value="no-novels" disabled>غير متاح حاليًا</SelectItem>
                </SelectContent>
                </Select>
            </div> */}

             {/* Quran Riwaya Selection for Text Display */}
             <div>
                <Label htmlFor="riwaya-select-text" className="text-sm font-medium mb-1 block font-cairo">الرواية (النص)</Label>
                <Select value={selectedRiwaya} onValueChange={setSelectedRiwaya} dir="rtl">
                <SelectTrigger id="riwaya-select-text" className="font-cairo">
                    <SelectValue placeholder="اختر الرواية" />
                </SelectTrigger>
                <SelectContent>
                    {quranRiwayat.map((riwaya) => (
                    <SelectItem key={riwaya.id} value={riwaya.id} className="font-cairo">
                        {riwaya.name}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>


             {/* Quran Surah Selection for Text Display */}
             <div>
                <Label htmlFor="surah-select-text" className="text-sm font-medium mb-1 block font-cairo">عرض سورة (النص)</Label>
                <Select value={selectedSurah} onValueChange={setSelectedSurah} dir="rtl">
                <SelectTrigger id="surah-select-text" className="font-cairo">
                    <SelectValue placeholder="اختر سورة لعرضها" />
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

             {/* Font Size Control */}
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-1">
                 {/* Changed variant to "secondary" */}
                 <Button variant="secondary" size="icon" onClick={increaseFontSize} aria-label="تكبير حجم النص">
                   <ZoomIn />
                 </Button>
                 <span className="text-sm w-6 text-center tabular-nums">{fontSize}</span>
                 {/* Changed variant to "secondary" */}
                 <Button variant="secondary" size="icon" onClick={decreaseFontSize} aria-label="تصغير حجم النص">
                   <ZoomOut />
                 </Button>
               </div>
                <Label className="text-sm font-medium font-cairo">حجم النص</Label>
             </div>

             {/* View Mode Toggle */}
             <div className="flex items-center justify-between">
                <Switch
                    id="view-mode-toggle"
                    checked={viewMode === 'verse'}
                    onCheckedChange={toggleViewMode}
                    aria-label={`التبديل إلى عرض ${viewMode === 'page' ? 'آية بآية' : 'صفحة'}`}
                />
               <Label htmlFor="view-mode-toggle" className="text-sm font-medium font-cairo">
                 وضع العرض: {viewMode === 'page' ? 'صفحة' : 'آية بآية'}
               </Label>
             </div>

          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
            <SidebarGroupLabel>المظهر</SidebarGroupLabel>
             <SidebarGroupContent className="space-y-4">
                {/* Theme Toggle */}
                 <div className="flex items-center justify-between">
                      <Switch
                        id="theme-toggle"
                        checked={theme === 'dark'}
                        onCheckedChange={handleThemeToggle}
                        aria-label={`التبديل إلى الوضع ${theme === 'dark' ? 'الفاتح' : 'الداكن'}`}
                    />
                    <Label htmlFor="theme-toggle" className="text-sm font-medium font-cairo">
                        السمة: {theme === 'dark' ? 'داكن' : 'فاتح'}
                    </Label>
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
