import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import CharacterCount from '@tiptap/extension-character-count';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { LegacySync } from './legacySync';
import { ParagraphFormat } from './indent';
import { Bookmark, BlockCommands, MsxCell, MsxHeader, MsxHr, MsxImage, MsxTable, PageBreak, TableRow, TextBox } from './blocks';

/** Everything the Word-style editor needs. Order matters little; LegacySync works on every transaction. */
export const buildExtensions = () => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    horizontalRule: false,
    link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
  }),
  MsxTable.configure({ resizable: true }),
  TableRow,
  MsxHeader,
  MsxCell,
  MsxImage.configure({ allowBase64: true }),
  TextBox,
  MsxHr,
  PageBreak,
  Bookmark,
  BlockCommands,
  TextStyle,
  FontFamily,
  FontSize,
  Color,
  Highlight.configure({ multicolor: true }),
  Subscript,
  Superscript,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  CharacterCount,
  ParagraphFormat,
  LegacySync,
];
