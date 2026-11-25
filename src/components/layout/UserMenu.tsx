import { useLocation } from 'wouter'
import { BadgeCheck, ChevronDown, LogOut, UserRound } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/AuthContext'
import { employeeApi } from '@/api/resources'
import { useMyPhoto } from '@/hooks/useMyProfile'

/** The avatar at the top right: photo (or initials) with a live dot, name + code on wider screens, and a small menu. */
export function UserMenu() {
  const { user, logout } = useAuth()
  const [, navigate] = useLocation()
  const profileQuery = useQuery({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
  // The real photo (a server path resolved against the API's origin), initials while it loads or when there is none.
  const { photoUrl } = useMyPhoto()

  const initials = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Your account: ${user?.name ?? 'Employee'}`}
        className="focus-ring group flex min-h-11 items-center gap-2.5 rounded-full py-1 pr-1 pl-1 transition-colors hover:bg-foreground/[0.05] sm:pr-2.5"
      >
        <span className="relative">
          <span className="bg-silk absolute -inset-[2px] rounded-full opacity-70 transition-opacity group-hover:opacity-100" aria-hidden="true" />
          <Avatar className="relative size-9 ring-2 ring-background">
            {photoUrl && <AvatarImage src={photoUrl} alt="" className="object-cover" />}
            <AvatarFallback className="bg-primary/15 text-[12px] font-bold text-brand-blue">{initials || 'EM'}</AvatarFallback>
          </Avatar>
          <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-success ring-2 ring-background" aria-hidden="true" />
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-40 truncate text-[13px] font-semibold">{user?.name}</span>
          <span className="block max-w-40 truncate text-[11px] text-muted-foreground">{profileQuery.data?.employeeCode ?? 'Employee'}</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 sm:block" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="leading-tight">
          <span className="block truncate font-semibold">{user?.name}</span>
          <span className="block truncate text-[12px] font-normal text-muted-foreground">{profileQuery.data?.employeeCode ?? 'Employee'}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/employee/profile')}>
          <UserRound className="text-muted-foreground" aria-hidden="true" /> My profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/employee/id-card')}>
          <BadgeCheck className="text-muted-foreground" aria-hidden="true" /> Digital ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => logout()}>
          <LogOut aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
