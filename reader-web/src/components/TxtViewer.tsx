import { useState, useEffect, type RefObject, type ReactNode } from 'react';
import { getFileStreamUrl } from '../services/api';
import type { AvailableFile } from '../services/api';
import type { HighlightEntry, NotesByPage } from '../types/notes';

interface TxtViewerProps {
  file: AvailableFile;
  currentPage: number;
  zoom: number;
  onTotalPagesChange: (total: number) => void;
  viewMode: 'single' | 'scroll';
  onCurrentPageChange: (page: number) => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  pageChangeSourceRef: RefObject<'manual' | 'scroll' | null>;
  highlightsByPage: NotesByPage;
  selectedHighlightId?: string | null;
  onSelectHighlight?: (id: string | null) => void;
}

const normalizeSelectionText = (value: string) => value.replace(/\s+/g, ' ').trim();

function renderHighlightedText(text: string, highlights: HighlightEntry[], selectedId?: string | null, onSelectHighlight?: (id: string| null) => void): ReactNode {
  const matches: Array<{ start: number; end: number; highlight: HighlightEntry }> = [];

  // Build normalized string and an index map from normalized index -> original index
  const indexMap: number[] = [];
  let normalizedBuilder = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      // collapse consecutive whitespace to a single space in normalized
      if (normalizedBuilder.endsWith(' ')) {
        continue;
      }
      normalizedBuilder += ' ';
      indexMap.push(i);
    } else {
      normalizedBuilder += ch;
      indexMap.push(i);
    }
  }

  const normalizedLower = normalizedBuilder.toLowerCase();

  highlights.forEach((highlight) => {
    const target = normalizeSelectionText(highlight.text).toLowerCase();
    if (!target) return;

    let startIdx = 0;
    while (true) {
      const found = normalizedLower.indexOf(target, startIdx);
      if (found === -1) break;

      const origStart = indexMap[found] ?? 0;
      const endNormIndex = found + target.length - 1;
      const origEnd = (indexMap[endNormIndex] ?? origStart) + 1; // exclusive

      matches.push({ start: origStart, end: origEnd, highlight });
      startIdx = found + target.length;
    }
  });

  if (matches.length === 0) {
    return text;
  }

  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const ranges: Array<{ start: number; end: number; highlight: HighlightEntry }> = [];
  let cursor = 0;

  matches.forEach((match) => {
    if (match.start >= cursor) {
      ranges.push(match);
      cursor = match.end;
    }
  });

  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  ranges.forEach((range) => {
    if (lastIndex < range.start) {
      nodes.push(text.slice(lastIndex, range.start));
    }

    const isSelected = selectedId && selectedId === range.highlight.id;
    nodes.push(
      <mark
        key={`${range.highlight.id}-${range.start}`}
        title={range.highlight.comment || 'Highlight'}
        onClick={() => onSelectHighlight?.(range.highlight.id)}
        style={{
          backgroundColor: isSelected ? 'rgba(255,165,0,0.85)' : '#fde047',
          color: '#111827',
          padding: '0 2px',
          borderRadius: '3px',
          cursor: 'pointer',
          boxShadow: isSelected ? 'inset 0 -2px 0 rgba(0,0,0,0.08)' : 'none'
        }}
      >
        {text.slice(range.start, range.end)}
      </mark>
    );

    lastIndex = range.end;
  });

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function TxtViewer({ file, currentPage, zoom, onTotalPagesChange, viewMode, onCurrentPageChange, scrollContainerRef, pageChangeSourceRef, highlightsByPage, selectedHighlightId, onSelectHighlight }: TxtViewerProps) {
  const [txtPages, setTxtPages] = useState<string[]>([]);

  const splitTextIntoPages = (fullText: string, maxCharsPerPage = 2600) => {
    const normalizedText = fullText.replace(/\r\n/g, '\n').trim();
    if (!normalizedText) {
      return [''];
    }

    const paragraphs = normalizedText
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0);

    const pages: string[] = [];
    let currentPageText = '';

    const flushPage = () => {
      const trimmed = currentPageText.trim();
      if (trimmed.length > 0) {
        pages.push(trimmed);
      }
      currentPageText = '';
    };

    const appendParagraph = (paragraph: string) => {
      const nextText = currentPageText.length > 0 ? `${currentPageText}\n\n${paragraph}` : paragraph;

      if (nextText.length <= maxCharsPerPage) {
        currentPageText = nextText;
        return;
      }

      flushPage();

      if (paragraph.length <= maxCharsPerPage) {
        currentPageText = paragraph;
        return;
      }

      const words = paragraph.split(/\s+/);
      let chunk = '';

      words.forEach((word) => {
        const nextChunk = chunk.length > 0 ? `${chunk} ${word}` : word;
        if (nextChunk.length > maxCharsPerPage) {
          if (chunk.length > 0) {
            pages.push(chunk);
          }
          chunk = word;
        } else {
          chunk = nextChunk;
        }
      });

      currentPageText = chunk;
    };

    paragraphs.forEach(appendParagraph);
    flushPage();

    return pages.length > 0 ? pages : [normalizedText];
  };

  // Generic Pagination
  useEffect(() => {
    async function loadTxtFile() {
      try {
        const response = await fetch(getFileStreamUrl(file.id), {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        const fullText = await response.text();
        const pages = splitTextIntoPages(fullText);
        setTxtPages(pages);
        onTotalPagesChange(pages.length);
      } catch (err) {
        console.error(err);
      }
    }
    loadTxtFile();
  }, [file, onTotalPagesChange]);

  // Scroll to page when currentPage changes in scroll mode
  useEffect(() => {
    if (viewMode === 'scroll') {
      if (pageChangeSourceRef.current !== 'manual') {
        return;
      }

      setTimeout(() => {
        const element = document.getElementById(`txt-page-${currentPage}`);
        if (element) {
          element.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
        pageChangeSourceRef.current = null;
      }, 100);
    }
  }, [currentPage, pageChangeSourceRef, viewMode]);

  useEffect(() => {
    if (viewMode !== 'scroll' || txtPages.length === 0) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    let animationFrameId = 0;

    const updateCurrentPageFromScroll = () => {
      // If a manual page-change is flagged (for example when toggling
      // from single->scroll), do not override `currentPage` based on
      // container position until manual scroll completes.
      if (pageChangeSourceRef?.current === 'manual') {
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const topThreshold = containerRect.top + containerRect.height * 0.4;
      let pageAtTop = 1;

      for (let pageNum = 1; pageNum <= txtPages.length; pageNum += 1) {
        const element = document.getElementById(`txt-page-${pageNum}`);
        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (rect.top <= topThreshold) {
          pageAtTop = pageNum;
        } else {
          break;
        }
      }

      if (pageAtTop !== currentPage) {
        onCurrentPageChange(pageAtTop);
      }
    };

    const handleScroll = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(updateCurrentPageFromScroll);
    }

    updateCurrentPageFromScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [currentPage, onCurrentPageChange, scrollContainerRef, txtPages.length, viewMode, pageChangeSourceRef]);

  return (
    <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto', padding: '0 20px 20px', boxSizing: 'border-box', transform: `scale(${zoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
      {viewMode === 'scroll' ? (
        <div>
          {txtPages.map((page, index) => (
            <div key={index} id={`txt-page-${index + 1}`} style={{ marginBottom: '40px', padding: '28px 32px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 16px 40px rgba(0,0,0,0.14)', border: '1px solid rgba(0,0,0,0.08)', whiteSpace: 'pre-line', color: '#111', lineHeight: '1.7' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '14px', fontWeight: 'bold', fontStyle: 'normal' }}>--- Page {index + 1} ---</div>
              {renderHighlightedText(page, highlightsByPage[index + 1]?.highlights || [], selectedHighlightId, onSelectHighlight)}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '28px 32px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 16px 40px rgba(0,0,0,0.14)', border: '1px solid rgba(0,0,0,0.08)', whiteSpace: 'pre-line', color: '#111', lineHeight: '1.7' }}>
          {renderHighlightedText(txtPages[currentPage - 1] || 'Reading text stream...', highlightsByPage[currentPage]?.highlights || [], selectedHighlightId, onSelectHighlight)}
        </div>
      )}
    </div>
  );
}
