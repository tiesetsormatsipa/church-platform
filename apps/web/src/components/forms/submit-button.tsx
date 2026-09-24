'use client';

import { Button, type ButtonProps } from '@church/ui/button';
import { useHydrated } from '@/lib/hooks/use-hydrated';

/**
 * Submit button for client-side forms. Disabled until the page is hydrated, so nothing can
 * be submitted natively (which would put the form's contents in the URL) or typed into a
 * form that is about to be reset.
 */
export function SubmitButton({ disabled, ...props }: Omit<ButtonProps, 'type'>) {
  const hydrated = useHydrated();
  return <Button {...props} type="submit" disabled={!hydrated || disabled} />;
}
