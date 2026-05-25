import type { AvailableFile } from '../services/api';

function safeEpoch(val?: string | number): number | undefined {
  if (val === undefined || val === null) return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function formatFriendly(val?: string | number): string {
  const epoch = safeEpoch(val ?? (typeof val === 'string' ? Date.parse(val as string) : undefined));
  if (epoch) return new Date(epoch).toLocaleString();
  if (typeof val === 'string') {
    const p = Date.parse(val);
    if (Number.isFinite(p)) return new Date(p).toLocaleString();
  }
  return '';
}

export default function InfoModal(props: { file: AvailableFile | null; onClose: () => void; totalPages?: number }) {
  const { file, onClose, totalPages } = props;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 92vw)', borderRadius: 10, background: '#0b1220', color: '#fff', padding: 18, boxSizing: 'border-box', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{file ? file.name : 'App information'}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>Close</button>
        </div>

        {file ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: '#cbd5e1' }}>Type: <span style={{ color: '#fff', fontWeight: 600 }}>{file.type}</span></div>
            <div style={{ color: '#cbd5e1' }}>Added: <span title={formatFriendly(file.addedEpoch || file.lastModifiedEpoch)} style={{ color: '#fff', fontWeight: 600 }}>{formatFriendly(file.addedEpoch || file.lastModifiedEpoch) || '—'}</span></div>
            <div style={{ color: '#cbd5e1' }}>Last opened: <span title={formatFriendly(file.lastOpenedEpoch || file.lastOpened)} style={{ color: '#fff', fontWeight: 600 }}>{formatFriendly(file.lastOpenedEpoch || file.lastOpened) || '—'}</span></div>
            <div style={{ color: '#cbd5e1' }}>Last modified: <span title={file.lastModified || ''} style={{ color: '#fff', fontWeight: 600 }}>{file.lastModified ? formatFriendly(file.lastModified) : '—'}</span></div>
            <div style={{ color: '#cbd5e1' }}>Pages: <span style={{ color: '#fff', fontWeight: 600 }}>{totalPages ?? file?.totalPages ?? '—'}</span></div>
          </div>
        ) : (
          <div style={{ color: '#cbd5e1' }}>
            <p>This reader app lets you view PDF, DOCX, PPTX and plain text files. Open the Library to add files.</p>
          </div>
        )}
      </div>
    </div>
  );
}
