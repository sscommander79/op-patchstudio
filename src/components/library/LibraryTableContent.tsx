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

const typeLabel = (preset: PresetSummary) => preset.type === 'drum' ? 'Drum' : 'Multisample';
const sampleLabel = (preset: PresetSummary) => preset.sampleCount === undefined
  ? 'No samples'
  : `${preset.sampleCount} ${preset.sampleCount === 1 ? 'sample' : 'samples'}`;
const favoriteLabel = (preset: PresetSummary) => preset.isFavorite
  ? `Remove ${preset.name} from favorites`
  : `Add ${preset.name} to favorites`;

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
                  marginBottom: '0.25rem',
                  overflowWrap: 'anywhere'
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
                  <i aria-hidden="true" className={`fas fa-${preset.type === 'drum' ? 'drum' : 'keyboard'}`}></i>
                  {typeLabel(preset)}
                </div>
              </div>
              <IconButton
                icon={preset.isFavorite ? 'fas fa-star' : 'far fa-star'}
                onClick={() => onToggleFavorite(preset)}
                title={favoriteLabel(preset)}
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
                <i aria-hidden="true" className="fas fa-music"></i>
                {sampleLabel(preset)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i aria-hidden="true" className="fas fa-clock"></i>
                {formatDate(preset.updatedAt)}
              </div>
            </div>

            {/* Action buttons */}
            <label className="studio-library-select"><input type="checkbox" aria-label={`Select ${preset.name}`} checked={selectedPresets.has(preset.id)} onChange={() => onToggleSelection(preset.id)}/> Select preset</label>
            <div className="studio-library-card-actions">
              <button
                type="button"
                onClick={() => onLoadPreset(preset)}
                aria-label={`Load ${preset.name}`}
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
                Load
              </button>
              <button
                type="button"
                onClick={() => onDownloadPreset(preset)}
                aria-label={`Download ${preset.name}`}
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
                Download
              </button>
              <button type="button" className="studio-button-secondary" style={{minWidth:0,minHeight:44,width:'100%'}} onClick={()=>previewingId===preset.id?onStopPreview():onPreviewPreset(preset)} disabled={!hasLibraryPreview(preset)&&previewingId!==preset.id} aria-label={previewingId===preset.id?`Stop preview of ${preset.name}`:`Preview first sample of ${preset.name}`}>{previewingId===preset.id?'Stop':'Preview'}</button>
              <button type="button" className="studio-button-secondary" style={{minWidth:0,minHeight:44,width:'100%'}} onClick={()=>onEditMetadata(preset)} aria-label={`Edit details for ${preset.name}`}>Details</button>
              <IconButton
                icon="fas fa-trash"
                onClick={() => onDeletePreset(preset)}
                title={`Delete ${preset.name}`}
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
              }}
              aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
              scope="col"
            >
              {/* A real button keeps the column sort reachable from the keyboard. */}
              <button
                type="button"
                onClick={() => onSort('name')}
                title="Sort by name"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  minHeight: 44,
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  cursor: 'pointer'
                }}
              >
                <span>Name</span>
                {sortBy === 'name' ? (
                  <i aria-hidden="true" className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                ) : (
                  <i aria-hidden="true" className="fas fa-sort" style={{ color: 'var(--color-text-secondary)' }}></i>
                )}
              </button>
            </th>
            <th style={{
              padding: '0.75rem',
              textAlign: 'left',
              fontSize: '0.85rem',
              fontWeight: '500',
              color: 'var(--color-text-primary)',
              width: '330px',
            }} scope="col">
              Actions
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
                <div className="studio-library-row-meta">{typeLabel(preset)} · {sampleLabel(preset)} · {formatDate(preset.updatedAt)}</div>
                {preset.description&&<div style={{fontSize:'0.78rem',color:'var(--color-text-secondary)',marginTop:4}}>{preset.description}</div>}
                {Array.isArray(preset.tags)&&preset.tags.length>0&&<div style={{fontSize:'0.75rem',color:'var(--color-text-secondary)',marginTop:4}}>Tags: {preset.tags.join(', ')}</div>}
              </td>
              <td style={{
                padding: '0.75rem',
                verticalAlign: 'top'
              }}>
                <div className="studio-library-row-actions">
                  {/* Primary actions carry visible words; the preset name is added for assistive technology. */}
                  <button type="button" className="studio-button-primary" aria-label={`Load ${preset.name}`} onClick={() => onLoadPreset(preset)}>Load</button>
                  <button type="button" className="studio-button-secondary" aria-label={`Download ${preset.name}`} onClick={() => onDownloadPreset(preset)}>Download</button>
                  <IconButton
                    icon={preset.isFavorite ? 'fas fa-star' : 'far fa-star'}
                    onClick={() => onToggleFavorite(preset)}
                    title={favoriteLabel(preset)}
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
                    icon="fas fa-trash"
                    onClick={() => onDeletePreset(preset)}
                    title={`Delete ${preset.name}`}
                    color="var(--color-text-secondary)"
                  />
                {collectionIds && <>
                  <button type="button" className="studio-icon-button" aria-label={`Move ${preset.name} up`} title="Move up in collection" disabled={collectionIds.indexOf(preset.id) <= 0} onClick={() => onMoveInCollection?.(preset,-1)}>↑</button>
                  <button type="button" className="studio-icon-button" aria-label={`Move ${preset.name} down`} title="Move down in collection" disabled={collectionIds.indexOf(preset.id) >= collectionIds.length-1} onClick={() => onMoveInCollection?.(preset,1)}>↓</button>
                  <button type="button" className="studio-icon-button" aria-label={`Remove ${preset.name} from collection`} title="Remove from collection" onClick={() => onRemoveFromCollection?.(preset)}>×</button>
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
