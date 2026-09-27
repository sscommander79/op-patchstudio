import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { AccessibleDialog } from '../common/AccessibleDialog';
import { LibraryTable } from './LibraryTable';
import { LibraryFilters } from './LibraryFilters';
import { LibraryTableContent } from './LibraryTableContent';
import { LibraryPagination } from './LibraryPagination';
import { useAppContext } from '../../context/AppContext';
import { indexedDB, type LibraryCollection, type PresetSummary } from '../../utils/indexedDB';
import { downloadBlob } from '../../utils/patchGeneration';
import type { LibraryPreset } from '../../utils/libraryUtils';
import { deserializeLibraryPreset } from '../../utils/libraryUtils';
import {useLibraryPreview} from './useLibraryPreview';
import { buildLibraryBatchArchive, libraryPresetFolderNames, renderSavedPreset } from '../../utils/libraryBatchExport';
import { sanitizeName } from '../../utils/audio';
import {captureProjectEditIdentity,projectEditIdentityMatches} from '../../utils/projectEditIdentity';

export function LibraryPage() {
  const { state, dispatch } = useAppContext();
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [collections,setCollections]=useState<LibraryCollection[]>([]);
  const [scope,setScope]=useState<'all'|'favorites'|string>('all');
  const [collectionDialog,setCollectionDialog]=useState<'create'|'rename'|'add'|null>(null);
  const [collectionName,setCollectionName]=useState('');
  const [collectionTarget,setCollectionTarget]=useState('');
  const [collectionError,setCollectionError]=useState('');
  const [collectionBusy,setCollectionBusy]=useState(false);
  const [deleteCollectionOpen,setDeleteCollectionOpen]=useState(false);
  const [exportStatus,setExportStatus]=useState('');
  const [exportError,setExportError]=useState('');
  const [exportBusy,setExportBusy]=useState(false);
  const exportController=useRef<AbortController|null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'drum' | 'multisample'>('all');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'type' | 'collection'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<PresetSummary | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile,setIsMobile]=useState(()=>window.innerWidth<=1100);
  const pageSize = isMobile ? 10 : 15;
  const [isLoadConfirmOpen, setIsLoadConfirmOpen] = useState(false);
  const [pendingPresetToLoad, setPendingPresetToLoad] = useState<PresetSummary | null>(null);
  const [editing,setEditing]=useState<{id:string;name:string;description:string;tags:string}|null>(null);
  const [editError,setEditError]=useState(''),[editBusy,setEditBusy]=useState(false);
  const editReturnFocus=useRef<HTMLElement|null>(null);
  const {previewingId,message:previewMessage,preview,stop:stopPreview}=useLibraryPreview(state.currentTab==='library');
  const latestPresetRequestRef = useRef(0);
  const latestCollectionRequestRef = useRef(0);
  const latestLoadRequestRef = useRef(0);
  const latestPreviewRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const invalidateAsyncRequests=useCallback(()=>{mountedRef.current=false;latestLoadRequestRef.current++;latestPreviewRequestRef.current++;},[]);
  const hasLoadedPresetsRef = useRef(false);
  const activeCollection=useMemo(()=>collections.find(collection=>collection.id===scope),[collections,scope]);
  useEffect(()=>{const onResize=()=>setIsMobile(window.innerWidth<=1100);window.addEventListener('resize',onResize);return()=>window.removeEventListener('resize',onResize);},[]);
  useEffect(()=>{mountedRef.current=true;return invalidateAsyncRequests;},[invalidateAsyncRequests]);
  useEffect(()=>()=>exportController.current?.abort(),[]);

  // Ref to track current state for async operations
  const currentStateRef = useRef(state);
  currentStateRef.current = state;
  const stopLibraryPreview=useCallback((announce=true)=>{latestPreviewRequestRef.current++;stopPreview(announce);},[stopPreview]);
  const previewSummary=useCallback(async(summary:PresetSummary)=>{
    const requestId=++latestPreviewRequestRef.current;
    try{
      const preset=await indexedDB.getPreset(summary.id);
      if(!mountedRef.current||requestId!==latestPreviewRequestRef.current)return;
      if(!preset)throw new Error('Saved preset no longer exists');
      await preview(preset as LibraryPreset);
    }catch{
      if(mountedRef.current&&requestId===latestPreviewRequestRef.current)dispatch({type:'ADD_NOTIFICATION',payload:{id:Date.now().toString(),type:'error',title:'preview failed',message:'saved preset is no longer available'}});
    }
  },[dispatch,preview]);

  const filteredPresets=useMemo(()=>{
    const query=searchTerm.trim().toLocaleLowerCase();
    const members=activeCollection?.presetIds;
    const filtered=presets.filter(preset=>(scope==='all'||(scope==='favorites'?preset.isFavorite:members?.includes(preset.id)))
      &&(!query||preset.name.toLocaleLowerCase().includes(query)||(typeof preset.description==='string'&&preset.description.toLocaleLowerCase().includes(query))||(Array.isArray(preset.tags)&&preset.tags.some(tag=>typeof tag==='string'&&tag.toLocaleLowerCase().includes(query))))
      &&(filterType==='all'||preset.type===filterType)&&(!filterFavorites||preset.isFavorite));
    filtered.sort((a,b)=>{const comparison=sortBy==='collection'&&members?members.indexOf(a.id)-members.indexOf(b.id):sortBy==='name'?a.name.localeCompare(b.name):sortBy==='type'?a.type.localeCompare(b.type):a.updatedAt-b.updatedAt;return sortBy==='collection'?comparison:sortOrder==='asc'?comparison:-comparison;});
    return filtered;
  },[presets,searchTerm,filterType,filterFavorites,sortBy,sortOrder,scope,activeCollection]);
  // Bulk actions and counts only ever apply to selected presets the current filters still show.
  const visibleSelection=useMemo(()=>new Set(filteredPresets.filter(preset=>selectedPresets.has(preset.id)).map(preset=>preset.id)),[filteredPresets,selectedPresets]);
  const totalPages=Math.max(1,Math.ceil(filteredPresets.length/pageSize));
  const visiblePage=Math.min(currentPage,totalPages);
  const paginatedPresets=filteredPresets.slice((visiblePage-1)*pageSize,visiblePage*pageSize);
  useEffect(()=>{if(currentPage>totalPages)setCurrentPage(totalPages);},[currentPage,totalPages]);

  const loadPresets = useCallback(async () => {
    const requestId = ++latestPresetRequestRef.current;
    try {
      if (!hasLoadedPresetsRef.current) setIsLoading(true);
      const allPresets = await indexedDB.getPresetSummaries();
      if (requestId === latestPresetRequestRef.current) {
        setPresets(allPresets);
        setLoadError(false);
      }
    } catch (error) {
      if (requestId !== latestPresetRequestRef.current) return;
      console.error('Failed to load presets:', error);
      setLoadError(true);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'load failed',
          message: 'failed to load presets from library'
        }
      });
    } finally {
      if (requestId === latestPresetRequestRef.current) {
        hasLoadedPresetsRef.current = true;
        setIsLoading(false);
      }
    }
  }, [dispatch]);

  const loadCollections=useCallback(async()=>{
    const requestId=++latestCollectionRequestRef.current;
    try{const rows=await indexedDB.getLibraryCollections();if(requestId===latestCollectionRequestRef.current)setCollections(rows);}
    catch(error){if(requestId===latestCollectionRequestRef.current){console.error('Failed to load collections',error);setCollectionError('Could not load collections.');}}
  },[]);

  // Load presets from IndexedDB
  useEffect(() => {
    loadPresets();loadCollections();
  }, [loadPresets,loadCollections]);

  // Listen for library refresh events
  useEffect(() => {
    const handleLibraryRefresh = () => {
      if (state.currentTab === 'library') {
        loadPresets();loadCollections();
      }
    };

    window.addEventListener('library-refresh', handleLibraryRefresh);
    return () => {
      window.removeEventListener('library-refresh', handleLibraryRefresh);
    };
  }, [state.currentTab, loadPresets,loadCollections]);

  const handleSort = (column: 'name' | 'date' | 'type') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'date' ? 'desc' : 'asc');
    }
  };

  const chooseScope=(next:string)=>{setScope(next);setFilterFavorites(false);setSelectedPresets(new Set());setCurrentPage(1);setSortBy(next==='all'||next==='favorites'?'date':'collection');setSortOrder('desc');};

  // Helper: is there a session in progress?
  const sessionInProgress = state.drumSamples.some(s => s.isLoaded) || state.multisampleFiles.length > 0;

  // Wrapped handler for preset loading with confirmation
  const handleLoadPreset = async (preset: PresetSummary) => {
    stopLibraryPreview(false);
    if (sessionInProgress) {
      setPendingPresetToLoad(preset);
      setIsLoadConfirmOpen(true);
      return;
    }
    await actuallyLoadPreset(preset);
  };

  // The actual preset loading logic (moved from old handleLoadPreset)
  const actuallyLoadPreset = async (summary: PresetSummary) => {
    const requestId=++latestLoadRequestRef.current;
    const editIdentity=captureProjectEditIdentity(currentStateRef.current);
    try {
      const preset=await indexedDB.getPreset(summary.id) as LibraryPreset|null;
      if(!preset)throw new Error('Saved preset no longer exists');
      // The current project remains valid while all incoming audio is decoded.
      const project = await deserializeLibraryPreset(preset);
      if(!mountedRef.current||requestId!==latestLoadRequestRef.current)return;
      if(!projectEditIdentityMatches(editIdentity,currentStateRef.current))throw new Error('Current project changed while the preset was loading');
      dispatch({type:'RESTORE_LIBRARY',payload:{mode:preset.type,project}});

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'preset loaded',
          message: `loaded "${preset.name}" preset`
        }
      });

    } catch (error) {
      console.error('Failed to load preset:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'load failed',
          message: 'failed to load preset'
        }
      });
    }
  };

  const handleDownloadPreset = async (summary: PresetSummary) => {
    try {
      const preset=await indexedDB.getPreset(summary.id) as LibraryPreset|null;
      if(!preset)throw new Error('Saved preset no longer exists');
      const patchBlob=await renderSavedPreset(preset);
      downloadBlob(patchBlob, `${libraryPresetFolderNames([preset])[0]}.zip`);

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'preset downloaded',
          message: `downloaded "${preset.name}" preset`
        }
      });

    } catch (error) {
      console.error('Failed to download preset:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'download failed',
          message: 'failed to download preset'
        }
      });
    }
  };

  const handleToggleFavorite = async (preset: PresetSummary) => {
    try {
      const updatedPreset = await indexedDB.updatePresetMetadata(preset.id,{toggleFavorite:true});
      latestPresetRequestRef.current++;
      setPresets(prev => prev.map(p => p.id === preset.id ? updatedPreset : p));

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: updatedPreset.isFavorite ? 'added to favorites' : 'removed from favorites',
          message: `"${preset.name}" ${updatedPreset.isFavorite ? 'added to' : 'removed from'} favorites`
        }
      });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'update failed',
          message: 'failed to update favorite status'
        }
      });
    }
  };

  const openMetadata=(preset:PresetSummary)=>{
    stopLibraryPreview(false);
    editReturnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setEditing({id:preset.id,name:preset.name,description:typeof preset.description==='string'?preset.description:'',tags:Array.isArray(preset.tags)?preset.tags.join(', '):''});
    setEditError('');
  };
  const saveMetadata=async()=>{
    if(!editing||editBusy)return;
    const seen=new Set<string>();
    const tags=editing.tags.split(',').map(tag=>tag.trim()).filter(tag=>{const key=tag.toLocaleLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;});
    if(tags.length>12||tags.some(tag=>tag.length>30)){setEditError('Use at most 12 tags, each no longer than 30 characters.');return;}
    setEditBusy(true);setEditError('');
    try{
      const updated=await indexedDB.updatePresetMetadata(editing.id,{description:editing.description.trim(),tags});
      latestPresetRequestRef.current++;
      setPresets(prev=>prev.map(preset=>preset.id===updated.id?updated:preset));
      setEditing(null);
    }catch{setEditError('Could not save these details. The preset may have been deleted; refresh the library and try again.');}
    finally{setEditBusy(false);}
  };

  const handleDeletePreset = (preset: PresetSummary) => {
    setPresetToDelete(preset);
    setIsConfirmModalOpen(true);
  };

  const handleBulkDelete = () => {
    setPresetToDelete({ id: 'bulk', name: 'Selected Presets' } as PresetSummary);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if(presetToDelete?.id==='bulk'?visibleSelection.has(previewingId??''):presetToDelete?.id===previewingId)stopLibraryPreview(false);
      if (presetToDelete?.id === 'bulk') {
        // Bulk delete
        const presetIds = Array.from(visibleSelection);
        await indexedDB.deletePresetsFromLibrary(presetIds);
        setSelectedPresets(new Set());

        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Date.now().toString(),
            type: 'success',
            title: 'presets deleted',
            message: `deleted ${presetIds.length} presets`
          }
        });
      } else if (presetToDelete) {
        // Single delete
        await indexedDB.deletePresetFromLibrary(presetToDelete.id);

        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Date.now().toString(),
            type: 'success',
            title: 'preset deleted',
            message: `deleted "${presetToDelete.name}" preset`
          }
        });
      }

      // Refresh presets
      loadPresets();
      loadCollections();

    } catch (error) {
      console.error('Failed to delete preset(s):', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'delete failed',
          message: 'failed to delete preset(s)'
        }
      });
    } finally {
      setIsConfirmModalOpen(false);
      setPresetToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setIsConfirmModalOpen(false);
    setPresetToDelete(null);
  };

  // Handler for confirming preset load
  const handleConfirmLoadPreset = async () => {
    if (pendingPresetToLoad) {
      setIsLoadConfirmOpen(false);
      await actuallyLoadPreset(pendingPresetToLoad);
      setPendingPresetToLoad(null);
    }
  };

  // Handler for cancelling preset load
  const handleCancelLoadPreset = () => {
    setIsLoadConfirmOpen(false);
    setPendingPresetToLoad(null);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const togglePresetSelection = (presetId: string) => {
    const newSelected = new Set(selectedPresets);
    if (newSelected.has(presetId)) {
      newSelected.delete(presetId);
    } else {
      newSelected.add(presetId);
    }
    setSelectedPresets(newSelected);
  };

  const selectAllPresets = () => {
    setSelectedPresets(current=>new Set([...current,...paginatedPresets.map(p=>p.id)]));
  };

  const clearSelection = () => {
    setSelectedPresets(new Set());
  };

  const openCollectionDialog=(kind:'create'|'rename'|'add')=>{
    setCollectionError('');setCollectionDialog(kind);
    setCollectionName(kind==='rename'?activeCollection?.name??'':'');
    setCollectionTarget(collections[0]?.id??'');
  };
  const submitCollection=async()=>{
    if(collectionBusy)return;
    setCollectionBusy(true);setCollectionError('');
    try{
      if(collectionDialog==='create'){
        const created=await indexedDB.createLibraryCollection(collectionName);
        await loadCollections();chooseScope(created.id);
      }else if(collectionDialog==='rename'&&activeCollection){
        await indexedDB.changeLibraryCollection(activeCollection.id,{type:'rename',name:collectionName});await loadCollections();
      }else if(collectionDialog==='add'){
        if(!collectionTarget)throw new Error('Choose a collection');
        await indexedDB.changeLibraryCollection(collectionTarget,{type:'add',presetIds:[...visibleSelection]});
        await loadCollections();setSelectedPresets(new Set());
      }
      setCollectionDialog(null);
    }catch(error){setCollectionError(error instanceof Error?error.message:'Could not update collection');await loadCollections();}
    finally{setCollectionBusy(false);}
  };
  const changeMember=async(preset:PresetSummary,change:'remove'|-1|1)=>{
    if(!activeCollection||collectionBusy)return;
    setCollectionBusy(true);setCollectionError('');
    try{await indexedDB.changeLibraryCollection(activeCollection.id,change==='remove'?{type:'remove',presetId:preset.id}:{type:'move',presetId:preset.id,direction:change});await loadCollections();setSortBy('collection');}
    catch(error){setCollectionError(error instanceof Error?error.message:'Could not update collection');await loadCollections();}
    finally{setCollectionBusy(false);}
  };
  const confirmDeleteCollection=async()=>{
    if(!activeCollection)return;
    setCollectionBusy(true);setCollectionError('');
    try{await indexedDB.deleteLibraryCollection(activeCollection.id);await loadCollections();chooseScope('all');setDeleteCollectionOpen(false);}
    catch(error){setCollectionError(error instanceof Error?error.message:'Could not delete collection');setDeleteCollectionOpen(false);await loadCollections();}
    finally{setCollectionBusy(false);}
  };
  const startBatchExport=async(kind:'selected'|'collection')=>{
    if(exportController.current)return;
    const controller=new AbortController();exportController.current=controller;
    setExportBusy(true);setExportError('');setExportStatus('Preparing saved presets…');
    try{
      const collection=kind==='collection'? (await indexedDB.getLibraryCollections()).find(item=>item.id===activeCollection?.id):undefined;
      if(kind==='collection'&&!collection)throw new Error('Collection no longer exists');
      const ids=kind==='collection'?[...collection!.presetIds]:[...visibleSelection];
      if(!ids.length)throw new Error('Choose at least one preset to export');
      const snapshot:LibraryPreset[]=[];
      for(const id of ids){
        if(controller.signal.aborted)throw new DOMException('Batch export canceled','AbortError');
        const preset=await indexedDB.getPreset(id) as LibraryPreset|null;
        if(!preset)throw new Error('A saved preset is missing. Refresh the library before exporting.');
        snapshot.push(preset);
      }
      const archive=await buildLibraryBatchArchive(snapshot,{signal:controller.signal,onProgress:({completed,total,name})=>setExportStatus(`Exporting ${completed} of ${total}: ${name}`)});
      if(controller.signal.aborted)throw new DOMException('Batch export canceled','AbortError');
      const stem=sanitizeName(collection?.name??'Selected presets').trim().replace(/^[. ]+|[. ]+$/g,'')||'Library presets';
      downloadBlob(archive,`${stem}.zip`);
      setExportStatus(`Downloaded ${snapshot.length} ${snapshot.length===1?'preset':'presets'} in one ZIP.`);
    }catch(error){
      if(controller.signal.aborted)setExportStatus('Export canceled. No ZIP was downloaded.');
      else {setExportError(error instanceof Error?error.message:'Batch export failed');setExportStatus('');}
    }finally{exportController.current=null;setExportBusy(false);}
  };

  const tableContent=<LibraryTableContent
    presets={paginatedPresets}
    selectedPresets={visibleSelection}
    onToggleSelection={togglePresetSelection}
    onSelectAll={selectAllPresets}
    onClearSelection={clearSelection}
    onToggleFavorite={handleToggleFavorite}
    onEditMetadata={openMetadata}
    onPreviewPreset={summary=>void previewSummary(summary)}
    onStopPreview={()=>stopLibraryPreview()}
    previewingId={previewingId}
    onLoadPreset={handleLoadPreset}
    onDownloadPreset={handleDownloadPreset}
    onDeletePreset={handleDeletePreset}
    collectionIds={activeCollection?.presetIds}
    onRemoveFromCollection={preset=>void changeMember(preset,'remove')}
    onMoveInCollection={(preset,direction)=>void changeMember(preset,direction)}
    sortBy={sortBy}
    sortOrder={sortOrder}
    onSort={handleSort}
    isMobile={isMobile}
    formatDate={formatDate}
  />;

  return (
    <>
      <div className="studio-library-page">
        <div className="studio-library-layout">
          <aside className="studio-library-sidebar" aria-label="Library collections">
            <div className="studio-library-sidebar-top"><span>YOUR LIBRARY</span><button type="button" className="studio-button-secondary" onClick={()=>openCollectionDialog('create')}>New collection</button></div>
            <details key={isMobile?'mobile':'desktop'} open={!isMobile} className="studio-library-collection-disclosure">
              <summary>Browse collections</summary>
              <nav aria-label="Library sections" className="studio-library-nav">
                <button type="button" aria-current={scope==='all'?'page':undefined} onClick={()=>chooseScope('all')}><span>All presets</span><span>{presets.length}</span></button>
                <button type="button" aria-current={scope==='favorites'?'page':undefined} onClick={()=>chooseScope('favorites')}><span>Favorites</span><span>{presets.filter(preset=>preset.isFavorite).length}</span></button>
                <div className="studio-library-nav-heading">COLLECTIONS</div>
                {collections.map(collection=><button type="button" key={collection.id} aria-label={`Collection ${collection.name}`} aria-current={scope===collection.id?'page':undefined} onClick={()=>chooseScope(collection.id)}><span>{collection.name}</span><span>{collection.presetIds.length}</span></button>)}
                {collections.length===0&&<p className="studio-library-nav-empty">Group presets without copying their audio.</p>}
              </nav>
            </details>
          </aside>
          <div className="studio-library-main">
            <div className="studio-library-heading"><div><p className="studio-library-eyebrow">SAVED SOUNDS</p><h1>{activeCollection?.name??(scope==='favorites'?'Favorites':'All presets')}</h1><p>{activeCollection?`${activeCollection.presetIds.length} saved ${activeCollection.presetIds.length===1?'preset':'presets'} · ordered for export`:scope==='favorites'?'Your marked sounds, ready to find again.':'Search, preview, and organize sounds saved in this browser.'}</p></div></div>
            {activeCollection&&<div className="studio-library-collection-actions"><button type="button" className="studio-button-secondary" onClick={()=>openCollectionDialog('rename')}>Rename collection</button><button type="button" className="studio-button-secondary" onClick={()=>setDeleteCollectionOpen(true)}>Delete collection</button><button type="button" className="studio-button-primary" disabled={exportBusy||activeCollection.presetIds.length===0} onClick={()=>void startBatchExport('collection')}>Export collection ({activeCollection.presetIds.length})</button></div>}
            {loadError&&<div className="studio-library-load-error"><p role="alert" className="studio-message studio-message-error">Could not load saved presets from this browser's storage.{presets.length>0?' The list below may be out of date.':''}</p><button type="button" className="studio-button-secondary" onClick={()=>void loadPresets()}>Retry loading library</button></div>}
            {visibleSelection.size>0&&<div className="studio-library-selection-bar" role="group" aria-label="Selected preset actions"><strong>{visibleSelection.size} selected</strong><button type="button" className="studio-button-secondary" onClick={()=>openCollectionDialog('add')}>Add to collection</button><button type="button" className="studio-button-primary" disabled={exportBusy} onClick={()=>void startBatchExport('selected')}>Export selected</button><button type="button" className="studio-button-secondary" onClick={handleBulkDelete}>Delete selected</button><button type="button" className="studio-button-secondary" onClick={clearSelection}>Clear selection</button></div>}
            {collectionError&&!collectionDialog&&<p role="alert" className="studio-message studio-message-error">{collectionError}</p>}
            {exportError&&<p role="alert" className="studio-message studio-message-error">{exportError}</p>}
            {exportStatus&&<div className="studio-library-export-progress"><p role="status" aria-label="Library export status">{exportStatus}</p>{exportBusy&&<button type="button" className="studio-button-secondary" onClick={()=>{exportController.current?.abort();setExportStatus('Canceling after the current preset…');}}>Cancel export</button>}</div>}
          <LibraryTable
            title={`${filteredPresets.length} presets`}
            headerStyle={{gridTemplateColumns:'minmax(0, 1fr)',gap:'.7rem'}}
            titleTooltip={
              <>
                <h3>
                  <i className="fas fa-shield-alt" style={{ marginRight: '0.5rem' }}></i>
                  privacy & data
                </h3>
                <p>
                  all data is stored locally on your device. no data is sent to external servers or shared with third parties.
                </p>
                <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                  your presets, samples, and settings remain private and secure.
                </p>
              </>
            }
            headerContent={
              <LibraryFilters
                searchTerm={searchTerm}
                onSearchChange={value=>{setSearchTerm(value);setCurrentPage(1);}}
                filterType={filterType}
                onFilterTypeChange={value=>{setFilterType(value);setCurrentPage(1);}}
                filterFavorites={filterFavorites}
                onFilterFavoritesChange={value=>{setFilterFavorites(value);setCurrentPage(1);}}
                sortBy={sortBy}
                onSortChange={value=>{setSortBy(value);setSortOrder(value==='date'?'desc':'asc');setCurrentPage(1);}}
                sortOrder={sortOrder}
                onToggleSortOrder={()=>setSortOrder(current=>current==='asc'?'desc':'asc')}
                inCollection={Boolean(activeCollection)}
              />
            }
            footerContent={
              !isMobile && (
                <LibraryPagination
                  currentPage={visiblePage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  isMobile={isMobile}
                />
              )
            }
            isLoading={isLoading}
            emptyState={<>{tableContent}<div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
                color: 'var(--color-text-secondary)',
                textAlign: 'center'
              }}>
                <i className="fas fa-folder-open" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i>
                <p>{loadError ? 'Library unavailable' : 'No presets found'}</p>
                <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  {loadError
                    ? 'Saved presets could not be read. Use Retry loading library above.'
                    : activeCollection
                    ? 'This collection has no matching presets. Add selected sounds from All presets.'
                    : searchTerm || filterType !== 'all' || filterFavorites || scope==='favorites'
                      ? 'No presets match these filters. Try adjusting your search or filters.'
                      : 'Save a drum or multisample preset to begin your library.'}
                </p>
              </div></>}
            tableContent={filteredPresets.length>0?tableContent:undefined}
          />

          {previewMessage&&<div><p role="status" aria-label="Library preview status">{previewMessage}</p>{previewingId&&<button type="button" onClick={()=>stopLibraryPreview()}>Stop library preview</button>}</div>}

          {/* Mobile pagination controls below cards only */}
          {isMobile && filteredPresets.length > pageSize && (
            <LibraryPagination
              currentPage={visiblePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isMobile={isMobile}
            />
          )}
          </div>
        </div>
      </div>
      {collectionDialog&&<AccessibleDialog labelledBy="library-collection-title" onClose={()=>{if(!collectionBusy)setCollectionDialog(null);}}>
        <div className="studio-dialog-heading"><h2 id="library-collection-title">{collectionDialog==='create'?'New collection':collectionDialog==='rename'?'Rename collection':'Add to collection'}</h2><button type="button" className="studio-icon-button" aria-label="Close collection dialog" disabled={collectionBusy} onClick={()=>setCollectionDialog(null)}>×</button></div>
        {collectionDialog==='add'?<>
          <p>Add {visibleSelection.size} selected {visibleSelection.size===1?'preset':'presets'} without copying audio.</p>
          <label className="studio-name-field">Choose collection<select aria-label="Choose collection" value={collectionTarget} onChange={event=>setCollectionTarget(event.target.value)}>{collections.map(collection=><option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>
          {collections.length===0&&<p>Create a collection first.</p>}
        </>:<label className="studio-name-field">Collection name<input aria-label="Collection name" value={collectionName} maxLength={80} onChange={event=>setCollectionName(event.target.value)}/></label>}
        {collectionError&&<p role="alert" className="studio-message studio-message-error">{collectionError}</p>}
        <div className="studio-dialog-actions"><button type="button" className="studio-button-secondary" disabled={collectionBusy} onClick={()=>setCollectionDialog(null)}>Cancel</button><button type="button" className="studio-button-primary" disabled={collectionBusy||(collectionDialog==='add'?!collectionTarget:!collectionName.trim())} onClick={()=>void submitCollection()}>{collectionDialog==='create'?'Create collection':collectionDialog==='rename'?'Save collection name':'Add to collection'}</button></div>
      </AccessibleDialog>}
      <ConfirmationModal isOpen={deleteCollectionOpen} onConfirm={()=>void confirmDeleteCollection()} onCancel={()=>setDeleteCollectionOpen(false)} message={`Delete collection "${activeCollection?.name??''}"? Saved presets and their audio will remain in the library.`}/>
      {editing&&<AccessibleDialog labelledBy="library-details-title" onClose={()=>{if(!editBusy)setEditing(null);}} returnFocus={editReturnFocus.current}>
        <div className="studio-dialog-heading"><h2 id="library-details-title">Edit details for {editing.name}</h2><button type="button" className="studio-icon-button" aria-label="Close preset details" onClick={()=>setEditing(null)} disabled={editBusy}>×</button></div>
        <p>These notes organize this saved preset locally. Its audio and the current instrument stay unchanged.</p>
        <label className="studio-name-field">Description<textarea aria-label="Preset description" value={editing.description} maxLength={280} rows={3} onChange={event=>setEditing(current=>current?{...current,description:event.target.value}:current)}/></label>
        <label className="studio-name-field">Tags, separated by commas<input aria-label="Preset tags" value={editing.tags} maxLength={400} onChange={event=>setEditing(current=>current?{...current,tags:event.target.value}:current)}/></label>
        <p>Up to 12 tags, 30 characters each. Search finds preset names, descriptions, and tags.</p>
        {editError&&<p role="alert" className="studio-message studio-message-error">{editError}</p>}
        <div className="studio-dialog-actions"><button type="button" className="studio-button-secondary" disabled={editBusy} onClick={()=>setEditing(null)}>Cancel</button><button type="button" className="studio-button-primary" disabled={editBusy} onClick={()=>void saveMetadata()}>{editBusy?'Saving…':'Save details'}</button></div>
      </AccessibleDialog>}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        message={
          presetToDelete?.id === 'bulk'
            ? `are you sure you want to delete the ${visibleSelection.size} selected presets? this action cannot be undone.`
            : `are you sure you want to delete "${presetToDelete?.name}"? this action cannot be undone.`
        }
      />
      {/* Confirmation for preset loading */}
      <ConfirmationModal
        isOpen={isLoadConfirmOpen}
        onConfirm={handleConfirmLoadPreset}
        onCancel={handleCancelLoadPreset}
        message={
          pendingPresetToLoad
            ? `loading a preset will overwrite your current session. are you sure you want to load "${pendingPresetToLoad.name}"?`
            : ''
        }
      />
    </>
  );
}
