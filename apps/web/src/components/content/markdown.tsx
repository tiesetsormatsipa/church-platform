import { cn } from '@church/ui/lib/cn';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

/**
 * Renders content bodies. Raw HTML is dropped (`skipHtml`) and the output is sanitised, so
 * editors cannot inject scripts even by accident (ADR-014).
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose-church', className)}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children: text }) => {
            const external = typeof href === 'string' && /^https?:\/\//.test(href);
            return (
              <a href={href} {...(external ? { rel: 'noopener noreferrer nofollow', target: '_blank' } : {})}>
                {text}
              </a>
            );
          },
          h1: ({ children: text }) => <h2>{text}</h2>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
