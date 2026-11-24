import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import DrawingNodeView from './DrawingNodeView';

export interface DrawingOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawing: {
      setDrawing: (options: { data: any }) => ReturnType;
    };
  }
}

export const Drawing = Node.create<DrawingOptions>({
  name: 'drawing',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      data: {
        default: null,
        parseHTML: element => {
          const data = element.getAttribute('data-drawing');
          return data ? JSON.parse(data) : null;
        },
        renderHTML: attributes => {
          if (!attributes.data) {
            return {};
          }
          return {
            'data-drawing': JSON.stringify(attributes.data),
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-drawing]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingNodeView);
  },

  addCommands() {
    return {
      setDrawing:
        options =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});

export default Drawing;
