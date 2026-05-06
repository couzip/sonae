'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Loader2, Send, Wrench } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface QueryBarProps {
  municipalityCode: string;
  municipalityName: string;
}

export function QueryBar({ municipalityCode, municipalityName }: QueryBarProps) {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/ask',
      body: { municipality_code: municipalityCode },
    }),
  });
  const [input, setInput] = useState('');
  const isStreaming = status === 'submitted' || status === 'streaming';

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const STICK_THRESHOLD_PX = 80;

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    stickToBottom.current = distFromBottom < STICK_THRESHOLD_PX;
  };

  useEffect(() => {
    if (!stickToBottom.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    stickToBottom.current = true;
    void sendMessage({ text });
    setInput('');
  };

  return (
    <section className="border-hairline border-hairline rounded-cockpit p-4 bg-bg-raised/40">
      <header className="mb-3">
        <h3 className="font-sans text-base text-ink">Sonae に質問</h3>
        <p className="text-xs text-ink-mute mt-0.5">
          {municipalityName} の地域防災計画と 74 項目の対策マスターから根拠付きで回答します
        </p>
      </header>

      {messages.length > 0 && (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex flex-col gap-3 mb-3 max-h-[480px] overflow-y-auto pr-1 scroll-smooth"
        >
          {messages.map((m) => (
            <MessageBlock key={m.id} message={m} />
          ))}
        </div>
      )}

      {error && (
        <div className="border-hairline border-scale-lg/70 rounded-cockpit p-2 mb-3 bg-bg-raised/40">
          <p className="text-xs text-scale-lg">{error.message}</p>
        </div>
      )}

      <form onSubmit={submit} className="flex items-stretch gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例: 高齢の母と暮らしているが、まず何をすべき?"
          disabled={isStreaming}
          className="flex-1 bg-bg-sunken border-hairline border-hairline rounded-cockpit px-3 py-2 text-sm text-ink placeholder:text-ink-dim focus:outline-none focus:border-accent disabled:opacity-50"
          aria-label="Sonae への質問"
        />
        <button
          type="submit"
          disabled={isStreaming || input.trim().length === 0}
          className="border-hairline border-accent/60 rounded-cockpit px-3 text-accent hover:bg-accent-soft/40 transition-colors disabled:opacity-40 flex items-center justify-center"
          aria-label="送信"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </section>
  );
}

interface MessagePart {
  type: string;
  text?: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

interface UIMessageLike {
  id: string;
  role: string;
  parts: MessagePart[];
}

function MessageBlock({ message }: { message: UIMessageLike }) {
  const isUser = message.role === 'user';
  return (
    <div className={['flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start'].join(' ')}>
      <div className="text-[10px] font-mono uppercase tracking-cockpit text-ink-dim">
        {isUser ? 'YOU' : 'SONAE'}
      </div>
      <div
        className={[
          'max-w-[90%] rounded-cockpit px-3 py-2 border-hairline',
          isUser
            ? 'border-ink-dim/30 bg-bg-sunken text-ink'
            : 'border-accent/30 bg-accent-soft/15 text-ink',
        ].join(' ')}
      >
        {message.parts.map((part, i) => (
          <PartBlock key={i} part={part} isUser={isUser} />
        ))}
      </div>
    </div>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 text-sm">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed mb-0.5">{children}</li>,
  h1: ({ children }) => <h4 className="font-sans text-sm text-ink mt-2 mb-1">{children}</h4>,
  h2: ({ children }) => <h4 className="font-sans text-sm text-ink mt-2 mb-1">{children}</h4>,
  h3: ({ children }) => <h5 className="font-sans text-sm text-ink mt-1.5 mb-1">{children}</h5>,
  h4: ({ children }) => <h5 className="font-sans text-sm text-ink mt-1.5 mb-1">{children}</h5>,
  strong: ({ children }) => <strong className="text-ink font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-ink-mute italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent underline underline-offset-2 hover:text-accent/80"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const inline = !className;
    return inline ? (
      <code className="font-mono text-[12px] bg-bg-sunken/60 border-hairline border-hairline rounded px-1 py-px">
        {children}
      </code>
    ) : (
      <code className={className}>{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="font-mono text-[11px] bg-bg-sunken/60 border-hairline border-hairline rounded-cockpit p-2 mb-2 overflow-x-auto whitespace-pre-wrap break-words">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent/50 pl-2 my-2 text-ink-mute">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-hairline border-hairline/60" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-hairline border-hairline px-2 py-1 text-left font-sans text-ink">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-hairline border-hairline/60 px-2 py-1 align-top">{children}</td>
  ),
};

// SLM が `\rightarrow` 等の TeX 記法を吐いた場合の defense in depth (system prompt でも禁止済)。
const LATEX_TOKENS: Array<[RegExp, string]> = [
  [/\\rightarrow|\\to(?!\w)/g, '→'],
  [/\\leftarrow|\\gets/g, '←'],
  [/\\uparrow/g, '↑'],
  [/\\downarrow/g, '↓'],
  [/\\Rightarrow/g, '⇒'],
  [/\\Leftarrow/g, '⇐'],
  [/\\times/g, '×'],
  [/\\cdot/g, '・'],
];

function stripLatex(text: string): string {
  let out = text;
  for (const [re, sub] of LATEX_TOKENS) out = out.replace(re, sub);
  out = out.replace(/\$([^$\n]{1,80})\$/g, '$1');
  out = out.replace(/\\\(([^)]{1,80})\\\)/g, '$1');
  return out;
}

function PartBlock({ part, isUser }: { part: MessagePart; isUser: boolean }) {
  if (part.type === 'text' && part.text) {
    if (isUser) {
      return <p className="text-sm leading-relaxed whitespace-pre-wrap">{part.text}</p>;
    }
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {stripLatex(part.text)}
      </ReactMarkdown>
    );
  }
  if (part.type.startsWith('tool-')) {
    const toolName = part.type.slice('tool-'.length);
    const isComplete = part.state === 'output-available' || part.state === 'output-error';
    return (
      <div className="mt-1.5 mb-1.5 border-hairline border-ink-dim/30 rounded-cockpit p-2 bg-bg-sunken/40 text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-ink-mute">
          <Wrench className="h-3 w-3" aria-hidden />
          <span>{toolName}</span>
          {!isComplete && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        {part.state === 'output-error' && part.errorText && (
          <div className="mt-1 text-scale-lg">{part.errorText}</div>
        )}
      </div>
    );
  }
  return null;
}
