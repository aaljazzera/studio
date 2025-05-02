
"use client";

import React, { useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Library, // Icon for Riwaya
  List, // Icon for Surah
  FileText, // Icon for View Mode
  Sun,
  Moon,
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
import { quranSurahs } from '@/data/quran-surahs'; // Import surah data
import { quranRiwayat } from '@/data/quran-riwayat'; // Import riwaya data
import { cn } from '@/lib/utils'; // Import cn

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
    selectedRiwaya,
    setSelectedRiwaya,
  } = useQuranStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) {
    return null;
  }


  return (
    <>
        <SidebarHeader className="flex items-center justify-between">
             {!isMobile && <SidebarTrigger icon={PanelRight} />}
        </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>التحكم بالنص</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-4">

             {/* Quran Riwaya Selection */}
             <div>
                <Label htmlFor="riwaya-select-text" className="text-sm font-medium mb-1 block">الرواية</Label>
                <Select value={selectedRiwaya} onValueChange={setSelectedRiwaya} dir="rtl">
                    {/* Apply sidebar-specific styling */}
                    <SelectTrigger id="riwaya-select-text" className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Library className="h-4 w-4 text-sidebar-foreground/70" />
                          <SelectValue placeholder="اختر الرواية" />
                        </div>
                    </SelectTrigger>
                    <SelectContent className="sidebar-select-content">
                        {quranRiwayat.map((riwaya) => (
                            <SelectItem key={riwaya.id} value={riwaya.id}>
                                {riwaya.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

             {/* Quran Surah Selection */}
             <div>
                <Label htmlFor="surah-select-text" className="text-sm font-medium mb-1 block">السورة</Label>
                <Select value={selectedSurah} onValueChange={setSelectedSurah} dir="rtl">
                    {/* Apply sidebar-specific styling */}
                    <SelectTrigger id="surah-select-text" className="w-full flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <List className="h-4 w-4 text-sidebar-foreground/70" />
                            <SelectValue placeholder="اختر سورة لعرضها" />
                         </div>
                    </SelectTrigger>
                    <SelectContent className="sidebar-select-content">
                        {quranSurahs.map((surah) => (
                            <SelectItem key={surah.id} value={surah.id.toString()}>
                                {surah.id}. {surah.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <SidebarSeparator />

             {/* Font Size Control */}
             <div className="flex flex-col items-center space-y-2">
                 <Label className="text-sm font-medium">حجم الخط</Label>
                 <div className="flex items-center justify-center gap-1 w-full">
                     {/* Adjusted button styling */}
                     <Button variant="secondary" size="icon" onClick={decreaseFontSize} aria-label="تصغير حجم النص" className="flex-1">
                       <ZoomOut />
                     </Button>
                     <span className="text-sm w-10 text-center tabular-nums font-size-display">{fontSize}px</span>
                     {/* Adjusted button styling */}
                     <Button variant="secondary" size="icon" onClick={increaseFontSize} aria-label="تكبير حجم النص" className="flex-1">
                       <ZoomIn />
                     </Button>
                 </div>
             </div>

            <SidebarSeparator />


             {/* View Mode Toggle - Replaced Switch with Button */}
             <div className="flex flex-col items-center space-y-2">
               <Label htmlFor="view-mode-button" className="text-sm font-medium">
                 وضع العرض
               </Label>
                 <Button
                    id="view-mode-button"
                    variant="secondary"
                    onClick={toggleViewMode}
                    className="w-full flex items-center justify-center gap-2"
                    aria-label={`التبديل إلى عرض ${viewMode === 'page' ? 'آية بآية' : 'صفحة'}`}
                 >
                    <FileText className="h-4 w-4" />
                    {viewMode === 'page' ? 'عرض الآيات' : 'عرض الصفحة'}
                 </Button>
             </div>

             <SidebarSeparator />

          </SidebarGroupContent>
        </SidebarGroup>
        {/* <SidebarSeparator /> */}
        <SidebarGroup>
            <SidebarGroupLabel>المظهر</SidebarGroupLabel>
             <SidebarGroupContent className="space-y-4">
                {/* Theme Toggle - Replaced Switch with Button */}
                 <div className="flex flex-col items-center space-y-2">
                    <Label htmlFor="theme-button" className="text-sm font-medium">
                        المظهر
                    </Label>
                     <Button
                        id="theme-button"
                        variant="secondary"
                        onClick={handleThemeToggle}
                        className="w-full flex items-center justify-center gap-2"
                        aria-label={`التبديل إلى الوضع ${theme === 'dark' ? 'الفاتح' : 'الداكن'}`}
                     >
                        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        {theme === 'dark' ? 'وضع النهار' : 'وضع الليل'}
                     </Button>
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

    