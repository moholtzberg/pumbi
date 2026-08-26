<script>
  // import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import LotNotesManager from '$lib/components/lots/LotNotesManager.svelte';
  import AIGenerator from '$lib/components/lots/AIGenerator.svelte';
  import QuickVoiceRecorder from '$lib/components/lots/QuickVoiceRecorder.svelte';
  import ImageEditor from '$lib/components/lots/ImageEditor.svelte';
  import BannerGenerator from '$lib/components/BannerGenerator.svelte';
  import ConsignmentPDF from '$lib/components/lots/ConsignmentPDF.svelte';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';

  let auction = $state(null);
  let lots = $state([]);
  let loading = $state(true);
  let editingCell = $state(null); // { lotId, field, value }
  let selectedLots = $state(new Set());
  let imageUploads = $state({}); // { lotId: [files] }
  let removeBackground = $state({}); // { lotId: boolean } - per-lot background removal setting
  let showImageModal = $state(null); // { lotId, images }
  let saving = $state({}); // Track which lots are being saved
  let cleaningUp = $state({}); // Track which lots are being cleaned up
  let availableCategories = $state([]);
  let availableTags = $state([]);
  let showCategoryDropdown = $state({}); // { lotId: boolean }
  let showTagDropdown = $state({}); // { lotId: boolean }
  let categoryInputs = $state({}); // { lotId: string }
  let tagInputs = $state({}); // { lotId: string }
  let draggedLot = $state(null);
  let reordering = $state(false);
  let expandedImageRows = $state(new Set()); // Track which lots have expanded image management
  let expandedNotesRows = $state(new Set()); // Track which lots have expanded notes
  let expandedAIRows = $state(new Set()); // Track which lots have expanded AI tools
  let expandedBannerRows = $state(new Set()); // Track which lots have expanded banner generator
  let editingImage = $state(null); // { lotId, imageId, imageUrl }
  let removingBackground = $state({}); // { imageId: boolean } - track which images are being processed
  let removingBackgroundFromAll = $state({}); // { lotId: boolean } - track which lots are processing all images
  let hoveredImage = $state(null); // { url, x, y } - track which image is being hovered for preview
  let showConsignmentPDF = $state(null); // { lotId } - track which lot to show consignment PDF for
  let showBannerTemplateSelector = $state(false); // Show template selector for bulk banner generation
  let generatingBanners = $state(false); // Track if generating banners for multiple lots
  let selectedBannerTemplate = $state(null); // Selected template for bulk generation
  let savedBannerTemplates = $state([]); // Loaded banner templates

  // Column visibility and views
  const columnDefinitions = [
    { key: 'checkbox', label: 'Checkbox', alwaysVisible: true },
    { key: 'dragHandle', label: 'Drag', alwaysVisible: false },
    { key: 'position', label: 'Position', alwaysVisible: false },
    { key: 'lotNumber', label: 'Lot Number', alwaysVisible: false },
    { key: 'images', label: 'Images', alwaysVisible: false },
    { key: 'title', label: 'Title', alwaysVisible: false },
    { key: 'description', label: 'Description', alwaysVisible: false },
    { key: 'hebrewTitle', label: 'Hebrew Title', alwaysVisible: false },
    { key: 'hebrewDescription', label: 'Hebrew Description', alwaysVisible: false },
    { key: 'yearEnglish', label: 'Year (English)', alwaysVisible: false },
    { key: 'yearHebrew', label: 'Year (Hebrew)', alwaysVisible: false },
    { key: 'category', label: 'Category', alwaysVisible: false },
    { key: 'bids', label: 'Bids', alwaysVisible: false },
    { key: 'increment', label: 'Increment', alwaysVisible: false },
    { key: 'status', label: 'Status', alwaysVisible: false },
    { key: 'watchers', label: 'Watchers', alwaysVisible: false },
    { key: 'ready', label: 'Ready', alwaysVisible: false },
    { key: 'endTime', label: 'End Time', alwaysVisible: false },
    { key: 'actions', label: 'Actions', alwaysVisible: false }
  ];

  // Default column visibility
  const defaultColumnVisibility = {
    checkbox: true,
    dragHandle: true,
    position: true,
    lotNumber: true,
    images: true,
    title: true,
    description: true,
    hebrewTitle: false,
    hebrewDescription: false,
    yearEnglish: false,
    yearHebrew: false,
    category: true,
    bids: true,
    increment: false,
    status: true,
    watchers: true,
    ready: true,
    endTime: true,
    actions: true
  };

  let columnVisibility = $state({ ...defaultColumnVisibility });
  let savedViews = $state([]);
  let showColumnSettings = $state(false);
  let showViewManager = $state(false);
  let newViewName = $state('');
  let currentViewName = $state('Default View');

  // Load saved views from localStorage
  function loadSavedViews() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return; // Skip during SSR
    }
    try {
      const stored = localStorage.getItem(`lot-column-views-${$page.params.id}`);
      if (stored) {
        savedViews = JSON.parse(stored);
      }
      // Load default view if available
      const defaultView = savedViews.find(v => v.isDefault) || savedViews[0];
      if (defaultView) {
        columnVisibility = { ...defaultColumnVisibility, ...defaultView.visibility };
        currentViewName = defaultView.name;
      }
    } catch (error) {
      console.error('Error loading saved views:', error);
    }
  }

  // Save views to localStorage
  function saveViews() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return; // Skip during SSR
    }
    try {
      localStorage.setItem(`lot-column-views-${$page.params.id}`, JSON.stringify(savedViews));
    } catch (error) {
      console.error('Error saving views:', error);
    }
  }

  // Save current view
  function saveCurrentView() {
    if (!newViewName.trim()) {
      alert('Please enter a view name');
      return;
    }
    
    const view = {
      id: Date.now().toString(),
      name: newViewName.trim(),
      visibility: { ...columnVisibility },
      isDefault: savedViews.length === 0
    };
    
    savedViews = [...savedViews, view];
    saveViews();
    currentViewName = view.name;
    newViewName = '';
    showViewManager = false;
  }

  // Load a saved view
  function loadView(view) {
    columnVisibility = { ...defaultColumnVisibility, ...view.visibility };
    currentViewName = view.name;
    showViewManager = false;
  }

  // Delete a saved view
  function deleteView(viewId) {
    savedViews = savedViews.filter(v => v.id !== viewId);
    saveViews();
    if (savedViews.length > 0 && currentViewName === savedViews.find(v => v.id === viewId)?.name) {
      loadView(savedViews[0]);
    } else if (savedViews.length === 0) {
      columnVisibility = { ...defaultColumnVisibility };
      currentViewName = 'Default View';
    }
  }

  // Set default view
  function setDefaultView(viewId) {
    savedViews = savedViews.map(v => ({ ...v, isDefault: v.id === viewId }));
    saveViews();
    const defaultView = savedViews.find(v => v.id === viewId);
    if (defaultView) {
      loadView(defaultView);
    }
  }

  // Toggle column visibility
  function toggleColumn(key) {
    if (columnDefinitions.find(c => c.key === key)?.alwaysVisible) {
      return; // Can't hide always-visible columns
    }
    columnVisibility[key] = !columnVisibility[key];
  }

  // Convert Gregorian year to Hebrew year format
  function convertToHebrewYear(year) {
    if (!year || isNaN(year)) return '';
    const yearNum = parseInt(year);
    if (yearNum < 1000 || yearNum > 9999) return '';
    const hebrewYear = yearNum + 3760;
    // Simplified Hebrew year conversion
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
    let result = '';
    let remaining = hebrewYear;
    if (remaining >= 5000) {
      result += 'ה\'';
      remaining -= 5000;
    }
    const hundredsDigit = Math.floor(remaining / 100);
    if (hundredsDigit > 0 && hundredsDigit <= 4) {
      result += hundreds[hundredsDigit];
      remaining -= hundredsDigit * 100;
    }
    const tensDigit = Math.floor(remaining / 10);
    if (tensDigit > 0 && tensDigit <= 9) {
      result += tens[tensDigit];
      remaining -= tensDigit * 10;
    }
    if (remaining > 0 && remaining <= 9) {
      result += ones[remaining];
    }
    if (result.length > 1 && !result.startsWith('ה\'')) {
      const lastChar = result.slice(-1);
      const beforeLast = result.slice(0, -1);
      result = beforeLast + '׳' + lastChar;
    }
    return result || '';
  }

  // Initialize views on mount (client-side only)
  if (typeof window !== 'undefined') {
    loadSavedViews();
    
    // Close dropdowns when clicking outside
    window.addEventListener('click', () => {
      showColumnSettings = false;
      showViewManager = false;
    });
  }

  // Importer state
  const importFields = [
    { key: 'lotNumber', label: 'Lot Number', required: true },
    { key: 'title', label: 'Title', required: true },
    { key: 'description', label: 'Description' },
    { key: 'hebrewTitle', label: 'Hebrew Title' },
    { key: 'hebrewDescription', label: 'Hebrew Description' },
    { key: 'category', label: 'Category' },
    { key: 'tags', label: 'Tags (comma / semicolon separated)' },
    { key: 'startingBid', label: 'Starting Bid' },
    { key: 'currentBid', label: 'Current Bid' },
    { key: 'bidIncrement', label: 'Bid Increment' },
    { key: 'endTime', label: 'End Time' },
    { key: 'status', label: 'Status' },
    { key: 'imageUrl', label: 'Primary Image URL' },
    { key: 'imageUrls', label: 'Additional Image URLs' },
    { key: 'position', label: 'Position' }
  ];
  let showImportModal = $state(false);
  let importFile = $state(null);
  let importPreview = $state(null); // { columns, sampleRows }
  let columnMapping = $state({});
  let importResult = $state(null);
  let importError = $state('');
  let importing = $state(false);

  // Color coding rules for problematic lots
  function getLotStatus(lot) {
    const issues = [];
    
    // Check for missing images
    const images = getLotImages(lot);
    if (images.length === 0) {
      issues.push('no-images');
    }
    
    // Check for invalid starting bid
    if (!lot.startingBid || lot.startingBid <= 0) {
      issues.push('invalid-price');
    }
    
    // Check for missing title
    if (!lot.title || lot.title.trim() === '') {
      issues.push('missing-title');
    }
    
    // Check for missing description
    if (!lot.description || lot.description.trim() === '') {
      issues.push('missing-description');
    }
    
    // Check for invalid bid increment
    if (!lot.bidIncrement || lot.bidIncrement <= 0) {
      issues.push('invalid-increment');
    }
    
    return issues;
  }

  function getLotRowClass(lot) {
    const issues = getLotStatus(lot);
    if (issues.length === 0) return 'bg-white';
    if (issues.includes('no-images')) return 'bg-red-50';
    if (issues.includes('invalid-price')) return 'bg-yellow-50';
    if (issues.includes('missing-title')) return 'bg-orange-50';
    return 'bg-yellow-50';
  }

  function getLotImages(lot, includeHidden = false) {
    // Use new images array if available
    if (lot.images && Array.isArray(lot.images)) {
      const images = lot.images
        .filter(img => includeHidden || !img.isHidden)
        .map(img => img.url || img);
      return images;
    }
    
    // Fallback to legacy fields
    if (lot.imageUrls) {
      try {
        const parsed = JSON.parse(lot.imageUrls);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    if (lot.imageUrl) {
      return [lot.imageUrl];
    }
    return [];
  }

  function setLotImages(lot, images) {
    if (images.length === 0) {
      lot.imageUrl = null;
      lot.imageUrls = null;
    } else if (images.length === 1) {
      lot.imageUrl = images[0];
      lot.imageUrls = null;
    } else {
      lot.imageUrl = images[0];
      lot.imageUrls = JSON.stringify(images);
    }
  }

  let currentAuctionId = $state(null);
  
  $effect(() => {
    if ($page.params.id) {
      currentAuctionId = $page.params.id;
      loadData();
    }
  });
  
  // Only reload if the auction ID actually changes
  $effect(() => {
    if ($page.params.id && $page.params.id !== currentAuctionId) {
      currentAuctionId = $page.params.id;
      loadData();
    }
  });

  async function loadData() {
    try {
      loading = true;
      const auctionId = $page.params.id;
      
      const [auctionRes, lotsRes] = await Promise.all([
        fetch(`/api/auctions/${auctionId}`),
        fetch(`/api/lots?auctionId=${auctionId}`)
      ]);
      
      if (!auctionRes.ok) {
        throw new Error('Failed to load auction');
      }
      if (!lotsRes.ok) {
        throw new Error('Failed to load lots');
      }
      
      auction = await auctionRes.json();
      const loadedLots = await lotsRes.json();
      
      console.log('Loaded lots:', loadedLots);
      
      // Parse images for each lot
      lots = loadedLots.map(lot => {
        // Extract year fields from metaFields if they exist
        let yearEnglish = null;
        let yearHebrew = null;
        if (lot.metaFields) {
          try {
            const metaFields = typeof lot.metaFields === 'string' 
              ? JSON.parse(lot.metaFields) 
              : lot.metaFields;
            yearEnglish = metaFields.yearEnglish || null;
            yearHebrew = metaFields.yearHebrew || null;
          } catch (e) {
            // Ignore parse errors
          }
        }
        return {
        ...lot,
        _images: getLotImages(lot),
        images: lot.images || [],
          _tags: lot.tags ? (typeof lot.tags === 'string' ? JSON.parse(lot.tags) : lot.tags) : [],
          yearEnglish: yearEnglish || lot.yearEnglish || null,
          yearHebrew: yearHebrew || lot.yearHebrew || null
        };
      });
      
      // Initialize positions if not set
      if (lots.length > 0 && lots.some(lot => !lot.position || lot.position === 0)) {
        await initializePositions();
      }
      
      // Load categories and tags
      await loadCategoriesAndTags();
      
      console.log('Processed lots:', lots);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load lots. Please refresh the page.');
    } finally {
      loading = false;
    }
  }

  function resetImportState() {
    importFile = null;
    importPreview = null;
    columnMapping = {};
    importResult = null;
    importError = '';
    importing = false;
  }

  function openImportModal() {
    resetImportState();
    showImportModal = true;
  }

  function closeImportModal() {
    showImportModal = false;
  }

  function normalizeColumn(value) {
    return (value || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function guessMapping(columns = []) {
    const normalizedColumns = columns.map((c) => ({
      original: c,
      norm: normalizeColumn(c)
    }));

    const findMatch = (candidates) => {
      const normCandidates = candidates.map(normalizeColumn);
      const match = normalizedColumns.find((col) =>
        normCandidates.some((cand) => col.norm === cand || col.norm.includes(cand))
      );
      return match?.original || '';
    };

    return {
      lotNumber: findMatch(['lot number', 'lot', 'lot no', 'lot#', 'lotnum']),
      title: findMatch(['title', 'name', 'item title']),
      description: findMatch(['description', 'desc', 'details']),
      hebrewTitle: findMatch(['hebrew title']),
      hebrewDescription: findMatch(['hebrew description']),
      category: findMatch(['category', 'group']),
      tags: findMatch(['tags', 'keywords', 'labels']),
      startingBid: findMatch(['starting bid', 'start bid', 'opening price', 'start price', 'minimum bid']),
      currentBid: findMatch(['current bid', 'bid', 'reserve']),
      bidIncrement: findMatch(['bid increment', 'increment', 'step']),
      endTime: findMatch(['end time', 'end date', 'closing', 'close time']),
      status: findMatch(['status', 'state']),
      imageUrl: findMatch(['primary image', 'image', 'photo', 'picture']),
      imageUrls: findMatch(['images', 'additional images', 'extra images']),
      position: findMatch(['position', 'order', 'sort'])
    };
  }

  async function requestImportPreview(file) {
    importError = '';
    importPreview = null;
    importResult = null;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('action', 'preview');

    const response = await fetch(`/api/auctions/${$page.params.id}/lots/import`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to preview file');
    }

    const preview = await response.json();
    importPreview = preview;
    columnMapping = guessMapping(preview.columns || []);
  }

  async function handleImportFileChange(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    importFile = file;

    try {
      await requestImportPreview(file);
    } catch (err) {
      console.error('Import preview failed:', err);
      importError = err.message || 'Failed to preview file';
    }
  }

  function mappingIsValid() {
    return (
      columnMapping?.lotNumber &&
      columnMapping.lotNumber !== '__skip__' &&
      columnMapping?.title &&
      columnMapping.title !== '__skip__'
    );
  }

  async function runImport() {
    if (!importFile) {
      importError = 'Please choose a CSV or Excel file first.';
      return;
    }

    if (!mappingIsValid()) {
      importError = 'Map at least Lot Number and Title.';
      return;
    }

    importing = true;
    importError = '';

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('action', 'import');
      formData.append('mapping', JSON.stringify(columnMapping));

      const response = await fetch(`/api/auctions/${$page.params.id}/lots/import`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Import failed');
      }

      const result = await response.json();
      importResult = result;
      await loadData();
    } catch (err) {
      console.error('Import failed:', err);
      importError = err.message || 'Failed to import lots';
    } finally {
      importing = false;
    }
  }

  function startEdit(lotId, field, currentValue) {
    editingCell = { lotId, field, value: currentValue || '' };
    // Initialize category input if editing category
    if (field === 'category') {
      const lot = lots.find(l => l.id === lotId);
      categoryInputs[lotId] = lot?.category || '';
    }
    // Initialize tag input if editing tags
    if (field === 'tags') {
      const lot = lots.find(l => l.id === lotId);
      tagInputs[lotId] = '';
    }
  }

  function cancelEdit() {
    editingCell = null;
  }
  
  async function initializePositions() {
    // Set positions based on current order (1, 2, 3, ...)
    const updates = lots.map((lot, index) => {
      return fetch(`/api/lots/${lot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: index + 1 })
      });
    });
    await Promise.all(updates);
  }
  
  async function reorderLots() {
    if (reordering) return;
    reordering = true;
    
    try {
      const lotIds = lots.map(lot => lot.id);
      const response = await fetch('/api/lots/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId: $page.params.id,
          lotIds: lotIds
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to reorder lots');
      }
      
      // Reload data to get updated positions
      await loadData();
    } catch (error) {
      console.error('Error reordering lots:', error);
      alert('Failed to reorder lots. Please try again.');
    } finally {
      reordering = false;
    }
  }
  
  function handleDragStart(event, lot) {
    event.stopPropagation();
    draggedLot = lot;
    // Set drag data
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', lot.id);
    }
  }
  
  function handleDragOver(event, targetLot) {
    event.preventDefault();
    if (!draggedLot || draggedLot.id === targetLot.id) return;
    
    const draggedIndex = lots.findIndex(l => l.id === draggedLot.id);
    const targetIndex = lots.findIndex(l => l.id === targetLot.id);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Reorder in local state
    const newLots = [...lots];
    const [removed] = newLots.splice(draggedIndex, 1);
    newLots.splice(targetIndex, 0, removed);
    lots = newLots;
    
    // Update dragged lot reference
    draggedLot = removed;
  }
  
  function handleDragEnd() {
    if (draggedLot) {
      reorderLots();
      draggedLot = null;
    }
  }
  
  function moveLotUp(index) {
    if (index === 0) return;
    const newLots = [...lots];
    [newLots[index - 1], newLots[index]] = [newLots[index], newLots[index - 1]];
    lots = newLots;
    reorderLots();
  }
  
  function moveLotDown(index) {
    if (index === lots.length - 1) return;
    const newLots = [...lots];
    [newLots[index], newLots[index + 1]] = [newLots[index + 1], newLots[index]];
    lots = newLots;
    reorderLots();
  }

  async function saveCell(lotId, field, value) {
    try {
      saving[lotId] = true;
      
      // Find the lot and update it
      const lot = lots.find(l => l.id === lotId);
      if (!lot) return;

      // Handle special field types
      let updateValue = value;
      let fieldToSave = field;
      
      if (field === 'startingBid' || field === 'bidIncrement' || field === 'currentBid') {
        updateValue = parseFloat(value) || 0;
      } else if (field === 'lotNumber') {
        updateValue = parseInt(value) || 1;
      } else if (field === 'endTime') {
        updateValue = value || null;
      } else if (field === 'isReady') {
        updateValue = value === true || value === 'true';
      } else if (field === 'tags') {
        // Tags come as JSON string from editingCell, parse to array for API
        if (typeof value === 'string') {
          try {
            updateValue = JSON.parse(value);
            // Also update the local _tags array
            lot._tags = updateValue || [];
          } catch {
            updateValue = null;
            lot._tags = [];
          }
        } else if (Array.isArray(value)) {
          updateValue = value;
          lot._tags = value;
        } else {
          updateValue = null;
          lot._tags = [];
        }
      } else if (field === 'yearEnglish' || field === 'yearHebrew') {
        // Year fields are stored in metaFields JSON
        // First, get existing metaFields from the lot
        let metaFields = {};
        try {
          if (lot.metaFields) {
            metaFields = typeof lot.metaFields === 'string' 
              ? JSON.parse(lot.metaFields) 
              : lot.metaFields;
          }
        } catch (e) {
          metaFields = {};
        }
        // Update the specific year field
        if (value && value.trim() !== '') {
          metaFields[field] = value.trim();
        } else {
          delete metaFields[field];
        }
        // Convert back to JSON string
        updateValue = Object.keys(metaFields).length > 0 ? JSON.stringify(metaFields) : null;
        fieldToSave = 'metaFields';
        // Update local state
        lot.metaFields = updateValue;
        lot[field] = value && value.trim() !== '' ? value.trim() : null; // Also store locally for display
      }

      // Update local state immediately
      if (field === 'category') {
        lot.category = updateValue;
      } else if (field === 'yearEnglish' || field === 'yearHebrew') {
        // Already handled above
      } else if (field !== 'tags') {
        lot[field] = updateValue;
      }

      // Check if this is a new lot that needs to be created
      const isNewLot = lot._isNew || lotId.startsWith('new-');
      
      if (isNewLot) {
        // Create new lot with POST
        const lotData = {
          auctionId: $page.params.id,
          lotNumber: lot.lotNumber || 1,
          title: lot.title || '',
          description: lot.description || '',
          category: lot.category || '',
          tags: lot._tags && lot._tags.length > 0 ? lot._tags : null,
          startingBid: lot.startingBid || 0,
          bidIncrement: lot.bidIncrement || 100,
          currentBid: lot.currentBid || 0,
          status: lot.status || 'ACTIVE',
          endTime: lot.endTime || null,
          imageUrl: lot.imageUrl || null,
          imageUrls: lot.imageUrls || null
        };

        const response = await fetch('/api/lots', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(lotData)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create lot');
        }

        // Update local lot with server response (which has the real ID)
        const created = await response.json();
        const index = lots.findIndex(l => l.id === lotId);
        if (index !== -1) {
          // Replace the temporary lot with the created one
          lots[index] = { 
            ...created, 
            _images: getLotImages(created),
            _tags: created.tags ? (typeof created.tags === 'string' ? JSON.parse(created.tags) : created.tags) : []
          };
        }

        editingCell = null;
      } else {
        // Update existing lot with PATCH
        const response = await fetch(`/api/lots/${lotId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            [fieldToSave]: updateValue
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save');
        }

        // Update local lot with server response
        const updated = await response.json();
        const index = lots.findIndex(l => l.id === lotId);
        if (index !== -1) {
          // Extract year fields from metaFields if they exist
          let yearEnglish = null;
          let yearHebrew = null;
          if (updated.metaFields) {
            try {
              const metaFields = typeof updated.metaFields === 'string' 
                ? JSON.parse(updated.metaFields) 
                : updated.metaFields;
              yearEnglish = metaFields.yearEnglish || null;
              yearHebrew = metaFields.yearHebrew || null;
            } catch (e) {
              // Ignore parse errors
            }
          }
          lots[index] = { 
            ...updated, 
            _images: getLotImages(updated),
            _tags: updated.tags ? (typeof updated.tags === 'string' ? JSON.parse(updated.tags) : updated.tags) : [],
            yearEnglish: yearEnglish || updated.yearEnglish || null,
            yearHebrew: yearHebrew || updated.yearHebrew || null
          };
        }

        editingCell = null;
      }
    } catch (error) {
      console.error('Error saving cell:', error);
      alert(`Failed to save: ${error.message || 'Please try again.'}`);
    } finally {
      saving[lotId] = false;
    }
  }

  function handleKeydown(event, lotId, field, value) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveCell(lotId, field, value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }

  async function cleanupLot(lotId) {
    try {
      cleaningUp[lotId] = true;
      
      const lot = lots.find(l => l.id === lotId);
      if (!lot) return;

      const response = await fetch(`/api/lots/${lotId}/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          includeImages: true
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to clean up' }));
        throw new Error(error.error || 'Failed to clean up');
      }

      const cleaned = await response.json();
      
      // Update local state with cleaned data
      const index = lots.findIndex(l => l.id === lotId);
      if (index !== -1) {
        if (cleaned.title) lot.title = cleaned.title;
        if (cleaned.description) lot.description = cleaned.description;
        if (cleaned.hebrewTitle) lot.hebrewTitle = cleaned.hebrewTitle;
        if (cleaned.hebrewDescription) lot.hebrewDescription = cleaned.hebrewDescription;
        if (cleaned.yearEnglish) lot.yearEnglish = cleaned.yearEnglish;
        if (cleaned.yearHebrew) lot.yearHebrew = cleaned.yearHebrew;
        
        // Update metaFields if year fields were updated
        if (cleaned.yearEnglish || cleaned.yearHebrew) {
          let metaFields = {};
          try {
            if (lot.metaFields) {
              metaFields = typeof lot.metaFields === 'string' 
                ? JSON.parse(lot.metaFields) 
                : lot.metaFields;
            }
          } catch (e) {
            metaFields = {};
          }
          if (cleaned.yearEnglish) metaFields.yearEnglish = cleaned.yearEnglish;
          if (cleaned.yearHebrew) metaFields.yearHebrew = cleaned.yearHebrew;
          lot.metaFields = Object.keys(metaFields).length > 0 ? JSON.stringify(metaFields) : null;
        }
        
        lots[index] = { ...lot };
      }

      // Reload data to get updated lot from server
      await loadData();
      
      alert('Lot information cleaned up successfully!');
    } catch (error) {
      console.error('Error cleaning up lot:', error);
      alert(`Failed to clean up: ${error.message || 'Please try again.'}`);
    } finally {
      cleaningUp[lotId] = false;
    }
  }

  function toggleLotSelection(lotId) {
    if (selectedLots.has(lotId)) {
      selectedLots.delete(lotId);
    } else {
      selectedLots.add(lotId);
    }
    selectedLots = new Set(selectedLots);
  }

  function toggleSelectAll() {
    if (selectedLots.size === lots.length) {
      selectedLots = new Set();
    } else {
      selectedLots = new Set(lots.map(l => l.id));
    }
  }

  async function handleImageUpload(lotId, event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;

    try {
      // Check if this is a new lot that needs to be created first
      const isNewLot = lot._isNew || lotId.startsWith('new-');
      let actualLotId = lotId;
      
      if (isNewLot) {
        // Create the lot first
        const lotData = {
          auctionId: $page.params.id,
          lotNumber: lot.lotNumber || 1,
          title: lot.title || '',
          description: lot.description || '',
          category: lot.category || '',
          tags: lot._tags && lot._tags.length > 0 ? lot._tags : null,
          startingBid: lot.startingBid || 0,
          bidIncrement: lot.bidIncrement || 100,
          currentBid: lot.currentBid || 0,
          status: lot.status || 'ACTIVE',
          endTime: lot.endTime || null,
          imageUrl: lot.imageUrl || null,
          imageUrls: lot.imageUrls || null
        };

        const createResponse = await fetch('/api/lots', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(lotData)
        });

        if (!createResponse.ok) {
          const error = await createResponse.json();
          throw new Error(error.error || 'Failed to create lot');
        }

        const created = await createResponse.json();
        actualLotId = created.id;
        
        // Update local lot with server response
        const index = lots.findIndex(l => l.id === lotId);
        if (index !== -1) {
          lots[index] = { ...created, _images: getLotImages(created), _tags: created.tags ? (typeof created.tags === 'string' ? JSON.parse(created.tags) : created.tags) : [] };
        }
      }

      // Upload files to cloud storage
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      formData.append('lotId', actualLotId);
      formData.append('removeBackground', (removeBackground[lotId] || false).toString());

      const uploadResponse = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload images');
      }

      const { images: uploadedImages } = await uploadResponse.json();
      
      // Create image records in database
      const imageResponse = await fetch(`/api/lots/${actualLotId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          images: uploadedImages.map((img, index) => ({
            url: img.url,
            key: img.key,
            displayOrder: index,
            isPrimary: index === 0 && (!lot.images || lot.images.length === 0)
          }))
        })
      });

      if (!imageResponse.ok) {
        throw new Error('Failed to save image records');
      }

      // Reload lot data to get updated images
      await loadData();
      
      // Clear the file input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload images. Please try again.');
    }
  }

  async function removeImage(lotId, imageId) {
    try {
      const response = await fetch(`/api/lots/${lotId}/images?imageId=${imageId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      // Reload lot data to get updated images
      await loadData();
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image. Please try again.');
    }
  }

  async function deleteAllImages(lotId) {
    const lot = lots.find(l => l.id === lotId);
    if (!lot || !lot.images || lot.images.length === 0) {
      return;
    }

    const imageCount = lot.images.length;
    if (!confirm(`Are you sure you want to delete all ${imageCount} image(s) for Lot #${lot.lotNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete all images in parallel
      const deletePromises = lot.images.map(image => 
        fetch(`/api/lots/${lotId}/images?imageId=${image.id}`, {
          method: 'DELETE'
        })
      );

      await Promise.all(deletePromises);

      // Reload lot data to get updated images
      await loadData();
      
      alert(`Successfully deleted ${imageCount} image(s).`);
    } catch (error) {
      console.error('Error deleting all images:', error);
      alert('Failed to delete all images. Please try again.');
    }
  }

  async function removeBackgroundFromImage(lotId, imageId, imageUrl) {
    try {
      removingBackground[imageId] = true;
      removingBackground = { ...removingBackground };

      // Get the lot to access image data
      const lot = lots.find(l => l.id === lotId);
      if (!lot) {
        throw new Error('Lot not found');
      }

      // If imageUrl is an S3 key (not a full URL), get presigned URL
      let actualImageUrl = imageUrl;
      if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        // It's likely an S3 key, get presigned URL
        try {
          const presignedResponse = await fetch('/api/images/presigned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keys: [imageUrl] })
          });
          if (presignedResponse.ok) {
            const { urls } = await presignedResponse.json();
            actualImageUrl = urls[imageUrl] || imageUrl;
          }
        } catch (e) {
          console.warn('Failed to get presigned URL, using original:', e);
        }
      }

      // Call background removal API
      const formData = new FormData();
      formData.append('url', actualImageUrl);

      const response = await fetch('/api/images/remove-background', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove background');
      }

      const result = await response.json();
      
      if (!result.success || !result.image) {
        throw new Error('Background removal failed: No image returned');
      }

      // Convert base64 to Blob
      // The API returns base64 data, which may or may not include the data URL prefix
      let base64Data = result.image;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1]; // Remove data:image/png;base64, prefix if present
      }
      
      // Convert base64 string to binary
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      
      // Create a File from the Blob
      const file = new File([blob], `no-background-${Date.now()}.png`, { type: 'image/png' });

      // Upload the processed image as a new image to the lot
      const uploadFormData = new FormData();
      uploadFormData.append('files', file);
      uploadFormData.append('lotId', lotId);

      const uploadResponse = await fetch('/api/upload/image', {
        method: 'POST',
        body: uploadFormData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload processed image');
      }

      const { images: uploadedImages } = await uploadResponse.json();
      
      // Create image record in database
      const imageResponse = await fetch(`/api/lots/${lotId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          images: uploadedImages.map((img, index) => ({
            url: img.url,
            key: img.key,
            displayOrder: (lot?.images?.length || 0) + index,
            isPrimary: false
          }))
        })
      });

      if (!imageResponse.ok) {
        throw new Error('Failed to save image record');
      }

      // Reload lot data to show the new image
      await loadData();
      
      alert('Background removed successfully! New image added to lot.');
    } catch (error) {
      console.error('Error removing background:', error);
      alert(`Failed to remove background: ${error.message}`);
    } finally {
      removingBackground[imageId] = false;
      removingBackground = { ...removingBackground };
    }
  }

  async function removeBackgroundFromAllImages(lotId) {
    const lot = lots.find(l => l.id === lotId);
    if (!lot || !lot.images || lot.images.length === 0) {
      alert('No images found for this lot');
      return;
    }

    const confirmed = confirm(`This will process ${lot.images.length} image(s) and may take a few minutes. Continue?`);
    if (!confirmed) return;

    try {
      removingBackgroundFromAll[lotId] = true;
      removingBackgroundFromAll = { ...removingBackgroundFromAll };

      const images = [...lot.images];
      let successCount = 0;
      let failCount = 0;
      const uploadedImages = [];

      for (const imageObj of images) {
        try {
          // Get presigned URL if needed
          let actualImageUrl = imageObj.url;
          if (imageObj.url && !imageObj.url.startsWith('http://') && !imageObj.url.startsWith('https://')) {
            try {
              const presignedResponse = await fetch('/api/images/presigned', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: [imageObj.url] })
              });
              if (presignedResponse.ok) {
                const { urls } = await presignedResponse.json();
                actualImageUrl = urls[imageObj.url] || imageObj.url;
              }
            } catch (e) {
              console.warn('Failed to get presigned URL, using original:', e);
            }
          }

          // Call background removal API
          const formData = new FormData();
          formData.append('url', actualImageUrl);

          const response = await fetch('/api/images/remove-background', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error('Failed to remove background');
          }

          const result = await response.json();
          
          if (!result.success || !result.image) {
            throw new Error('Background removal failed: No image returned');
          }

          // Convert base64 to Blob
          let base64Data = result.image;
          if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
          }
          
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'image/png' });
          const file = new File([blob], `no-background-${Date.now()}-${imageObj.id}.png`, { type: 'image/png' });

          // Upload the processed image
          const uploadFormData = new FormData();
          uploadFormData.append('files', file);
          uploadFormData.append('lotId', lotId);

          const uploadResponse = await fetch('/api/upload/image', {
            method: 'POST',
            body: uploadFormData
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload processed image');
          }

          const { images: newImages } = await uploadResponse.json();
          uploadedImages.push(...newImages);
          successCount++;

          // Small delay between images to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to process image ${imageObj.id}:`, error);
          failCount++;
        }
      }

      // Create all image records in database at once
      if (uploadedImages.length > 0) {
        const currentImageCount = lot.images?.length || 0;
        const imageResponse = await fetch(`/api/lots/${lotId}/images`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            images: uploadedImages.map((img, index) => ({
              url: img.url,
              key: img.key,
              displayOrder: currentImageCount + index,
              isPrimary: false
            }))
          })
        });

        if (!imageResponse.ok) {
          throw new Error('Failed to save image records');
        }
      }

      // Reload data to show all new images
      await loadData();

      alert(`Background removal complete!\nSuccess: ${successCount}\nFailed: ${failCount}`);
    } catch (error) {
      console.error('Error removing backgrounds from all images:', error);
      alert(`Failed to process all images: ${error.message}`);
    } finally {
      removingBackgroundFromAll[lotId] = false;
      removingBackgroundFromAll = { ...removingBackgroundFromAll };
    }
  }

  // Load banner templates from localStorage
  function loadBannerTemplates() {
    try {
      const stored = localStorage.getItem('banner-templates-lot');
      if (stored) {
        savedBannerTemplates = JSON.parse(stored);
      } else {
        savedBannerTemplates = [];
      }
    } catch (error) {
      console.error('Error loading banner templates:', error);
      savedBannerTemplates = [];
    }
  }

  // Open template selector for bulk banner generation
  function openBannerTemplateSelector() {
    if (selectedLots.size === 0) {
      alert('Please select at least one lot');
      return;
    }
    loadBannerTemplates();
    showBannerTemplateSelector = true;
  }

  // Generate banners for all selected lots using a template
  async function generateBannersForSelectedLots(template) {
    if (selectedLots.size === 0) {
      alert('Please select at least one lot');
      return;
    }

    const templateName = template ? template.name : 'Default Settings';
    const confirmed = confirm(`This will generate banners for ${selectedLots.size} lot(s) using ${templateName}. Continue?`);
    if (!confirmed) return;

    try {
      generatingBanners = true;
      showBannerTemplateSelector = false;
      
      const selectedLotIds = Array.from(selectedLots);
      let successCount = 0;
      let failCount = 0;

      for (const lotId of selectedLotIds) {
        try {
          const lot = lots.find(l => l.id === lotId);
          if (!lot) {
            console.error(`Lot ${lotId} not found`);
            failCount++;
            continue;
          }

          // Get featured image (primary image)
          const featuredImage = lot.images?.find(img => img.isPrimary) || lot.images?.[0];
          if (!featuredImage) {
            console.warn(`Lot ${lot.lotNumber} has no images, skipping`);
            failCount++;
            continue;
          }

          console.log(`Processing lot ${lot.lotNumber}, featured image:`, featuredImage);

          // Get image URL - use the URL directly if it's already a full presigned URL
          let imageUrl = featuredImage.url;
          
          // If no URL but we have a key, get presigned URL
          if (!imageUrl && featuredImage.key) {
            const imageUrlModule = await import('$lib/utils/imageUrl.js');
            imageUrl = await imageUrlModule.getImageUrl(featuredImage.key);
          }
          
          // Clean up double-encoded URLs and duplicate query parameters
          if (imageUrl) {
            // Check if URL is double-encoded (has %3F or %26)
            if (imageUrl.includes('%3F') || imageUrl.includes('%26')) {
              try {
                // Decode once
                imageUrl = decodeURIComponent(imageUrl);
              } catch (e) {
                console.warn('Failed to decode URL:', e);
              }
            }
            
            // Remove duplicate query parameters
            const firstQ = imageUrl.indexOf('?');
            if (firstQ !== -1) {
              const secondQ = imageUrl.indexOf('?', firstQ + 1);
              if (secondQ !== -1) {
                // Keep only the first query string
                imageUrl = imageUrl.substring(0, secondQ);
              }
            }
          }
          
          if (!imageUrl) {
            console.error(`Failed to get image URL for lot ${lot.lotNumber}`);
            failCount++;
            continue;
          }

          console.log(`Using image URL for lot ${lot.lotNumber}:`, imageUrl.substring(0, 100) + '...');

          // Generate banner using template settings (or default if no template)
          const bannerDataUrl = await generateBannerFromTemplate(template || null, lot, imageUrl);
          
          if (!bannerDataUrl) {
            console.error(`Failed to generate banner for lot ${lot.lotNumber}`);
            failCount++;
            continue;
          }

          console.log(`Generated banner for lot ${lot.lotNumber}, saving...`);

          // Save banner to lot
          await saveBannerToLot(lotId, bannerDataUrl);
          
          console.log(`Successfully saved banner for lot ${lot.lotNumber}`);
          successCount++;
          
          // Small delay between lots
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to generate banner for lot ${lotId}:`, error);
          console.error('Error details:', error.stack);
          failCount++;
        }
      }

      // Reload data to show new banners
      await loadData();

      alert(`Banner generation complete!\nSuccess: ${successCount}\nFailed: ${failCount}`);
    } catch (error) {
      console.error('Error generating banners:', error);
      alert(`Failed to generate banners: ${error.message}`);
    } finally {
      generatingBanners = false;
    }
  }

  // Generate a banner from a template (or default settings if template is null)
  async function generateBannerFromTemplate(template, lot, imageUrl) {
    // Default settings if no template
    const defaultSettings = {
      width: 1559,
      height: 945,
      backgroundType: 'solid',
      backgroundColor: '#F5F1E8',
      imageLayout: 'right',
      textImageRatio: 0.4,
      textColor: '#2C1810',
      textAlign: 'center',
      textBackground: 'rgba(245, 241, 232, 0.95)',
      textBackgroundOpacity: 0.95,
      padding: 30,
      fontSize: 42,
      fontFamily: 'Cormorant Garamond, Times New Roman, serif',
      titleEnglishFontSize: 48,
      subtitleEnglishFontSize: 28
    };
    
    const settings = template?.settings || defaultSettings;
    
    // Default banner dimensions
    const width = settings.width || 1559;
    const height = settings.height || 945;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Draw background
    if (settings.backgroundType === 'solid') {
      ctx.fillStyle = settings.backgroundColor || '#F5F1E8';
      ctx.fillRect(0, 0, width, height);
    } else if (settings.backgroundType === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      const colors = settings.backgroundGradient?.colors || ['#F5F1E8', '#E8E0D0'];
      const stops = settings.backgroundGradient?.stops || [0, 100];
      colors.forEach((color, i) => {
        grad.addColorStop(stops[i] / 100, color);
      });
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = settings.backgroundColor || '#F5F1E8';
      ctx.fillRect(0, 0, width, height);
    }

    // Calculate text area based on layout
    const imageLayout = settings.imageLayout || 'right';
    const textImageRatio = settings.textImageRatio || 0.4;
    let textAreaWidth, textAreaX, textAreaY;
    
    if (imageLayout === 'right') {
      textAreaWidth = width * textImageRatio;
      textAreaX = 0;
      textAreaY = 0;
    } else if (imageLayout === 'left') {
      textAreaWidth = width * textImageRatio;
      textAreaX = width - textAreaWidth;
      textAreaY = 0;
    } else if (imageLayout === 'full' || imageLayout === 'center') {
      textAreaWidth = width;
      textAreaX = 0;
      textAreaY = 0;
    } else {
      textAreaWidth = width * textImageRatio;
      textAreaX = 0;
      textAreaY = 0;
    }

    // Draw image
    if (imageUrl) {
      try {
        console.log('Loading image for banner:', imageUrl.substring(0, 100) + '...');
        // Use proxy for CORS
        const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Proxy response error:', response.status, errorText);
          throw new Error(`Failed to load image: ${response.status}`);
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            console.log('Image loaded, dimensions:', img.width, 'x', img.height);
            
            if (imageLayout === 'right') {
              const imageWidth = width * (1 - textImageRatio);
              const imageX = width * textImageRatio;
              // Scale to cover height while maintaining aspect ratio
              const scale = Math.max(imageWidth / img.width, height / img.height);
              const scaledWidth = img.width * scale;
              const scaledHeight = img.height * scale;
              const offsetX = imageX + (imageWidth - scaledWidth) / 2;
              const offsetY = (height - scaledHeight) / 2;
              ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
            } else if (imageLayout === 'left') {
              const imageWidth = width * (1 - textImageRatio);
              const scale = Math.max(imageWidth / img.width, height / img.height);
              const scaledWidth = img.width * scale;
              const scaledHeight = img.height * scale;
              const offsetX = (imageWidth - scaledWidth) / 2;
              const offsetY = (height - scaledHeight) / 2;
              ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
            } else if (imageLayout === 'full' || imageLayout === 'center') {
              // Full background image
              const scale = Math.max(width / img.width, height / img.height);
              const scaledWidth = img.width * scale;
              const scaledHeight = img.height * scale;
              const offsetX = (width - scaledWidth) / 2;
              const offsetY = (height - scaledHeight) / 2;
              ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
            }
            
            URL.revokeObjectURL(blobUrl);
            console.log('Image drawn to canvas');
            resolve();
          };
          img.onerror = (error) => {
            console.error('Image load error:', error);
            URL.revokeObjectURL(blobUrl);
            reject(new Error('Failed to load image'));
          };
          img.src = blobUrl;
        });
      } catch (error) {
        console.error('Error loading image for banner:', error);
        // Continue without image - banner will still be generated with text only
      }
    }

    // Draw text background
    if (settings.textBackground && settings.textBackgroundOpacity > 0) {
      ctx.save();
      ctx.fillStyle = settings.textBackground;
      ctx.globalAlpha = settings.textBackgroundOpacity;
      ctx.fillRect(textAreaX, textAreaY, textAreaWidth, height);
      ctx.globalAlpha = 1.0;
      ctx.restore();
    }

    // Draw text
    ctx.fillStyle = settings.textColor || '#2C1810';
    ctx.textBaseline = 'top';
    
    const padding = settings.padding || 30;
    const centerX = textAreaX + textAreaWidth / 2;
    const leftX = textAreaX + padding;
    const rightX = textAreaX + textAreaWidth - padding;
    const maxTextWidth = textAreaWidth - (padding * 2);
    let currentY = height * 0.2;

    // Title (English)
    if (lot.title) {
      const fontSize = settings.titleEnglishFontSize || 48;
      const textAlign = settings.titleEnglishAlign || settings.textAlign || 'center';
      const textX = textAlign === 'center' ? centerX : 
                    textAlign === 'right' ? rightX : leftX;
      
      ctx.font = `bold ${fontSize}px ${settings.fontFamily || 'Cormorant Garamond, Times New Roman, serif'}`;
      ctx.textAlign = textAlign;
      
      // Word wrap text
      const words = lot.title.split(' ');
      let line = '';
      const lineHeight = fontSize * 1.3;
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && n > 0) {
          ctx.fillText(line, textX, currentY, maxTextWidth);
          line = words[n] + ' ';
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, textX, currentY, maxTextWidth);
      currentY += lineHeight * 1.5;
    }

    // Subtitle/Description (English)
    if (lot.description) {
      const fontSize = settings.subtitleEnglishFontSize || 28;
      const textAlign = settings.subtitleEnglishAlign || settings.textAlign || 'center';
      const textX = textAlign === 'center' ? centerX : 
                    textAlign === 'right' ? rightX : leftX;
      
      ctx.font = `${fontSize}px ${settings.fontFamily || 'Cormorant Garamond, Times New Roman, serif'}`;
      ctx.textAlign = textAlign;
      
      // Word wrap description
      const words = lot.description.split(' ');
      let line = '';
      const lineHeight = fontSize * 1.2;
      const maxLines = 4;
      let lineCount = 0;
      
      for (let n = 0; n < words.length && lineCount < maxLines; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && n > 0) {
          ctx.fillText(line, textX, currentY, maxTextWidth);
          line = words[n] + ' ';
          currentY += lineHeight;
          lineCount++;
        } else {
          line = testLine;
        }
      }
      if (lineCount < maxLines) {
        ctx.fillText(line, textX, currentY, maxTextWidth);
      }
    }

    return canvas.toDataURL('image/png');
  }

  // Save banner to lot
  async function saveBannerToLot(lotId, bannerDataUrl) {
    try {
      // Convert base64 to Blob
      const base64Data = bannerDataUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid banner data URL');
      }
      
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      const file = new File([blob], `banner-${lotId}-${Date.now()}.png`, { type: 'image/png' });

      console.log(`Uploading banner file for lot ${lotId}, size: ${file.size} bytes`);

      // Upload the banner image
      const uploadFormData = new FormData();
      uploadFormData.append('files', file);
      uploadFormData.append('lotId', lotId);

      const uploadResponse = await fetch('/api/upload/image', {
        method: 'POST',
        body: uploadFormData
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload response error:', errorText);
        throw new Error(`Failed to upload banner image: ${uploadResponse.status} ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('Upload result:', uploadResult);
      
      const uploadedImages = uploadResult.images;
      if (!uploadedImages || uploadedImages.length === 0) {
        throw new Error('No images returned from upload');
      }

      console.log(`Uploaded ${uploadedImages.length} image(s), saving to database...`);

      // Create image record in database
      const imageResponse = await fetch(`/api/lots/${lotId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          images: uploadedImages.map((img) => ({
            url: img.url,
            key: img.key,
            displayOrder: 0,
            isPrimary: false
          }))
        })
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error('Image save response error:', errorText);
        throw new Error(`Failed to save image record: ${imageResponse.status} ${errorText}`);
      }

      const saveResult = await imageResponse.json();
      console.log('Image save result:', saveResult);
    } catch (error) {
      console.error(`Error in saveBannerToLot for lot ${lotId}:`, error);
      throw error;
    }
  }

  function openImageModal(lotId) {
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;
    showImageModal = { lotId, images: lot._images || [] };
  }
  
  function toggleImageRow(lotId) {
    if (expandedImageRows.has(lotId)) {
      expandedImageRows.delete(lotId);
    } else {
      expandedImageRows.add(lotId);
    }
    expandedImageRows = new Set(expandedImageRows); // Trigger reactivity
  }

  function toggleNotesRow(lotId) {
    if (expandedNotesRows.has(lotId)) {
      expandedNotesRows.delete(lotId);
    } else {
      expandedNotesRows.add(lotId);
    }
    expandedNotesRows = new Set(expandedNotesRows); // Trigger reactivity
  }

  function toggleAIRow(lotId) {
    if (expandedAIRows.has(lotId)) {
      expandedAIRows.delete(lotId);
    } else {
      expandedAIRows.add(lotId);
    }
    expandedAIRows = new Set(expandedAIRows); // Trigger reactivity
  }

  function toggleBannerRow(lotId) {
    if (expandedBannerRows.has(lotId)) {
      expandedBannerRows.delete(lotId);
    } else {
      expandedBannerRows.add(lotId);
    }
    expandedBannerRows = new Set(expandedBannerRows); // Trigger reactivity
  }

  async function handleAIGenerated(lotId, updates) {
    // Apply AI-generated content to the lot
    for (const [field, value] of Object.entries(updates)) {
      await saveCell(lotId, field, value);
    }
  }
  
  async function reorderImages(lotId, draggedImageId, targetImageId) {
    try {
      const lot = lots.find(l => l.id === lotId);
      if (!lot || !lot.images) return;
      
      const images = [...lot.images];
      const draggedIndex = images.findIndex(img => img.id === draggedImageId);
      const targetIndex = images.findIndex(img => img.id === targetImageId);
      
      if (draggedIndex === -1 || targetIndex === -1) return;
      
      // Reorder in local array
      const [movedImage] = images.splice(draggedIndex, 1);
      images.splice(targetIndex, 0, movedImage);
      
      // Update displayOrder for all images
      const updatedImages = images.map((img, index) => ({
        id: img.id,
        displayOrder: index,
        isPrimary: img.isPrimary || false,
        isHidden: img.isHidden || false
      }));
      
      // Save to database
      const response = await fetch(`/api/lots/${lotId}/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: updatedImages })
      });
      
      if (!response.ok) {
        throw new Error('Failed to reorder images');
      }
      
      // Reload data to get updated order
      await loadData();
    } catch (error) {
      console.error('Error reordering images:', error);
      alert('Failed to reorder images. Please try again.');
    }
  }
  
  async function moveImageUp(lotId, imageId) {
    try {
      const lot = lots.find(l => l.id === lotId);
      if (!lot || !lot.images) return;
      
      const images = [...lot.images].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      });
      
      const index = images.findIndex(img => img.id === imageId);
      if (index === 0) return;
      
      // Swap with previous image
      [images[index - 1], images[index]] = [images[index], images[index - 1]];
      
      // Update displayOrder for all images
      const updatedImages = images.map((img, idx) => ({
        id: img.id,
        displayOrder: idx,
        isPrimary: img.isPrimary || false
      }));
      
      // Save to database
      const response = await fetch(`/api/lots/${lotId}/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: updatedImages })
      });
      
      if (!response.ok) {
        throw new Error('Failed to move image');
      }
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error moving image up:', error);
      alert('Failed to move image. Please try again.');
    }
  }
  
  async function moveImageDown(lotId, imageId) {
    try {
      const lot = lots.find(l => l.id === lotId);
      if (!lot || !lot.images) return;
      
      const images = [...lot.images].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      });
      
      const index = images.findIndex(img => img.id === imageId);
      if (index === images.length - 1) return;
      
      // Swap with next image
      [images[index], images[index + 1]] = [images[index + 1], images[index]];
      
      // Update displayOrder for all images
      const updatedImages = images.map((img, idx) => ({
        id: img.id,
        displayOrder: idx,
        isPrimary: img.isPrimary || false
      }));
      
      // Save to database
      const response = await fetch(`/api/lots/${lotId}/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: updatedImages })
      });
      
      if (!response.ok) {
        throw new Error('Failed to move image');
      }
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error moving image down:', error);
      alert('Failed to move image. Please try again.');
    }
  }
  
  async function toggleImageHidden(lotId, imageId, currentHiddenState) {
    try {
      const lot = lots.find(l => l.id === lotId);
      if (!lot || !lot.images) return;
      
      const images = lot.images.map(img => ({
        id: img.id,
        displayOrder: img.displayOrder || 0,
        isPrimary: img.isPrimary || false,
        isHidden: img.id === imageId ? !currentHiddenState : (img.isHidden || false)
      }));
      
      // Save to database
      const response = await fetch(`/api/lots/${lotId}/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
      });

      if (!response.ok) {
        throw new Error('Failed to update image');
      }

      // Reload lot data to get updated images
      await loadData();
    } catch (error) {
      console.error('Error toggling image hidden state:', error);
      alert('Failed to update image. Please try again.');
    }
  }
  
  async function setFeaturedImage(lotId, imageId) {
    try {
      const lot = lots.find(l => l.id === lotId);
      if (!lot || !lot.images) return;
      
      const currentImage = lot.images.find(img => img.id === imageId);
      const isCurrentlyPrimary = currentImage?.isPrimary || false;
      
      // If clicking the same image that's already primary, unset it
      // Otherwise, set this one as primary and unset others
      const images = lot.images.map(img => ({
        id: img.id,
        displayOrder: img.displayOrder || 0,
        isPrimary: img.id === imageId ? !isCurrentlyPrimary : false,
        isHidden: img.isHidden || false
      }));
      
      // Save to database
      const response = await fetch(`/api/lots/${lotId}/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
      });
      
      if (!response.ok) {
        throw new Error('Failed to set featured image');
      }
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error setting featured image:', error);
      alert('Failed to set featured image. Please try again.');
    }
  }

  async function loadCategoriesAndTags() {
    try {
      if (!auction?.auctionHouseId) return;
      
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch(`/api/categories?auctionHouseId=${auction.auctionHouseId}`),
        fetch(`/api/tags?auctionHouseId=${auction.auctionHouseId}`)
      ]);
      
      if (categoriesRes.ok) {
        availableCategories = await categoriesRes.json();
      }
      if (tagsRes.ok) {
        availableTags = await tagsRes.json();
      }
    } catch (error) {
      console.error('Error loading categories and tags:', error);
    }
  }

  let exportingBidSpirit = $state(false);
  let uploadingImages = $state(false);

  async function handleBulkImageUpload() {
    // Create file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*';
    
    fileInput.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      uploadingImages = true;
      
      try {
        // Parse filenames: format is "lotNumber-imageNumber.ext" (e.g., "4-1.jpg")
        const imagesByLot = {};
        
        files.forEach(file => {
          const match = file.name.match(/^(\d+)-(\d+)\.(jpg|jpeg|png|gif|webp)$/i);
          if (match) {
            const lotNumber = parseInt(match[1], 10);
            const imageNumber = parseInt(match[2], 10);
            
            if (!imagesByLot[lotNumber]) {
              imagesByLot[lotNumber] = [];
            }
            imagesByLot[lotNumber].push({
              file,
              imageNumber,
              lotNumber
            });
          } else {
            console.warn(`Skipping file with invalid name format: ${file.name}. Expected format: lotNumber-imageNumber.ext (e.g., 4-1.jpg)`);
          }
        });

        const lotNumbers = Object.keys(imagesByLot).map(Number).sort((a, b) => a - b);
        console.log(`Found images for ${lotNumbers.length} lots:`, lotNumbers);
        
        if (lotNumbers.length === 0) {
          alert('No valid files found. Please use the format: lotNumber-imageNumber.ext (e.g., 4-1.jpg)');
          uploadingImages = false;
          return;
        }

        let uploadedCount = 0;
        let errorCount = 0;
        const errors = [];

        // Process each lot
        for (const lotNumber of lotNumbers) {
          const lotImages = imagesByLot[lotNumber].sort((a, b) => a.imageNumber - b.imageNumber);
          
          try {
            // Find the lot by lot number
            const lot = lots.find(l => l.lotNumber === lotNumber);
            
            if (!lot) {
              console.error(`Lot ${lotNumber} not found`);
              errors.push(`Lot ${lotNumber} not found`);
              errorCount += lotImages.length;
              continue;
            }

            // Upload images for this lot
            const formData = new FormData();
            console.log(`[Upload] Preparing to upload ${lotImages.length} images for lot ${lotNumber}:`, lotImages.map(i => i.file.name));
            
            // Add all files to FormData
            lotImages.forEach((item, idx) => {
              formData.append('files', item.file);
              console.log(`[Upload] Added file ${idx + 1}/${lotImages.length} to FormData: ${item.file.name} (${item.file.size} bytes)`);
            });
            
            // Verify all files are in FormData
            const filesInFormData = formData.getAll('files');
            console.log(`[Upload] FormData contains ${filesInFormData.length} files (expected ${lotImages.length})`);
            
            if (filesInFormData.length !== lotImages.length) {
              console.error(`[Upload] Mismatch: FormData has ${filesInFormData.length} files but expected ${lotImages.length}`);
            }
            
            formData.append('lotId', lot.id);

            console.log(`[Upload] Sending ${lotImages.length} files to /api/upload/image`);
            const uploadResponse = await fetch('/api/upload/image', {
              method: 'POST',
              body: formData
            });

            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text();
              console.error(`[Upload] Upload failed for lot ${lotNumber}:`, errorText);
              throw new Error(`Failed to upload images for lot ${lotNumber}: ${errorText}`);
            }

            const uploadResult = await uploadResponse.json();
            console.log(`[Upload] Upload response for lot ${lotNumber}:`, uploadResult);
            const uploadedImages = uploadResult.images || [];
            console.log(`[Upload] Received ${uploadedImages.length} uploaded images for lot ${lotNumber}`);

            if (uploadedImages.length === 0) {
              throw new Error(`No images were uploaded for lot ${lotNumber}`);
            }

            if (uploadedImages.length !== lotImages.length) {
              console.warn(`[Upload] Warning: Expected ${lotImages.length} images but got ${uploadedImages.length} for lot ${lotNumber}`);
            }

            // Associate images with lot
            const imagesToAssociate = uploadedImages.map((img, index) => ({
              url: img.url,
              key: img.key,
              displayOrder: index,
              isPrimary: index === 0 && (!lot.images || lot.images.length === 0)
            }));
            
            console.log(`[Upload] Associating ${imagesToAssociate.length} images with lot ${lotNumber}:`, imagesToAssociate);
            
            const imageResponse = await fetch(`/api/lots/${lot.id}/images`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                images: imagesToAssociate
              })
            });

            if (!imageResponse.ok) {
              const errorText = await imageResponse.text();
              console.error(`[Upload] Failed to associate images with lot ${lotNumber}:`, errorText);
              throw new Error(`Failed to associate images with lot ${lotNumber}: ${errorText}`);
            }

            const associatedResult = await imageResponse.json();
            console.log(`[Upload] Successfully associated ${associatedResult.length || imagesToAssociate.length} images with lot ${lotNumber}`);

            if (!imageResponse.ok) {
              throw new Error(`Failed to associate images with lot ${lotNumber}`);
            }

            uploadedCount += uploadedImages.length;
            console.log(`✓ Uploaded ${uploadedImages.length} images for lot ${lotNumber}`);

          } catch (error) {
            console.error(`Error uploading images for lot ${lotNumber}:`, error);
            errors.push(`Lot ${lotNumber}: ${error.message}`);
            errorCount += lotImages.length;
          }
        }

        // Reload data to show new images
        await loadData();

        if (errorCount > 0) {
          alert(`Upload complete: ${uploadedCount} images uploaded, ${errorCount} failed.\n\nErrors:\n${errors.join('\n')}`);
        } else {
          alert(`Successfully uploaded ${uploadedCount} images to ${lotNumbers.length} lots!`);
        }
      } catch (error) {
        console.error('Error in bulk image upload:', error);
        alert(`Failed to upload images: ${error.message}`);
      } finally {
        uploadingImages = false;
      }
    };

    fileInput.click();
  }

  async function exportToBidSpirit() {
    if (exportingBidSpirit) return;
    
    exportingBidSpirit = true;
    try {
      const response = await fetch(`/api/auctions/${$page.params.id}/export-bidspirit`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Export error:', errorText);
        throw new Error(errorText || 'Failed to export to BidSpirit');
      }

      // Get the zip file as blob
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Export returned empty file');
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `bidspirit-export-${auction?.title || 'auction'}-${Date.now()}.zip`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting to BidSpirit:', err);
      alert(`Failed to export to BidSpirit: ${err.message || 'Please try again.'}`);
    } finally {
      exportingBidSpirit = false;
    }
  }

  async function deleteLots() {
    if (selectedLots.size === 0) return;
    if (!confirm(`Delete ${selectedLots.size} lot(s)?`)) return;

    try {
      const deletePromises = Array.from(selectedLots).map(lotId =>
        fetch(`/api/lots/${lotId}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);
      selectedLots = new Set();
      await loadData();
    } catch (error) {
      console.error('Error deleting lots:', error);
      alert('Failed to delete lots');
    }
  }

  function addNewLot() {
    const newLotNumber = lots.length > 0 
      ? Math.max(...lots.map(l => l.lotNumber)) + 1 
      : 1;
    
    lots = [...lots, {
      id: `new-${Date.now()}`,
      lotNumber: newLotNumber,
      title: '',
      description: '',
      category: '',
      tags: null,
      _tags: [],
      startingBid: 0,
      bidIncrement: 100,
      currentBid: 0,
      status: 'ACTIVE',
      imageUrl: null,
      imageUrls: null,
      _images: [],
      _isNew: true
    }];
  }
</script>

<svelte:head>
  <title>Advanced Lot Management - {auction?.title || 'Loading...'}</title>
</svelte:head>

<div class="print:bg-white">
    {#if loading}
      <div class="py-16 text-center">
        <PumbiLoader size="lg" label="Loading" />
        <p class="mt-4 text-[var(--pumbi-muted)]">Loading lots…</p>
      </div>
    {:else if auction}
      <!-- Header -->
      <div class="pumbi-panel mb-6 p-6 print:hidden">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="pumbi-eyebrow">Spreadsheet</p>
            <h2 class="mt-1 font-[family-name:var(--pumbi-serif)] text-2xl font-semibold">Advanced lot grid</h2>
            <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">{auction.title}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick={addNewLot} class="pumbi-btn">Add lot</button>
            <button type="button" onclick={openImportModal} class="pumbi-btn-secondary">Import</button>
            <a href="/seller/auctions/{auction.id}/lots/bulk" class="pumbi-btn-secondary">Bulk CSV</a>
            <button
              onclick={handleBulkImageUpload}
              disabled={lots.length === 0 || uploadingImages}
              class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              title="Upload images named like '4-1.jpg' (lot 4, image 1)"
            >
              {#if uploadingImages}
                <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Uploading...
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Upload Images to Lots
              {/if}
            </button>
            <button
              onclick={exportToBidSpirit}
              disabled={lots.length === 0 || exportingBidSpirit}
              class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              title="Export all lots and images to BidSpirit format"
            >
              {#if exportingBidSpirit}
                <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Exporting...
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to BidSpirit
              {/if}
            </button>
            {#if selectedLots.size > 0}
              <button
                onclick={openBannerTemplateSelector}
                disabled={generatingBanners}
                class="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Generate banners for selected lots using a template"
              >
                {generatingBanners ? '⏳ Generating...' : '🎨 Generate Banners (' + selectedLots.size + ')'}
              </button>
              <button
                onclick={deleteLots}
                class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete Selected ({selectedLots.size})
              </button>
            {/if}
          </div>
        </div>
        
        <!-- Legend -->
        <div class="flex items-center gap-4 text-xs">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 bg-red-50 border border-red-200"></div>
            <span>Missing Images</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 bg-yellow-50 border border-yellow-200"></div>
            <span>Invalid Price/Increment</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 bg-orange-50 border border-orange-200"></div>
            <span>Missing Title</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 bg-white border border-gray-200"></div>
            <span>Valid</span>
          </div>
        </div>

        <!-- Column Visibility & View Management -->
        <div class="flex items-center gap-2">
          <div class="relative">
            <button
              type="button"
              onclick={(e) => { e.stopPropagation(); showColumnSettings = !showColumnSettings; }}
              class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
              Columns
            </button>
            {#if showColumnSettings}
              <div class="absolute left-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3" onclick={(e) => e.stopPropagation()}>
                <div class="text-xs font-semibold text-gray-700 mb-2">Show/Hide Columns</div>
                <div class="space-y-1 max-h-64 overflow-y-auto">
                  {#each columnDefinitions as col}
                    <label class="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer {col.alwaysVisible ? 'opacity-50' : ''}">
                      <input
                        type="checkbox"
                        checked={columnVisibility[col.key]}
                        disabled={col.alwaysVisible}
                        onchange={() => toggleColumn(col.key)}
                        class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span class="text-xs text-gray-700">{col.label}</span>
                    </label>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          <div class="relative">
            <button
              type="button"
              onclick={(e) => { e.stopPropagation(); showViewManager = !showViewManager; }}
              class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              {currentViewName}
            </button>
            {#if showViewManager}
              <div class="absolute left-0 mt-2 w-72 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3" onclick={(e) => e.stopPropagation()}>
                <div class="text-xs font-semibold text-gray-700 mb-2">Saved Views</div>
                <div class="space-y-2 mb-3 max-h-48 overflow-y-auto">
                  {#each savedViews as view}
                    <div class="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
                      <div class="flex items-center gap-2 flex-1">
                        {#if view.isDefault}
                          <span class="text-xs font-semibold text-blue-600">★</span>
                        {/if}
                        <button
                          onclick={() => loadView(view)}
                          class="text-xs text-gray-700 hover:text-blue-600 flex-1 text-left"
                        >
                          {view.name}
                        </button>
                      </div>
                      <div class="flex items-center gap-1">
                        {#if !view.isDefault}
                          <button
                            onclick={() => setDefaultView(view.id)}
                            class="text-xs text-gray-500 hover:text-blue-600"
                            title="Set as default"
                          >
                            ⭐
                          </button>
                        {/if}
                        <button
                          onclick={() => deleteView(view.id)}
                          class="text-xs text-red-500 hover:text-red-700"
                          title="Delete view"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
                <div class="border-t border-gray-200 pt-3">
                  <div class="text-xs font-semibold text-gray-700 mb-2">Save Current View</div>
                  <div class="flex gap-2">
                    <input
                      type="text"
                      bind:value={newViewName}
                      placeholder="View name..."
                      class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onkeydown={(e) => {
                        if (e.key === 'Enter') {
                          saveCurrentView();
                        }
                      }}
                    />
                    <button
                      onclick={saveCurrentView}
                      class="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Spreadsheet Table -->
      <div class="bg-white rounded-lg shadow-lg overflow-hidden print:hidden">
        {#if lots.length === 0}
          <div class="p-12 text-center">
            <p class="text-gray-600 text-lg mb-4">No lots found for this auction.</p>
            <button
              onclick={addNewLot}
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Add First Lot
            </button>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12 {columnVisibility.checkbox ? '' : 'hidden'}">
                  <input
                    type="checkbox"
                    checked={selectedLots.size === lots.length && lots.length > 0}
                    onchange={toggleSelectAll}
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th class="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8 {columnVisibility.dragHandle ? '' : 'hidden'}"></th>
                <th class="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8 {columnVisibility.position ? '' : 'hidden'}">Pos</th>
                <th class="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8 {columnVisibility.lotNumber ? '' : 'hidden'}">Lot</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20 {columnVisibility.images ? '' : 'hidden'}">Images</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px] {columnVisibility.title ? '' : 'hidden'}">Title</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px] {columnVisibility.description ? '' : 'hidden'}">Description</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40 {columnVisibility.hebrewTitle ? '' : 'hidden'}">Hebrew Title</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40 {columnVisibility.hebrewDescription ? '' : 'hidden'}">Hebrew Description</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 {columnVisibility.yearEnglish ? '' : 'hidden'}">Year (EN)</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 {columnVisibility.yearHebrew ? '' : 'hidden'}">Year (HE)</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40 {columnVisibility.category ? '' : 'hidden'}">Category</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28 {columnVisibility.bids ? '' : 'hidden'}">Bids</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28 {columnVisibility.increment && (editingCell && (editingCell.field === 'startingBid' || editingCell.field === 'currentBid' || editingCell.field === 'bidIncrement')) ? '' : 'hidden'}">Increment</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16 {columnVisibility.status ? '' : 'hidden'}">Status</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20 {columnVisibility.watchers ? '' : 'hidden'}">Watchers</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16 {columnVisibility.ready ? '' : 'hidden'}">Ready</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 {columnVisibility.endTime ? '' : 'hidden'}">End Time</th>
                <th class="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 {columnVisibility.actions ? '' : 'hidden'}">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each lots as lot, index (lot.id)}
                <tr 
                  class="{getLotRowClass(lot)} hover:bg-gray-50 transition-colors"
                  ondragover={(e) => handleDragOver(e, lot)}
                  ondragend={handleDragEnd}
                >
                  <!-- Checkbox -->
                  <td class="px-2 py-1 whitespace-nowrap {columnVisibility.checkbox ? '' : 'hidden'}">
                    <input
                      type="checkbox"
                      checked={selectedLots.has(lot.id)}
                      onchange={() => toggleLotSelection(lot.id)}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      onclick={(e) => e.stopPropagation()}
                    />
                  </td>
                  
                  <!-- Drag Handle -->
                  <td class="px-1 py-1 whitespace-nowrap {columnVisibility.dragHandle ? '' : 'hidden'}">
                    <div
                      draggable="true"
                      ondragstart={(e) => handleDragStart(e, lot)}
                      class="cursor-move text-gray-400 hover:text-gray-600 flex items-center justify-center"
                      title="Drag to reorder"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                      </svg>
                    </div>
                  </td>
                  
                  <!-- Position -->
                  <td class="px-1 py-1 whitespace-nowrap {columnVisibility.position ? '' : 'hidden'}">
                    <div class="flex items-center gap-0.5">
                      <span class="text-xs font-semibold text-blue-600">{lot.position || index + 1}</span>
                      <div class="flex flex-col">
                        <button
                          onclick={(e) => { e.stopPropagation(); moveLotUp(index); }}
                          disabled={index === 0 || reordering}
                          class="text-[10px] leading-none text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onclick={(e) => { e.stopPropagation(); moveLotDown(index); }}
                          disabled={index === lots.length - 1 || reordering}
                          class="text-[10px] leading-none text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  </td>
                  
                  <!-- Lot Number -->
                  <td class="px-1 py-1 whitespace-nowrap {columnVisibility.lotNumber ? '' : 'hidden'}">
                    {#if editingCell?.lotId === lot.id && editingCell?.field === 'lotNumber'}
                      <input
                        type="number"
                        bind:value={editingCell.value}
                        onblur={() => saveCell(lot.id, 'lotNumber', editingCell.value)}
                        onkeydown={(e) => handleKeydown(e, lot.id, 'lotNumber', editingCell.value)}
                        class="w-full px-0.5 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                        autofocus
                      />
                    {:else}
                      <span
                        ondblclick={() => startEdit(lot.id, 'lotNumber', lot.lotNumber)}
                        class="cursor-pointer hover:bg-blue-50 px-0.5 py-0.5 rounded text-xs"
                      >
                        {lot.lotNumber}
                      </span>
                    {/if}
                  </td>
                  
                  <!-- Images -->
                  <td class="px-2 py-1 {columnVisibility.images ? '' : 'hidden'}">
                    {#if true}
                      {@const visibleImages = getLotImages(lot, false)}
                    <div class="flex items-center gap-1">
                      <div class="flex items-center gap-1 overflow-x-auto max-w-[80px]">
                          {#each visibleImages.slice(0, 1) as image, i}
                          <img
                            src={image}
                            alt="Lot image {i + 1}"
                            class="w-8 h-8 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-75 flex-shrink-0"
                            onclick={() => toggleImageRow(lot.id)}
                          />
                        {/each}
                        {#if visibleImages.length === 0}
                          <div class="w-8 h-8 bg-gray-100 rounded border border-gray-300 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">
                            -
                          </div>
                        {/if}
                          {#if visibleImages.length > 2}
                            <div class="w-8 h-8 bg-gray-800 bg-opacity-75 rounded border border-gray-300 flex items-center justify-center text-[10px] text-white flex-shrink-0" title="+{visibleImages.length - 2} more">
                              +{visibleImages.length - 2}
                          </div>
                        {/if}
                      </div>
                      <button
                        onclick={() => toggleImageRow(lot.id)}
                        class="ml-1 text-[10px] text-gray-600 hover:text-gray-700 whitespace-nowrap"
                        title="Manage images"
                      >
                        {expandedImageRows.has(lot.id) ? '✕' : '⋯'}
                      </button>
                    </div>
                    {/if}
                  </td>
                  
                      <!-- Title -->
                  <td class="px-2 py-1 {columnVisibility.title ? '' : 'hidden'}">
                        {#if editingCell?.lotId === lot.id && editingCell?.field === 'title'}
                          <input
                            type="text"
                            bind:value={editingCell.value}
                            onblur={() => saveCell(lot.id, 'title', editingCell.value)}
                            onkeydown={(e) => handleKeydown(e, lot.id, 'title', editingCell.value)}
                            class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                            autofocus
                          />
                        {:else}
                          <span
                            ondblclick={() => startEdit(lot.id, 'title', lot.title)}
                            class="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded block text-xs font-medium"
                          >
                            {#if lot.title}
                              {lot.title}
                            {:else}
                              <span class="text-gray-400 italic">Double-click to edit</span>
                            {/if}
                          </span>
                        {/if}
                  </td>
                  
                      <!-- Description -->
                  <td class="px-2 py-1 {columnVisibility.description ? '' : 'hidden'}">
                        {#if editingCell?.lotId === lot.id && editingCell?.field === 'description'}
                          <textarea
                            bind:value={editingCell.value}
                            onblur={() => saveCell(lot.id, 'description', editingCell.value)}
                            onkeydown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
                            class="w-full px-1 py-1 text-xs border-2 border-blue-500 rounded focus:outline-none"
                            rows="2"
                            autofocus
                          ></textarea>
                        {:else}
                          <span
                            ondblclick={() => startEdit(lot.id, 'description', lot.description)}
                            class="cursor-pointer hover:bg-blue-50 px-1 py-1 rounded block text-xs text-gray-500"
                          >
                            {#if lot.description}
                              {lot.description}
                            {:else}
                              <span class="text-gray-400 italic">Double-click to edit</span>
                            {/if}
                          </span>
                        {/if}
                  </td>
                  
                  <!-- Hebrew Title -->
                  <td class="px-2 py-1 {columnVisibility.hebrewTitle ? '' : 'hidden'}">
                    {#if editingCell?.lotId === lot.id && editingCell?.field === 'hebrewTitle'}
                      <input
                        type="text"
                        bind:value={editingCell.value}
                        onblur={() => saveCell(lot.id, 'hebrewTitle', editingCell.value)}
                        onkeydown={(e) => handleKeydown(e, lot.id, 'hebrewTitle', editingCell.value)}
                        class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                        autofocus
                      />
                    {:else}
                      <span
                        ondblclick={() => startEdit(lot.id, 'hebrewTitle', lot.hebrewTitle || lot.HebrewTitle || '')}
                        class="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded block text-xs font-medium"
                        style="direction: rtl; text-align: right;"
                      >
                        {#if lot.hebrewTitle || lot.HebrewTitle}
                          {lot.hebrewTitle || lot.HebrewTitle}
                        {:else}
                          <span class="text-gray-400 italic">Double-click to edit</span>
                        {/if}
                      </span>
                    {/if}
                  </td>
                  
                  <!-- Hebrew Description -->
                  <td class="px-2 py-1 {columnVisibility.hebrewDescription ? '' : 'hidden'}">
                    {#if editingCell?.lotId === lot.id && editingCell?.field === 'hebrewDescription'}
                      <textarea
                        bind:value={editingCell.value}
                        onblur={() => saveCell(lot.id, 'hebrewDescription', editingCell.value)}
                        onkeydown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
                        class="w-full px-1 py-1 text-xs border-2 border-blue-500 rounded focus:outline-none"
                        rows="2"
                        autofocus
                        style="direction: rtl; text-align: right;"
                      ></textarea>
                    {:else}
                      <span
                        ondblclick={() => startEdit(lot.id, 'hebrewDescription', lot.hebrewDescription || lot.HebrewDescription || '')}
                        class="cursor-pointer hover:bg-blue-50 px-1 py-1 rounded block text-xs text-gray-500"
                        style="direction: rtl; text-align: right;"
                      >
                        {#if lot.hebrewDescription || lot.HebrewDescription}
                          {lot.hebrewDescription || lot.HebrewDescription}
                        {:else}
                          <span class="text-gray-400 italic">Double-click to edit</span>
                        {/if}
                      </span>
                    {/if}
                  </td>
                  
                  <!-- Year English -->
                  <td class="px-2 py-1 whitespace-nowrap {columnVisibility.yearEnglish ? '' : 'hidden'}">
                    {#if editingCell?.lotId === lot.id && editingCell?.field === 'yearEnglish'}
                      <input
                        type="text"
                        bind:value={editingCell.value}
                        onblur={() => saveCell(lot.id, 'yearEnglish', editingCell.value)}
                        onkeydown={(e) => handleKeydown(e, lot.id, 'yearEnglish', editingCell.value)}
                        class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                        autofocus
                      />
                    {:else}
                      <span
                        ondblclick={() => {
                          const yearMatch = lot.title?.match(/\b(18|19|20)\d{2}\b/);
                          const year = yearMatch ? yearMatch[0] : '';
                          startEdit(lot.id, 'yearEnglish', year);
                        }}
                        class="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs"
                      >
                        {#if lot.yearEnglish}
                          {lot.yearEnglish}
                        {:else}
                          <span class="text-gray-400 italic">-</span>
                        {/if}
                      </span>
                    {/if}
                  </td>
                  
                  <!-- Year Hebrew -->
                  <td class="px-2 py-1 whitespace-nowrap {columnVisibility.yearHebrew ? '' : 'hidden'}">
                    {#if editingCell?.lotId === lot.id && editingCell?.field === 'yearHebrew'}
                      <input
                        type="text"
                        bind:value={editingCell.value}
                        onblur={() => saveCell(lot.id, 'yearHebrew', editingCell.value)}
                        onkeydown={(e) => handleKeydown(e, lot.id, 'yearHebrew', editingCell.value)}
                        class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                        autofocus
                        style="direction: rtl; text-align: right;"
                      />
                    {:else}
                      <span
                        ondblclick={() => {
                          const yearMatch = lot.title?.match(/\b(18|19|20)\d{2}\b/);
                          const year = yearMatch ? convertToHebrewYear(yearMatch[0]) : '';
                          startEdit(lot.id, 'yearHebrew', year);
                        }}
                        class="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs"
                        style="direction: rtl; text-align: right;"
                      >
                        {#if lot.yearHebrew}
                          {lot.yearHebrew}
                        {:else}
                          <span class="text-gray-400 italic">-</span>
                        {/if}
                      </span>
                    {/if}
                  </td>
                  
                  <!-- Category with Tags below -->
                  <td class="px-2 py-1 {columnVisibility.category ? '' : 'hidden'}">
                    <div class="space-y-1">
                      <!-- Category -->
                      <div>
                        {#if editingCell?.lotId === lot.id && editingCell?.field === 'category'}
                          <div class="relative">
                            <input
                              type="text"
                              value={categoryInputs[lot.id] || lot.category || ''}
                              oninput={(e) => {
                                categoryInputs[lot.id] = e.target.value;
                                editingCell.value = e.target.value;
                                showCategoryDropdown[lot.id] = e.target.value.length > 0;
                              }}
                              onfocus={() => showCategoryDropdown[lot.id] = (categoryInputs[lot.id] || lot.category || '').length > 0}
                              onblur={() => setTimeout(() => showCategoryDropdown[lot.id] = false, 200)}
                              onkeydown={(e) => handleKeydown(e, lot.id, 'category', editingCell.value)}
                              class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                              autofocus
                            />
                            {#if showCategoryDropdown[lot.id] && availableCategories.length > 0}
                              <div class="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                                {#each availableCategories.filter(c => c.toLowerCase().includes((categoryInputs[lot.id] || lot.category || '').toLowerCase())) as cat}
                                  <button
                                    type="button"
                                    onclick={() => {
                                      categoryInputs[lot.id] = cat;
                                      editingCell.value = cat;
                                      showCategoryDropdown[lot.id] = false;
                                    }}
                                    class="w-full text-left px-2 py-1 hover:bg-blue-50 text-xs"
                                  >
                                    {cat}
                                  </button>
                                {/each}
                                {#if categoryInputs[lot.id] && !availableCategories.some(c => c.toLowerCase() === (categoryInputs[lot.id] || '').toLowerCase())}
                                  <button
                                    type="button"
                                    onclick={() => {
                                      editingCell.value = categoryInputs[lot.id];
                                      showCategoryDropdown[lot.id] = false;
                                    }}
                                    class="w-full text-left px-2 py-1 hover:bg-green-50 text-xs text-green-600 font-semibold"
                                  >
                                    + Create "{categoryInputs[lot.id]}"
                                  </button>
                                {/if}
                              </div>
                            {/if}
                          </div>
                        {:else}
                          <span
                            ondblclick={() => {
                              categoryInputs[lot.id] = lot.category || '';
                              startEdit(lot.id, 'category', lot.category || '');
                            }}
                            class="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs"
                          >
                            {#if lot.category}
                              {lot.category}
                            {:else}
                              <span class="text-gray-400 italic">-</span>
                            {/if}
                          </span>
                        {/if}
                      </div>
                      
                      <!-- Tags -->
                      <div>
                        {#if editingCell?.lotId === lot.id && editingCell?.field === 'tags'}
                          <div class="space-y-1">
                            <div class="flex flex-wrap gap-0.5 mb-0.5">
                              {#each (lot._tags || []) as tag, index}
                                <span class="inline-flex items-center px-1 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                  {tag}
                                  <button
                                    type="button"
                                    onclick={() => {
                                      const tags = [...(lot._tags || [])];
                                      tags.splice(index, 1);
                                      lot._tags = tags;
                                      editingCell.value = JSON.stringify(tags);
                                      saveCell(lot.id, 'tags', JSON.stringify(tags));
                                    }}
                                    class="ml-0.5 text-blue-600 hover:text-blue-800 text-xs"
                                  >
                                    ×
                                  </button>
                                </span>
                              {/each}
                            </div>
                            <div class="relative">
                              <input
                                type="text"
                                value={tagInputs[lot.id] || ''}
                                oninput={(e) => {
                                  tagInputs[lot.id] = e.target.value;
                                  showTagDropdown[lot.id] = e.target.value.length > 0;
                                }}
                                onfocus={() => showTagDropdown[lot.id] = (tagInputs[lot.id] || '').length > 0}
                                onblur={() => {
                                  setTimeout(() => {
                                    showTagDropdown[lot.id] = false;
                                    if (editingCell?.lotId === lot.id && editingCell?.field === 'tags') {
                                      saveCell(lot.id, 'tags', editingCell.value);
                                    }
                                  }, 200);
                                }}
                                onkeydown={(e) => {
                                  if (e.key === 'Enter' && tagInputs[lot.id]?.trim()) {
                                    e.preventDefault();
                                    const tags = [...(lot._tags || [])];
                                    if (!tags.includes(tagInputs[lot.id].trim())) {
                                      tags.push(tagInputs[lot.id].trim());
                                    }
                                    lot._tags = tags;
                                    editingCell.value = JSON.stringify(tags);
                                    tagInputs[lot.id] = '';
                                    showTagDropdown[lot.id] = false;
                                    saveCell(lot.id, 'tags', JSON.stringify(tags));
                                  } else if (e.key === 'Escape') {
                                    cancelEdit();
                                  }
                                }}
                                placeholder="Add tag..."
                                class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                                autofocus
                              />
                              {#if showTagDropdown[lot.id] && availableTags.length > 0}
                                <div class="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                                  {#each availableTags.filter(t => t.toLowerCase().includes((tagInputs[lot.id] || '').toLowerCase()) && !(lot._tags || []).includes(t)) as tag}
                                    <button
                                      type="button"
                                      onclick={() => {
                                        const tags = [...(lot._tags || [])];
                                        if (!tags.includes(tag)) {
                                          tags.push(tag);
                                        }
                                        lot._tags = tags;
                                        editingCell.value = JSON.stringify(tags);
                                        tagInputs[lot.id] = '';
                                        showTagDropdown[lot.id] = false;
                                        saveCell(lot.id, 'tags', JSON.stringify(tags));
                                      }}
                                      class="w-full text-left px-2 py-1 hover:bg-blue-50 text-xs"
                                    >
                                      {tag}
                                    </button>
                                  {/each}
                                </div>
                              {/if}
                            </div>
                          </div>
                        {:else}
                          <div
                            ondblclick={() => {
                              tagInputs[lot.id] = '';
                              startEdit(lot.id, 'tags', JSON.stringify(lot._tags || []));
                            }}
                            class="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded min-h-[18px]"
                          >
                            {#if lot._tags && lot._tags.length > 0}
                              <div class="flex flex-wrap gap-0.5">
                                {#each lot._tags.slice(0, 3) as tag}
                                  <span class="inline-flex items-center px-1 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                    {tag}
                                  </span>
                                {/each}
                                {#if lot._tags.length > 3}
                                  <span class="inline-flex items-center px-1 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                    +{lot._tags.length - 3}
                                  </span>
                                {/if}
                              </div>
                            {:else}
                              <span class="text-gray-400 italic text-xs">Double-click to add tags</span>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    </div>
                  </td>
                  
                  <!-- Bids (Start & Current stacked) -->
                  <td class="px-2 py-1 {columnVisibility.bids ? '' : 'hidden'}">
                    <div class="space-y-0.5">
                      <!-- Starting Bid -->
                      <div>
                        {#if editingCell?.lotId === lot.id && editingCell?.field === 'startingBid'}
                          <input
                            type="number"
                            step="0.01"
                            bind:value={editingCell.value}
                            onblur={() => saveCell(lot.id, 'startingBid', editingCell.value)}
                            onkeydown={(e) => handleKeydown(e, lot.id, 'startingBid', editingCell.value)}
                            class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                            autofocus
                          />
                        {:else}
                          <span
                            ondblclick={() => startEdit(lot.id, 'startingBid', lot.startingBid)}
                            class="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs"
                          >
                            Start: ${lot.startingBid?.toFixed(2) || '0.00'}
                          </span>
                        {/if}
                      </div>
                      <!-- Current Bid -->
                      <div>
                        {#if editingCell?.lotId === lot.id && editingCell?.field === 'currentBid'}
                          <input
                            type="number"
                            step="0.01"
                            bind:value={editingCell.value}
                            onblur={() => saveCell(lot.id, 'currentBid', editingCell.value)}
                            onkeydown={(e) => handleKeydown(e, lot.id, 'currentBid', editingCell.value)}
                            class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                            autofocus
                          />
                        {:else}
                          <span
                            ondblclick={() => startEdit(lot.id, 'currentBid', lot.currentBid)}
                            class="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs font-semibold"
                          >
                            Current: ${lot.currentBid?.toFixed(2) || '0.00'}
                          </span>
                        {/if}
                      </div>
                    </div>
                  </td>
                  
                  <!-- Bid Increment (hidden unless editing pricing) -->
                  <td class="px-2 py-1 whitespace-nowrap {columnVisibility.increment && editingCell?.lotId === lot.id && (editingCell?.field === 'startingBid' || editingCell?.field === 'currentBid' || editingCell?.field === 'bidIncrement') ? '' : 'hidden'}">
                    {#if editingCell?.lotId === lot.id && editingCell?.field === 'bidIncrement'}
                      <input
                        type="number"
                        step="0.01"
                        bind:value={editingCell.value}
                        onblur={() => saveCell(lot.id, 'bidIncrement', editingCell.value)}
                        onkeydown={(e) => handleKeydown(e, lot.id, 'bidIncrement', editingCell.value)}
                        class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                        autofocus
                      />
                    {:else}
                      <span
                        ondblclick={() => startEdit(lot.id, 'bidIncrement', lot.bidIncrement)}
                        class="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs"
                      >
                        ${lot.bidIncrement?.toFixed(2) || '0.00'}
                      </span>
                    {/if}
                  </td>
                  
                  <!-- Status -->
                  <td class="px-2 py-1 whitespace-nowrap {columnVisibility.status ? '' : 'hidden'}">
                    {#if editingCell?.lotId === lot.id && editingCell?.field === 'status'}
                      <select
                        bind:value={editingCell.value}
                        onblur={() => saveCell(lot.id, 'status', editingCell.value)}
                        onkeydown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
                        class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                        autofocus
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="SOLD">Sold</option>
                        <option value="UNSOLD">Unsold</option>
                        <option value="WITHDRAWN">Withdrawn</option>
                      </select>
                    {:else}
                      <span
                        ondblclick={() => startEdit(lot.id, 'status', lot.status)}
                        class="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded text-xs font-semibold {lot.status === 'ACTIVE' ? 'text-green-600' : lot.status === 'SOLD' ? 'text-blue-600' : 'text-gray-600'}"
                      >
                        {lot.status}
                      </span>
                    {/if}
                  </td>
                  
                  <!-- Watchers -->
                  <td class="px-2 py-1 whitespace-nowrap text-center {columnVisibility.watchers ? '' : 'hidden'}">
                    <span class="px-1 py-0.5 rounded text-xs font-medium text-gray-700">
                      {lot.watchersCount || 0}
                    </span>
                  </td>
                  
                  <!-- Ready Status -->
                  <td class="px-2 py-1 whitespace-nowrap {columnVisibility.ready ? '' : 'hidden'}">
                    {#if editingCell?.lotId === lot.id && editingCell?.field === 'isReady'}
                      <select
                        bind:value={editingCell.value}
                        onblur={() => saveCell(lot.id, 'isReady', editingCell.value === 'true')}
                        onkeydown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
                        class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                        autofocus
                      >
                        <option value="false">Not Ready</option>
                        <option value="true">Ready</option>
                      </select>
                    {:else}
                      <span
                        ondblclick={() => startEdit(lot.id, 'isReady', lot.isReady ? 'true' : 'false')}
                        class="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded text-xs font-semibold flex items-center justify-center {lot.isReady ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-50'}"
                        title={lot.isReady ? 'Approved and ready to go' : 'Not yet approved'}
                      >
                        {#if lot.isReady}
                          <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                          </svg>
                          Ready
                        {:else}
                          <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                          </svg>
                          Not Ready
                        {/if}
                      </span>
                    {/if}
                  </td>
                  
                  <!-- End Time -->
                  <td class="px-2 py-1 whitespace-nowrap {columnVisibility.endTime ? '' : 'hidden'}">
                    {#if editingCell?.lotId === lot.id && editingCell?.field === 'endTime'}
                      <input
                        type="datetime-local"
                        bind:value={editingCell.value}
                        onblur={() => saveCell(lot.id, 'endTime', editingCell.value)}
                        onkeydown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
                        class="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                        autofocus
                      />
                    {:else}
                      <span
                        ondblclick={() => {
                          const endTime = lot.endTime ? new Date(lot.endTime).toISOString().slice(0, 16) : '';
                          startEdit(lot.id, 'endTime', endTime);
                        }}
                        class="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs"
                      >
                        {#if lot.endTime}
                          {new Date(lot.endTime).toLocaleString()}
                        {:else}
                          <span class="text-gray-400 italic">-</span>
                        {/if}
                      </span>
                    {/if}
                  </td>
                  
                  <!-- Actions -->
                  <td class="px-2 py-1 {columnVisibility.actions ? '' : 'hidden'}">
                    <div class="flex items-center gap-1">
                      <QuickVoiceRecorder
                        lotId={lot.id}
                        onNoteSaved={async (result) => {
                          await loadData();
                        }}
                        onRecordingComplete={() => {
                          // Optionally open notes panel after recording
                          if (!expandedNotesRows.has(lot.id)) {
                            toggleNotesRow(lot.id);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onclick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          cleanupLot(lot.id);
                        }}
                        disabled={cleaningUp[lot.id]}
                        class="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="AI Cleanup - Clean and organize all fields"
                        aria-label="AI Cleanup"
                      >
                        {#if cleaningUp[lot.id]}
                          <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        {:else}
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        {/if}
                      </button>
                      <button
                        type="button"
                        onclick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleAIRow(lot.id);
                        }}
                        class="p-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
                        title="AI Tools"
                        aria-label="AI Tools"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onclick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleBannerRow(lot.id);
                        }}
                        class="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                        title="Create Banner Image"
                        aria-label="Create Banner Image"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onclick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          showConsignmentPDF = { lotId: lot.id };
                        }}
                        class="p-1.5 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors"
                        title="Print Consignment Agreement"
                        aria-label="Print Consignment Agreement"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                
                <!-- Expandable Notes Row -->
                {#if expandedNotesRows.has(lot.id)}
                  <tr class="bg-blue-50">
                    <td colspan="12" class="px-4 py-4">
                      <div class="bg-white rounded-lg border border-blue-200 p-4">
                        <div class="flex items-center justify-between mb-4">
                          <h3 class="text-lg font-semibold text-gray-900">Voice Notes - Lot #{lot.lotNumber}</h3>
                          <button
                            onclick={() => toggleNotesRow(lot.id)}
                            class="text-gray-500 hover:text-gray-700 text-sm"
                          >
                            Collapse
                          </button>
                        </div>
                        
                        <LotNotesManager
                          lotId={lot.id}
                          notes={[]}
                          onRefresh={async () => {
                            await loadData();
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                {/if}
                
                <!-- Expandable AI Tools Row -->
                {#if expandedAIRows.has(lot.id)}
                  <tr class="bg-purple-50">
                    <td colspan="12" class="px-4 py-4">
                      <div class="bg-white rounded-lg border border-purple-200 p-4">
                        <div class="flex items-center justify-between mb-4">
                          <h3 class="text-lg font-semibold text-gray-900">AI Tools - Lot #{lot.lotNumber}</h3>
                          <button
                            onclick={() => toggleAIRow(lot.id)}
                            class="text-gray-500 hover:text-gray-700 text-sm"
                          >
                            Collapse
                          </button>
                        </div>
                        
                        <AIGenerator
                          lotId={lot.id}
                          lot={{
                            title: lot.title,
                            description: lot.description,
                            images: lot.images || [],
                            notes: lot.notes || []
                          }}
                          onGenerated={(updates) => handleAIGenerated(lot.id, updates)}
                        />
                      </div>
                    </td>
                  </tr>
                {/if}
                
                <!-- Expandable Banner Generator Row -->
                {#if expandedBannerRows.has(lot.id)}
                  <tr class="bg-green-50">
                    <td colspan="12" class="px-4 py-4">
                      <div class="bg-white rounded-lg border border-green-200 p-4">
                        <div class="flex items-center justify-between mb-4">
                          <h3 class="text-lg font-semibold text-gray-900">Banner Generator - Lot #{lot.lotNumber}</h3>
                          <button
                            onclick={() => toggleBannerRow(lot.id)}
                            class="text-gray-500 hover:text-gray-700 text-sm"
                          >
                            Collapse
                          </button>
                        </div>
                        
                        <BannerGenerator
                          lots={lots}
                          auction={auction}
                          auctionHouse={auction?.auctionHouse}
                          type="lot"
                          initialLotId={lot.id}
                          onSave={async () => {
                            // Reload data after banner is saved
                            await loadData();
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                {/if}
                
                <!-- Expandable Image Management Row -->
                {#if expandedImageRows.has(lot.id)}
                  <tr class="bg-gray-50">
                    <td colspan="12" class="px-4 py-4">
                      <div class="bg-white rounded-lg border border-gray-200 p-4">
                        <div class="flex items-center justify-between mb-4">
                          <h3 class="text-lg font-semibold text-gray-900">Image Management - Lot #{lot.lotNumber}</h3>
                          <div class="flex items-center gap-3">
                            {#if (lot.images || []).length > 0}
                              <button
                                onclick={() => removeBackgroundFromAllImages(lot.id)}
                                disabled={removingBackgroundFromAll[lot.id]}
                                class="px-3 py-1.5 text-sm font-medium bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Remove background from all images in this lot"
                              >
                                {removingBackgroundFromAll[lot.id] ? '⏳ Processing All...' : '🎨 Remove BG from All'}
                              </button>
                              <button
                                onclick={() => deleteAllImages(lot.id)}
                                class="px-3 py-1.5 text-sm font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                title="Delete all images for this lot"
                              >
                                🗑️ Delete All Images
                              </button>
                            {/if}
                            <button
                              onclick={() => toggleImageRow(lot.id)}
                              class="text-gray-500 hover:text-gray-700 text-sm"
                            >
                              Collapse
                            </button>
                          </div>
                        </div>
                        
                        <!-- Current Images Grid -->
                        {#if (lot.images || []).length > 0}
                          {@const sortedImages = [...(lot.images || [])].sort((a, b) => {
                            // Sort by: primary first, then by displayOrder
                            if (a.isPrimary && !b.isPrimary) return -1;
                            if (!a.isPrimary && b.isPrimary) return 1;
                            return (a.displayOrder || 0) - (b.displayOrder || 0);
                          })}
                          {@const visibleImages = sortedImages.filter(img => !img.isHidden)}
                          {@const hiddenImages = sortedImages.filter(img => img.isHidden)}
                          
                          <!-- Visible Images -->
                          {#if visibleImages.length > 0}
                            <div class="mb-4">
                              <h4 class="text-sm font-medium text-gray-700 mb-2">Visible Images</h4>
                              <div class="flex flex-wrap gap-2">
                                {#each visibleImages as imageObj, index}
                              <div
                                class="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:border-blue-400 transition-all flex-shrink-0"
                                draggable="true"
                                role="listitem"
                                ondragstart={(e) => {
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('text/plain', imageObj.id);
                                  e.currentTarget.classList.add('opacity-50');
                                }}
                                ondragend={(e) => {
                                  e.currentTarget.classList.remove('opacity-50');
                                }}
                                ondragover={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                }}
                                ondrop={(e) => {
                                  e.preventDefault();
                                  const draggedImageId = e.dataTransfer.getData('text/plain');
                                  const targetImageId = imageObj.id;
                                  
                                  if (draggedImageId !== targetImageId) {
                                    reorderImages(lot.id, draggedImageId, targetImageId);
                                  }
                                }}
                              >
                                <!-- Drag Handle -->
                                <div class="cursor-move text-gray-400 hover:text-gray-600" title="Drag to reorder">
                                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                                  </svg>
                                </div>
                                
                                <!-- Up/Down Buttons -->
                                <div class="flex flex-col gap-0.5">
                                  <button
                                    type="button"
                                    onclick={() => moveImageUp(lot.id, imageObj.id)}
                                    disabled={index === 0}
                                    class="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move up"
                                    aria-label="Move image up"
                                  >
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onclick={() => moveImageDown(lot.id, imageObj.id)}
                                    disabled={index === (lot.images || []).length - 1}
                                    class="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move down"
                                    aria-label="Move image down"
                                  >
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                  </button>
                                </div>
                                
                                <!-- Image Thumbnail -->
                                <div
                                  class="relative"
                                  role="button"
                                  tabindex="0"
                                  onmouseenter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    hoveredImage = {
                                      url: imageObj.url,
                                      x: rect.right + 10,
                                      y: rect.top
                                    };
                                  }}
                                  onmouseleave={() => {
                                    hoveredImage = null;
                                  }}
                                >
                                  <img
                                    src={imageObj.url} 
                                    alt="Image {index + 1}" 
                                    class="w-16 h-16 object-cover rounded border border-gray-300 cursor-pointer"
                                  />
                                </div>
                                
                                <!-- Position Number -->
                                <span class="text-sm font-medium text-gray-700 w-8">#{index + 1}</span>
                                
                                <!-- Edit Button -->
                                <button
                                  type="button"
                                  onclick={() => {
                                    editingImage = {
                                      lotId: lot.id,
                                      imageId: imageObj.id,
                                      imageUrl: imageObj.url
                                    };
                                  }}
                                  class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                                  title="Edit image"
                                >
                                  ✎ Edit
                                </button>
                                
                                <!-- Remove Background Button -->
                                <button
                                  type="button"
                                  onclick={() => removeBackgroundFromImage(lot.id, imageObj.id, imageObj.url)}
                                  disabled={removingBackground[imageObj.id]}
                                  class="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Remove background and save as new image"
                                >
                                  {removingBackground[imageObj.id] ? '⏳ Processing...' : '🎨 Remove BG'}
                                </button>
                                
                                <!-- Featured/Default Toggle -->
                                <button
                                  type="button"
                                  onclick={() => setFeaturedImage(lot.id, imageObj.id)}
                                  class="px-3 py-1 text-xs rounded transition-colors {imageObj.isPrimary ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
                                  title={imageObj.isPrimary ? 'Featured Image (click to unset)' : 'Set as Featured Image'}
                                >
                                  {imageObj.isPrimary ? '⭐ Featured' : 'Set Featured'}
                                </button>
                                
                                <!-- Hide/Show Toggle -->
                                <button
                                  type="button"
                                  onclick={() => toggleImageHidden(lot.id, imageObj.id, imageObj.isHidden || false)}
                                  class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                  title="Hide image"
                                >
                                  🙈 Hide
                                </button>
                                
                                <!-- Remove Button -->
                                <button
                                  type="button"
                                  onclick={() => removeImage(lot.id, imageObj.id)}
                                  class="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                                  title="Remove image"
                                >
                                  ✕
                                </button>
                              </div>
                            {/each}
                          </div>
                            </div>
                          {/if}
                          
                          <!-- Hidden Images -->
                          {#if hiddenImages.length > 0}
                            <div class="mb-4">
                              <h4 class="text-sm font-medium text-gray-500 mb-2">Hidden Images</h4>
                              <div class="flex flex-wrap gap-2">
                                {#each hiddenImages as imageObj, index}
                                  <div
                                    class="flex items-center gap-2 p-2 bg-gray-100 rounded border border-gray-300 hover:border-gray-400 transition-all flex-shrink-0 opacity-60"
                                  >
                                    <!-- Image Thumbnail -->
                                    <div class="relative">
                                      <img
                                        src={imageObj.url} 
                                        alt="Hidden image {index + 1}" 
                                        class="w-16 h-16 object-cover rounded border border-gray-300"
                                      />
                                    </div>
                                    
                                    <!-- Hide/Show Toggle -->
                                    <button
                                      type="button"
                                      onclick={() => toggleImageHidden(lot.id, imageObj.id, imageObj.isHidden || false)}
                                      class="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                                      title="Show image"
                                    >
                                      👁️ Show
                                    </button>
                                    
                                    <!-- Remove Button -->
                                    <button
                                      type="button"
                                      onclick={() => removeImage(lot.id, imageObj.id)}
                                      class="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                                      title="Remove image"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}
                        {:else}
                          <div class="text-center py-8 text-gray-400">
                            <p>No images uploaded yet</p>
                          </div>
                        {/if}
                        
                        <!-- Upload New Images -->
                        <div class="border-t border-gray-200 pt-4">
                          <div class="mb-2">
                            <label class="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={removeBackground[lot.id] || false}
                                onchange={(e) => {
                                  removeBackground[lot.id] = e.target.checked;
                                  removeBackground = { ...removeBackground };
                                }}
                                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span class="text-sm text-gray-700">Remove background</span>
                            </label>
                            <p class="text-xs text-gray-500 ml-6">Uses AI to remove background from images</p>
                          </div>
                          <label class="block mb-2">
                            <span class="text-sm font-medium text-gray-700">Add Images</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onchange={(e) => handleImageUpload(lot.id, e)}
                              class="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                          </label>
                          <p class="text-xs text-gray-500 mt-1">Select multiple images to upload</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
        {/if}
      </div>

      <!-- Image Management Modal -->
      {#if showImageModal}
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 print:hidden">
          <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-6">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-2xl font-bold text-gray-900">Manage Images - Lot {lots.find(l => l.id === showImageModal.lotId)?.lotNumber}</h2>
                <button
                  onclick={() => showImageModal = null}
                  class="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div class="grid grid-cols-4 gap-4 mb-4">
                {#each showImageModal.images as image, index}
                  {@const lot = lots.find(l => l.id === showImageModal.lotId)}
                  {@const imageObj = lot?.images?.[index] || (typeof image === 'string' ? { url: image } : image)}
                  {@const imageId = imageObj.id || (imageObj.url ? null : imageObj)}
                  {@const imageUrl = imageObj.url || image}
                  <div class="relative border border-gray-300 rounded p-2 bg-white">
                    <div
                      class="relative"
                      role="button"
                      tabindex="0"
                      onmouseenter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        hoveredImage = {
                          url: imageUrl,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 10
                        };
                      }}
                      onmouseleave={() => {
                        hoveredImage = null;
                      }}
                    >
                      <img src={imageUrl} alt="Image {index + 1}" class="w-full h-32 object-cover rounded mb-2 cursor-pointer" />
                    </div>
                    {#if imageId}
                      <div class="flex flex-col gap-2">
                        <button
                          onclick={() => removeBackgroundFromImage(showImageModal.lotId, imageId, imageUrl)}
                          disabled={removingBackground[imageId]}
                          class="w-full px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Remove background and save as new image"
                        >
                          {removingBackground[imageId] ? '⏳ Processing...' : '🎨 Remove Background'}
                        </button>
                        <button
                          onclick={() => removeImage(showImageModal.lotId, imageId)}
                          class="w-full px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          title="Delete image"
                        >
                          ✕ Delete
                        </button>
                      </div>
                    {/if}
                    {#if removingBackground[imageId]}
                      <div class="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center">
                        <div class="text-white text-sm font-semibold">Processing...</div>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
              
              <label class="block">
                <span class="text-sm font-medium text-gray-700">Add Images</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onchange={(e) => {
                    handleImageUpload(showImageModal.lotId, e);
                    showImageModal = null;
                  }}
                  class="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </label>
            </div>
          </div>
        </div>
      {/if}

      <!-- Image Hover Preview -->
      {#if hoveredImage}
        <div
          class="fixed z-[100] pointer-events-none print:hidden"
          style="left: {hoveredImage.x}px; top: {hoveredImage.y}px; transform: translate(-50%, -100%); margin-top: -10px;"
        >
          <div class="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-2 max-w-md">
            <img
              src={hoveredImage.url}
              alt="Preview"
              class="max-w-sm max-h-96 object-contain rounded"
              style="max-width: 400px; max-height: 400px;"
            />
          </div>
        </div>
      {/if}

      <!-- Consignment PDF Modal -->
      {#if showConsignmentPDF}
        {@const selectedLot = lots.find(l => l.id === showConsignmentPDF.lotId)}
        {#if selectedLot}
          <ConsignmentPDF
            lot={selectedLot}
            {auction}
            auctionHouse={auction?.auctionHouse || null}
            onClose={() => showConsignmentPDF = null}
          />
        {/if}
      {/if}

      <!-- Import Lots Modal -->
      {#if showImportModal}
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:hidden">
          <div class="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-semibold text-gray-900">Import Lots (CSV / Excel)</h3>
                <p class="text-gray-600 text-sm">
                  Upload a BidSpirit export or any spreadsheet, then map columns to fields.
                </p>
              </div>
              <button
                class="text-gray-500 hover:text-gray-700"
                aria-label="Close import modal"
                onclick={() => {
                  showImportModal = false;
                }}
              >
                ✕
              </button>
            </div>

            {#if importError}
              <div class="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {importError}
              </div>
            {/if}

            <div class="space-y-3">
              <div class="border border-gray-200 rounded-lg p-4 space-y-3">
                <label class="block text-sm font-medium text-gray-700">Upload file</label>
                <input
                  type="file"
                  accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onchange={handleImportFileChange}
                  class="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {#if importFile}
                  <div class="text-xs text-gray-600">Selected: {importFile.name}</div>
                {/if}
              </div>

              {#if importPreview}
                <div class="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="font-semibold text-gray-900">Map columns</div>
                      <p class="text-sm text-gray-600">
                        Required: Lot Number, Title. Others are optional.
                      </p>
                    </div>
                    <button
                      class="text-sm text-blue-600 hover:underline"
                      onclick={() => (columnMapping = guessMapping(importPreview.columns || []))}
                    >
                      Auto-map again
                    </button>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {#each importFields as field}
                      <div class="space-y-1">
                        <label class="text-xs font-medium text-gray-700 flex items-center gap-1">
                          {field.label}
                          {#if field.required}
                            <span class="text-red-500">*</span>
                          {/if}
                        </label>
                        <select
                          class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={columnMapping[field.key] || '__skip__'}
                          onchange={(e) => {
                            columnMapping = { ...columnMapping, [field.key]: e.target.value };
                          }}
                        >
                          <option value="__skip__">Skip</option>
                          {#each importPreview.columns || [] as column}
                            <option value={column}>{column}</option>
                          {/each}
                        </select>
                      </div>
                    {/each}
                  </div>

                  {#if importPreview.sampleRows?.length}
                    <div class="space-y-2">
                      <div class="text-xs font-semibold text-gray-700">Preview (first rows)</div>
                      <div class="overflow-auto border border-gray-200 rounded">
                        <table class="min-w-full divide-y divide-gray-200 text-xs">
                          <thead class="bg-gray-50">
                            <tr>
                              {#each importPreview.columns || [] as col}
                                <th class="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                                  {col}
                                </th>
                              {/each}
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-100">
                            {#each importPreview.sampleRows.slice(0, 5) as row}
                              <tr class="bg-white">
                                {#each importPreview.columns || [] as col}
                                  <td class="px-2 py-1 text-gray-700 whitespace-nowrap">
                                    {row[col]}
                                  </td>
                                {/each}
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}

              {#if importResult}
                <div class="border border-green-200 bg-green-50 rounded-lg p-4 space-y-2 text-sm text-green-900">
                  <div class="font-semibold">Import complete</div>
                  <div>Created: {importResult.created || 0}</div>
                  <div>Updated: {importResult.updated || 0}</div>
                  {#if importResult.errors?.length}
                    <div class="text-red-700">
                      Errors ({importResult.errors.length}): {importResult.errors.slice(0, 5).map(e => `Row ${e.row}: ${e.message}`).join('; ')}
                      {#if importResult.errors.length > 5}
                        ...and {importResult.errors.length - 5} more
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            <div class="flex items-center justify-between">
              <div class="text-xs text-gray-500">
                Tip: Use BidSpirit export as a template — columns will auto-map.
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  onclick={() => {
                    resetImportState();
                    showImportModal = false;
                  }}
                >
                  Cancel
                </button>
                <button
                  class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={importing || !importPreview || !mappingIsValid()}
                  onclick={runImport}
                >
                  {importing ? 'Importing...' : 'Import Lots'}
                </button>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Image Editor Modal -->
      {#if editingImage}
        <ImageEditor
          imageUrl={editingImage.imageUrl}
          imageId={editingImage.imageId}
          lotId={editingImage.lotId}
          onSave={async (result) => {
            editingImage = null;
            await loadData();
          }}
          onCancel={() => {
            editingImage = null;
          }}
        />
      {/if}
    {/if}

    <!-- Banner Template Selector Modal -->
    {#if showBannerTemplateSelector}
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-2xl font-bold text-gray-900">Select Template for Banner Generation</h2>
              <button
                onclick={() => showBannerTemplateSelector = false}
                class="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <p class="text-sm text-gray-600 mb-4">
              Generate banners for {selectedLots.size} selected lot(s) using a template. Each lot will use its featured image.
            </p>

            <div class="grid grid-cols-2 gap-4">
              <!-- No Template / Default Option -->
              <button
                onclick={() => generateBannersForSelectedLots(null)}
                class="p-4 border-2 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left border-gray-200"
              >
                <h3 class="font-semibold text-gray-900 mb-1">Default Settings</h3>
                <p class="text-xs text-gray-500">
                  Use default banner settings (image on right, text on left)
                </p>
              </button>

              <!-- Saved Templates -->
              {#each savedBannerTemplates as template}
                <button
                  onclick={() => generateBannersForSelectedLots(template)}
                  class="p-4 border-2 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left {selectedBannerTemplate?.id === template.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}"
                >
                  <h3 class="font-semibold text-gray-900 mb-1">{template.name}</h3>
                  {#if template.createdAt}
                    <p class="text-xs text-gray-500">
                      Created: {new Date(template.createdAt).toLocaleDateString()}
                    </p>
                  {/if}
                </button>
              {/each}
            </div>
            
            {#if savedBannerTemplates.length === 0}
              <div class="mt-4 text-center text-sm text-gray-500">
                <p>No saved templates. Create templates in the Banner Generator to use them here.</p>
              </div>
            {/if}

            <div class="mt-6 flex justify-end gap-3">
              <button
                onclick={() => showBannerTemplateSelector = false}
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
</div>
