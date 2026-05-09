'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import Image from '@tiptap/extension-image';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
// @hocuspocus/provider — dynamically imported to avoid SSR issues
import type { Editor } from '@tiptap/core';
import {
  Bold, Italic, UnderlineIcon, Strikethrough, Highlighter,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, ListChecks,
  Heading2, Heading3,
  Quote, Code, Minus, Link2, Link2Off,
  Table as TableIcon, Undo, Redo,
  ChevronDown, Users, Wifi, WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Slash command types ──────────────────────────────────────────────────────

interface SlashCommandItem {
  title: string;
  description: string;
  keywords: string[];  // aliases for filtering (e.g. "h1", "h2")
  command: (editor: Editor) => void;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  { title: 'Heading 1', description: 'Large section heading',     keywords: ['h1','heading1','heading 1','title'], command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: 'Heading 2', description: 'Medium section heading',    keywords: ['h2','heading2','heading 2','subtitle'], command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: 'Heading 3', description: 'Small section heading',     keywords: ['h3','heading3','heading 3'], command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: 'Paragraph', description: 'Plain text paragraph',      keywords: ['p','text','normal','para'], command: (e) => e.chain().focus().setParagraph().run() },
  { title: 'Bullet List', description: 'Unordered bullet list',   keywords: ['ul','bullet','list','unordered'], command: (e) => e.chain().focus().toggleBulletList().run() },
  { title: 'Numbered List', description: 'Ordered numbered list', keywords: ['ol','numbered','ordered','number'], command: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: 'Task List', description: 'Checklist with checkboxes', keywords: ['todo','task','check','checkbox'], command: (e) => e.chain().focus().toggleTaskList().run() },
  { title: 'Blockquote', description: 'Indented quote block',     keywords: ['quote','bq','blockquote'], command: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: 'Code Block', description: 'Monospaced code block',    keywords: ['code','pre','snippet','mono'], command: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: 'Table', description: '3×3 table',                     keywords: ['table','grid','tbl'], command: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: 'Divider', description: 'Horizontal rule',             keywords: ['hr','rule','divider','separator','line'], command: (e) => e.chain().focus().setHorizontalRule().run() },
];

// ─── Slash command menu ───────────────────────────────────────────────────────

function SlashMenu({
  items,
  selectedIndex,
  onSelect,
}: {
  items: SlashCommandItem[];
  selectedIndex: number;
  onSelect: (item: SlashCommandItem) => void;
}) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (items.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-64 max-h-72 overflow-y-auto z-50">
      {items.map((item, i) => (
        <button
          key={item.title}
          ref={(el) => { itemRefs.current[i] = el; }}
          type="button"
          className={cn(
            'w-full text-left px-3 py-2 flex flex-col transition-colors',
            i === selectedIndex ? 'bg-indigo-50' : 'hover:bg-gray-50',
          )}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
        >
          <span className="text-sm font-medium text-gray-800">{item.title}</span>
          <span className="text-xs text-gray-500">{item.description}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded transition-colors disabled:opacity-30',
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />;
}

// ─── Text style dropdown ──────────────────────────────────────────────────────

function StyleDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current =
    editor.isActive('heading', { level: 1 }) ? 'Heading 1' :
    editor.isActive('heading', { level: 2 }) ? 'Heading 2' :
    editor.isActive('heading', { level: 3 }) ? 'Heading 3' :
    'Normal';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const options = [
    { label: 'Normal',    action: () => editor.chain().focus().setParagraph().run() },
    { label: 'Heading 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Heading 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors min-w-[90px]"
        onClick={() => setOpen((o) => !o)}
      >
        {current}
        <ChevronDown className="w-3 h-3 ml-auto" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-36 overflow-hidden">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 text-gray-700"
              onMouseDown={(e) => { e.preventDefault(); o.action(); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Link dialog ──────────────────────────────────────────────────────────────

function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [url, setUrl] = useState(editor.getAttributes('link').href ?? '');

  const apply = () => {
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    onClose();
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-md">
      <input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }}
        placeholder="https://…"
        className="text-sm border-0 outline-none w-56 text-gray-800"
      />
      <button type="button" onClick={apply} className="text-xs text-indigo-600 font-medium hover:text-indigo-800">Apply</button>
      <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
    </div>
  );
}

// ─── Floating selection toolbar (replaces BubbleMenu from v2) ────────────────

function FloatingSelectionMenu({ editor }: { editor: Editor }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [showLink, setShowLink] = useState(false);

  // Track selection changes to show/hide the floating menu
  useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      from: e.state.selection.from,
      to:   e.state.selection.to,
    }),
  });

  useEffect(() => {
    const updatePos = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0) { setPos(null); return; }
      const editorEl = document.querySelector('.tiptap-editor');
      if (!editorEl) { setPos(null); return; }
      const editorRect = editorEl.getBoundingClientRect();
      setPos({
        top:  rect.top  - editorRect.top - 44,
        left: rect.left - editorRect.left + rect.width / 2 - 120,
      });
    };

    document.addEventListener('selectionchange', updatePos);
    return () => document.removeEventListener('selectionchange', updatePos);
  }, []);

  if (!pos) return null;

  return (
    <div
      className="absolute z-50 flex items-center gap-0.5 bg-gray-900 rounded-lg px-2 py-1.5 shadow-xl pointer-events-auto"
      style={{ top: pos.top, left: Math.max(0, pos.left) }}
    >
      {[
        { title: 'Bold',        mark: 'bold',      label: 'B',  cls: 'font-bold' },
        { title: 'Italic',      mark: 'italic',    label: 'I',  cls: 'italic' },
        { title: 'Underline',   mark: 'underline', label: 'U',  cls: 'underline' },
        { title: 'Strikethrough', mark: 'strike',  label: 'S',  cls: 'line-through' },
      ].map(({ title, mark, label, cls }) => (
        <button
          key={mark}
          type="button"
          title={title}
          className={cn(
            'p-1 rounded text-xs transition-colors',
            cls,
            editor.isActive(mark) ? 'text-white' : 'text-gray-300 hover:text-white',
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleMark(mark).run();
          }}
        >{label}</button>
      ))}
      <div className="w-px h-4 bg-gray-600 mx-0.5" />
      <button
        type="button"
        title="Highlight"
        className={cn('p-1 rounded text-xs transition-colors', editor.isActive('highlight') ? 'text-yellow-300' : 'text-gray-300 hover:text-white')}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHighlight().run(); }}
      >◈</button>
      <button
        type="button"
        title="Link"
        className={cn('p-1 rounded text-xs transition-colors', (editor.isActive('link') || showLink) ? 'text-indigo-300' : 'text-gray-300 hover:text-white')}
        onMouseDown={(e) => { e.preventDefault(); setShowLink((v) => !v); }}
      >🔗</button>
      {showLink && (
        <div className="absolute top-full left-0 mt-1">
          <LinkDialog editor={editor} onClose={() => setShowLink(false)} />
        </div>
      )}
    </div>
  );
}

// ─── PolicyEditor ─────────────────────────────────────────────────────────────

export interface PolicyEditorProps {
  content:        string;
  onChange?:      (html: string) => void;
  readOnly?:      boolean;
  placeholder?:   string;
  className?:     string;
  minHeight?:     number;
  showWordCount?: boolean;
  /** Collaborative editing options. When provided, enables Yjs + Hocuspocus real-time sync. */
  collaborativeOptions?: {
    documentId: string;
    userToken:  string;
    userName?:  string;
    userColor?: string;
    serverUrl?: string;  // defaults to ws://localhost:1234
  };
}

export function PolicyEditor({
  content,
  onChange,
  readOnly      = false,
  placeholder   = 'Start writing…',
  className,
  minHeight     = 300,
  showWordCount = true,
  collaborativeOptions,
}: PolicyEditorProps) {
  // Yjs document ref (only created when collaborative mode enabled)
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<any>(null);
  const [collabConnected, setCollabConnected] = useState(false);
  const [collabUsers, setCollabUsers] = useState(0);

  // Initialize Yjs + Hocuspocus provider when collaborative mode requested
  useEffect(() => {
    if (!collaborativeOptions) return;
    const { documentId, userToken, serverUrl = 'ws://localhost:1234' } = collaborativeOptions;
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Dynamic import to avoid SSR issues
    import('@hocuspocus/provider').then(({ HocuspocusProvider }) => {
      const provider = new HocuspocusProvider({
        url:          serverUrl,
        name:         'doc:' + documentId,
        token:        userToken,
        document:     ydoc,
        onConnect:    () => setCollabConnected(true),
        onDisconnect: () => setCollabConnected(false),
        onAwarenessUpdate: ({ states }: any) => setCollabUsers(states.length),
      });
      providerRef.current = provider;
    }).catch(() => {});

    return () => {
      providerRef.current?.destroy();
      ydocRef.current?.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collaborativeOptions?.documentId]);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Slash command state
  const [slashQuery, setSlashQuery] = useState('');
  const [slashOpen,  setSlashOpen]  = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashPos,   setSlashPos]   = useState<{ top: number; left: number } | null>(null);
  const slashStartRef = useRef<number | null>(null);

  const filteredCommands = slashQuery
    ? SLASH_COMMANDS.filter((c) => {
        const q = slashQuery.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.keywords.some((k) => k.startsWith(q) || k.includes(q))
        );
      })
    : SLASH_COMMANDS;

  const closeSlash = useCallback(() => {
    setSlashOpen(false);
    setSlashQuery('');
    slashStartRef.current = null;
  }, []);

  const editor = useEditor({
    immediatelyRender: false,   // required for Next.js SSR compatibility
    extensions: [
      // When collaborative: disable StarterKit history (Yjs provides CRDT undo/redo)
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Disable extensions we add separately to avoid "duplicate extension" warnings in TipTap v3
        link: false,
        underline: false,
        ...(collaborativeOptions && ydocRef.current ? { history: false } : {}),
      }),
      // Collaboration extension (Yjs) — only when collaborative mode active
      ...(collaborativeOptions && ydocRef.current
        ? [Collaboration.configure({ document: ydocRef.current })]
        : []),
      Placeholder.configure({ placeholder }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-indigo-600 underline' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Image.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg' } }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => onChange?.(e.getHTML()),
    editorProps: {
      handleKeyDown: (view, event) => {
        // Slash command trigger
        if (event.key === '/' && !slashOpen) {
          const { from } = view.state.selection;
          slashStartRef.current = from;
          setSlashQuery('');
          setSlashOpen(true);
          setSlashIndex(0);
          const coords = view.coordsAtPos(from);
          const editorRect = (view.dom as HTMLElement).closest('.tiptap-editor')?.getBoundingClientRect()
            ?? (view.dom as HTMLElement).getBoundingClientRect();
          setSlashPos({ top: coords.bottom - editorRect.top + 4, left: coords.left - editorRect.left });
          return false;
        }
        if (slashOpen) {
          if (event.key === 'Escape') { closeSlash(); return true; }
          if (event.key === 'ArrowDown') { event.preventDefault(); setSlashIndex((i) => (i + 1) % Math.max(1, filteredCommands.length)); return true; }
          if (event.key === 'ArrowUp')   { event.preventDefault(); setSlashIndex((i) => (i - 1 + Math.max(1, filteredCommands.length)) % Math.max(1, filteredCommands.length)); return true; }
          if (event.key === 'Enter' && filteredCommands[slashIndex]) {
            event.preventDefault();
            const start = slashStartRef.current ?? view.state.selection.from;
            editor?.chain().focus().deleteRange({ from: start, to: view.state.selection.from + 1 }).run();
            filteredCommands[slashIndex].command(editor!);
            closeSlash();
            return true;
          }
          if (event.key === 'Backspace' && slashQuery.length === 0) { closeSlash(); return false; }
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
            setSlashQuery((q) => q + event.key);
            setSlashIndex(0);
          }
        }
        return false;
      },
    },
  });

  // Sync content when prop changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Sync editable state when readOnly prop changes (TipTap doesn't do this automatically)
  useEffect(() => {
    if (editor && editor.isEditable === readOnly) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  if (!editor) return null;

  const wordCount = editor.storage.characterCount?.words?.() ?? 0;

  return (
    <div className={cn('border border-gray-200 rounded-xl overflow-hidden bg-white flex flex-col', className)}>

      {/* ── Fixed Toolbar ── */}
      {!readOnly && (
        <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
          <StyleDropdown editor={editor} />
          <Sep />

          <ToolbarButton title="Bold (⌘B)"       active={editor.isActive('bold')}      onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Italic (⌘I)"     active={editor.isActive('italic')}    onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Underline (⌘U)"  active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Strikethrough"    active={editor.isActive('strike')}    onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Highlight"        active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter className="w-3.5 h-3.5" /></ToolbarButton>
          <Sep />

          <ToolbarButton title="Align left"   active={editor.isActive({ textAlign: 'left' })}   onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Align right"  active={editor.isActive({ textAlign: 'right' })}  onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="w-3.5 h-3.5" /></ToolbarButton>
          <Sep />

          <ToolbarButton title="Bullet list"   active={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Task list"     active={editor.isActive('taskList')}    onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks className="w-3.5 h-3.5" /></ToolbarButton>
          <Sep />

          <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-3.5 h-3.5" /></ToolbarButton>
          <Sep />

          <ToolbarButton title="Blockquote"  active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Code block"  active={editor.isActive('codeBlock')}  onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="w-3.5 h-3.5" /></ToolbarButton>
          <Sep />

          <ToolbarButton title="Link" active={editor.isActive('link')} onClick={() => setShowLinkDialog((v) => !v)}><Link2 className="w-3.5 h-3.5" /></ToolbarButton>
          {editor.isActive('link') && (
            <ToolbarButton title="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}><Link2Off className="w-3.5 h-3.5" /></ToolbarButton>
          )}
          <Sep />

          <ToolbarButton title="Undo (⌘Z)"   disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Redo (⌘⇧Z)"  disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo className="w-3.5 h-3.5" /></ToolbarButton>
        </div>
      )}

      {/* Collaborative indicator */}
      {collaborativeOptions && (
        <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-100 bg-white text-xs">
          {collabConnected ? (
            <><Wifi className="h-3 w-3 text-emerald-500" /><span className="text-emerald-600 font-medium">Live</span></>
          ) : (
            <><WifiOff className="h-3 w-3 text-gray-400" /><span className="text-gray-400">Connecting…</span></>
          )}
          {collabConnected && collabUsers > 0 && (
            <span className="flex items-center gap-1 text-gray-500">
              <Users className="h-3 w-3" />
              {collabUsers} {collabUsers === 1 ? 'person' : 'people'} editing
            </span>
          )}
        </div>
      )}

      {/* Link dialog */}
      {showLinkDialog && !readOnly && (
        <div className="px-3 py-2 border-b border-gray-100 bg-white">
          <LinkDialog editor={editor} onClose={() => setShowLinkDialog(false)} />
        </div>
      )}

      {/* ── Editor Content + floating overlays ── */}
      <div className="relative flex-1 tiptap-editor">
        {/* Floating selection toolbar */}
        {!readOnly && <FloatingSelectionMenu editor={editor} />}

        <EditorContent
          editor={editor}
          className={cn(
            'prose prose-sm max-w-none px-5 py-4 focus-visible:outline-none',
            'prose-headings:font-semibold prose-headings:text-gray-900',
            'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
            'prose-p:text-gray-700 prose-p:leading-relaxed',
            'prose-li:text-gray-700',
            'prose-blockquote:border-l-4 prose-blockquote:border-indigo-300 prose-blockquote:text-gray-600 prose-blockquote:pl-4',
            'prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:rounded prose-code:px-1 prose-code:text-sm',
            'prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:overflow-x-auto',
            readOnly && 'cursor-default',
          )}
          style={{ minHeight }}
        />

        {/* Slash command menu */}
        {slashOpen && slashPos && !readOnly && (
          <div className="absolute z-50" style={{ top: slashPos.top, left: slashPos.left }}>
            <SlashMenu
              items={filteredCommands}
              selectedIndex={slashIndex}
              onSelect={(item) => {
                const start = slashStartRef.current ?? editor.state.selection.from;
                editor.chain().focus().deleteRange({ from: start, to: editor.state.selection.from + 1 }).run();
                item.command(editor);
                closeSlash();
              }}
            />
          </div>
        )}
      </div>

      {/* ── Word count footer ── */}
      {showWordCount && (
        <div className="flex items-center justify-end px-4 py-1 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-400">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

// ─── Default export ───────────────────────────────────────────────────────────

export default PolicyEditor;

// ─── Markdown ↔ HTML utilities ────────────────────────────────────────────────

/**
 * Convert basic markdown to HTML for loading legacy policy content into the editor.
 */
export function markdownToSimpleHtml(markdown: string): string {
  if (!markdown) return '';
  if (markdown.trim().startsWith('<')) return markdown;

  let html = markdown
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    .replace(/^---$/gm, '<hr />')
    .replace(/^\s*[-*] \[ \] (.+)$/gm, '<li data-type="taskItem" data-checked="false">$1</li>')
    .replace(/^\s*[-*] \[x\] (.+)$/gm, '<li data-type="taskItem" data-checked="true">$1</li>')
    .replace(/^\s*[-*] (.+)$/gm, '<li class="ul-item">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ol-item">$1</li>');

  html = html.replace(/((?:<li class="ul-item">.*?<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/<li class="ul-item">/g, '<li>');
  html = html.replace(/((?:<li class="ol-item">.*?<\/li>\n?)+)/g, '<ol>$1</ol>');
  html = html.replace(/<li class="ol-item">/g, '<li>');

  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h[1-6]|ul|ol|blockquote|pre|hr)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return html;
}

/**
 * Convert TipTap HTML to Markdown for .md file export.
 * Pure DOM-based implementation — no external dependencies, no SSR issues.
 */
export function htmlToMarkdown(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, '');
  try {
    const el = document.createElement('div');
    el.innerHTML = html;

    function nodeToMd(node: Node): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return (node as Text).textContent ?? '';
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const inner = () => Array.from(el.childNodes).map(nodeToMd).join('');

      switch (tag) {
        case 'h1': return `# ${inner()}\n\n`;
        case 'h2': return `## ${inner()}\n\n`;
        case 'h3': return `### ${inner()}\n\n`;
        case 'h4': return `#### ${inner()}\n\n`;
        case 'h5': return `##### ${inner()}\n\n`;
        case 'h6': return `###### ${inner()}\n\n`;
        case 'p':  return `${inner()}\n\n`;
        case 'br': return '\n';
        case 'strong': case 'b': return `**${inner()}**`;
        case 'em': case 'i': return `*${inner()}*`;
        case 'u': return `__${inner()}__`;
        case 's': case 'del': return `~~${inner()}~~`;
        case 'code': return el.parentElement?.tagName?.toLowerCase() === 'pre' ? inner() : `\`${inner()}\``;
        case 'pre': return `\`\`\`\n${inner()}\n\`\`\`\n\n`;
        case 'blockquote': return inner().split('\n').map((l: string) => `> ${l}`).join('\n') + '\n\n';
        case 'a': return `[${inner()}](${el.getAttribute('href') ?? ''})`;
        case 'img': return `![${el.getAttribute('alt') ?? ''}](${el.getAttribute('src') ?? ''})`;
        case 'ul': {
          return Array.from(el.children).map((li) => {
            const checked = li.getAttribute('data-checked');
            const content = nodeToMd(li).replace(/^[-*]\s+/, '');
            if (checked !== null) return `- [${checked === 'true' ? 'x' : ' '}] ${content}`;
            return `- ${content}`;
          }).join('\n') + '\n\n';
        }
        case 'ol': {
          return Array.from(el.children).map((li, i) => `${i + 1}. ${nodeToMd(li).replace(/^\d+\.\s+/, '')}`).join('\n') + '\n\n';
        }
        case 'li': return inner().trim();
        case 'hr': return '---\n\n';
        case 'table': {
          const rows = Array.from(el.querySelectorAll('tr'));
          if (!rows.length) return '';
          const cells = (row: Element) => Array.from(row.querySelectorAll('th,td')).map(c => (c as HTMLElement).innerText.trim());
          const header = cells(rows[0]);
          const sep    = header.map(() => '---');
          const body   = rows.slice(1).map(r => cells(r));
          return [header, sep, ...body].map(r => `| ${r.join(' | ')} |`).join('\n') + '\n\n';
        }
        default: return inner();
      }
    }

    return nodeToMd(el).replace(/\n{3,}/g, '\n\n').trim();
  } catch {
    return html.replace(/<[^>]+>/g, '');
  }
}
