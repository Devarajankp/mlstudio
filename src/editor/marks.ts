import type { Mark } from '@tiptap/pm/model';
import { normalizeFamilyValue, seriesOfFamily } from '../lib/fonts';
import type { Series } from '../lib/legacy';

/** Font family name carried by a set of marks (textStyle.fontFamily), or null for the default font. */
export function familyOfMarks(marks: readonly Mark[]): string | null {
  for (const m of marks) {
    if (m.type.name === 'textStyle' && m.attrs.fontFamily) return normalizeFamilyValue(m.attrs.fontFamily as string);
  }
  return null;
}

export function seriesOfMarks(marks: readonly Mark[]): Series {
  const f = familyOfMarks(marks);
  return f ? seriesOfFamily(f) : 'unicode';
}
