import type { Metadata } from 'next';
// Import Cairo font along with Geist
import { Cairo, Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';
import { QueryProvider } from '@/components/query-provider';

// Configure Cairo font
const cairo = Cairo({
  subsets: ['arabic', 'latin'], // Include Arabic subset
  weight: ['400', '700'], // Include regular (400) and bold (700) if needed
  variable: '--font-cairo', // Assign CSS variable
});

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'قارئ الكتاب',
  description: 'تطبيق قارئ القرآن والروايات',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      {/* Add cairo.variable to the body className */}
      <body className={`${cairo.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SidebarProvider defaultOpen={true}>
              {/* Set sidebar side to right for Arabic UI */}
              <Sidebar side="right" variant="sidebar" collapsible="icon">
                <AppSidebar />
              </Sidebar>
              <SidebarInset>
                <div className="flex flex-col h-screen">
                  <AppHeader />
                  <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    {children}
                  </main>
                </div>
              </SidebarInset>
              <Toaster />
            </SidebarProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
