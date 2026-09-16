import React from 'react';
import { CheckSquare, Square } from 'lucide-react';

interface FormattedAiResponseProps {
    content: string;
    className?: string;
}

/**
 * Parses inline markdown: **bold**, __bold__, *italic*, _italic_, `code`
 */
export function renderInlineMarkdown(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    // Matches **bold**, __bold__, `code`, *italic*, _italic_
    const regex = /(\*\*(?:[^*]|\*(?!\*))+\*\*|__[^_]+__|`[^`]+`|\*(?:[^*]|\*\*)?\*|_[^_]+_)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }

        const matchText = match[0];

        if (
            (matchText.startsWith('**') && matchText.endsWith('**')) ||
            (matchText.startsWith('__') && matchText.endsWith('__'))
        ) {
            const inner = matchText.slice(2, -2);
            parts.push(
                <strong key={`b-${key++}`} className="font-semibold text-white">
                    {inner}
                </strong>
            );
        } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
            const inner = matchText.slice(1, -1);
            parts.push(
                <code
                    key={`c-${key++}`}
                    className="rounded bg-emerald-950/70 border border-emerald-500/30 px-1.5 py-0.5 text-[11px] font-mono text-emerald-300"
                >
                    {inner}
                </code>
            );
        } else if (
            (matchText.startsWith('*') && matchText.endsWith('*')) ||
            (matchText.startsWith('_') && matchText.endsWith('_'))
        ) {
            const inner = matchText.slice(1, -1);
            parts.push(
                <em key={`i-${key++}`} className="italic text-[#b5beb8]">
                    {inner}
                </em>
            );
        } else {
            parts.push(matchText);
        }

        lastIndex = match.index + matchText.length;
    }

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
}

/**
 * Premium UI renderer for AI Analyst responses that strips raw markdown characters (like ****, ###, etc.)
 * and renders clean, structured, formatted cards, badges, headings, and bullet points.
 */
export function FormattedAiResponse({ content, className = '' }: FormattedAiResponseProps) {
    if (!content) return null;

    const rawLines = content.split('\n');
    const blocks: React.ReactNode[] = [];
    let currentList: { type: 'ul' | 'ol' | 'checklist'; items: React.ReactNode[] } | null = null;

    const flushList = (key: number) => {
        if (!currentList) return;
        if (currentList.type === 'checklist') {
            blocks.push(
                <div key={`cl-${key}`} className="space-y-1.5 my-2.5">
                    {currentList.items}
                </div>
            );
        } else if (currentList.type === 'ol') {
            blocks.push(
                <ol key={`ol-${key}`} className="space-y-2 my-2.5 list-none">
                    {currentList.items}
                </ol>
            );
        } else {
            blocks.push(
                <ul key={`ul-${key}`} className="space-y-2 my-2.5 list-none">
                    {currentList.items}
                </ul>
            );
        }
        currentList = null;
    };

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i].trimEnd();
        const trimmed = line.trim();

        if (!trimmed) {
            flushList(i);
            continue;
        }

        // Headers: ### Title or ## Title or # Title
        const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            flushList(i);
            const level = headerMatch[1].length;
            const title = headerMatch[2];

            blocks.push(
                <div
                    key={`h-${i}`}
                    className={`flex items-center gap-2.5 ${
                        level <= 2
                            ? 'mt-4 mb-2.5 pt-3 border-t border-[#232b29] first:border-t-0 first:pt-0 first:mt-0'
                            : 'mt-3.5 mb-1.5'
                    }`}
                >
                    <span className="h-4 w-1 rounded-full bg-emerald-400 shrink-0" />
                    <h3
                        className={`font-bold tracking-tight text-white ${
                            level <= 2 ? 'text-xs sm:text-sm' : 'text-xs text-emerald-300'
                        }`}
                    >
                        {renderInlineMarkdown(title)}
                    </h3>
                </div>
            );
            continue;
        }

        // Checklist: - [ ] or - [x]
        const checkMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
        if (checkMatch) {
            if (!currentList || currentList.type !== 'checklist') {
                flushList(i);
                currentList = { type: 'checklist', items: [] };
            }
            const isChecked = checkMatch[1].toLowerCase() === 'x';
            const text = checkMatch[2];
            currentList.items.push(
                <div
                    key={`chk-${i}`}
                    className="flex items-start gap-2.5 rounded-lg border border-[#232b28] bg-[#141919]/60 px-3 py-2 text-xs text-[#c9d1cc]"
                >
                    {isChecked ? (
                        <CheckSquare className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                        <Square className="size-4 text-[#59645f] shrink-0 mt-0.5" />
                    )}
                    <span className={`flex-1 leading-relaxed ${isChecked ? 'line-through text-[#7b8580]' : ''}`}>
                        {renderInlineMarkdown(text)}
                    </span>
                </div>
            );
            continue;
        }

        // Unordered Bullet: - or * or •
        const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
            if (!currentList || currentList.type !== 'ul') {
                flushList(i);
                currentList = { type: 'ul', items: [] };
            }
            const text = bulletMatch[1];
            currentList.items.push(
                <li
                    key={`b-${i}`}
                    className="flex items-start gap-2.5 text-xs text-[#cad1cc] leading-relaxed pl-1"
                >
                    <span className="size-1.5 rounded-full bg-emerald-400 shrink-0 mt-2" />
                    <div className="flex-1">{renderInlineMarkdown(text)}</div>
                </li>
            );
            continue;
        }

        // Numbered list: 1. or 1)
        const numMatch = trimmed.match(/^(\d+)[\.\)]\s+(.+)$/);
        if (numMatch) {
            if (!currentList || currentList.type !== 'ol') {
                flushList(i);
                currentList = { type: 'ol', items: [] };
            }
            const num = numMatch[1];
            const text = numMatch[2];
            currentList.items.push(
                <li
                    key={`num-${i}`}
                    className="flex items-start gap-2.5 text-xs text-[#cad1cc] leading-relaxed pl-1"
                >
                    <span className="flex size-4.5 items-center justify-center rounded-md bg-emerald-950/80 border border-emerald-700/40 text-[10px] font-bold text-emerald-400 shrink-0 mt-0.5">
                        {num}
                    </span>
                    <div className="flex-1">{renderInlineMarkdown(text)}</div>
                </li>
            );
            continue;
        }

        // Horizontal rule
        if (/^(\*\*\*|---|___)$/.test(trimmed)) {
            flushList(i);
            blocks.push(<hr key={`hr-${i}`} className="my-3 border-[#262f2d]" />);
            continue;
        }

        // Standard Paragraph
        flushList(i);
        blocks.push(
            <p key={`p-${i}`} className="text-xs text-[#cbd2cd] leading-relaxed my-1.5">
                {renderInlineMarkdown(trimmed)}
            </p>
        );
    }

    flushList(rawLines.length);

    return <div className={`space-y-1 text-left ${className}`}>{blocks}</div>;
}
