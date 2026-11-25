import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, MessageCircle, Users } from 'lucide-react'
import { EmptyState, ErrorState, PageHero, PageShell, SegmentedControl, SkeletonBlock } from '@/components/kit'
import { ChannelThread } from '@/components/chat/ChannelThread'
import { MainScrollContext } from '@/components/layout/EmployeeLayout'
import { chatThreadApi } from '@/api/home-chat'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

type Which = 'company' | 'department'

// Phones (< 768px), kit/MOBILE.md: the conversation fills the scroll area (<main>) between the top bar and the tab bar.
// The page is a flex column exactly as tall as <main> really is - measured, so a banner the shell shows above <main> (the
// permission strip) is allowed for - minus the shell's 8px top padding (its 24px bottom padding is taken back with
// -mb-6). Its last block, the thread, takes whatever the title leaves, so the composer always sits right above the tab bar.
// Until the first measurement the viewport sum stands in.
const PHONE_FULL_HEIGHT =
  'max-md:-mb-6 max-md:h-[calc(var(--m-main-h,calc(100dvh-var(--m-topbar-h)-var(--m-tabbar-h)))-8px)] max-md:gap-3 max-md:[&>div:last-child]:flex max-md:[&>div:last-child]:min-h-0 max-md:[&>div:last-child]:flex-1 max-md:[&>div:last-child]:flex-col'

/**
 * Publishes <main>'s real height as --m-main-h (on <main>, so the page inside inherits it) and keeps it current while the
 * chat is open: the permission strip coming or going, the phone turning, the browser bar resizing. Removed on leaving.
 * Only the phone class above reads it, so wider screens are unaffected.
 */
function useMainHeightVar() {
  const mainRef = React.useContext(MainScrollContext)
  React.useLayoutEffect(() => {
    const main = mainRef.current
    if (!main) return
    const update = () => main.style.setProperty('--m-main-h', `${main.clientHeight}px`)
    update()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(main)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
      main.style.removeProperty('--m-main-h')
    }
  }, [mainRef])
}
// The app's ChannelSwitcher: a soft full-width track, the chosen channel a filled pill, both halves equal.
const PHONE_SWITCH =
  'max-md:w-full max-md:rounded-full max-md:bg-muted! max-md:[&>button]:min-h-10 max-md:[&>button]:flex-1 max-md:[&>button]:rounded-full max-md:[&>button]:text-[13px] max-md:[&_.bg-brand-gradient]:rounded-full'

/** Company-wide and department conversations. Only the open channel is polled. */
export default function Chat() {
  const { user } = useAuth()
  useMainHeightVar()
  const channels = useQuery({ queryKey: ['chat-channels'], queryFn: chatThreadApi.channels, staleTime: 10 * 60_000 })
  const company = channels.data?.find((c) => c.type === 'company')
  const department = channels.data?.find((c) => c.type === 'department')
  const [which, setWhich] = React.useState<Which | null>(null)
  const active: Which | null = which ?? (company ? 'company' : department ? 'department' : null)
  const channel = active === 'company' ? company : active === 'department' ? department : undefined
  const channelName = active === 'company' ? 'Everyone at UK Textiles' : (department?.departmentName ?? 'Your department')
  // Phones: the app's status line under the title (a live dot while the channel is open).
  const liveStatus = channels.isPending ? 'Connecting…' : channels.isError ? 'Can’t reach chat right now' : !channel ? 'Not available' : 'Live · new messages appear automatically'
  const live = !channels.isPending && !channels.isError && !!channel

  return (
    <PageShell className={PHONE_FULL_HEIGHT}>
      <PageHero
        icon={<MessageCircle />}
        title="Team Chat"
        subtitle={
          <>
            <span className="max-md:hidden">Talk with the whole company or your department: messages, GIFs and voice notes. HR messages are marked HR.</span>
            <span className="hidden max-md:flex max-md:items-center max-md:gap-1.5">
              <span
                aria-hidden="true"
                className={cn('max-md:size-[7px] max-md:shrink-0 max-md:rounded-full', live ? 'max-md:bg-success max-md:motion-safe:animate-pulse' : 'max-md:bg-warning')}
              />
              <span className="max-md:truncate">{liveStatus}</span>
            </span>
          </>
        }
        actions={
          company && department ? (
            <SegmentedControl<Which>
              ariaLabel="Conversation"
              value={active ?? 'company'}
              onChange={setWhich}
              className={PHONE_SWITCH}
              options={[
                { value: 'company', label: 'Company', icon: Building2 },
                { value: 'department', label: department.departmentName ?? 'Department', icon: Users },
              ]}
            />
          ) : undefined
        }
      />

      {channels.isPending ? (
        <div
          className="glass-raised flex h-[min(72dvh,760px)] min-h-[440px] flex-col gap-3 rounded-2xl p-4 max-md:h-auto max-md:min-h-0 max-md:flex-1 max-md:justify-end max-md:border-0! max-md:bg-none! max-md:bg-transparent! max-md:p-0 max-md:shadow-none!"
          role="status"
          aria-label="Loading the chat"
        >
          <SkeletonBlock className="h-12 w-2/3 rounded-2xl" />
          <SkeletonBlock className="h-12 w-1/2 self-end rounded-2xl" />
          <SkeletonBlock className="h-12 w-3/5 rounded-2xl" />
        </div>
      ) : channels.isError ? (
        <ErrorState error={channels.error} what="your chat channels" onRetry={() => channels.refetch()} retrying={channels.isFetching} />
      ) : !channel ? (
        <EmptyState icon={MessageCircle} title="No chat yet" description="HR has not opened a chat channel for you. Ask HR if you expected one." />
      ) : (
        <ChannelThread
          key={channel.id}
          channelId={channel.id}
          channelName={channelName}
          myId={user?.employeeId ?? null}
          myName={user?.name ?? 'You'}
          expiryDays={typeof channel.mediaExpiryDays === 'number' ? channel.mediaExpiryDays : null}
        />
      )}
    </PageShell>
  )
}
