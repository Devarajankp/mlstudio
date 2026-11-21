import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphFormat: {
      /** Set left indent and first-line indent (px) of the selected paragraphs/headings. */
      setIndents: (left: number, first: number) => ReturnType;
      /** Set line height multiplier (null = default). */
      setLineSpacing: (value: number | null) => ReturnType;
      /** Space before / after the paragraph in pt (null = default). */
      setParaSpacing: (before: number | null, after: number | null) => ReturnType;
    };
  }
}

const TYPES = ['paragraph', 'heading'];

/** Paragraph-level formatting that the ruler edits: left indent, first-line / hanging indent, line spacing. */
export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',
  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          indentLeft: {
            default: 0,
            parseHTML: (el) => parseFloat((el as HTMLElement).style.marginLeft) || 0,
            renderHTML: (attrs) => (attrs.indentLeft ? { style: `margin-left:${attrs.indentLeft}px` } : {}),
          },
          indentFirst: {
            default: 0,
            parseHTML: (el) => parseFloat((el as HTMLElement).style.textIndent) || 0,
            renderHTML: (attrs) => (attrs.indentFirst ? { style: `text-indent:${attrs.indentFirst}px` } : {}),
          },
          spaceBefore: {
            default: null,
            parseHTML: (el) => {
              const v = parseFloat((el as HTMLElement).style.marginTop);
              return Number.isFinite(v) ? Math.round((v * 72) / 96) : null;
            },
            renderHTML: (attrs) => (attrs.spaceBefore != null ? { style: `margin-top:${attrs.spaceBefore}pt` } : {}),
          },
          spaceAfter: {
            default: null,
            parseHTML: (el) => {
              const v = parseFloat((el as HTMLElement).style.marginBottom);
              return Number.isFinite(v) ? Math.round((v * 72) / 96) : null;
            },
            renderHTML: (attrs) => (attrs.spaceAfter != null ? { style: `margin-bottom:${attrs.spaceAfter}pt` } : {}),
          },
          lineSpacing: {
            default: null,
            parseHTML: (el) => parseFloat((el as HTMLElement).style.lineHeight) || null,
            renderHTML: (attrs) => (attrs.lineSpacing ? { style: `line-height:${attrs.lineSpacing}` } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setIndents:
        (left, first) =>
        ({ commands }) =>
          TYPES.map((t) => commands.updateAttributes(t, { indentLeft: Math.max(0, Math.round(left)), indentFirst: Math.round(first) })).some(Boolean),
      setParaSpacing:
        (before, after) =>
        ({ commands }) =>
          TYPES.map((t) => commands.updateAttributes(t, { spaceBefore: before, spaceAfter: after })).some(Boolean),
      setLineSpacing:
        (value) =>
        ({ commands }) =>
          TYPES.map((t) => commands.updateAttributes(t, { lineSpacing: value })).some(Boolean),
    };
  },
  addKeyboardShortcuts() {
    const step = 48; // 0.5 inch, like Word's Tab-stop indent
    return {
      'Mod-m': () => {
        const a = this.editor.getAttributes('paragraph');
        return this.editor.commands.setIndents((a.indentLeft || 0) + step, a.indentFirst || 0);
      },
      'Mod-Shift-m': () => {
        const a = this.editor.getAttributes('paragraph');
        return this.editor.commands.setIndents(Math.max(0, (a.indentLeft || 0) - step), a.indentFirst || 0);
      },
    };
  },
});
