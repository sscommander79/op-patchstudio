import { IconButton } from '../common/IconButton';
import type { PresetSummary } from '../../utils/indexedDB';
import {hasLibraryPreview} from './useLibraryPreview';

interface LibraryTableContentProps {
  presets: PresetSummary[];
  selectedPresets: Set<string>;
  onToggleSelection: (presetId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleFavorite: (preset: PresetSummary) => void;
  onEditMetadata: (preset: PresetSummary) => void;
  onPreviewPreset: (preset: PresetSummary) => void;
  onStopPreview: () => void;
  previewingId: string | null;
  onLoadPreset: (preset: PresetSummary) => void;
  onDownloadPreset: (preset: PresetSummary) => void;
  onDeletePreset: (preset: PresetSummary) => void;
  collectionIds?: string[];
  onRemoveFromCollection?: (preset: PresetSummary) => void;
  onMoveInCollection?: (preset: PresetSummary, direction: -1 | 1) => void;
  sortBy: 'name' | 'date' | 'type' | 'collection';
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'name' | 'date' | 'type') => void;
  isMobile: boolean;
  formatDate: (timestamp: number) => string;
}

export function LibraryTableContent({
  presets,
  selectedPresets,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onToggleFavorite,
  onEditMetadata,
  onPreviewPreset,
  onStopPreview,
  previewingId,
  onLoadPreset,
  onDownloadPreset,
  onDeletePreset,
  collectionIds,
  onRemoveFromCollection,
  onMoveInCollection,
  sortBy,
  sortOrder,
  onSort,
  isMobile,
  formatDate
}: LibraryTableContentProps) {
  if (isMobile) {
    return (
      <>
        {presets.map((preset, index) => (
          <div key={preset.id} style={{
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderTop: index === 0 ? '1px solid var(--color-border-light)' : 'none',
            borderBottom: '1px solid var(--color-border-light)',
            borderRadius: 0,
            boxShadow: 'none',
            marginBottom: 0,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            {/* Header with name, type, and favorite */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: '1.1rem', 
                  color: 'var(--color-text-primary)',
                  marginBottom: '0.25rem'
                }}>
                  {preset.name}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  color: 'var(--color-text-secondary)', 
                  fontSize: '0.9rem' 
                }}>
                  <i className={`fas fa-${preset.type === 'drum' ? 'drum' : 'keyboard'}`}></i>
                  {preset.type}
                </div>
              </div>
              <IconButton
                icon={preset.isFavorite ? 'fas fa-star' : 'far fa-star'}
                onClick={() => onToggleFavorite(preset)}
                title={preset.isFavorite ? 'remove from favorites' : 'add to favorites'}
                color={preset.isFavorite ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
              />
            </div>

            {/* Description */}
            {preset.description && (
              <div style={{ 
                color: 'var(--color-text-secondary)', 
                fontSize: '0.85rem',
                lineHeight: '1.4'
              }}>
                {preset.description}
              </div>
            )}
            {Array.isArray(preset.tags)&&preset.tags.length>0&&<div style={{fontSize:'0.8rem',color:'var(--color-text-secondary)'}}>Tags: {preset.tags.join(', ')}</div>}

            {/* Metadata row */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              fontSize: '0.8rem',
              color: 'var(--color-text-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-music"></i>
                {preset.sampleCount !== undefined ? `${preset.sampleCount} samples` : 'no samples'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-clock"></i>
                {formatDate(preset.updatedAt)}
              </div>
            </div>

            {/* Action buttons */}
            <label className="studio-library-select"><input type="checkbox" aria-label={`Select ${preset.name}`} checked={selectedPresets.has(preset.id)} onChange={() => onToggleSelection(preset.id)}/> Select preset</label>
            <div className="studio-library-card-actions">
              <button 
                onClick={() => onLoadPreset(preset)} 
                style={{ 
                  fontSize: '0.9rem', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '6px', 
                  border: 'none', 
                  background: 'var(--color-interactive-focus)', 
                  color: 'var(--color-white)', 
                  cursor: 'pointer',
                  minWidth:0,
                  minHeight:44,
                  width:'100%',
                  boxSizing:'border-box',
                  fontWeight: '500'
                }}
              >
                load
              </button>
              <button 
                onClick={() => onDownloadPreset(preset)} 
                style={{ 
                  fontSize: '0.9rem', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '6px', 
                  border: '1px solid var(--color-border-light)', 
                  background: 'var(--color-bg-secondary)', 
                  color: 'var(--color-text-primary)', 
                  cursor: 'pointer',
                  minWidth:0,
                  minHeight:44,
                  width:'100%',
                  boxSizing:'border-box',
                }}
              >
                download
              </button>
              <button type="button" className="studio-button-secondary" style={{minWidth:0,minHeight:44,width:'100%'}} onClick={()=>previewingId===preset.id?onStopPreview():onPreviewPreset(preset)} disabled={!hasLibraryPreview(preset)&&previewingId!==preset.id} aria-label={previewingId===preset.id?`Stop preview of ${preset.name}`:`Preview first sample of ${preset.name}`}>{previewingId===preset.id?'stop':'preview'}</button>
              <button type="button" className="studio-button-secondary" style={{minWidth:0,minHeight:44,width:'100%'}} onClick={()=>onEditMetadata(preset)} aria-label={`Edit details for ${preset.name}`}>details</button>
              <IconButton
                icon="fas fa-trash"
                onClick={() => onDeletePreset(preset)}
                title="delete preset"
                color="var(--color-text-secondary)"
              />
            </div>
            {collectionIds && <div className="studio-library-member-actions">
              <button type="button" className="studio-button-secondary" aria-label={`Move ${preset.name} up`} disabled={collectionIds.indexOf(preset.id) <= 0} onClick={() => onMoveInCollection?.(preset,-1)}>Move up</button>
              <button type="button" className="studio-button-secondary" aria-label={`Move ${preset.name} down`} disabled={collectionIds.indexOf(preset.id) >= collectionIds.length-1} onClick={() => onMoveInCollection?.(preset,1)}>Move down</button>
              <button type="button" className="studio-button-secondary" aria-label={`Remove ${preset.name} from collection`} onClick={() => onRemoveFromCollection?.(preset)}>Remove</button>
            </div>}
          </div>
        ))}
      </>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        tableLayout: 'fixed',
        borderCollapse: 'collapse',
        backgroundColor: 'var(--color-bg-primary)',
        borderBottom: '1px solid var(--color-border-light)'
      }}>
        <thead>
          <tr style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border-light)'
          }}>
            <th style={{
              padding: '0.75rem',
              textAlign: 'left',
              fontSize: '0.85rem',
              fontWeight: '500',
              color: 'var(--color-text-primary)',
              width: '58px',
            }} scope="col">
              <label className="studio-library-checkbox"><input
                type="checkbox"
                aria-label="Select all visible presets"
                checked={presets.length > 0 && presets.every(preset => selectedPresets.has(preset.id))}
                onChange={e => e.target.checked ? onSelectAll() : onClearSelection()}
                style={{
                  margin: 0,
                  width: '16px',
                  height: '16px',
                  accentColor: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              /></label>
            </th>
            <th 
              style={{
                padding: '0.75rem',
                textAlign: 'left',
                fontSize: '0.85rem',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                cursor: 'pointer'
              }}
              onClick={() => onSort('name')}
              scope="col"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>name</span>
                {sortBy === 'name' ? (
                  <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                ) : (
                  <i className="fas fa-sort" style={{ color: 'var(--color-text-secondary)' }}></i>
                )}
              </div>
            </th>
            <th style={{
              padding: '0.75rem',
              textAlign: 'left',
              fontSize: '0.85rem',
              fontWeight: '500',
              color: 'var(--color-text-primary)',
              width: '330px',
            }} scope="col">
              actions
            </th>
          </tr>
        </thead>
        <tbody>
          {presets.map((preset) => (
            <tr
              key={preset.id}
              style={{
                backgroundColor: selectedPresets.has(preset.id) 
                  ? 'var(--color-bg-secondary)' 
                  : 'var(--color-bg-primary)',
                borderBottom: '1px solid var(--color-border-light)',
                transition: 'all 0.2s ease'
              }}
            >
              <td style={{
                padding: '0.75rem',
                verticalAlign: 'top'
              }}>
                <label className="studio-library-checkbox"><input
                  type="checkbox"
                  aria-label={`Select ${preset.name}`}
                  checked={selectedPresets.has(preset.id)}
                  onChange={() => onToggleSelection(preset.id)}
                  style={{
                    margin: 0,
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                /></label>
              </td>
              <td style={{
                padding: '0.75rem',
                verticalAlign: 'top'
              }}>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: 650,
                  color: 'var(--color-text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: 'Montserrat, Arial, sans-serif',
                  overflowWrap: 'anywhere'
                }}>
                  {preset.name}
                </div>
                <div className="studio-library-row-meta">{preset.type === 'drum' ? 'Drum' : 'Multisample'} · {preset.sampleCount !== undefined ? `${preset.sampleCount} samples` : 'No samples'} · {formatDate(preset.updatedAt)}</div>
                {preset.description&&<div style={{fontSize:'0.78rem',color:'var(--color-text-secondary)',marginTop:4}}>{preset.description}</div>}
                {Array.isArray(preset.tags)&&preset.tags.length>0&&<div style={{fontSize:'0.75rem',color:'var(--color-text-secondary)',marginTop:4}}>Tags: {preset.tags.join(', ')}</div>}
              </td>
              <td style={{
                padding: '0.75rem',
                verticalAlign: 'top'
              }}>
                <div className="studio-library-row-actions">
                  <IconButton
                    icon={preset.isFavorite ? 'fas fa-star' : 'far fa-star'}
                    onClick={() => onToggleFavorite(preset)}
                    title={preset.isFavorite ? 'remove from favorites' : 'add to favorites'}
                    color={preset.isFavorite ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
                  />
                  <IconButton
                    icon={previewingId===preset.id?'fas fa-stop':'fas fa-play'}
                    onClick={()=>previewingId===preset.id?onStopPreview():onPreviewPreset(preset)}
                    title={previewingId===preset.id?`Stop preview of ${preset.name}`:`Preview first sample of ${preset.name}`}
                    disabled={!hasLibraryPreview(preset)&&previewingId!==preset.id}
                  />
                  <IconButton
                    icon="fas fa-tags"
                    onClick={()=>onEditMetadata(preset)}
                    title={`Edit details for ${preset.name}`}
                  />
                  <IconButton
                    icon="fas fa-folder-open"
                    onClick={() => onLoadPreset(preset)}
                    title="load preset"
                    color="var(--color-interactive-focus)"
                  />
                  <IconButton
                    icon="fas fa-download"
                    onClick={() => onDownloadPreset(preset)}
                    title="download preset"
                    color="var(--color-text-secondary)"
                  />
                  <IconButton
                    icon="fas fa-trash"
                    onClick={() => onDeletePreset(preset)}
                    title="delete preset"
                    color="var(--color-text-secondary)"
                  />
                {collectionIds && <>
                  <button type="button" className="studio-icon-button" aria-label={`Move ${preset.name} up`} disabled={collectionIds.indexOf(preset.id) <= 0} onClick={() => onMoveInCollection?.(preset,-1)}>↑</button>
                  <button type="button" className="studio-icon-button" aria-label={`Move ${preset.name} down`} disabled={collectionIds.indexOf(preset.id) >= collectionIds.length-1} onClick={() => onMoveInCollection?.(preset,1)}>↓</button>
                  <button type="button" className="studio-icon-button" aria-label={`Remove ${preset.name} from collection`} onClick={() => onRemoveFromCollection?.(preset)}>×</button>
                </>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
