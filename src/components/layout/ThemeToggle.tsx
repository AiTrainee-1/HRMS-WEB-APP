import { AnimatePresence, motion } from 'framer-motion'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme, type ThemeMode } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'Match my device', icon: Monitor },
]

/** Top-bar appearance switch: the sun/moon swaps with a little turn; the menu offers Light / Dark / Match my device. */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, isDark, setMode } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Appearance: ${mode === 'system' ? 'matching your device' : isDark ? 'dark' : 'light'}`}
        className={cn(
          'focus-ring relative grid size-10 place-items-center overflow-hidden rounded-full text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground',
          className,
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? 'moon' : 'sun'}
            initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="grid place-items-center"
          >
            {isDark ? <Moon className="size-[19px]" /> : <Sun className="size-[19px] text-brand-gold" />}
          </motion.span>
        </AnimatePresence>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="label-caps text-muted-foreground">Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(({ mode: m, label, icon: Icon }) => (
          <DropdownMenuItem key={m} onSelect={() => setMode(m)}>
            <Icon className="text-muted-foreground" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {mode === m && <Check className="text-brand-blue" aria-label="selected" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
