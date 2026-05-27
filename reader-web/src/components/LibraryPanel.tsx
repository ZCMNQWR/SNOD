import { useMemo, useState, useRef } from 'react';
import type { AvailableFile } from '../services/api';
import { removeFile, uploadFile } from '../services/api';

function formatTimeAgo(epoch?: number) {
  if (!epoch) return '';
  const delta = Math.max(0, Date.now() - epoch);
  const minutes = Math.floor(delta / 1000 / 60);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function LibraryPanel(props: {
  files: AvailableFile[];
  onClose: () => void;
  onSelect: (file: AvailableFile) => void;
  onRemove: (file: AvailableFile) => Promise<boolean>;
  canUpload?: boolean;
  maxUploadBytes?: number;
}) {
  const { files, onClose, onSelect, onRemove, canUpload = true, maxUploadBytes = 200 * 1024 * 1024 } = props;
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AvailableFile | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter(f => f.name.toLowerCase().includes(q) || (f.type || '').toLowerCase().includes(q));
  }, [files, query]);

  

  const safeEpoch = (val?: string | number): number | undefined => {
    if (val === undefined || val === null) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  };

  const formatFriendlyDate = (val?: string | number): string => {
    // Prefer numeric epoch if provided, otherwise try to parse ISO string
    const epoch = safeEpoch(val ?? (typeof val === 'string' ? Date.parse(val as string) : undefined));
    if (epoch && Number.isFinite(epoch)) {
      try {
        return new Date(epoch).toLocaleString();
      } catch {
        return '';
      }
    }

    // Fallback: if val is an ISO string, try to create Date
    if (typeof val === 'string') {
      const parsed = Date.parse(val);
      if (Number.isFinite(parsed)) {
        try { return new Date(parsed).toLocaleString(); } catch { return ''; }
      }
    }

    return '';
  };

  const uploadLimitMb = Math.max(1, Math.round(maxUploadBytes / 1024 / 1024));

  const uploadBlockedMessage = 'Upload is not available right now.';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
      <div style={{ width: '80%', maxWidth: '900px', height: '80%', background: '#121212', color: '#fff', borderRadius: 8, padding: 16, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input placeholder="Search files or types..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #333', background: '#0f0f0f', color: '#fff' }} />
          <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            
            if (!canUpload) {
              alert(uploadBlockedMessage);
              if (inputRef.current) inputRef.current.value = '';
              return;
            }

            if (f.size > maxUploadBytes) {
              alert(`File "${f.name}" is too large! Maximum upload size is ${uploadLimitMb}MB.`);
              if (inputRef.current) inputRef.current.value = '';
              return;
            }

            try {
              setUploading(true);
              const uploaded = await uploadFile(f);
              // Build AvailableFile-like object to pass back to parent
              const newFile: AvailableFile = {
                id: uploaded?.id || uploaded?.name || f.name,
                name: uploaded?.name || f.name,
                type: (uploaded?.type) || (f.name.split('.').pop() || 'txt'),
                lastModifiedEpoch: uploaded?.lastModifiedEpoch ? Number(uploaded.lastModifiedEpoch) : f.lastModified || Date.now(),
                lastModified: uploaded?.lastModified || new Date(f.lastModified || Date.now()).toISOString(),
                addedEpoch: uploaded?.addedEpoch ? Number(uploaded.addedEpoch) : Date.now(),
              } as AvailableFile;

              onSelect(newFile);
            } catch (err) {
              console.error('Upload failed', err);
            } finally {
              setUploading(false);
              if (inputRef.current) inputRef.current.value = '';
            }
          }} />
          <button onClick={() => {
            if (!canUpload) {
              alert(uploadBlockedMessage);
              return;
            }
            inputRef.current?.click();
          }} disabled={uploading || !canUpload} style={{ padding: '8px 12px', borderRadius: 6, background: '#2b2b2b', color: '#fff', border: 'none', cursor: 'pointer', opacity: uploading || !canUpload ? 0.55 : 1 }}>{uploading ? 'Uploading...' : '[+] Add'}</button>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 6, background: '#2b2b2b', color: '#fff', border: 'none', cursor: 'pointer' }}>Close</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ color: '#999', padding: 20 }}>No files match your search.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
              {filtered.map(f => (
                <div key={f.id} onClick={() => onSelect(f)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 6, background: '#0b0b0b', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 18 }}>{f.type === 'pdf' ? '📕' : f.type === 'docx' ? '📘' : f.type === 'pptx' ? '📙' : '📁'}</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontWeight: 600 }}>{f.name}</div>
                      <div style={{ color: '#999', fontSize: 12 }}>
                        {f.type.toUpperCase()} •
                        <span style={{ marginLeft: 6 }} title={formatFriendlyDate(f.addedEpoch ?? f.lastModifiedEpoch) || (f.lastModified || '')}>
                          Added {formatTimeAgo(safeEpoch(f.addedEpoch) ?? safeEpoch(f.lastModifiedEpoch))}
                        </span>
                        {/* Last opened moved to the right-side meta area */}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: '#999', fontSize: 12 }} title={ formatFriendlyDate(f.lastOpened || f.lastOpenedEpoch) || (f.lastModified || '') }>
                      {(() => {
                        const opened = safeEpoch(f.lastOpenedEpoch);
                        const modified = safeEpoch(f.lastModifiedEpoch);
                        if (opened) {
                          const txt = formatTimeAgo(opened);
                          return txt === 'just now' ? `Last opened just now` : `Last opened ${txt} ago`;
                        }
                        if (modified) {
                          const txt = formatTimeAgo(modified);
                          return txt === 'just now' ? `${txt}` : `${txt} ago`;
                        }
                        return '';
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingDelete(f);
                      }}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.35)', color: '#fecaca', cursor: 'pointer', fontSize: 12 }}
                    >
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {pendingDelete && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}
            onClick={() => setPendingDelete(null)}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{ width: 'min(520px, 92vw)', borderRadius: 10, background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 60px rgba(0,0,0,0.45)', padding: 18 }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Delete this file?</div>
              <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
                Choose whether to remove <span style={{ fontWeight: 600 }}>{pendingDelete.name}</span> from the library only, or delete its saved progress and notes too.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: '#1f2937', color: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const target = pendingDelete;
                    if (!target) return;

                    try {
                      await removeFile(target.id, false);
                    } catch (err) {
                      // Continue to verification below; the backend may have deleted the file
                      // before returning an error.
                      console.warn(err);
                    }

                    const removed = await onRemove(target);
                    if (removed) {
                      setPendingDelete(null);
                      return;
                    }

                    alert(`Failed to delete "${target.name}".`);
                  }}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(153,27,27,0.75)', color: '#fff', cursor: 'pointer' }}
                >
                  Delete file only
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const target = pendingDelete;
                    if (!target) return;

                    try {
                      await removeFile(target.id, true);
                    } catch (err) {
                      // Continue to verification below; the backend may have deleted the file
                      // before returning an error.
                      console.warn(err);
                    }

                    const removed = await onRemove(target);
                    if (removed) {
                      setPendingDelete(null);
                      return;
                    }

                    alert(`Failed to delete "${target.name}".`);
                  }}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.95)', color: '#fff', cursor: 'pointer' }}
                >
                  Delete file + notes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
