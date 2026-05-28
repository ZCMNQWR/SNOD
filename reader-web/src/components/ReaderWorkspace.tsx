import { useState, useEffect, type CSSProperties, type RefObject, type MouseEvent as ReactMouseEvent } from 'react';
import { TxtViewer } from './TxtViewer';
import { PdfViewer } from './PdfViewer';
import { DocxViewer } from './DocxViewer';
import ReaderToolbar from './ReaderToolbar';
import LibraryPanel from './LibraryPanel';
import InfoModal from './InfoModal';
import NotesSidebar from './NotesSidebar';
import type { AvailableFile } from '../services/api';
import type { HighlightEntry, NotesByPage } from '../types/notes';

interface ReaderWorkspaceProps {
  shellRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  pageChangeSourceRef: RefObject<'manual' | 'scroll' | null>;
  selectedFile: AvailableFile;
  activeLibrary: AvailableFile[];
  libraryOpen: boolean;
  infoOpen: boolean;
  currentPage: number;
  zoom: number;
  viewMode: 'single' | 'scroll';
  isFullPage: boolean;
  userId: string;
  syncStatus: string;
  notesOpen: boolean;
  notesPanelWidth: number;
  notesText: string;
  currentHighlights: HighlightEntry[];
  totalPages: number;
  selectedHighlightId: string | null;
  notesByPage: NotesByPage;
  isHighlightMode: boolean;
  manualScrollNonce: number;
  onToggleHighlightMode: () => void;
  onOpenLibrary: () => void;
  onCloseLibrary: () => void;
  onSelectLibraryFile: (file: AvailableFile) => Promise<void> | void;
  onRemoveLibraryFile: (file: AvailableFile) => Promise<boolean>;
  onSetCurrentPageFromManualAction: (page: number) => void;
  onSetCurrentPageFromScroll: (page: number) => void;
  onSetZoom: (value: number | ((current: number) => number)) => void;
  onSetViewMode: (value: 'single' | 'scroll') => void;
  onToggleFullPage: () => void;
  onSignOut: () => void;
  onOpenNotes: () => void;
  onOpenInfo: () => void;
  onCloseInfo: () => void;
  onSaveProgress: () => void;
  onSetTotalPages: (totalPages: number) => void;
  onSetSyncStatus: (status: string) => void;
  onSetSelectedHighlightId: (id: string | null) => void;
  onCloseNotes: () => void;
  onResizeNotesMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onUpdateNote: (value: string) => void;
  onUpdateHighlightComment: (highlightId: string, comment: string) => void;
  onRemoveHighlight: (highlightId: string) => void;
  onRenameHighlight: (highlightId: string, name: string) => void;
}

export default function ReaderWorkspace({
  shellRef,
  viewportRef,
  pageChangeSourceRef,
  selectedFile,
  activeLibrary,
  libraryOpen,
  infoOpen,
  currentPage,
  zoom,
  viewMode,
  isFullPage,
  userId,
  syncStatus,
  notesOpen,
  notesPanelWidth,
  notesText,
  currentHighlights,
  totalPages,
  selectedHighlightId,
  notesByPage,
  isHighlightMode,
  manualScrollNonce,
  onToggleHighlightMode,
  onOpenLibrary,
  onCloseLibrary,
  onSelectLibraryFile,
  onRemoveLibraryFile,
  onSetCurrentPageFromManualAction,
  onSetCurrentPageFromScroll,
  onSetZoom,
  onSetViewMode,
  onToggleFullPage,
  onSignOut,
  onOpenNotes,
  onOpenInfo,
  onCloseInfo,
  onSaveProgress,
  onSetTotalPages,
  onSetSyncStatus,
  onSetSelectedHighlightId,
  onCloseNotes,
  onResizeNotesMouseDown,
  onUpdateNote,
  onUpdateHighlightComment,
  onRemoveHighlight,
  onRenameHighlight,
}: ReaderWorkspaceProps) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [toolbarVisible, setToolbarVisible] = useState(true);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const shellStyle: CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    width: '100%',
    height: '100dvh',
    position: 'relative',
    margin: '0',
    padding: '0',
    border: 'none',
    borderRadius: '0',
    boxShadow: 'none',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fff',
    overflow: 'hidden'
  };

  const viewportStyle: CSSProperties = {
    flex: 1,
    width: '100%',
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#808080',
    position: 'relative',
    boxSizing: 'border-box'
  };

  const handleSelectHighlight = (id: string | null) => {
    onSetSelectedHighlightId(id);
    if (id) {
      onOpenNotes();
    }
  };

  return (
    <div ref={shellRef} style={shellStyle}>
      <div 
        style={{ 
          display: isMobile && !toolbarVisible ? 'none' : 'block', 
          flexShrink: 0, 
          position: isMobile ? 'absolute' : 'relative', 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 100 
        }}
      >
        <ReaderToolbar
          selectedFile={selectedFile}
          currentPage={currentPage}
          totalPages={totalPages}
          zoom={zoom}
          viewMode={viewMode}
          isFullPage={isFullPage}
          userId={userId}
          syncStatus={syncStatus}
          onOpenLibrary={onOpenLibrary}
          onSetCurrentPage={onSetCurrentPageFromManualAction}
          onSetZoom={onSetZoom}
          onSetViewMode={onSetViewMode}
          onToggleFullPage={onToggleFullPage}
          onSignOut={onSignOut}
          onOpenNotes={onOpenNotes}
          onOpenInfo={onOpenInfo}
          onSaveProgress={onSaveProgress}
          onPageChangeSourceManual={() => { pageChangeSourceRef.current = 'manual'; }}
        />
      </div>

      {libraryOpen && (
        <LibraryPanel
          files={activeLibrary}
          canUpload={true}
          maxUploadBytes={200 * 1024 * 1024}
          onClose={onCloseLibrary}
          onSelect={async (file) => {
            await onSelectLibraryFile(file);
            onCloseLibrary();
          }}
          onRemove={onRemoveLibraryFile}
        />
      )}

      {infoOpen && (
        <InfoModal
          file={selectedFile}
          totalPages={totalPages}
          onClose={onCloseInfo}
        />
      )}

      <div 
        onClick={() => onSetSelectedHighlightId(null)}
        style={{ 
          display: 'flex', 
          flex: 1, 
          minHeight: 0, 
          width: '100%', 
          position: 'relative',
          flexDirection: isMobile ? 'column' : 'row' 
        }}
      >
        <div 
          ref={viewportRef} 
          style={viewportStyle}
          onClick={() => {
            if (isMobile) {
              setToolbarVisible((prev) => !prev);
            }
          }}
        >
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'flex-start', 
              width: '100%', 
              minHeight: '100%', 
              padding: isMobile ? '8px' : '16px', 
              boxSizing: 'border-box'
            }}
          >
            {selectedFile?.type === 'txt' && (
              <TxtViewer
                file={selectedFile}
                currentPage={currentPage}
                zoom={zoom}
                onTotalPagesChange={onSetTotalPages}
                viewMode={viewMode}
                onCurrentPageChange={onSetCurrentPageFromScroll}
                scrollContainerRef={viewportRef}
                pageChangeSourceRef={pageChangeSourceRef}
                manualScrollNonce={manualScrollNonce}
                highlightsByPage={notesByPage}
                selectedHighlightId={selectedHighlightId}
                onSelectHighlight={handleSelectHighlight}
              />
            )}
            {selectedFile?.type === 'pdf' && (
              <PdfViewer
                file={selectedFile}
                currentPage={currentPage}
                zoom={zoom}
                onTotalPagesChange={onSetTotalPages}
                viewMode={viewMode}
                onCurrentPageChange={onSetCurrentPageFromScroll}
                scrollContainerRef={viewportRef}
                pageChangeSourceRef={pageChangeSourceRef}
                manualScrollNonce={manualScrollNonce}
                highlightsByPage={notesByPage}
                selectedHighlightId={selectedHighlightId}
                onSelectHighlight={handleSelectHighlight}
              />
            )}
            {selectedFile?.type === 'docx' && (
              <DocxViewer
                file={selectedFile}
                currentPage={currentPage}
                zoom={zoom}
                onTotalPagesChange={onSetTotalPages}
                onStatusChange={onSetSyncStatus}
                viewMode={viewMode}
                onCurrentPageChange={onSetCurrentPageFromScroll}
                scrollContainerRef={viewportRef}
                pageChangeSourceRef={pageChangeSourceRef}
                manualScrollNonce={manualScrollNonce}
                highlightsByPage={notesByPage}
                selectedHighlightId={selectedHighlightId}
                onSelectHighlight={handleSelectHighlight}
              />
            )}
          </div>
        </div>

        {notesOpen && (
          <NotesSidebar
            currentPage={currentPage}
            totalPages={totalPages}
            width={notesPanelWidth}
            note={notesText}
            highlights={currentHighlights}
            selectedHighlightId={selectedHighlightId}
            onSelectHighlight={onSetSelectedHighlightId}
            onClose={onCloseNotes}
            onResizeMouseDown={onResizeNotesMouseDown}
            onNoteChange={onUpdateNote}
            onHighlightCommentChange={onUpdateHighlightComment}
            onRemoveHighlight={onRemoveHighlight}
            onRenameHighlight={onRenameHighlight}
          />
        )}
      </div>

      {/* FIXED MOBILE VIEW HIGHLIGHT TOGGLE */}
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleHighlightMode();
        }}
        style={{
          position: 'fixed', 
          bottom: isMobile ? '16px' : '32px',
          right: (!isMobile && notesOpen) ? `${notesPanelWidth + 32}px` : '32px',
          padding: isMobile ? '0' : '0 20px',
          width: isMobile ? '48px' : 'auto',
          height: isMobile ? '48px' : '48px',
          borderRadius: isMobile ? '24px' : '24px',
          backgroundColor: isHighlightMode ? '#facc15' : '#1e293b',
          color: isHighlightMode ? '#111827' : '#fff',
          border: isHighlightMode ? '2px solid #eab308' : '2px solid rgba(255,255,255,0.1)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer',
          zIndex: isMobile ? 40 : 9999, 
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        title={isHighlightMode ? "Highlight Mode: ON" : "Highlight Mode: OFF"}
        aria-label="Toggle Highlight Mode"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l-6 6v3h9l3-3" />
          <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
        </svg>
        {!isMobile && (
          <span style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap' }}>
            Highlight
          </span>
        )}
      </button>
    </div>
  );
}