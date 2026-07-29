import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { Menu } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SidebarNav } from './SidebarNav'
import { NotificationBell } from './NotificationBell'
import { PermissionNudgeBanner } from './PermissionNudgeBanner'
import { useAuth } from '@/context/AuthContext'

/** Context that exposes the main scroll container ref for parallax consumers */
export const MainScrollContext = React.createContext<React.RefObject<HTMLElement | null>>(
  React.createRef<HTMLElement>()
)

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [location] = useLocation()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const mainRef = React.useRef<HTMLElement>(null)

  const initials = (user?.name ?? '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-brand-blue-tint">
      {/* subtle background blobs */}
      <div className="pointer-events-none absolute -top-24 -right-16 size-96 rounded-full bg-brand-gradient opacity-[0.06] animate-blob" />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-brand-gradient opacity-[0.04] animate-blob"
        style={{ animationDelay: '4s' }}
      />
      <div
        className="pointer-events-none absolute top-1/3 left-1/4 size-40 rounded-full bg-gold-gradient opacity-[0.05] animate-blob"
        style={{ animationDelay: '2s' }}
      />

      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-r-white/40 bg-white/60 backdrop-blur-xl z-20">
        <SidebarNav />
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-b-white/40 bg-white/60 backdrop-blur-xl px-4 z-20">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawerOpen(true)}>
              <Menu />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link href="/employee/profile" className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
              <Avatar className="size-8">
                <AvatarFallback>{initials || 'EM'}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm font-medium">{user?.name}</span>
            </Link>
          </div>
        </header>
        <PermissionNudgeBanner />
        <MainScrollContext.Provider value={mainRef}>
          <main ref={mainRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="mx-auto max-w-6xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </MainScrollContext.Provider>
      </div>
    </div>
  )
}
