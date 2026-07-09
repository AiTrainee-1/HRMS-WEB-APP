import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface TextareaFieldProps extends Omit<React.ComponentProps<'textarea'>, 'id'> {
  id: string
  label?: string
  minLength?: number
  maxLength?: number
}

/** A reason/comment textarea with a label, live character counter, and a
 * minimum-length hint — matches the mobile app's TextArea component. */
export function TextareaField({ id, label, minLength, maxLength, className, value, ...props }: TextareaFieldProps) {
  const length = typeof value === 'string' ? value.length : 0
  const belowMin = !!minLength && length > 0 && length < minLength
  const nearMax = !!maxLength && length >= Math.floor(maxLength * 0.9)
  const atMax = !!maxLength && length >= maxLength

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
      <Textarea id={id} value={value} maxLength={maxLength} className={cn(className)} {...props} />
      {(minLength || maxLength) && (
        <div className="flex items-center justify-between text-xs">
          <span className={cn('text-muted-foreground', belowMin && 'text-warning-foreground')}>
            {minLength
              ? length === 0
                ? `Minimum ${minLength} characters`
                : belowMin
                  ? `${minLength - length} more character${minLength - length === 1 ? '' : 's'} needed`
                  : 'Looks good'
              : ''}
          </span>
          {maxLength && (
            <span className={cn('text-muted-foreground', nearMax && 'text-warning-foreground', atMax && 'text-destructive')}>
              {length}/{maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
