import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const buttonVariants = cva('inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-orange-500 disabled:pointer-events-none disabled:opacity-50', { variants: { variant: { default: 'bg-primary text-white hover:bg-[#244774]', outline: 'border border-border bg-white text-foreground hover:bg-slate-50', ghost: 'hover:bg-slate-100 text-muted-foreground', accent: 'bg-orange-500 text-white hover:bg-orange-600' }, size: { default: 'h-10 px-4', sm: 'h-8 px-3 text-xs', icon: 'h-9 w-9' } }, defaultVariants: { variant: 'default', size: 'default' } });
export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
