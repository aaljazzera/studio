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
  PanelRight // Use PanelRight for RTL toggle
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
    SidebarTrigger, // Keep SidebarTrigger logic
    useSidebar,
} from '@/components/ui/sidebar';
import { useQuranStore } from '@/store/quran-store';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// Mock data - replace with actual data fetching/state management
const novels = [
  { id: 'novel1', name: 'رواية مثال 1' },
  { id: 'novel2', name: 'رواية مثال 2' },
];

// Needs proper Arabic Surah names
const surahs = Array.from({ length: 114 }, (_, i) => ({
  id: `${i + 1}`,
  name: `سورة ${i + 1}`,
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
            {/* SidebarTrigger goes to the left in RTL */}
            {!isMobile && <SidebarTrigger icon={PanelRight} />}
             <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">الكتاب</span>
            </div>
        </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>عناصر التحكم بالقراءة</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-4">
            <div>
                <Label htmlFor="novel-select" className="text-sm font-medium mb-1 block">الروايات</Label>
                <Select value={selectedNovel} onValueChange={setSelectedNovel} disabled={novels.length === 0}>
                <SelectTrigger id="novel-select">
                    <SelectValue placeholder="اختر رواية" />
                </SelectTrigger>
                <SelectContent>
                    {novels.map((novel) => (
                    <SelectItem key={novel.id} value={novel.id}>
                        {novel.name}
                    </SelectItem>
                    ))}
                     {novels.length === 0 && <SelectItem value="no-novels" disabled>لا توجد روايات متاحة</SelectItem>}
                </SelectContent>
                </Select>
            </div>

             <div>
                <Label htmlFor="surah-select" className="text-sm font-medium mb-1 block">سور القرآن</Label>
                <Select value={selectedSurah} onValueChange={setSelectedSurah}>
                <SelectTrigger id="surah-select">
                    <SelectValue placeholder="اختر سورة" />
                </SelectTrigger>
                <SelectContent>
                    {surahs.map((surah) => (
                    <SelectItem key={surah.id} value={surah.id}>
                        {surah.name}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>

             <div className="flex items-center justify-between">
               <div className="flex items-center gap-1">
                 <Button variant="ghost" size="icon" onClick={increaseFontSize} aria-label="تكبير حجم النص">
                   <ZoomIn />
                 </Button>
                 <span className="text-sm w-6 text-center">{fontSize}</span>
                 <Button variant="ghost" size="icon" onClick={decreaseFontSize} aria-label="تصغير حجم النص">
                   <ZoomOut />
                 </Button>
               </div>
                <Label className="text-sm font-medium">حجم النص</Label>
             </div>

             <div className="flex items-center justify-between">
                <Switch
                    id="view-mode-toggle"
                    checked={viewMode === 'verse'}
                    onCheckedChange={toggleViewMode}
                    aria-label={`التبديل إلى عرض ${viewMode === 'page' ? 'آية بآية' : 'صفحة'}`}
                />
               <Label htmlFor="view-mode-toggle" className="text-sm font-medium">
                 وضع العرض: {viewMode === 'page' ? 'صفحة' : 'آية بآية'}
               </Label>
             </div>

          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
            <SidebarGroupLabel>المظهر</SidebarGroupLabel>
             <SidebarGroupContent className="space-y-4">
                 <div className="flex items-center justify-between">
                      <Switch
                        id="theme-toggle"
                        checked={theme === 'dark'}
                        onCheckedChange={handleThemeToggle}
                        aria-label={`التبديل إلى الوضع ${theme === 'dark' ? 'الفاتح' : 'الداكن'}`}
                    />
                    <Label htmlFor="theme-toggle" className="text-sm font-medium">
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