'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3,
  Quote, Code, Undo, Redo, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />;
}

// ─── PolicyEditor ─────────────────────────────────────────────────────────────

interface PolicyEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

export function PolicyEditor({
  content,
  onChange,
  placeholder = 'Start writing your policy…',
  className,
  minHeight = 300,
}: PolicyEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {},
        orderedList: {},
        blockquote: {},
        codeBlock: {},
        horizontalRule: {},
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className={cn('border border-gray-200 rounded-xl overflow-hidden bg-white', className)}>
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <ToolbarButton
          title="Bold (⌘B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic (⌘I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
        >
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="Blockquote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
        >
          <Quote className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Code block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
        >
          <Code className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="Undo (⌘Z)"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Redo (⌘⇧Z)"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor content area */}
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm max-w-none px-5 py-4 focus-visible:outline-none',
          'prose-headings:font-semibold prose-headings:text-gray-900',
          'prose-p:text-gray-700 prose-p:leading-relaxed',
          'prose-li:text-gray-700',
          'prose-blockquote:border-l-indigo-300 prose-blockquote:text-gray-600',
          'prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:rounded prose-code:px-1',
        )}
        style={{ minHeight }}
      />
    </div>
  );
}

// ─── Helper to convert markdown to HTML for initial content ──────────────────

export function markdownToSimpleHtml(markdown: string): string {
  if (!markdown) return '';

  // Check if it's already HTML
  if (markdown.trim().startsWith('<')) return markdown;

  // Basic markdown → HTML conversion for initial load
  return markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/, '<ul>$1</ul>')
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|u|o|b|p|l])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}
