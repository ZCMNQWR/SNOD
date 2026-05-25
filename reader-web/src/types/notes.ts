export interface HighlightEntry {
  id: string;
  page: number;
  text: string;
  comment: string;
  createdAt: number;
  occurrenceIndex: number;
  customName?: string;
}

export interface PageNoteEntry {
  note: string;
  highlights: HighlightEntry[];
}

export type NotesByPage = Record<number, PageNoteEntry>;