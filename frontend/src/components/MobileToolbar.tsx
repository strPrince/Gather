'use client';

import React from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Type,
  Heading1,
  Heading2,
} from 'lucide-react';

interface MobileToolbarProps {
  editor: any;
}

export default function MobileToolbar({ editor }: MobileToolbarProps) {
  if (!editor) return null;

  const toolbarButtons = [
    {
      icon: <Bold className="w-4 h-4" />,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      label: 'Bold',
    },
    {
      icon: <Italic className="w-4 h-4" />,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      label: 'Italic',
    },
    {
      icon: <UnderlineIcon className="w-4 h-4" />,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
      label: 'Underline',
    },
    {
      icon: <Heading1 className="w-4 h-4" />,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
      label: 'H1',
    },
    {
      icon: <Heading2 className="w-4 h-4" />,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
      label: 'H2',
    },
    {
      icon: <List className="w-4 h-4" />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
      label: 'Bullet List',
    },
    {
      icon: <ListOrdered className="w-4 h-4" />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
      label: 'Numbered List',
    },
    {
      icon: <AlignLeft className="w-4 h-4" />,
      action: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: editor.isActive({ textAlign: 'left' }),
      label: 'Align Left',
    },
    {
      icon: <AlignCenter className="w-4 h-4" />,
      action: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: editor.isActive({ textAlign: 'center' }),
      label: 'Align Center',
    },
    {
      icon: <AlignRight className="w-4 h-4" />,
      action: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: editor.isActive({ textAlign: 'right' }),
      label: 'Align Right',
    },
    {
      icon: <Undo className="w-4 h-4" />,
      action: () => editor.chain().focus().undo().run(),
      isActive: false,
      label: 'Undo',
    },
    {
      icon: <Redo className="w-4 h-4" />,
      action: () => editor.chain().focus().redo().run(),
      isActive: false,
      label: 'Redo',
    },
  ];

  return (
    <div className="mobile-toolbar md:hidden bg-[var(--bg-secondary)] border-b border-[var(--border)] p-2 flex gap-1 overflow-x-auto">
      {toolbarButtons.map((button, index) => (
        <button
          key={index}
          onClick={button.action}
          className={`
            flex items-center justify-center
            min-w-[44px] h-[44px]
            rounded-lg
            transition-colors
            ${
              button.isActive
                ? 'bg-[var(--accent)] text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 active:bg-gray-600'
            }
          `}
          title={button.label}
          aria-label={button.label}
        >
          {button.icon}
        </button>
      ))}
    </div>
  );
}
