import React, { useState, useRef, useEffect, type CSSProperties } from 'react';
import type { HighlightEntry } from '../types/notes';

interface NotesSidebarProps {
  currentPage: number;
  totalPages: number;
  width: number;
  note: string;
  highlights: HighlightEntry[];
  onClose: () => void;
  onResizeMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onNoteChange: (value: string) => void;
  onHighlightCommentChange: (highlightId: string, comment: string) => void;
  onRemoveHighlight: (highlightId: string) => void;
  onRenameHighlight: (highlightId: string, name: string) => void;
  selectedHighlightId?: string | null;
  onSelectHighlight?: (id: string | null) => void;
}

export default function NotesSidebar({
  currentPage,
  totalPages,
  width,
  note,
  highlights,
  onClose,
  onResizeMouseDown,
  onNoteChange,
  onHighlightCommentChange,
  onRemoveHighlight,
  onRenameHighlight,
  selectedHighlightId,
  onSelectHighlight,
}: NotesSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [noteHeight, setNoteHeight] = useState<number>(140);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const handleMove = (ev: globalThis.MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = ev.clientY - resizeRef.current.startY;
      const next = Math.max(80, Math.min(800, resizeRef.current.startHeight + delta));
      setNoteHeight(next);
    };

    const handleUp = () => { 
      resizeRef.current = null; 
      window.removeEventListener('mousemove', handleMove); 
      window.removeEventListener('mouseup', handleUp); 
    };

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const getDefaultName = (text: string) => {
    const words = text.trim().split(/\s+/);
    if (words.length <= 3) return text;
    return `${words.slice(0, 3).join(' ')}...`;
  };

  const handleSaveRename = (highlightId: string) => {
    if (editValue.trim() !== '') {
      onRenameHighlight(highlightId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <aside
      onClick={(e) => e.stopPropagation()} // <-- FIX: Stops clicks inside sidebar from triggering background unselection
      style={{
        width: isMobile ? '100vw' : width,
        minWidth: isMobile ? '100vw' : 260,
        maxWidth: isMobile ? '100vw' : '60vw',
        height: '100%',
        background: 'linear-gradient(180deg, #111827 0%, #0f172a 100%)',
        color: '#e5e7eb',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '-10px 0 24px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column',
        position: isMobile ? 'absolute' : 'relative',
        zIndex: isMobile ? 50 : 1,
        right: 0,
        overflow: 'hidden',
      }}
    >
      {!isMobile && (
        <div
          onMouseDown={onResizeMouseDown}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 8,
            cursor: 'col-resize',
            background: 'transparent',
            zIndex: 2,
          }}
          aria-hidden="true"
        />
      )}

      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Notes</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Page {currentPage} / {totalPages}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            borderRadius: 6,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>

      <div style={{ padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        <section>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>Page note</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Write notes for this page..."
              style={{
                width: '100%',
                height: noteHeight,
                resize: 'none',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: '#fff',
                padding: 12,
                boxSizing: 'border-box',
                outline: 'none',
                lineHeight: 1.5,
              }}
            />

            <div
              onMouseDown={(e: React.MouseEvent) => {
                e.preventDefault();
                resizeRef.current = { startY: e.clientY, startHeight: noteHeight };
                const handleMove = (ev: globalThis.MouseEvent) => {
                  if (!resizeRef.current) return;
                  const delta = ev.clientY - resizeRef.current.startY;
                  const next = Math.max(80, Math.min(800, resizeRef.current.startHeight + delta));
                  setNoteHeight(next);
                };
                const handleUp = () => {
                  resizeRef.current = null;
                  window.removeEventListener('mousemove', handleMove);
                  window.removeEventListener('mouseup', handleUp);
                };
                window.addEventListener('mousemove', handleMove);
                window.addEventListener('mouseup', handleUp);
              }}
              onTouchStart={(e: React.TouchEvent) => {
                resizeRef.current = { startY: e.touches[0].clientY, startHeight: noteHeight };
                const handleTouchMove = (ev: globalThis.TouchEvent) => {
                  if (!resizeRef.current) return;
                  const delta = ev.touches[0].clientY - resizeRef.current.startY;
                  const next = Math.max(80, Math.min(800, resizeRef.current.startHeight + delta));
                  setNoteHeight(next);
                };
                const handleTouchEnd = () => {
                  resizeRef.current = null;
                  window.removeEventListener('touchmove', handleTouchMove);
                  window.removeEventListener('touchend', handleTouchEnd);
                };
                window.addEventListener('touchmove', handleTouchMove, { passive: true });
                window.addEventListener('touchend', handleTouchEnd);
              }}
              style={{ height: 8, cursor: 'ns-resize', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-hidden="true"
            >
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }} />
            </div>
          </div>
          {!note.trim() && highlights.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>No notes yet.</div>
          )}
        </section>

        <section>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>Highlights</div>
          {highlights.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Select text in the document to create a highlight.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {highlights.map((highlight) => {
                const isSelected = selectedHighlightId === highlight.id;
                const isEditing = editingId === highlight.id;
                const displayName = highlight.customName || getDefaultName(highlight.text);

                return (
                  <div
                    key={highlight.id}
                    onClick={(e) => {
                      e.stopPropagation(); // Stop parent bubble sequence
                      onSelectHighlight?.(highlight.id);
                    }}
                    style={{
                      background: isSelected ? 'linear-gradient(90deg, rgba(245,158,11,0.12), rgba(250,204,21,0.06))' : 'rgba(255,255,255,0.05)',
                      border: isSelected ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      padding: 12,
                      cursor: 'pointer',
                      transition: 'border-color 0.2s ease, background 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveRename(highlight.id)}
                          onClick={(e) => e.stopPropagation()} 
                          onMouseDown={(e) => e.stopPropagation()} 
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(highlight.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          style={{
                            background: '#facc15',
                            color: '#111827',
                            borderRadius: '12px',
                            padding: '2px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            border: '1px solid #ffffff',
                            outline: 'none',
                            width: '130px',
                            boxSizing: 'border-box'
                          }}
                        />
                      ) : (
                        <div 
                          title="Click to rename tag"
                          onClick={(e) => {
                            e.stopPropagation(); 
                            setEditingId(highlight.id);
                            setEditValue(displayName);
                          }}
                          style={{ 
                            display: 'inline-block', 
                            background: '#facc15', 
                            color: '#111827', 
                            borderRadius: 999, 
                            padding: '2px 10px', 
                            fontSize: 11, 
                            fontWeight: 700,
                            cursor: 'text',
                            border: '1px solid transparent',
                            userSelect: 'none'
                          }}
                        >
                          {displayName}
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveHighlight(highlight.id);
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: 12,
                          padding: '2px 4px',
                          transition: 'color 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                      >
                        Remove
                      </button>
                    </div>
                    
                    <textarea
                      value={highlight.comment}
                      onChange={(event) => onHighlightCommentChange(highlight.id, event.target.value)}
                      onClick={(e) => e.stopPropagation()} 
                      placeholder="Add a comment for this highlight..."
                      style={{
                        width: '100%',
                        minHeight: 88,
                        resize: 'vertical',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.04)',
                        color: '#fff',
                        padding: 10,
                        boxSizing: 'border-box',
                        outline: 'none',
                        lineHeight: 1.45,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}