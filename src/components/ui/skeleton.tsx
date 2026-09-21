import { cn } from '@/lib/utils'
import { Loader } from './loader'

/**
 * Loading placeholder. Keeps the size the caller reserves (so content doesn't
 * jump in when it arrives) and shows the app loader centred inside it.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="skeleton" className={cn('loader-box rounded-md', className)} {...props}>
      <Loader />
    </div>
  )
}

export { Skeleton }
