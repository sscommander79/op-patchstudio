interface LibraryFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: 'all' | 'drum' | 'multisample';
  onFilterTypeChange: (value: 'all' | 'drum' | 'multisample') => void;
  filterFavorites: boolean;
  onFilterFavoritesChange: (value: boolean) => void;
  sortBy: 'name' | 'date' | 'type' | 'collection';
  onSortChange: (value: 'name' | 'date' | 'type' | 'collection') => void;
  sortOrder: 'asc' | 'desc';
  onToggleSortOrder: () => void;
  inCollection: boolean;
}

export function LibraryFilters({searchTerm,onSearchChange,filterType,onFilterTypeChange,
  filterFavorites,onFilterFavoritesChange,sortBy,onSortChange,sortOrder,onToggleSortOrder,inCollection}:LibraryFiltersProps) {
  return <div className="studio-library-toolbar" role="search" aria-label="Library filters">
    <label className="studio-library-search"><span className="studio-visually-hidden">Search presets, descriptions, and tags</span>
      <input type="search" aria-label="Search presets, descriptions, and tags" placeholder="Search presets or tags" value={searchTerm} onChange={event=>onSearchChange(event.target.value)}/>
    </label>
    <label className="studio-library-filter"><span className="studio-visually-hidden">Preset type</span>
      <select aria-label="Preset type" value={filterType} onChange={event=>onFilterTypeChange(event.target.value as 'all'|'drum'|'multisample')}>
        <option value="all">All types</option><option value="drum">Drums</option><option value="multisample">Multisamples</option>
      </select>
    </label>
    {/* Option labels stay short so the closed select never clips them at phone width. */}
    <label className="studio-library-filter studio-library-sort"><span className="studio-visually-hidden">Sort presets</span>
      <select aria-label="Sort presets" value={sortBy} onChange={event=>onSortChange(event.target.value as 'name'|'date'|'type'|'collection')}>
        {inCollection&&<option value="collection">Manual order</option>}
        <option value="date">Updated</option><option value="name">Name</option><option value="type">Type</option>
      </select>
    </label>
    <button type="button" className="studio-button-secondary studio-library-sort-direction" aria-label={sortOrder==='asc'?'Sort descending':'Sort ascending'} title={sortBy==='collection'?'Manual order has no direction':sortOrder==='asc'?'Ascending. Switch to descending.':'Descending. Switch to ascending.'} disabled={sortBy==='collection'} onClick={onToggleSortOrder}><span aria-hidden="true">{sortOrder==='asc'?'↑':'↓'}</span></button>
    <label className="studio-library-favorites-filter"><input type="checkbox" checked={filterFavorites} onChange={event=>onFilterFavoritesChange(event.target.checked)}/> Favorites only</label>
  </div>;
}
