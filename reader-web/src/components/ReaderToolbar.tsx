import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { AvailableFile } from '../services/api';

interface ReaderToolbarProps {
  selectedFile: AvailableFile | null;
  currentPage: number;
  totalPages: number;
  zoom: number;
  viewMode: 'single' | 'scroll';
  isFullPage: boolean;
  userId: string;
  syncStatus: string;
  onOpenLibrary: () => void;
  onSetCurrentPage: (page: number) => void;
  onSetZoom: (value: number | ((current: number) => number)) => void;
  onSetViewMode: (value: 'single' | 'scroll') => void;
  onToggleFullPage: () => void;
  onSignOut: () => void;
  onOpenNotes: () => void;
  onOpenInfo: () => void;
  onSaveProgress: () => void;
  onPageChangeSourceManual: () => void;
}

export default function ReaderToolbar({
  selectedFile,
  currentPage,
  totalPages,
  zoom,
  viewMode,
  isFullPage,
  userId,
  syncStatus,
  onOpenLibrary,
  onSetCurrentPage,
  onSetZoom,
  onSetViewMode,
  onToggleFullPage,
  onSignOut,
  onOpenNotes,
  onOpenInfo,
  onSaveProgress,
  onPageChangeSourceManual,
}: ReaderToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuHover, setMenuHover] = useState<'notes' | 'info' | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Keep a local scratchpad text variable that won't get erased by continuous scroll loops
  const [localInput, setLocalInput] = useState<string>(String(currentPage));

  // Sync the text box value ONLY when the page naturally shifts or updates
  useEffect(() => {
    setLocalInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuOpen) return;
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      setMenuOpen(false);
      setMenuHover(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen]);

  const handleMenuAction = (event: React.MouseEvent, action: () => void) => {
    event.preventDefault();
    setMenuHover(null);
    setMenuOpen(false);
    action();
  };

  // Styles
  const toolbarStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '12px 16px',
    backgroundColor: '#3C3C3C',
    color: '#fff',
    borderBottom: '1px solid #2C2C2C',
    flexShrink: 0,
    height: '56px',
    boxSizing: 'border-box'
  };

  const toolbarButtonStyle: CSSProperties = {
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#fff',
    transition: 'background 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  const dropdownActionButtonStyle = (isHovered: boolean, isDanger = false): CSSProperties => ({
    width: '100%',
    padding: '10px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    backgroundColor: isHovered ? 'rgba(96, 165, 250, 0.22)' : 'transparent',
    color: isDanger ? '#fca5a5' : isHovered ? '#ffffff' : '#dbeafe',
    textAlign: 'left',
    marginTop: isDanger ? '2px' : '0px'
  });

  return (
    <div style={toolbarStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div onClick={onOpenLibrary} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 4, backgroundColor: '#2b2b2b', cursor: 'pointer', color: '#fff', border: '1px solid #5C5C5C' }}>
            <div style={{ fontSize: 16 }}>{selectedFile?.type === 'pdf' ? '📕' : selectedFile?.type === 'docx' ? '📘' : ''}</div>
            <div style={{ fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile?.name}</div>
          </div>

          <button onClick={onOpenLibrary} style={{ padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', border: '1px solid #5C5C5C', backgroundColor: '#4C4C4C', color: '#fff' }}>
            Library
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          disabled={currentPage <= 1}
          onClick={() => {
            onPageChangeSourceManual();
            onSetCurrentPage(Math.max(1, currentPage - 1));
          }}
          style={{ ...toolbarButtonStyle, opacity: currentPage <= 1 ? 0.5 : 1 }}
          title="Previous page"
        >
          ◀
        </button>

        <input
          type="text"
          inputMode="numeric"
          value={localInput}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9]/g, '');
            setLocalInput(cleaned);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              return;
            }

            if (e.key === 'Escape') {
              setLocalInput(String(currentPage));
              e.currentTarget.blur();
              return;
            }

            if (e.key !== 'Enter') return;

            const val = parseInt(localInput, 10);
            if (!isNaN(val) && val >= 1 && val <= totalPages) {
              onPageChangeSourceManual();
              onSetCurrentPage(val);
              e.currentTarget.blur();
            } else {
              setLocalInput(String(currentPage));
            }
          }}
          onWheel={(e) => { e.preventDefault(); }}
          style={{ width: '50px', padding: '6px 8px', borderRadius: '4px', border: '1px solid #5C5C5C', backgroundColor: '#4C4C4C', color: '#fff', fontSize: '13px', textAlign: 'center', fontWeight: '500' }}
        />

        <span style={{ color: '#fff', fontSize: '13px', minWidth: '40px', textAlign: 'center' }}>/ {totalPages}</span>

        <button
          disabled={currentPage >= totalPages}
          onClick={() => {
            onPageChangeSourceManual();
            onSetCurrentPage(Math.min(totalPages, currentPage + 1));
          }}
          style={{ ...toolbarButtonStyle, opacity: currentPage >= totalPages ? 0.5 : 1 }}
          title="Next page"
        >
          ▶
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={onSignOut}
          style={{ ...toolbarButtonStyle, border: '1px solid rgba(255,255,255,0.18)', backgroundColor: 'rgba(31,41,55,0.7)' }}
          title="Sign out and clear this session"
        >
          Sign out
        </button>
        <button
          onClick={() => onSetZoom((current) => Math.max(50, current - 10))}
          style={toolbarButtonStyle}
          title="Zoom out"
        >
          −
        </button>

        <input
          type="number"
          min={50}
          max={200}
          value={zoom}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 50 && val <= 200) {
              onSetZoom(val);
            }
          }}
          style={{ width: '50px', padding: '6px 8px', borderRadius: '4px', border: '1px solid #5C5C5C', backgroundColor: '#4C4C4C', color: '#fff', fontSize: '13px', textAlign: 'center', fontWeight: '500' }}
        />

        <button
          onClick={() => onSetZoom(100)}
          style={{ ...toolbarButtonStyle, fontSize: '14px', fontWeight: 'bold' }}
          title="Reset zoom"
        >
          ↺
        </button>

        <button
          onClick={() => onSetZoom((current) => Math.min(200, current + 10))}
          style={toolbarButtonStyle}
          title="Zoom in"
        >
          +
        </button>

        <div style={{ width: '1px', height: '24px', backgroundColor: '#5C5C5C' }} />

        <button
          onClick={() => {
            if (viewMode === 'single') {
              onPageChangeSourceManual();
              onSetViewMode('scroll');
            } else {
              onSetViewMode('single');
            }
          }}
          style={toolbarButtonStyle}
          title={viewMode === 'scroll' ? 'Switch to single page view' : 'Switch to continuous scroll view'}
          aria-label={viewMode === 'scroll' ? 'Switch to single page view' : 'Switch to continuous scroll view'}
        >
          {viewMode === 'scroll' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>≡</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Scroll</span>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>▢</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Single</span>
            </span>
          )}
        </button>

        <button
          onClick={onToggleFullPage}
          style={toolbarButtonStyle}
          title={isFullPage ? 'Exit fullscreen' : 'Fullscreen'}
        >
          ⛶
        </button>

        <div style={{ width: '1px', height: '24px', backgroundColor: '#5C5C5C' }} />

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setMenuOpen(!menuOpen);
              setMenuHover(null);
            }}
            style={toolbarButtonStyle}
            title="More options"
          >
            ⋯
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              minWidth: '160px',
              padding: '8px',
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
              zIndex: 1000
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '2px' }}>
                  <div style={{ fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px' }}>
                    Signed in as
                  </div>
                  <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={userId}>
                    {userId}
                  </div>
                </div>
                
                <button
                  type="button"
                  onMouseDown={(e) => handleMenuAction(e, onOpenNotes)}
                  onMouseEnter={() => setMenuHover('notes')}
                  onMouseLeave={() => setMenuHover(null)}
                  style={dropdownActionButtonStyle(menuHover === 'notes')}
                >
                  Notes
                </button>
                
                <button
                  type="button"
                  onMouseDown={(e) => handleMenuAction(e, onOpenInfo)}
                  onMouseEnter={() => setMenuHover('info')}
                  onMouseLeave={() => setMenuHover(null)}
                  style={dropdownActionButtonStyle(menuHover === 'info')}
                >
                  Info
                </button>
                
                <button
                  type="button"
                  onMouseDown={(e) => handleMenuAction(e, onSaveProgress)}
                  style={dropdownActionButtonStyle(false)}
                >
                  Save progress
                </button>
                
                <div style={{ padding: '10px 12px 2px', fontSize: '12px', lineHeight: 1.4, color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '6px' }}>
                  {syncStatus}
                </div>
                
                <button
                  type="button"
                  onMouseDown={(e) => handleMenuAction(e, onSignOut)}
                  style={dropdownActionButtonStyle(false, true)}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}