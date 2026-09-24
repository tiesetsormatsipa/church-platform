'use client';

import { useEffect, useState } from 'react';

type ToastMessage = {
  id: number;
  title: string;
  description?: string;
};

export function Toaster() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<Omit<ToastMessage, 'id'>>).detail;
      const id = Date.now();
      setMessages((current) => [...current.slice(-2), { id, ...detail }]);
      window.setTimeout(() => {
        setMessages((current) => current.filter((message) => message.id !== id));
      }, 4500);
    };

    window.addEventListener('church-platform:toast', onToast);
    return () => window.removeEventListener('church-platform:toast', onToast);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className="rounded-lg border border-gold/30 bg-navy px-4 py-3 text-white shadow-navy"
          role="status"
        >
          <p className="font-body text-sm font-semibold leading-snug">{message.title}</p>
          {message.description && (
            <p className="mt-1 font-body text-xs leading-relaxed text-white/75">{message.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
