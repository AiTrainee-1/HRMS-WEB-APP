import * as React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useMyPhoto } from '@/hooks/useMyProfile'

/**
 * The signed-in employee's avatar for the headers (desktop account menu, phone top bar): their real photo, else their
 * initials (also while the photo loads or when it fails to load: Radix Avatar falls back by itself), else `icon` until
 * the name is known. Decorative (alt=""): the button around it carries the label.
 */
export function HeaderAvatar({
  className,
  fallbackClassName,
  icon,
}: {
  className?: string
  fallbackClassName?: string
  /** Shown when neither a photo nor a name is known yet. */
  icon?: React.ReactNode
}) {
  const { photoUrl, initials } = useMyPhoto()
  return (
    <Avatar className={className}>
      {photoUrl && <AvatarImage src={photoUrl} alt="" className="object-cover" />}
      <AvatarFallback className={fallbackClassName}>{initials || icon || 'EM'}</AvatarFallback>
    </Avatar>
  )
}
