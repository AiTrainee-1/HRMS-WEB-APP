import * as React from 'react'
import { cn } from '@/lib/utils'

// Level-2 glass card: translucent navy, hairline border, sapphire top rim.
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'glass-raised text-card-foreground flex flex-col gap-4 rounded-lg py-5 transition-[border-color,box-shadow,transform] duration-300',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-col gap-1.5 px-5', className)} {...props} />
}

// Card titles are set in Playfair Display (headline-sm).
function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('font-display text-lg font-semibold leading-tight', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('text-muted-foreground text-sm', className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-action" className={cn('ml-auto', className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-5', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex items-center px-5', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter }
