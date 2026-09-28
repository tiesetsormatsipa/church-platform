'use client';

import { MEDIA_RULES, type MediaDto, type MediaPurpose, PURPOSE_RULES } from '@church/shared';
import { Button } from '@church/ui/button';
import { toast } from '@church/ui/toast';
import { Upload } from 'lucide-react';
import * as React from 'react';
import { api } from '@/lib/api/client';

/**
 * Choosing a file and getting it into storage.
 *
 * Three steps, because the API never carries the bytes: ask for a signed address, PUT the
 * file straight there, then tell the API it landed. The browser does the transfer itself, so
 * a two-hundred-megabyte sermon never passes through the application server.
 *
 * The file is checked here for size and type before anything is asked for — not because the
 * server trusts it (it checks the bytes that actually arrive) but because telling somebody
 * their file is too large before a long upload is plain good manners.
 */
export function UploadButton({
  purpose,
  label = 'Upload a file',
  onUploaded,
  disabled,
}: {
  purpose: MediaPurpose;
  label?: string;
  onUploaded: (media: MediaDto) => void;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);

  const kind = PURPOSE_RULES[purpose].kind;
  const rules = MEDIA_RULES[kind];
  const accept = rules.types.join(',');
  const maxMb = Math.round(rules.maxBytes / (1024 * 1024));

  async function choose(file: File) {
    if (!(rules.types as readonly string[]).includes(file.type)) {
      toast({ title: 'That kind of file cannot be used here', tone: 'error' });
      return;
    }
    if (file.size > rules.maxBytes) {
      toast({ title: `Keep it under ${maxMb} MB`, tone: 'error' });
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      const { data: ticket, error } = await api.POST('/api/v1/media/uploads', {
        body: {
          purpose,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        },
      });
      if (error || !ticket) throw new Error('no ticket');

      await put(ticket.url, ticket.headers, file, setProgress);

      const { data: media, error: failed } = await api.POST('/api/v1/media/{id}/complete', {
        params: { path: { id: ticket.mediaId } },
        body: {},
      });
      if (failed || !media) throw new Error('rejected');

      onUploaded(media);
      toast({ title: 'Uploaded', tone: 'success' });
    } catch {
      toast({
        title: 'That file could not be uploaded',
        description: 'Check your connection and try again.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void choose(file);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        loading={busy}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Upload aria-hidden="true" />
        {label}
      </Button>
      {progress !== null ? (
        <p className="text-sm text-muted" role="status">
          {progress < 100 ? `Sending… ${progress}%` : 'Finishing…'}
        </p>
      ) : (
        <p className="text-xs text-muted">Up to {maxMb} MB</p>
      )}
    </div>
  );
}

/**
 * XMLHttpRequest rather than fetch, only because it reports progress. On a phone on a slow
 * connection a sermon takes minutes, and a button that simply sits there looks broken.
 */
function put(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed: ${request.status}`));
    request.onerror = () => reject(new Error('Upload failed'));
    request.send(file);
  });
}
