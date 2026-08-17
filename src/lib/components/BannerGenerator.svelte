<script>
  import ImageSelection from './banner/ImageSelection.svelte';
  import ImageSettings from './banner/ImageSettings.svelte';
  import LayoutSettings from './banner/LayoutSettings.svelte';
  import BackgroundSettings from './banner/BackgroundSettings.svelte';
  import TextContentSettings from './banner/TextContentSettings.svelte';
  import TextElementSettings from './banner/TextElementSettings.svelte';
  import TypographySettings from './banner/TypographySettings.svelte';
  import ImageShadowSettings from './banner/ImageShadowSettings.svelte';
  import BannerPreview from './banner/BannerPreview.svelte';
  import BannerActions from './banner/BannerActions.svelte';
  import CollapsibleSection from './banner/CollapsibleSection.svelte';
  
  // Props
  let {
    lots = [],
    auction = null,
    auctionHouse = null,
    type = 'lot', // 'lot', 'auction', 'auctionHouse'
    onSave = null // Callback when banner is saved
  } = $props();

  console.log('auctionHouse', auctionHouse);
  console.log('lots', lots);

  // Banner tool state
  let selectedBannerLotId = $state('');
  let selectedLotImages = $state([]);
  let selectedBannerImages = $state([]);
  let setAsPrimaryImage = $state(false); // Checkbox to set banner as primary image
  let savingToLot = $state(false); // Track if saving banner to lot
  let bannerSettings = $state({
    // Flexible Text Elements System
    useFlexibleTextElements: false, // Toggle between old and new system
    textElements: [
      {
        id: 'text1',
        label: 'Text Element 1',
        content: '',
        mappedField: 'title', // Maps to lot.title, lot.hebrewTitle, etc.
        enabled: true,
        order: 1,
        // Styling
        fontSize: 66,
        fontFamily: 'Cormorant Garamond, Times New Roman, serif',
        language: 'english', // 'english' or 'hebrew' - determines which font family to use
        fontWeight: 'bold', // 'normal', 'bold', '300', '400', '500', '600', '700'
        color: '#2C1810',
        align: 'center', // 'left', 'center', 'right'
        // Spacing
        marginTop: 0,
        marginBottom: 20,
        marginLeft: 0,
        marginRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        lineHeight: 1.2,
        // Position (optional - if not set, uses order)
        positionY: null, // null = auto position by order, or specific Y position
      },
      {
        id: 'text2',
        label: 'Text Element 2',
        content: '',
        mappedField: 'titleHebrew',
        enabled: true,
        order: 2,
        fontSize: 66,
        fontFamily: 'Frank Ruhl Libre, Cardo, serif',
        language: 'hebrew',
        fontWeight: 'bold',
        color: '#2C1810',
        align: 'center',
        marginTop: 0,
        marginBottom: 20,
        marginLeft: 0,
        marginRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        lineHeight: 1.2,
        positionY: null,
      },
      {
        id: 'text3',
        label: 'Text Element 3',
        content: '',
        mappedField: 'subtitle',
        enabled: true,
        order: 3,
        fontSize: 56,
        fontFamily: 'Cormorant Garamond, Times New Roman, serif',
        language: 'english',
        fontWeight: 'normal',
        color: '#2C1810',
        align: 'center',
        marginTop: 0,
        marginBottom: 10,
        marginLeft: 0,
        marginRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        lineHeight: 1.2,
        positionY: null,
      },
      {
        id: 'text4',
        label: 'Text Element 4',
        content: '',
        mappedField: 'subtitleHebrew',
        enabled: true,
        order: 4,
        fontSize: 56,
        fontFamily: 'Frank Ruhl Libre, Cardo, serif',
        language: 'hebrew',
        fontWeight: 'normal',
        color: '#2C1810',
        align: 'center',
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        lineHeight: 1.2,
        positionY: null,
      },
    ],
    
    // Legacy Content (for backward compatibility)
    title: '',
    titleHebrew: '',
    subtitle: '',
    subtitleHebrew: '',
    yearEnglish: '',
    yearHebrew: '',
    category: '',
    categoryHebrew: '',
    
    // Images
    primaryImageUrl: '',
    backgroundImageUrl: '',
    
    // Layout
    // width: 1200,
    // height: 630,
    // bidspirit 1559 x 945
    width: 1559,
    height: 945,
    imageLayout: 'collage', // 'right', 'left', 'center', 'full', 'collage', 'split'
    imagePosition: 'cover', // 'cover', 'contain', 'repeat'
    imageOpacity: 1.0,
    imageRotation: 0, // Rotation angle in degrees
    imageFlipHorizontal: false, // Flip horizontally
    imageFlipVertical: false, // Flip vertically
    
    // Image size/zoom settings (applies to all layouts)
    imageSize: 1.0, // Size multiplier for images (0.1 to 2.0)
    
    // Collage-specific settings
    collageLayout: 'custom', // Use custom positions by default
    collageImagePositions: [], // Custom positions for each image [{x: 0-100%, y: 0-100%, rotation: 0-360}]
    collageImageSide: 'right', // 'left' or 'right' - which side the collage images are on
    collageSplitStyle: 'vertical', // 'vertical', 'diagonal-forward', 'diagonal-backward' - split style between text and image
    
    // Background
    backgroundType: 'solid', // 'solid', 'gradient', 'image', 'pattern'
    backgroundColor: '#F5F1E8',
    backgroundGradient: {
      type: 'linear', // 'linear', 'radial'
      direction: 'to right', // 'to right', 'to bottom', 'to bottom right', etc.
      colors: ['#F5F1E8', '#E8E0D0'],
      stops: [0, 100]
    },
    backgroundPattern: 'none', // 'none', 'dots', 'lines', 'grid', 'diagonal', 'waves', 'circles', 'hexagons', 'crosshatch', 'herringbone', 'stars', 'noise'
    
    // Text
    fontSize: 42,
    fontFamily: 'Cormorant Garamond, Times New Roman, serif',
    hebrewFontFamily: 'Frank Ruhl Libre, Cardo, serif',
    textColor: '#2C1810',
    textAlign: 'center', // 'left', 'center', 'right'
    textPosition: 'left', // 'left', 'center', 'right' (for text area)
    textBackground: 'rgba(245, 241, 232, 0.95)',
    textBackgroundOpacity: 0.95,
    
    // Per-field text settings
    titleEnglishFontSize: 66,
    titleEnglishAlign: 'center',
    titleHebrewFontSize: 66,
    titleHebrewAlign: 'center',
    subtitleEnglishFontSize: 56,
    subtitleEnglishAlign: 'center',
    subtitleHebrewFontSize: 56,
    subtitleHebrewAlign: 'center',
    yearEnglishFontSize: 66,
    yearEnglishAlign: 'center',
    yearHebrewFontSize: 66,
    yearHebrewAlign: 'center',
    
    // Ribbon
    ribbonColor: '#DC2626', // Default red color for ribbon
    ribbonPosition: 'right', // 'left' or 'right' - position of ribbon on banner
    
    // Bottom Border
    showBottomBorder: false, // Show bottom border with auction info
    bottomBorderColor: '#2563EB', // Default blue color
    bottomBorderPosition: 'bottom', // 'top', 'bottom', 'left', or 'right' - position of border
    bottomBorderHeight: 70, // Height of the border in pixels
    bottomBorderTextAlign: 'left', // 'left', 'center', 'right' - text alignment in border
    
    // Image Shadows
    imageShadowEnabled: false, // Enable shadows on images
    imageShadowColor: 'rgba(0, 0, 0, 0.3)', // Shadow color
    imageShadowBlur: 10, // Shadow blur radius
    imageShadowOffsetX: 8, // Shadow horizontal offset
    imageShadowOffsetY: 8, // Shadow vertical offset
    
    // Spacing
    padding: 30,
    textImageRatio: 0.4, // 0.4 = 40% text, 60% image
    
    // Logo settings
    showLogo: false,
    useCustomLogo: false, // If false, use auction house logo; if true, use custom URL
    logoUrl: '', // Custom logo URL (only used if useCustomLogo is true)
    logoPosition: 'top-right', // 'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'
    logoSize: 100, // Logo size in pixels (width, height will maintain aspect ratio)
    logoOpacity: 1.0, // Logo opacity (0.0 to 1.0)
    logoMargin: 20, // Margin from edges in pixels
    
    // Watermark settings
    showWatermark: false, // Enable background watermark
    watermarkUseLogo: true, // If true, use logo as watermark; if false, use custom URL
    watermarkUrl: '', // Custom watermark URL (only used if watermarkUseLogo is false)
    watermarkSize: 300, // Watermark size in pixels
    watermarkOpacity: 0.1, // Watermark opacity (0.0 to 1.0)
    watermarkPosition: 'center', // 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'tile'
    watermarkRotation: 0, // Rotation in degrees
    
    // Separator line settings
    separatorStyle: 'line', // 'line', 'diamond', 'circle', 'square', 'dotted', 'double'
    separatorAlignment: 'center', // 'left', 'center', 'right'
    separatorWidth: 60, // Width of separator in percentage of text area
    separatorThickness: 2, // Thickness of line separator
    separatorColor: '', // If empty, uses textColor
    separatorMarginTop: 15, // Margin above separator in pixels
    separatorMarginBottom: 15, // Margin below separator in pixels
    
    // Text separator settings
    textSeparatorEnabled: false, // Enable text separator
    textSeparatorStyle: 'line', // 'line', 'diamond', 'circle', 'square', 'dotted', 'double' - uses same styles as main separator
    textSeparatorPosition: 'below-english', // 'below-english' or 'below-hebrew'
    textSeparatorWidth: 60, // Width of separator in percentage of text area
    textSeparatorThickness: 2, // Thickness of line separator
    textSeparatorAlign: 'center', // 'left', 'center', 'right'
    textSeparatorColor: '', // If empty, uses textColor
    textSeparatorMarginTop: 10, // Margin above text separator in pixels
    textSeparatorMarginBottom: 15, // Margin below text separator in pixels
    
    // Overlay stamp settings
    showOverlayStamp: false,
    overlayStampUrl: '', // URL or library image
    overlayStampPosition: 'center', // 'top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right', 'custom'
    overlayStampX: 50, // Custom X position in percentage (0-100)
    overlayStampY: 50, // Custom Y position in percentage (0-100)
    overlayStampSize: 200, // Size in pixels
    overlayStampRotation: 0, // Rotation in degrees
    overlayStampOpacity: 0.5, // Opacity (0.0 to 1.0)
    overlayStampAlignment: 'center', // 'top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right'
  });
  
  let generatedBannerUrl = $state(null);
  let generatingBanner = $state(false);

  let presetPreviews = $state({}); // Store preview URLs for each preset
  let generatingPreviews = $state(false);
  let generatingPresetIds = $state(new Set()); // Track which presets are currently generating
  
  // Template management
  let showTemplateSelector = $state(true);
  let showSaveTemplateDialog = $state(false);
  let templateName = $state('');
  let savedTemplates = $state([]);
  let selectedTemplateId = $state(null);
  
  // Collapsible sections state
  let collapsedSections = $state({
    lotSelection: true,
    imageSelection: true,
    imageSettings: true,
    layout: true,
    background: true,
    textContent: true,
    typography: true,
    separator: true,
    overlayStamp: true,
    imageShadows: true,
    logo: true,
    watermark: true
  });
  
  let overlayStampSource = $state('url'); // 'url' or 'library'

  // Available fonts
  const fonts = [
    { name: 'Cormorant Garamond (Serif)', value: 'Cormorant Garamond, Times New Roman, serif' },
    { name: 'Playfair Display (Serif)', value: 'Playfair Display, serif' },
    { name: 'Lora (Serif)', value: 'Lora, serif' },
    { name: 'Merriweather (Serif)', value: 'Merriweather, serif' },
    { name: 'Georgia (Serif)', value: 'Georgia, serif' },
    { name: 'Times New Roman (Serif)', value: 'Times New Roman, serif' },
    { name: 'Crimson Text (Serif)', value: 'Crimson Text, serif' },
    { name: 'Libre Baskerville (Serif)', value: 'Libre Baskerville, serif' },
    { name: 'EB Garamond (Serif)', value: 'EB Garamond, serif' },
    { name: 'Bitter (Serif)', value: 'Bitter, serif' },
    { name: 'Cinzel (Serif)', value: 'Cinzel, serif' },
    { name: 'Roboto Slab (Serif)', value: 'Roboto Slab, serif' },
    { name: 'PT Serif (Serif)', value: 'PT Serif, serif' },
    { name: 'Raleway (Sans-serif)', value: 'Raleway, sans-serif' },
    { name: 'Open Sans (Sans-serif)', value: 'Open Sans, sans-serif' },
    { name: 'Roboto (Sans-serif)', value: 'Roboto, sans-serif' },
    { name: 'Lato (Sans-serif)', value: 'Lato, sans-serif' },
    { name: 'Montserrat (Sans-serif)', value: 'Montserrat, sans-serif' },
    { name: 'Poppins (Sans-serif)', value: 'Poppins, sans-serif' },
    { name: 'Inter (Sans-serif)', value: 'Inter, sans-serif' },
    { name: 'Source Sans Pro (Sans-serif)', value: 'Source Sans Pro, sans-serif' },
    { name: 'Nunito (Sans-serif)', value: 'Nunito, sans-serif' },
    { name: 'Oswald (Sans-serif)', value: 'Oswald, sans-serif' },
    { name: 'Abril Fatface (Cursive)', value: 'Abril Fatface, cursive' },
    { name: 'Pacifico (Cursive)', value: 'Pacifico, cursive' }
  ];

  const hebrewFonts = [
    { name: 'Frank Ruhl Libre (Serif)', value: 'Frank Ruhl Libre, Times New Roman, serif' },
    { name: 'Cardo (Serif)', value: 'Cardo, Times New Roman, serif' },
    { name: 'David Libre (Serif)', value: 'David Libre, Times New Roman, serif' },
    { name: 'Noto Serif Hebrew (Serif)', value: 'Noto Serif Hebrew, Georgia, serif' },
    { name: 'Tinos (Serif)', value: 'Tinos, Times New Roman, serif' },
    { name: 'Suez One (Serif)', value: 'Suez One, Times New Roman, serif' },
    { name: 'Miriam Libre (Serif)', value: 'Miriam Libre, Times New Roman, serif' },
    { name: 'Noto Rashi Hebrew (Traditional)', value: 'Noto Rashi Hebrew, Times New Roman, serif' },
    { name: 'Rashi (Traditional)', value: 'Rashi, Times New Roman, serif' },
    { name: 'Stam (Traditional)', value: 'Stam, Times New Roman, serif' },
    { name: 'Modeledet (Traditional)', value: 'Modeledet, Times New Roman, serif' },
    { name: 'Plasti (Traditional)', value: 'Plasti, Times New Roman, serif' },
    { name: 'Times New Roman (Serif)', value: 'Times New Roman, serif' },
    { name: 'Georgia (Serif)', value: 'Georgia, serif' },
    { name: 'Noto Sans Hebrew (Sans-serif)', value: 'Noto Sans Hebrew, Arial, sans-serif' },
    { name: 'Heebo (Sans-serif)', value: 'Heebo, Arial, sans-serif' },
    { name: 'Rubik (Sans-serif)', value: 'Rubik, Arial, sans-serif' },
    { name: 'Alef (Sans-serif)', value: 'Alef, Arial, sans-serif' },
    { name: 'Assistant (Sans-serif)', value: 'Assistant, Arial, sans-serif' },
    { name: 'Varela Round (Sans-serif)', value: 'Varela Round, Arial, sans-serif' },
    { name: 'Secular One (Sans-serif)', value: 'Secular One, Arial, sans-serif' },
    { name: 'Arimo (Sans-serif)', value: 'Arimo, Arial, sans-serif' },
    { name: 'Cousine (Block)', value: 'Cousine, Courier New, monospace' }
  ];

  // Apply preset positions for 3 images in collage layout
  function applyPresetCollagePositions() {
    if (selectedBannerImages.length === 0) return;
    
    // Preset positions for 3 images
    const presets = [
      { x: 50, y: 60, zoom: 0.8, zIndex: 3, opacity: 1.0 }, // Center image
      { x: 20, y: 40, zoom: 0.6, zIndex: 1, opacity: 1.0 }, // Image 2
      { x: 80, y: 40, zoom: 0.6, zIndex: 2, opacity: 1.0 },  // Image 3
      { x: 50, y: 20, zoom: 0.55, zIndex: 1, opacity: 1.0 }, // Image 4
    ];
    
    // Apply presets to first 3 images
    selectedBannerImages = selectedBannerImages.map((img, idx) => {
      if (idx < 3 && presets[idx]) {
        return {
          ...img,
          zoom: presets[idx].zoom,
          zIndex: presets[idx].zIndex,
          opacity: presets[idx].opacity ?? img.opacity ?? 1.0
        };
      }
      return {
        ...img,
        opacity: img.opacity ?? 1.0 // Ensure opacity is set
      };
    });
    
    // Initialize custom positions
    bannerSettings.collageImagePositions = selectedBannerImages.map((_, idx) => {
      if (idx < 3 && presets[idx]) {
        return {
          x: presets[idx].x,
          y: presets[idx].y,
          rotation: 0
        };
      }
      // Default positions for additional images
      return {
        x: 20 + (idx * 30) % 60,
        y: 20 + Math.floor(idx / 2) * 30,
        rotation: 0
      };
    });
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
      // Remove the leading ה' prefix
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
    return result || '';
  }

  const imageLayouts = [
    { value: 'right', label: 'Image Right (Text Left)' },
    { value: 'left', label: 'Image Left (Text Right)' },
    { value: 'center', label: 'Image Center (Text Overlay)' },
    { value: 'full', label: 'Full Background Image' },
    { value: 'collage', label: 'Image Collage' },
    { value: 'split', label: 'Split Screen' }
  ];

  // Preset layout templates
  const layoutPresets = [
    {
      id: 'classic-right',
      name: 'Classic Right',
      description: 'Image on right, text on left',
      preview: 'right',
      settings: {
        imageLayout: 'right',
        textImageRatio: 0.4,
        backgroundType: 'solid',
        backgroundColor: '#F5F1E8',
        textAlign: 'center',
        imagePosition: 'cover',
        imageOpacity: 1.0
      }
    },
    {
      id: 'classic-left',
      name: 'Classic Left',
      description: 'Image on left, text on right',
      preview: 'left',
      settings: {
        imageLayout: 'left',
        textImageRatio: 0.4,
        backgroundType: 'solid',
        backgroundColor: '#F5F1E8',
        textAlign: 'center',
        imagePosition: 'cover',
        imageOpacity: 1.0
      }
    },
    {
      id: 'full-background',
      name: 'Full Background',
      description: 'Image as full background with text overlay',
      preview: 'full',
      settings: {
        imageLayout: 'full',
        backgroundType: 'image',
        textAlign: 'center',
        imagePosition: 'cover',
        imageOpacity: 1.0,
        textBackgroundOpacity: 0.85
      }
    },
    {
      id: 'centered-overlay',
      name: 'Centered Overlay',
      description: 'Centered image with text overlay',
      preview: 'center',
      settings: {
        imageLayout: 'center',
        backgroundType: 'gradient',
        backgroundGradient: {
          type: 'radial',
          direction: 'center',
          colors: ['#F5F1E8', '#E8E0D0'],
          stops: [0, 100]
        },
        textAlign: 'center',
        imagePosition: 'contain',
        imageOpacity: 1.0
      }
    },
    {
      id: 'collage-grid',
      name: 'Collage Grid',
      description: 'Multiple images in a grid layout',
      preview: 'collage',
      settings: {
        imageLayout: 'collage',
        textImageRatio: 0.4,
        backgroundType: 'solid',
        backgroundColor: '#F5F1E8',
        textAlign: 'center',
        imagePosition: 'cover',
        imageOpacity: 1.0
      }
    },
    {
      id: 'split-screen',
      name: 'Split Screen',
      description: 'Split screen with image and text',
      preview: 'split',
      settings: {
        imageLayout: 'split',
        backgroundType: 'solid',
        backgroundColor: '#F5F1E8',
        textAlign: 'center',
        imagePosition: 'cover',
        imageOpacity: 1.0
      }
    },
    {
      id: 'elegant-gradient',
      name: 'Elegant Gradient',
      description: 'Gradient background with image on right',
      preview: 'right',
      settings: {
        imageLayout: 'right',
        textImageRatio: 0.4,
        backgroundType: 'gradient',
        backgroundGradient: {
          type: 'linear',
          direction: 'to right',
          colors: ['#2C1810', '#4A3428'],
          stops: [0, 100]
        },
        textColor: '#FFFFFF',
        textBackground: 'rgba(0, 0, 0, 0.3)',
        textBackgroundOpacity: 0.5,
        textAlign: 'center',
        imagePosition: 'cover',
        imageOpacity: 1.0
      }
    },
    {
      id: 'minimal-pattern',
      name: 'Minimal Pattern',
      description: 'Pattern background with image on left',
      preview: 'left',
      settings: {
        imageLayout: 'left',
        textImageRatio: 0.4,
        backgroundType: 'pattern',
        backgroundColor: '#F5F1E8',
        backgroundPattern: 'dots',
        textAlign: 'center',
        imagePosition: 'cover',
        imageOpacity: 1.0
      }
    }
  ];

  // Apply a preset layout
  function applyPreset(preset) {
    bannerSettings = {
      ...bannerSettings,
      ...preset.settings
    };
  }

  // Generate preview for a specific preset (fully async, yields to browser)
  async function generatePresetPreview(preset) {
    if (presetPreviews[preset.id]) {
      return presetPreviews[preset.id]; // Return cached preview
    }

    if (generatingPresetIds.has(preset.id)) {
      return null; // Already generating
    }

    generatingPresetIds.add(preset.id);

    try {
      // Yield to browser to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0));

      const canvas = document.createElement('canvas');
      // Use smaller size for previews
      canvas.width = 400;
      canvas.height = 210; // Maintain 1200:630 ratio
      const ctx = canvas.getContext('2d');
      
      // Save current settings
      const originalSettings = { ...bannerSettings };
      
      // Temporarily apply preset settings
      const tempSettings = {
        ...bannerSettings,
        ...preset.settings,
        // Use demo content for preview
        title: preset.name,
        titleHebrew: '',
        subtitle: preset.description,
        subtitleHebrew: '',
        yearEnglish: '',
        yearHebrew: '',
        primaryImageUrl: bannerSettings.primaryImageUrl || '',
        backgroundImageUrl: bannerSettings.backgroundImageUrl || ''
      };
      
      // Temporarily set bannerSettings for drawing
      const originalBannerSettings = bannerSettings;
      bannerSettings = tempSettings;
      
      // Yield to browser between operations
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Draw background
      await drawBackground(ctx, canvas.width, canvas.height);
      
      // Yield again
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Draw a simple placeholder image if no image is available
      if (!tempSettings.primaryImageUrl && tempSettings.backgroundType !== 'image') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        if (tempSettings.imageLayout === 'right') {
          ctx.fillRect(canvas.width * 0.4, 0, canvas.width * 0.6, canvas.height);
        } else if (tempSettings.imageLayout === 'left') {
          ctx.fillRect(0, 0, canvas.width * 0.6, canvas.height);
        } else if (tempSettings.imageLayout === 'split') {
          ctx.fillRect(canvas.width * 0.5, 0, canvas.width * 0.5, canvas.height);
        } else if (tempSettings.imageLayout === 'collage') {
          const cols = 2;
          const rows = 2;
          const cellWidth = canvas.width / cols;
          const cellHeight = canvas.height / rows;
          for (let i = 0; i < 4; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
          }
        } else {
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      } else if (tempSettings.primaryImageUrl) {
        await drawImages(ctx, canvas.width, canvas.height);
      }
      
      // Yield again
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Draw text
      drawText(ctx, canvas.width, canvas.height);
      
      // Restore original settings
      bannerSettings = originalBannerSettings;
      
      // Final yield before data URL conversion (can be expensive)
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const previewUrl = canvas.toDataURL('image/png');
      presetPreviews[preset.id] = previewUrl;
      return previewUrl;
    } catch (error) {
      console.error('Error generating preset preview:', error);
      return null;
    } finally {
      generatingPresetIds.delete(preset.id);
    }
  }

  // Generate all preset previews (lazy, one at a time to avoid blocking)
  async function generateAllPresetPreviews() {
    if (generatingPreviews) return;
    generatingPreviews = true;
    
    try {
      // Generate previews one at a time to avoid blocking the UI
      for (const preset of layoutPresets) {
        if (!presetPreviews[preset.id]) {
          await generatePresetPreview(preset);
          // Small delay to allow UI to update
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      console.error('Error generating preset previews:', error);
    } finally {
      generatingPreviews = false;
    }
  }

  // Generate preview for a single preset on demand (non-blocking)
  async function ensurePresetPreview(preset) {
    if (presetPreviews[preset.id] || generatingPresetIds.has(preset.id)) {
      return; // Already exists or generating
    }
    
    // Start generation asynchronously without blocking
    generatePresetPreview(preset).catch(err => {
      console.error('Error generating preview for preset:', preset.id, err);
    });
  }

  // Download preset preview
  function downloadPresetPreview(preset, event) {
    event.stopPropagation();
    const previewUrl = presetPreviews[preset.id];
    if (!previewUrl) {
      alert('Preview not ready yet. Please wait a moment.');
      return;
    }
    
    const link = document.createElement('a');
    link.download = `banner-template-${preset.id}-${Date.now()}.png`;
    link.href = previewUrl;
    link.click();
  }

  // Don't generate all previews on mount - only generate on hover
  // This prevents the page from hanging when the banner tool is opened

  const backgroundTypes = [
    { value: 'solid', label: 'Solid Color' },
    { value: 'gradient', label: 'Gradient' },
    { value: 'image', label: 'Background Image' },
    { value: 'pattern', label: 'Pattern' }
  ];

  // Background design presets
  const backgroundPresets = [
    {
      id: 'antique-paper',
      name: 'Antique Paper',
      description: 'Warm beige with subtle texture',
      settings: {
        backgroundType: 'pattern',
        backgroundColor: '#F5F1E8',
        backgroundPattern: 'noise'
      }
    },
    {
      id: 'elegant-cream',
      name: 'Elegant Cream',
      description: 'Soft cream gradient',
      settings: {
        backgroundType: 'gradient',
        backgroundGradient: {
          type: 'linear',
          direction: 'to bottom right',
          colors: ['#F5F1E8', '#E8E0D0'],
          stops: [0, 100]
        }
      }
    },
    {
      id: 'royal-purple',
      name: 'Royal Purple',
      description: 'Rich purple gradient',
      settings: {
        backgroundType: 'gradient',
        backgroundColor: '#4A148C',
        backgroundGradient: {
          type: 'linear',
          direction: 'to right',
          colors: ['#4A148C', '#6A1B9A'],
          stops: [0, 100]
        },
        textColor: '#FFFFFF',
        textBackground: 'rgba(0, 0, 0, 0.3)',
        textBackgroundOpacity: 0.6
      }
    },
    {
      id: 'golden-sunset',
      name: 'Golden Sunset',
      description: 'Warm gold to orange gradient',
      settings: {
        backgroundType: 'gradient',
        backgroundGradient: {
          type: 'radial',
          direction: 'center',
          colors: ['#FFD700', '#FF8C00'],
          stops: [0, 100]
        },
        textColor: '#2C1810',
        textBackground: 'rgba(255, 255, 255, 0.8)',
        textBackgroundOpacity: 0.8
      }
    },
    {
      id: 'ocean-blue',
      name: 'Ocean Blue',
      description: 'Calming blue gradient',
      settings: {
        backgroundType: 'gradient',
        backgroundGradient: {
          type: 'linear',
          direction: 'to bottom',
          colors: ['#87CEEB', '#4682B4'],
          stops: [0, 100]
        },
        textColor: '#FFFFFF',
        textBackground: 'rgba(0, 0, 0, 0.4)',
        textBackgroundOpacity: 0.7
      }
    },
    {
      id: 'forest-green',
      name: 'Forest Green',
      description: 'Deep green gradient',
      settings: {
        backgroundType: 'gradient',
        backgroundGradient: {
          type: 'linear',
          direction: 'to right',
          colors: ['#2D5016', '#3D6B1F'],
          stops: [0, 100]
        },
        textColor: '#FFFFFF',
        textBackground: 'rgba(0, 0, 0, 0.3)',
        textBackgroundOpacity: 0.6
      }
    },
    {
      id: 'vintage-dots',
      name: 'Vintage Dots',
      description: 'Beige with dot pattern',
      settings: {
        backgroundType: 'pattern',
        backgroundColor: '#F5F1E8',
        backgroundPattern: 'dots'
      }
    },
    {
      id: 'geometric-grid',
      name: 'Geometric Grid',
      description: 'Clean grid pattern',
      settings: {
        backgroundType: 'pattern',
        backgroundColor: '#FFFFFF',
        backgroundPattern: 'grid'
      }
    },
    {
      id: 'wave-texture',
      name: 'Wave Texture',
      description: 'Subtle wave pattern',
      settings: {
        backgroundType: 'pattern',
        backgroundColor: '#F0F0F0',
        backgroundPattern: 'waves'
      }
    },
    {
      id: 'hexagon-modern',
      name: 'Hexagon Modern',
      description: 'Modern hexagon pattern',
      settings: {
        backgroundType: 'pattern',
        backgroundColor: '#FAFAFA',
        backgroundPattern: 'hexagons'
      }
    },
    {
      id: 'herringbone-classic',
      name: 'Herringbone Classic',
      description: 'Classic herringbone pattern',
      settings: {
        backgroundType: 'pattern',
        backgroundColor: '#F5F1E8',
        backgroundPattern: 'herringbone'
      }
    },
    {
      id: 'starry-night',
      name: 'Starry Night',
      description: 'Dark with star pattern',
      settings: {
        backgroundType: 'pattern',
        backgroundColor: '#1A1A2E',
        backgroundPattern: 'stars',
        textColor: '#FFFFFF',
        textBackground: 'rgba(0, 0, 0, 0.5)',
        textBackgroundOpacity: 0.7
      }
    },
    {
      id: 'elegant-lines',
      name: 'Elegant Lines',
      description: 'Subtle horizontal lines',
      settings: {
        backgroundType: 'pattern',
        backgroundColor: '#F8F8F8',
        backgroundPattern: 'lines'
      }
    },
    {
      id: 'crosshatch-texture',
      name: 'Crosshatch Texture',
      description: 'Diagonal crosshatch pattern',
      settings: {
        backgroundType: 'pattern',
        backgroundColor: '#F5F1E8',
        backgroundPattern: 'crosshatch'
      }
    },
    {
      id: 'circle-mosaic',
      name: 'Circle Mosaic',
      description: 'Overlapping circles pattern',
      settings: {
        backgroundType: 'pattern',
        backgroundColor: '#FFFFFF',
        backgroundPattern: 'circles'
      }
    },
    {
      id: 'warm-terracotta',
      name: 'Warm Terracotta',
      description: 'Terracotta solid color',
      settings: {
        backgroundType: 'solid',
        backgroundColor: '#E07A5F',
        textColor: '#FFFFFF',
        textBackground: 'rgba(0, 0, 0, 0.3)',
        textBackgroundOpacity: 0.6
      }
    },
    {
      id: 'deep-navy',
      name: 'Deep Navy',
      description: 'Rich navy blue',
      settings: {
        backgroundType: 'solid',
        backgroundColor: '#1E3A5F',
        textColor: '#FFFFFF',
        textBackground: 'rgba(0, 0, 0, 0.4)',
        textBackgroundOpacity: 0.7
      }
    },
    {
      id: 'ivory-white',
      name: 'Ivory White',
      description: 'Clean ivory background',
      settings: {
        backgroundType: 'solid',
        backgroundColor: '#FFFFF0'
      }
    },
    {
      id: 'charcoal-dark',
      name: 'Charcoal Dark',
      description: 'Dark charcoal background',
      settings: {
        backgroundType: 'solid',
        backgroundColor: '#36454F',
        textColor: '#FFFFFF',
        textBackground: 'rgba(0, 0, 0, 0.5)',
        textBackgroundOpacity: 0.8
      }
    },
    {
      id: 'sunset-gradient',
      name: 'Sunset Gradient',
      description: 'Pink to orange gradient',
      settings: {
        backgroundType: 'gradient',
        backgroundGradient: {
          type: 'linear',
          direction: 'to bottom',
          colors: ['#FF6B6B', '#FFA07A'],
          stops: [0, 100]
        },
        textColor: '#FFFFFF',
        textBackground: 'rgba(0, 0, 0, 0.3)',
        textBackgroundOpacity: 0.6
      }
    }
  ];

  // Apply a background preset
  function applyBackgroundPreset(preset) {
    bannerSettings = {
      ...bannerSettings,
      ...preset.settings
    };
  }

  // Load saved templates from localStorage
  function loadSavedTemplates() {
    try {
      const stored = localStorage.getItem(`banner-templates-${type}`);
      if (stored) {
        savedTemplates = JSON.parse(stored);
      } else {
        savedTemplates = [];
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      savedTemplates = [];
    }
  }

  // Save templates to localStorage
  function saveTemplatesToStorage() {
    try {
      localStorage.setItem(`banner-templates-${type}`, JSON.stringify(savedTemplates));
    } catch (error) {
      console.error('Error saving templates:', error);
    }
  }

  // Load a template
  function loadTemplate(template) {
    if (template && template.settings) {
      bannerSettings = {
        ...bannerSettings,
        ...template.settings
      };
      showTemplateSelector = false;
      selectedTemplateId = template.id;
    }
  }

  // Save current settings as a template
  function saveAsTemplate() {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    const newTemplate = {
      id: `template-${Date.now()}`,
      name: templateName.trim(),
      createdAt: new Date().toISOString(),
      settings: { ...bannerSettings }
    };

    savedTemplates = [...savedTemplates, newTemplate];
    saveTemplatesToStorage();
    templateName = '';
    showSaveTemplateDialog = false;
  }

  // Delete a template
  function deleteTemplate(templateId, event) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this template?')) {
      savedTemplates = savedTemplates.filter(t => t.id !== templateId);
      saveTemplatesToStorage();
      if (selectedTemplateId === templateId) {
        selectedTemplateId = null;
      }
    }
  }

  // Start with blank template
  function startBlank() {
    showTemplateSelector = false;
    selectedTemplateId = null;
  }

  // Initialize templates on mount
  $effect(() => {
    loadSavedTemplates();
  });

  // Initialize based on type
  $effect(() => {
    if (!showTemplateSelector) {
      if (type === 'auction' && auction) {
        bannerSettings.title = auction.title || '';
        bannerSettings.subtitle = auction.description ? auction.description.substring(0, 150) : '';
        bannerSettings.primaryImageUrl = auction.imageUrl || '';
        bannerSettings.backgroundImageUrl = auction.imageUrl || '';
      } else if (type === 'auctionHouse' && auctionHouse) {
        bannerSettings.title = auctionHouse.name || '';
        bannerSettings.subtitle = auctionHouse.description ? auctionHouse.description.substring(0, 150) : '';
        bannerSettings.primaryImageUrl = auctionHouse.logoUrl || '';
        bannerSettings.backgroundImageUrl = auctionHouse.logoUrl || '';
        // Initialize logo URL from auction house if available
        if (auctionHouse.logoUrl && !bannerSettings.logoUrl) {
          bannerSettings.logoUrl = auctionHouse.logoUrl;
        }
      }
    }
  });
  
  // Initialize logo from auctionHouse if available (for lot/auction types too)
  $effect(() => {
    if (auctionHouse?.logoUrl && !showTemplateSelector) {
      // Auto-enable logo and use auction house logo by default
      if (!bannerSettings.logoUrl || !bannerSettings.useCustomLogo) {
        bannerSettings.showLogo = true;
        bannerSettings.useCustomLogo = false;
        // Don't set logoUrl - we'll use auctionHouse.logoUrl directly in drawLogo
      }
    }
  });

  // Auto-generate preview when dependencies change
  let previewGenerationTimeout = null;
  let isInitialMount = true;
  
  $effect(() => {
    // Watch for changes in key state that should trigger preview regeneration
    const lotId = selectedBannerLotId; // Track lot selection
    const imageCount = selectedBannerImages.length; // Track image selection
    
    // Track individual image properties by accessing them directly
    // This ensures we catch changes to zoom, opacity, rotation, position, etc.
    for (const img of selectedBannerImages) {
      // Access properties to create reactive dependencies
      const _ = img.id;
      const __ = img.url;
      const ___ = img.zoom;
      const ____ = img.opacity;
      const _____ = img.rotation;
      const ______ = img.flipHorizontal;
      const _______ = img.flipVertical;
      const ________ = img.zIndex;
    }
    
    // Track banner settings - create a reactive dependency by accessing key properties
    const title = bannerSettings.title;
    const titleHebrew = bannerSettings.titleHebrew;
    const subtitle = bannerSettings.subtitle;
    const subtitleHebrew = bannerSettings.subtitleHebrew;
    const yearEnglish = bannerSettings.yearEnglish;
    const yearHebrew = bannerSettings.yearHebrew;
    const category = bannerSettings.category;
    const categoryHebrew = bannerSettings.categoryHebrew;
    const imageLayout = bannerSettings.imageLayout;
    const imagePosition = bannerSettings.imagePosition;
    const imageOpacity = bannerSettings.imageOpacity;
    const imageRotation = bannerSettings.imageRotation;
    const imageFlipHorizontal = bannerSettings.imageFlipHorizontal;
    const imageFlipVertical = bannerSettings.imageFlipVertical;
    const imageSize = bannerSettings.imageSize;
    const backgroundType = bannerSettings.backgroundType;
    const backgroundColor = bannerSettings.backgroundColor;
    const backgroundImageUrl = bannerSettings.backgroundImageUrl;
    const backgroundPattern = bannerSettings.backgroundPattern;
    const backgroundGradient = bannerSettings.backgroundGradient;
    const fontSize = bannerSettings.fontSize;
    const fontFamily = bannerSettings.fontFamily;
    const hebrewFontFamily = bannerSettings.hebrewFontFamily;
    const textColor = bannerSettings.textColor;
    const textAlign = bannerSettings.textAlign;
    const textImageRatio = bannerSettings.textImageRatio;
    const padding = bannerSettings.padding;
    const width = bannerSettings.width;
    const height = bannerSettings.height;
    const textBackground = bannerSettings.textBackground;
    const textBackgroundOpacity = bannerSettings.textBackgroundOpacity;
    const ribbonColor = bannerSettings.ribbonColor;
    const ribbonPosition = bannerSettings.ribbonPosition;
    const showBottomBorder = bannerSettings.showBottomBorder;
    const bottomBorderColor = bannerSettings.bottomBorderColor;
    const bottomBorderPosition = bannerSettings.bottomBorderPosition;
    const bottomBorderHeight = bannerSettings.bottomBorderHeight;
    const bottomBorderTextAlign = bannerSettings.bottomBorderTextAlign;
    const collageImageSide = bannerSettings.collageImageSide;
    const collageSplitStyle = bannerSettings.collageSplitStyle;
    const imageShadowEnabled = bannerSettings.imageShadowEnabled;
    const imageShadowColor = bannerSettings.imageShadowColor;
    const imageShadowBlur = bannerSettings.imageShadowBlur;
    const imageShadowOffsetX = bannerSettings.imageShadowOffsetX;
    const imageShadowOffsetY = bannerSettings.imageShadowOffsetY;
    const collageImagePositions = bannerSettings.collageImagePositions;
    
    // Track logo settings
    const showLogo = bannerSettings.showLogo;
    const useCustomLogo = bannerSettings.useCustomLogo;
    const logoUrl = bannerSettings.logoUrl;
    const logoPosition = bannerSettings.logoPosition;
    const logoSize = bannerSettings.logoSize;
    const logoOpacity = bannerSettings.logoOpacity;
    const logoMargin = bannerSettings.logoMargin;
    
    // Track watermark settings
    const showWatermark = bannerSettings.showWatermark;
    const watermarkUseLogo = bannerSettings.watermarkUseLogo;
    const watermarkUrl = bannerSettings.watermarkUrl;
    const watermarkSize = bannerSettings.watermarkSize;
    const watermarkOpacity = bannerSettings.watermarkOpacity;
    const watermarkPosition = bannerSettings.watermarkPosition;
    const watermarkRotation = bannerSettings.watermarkRotation;
    
    // Track separator settings
    const separatorStyle = bannerSettings.separatorStyle;
    const separatorAlignment = bannerSettings.separatorAlignment;
    const separatorWidth = bannerSettings.separatorWidth;
    const separatorThickness = bannerSettings.separatorThickness;
    const separatorColor = bannerSettings.separatorColor;
    const separatorMarginTop = bannerSettings.separatorMarginTop;
    const separatorMarginBottom = bannerSettings.separatorMarginBottom;
    
    // Track text separator settings
    const textSeparatorEnabled = bannerSettings.textSeparatorEnabled;
    const textSeparatorStyle = bannerSettings.textSeparatorStyle;
    const textSeparatorPosition = bannerSettings.textSeparatorPosition;
    const textSeparatorWidth = bannerSettings.textSeparatorWidth;
    const textSeparatorThickness = bannerSettings.textSeparatorThickness;
    const textSeparatorAlign = bannerSettings.textSeparatorAlign;
    const textSeparatorColor = bannerSettings.textSeparatorColor;
    const textSeparatorMarginTop = bannerSettings.textSeparatorMarginTop;
    const textSeparatorMarginBottom = bannerSettings.textSeparatorMarginBottom;
    
    // Track overlay stamp settings
    const showOverlayStamp = bannerSettings.showOverlayStamp;
    const overlayStampUrl = bannerSettings.overlayStampUrl;
    const overlayStampPosition = bannerSettings.overlayStampPosition;
    const overlayStampX = bannerSettings.overlayStampX;
    const overlayStampY = bannerSettings.overlayStampY;
    const overlayStampSize = bannerSettings.overlayStampSize;
    const overlayStampRotation = bannerSettings.overlayStampRotation;
    const overlayStampOpacity = bannerSettings.overlayStampOpacity;
    
    // Track flexible text elements
    const useFlexibleTextElements = bannerSettings.useFlexibleTextElements;
    const textElements = bannerSettings.textElements;
    
    // Track per-field text settings
    const titleEnglishFontSize = bannerSettings.titleEnglishFontSize;
    const titleEnglishAlign = bannerSettings.titleEnglishAlign;
    const titleHebrewFontSize = bannerSettings.titleHebrewFontSize;
    const titleHebrewAlign = bannerSettings.titleHebrewAlign;
    const subtitleEnglishFontSize = bannerSettings.subtitleEnglishFontSize;
    const subtitleEnglishAlign = bannerSettings.subtitleEnglishAlign;
    const subtitleHebrewFontSize = bannerSettings.subtitleHebrewFontSize;
    const subtitleHebrewAlign = bannerSettings.subtitleHebrewAlign;
    const yearEnglishFontSize = bannerSettings.yearEnglishFontSize;
    const yearEnglishAlign = bannerSettings.yearEnglishAlign;
    const yearHebrewFontSize = bannerSettings.yearHebrewFontSize;
    const yearHebrewAlign = bannerSettings.yearHebrewAlign;
    const textSpacingTitle = bannerSettings.textSpacingTitle;
    const textSpacingYear = bannerSettings.textSpacingYear;
    const textSpacingSubtitle = bannerSettings.textSpacingSubtitle;
    const textLineHeight = bannerSettings.textLineHeight;
    
    // Skip on initial mount to avoid generating empty preview
    if (isInitialMount) {
      isInitialMount = false;
      return;
    }
    
    // Clear any pending generation
    if (previewGenerationTimeout) {
      clearTimeout(previewGenerationTimeout);
    }
    
    // Debounce preview generation to avoid excessive regenerations
    // Only generate if we have at least a title or images or logo enabled or overlay stamp or watermark
    const shouldGenerate = title || imageCount > 0 || backgroundImageUrl || showLogo || showOverlayStamp || showWatermark || (type === 'auction' && auction) || (type === 'auctionHouse' && auctionHouse);
    
    if (shouldGenerate) {
      previewGenerationTimeout = setTimeout(() => {
        // Don't regenerate if already generating
        if (!generatingBanner) {
          generateQuickBanner().catch(err => {
            console.error('Error auto-generating preview:', err);
          });
        }
      }, 300); // 300ms debounce
    }
    
    return () => {
      if (previewGenerationTimeout) {
        clearTimeout(previewGenerationTimeout);
      }
    };
  });

  // Helper function to wrap text (respects manual line breaks and auto-wraps)
  function wrapText(ctx, text, maxWidth) {
    if (!text) return [];
    
    // First, split by manual line breaks (newlines)
    const manualLines = text.split(/\r?\n/);
    const allLines = [];
    
    // For each manual line, apply word wrapping
    for (const manualLine of manualLines) {
      if (manualLine.trim() === '') {
        // Empty line - add it as a blank line
        allLines.push('');
        continue;
      }
      
      const words = manualLine.split(' ');
      let currentLine = words[0] || '';

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine + ' ' + word;
        const width = ctx.measureText(testLine).width;
        
        if (width < maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            allLines.push(currentLine);
          }
          currentLine = word;
        }
      }
      
      if (currentLine) {
        allLines.push(currentLine);
      }
    }
    
    return allLines;
  }

  // Draw background pattern
  function drawBackgroundPattern(ctx, width, height, pattern) {
    ctx.save();
    switch (pattern) {
      case 'dots':
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        const dotSize = 4;
        const spacing = 20;
        for (let x = 0; x < width; x += spacing) {
          for (let y = 0; y < height; y += spacing) {
            ctx.beginPath();
            ctx.arc(x, y, dotSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      case 'lines':
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y += 20) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        break;
      case 'grid':
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        break;
      case 'diagonal':
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 1;
        for (let i = -height; i < width + height; i += 30) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + height, height);
          ctx.stroke();
        }
        break;
      case 'waves':
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 2;
        const waveAmplitude = 15;
        const waveFrequency = 0.02;
        for (let y = 0; y < height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          for (let x = 0; x < width; x += 2) {
            const waveY = y + Math.sin(x * waveFrequency) * waveAmplitude;
            ctx.lineTo(x, waveY);
          }
          ctx.stroke();
        }
        break;
      case 'circles':
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 1;
        const circleSpacing = 60;
        for (let x = 0; x < width + circleSpacing; x += circleSpacing) {
          for (let y = 0; y < height + circleSpacing; y += circleSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, 25, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        break;
      case 'hexagons':
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 1;
        const hexSize = 30;
        const hexHeight = hexSize * Math.sqrt(3);
        for (let y = 0; y < height + hexHeight; y += hexHeight) {
          const offset = (y / hexHeight) % 2 === 0 ? 0 : hexSize;
          for (let x = -hexSize + offset; x < width + hexSize; x += hexSize * 2) {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i;
              const hx = x + hexSize * Math.cos(angle);
              const hy = y + hexSize * Math.sin(angle);
              if (i === 0) ctx.moveTo(hx, hy);
              else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }
        break;
      case 'crosshatch':
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 1;
        const hatchSpacing = 20;
        // Diagonal lines going one way
        for (let i = -height; i < width + height; i += hatchSpacing) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + height, height);
          ctx.stroke();
        }
        // Diagonal lines going the other way
        for (let i = 0; i < width + height; i += hatchSpacing) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i - height, height);
          ctx.stroke();
        }
        break;
      case 'herringbone':
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
        ctx.lineWidth = 1;
        const herringboneSize = 40;
        for (let y = 0; y < height + herringboneSize; y += herringboneSize) {
          for (let x = 0; x < width + herringboneSize; x += herringboneSize) {
            const isEven = (x / herringboneSize + y / herringboneSize) % 2 === 0;
            ctx.beginPath();
            if (isEven) {
              ctx.moveTo(x, y);
              ctx.lineTo(x + herringboneSize, y);
              ctx.lineTo(x + herringboneSize / 2, y + herringboneSize);
            } else {
              ctx.moveTo(x, y + herringboneSize);
              ctx.lineTo(x + herringboneSize, y + herringboneSize);
              ctx.lineTo(x + herringboneSize / 2, y);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }
        break;
      case 'stars':
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        const starSpacing = 80;
        for (let x = 0; x < width + starSpacing; x += starSpacing) {
          for (let y = 0; y < height + starSpacing; y += starSpacing) {
            ctx.beginPath();
            const spikes = 5;
            const outerRadius = 8;
            const innerRadius = 4;
            for (let i = 0; i < spikes * 2; i++) {
              const radius = i % 2 === 0 ? outerRadius : innerRadius;
              const angle = (Math.PI * i) / spikes;
              const sx = x + radius * Math.cos(angle);
              const sy = y + radius * Math.sin(angle);
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
          }
        }
        break;
      case 'noise':
        // Create a noise texture using random dots
        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        const noiseDensity = 0.3; // dots per pixel
        const totalDots = Math.floor(width * height * noiseDensity);
        for (let i = 0; i < totalDots; i++) {
          const x = Math.random() * width;
          const y = Math.random() * height;
          ctx.fillRect(x, y, 1, 1);
        }
        break;
    }
    ctx.restore();
  }

  // Load images from selected lot
  async function loadLotImages(lotId) {
    console.log('Loading images for lot:> ', lotId);
    selectedBannerImages = [];
    selectedLotImages = [];
    
    if (!lotId) {
      // Reset to auction defaults
      if (auction) {
        bannerSettings.title = auction.title || '';
        bannerSettings.subtitle = auction.description ? auction.description.substring(0, 150) : '';
        bannerSettings.primaryImageUrl = auction.imageUrl || '';
        bannerSettings.backgroundImageUrl = auction.imageUrl || '';
        bannerSettings.titleHebrew = '';
        bannerSettings.subtitleHebrew = '';
        bannerSettings.yearEnglish = '';
        bannerSettings.yearHebrew = '';
      }
      return;
    }

    const lot = lots.find(l => l.id === lotId);
    console.log('Lot:> ', lot);
    if (!lot) return;

    bannerSettings.title = lot.title || '';
    bannerSettings.titleHebrew = lot.hebrewTitle || lot.HebrewTitle || '';
    bannerSettings.subtitle = lot.description ? lot.description.substring(0, 150) : '';
    bannerSettings.subtitleHebrew = lot.hebrewDescription || lot.HebrewDescription || '';
    console.log('Banner Settings:> ', bannerSettings);
    // Extract year from title if it contains a year
    const yearMatch = lot.title?.match(/\b(18|19|20)\d{2}\b/);
    if (yearMatch) {
      bannerSettings.yearEnglish = yearMatch[0];
      bannerSettings.yearHebrew = convertToHebrewYear(yearMatch[0]);
    }
    
    // Load all images from the lot
    const images = [];
    
    if (lot.images && Array.isArray(lot.images) && lot.images.length > 0) {
      lot.images.forEach(img => {
        const imageUrl = typeof img === 'string' ? img : (img.url || img);
        const imageId = img.id || `img-${images.length}`;
        const isPrimary = img.isPrimary || false;
        
        images.push({
          url: imageUrl,
          id: imageId,
          isPrimary: isPrimary
        });
      });
    }
    
    // Fallback to legacy imageUrls
    if (images.length === 0 && lot.imageUrls) {
      try {
        const parsed = typeof lot.imageUrls === 'string' 
          ? JSON.parse(lot.imageUrls) 
          : lot.imageUrls;
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((url, index) => {
            images.push({
              url: url,
              id: `legacy-${index}`,
              isPrimary: index === 0
            });
          });
        }
      } catch (e) {
        console.warn('Failed to parse imageUrls:', e);
      }
    }
    
    // Fallback to single imageUrl
    if (images.length === 0 && lot.imageUrl) {
      images.push({
        url: lot.imageUrl,
        id: 'legacy-single',
        isPrimary: true
      });
    }
    
    // Images from database are already presigned URLs
    const imagesWithPresigned = images.map((img) => {
      return {
        ...img,
        url: img.url,
        displayUrl: img.url
      };
    });
    
    selectedLotImages = imagesWithPresigned;
    
    // Auto-select first image (or primary image) with default orientation, zoom, and z-index
    const primaryImage = imagesWithPresigned.find(img => img.isPrimary) || imagesWithPresigned[0];
    if (primaryImage) {
      selectedBannerImages = [{
        ...primaryImage,
        rotation: bannerSettings.imageRotation ?? 0,
        flipHorizontal: bannerSettings.imageFlipHorizontal ?? false,
        flipVertical: bannerSettings.imageFlipVertical ?? false,
        zoom: 0.8, // Preset zoom for first image
        zIndex: 3, // Preset z-index for first image
        opacity: 1.0, // Default opacity
        isFeatured: true // First/primary image is featured by default
      }];
      // Initialize custom positions with preset
      bannerSettings.collageImagePositions = [{
        x: 50,
        y: 60,
          rotation: 0
      }];
      updatePrimaryImage();
    }
  }

  // Wait for fonts to load
  async function waitForFonts(fontFamilies) {
    if (!document.fonts || !document.fonts.check) {
      // Fallback if Font Loading API not available
      await new Promise(resolve => setTimeout(resolve, 500));
      return;
    }
    
    // First, wait for all fonts to be ready
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('document.fonts.ready failed:', e);
    }
    
    const fontsToLoad = [...new Set(fontFamilies.filter(Boolean))];
    console.log('Waiting for fonts to load:', fontsToLoad);
    
    const fontPromises = fontsToLoad.map(fontFamily => {
      // Extract font name (before comma if fallbacks exist, remove quotes)
      let fontName = fontFamily.split(',')[0].trim();
      fontName = fontName.replace(/['"]/g, ''); // Remove quotes if present
      
      // Try different weights - focus on common weights first
      const weights = ['400', '700', '500', '600'];
      
      return Promise.all(
        weights.map(weight => {
          const fontSpec = `${weight} 12px "${fontName}"`;
          
          // Check if font is already loaded
          if (document.fonts.check(fontSpec)) {
            console.log(`Font already loaded: ${fontSpec}`);
            return Promise.resolve();
          }
          
          // Try to load the font
          console.log(`Loading font: ${fontSpec}`);
          return document.fonts.load(fontSpec).then(() => {
            // Verify it's actually loaded
            if (document.fonts.check(fontSpec)) {
              console.log(`Font successfully loaded: ${fontSpec}`);
            } else {
              console.warn(`Font loaded but not available: ${fontSpec}`);
            }
          }).catch((err) => {
            console.warn(`Font load failed for ${fontSpec}:`, err);
            // Font might not be available, that's okay
            return Promise.resolve();
          });
        })
      );
    });
    
    await Promise.all(fontPromises);
    
    // Wait for fonts to be fully ready
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('document.fonts.ready failed after loading:', e);
    }
    
    // Give browser extra time to apply fonts to canvas
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('Fonts ready');
  }

  // Generate banner
  async function generateQuickBanner() {
    generatingBanner = true;
    generatedBannerUrl = null;
    
    try {
      // Wait for fonts to load before drawing
      const fontsToLoad = [
        bannerSettings.fontFamily,
        bannerSettings.hebrewFontFamily
      ].filter(Boolean);
      
      await waitForFonts(fontsToLoad);
      
      const canvas = document.createElement('canvas');
      canvas.width = bannerSettings.width;
      canvas.height = bannerSettings.height;
      const ctx = canvas.getContext('2d');
      
      // Draw background
      await drawBackground(ctx, canvas.width, canvas.height);
      
      // Draw watermark if enabled (after background, before images)
      if (bannerSettings.showWatermark) {
        await drawWatermark(ctx, canvas.width, canvas.height);
      }
      
      // Draw images based on layout
      await drawImages(ctx, canvas.width, canvas.height);
      
      // Draw text based on layout
      drawText(ctx, canvas.width, canvas.height);
      
      // Draw logo if enabled (draw last so it appears on top)
      if (bannerSettings.showLogo) {
        await drawLogo(ctx, canvas.width, canvas.height);
      }
      
      // Draw overlay stamp if enabled (draw last so it appears on top)
      if (bannerSettings.showOverlayStamp && bannerSettings.overlayStampUrl) {
        await drawOverlayStamp(ctx, canvas.width, canvas.height);
      }
      
      generatedBannerUrl = canvas.toDataURL('image/png');
      
      // Call onSave callback if provided
      if (onSave && generatedBannerUrl) {
        onSave(generatedBannerUrl);
      }
    } catch (error) {
      console.error('Error generating banner:', error);
      alert('Failed to generate banner. Please try again.');
    } finally {
      generatingBanner = false;
    }
  }

  async function drawBackground(ctx, width, height) {
    switch (bannerSettings.backgroundType) {
      case 'solid':
        ctx.fillStyle = bannerSettings.backgroundColor;
        ctx.fillRect(0, 0, width, height);
        break;
      case 'gradient':
        const grad = bannerSettings.backgroundGradient.type === 'radial'
          ? ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height))
          : ctx.createLinearGradient(0, 0, width, height);
        
        const colors = bannerSettings.backgroundGradient.colors;
        const stops = bannerSettings.backgroundGradient.stops;
        colors.forEach((color, i) => {
          grad.addColorStop(stops[i] / 100, color);
        });
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        break;
      case 'image':
        // Draw background image first
        if (bannerSettings.backgroundImageUrl) {
          try {
            // Use loadImageForCanvas to handle CORS and S3 URLs
            const imageSrc = await loadImageForCanvas(bannerSettings.backgroundImageUrl);
            
            await new Promise((resolve) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                // Draw background image to fill entire canvas
                if (bannerSettings.imagePosition === 'cover') {
                  const scale = Math.max(width / img.width, height / img.height);
                  const x = (width - img.width * scale) / 2;
                  const y = (height - img.height * scale) / 2;
                  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                } else {
                  const scale = Math.min(width / img.width, height / img.height);
                  const x = (width - img.width * scale) / 2;
                  const y = (height - img.height * scale) / 2;
                  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                }
                if (imageSrc.startsWith('blob:')) {
                  URL.revokeObjectURL(imageSrc);
                }
                resolve();
              };
              img.onerror = () => {
                // Fallback to solid color if image fails
                ctx.fillStyle = bannerSettings.backgroundColor || '#F5F1E8';
                ctx.fillRect(0, 0, width, height);
                if (imageSrc.startsWith('blob:')) {
                  URL.revokeObjectURL(imageSrc);
                }
                resolve();
              };
              img.src = imageSrc;
            });
          } catch (error) {
            console.error('Error loading background image:', error);
            // Fallback to solid color
            ctx.fillStyle = bannerSettings.backgroundColor || '#F5F1E8';
            ctx.fillRect(0, 0, width, height);
          }
        } else {
          // Fallback to solid color if no background image URL
          ctx.fillStyle = bannerSettings.backgroundColor || '#F5F1E8';
          ctx.fillRect(0, 0, width, height);
        }
        break;
      case 'pattern':
        ctx.fillStyle = bannerSettings.backgroundColor;
        ctx.fillRect(0, 0, width, height);
        drawBackgroundPattern(ctx, width, height, bannerSettings.backgroundPattern);
        break;
    }
  }

  async function drawImages(ctx, width, height) {
    console.log('drawImages called, selectedBannerImages:', selectedBannerImages);
    console.log('bannerSettings.primaryImageUrl:', bannerSettings.primaryImageUrl);
    
    // Use selectedBannerImages with their orientation, zoom, opacity, and z-index, or fallback to primaryImageUrl
    const imagesWithOrientation = selectedBannerImages.length > 0 
      ? selectedBannerImages.map((img, idx) => ({
          url: img.url || img.displayUrl || img,
          orientation: {
            rotation: img.rotation ?? bannerSettings.imageRotation ?? 0,
            flipHorizontal: img.flipHorizontal ?? bannerSettings.imageFlipHorizontal ?? false,
            flipVertical: img.flipVertical ?? bannerSettings.imageFlipVertical ?? false
          },
          zoom: img.zoom ?? bannerSettings.imageSize ?? 1.0, // Per-image zoom, fallback to global
          opacity: img.opacity ?? bannerSettings.imageOpacity ?? 1.0, // Per-image opacity, fallback to global
          zIndex: img.zIndex ?? idx, // Per-image z-index, fallback to index
          originalIndex: idx
        }))
      : (bannerSettings.primaryImageUrl ? [{
          url: bannerSettings.primaryImageUrl,
          orientation: {
            rotation: bannerSettings.imageRotation ?? 0,
            flipHorizontal: bannerSettings.imageFlipHorizontal ?? false,
            flipVertical: bannerSettings.imageFlipVertical ?? false
          },
          zoom: bannerSettings.imageSize ?? 1.0,
          opacity: bannerSettings.imageOpacity ?? 1.0,
          zIndex: 0,
          originalIndex: 0
        }] : []);
    
    if (imagesWithOrientation.length === 0 && bannerSettings.backgroundImageUrl && bannerSettings.backgroundType === 'image') {
      imagesWithOrientation.push({
        url: bannerSettings.backgroundImageUrl,
        orientation: {
          rotation: bannerSettings.imageRotation ?? 0,
          flipHorizontal: bannerSettings.imageFlipHorizontal ?? false,
          flipVertical: bannerSettings.imageFlipVertical ?? false
        }
      });
    }
    
    console.log('imagesWithOrientation:', imagesWithOrientation);
    
    if (imagesWithOrientation.length === 0) {
      console.warn('No images to draw');
      return;
    }
    
    // Get presigned URLs (images from mapLot are already presigned, but check anyway)
    const imagesWithUrls = await Promise.all(
      imagesWithOrientation.map(async (imgData) => {
        const imageUrl = imgData.url;
        if (!imageUrl) return null;
        
        // Check if already presigned (has query params)
        const isPresigned = imageUrl.includes('?X-Amz-') || imageUrl.includes('?');
        
        let finalUrl = imageUrl;
        if (!isPresigned && (imageUrl.includes('.s3.') || imageUrl.includes('s3.amazonaws.com'))) {
          try {
            const match = imageUrl.match(/s3[^/]*\.amazonaws\.com\/(.+?)(?:\?|$)/);
            if (match) {
              const key = match[1];
              const response = await fetch('/api/images/presigned', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: [key] })
              });
              if (response.ok) {
                const { urls } = await response.json();
                if (urls[key]) {
                  console.log('Got presigned URL for key:', key);
                  finalUrl = urls[key];
                }
              }
            }
          } catch (error) {
            console.warn('Failed to get presigned URL:', error);
          }
        }
        console.log('Using image URL (already presigned or not S3):', finalUrl);
        return {
          url: finalUrl,
          orientation: imgData.orientation,
          zoom: imgData.zoom ?? bannerSettings.imageSize ?? 1.0, // Include per-image zoom
          zIndex: imgData.zIndex ?? 0 // Include per-image z-index
        };
      })
    );
    
    // Filter out null values
    const validImages = imagesWithUrls.filter(img => img !== null);
    console.log('Valid images:', validImages);
    
    if (validImages.length === 0) {
      console.warn('No valid image URLs after processing');
      return;
    }
    
    // For collage, opacity is handled per-image, so don't set global alpha
    if (bannerSettings.imageLayout !== 'collage') {
    ctx.globalAlpha = bannerSettings.imageOpacity;
    }
    
    switch (bannerSettings.imageLayout) {
      case 'full':
        await drawFullBackgroundImage(ctx, width, height, validImages[0]?.url, validImages[0]?.orientation, validImages[0]?.zoom);
        break;
      case 'center':
        await drawCenterImage(ctx, width, height, validImages);
        break;
      case 'collage':
        await drawCollage(ctx, width, height, validImages);
        break;
      case 'split':
        await drawSplitImage(ctx, width, height, validImages[0]?.url, validImages[0]?.orientation, validImages[0]?.zoom);
        break;
      case 'right':
        await drawRightImage(ctx, width, height, validImages);
        break;
      case 'left':
        await drawLeftImage(ctx, width, height, validImages);
        break;
    }
    
    ctx.globalAlpha = 1.0;
  }

  // Helper function to load image through proxy to avoid CORS issues
  async function loadImageForCanvas(imageUrl) {
    // If it's already a data URL, use it directly
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    
    // For S3 URLs, use proxy to avoid CORS
    if (imageUrl.includes('.s3.') || imageUrl.includes('s3.amazonaws.com')) {
      try {
        const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
          const blob = await response.blob();
          return URL.createObjectURL(blob);
        }
      } catch (error) {
        console.warn('Failed to load image through proxy, trying direct:', error);
      }
    }
    
    // Fallback to direct URL
    return imageUrl;
  }

  // Helper function to apply shadow settings
  function applyImageShadow(ctx) {
    if (bannerSettings.imageShadowEnabled) {
      ctx.shadowColor = bannerSettings.imageShadowColor;
      ctx.shadowBlur = bannerSettings.imageShadowBlur;
      ctx.shadowOffsetX = bannerSettings.imageShadowOffsetX;
      ctx.shadowOffsetY = bannerSettings.imageShadowOffsetY;
    } else {
      // Clear shadow settings
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
  }

  // Helper function to apply image transformations (rotation, flip)
  // Accepts optional per-image orientation, falls back to global settings
  function applyImageTransform(ctx, img, x, y, drawWidth, drawHeight, imageOrientation = null) {
    ctx.save();
    
    // Apply shadow before drawing
    applyImageShadow(ctx);
    
    // Move to center of image
    const centerX = x + drawWidth / 2;
    const centerY = y + drawHeight / 2;
    ctx.translate(centerX, centerY);
    
    // Use per-image orientation if provided, otherwise use global settings
    const rotation = imageOrientation?.rotation ?? bannerSettings.imageRotation ?? 0;
    const flipHorizontal = imageOrientation?.flipHorizontal ?? bannerSettings.imageFlipHorizontal ?? false;
    const flipVertical = imageOrientation?.flipVertical ?? bannerSettings.imageFlipVertical ?? false;
    
    // Apply rotation
    if (rotation !== 0) {
      const rotationRad = (rotation * Math.PI) / 180;
      ctx.rotate(rotationRad);
    }
    
    // Apply flips
    let scaleX = 1;
    let scaleY = 1;
    if (flipHorizontal) scaleX = -1;
    if (flipVertical) scaleY = -1;
    ctx.scale(scaleX, scaleY);
    
    // Draw image centered
    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    
    ctx.restore();
  }

  async function drawFullBackgroundImage(ctx, width, height, imageUrl, orientation = null, zoom = null) {
    if (!imageUrl) {
      console.warn('No image URL provided for drawFullBackgroundImage');
      return;
    }
    return new Promise(async (resolve) => {
      const img = new Image();
      // Don't set crossOrigin when using proxy or blob URLs
      const srcUrl = await loadImageForCanvas(imageUrl);
      img.onload = () => {
        console.log('Image loaded successfully');
        let scale, x, y;
        if (bannerSettings.imagePosition === 'cover') {
          scale = Math.max(width / img.width, height / img.height);
          x = (width - img.width * scale) / 2;
          y = (height - img.height * scale) / 2;
        } else {
          scale = Math.min(width / img.width, height / img.height);
          x = (width - img.width * scale) / 2;
          y = (height - img.height * scale) / 2;
        }
        let drawWidth = img.width * scale;
        let drawHeight = img.height * scale;
        
        // Apply image size/zoom multiplier
        drawWidth *= bannerSettings.imageSize;
        drawHeight *= bannerSettings.imageSize;
        
        // Recalculate position to keep image centered after size change
        x = (width - drawWidth) / 2;
        y = (height - drawHeight) / 2;
        
        // Apply transformations with per-image orientation
        applyImageTransform(ctx, img, x, y, drawWidth, drawHeight, orientation);
        
        // Clean up blob URL if it was created
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        resolve();
      };
      img.onerror = (error) => {
        console.error('Failed to load image:', imageUrl, error);
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        resolve();
      };
      console.log('Loading image:', imageUrl);
      img.src = srcUrl;
    });
  }

  async function drawCenterImage(ctx, width, height, images) {
    if (images.length === 0 || !images[0]?.url) {
      console.warn('No image URL for drawCenterImage');
      return;
    }
    const imageData = images[0];
    return new Promise(async (resolve) => {
      const img = new Image();
      const srcUrl = await loadImageForCanvas(imageData.url);
      img.onload = () => {
        console.log('Center image loaded successfully');
        let imgSize = Math.min(width, height) * 0.6;
        
        // Apply image size/zoom multiplier (use per-image zoom if available)
        const imageZoom = imageData.zoom ?? bannerSettings.imageSize ?? 1.0;
        imgSize *= imageZoom;
        
        const x = (width - imgSize) / 2;
        const y = (height - imgSize) / 2;
        
        // Apply transformations with per-image orientation
        applyImageTransform(ctx, img, x, y, imgSize, imgSize, imageData.orientation);
        
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        resolve();
      };
      img.onerror = (error) => {
        console.error('Failed to load center image:', imageData.url, error);
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        resolve();
      };
      console.log('Loading center image:', imageData.url);
      img.src = srcUrl;
    });
  }

  async function drawRightImage(ctx, width, height, images) {
    if (images.length === 0 || !images[0]?.url) {
      console.warn('No image URL for drawRightImage');
      return;
    }
    const imageData = images[0];
    const textAreaWidth = width * bannerSettings.textImageRatio;
    const imgAreaWidth = width - textAreaWidth;
    const imgAreaX = textAreaWidth;
    
    return new Promise(async (resolve) => {
      const img = new Image();
      const srcUrl = await loadImageForCanvas(imageData.url);
      img.onload = () => {
        console.log('Right image loaded successfully');
        let scale, drawWidth, drawHeight, x, y;
        if (bannerSettings.imagePosition === 'cover') {
          scale = Math.max(imgAreaWidth / img.width, height / img.height);
          drawWidth = img.width * scale;
          drawHeight = img.height * scale;
          x = imgAreaX + (imgAreaWidth - drawWidth) / 2;
          y = (height - drawHeight) / 2;
        } else {
          scale = Math.min(imgAreaWidth / img.width, height / img.height);
          drawWidth = img.width * scale;
          drawHeight = img.height * scale;
          x = imgAreaX + (imgAreaWidth - drawWidth) / 2;
          y = (height - drawHeight) / 2;
        }
        
        // Apply image size/zoom multiplier (use per-image zoom if available)
        const imageZoom = imageData.zoom ?? bannerSettings.imageSize ?? 1.0;
        drawWidth *= imageZoom;
        drawHeight *= imageZoom;
        
        // Recalculate position to keep image centered after size change
        x = imgAreaX + (imgAreaWidth - drawWidth) / 2;
        y = (height - drawHeight) / 2;
        
        // Apply transformations with per-image orientation
        applyImageTransform(ctx, img, x, y, drawWidth, drawHeight, imageData.orientation);
        
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        resolve();
      };
      img.onerror = (error) => {
        console.error('Failed to load right image:', imageData.url, error);
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        resolve();
      };
      console.log('Loading right image:', imageData.url);
      img.src = srcUrl;
    });
  }

  async function drawLeftImage(ctx, width, height, images) {
    if (images.length === 0 || !images[0]?.url) {
      console.warn('No image URL for drawLeftImage');
      return;
    }
    const imageData = images[0];
    const textAreaWidth = width * bannerSettings.textImageRatio;
    const imgAreaWidth = width - textAreaWidth;
    
    return new Promise(async (resolve) => {
      const img = new Image();
      const srcUrl = await loadImageForCanvas(imageData.url);
      img.onload = () => {
        console.log('Left image loaded successfully');
        let scale, drawWidth, drawHeight, x, y;
        if (bannerSettings.imagePosition === 'cover') {
          scale = Math.max(imgAreaWidth / img.width, height / img.height);
          drawWidth = img.width * scale;
          drawHeight = img.height * scale;
          x = (imgAreaWidth - drawWidth) / 2;
          y = (height - drawHeight) / 2;
        } else {
          scale = Math.min(imgAreaWidth / img.width, height / img.height);
          drawWidth = img.width * scale;
          drawHeight = img.height * scale;
          x = (imgAreaWidth - drawWidth) / 2;
          y = (height - drawHeight) / 2;
        }
        
        // Apply image size/zoom multiplier (use per-image zoom if available)
        const imageZoom = imageData.zoom ?? bannerSettings.imageSize ?? 1.0;
        drawWidth *= imageZoom;
        drawHeight *= imageZoom;
        
        // Recalculate position to keep image centered after size change
        x = (imgAreaWidth - drawWidth) / 2;
        y = (height - drawHeight) / 2;
        
        // Apply transformations with per-image orientation
        applyImageTransform(ctx, img, x, y, drawWidth, drawHeight, imageData.orientation);
        
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        resolve();
      };
      img.onerror = (error) => {
        console.error('Failed to load left image:', imageData.url, error);
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        resolve();
      };
      console.log('Loading left image:', imageData.url);
      img.src = srcUrl;
    });
  }

  async function drawSplitImage(ctx, width, height, imageUrl, orientation = null, zoom = null) {
    if (!imageUrl) {
      console.warn('No image URL for drawSplitImage');
      return;
    }
    return new Promise(async (resolve) => {
      const img = new Image();
      const srcUrl = await loadImageForCanvas(imageUrl);
      img.onload = () => {
        console.log('Split image loaded successfully');
        // Split screen: image on one side, text on other
        const splitPoint = width / 2;
        const baseScale = Math.max(splitPoint / img.width, height / img.height);
        const imageZoom = zoom ?? bannerSettings.imageSize ?? 1.0;
        const scale = baseScale * imageZoom;
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const x = splitPoint + (splitPoint - drawWidth) / 2;
        const y = (height - drawHeight) / 2;
        
        // Apply transformations with per-image orientation
        applyImageTransform(ctx, img, x, y, drawWidth, drawHeight, orientation);
        
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        resolve();
      };
      img.onerror = (error) => {
        console.error('Failed to load split image:', imageUrl, error);
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        resolve();
      };
      console.log('Loading split image:', imageUrl);
      img.src = srcUrl;
    });
  }

  // Helper function to get image URL (handles S3 keys)
  async function getLogoImageUrl(logoUrl) {
    if (!logoUrl) {
      console.log('[Logo] getLogoImageUrl: No logoUrl provided');
      return null;
    }
    
    console.log('[Logo] getLogoImageUrl: Input URL:', logoUrl);
    
    // If it's already a full HTTP/HTTPS URL, return as-is
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      // Check if it's an S3 URL that needs presigning
      if (logoUrl.includes('.s3.') || logoUrl.includes('s3.amazonaws.com')) {
        const match = logoUrl.match(/s3[^/]*\.amazonaws\.com\/(.+?)(?:\?|$)/);
        if (match) {
          const key = match[1];
          console.log('[Logo] Extracted S3 key from URL:', key);
          try {
            const response = await fetch('/api/images/presigned', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keys: [key] })
            });
            if (response.ok) {
              const { urls } = await response.json();
              const presignedUrl = urls[key] || logoUrl;
              console.log('[Logo] Got presigned URL:', presignedUrl);
              return presignedUrl;
            } else {
              console.warn('[Logo] Failed to get presigned URL, status:', response.status);
            }
          } catch (error) {
            console.warn('[Logo] Error getting presigned URL:', error);
          }
        }
      }
      console.log('[Logo] Using URL as-is (already HTTP/HTTPS):', logoUrl);
      return logoUrl;
    }
    
    // If it's an S3 key (e.g., "lots/image.jpg"), get presigned URL
    if (logoUrl.includes('/') && !logoUrl.startsWith('/')) {
      console.log('[Logo] Detected S3 key, fetching presigned URL for:', logoUrl);
      try {
        const response = await fetch('/api/images/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: [logoUrl] })
        });
        if (response.ok) {
          const { urls } = await response.json();
          const presignedUrl = urls[logoUrl] || logoUrl;
          console.log('[Logo] Got presigned URL for key:', presignedUrl);
          return presignedUrl;
        } else {
          console.warn('[Logo] Failed to get presigned URL, status:', response.status);
          const errorText = await response.text();
          console.warn('[Logo] Error response:', errorText);
        }
      } catch (error) {
        console.error('[Logo] Error getting presigned URL for logo:', error);
      }
    }
    
    // Fallback: assume it's a local URL
    const fallbackUrl = logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
    console.log('[Logo] Using fallback URL:', fallbackUrl);
    return fallbackUrl;
  }

  // Draw logo on banner
  async function drawWatermark(ctx, width, height) {
    if (!bannerSettings.showWatermark) {
      return;
    }
    
    // Determine watermark URL
    let watermarkUrl = null;
    if (bannerSettings.watermarkUseLogo) {
      // Use logo as watermark
      watermarkUrl = bannerSettings.useCustomLogo && bannerSettings.logoUrl 
        ? bannerSettings.logoUrl 
        : (auctionHouse?.logoUrl);
    } else {
      // Use custom watermark URL
      watermarkUrl = bannerSettings.watermarkUrl;
    }
    
    if (!watermarkUrl) {
      return;
    }
    
    // Get the actual image URL (handles S3 keys)
    const imageUrl = await getLogoImageUrl(watermarkUrl);
    if (!imageUrl) {
      return;
    }
    
    return new Promise(async (resolve) => {
      // Use the same image loading approach as other images (with proxy for CORS)
      let srcUrl = imageUrl;
      
      // For S3 URLs, use proxy to avoid CORS issues
      if (imageUrl.includes('.s3.') || imageUrl.includes('s3.amazonaws.com') || imageUrl.includes('?X-Amz-')) {
        try {
          const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(imageUrl)}`;
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const blob = await response.blob();
            srcUrl = URL.createObjectURL(blob);
          }
        } catch (error) {
          console.warn('[Watermark] Error using proxy, trying direct URL:', error);
        }
      }
      
      const img = new Image();
      if (!srcUrl.startsWith('blob:') && !srcUrl.includes('/api/images/proxy')) {
        img.crossOrigin = 'anonymous';
      }
      
      img.onload = () => {
        // For tile mode, save context and ensure full canvas access
        ctx.save();
        
        // Set opacity
        ctx.globalAlpha = bannerSettings.watermarkOpacity || 0.1;
        
        // Calculate watermark size maintaining aspect ratio
        const watermarkSize = bannerSettings.watermarkSize || 300;
        const aspectRatio = img.width / img.height;
        let watermarkWidth = watermarkSize;
        let watermarkHeight = watermarkSize / aspectRatio;
        
        // If height would be too large, scale down
        if (watermarkHeight > watermarkSize) {
          watermarkHeight = watermarkSize;
          watermarkWidth = watermarkSize * aspectRatio;
        }
        
        // Handle tile mode separately to ensure full canvas coverage
        if (bannerSettings.watermarkPosition === 'tile') {
          // Reset clipping to full canvas for tile mode
          ctx.beginPath();
          ctx.rect(0, 0, width, height);
          ctx.clip();
          
          // Tile the watermark across the entire banner
          // Use spacing that ensures good coverage
          const spacing = watermarkWidth * 1.5;
          // Start from negative offset to ensure coverage at edges, extend beyond canvas
          const startX = -watermarkWidth;
          const startY = -watermarkHeight;
          const endX = width + watermarkWidth;
          const endY = height + watermarkHeight;
          
          for (let tileX = startX; tileX < endX; tileX += spacing) {
            for (let tileY = startY; tileY < endY; tileY += spacing) {
              ctx.save();
              ctx.translate(tileX + watermarkWidth / 2, tileY + watermarkHeight / 2);
              ctx.rotate((bannerSettings.watermarkRotation || 0) * Math.PI / 180);
              ctx.drawImage(img, -watermarkWidth / 2, -watermarkHeight / 2, watermarkWidth, watermarkHeight);
              ctx.restore();
            }
          }
          ctx.restore();
          if (srcUrl.startsWith('blob:')) {
            URL.revokeObjectURL(srcUrl);
          }
          resolve();
          return;
        }
        
        // Calculate position based on watermarkPosition setting (non-tile modes)
        let x = 0;
        let y = 0;
        
        switch (bannerSettings.watermarkPosition) {
          case 'center':
            x = (width - watermarkWidth) / 2;
            y = (height - watermarkHeight) / 2;
            break;
          case 'top-left':
            x = 0;
            y = 0;
            break;
          case 'top-right':
            x = width - watermarkWidth;
            y = 0;
            break;
          case 'bottom-left':
            x = 0;
            y = height - watermarkHeight;
            break;
          case 'bottom-right':
            x = width - watermarkWidth;
            y = height - watermarkHeight;
            break;
        }
        
        // Apply rotation if specified
        if (bannerSettings.watermarkRotation) {
          ctx.translate(x + watermarkWidth / 2, y + watermarkHeight / 2);
          ctx.rotate((bannerSettings.watermarkRotation || 0) * Math.PI / 180);
          ctx.translate(-watermarkWidth / 2, -watermarkHeight / 2);
          x = 0;
          y = 0;
        }
        
        // Draw watermark
        ctx.drawImage(img, x, y, watermarkWidth, watermarkHeight);
        
        ctx.restore();
        
        // Clean up blob URL if it was created
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        
        resolve();
      };
      
      img.onerror = () => {
        console.warn('[Watermark] Failed to load watermark image');
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        resolve();
      };
      
      img.src = srcUrl;
    });
  }

  async function drawLogo(ctx, width, height) {
    if (!bannerSettings.showLogo) {
      console.log('[Logo] showLogo is false, skipping');
      return;
    }
    
    // Use custom logo URL if specified, otherwise use auction house logo
    const logoUrl = bannerSettings.useCustomLogo && bannerSettings.logoUrl 
      ? bannerSettings.logoUrl 
      : (auctionHouse?.logoUrl);
    
    console.log('[Logo] Logo URL from settings:', logoUrl);
    console.log('[Logo] useCustomLogo:', bannerSettings.useCustomLogo);
    console.log('[Logo] bannerSettings.logoUrl:', bannerSettings.logoUrl);
    console.log('[Logo] auctionHouse?.logoUrl:', auctionHouse?.logoUrl);
    
    if (!logoUrl) {
      console.warn('[Logo] No logo URL available');
      return;
    }
    
    // Get the actual image URL (handles S3 keys)
    const imageUrl = await getLogoImageUrl(logoUrl);
    console.log('[Logo] Resolved image URL:', imageUrl);
    
    if (!imageUrl) {
      console.warn('[Logo] Failed to resolve image URL');
      return;
    }
    
    return new Promise(async (resolve) => {
      // Use the same image loading approach as other images (with proxy for CORS)
      let srcUrl = imageUrl;
      
      // For S3 URLs, use proxy to avoid CORS issues (same as loadImageForCanvas)
      if (imageUrl.includes('.s3.') || imageUrl.includes('s3.amazonaws.com') || imageUrl.includes('?X-Amz-')) {
        try {
          const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(imageUrl)}`;
          console.log('[Logo] Using proxy URL for CORS:', proxyUrl);
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const blob = await response.blob();
            srcUrl = URL.createObjectURL(blob);
            console.log('[Logo] Created blob URL from proxy');
          } else {
            console.warn('[Logo] Proxy failed, using direct URL');
          }
        } catch (error) {
          console.warn('[Logo] Error using proxy, trying direct URL:', error);
        }
      }
      
      const img = new Image();
      // Don't set crossOrigin when using proxy or blob URLs
      if (!srcUrl.startsWith('blob:') && !srcUrl.includes('/api/images/proxy')) {
        img.crossOrigin = 'anonymous';
      }
      
      img.onload = () => {
        console.log('[Logo] Image loaded successfully, dimensions:', img.width, 'x', img.height);
        ctx.save();
        
        // Calculate logo size maintaining aspect ratio
        const maxSize = bannerSettings.logoSize || 100;
        const aspectRatio = img.width / img.height;
        let logoWidth = maxSize;
        let logoHeight = maxSize / aspectRatio;
        
        // If height would be too large, scale down
        if (logoHeight > maxSize) {
          logoHeight = maxSize;
          logoWidth = maxSize * aspectRatio;
        }
        
        console.log('[Logo] Calculated size:', logoWidth, 'x', logoHeight);
        
        // Calculate position based on logoPosition setting
        const margin = bannerSettings.logoMargin || 20;
        let x = 0;
        let y = 0;
        
        switch (bannerSettings.logoPosition) {
          case 'top-left':
            x = margin;
            y = margin;
            break;
          case 'top-center':
            x = (width - logoWidth) / 2;
            y = margin;
            break;
          case 'top-right':
            x = width - logoWidth - margin;
            y = margin;
            break;
          case 'bottom-left':
            x = margin;
            y = height - logoHeight - margin;
            break;
          case 'bottom-center':
            x = (width - logoWidth) / 2;
            y = height - logoHeight - margin;
            break;
          case 'bottom-right':
            x = width - logoWidth - margin;
            y = height - logoHeight - margin;
            break;
          default:
            x = width - logoWidth - margin;
            y = margin;
        }
        
        console.log('[Logo] Drawing at position:', x, y, 'with size:', logoWidth, logoHeight);
        
        // Set opacity
        ctx.globalAlpha = bannerSettings.logoOpacity !== undefined ? bannerSettings.logoOpacity : 1.0;
        console.log('[Logo] Opacity:', ctx.globalAlpha);
        
        // Draw logo
        ctx.drawImage(img, x, y, logoWidth, logoHeight);
        console.log('[Logo] Logo drawn successfully');
        
        // Clean up blob URL if it was created
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        
        ctx.restore();
        resolve();
      };
      
      img.onerror = (error) => {
        console.error('[Logo] Failed to load logo image:', imageUrl, error);
        console.error('[Logo] Image error details:', {
          src: img.src,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          srcUrl: srcUrl
        });
        
        // Clean up blob URL if it was created
        if (srcUrl.startsWith('blob:')) {
          URL.revokeObjectURL(srcUrl);
        }
        
        resolve(); // Continue even if logo fails to load
      };
      
      console.log('[Logo] Setting image source to:', srcUrl);
      img.src = srcUrl;
    });
  }

  // Format font string for canvas (quotes font names with spaces)
  function formatFontForCanvas(fontFamily, fontSize, weight = 'normal') {
    // Split by comma to get primary font and fallbacks
    const parts = fontFamily.split(',').map(p => p.trim());
    const primaryFont = parts[0];
    const fallbacks = parts.slice(1);
    
    // Quote the primary font name if it contains spaces
    const quotedPrimary = primaryFont.includes(' ') ? `"${primaryFont}"` : primaryFont;
    
    // Combine with fallbacks
    const fullFamily = fallbacks.length > 0 
      ? `${quotedPrimary}, ${fallbacks.join(', ')}`
      : quotedPrimary;
    
    return `${weight} ${fontSize}px ${fullFamily}`;
  }

  // Draw separator with different styles
  function drawSeparator(ctx, x, y, width, settings, isVertical = false) {
    ctx.save();
    const separatorColor = settings.separatorColor || settings.textColor;
    ctx.strokeStyle = separatorColor;
    ctx.fillStyle = separatorColor;
    ctx.lineWidth = settings.separatorThickness || 2;
    
    const size = isVertical ? width : width; // For vertical separators, width is the size
    
    switch (settings.separatorStyle) {
      case 'line':
        ctx.beginPath();
        if (isVertical) {
          ctx.moveTo(x + size / 2, y - size / 2);
          ctx.lineTo(x + size / 2, y + size / 2);
        } else {
          ctx.moveTo(x, y);
          ctx.lineTo(x + width, y);
        }
        ctx.stroke();
        break;
      case 'dotted':
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        if (isVertical) {
          ctx.moveTo(x + size / 2, y - size / 2);
          ctx.lineTo(x + size / 2, y + size / 2);
        } else {
          ctx.moveTo(x, y);
          ctx.lineTo(x + width, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      case 'double':
        ctx.beginPath();
        if (isVertical) {
          ctx.moveTo(x + size / 2 - 3, y - size / 2);
          ctx.lineTo(x + size / 2 - 3, y + size / 2);
          ctx.moveTo(x + size / 2 + 3, y - size / 2);
          ctx.lineTo(x + size / 2 + 3, y + size / 2);
        } else {
          ctx.moveTo(x, y - 3);
          ctx.lineTo(x + width, y - 3);
          ctx.moveTo(x, y + 3);
          ctx.lineTo(x + width, y + 3);
        }
        ctx.stroke();
        break;
      case 'diamond':
        const diamondSize = isVertical ? size : Math.min(size, width * 0.1); // For horizontal, use reasonable size
        ctx.save();
        ctx.translate(x + (isVertical ? size / 2 : width / 2), y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-diamondSize / 2, -diamondSize / 2, diamondSize, diamondSize);
        ctx.restore();
        break;
      case 'circle':
        const circleSize = isVertical ? size : Math.min(size, width * 0.1); // For horizontal, use reasonable size
        ctx.beginPath();
        ctx.arc(x + (isVertical ? size / 2 : width / 2), y, circleSize / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'square':
        const squareSize = isVertical ? size : Math.min(size, width * 0.1); // For horizontal, use reasonable size
        ctx.fillRect(x + (isVertical ? size / 2 - squareSize / 2 : (width - squareSize) / 2), y - squareSize / 2, squareSize, squareSize);
        break;
    }
    ctx.restore();
  }

  // Draw overlay stamp
  async function drawOverlayStamp(ctx, width, height) {
    if (!bannerSettings.showOverlayStamp || !bannerSettings.overlayStampUrl) {
      console.log('[Overlay Stamp] Not drawing - showOverlayStamp:', bannerSettings.showOverlayStamp, 'url:', bannerSettings.overlayStampUrl);
      return;
    }
    
    console.log('[Overlay Stamp] Drawing stamp:', bannerSettings.overlayStampUrl);
    
    try {
      const imageSrc = await loadImageForCanvas(bannerSettings.overlayStampUrl);
      console.log('[Overlay Stamp] Loaded image source:', imageSrc);
      
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          console.log('[Overlay Stamp] Image loaded, dimensions:', img.width, 'x', img.height);
          ctx.save();
          
          // Calculate position
          let x, y;
          const stampSize = bannerSettings.overlayStampSize || 200;
          const margin = 20;
          
          if (bannerSettings.overlayStampPosition === 'custom') {
            x = (bannerSettings.overlayStampX / 100) * width;
            y = (bannerSettings.overlayStampY / 100) * height;
          } else {
            switch (bannerSettings.overlayStampPosition) {
              case 'top-left':
                x = margin;
                y = margin;
                break;
              case 'top-center':
                x = (width - stampSize) / 2;
                y = margin;
                break;
              case 'top-right':
                x = width - stampSize - margin;
                y = margin;
                break;
              case 'center':
                x = (width - stampSize) / 2;
                y = (height - stampSize) / 2;
                break;
              case 'bottom-left':
                x = margin;
                y = height - stampSize - margin;
                break;
              case 'bottom-center':
                x = (width - stampSize) / 2;
                y = height - stampSize - margin;
                break;
              case 'bottom-right':
                x = width - stampSize - margin;
                y = height - stampSize - margin;
                break;
              default:
                x = (width - stampSize) / 2;
                y = (height - stampSize) / 2;
            }
          }
          
          // Apply alignment offset
          const aspectRatio = img.width / img.height;
          let drawWidth = stampSize;
          let drawHeight = stampSize / aspectRatio;
          
          switch (bannerSettings.overlayStampAlignment) {
            case 'top-left':
              // x, y already set
              break;
            case 'top-center':
              x -= drawWidth / 2;
              break;
            case 'top-right':
              x -= drawWidth;
              break;
            case 'center':
              x -= drawWidth / 2;
              y -= drawHeight / 2;
              break;
            case 'bottom-left':
              y -= drawHeight;
              break;
            case 'bottom-center':
              x -= drawWidth / 2;
              y -= drawHeight;
              break;
            case 'bottom-right':
              x -= drawWidth;
              y -= drawHeight;
              break;
          }
          
          // Set opacity
          ctx.globalAlpha = bannerSettings.overlayStampOpacity !== undefined ? bannerSettings.overlayStampOpacity : 0.5;
          
          // Apply rotation
          const centerX = x + drawWidth / 2;
          const centerY = y + drawHeight / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((bannerSettings.overlayStampRotation || 0) * Math.PI / 180);
          ctx.translate(-centerX, -centerY);
          
          // Draw stamp
          console.log('[Overlay Stamp] Drawing at:', x, y, 'size:', drawWidth, 'x', drawHeight, 'opacity:', ctx.globalAlpha, 'rotation:', bannerSettings.overlayStampRotation);
          ctx.drawImage(img, x, y, drawWidth, drawHeight);
          
          ctx.globalAlpha = 1.0; // Reset opacity
          ctx.restore();
          
          console.log('[Overlay Stamp] Stamp drawn successfully');
          if (imageSrc.startsWith('blob:')) {
            URL.revokeObjectURL(imageSrc);
          }
          resolve();
        };
        
        img.onerror = (error) => {
          console.error('[Overlay Stamp] Failed to load image:', error, 'src:', imageSrc);
          if (imageSrc.startsWith('blob:')) {
            URL.revokeObjectURL(imageSrc);
          }
          resolve();
        };
        
        console.log('[Overlay Stamp] Setting image source to:', imageSrc);
        img.src = imageSrc;
      });
    } catch (error) {
      console.error('Error loading overlay stamp:', error);
    }
  }

  async function drawCollage(ctx, width, height, images) {
    if (images.length === 0) {
      console.warn('No images for drawCollage');
      return;
    }
    
    console.log('Loading collage images:', images);
    
    const loadedImages = await Promise.all(
      images.map(async (imageData, originalIndex) => {
        if (!imageData?.url) return null;
        const srcUrl = await loadImageForCanvas(imageData.url);
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            console.log('Collage image loaded:', imageData.url);
            resolve({
              img,
              orientation: imageData.orientation,
              zoom: imageData.zoom ?? bannerSettings.imageSize ?? 1.0,
              zIndex: imageData.zIndex ?? originalIndex,
              originalIndex // Keep original index for reference
            });
          };
          img.onerror = (error) => {
            console.error('Failed to load collage image:', imageData.url, error);
            if (srcUrl.startsWith('blob:')) {
              URL.revokeObjectURL(srcUrl);
            }
            resolve(null);
          };
          img.src = srcUrl;
        });
      })
    );
    
    const validImages = loadedImages.filter(img => img !== null);
    if (validImages.length === 0) return;
    
    // Sort images by z-index (lower z-index drawn first, so higher z-index appears on top)
    validImages.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    
    // Determine image area based on collage settings
    const imageSide = bannerSettings.collageImageSide || 'right';
    const splitStyle = bannerSettings.collageSplitStyle || 'vertical';
    const textAreaWidth = width * bannerSettings.textImageRatio;
    const imgAreaWidth = width - textAreaWidth;
    
    let imgAreaX, imgAreaY, imgAreaHeight;
    
    if (splitStyle === 'vertical') {
      // Vertical split
      imgAreaX = imageSide === 'right' ? textAreaWidth : 0;
      imgAreaY = 0;
      imgAreaHeight = height;
    } else {
      // Diagonal split - images fill the non-text area
      imgAreaX = imageSide === 'right' ? textAreaWidth : 0;
      imgAreaY = 0;
      imgAreaHeight = height;
      
      // Clip to diagonal shape
      ctx.save();
      ctx.beginPath();
      if (splitStyle === 'diagonal-forward') {
        // Forward slash: /
        if (imageSide === 'right') {
          // Images on right, diagonal from top-left to bottom-right
          ctx.moveTo(textAreaWidth, 0);
          ctx.lineTo(width, 0);
          ctx.lineTo(width, height);
          ctx.lineTo(width * bannerSettings.textImageRatio, height);
        } else {
          // Images on left, diagonal from top-right to bottom-left
          ctx.moveTo(0, 0);
          ctx.lineTo(imgAreaWidth, 0);
          ctx.lineTo(0, height);
          ctx.lineTo(0, height);
        }
      } else if (splitStyle === 'diagonal-backward') {
        // Backward slash: \
        if (imageSide === 'right') {
          // Images on right, diagonal from top-right to bottom-left
          ctx.moveTo(textAreaWidth, 0);
          ctx.lineTo(width, 0);
          ctx.lineTo(width - (width * bannerSettings.textImageRatio), height);
          ctx.lineTo(textAreaWidth, height);
        } else {
          // Images on left, diagonal from top-left to bottom-right
          ctx.moveTo(0, 0);
          ctx.lineTo(imgAreaWidth, 0);
          ctx.lineTo(imgAreaWidth, height);
          ctx.lineTo(0, height);
        }
      }
      ctx.closePath();
      ctx.clip();
    }
    
    // Helper function to calculate alignment offset
    function getAlignmentOffset(alignment, areaWidth, areaHeight, itemWidth, itemHeight) {
      let offsetX = 0;
      let offsetY = 0;
      
      if (alignment.includes('left')) {
        offsetX = 0;
      } else if (alignment.includes('right')) {
        offsetX = areaWidth - itemWidth;
      } else {
        offsetX = (areaWidth - itemWidth) / 2; // center
      }
      
      if (alignment.includes('top')) {
        offsetY = 0;
      } else if (alignment.includes('bottom')) {
        offsetY = areaHeight - itemHeight;
      } else {
        offsetY = (areaHeight - itemHeight) / 2; // center
      }
      
      return { offsetX, offsetY };
    }
    
    // Custom layout: use user-defined positions (default to custom if positions exist)
    if ((bannerSettings.collageLayout === 'custom' || bannerSettings.collageImagePositions.length > 0) && bannerSettings.collageImagePositions.length > 0) {
      validImages.forEach((imageData, index) => {
        const { img, orientation, zoom } = imageData;
        const customPos = bannerSettings.collageImagePositions[imageData.originalIndex ?? index];
        if (!customPos) return;
        
        // Get per-image opacity (for collage, use per-image opacity)
        const imageOpacity = imageData.opacity ?? bannerSettings.imageOpacity ?? 1.0;
        
        const baseSize = Math.min(imgAreaWidth, imgAreaHeight) * zoom;
        const scale = Math.min(baseSize / img.width, baseSize / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        
        // Convert percentage to pixel coordinates
        const x = imgAreaX + (imgAreaWidth * customPos.x / 100) - (drawWidth / 2);
        const y = (imgAreaHeight * customPos.y / 100) - (drawHeight / 2);
        
        ctx.save();
        // Apply per-image opacity for collage
        ctx.globalAlpha = imageOpacity;
        
        // Apply shadow before drawing
        applyImageShadow(ctx);
        
        ctx.translate(x + drawWidth / 2, y + drawHeight / 2);
        ctx.rotate((customPos.rotation || 0) * Math.PI / 180);
        
        // Apply per-image transformations
        if (orientation) {
          const rotationRad = (orientation.rotation * Math.PI) / 180;
          ctx.rotate(rotationRad);
          let scaleX = orientation.flipHorizontal ? -1 : 1;
          let scaleY = orientation.flipVertical ? -1 : 1;
          ctx.scale(scaleX, scaleY);
        }
        
        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
      });
      return;
    }
    
    // Grid layout
    if (bannerSettings.collageLayout === 'grid' || (bannerSettings.collageLayout === 'auto' && validImages.length >= 4)) {
      const cols = bannerSettings.collageLayout === 'grid' ? bannerSettings.collageGridColumns : Math.ceil(Math.sqrt(validImages.length));
      const rows = Math.ceil(validImages.length / cols);
      
      const spacing = bannerSettings.collageSpacing;
      const totalSpacing = spacing * (cols - 1);
      const totalSpacingV = spacing * (rows - 1);
      const cellWidth = (imgAreaWidth - totalSpacing) / cols;
      const cellHeight = (imgAreaHeight - totalSpacingV) / rows;
      
      validImages.forEach((imageData, index) => {
        const { img, orientation, zoom } = imageData;
        const originalIndex = imageData.originalIndex ?? index;
        const col = originalIndex % cols;
        const row = Math.floor(originalIndex / cols);
        const baseX = imgAreaX + col * (cellWidth + spacing);
        const baseY = row * (cellHeight + spacing);
        
        const scale = Math.min(cellWidth / img.width, cellHeight / img.height) * zoom;
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        
        // Apply alignment
        const align = getAlignmentOffset(bannerSettings.collageAlignment, cellWidth, cellHeight, drawWidth, drawHeight);
        const x = baseX + align.offsetX;
        const y = baseY + align.offsetY;
        
        ctx.save();
        applyImageShadow(ctx);
        applyImageTransform(ctx, img, x, y, drawWidth, drawHeight, orientation);
        ctx.restore();
      });
      return;
    }
    
    // Circle layout
    if (bannerSettings.collageLayout === 'circle' || (bannerSettings.collageLayout === 'auto' && validImages.length === 3)) {
      const centerX = imgAreaX + imgAreaWidth / 2;
      const centerY = imgAreaHeight / 2;
      const radius = Math.min(imgAreaWidth, imgAreaHeight) * bannerSettings.collageRadius;
      
      const imageData = validImages.map((imageData, sortedIndex) => {
        const { img, orientation, zoom, originalIndex } = imageData;
        const baseSize = Math.min(imgAreaWidth, imgAreaHeight) * zoom;
        const scale = Math.min(baseSize / img.width, baseSize / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        
        // Use original index for positioning to maintain layout
        const positionIndex = originalIndex ?? sortedIndex;
        const angle = (positionIndex * 2 * Math.PI / validImages.length) - Math.PI / 2;
        const baseX = centerX + Math.cos(angle) * radius;
        const baseY = centerY + Math.sin(angle) * radius;
        const rotation = angle + Math.PI / 2;
        
        const behindIndex = (positionIndex + validImages.length - 1) % validImages.length;
        const behindAngle = (behindIndex * 2 * Math.PI / validImages.length) - Math.PI / 2;
        const offsetX = Math.cos(behindAngle) * bannerSettings.collageSpacing;
        const offsetY = Math.sin(behindAngle) * bannerSettings.collageSpacing;
        
        return { img, drawWidth, drawHeight, x: baseX + offsetX, y: baseY + offsetY, rotation, sortedIndex, orientation, zIndex: imageData.zIndex };
      });
      
      // Draw in z-index order (already sorted, but maintain for clarity)
      imageData.forEach((data) => {
        ctx.save();
        
        // Apply configurable shadow
        applyImageShadow(ctx);
        
        ctx.translate(data.x, data.y);
        ctx.rotate(data.rotation);
        
        if (data.orientation) {
          const rotationRad = (data.orientation.rotation * Math.PI) / 180;
          ctx.rotate(rotationRad);
          let scaleX = data.orientation.flipHorizontal ? -1 : 1;
          let scaleY = data.orientation.flipVertical ? -1 : 1;
          ctx.scale(scaleX, scaleY);
        }
        
        ctx.drawImage(data.img, -data.drawWidth / 2, -data.drawHeight / 2, data.drawWidth, data.drawHeight);
        ctx.restore();
      });
      return;
    }
    
    // Stacked layout
    if (bannerSettings.collageLayout === 'stacked') {
      const spacing = bannerSettings.collageSpacing;
      
      validImages.forEach((imageData, sortedIndex) => {
        const { img, orientation, zoom, originalIndex } = imageData;
        const baseSize = Math.min(imgAreaWidth, imgAreaHeight) * zoom;
        const scale = Math.min(baseSize / img.width, baseSize / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        
        // Use original index for offset to maintain visual stacking
        const positionIndex = originalIndex ?? sortedIndex;
        const offsetX = positionIndex * spacing * 0.3;
        const offsetY = positionIndex * spacing * 0.3;
        const align = getAlignmentOffset(bannerSettings.collageAlignment, imgAreaWidth, imgAreaHeight, drawWidth, drawHeight);
        const x = imgAreaX + align.offsetX + offsetX;
        const y = align.offsetY + offsetY;
        
        ctx.save();
        ctx.shadowColor = `rgba(0, 0, 0, ${0.1 + (imageData.zIndex ?? sortedIndex) * 0.05})`;
        ctx.shadowBlur = 10 + (imageData.zIndex ?? sortedIndex) * 2;
        ctx.shadowOffsetX = 3 + (imageData.zIndex ?? sortedIndex);
        ctx.shadowOffsetY = 3 + (imageData.zIndex ?? sortedIndex);
        applyImageTransform(ctx, img, x, y, drawWidth, drawHeight, orientation);
        ctx.restore();
      });
      return;
    }
    
    // Diagonal layout
    if (bannerSettings.collageLayout === 'diagonal') {
      const spacing = bannerSettings.collageSpacing;
      
      validImages.forEach((imageData, sortedIndex) => {
        const { img, orientation, zoom, originalIndex } = imageData;
        const baseSize = Math.min(imgAreaWidth, imgAreaHeight) * zoom;
        const scale = Math.min(baseSize / img.width, baseSize / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        
        // Use original index for positioning to maintain layout
        const positionIndex = originalIndex ?? sortedIndex;
        const progress = validImages.length > 1 ? positionIndex / (validImages.length - 1) : 0.5;
        const x = imgAreaX + (imgAreaWidth - drawWidth) * progress;
        const y = (imgAreaHeight - drawHeight) * (1 - progress);
        
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        applyImageTransform(ctx, img, x, y, drawWidth, drawHeight, orientation);
        ctx.restore();
      });
      return;
    }
    
    // Scattered layout
    if (bannerSettings.collageLayout === 'scattered') {
      validImages.forEach((imageData, sortedIndex) => {
        const { img, orientation, zoom, originalIndex } = imageData;
        const baseSize = Math.min(imgAreaWidth, imgAreaHeight) * zoom;
        const scale = Math.min(baseSize / img.width, baseSize / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        
        // Use original index for positioning to maintain layout
        const positionIndex = originalIndex ?? sortedIndex;
        // Random-ish but deterministic positions based on original index
        const seed = positionIndex * 137.508; // Golden angle approximation
        const angle = seed % (Math.PI * 2);
        const distance = (imgAreaWidth * 0.3) * (0.3 + (positionIndex % 3) * 0.2);
        const centerX = imgAreaX + imgAreaWidth / 2;
        const centerY = imgAreaHeight / 2;
        const x = centerX + Math.cos(angle) * distance - drawWidth / 2;
        const y = centerY + Math.sin(angle) * distance - drawHeight / 2;
        
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.translate(x + drawWidth / 2, y + drawHeight / 2);
        ctx.rotate((angle * 180 / Math.PI) * 0.1); // Slight rotation
        applyImageTransform(ctx, img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight, orientation);
        ctx.restore();
      });
      return;
    }
    
    // Auto layout (original logic for 1, 2, 3, 4+ images)
    if (validImages.length === 1) {
      const { img, orientation, zoom } = validImages[0];
      const baseSize = Math.min(imgAreaWidth, imgAreaHeight) * zoom;
      const scale = Math.min(baseSize / img.width, baseSize / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const x = imgAreaX + (imgAreaWidth - drawWidth) / 2;
      const y = (imgAreaHeight - drawHeight) / 2;
      applyImageTransform(ctx, img, x, y, drawWidth, drawHeight, orientation);
    } else if (validImages.length === 2) {
      // 2 images: first image bottom left, second slightly behind it on top right
      const { img: img1, orientation: orientation1, zoom: zoom1 } = validImages[0];
      const { img: img2, orientation: orientation2, zoom: zoom2 } = validImages[1];
      
      // Calculate sizes - use per-image zoom
      const baseSize1 = Math.min(imgAreaWidth, imgAreaHeight) * zoom1;
      const baseSize2 = Math.min(imgAreaWidth, imgAreaHeight) * zoom2;
      
      // Scale each image to fit, maintaining aspect ratio
      const scale1 = Math.min(baseSize1 / img1.width, baseSize1 / img1.height);
      const scale2 = Math.min(baseSize2 / img2.width, baseSize2 / img2.height);
      
      const drawWidth1 = img1.width * scale1;
      const drawHeight1 = img1.height * scale1;
      const drawWidth2 = img2.width * scale2;
      const drawHeight2 = img2.height * scale2;
      
      // First image: bottom left with better positioning
      const x1 = imgAreaX + imgAreaWidth * 0.08; // 8% from left
      const y1 = imgAreaHeight - drawHeight1 - imgAreaHeight * 0.08; // 8% from bottom
      
      // Second image: top right, slightly behind (offset and rotated)
      const offsetX = bannerSettings.collageSpacing; // Configurable spacing
      const offsetY = -bannerSettings.collageSpacing;
      const x2 = imgAreaX + imgAreaWidth * 0.55 - offsetX; // More to the right
      const y2 = imgAreaHeight * 0.08 - offsetY; // 8% from top
      
      // Add subtle shadow to second image for depth
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;
      
      // Draw second image first (behind), with slight rotation
      ctx.translate(x2 + drawWidth2 / 2, y2 + drawHeight2 / 2);
      ctx.rotate(-0.08); // Slightly more rotation (about 4.5 degrees)
      
      // Apply per-image transformations
      const rotationRad = ((orientation2?.rotation ?? 0) * Math.PI) / 180;
      ctx.rotate(rotationRad);
      let scaleX = orientation2?.flipHorizontal ? -1 : 1;
      let scaleY = orientation2?.flipVertical ? -1 : 1;
      ctx.scale(scaleX, scaleY);
      
      ctx.drawImage(img2, -drawWidth2 / 2, -drawHeight2 / 2, drawWidth2, drawHeight2);
      ctx.restore();
      
      // Draw first image on top (foreground) with per-image transformations and shadow
      ctx.save();
      applyImageShadow(ctx);
      applyImageTransform(ctx, img1, x1, y1, drawWidth1, drawHeight1, orientation1);
      ctx.restore();
      
    } else if (validImages.length === 3) {
      // 3 images: circular arrangement with each slightly behind the next
      // Layering: 2 behind 1, 3 behind 2, 1 behind 3 (circular)
      const centerX = imgAreaX + imgAreaWidth / 2;
      const centerY = imgAreaHeight / 2;
      const radius = Math.min(imgAreaWidth, imgAreaHeight) * bannerSettings.collageRadius; // Configurable radius
      
      // Prepare image data with positions
      const imageData = validImages.map((imageData, sortedIndex) => {
        const { img, orientation, zoom, originalIndex } = imageData;
        const baseSize = Math.min(imgAreaWidth, imgAreaHeight) * zoom;
        const scale = Math.min(baseSize / img.width, baseSize / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        
        // Use original index for positioning to maintain layout
        const positionIndex = originalIndex ?? sortedIndex;
        // Position in circle: 120 degrees apart (360/3)
        const angle = (positionIndex * 2 * Math.PI / 3) - Math.PI / 2; // Start from top
        const baseX = centerX + Math.cos(angle) * radius;
        const baseY = centerY + Math.sin(angle) * radius;
        
        // Rotation for each image (more dynamic tilt)
        const rotation = angle + Math.PI / 2 + (positionIndex % 2 === 0 ? 0.1 : -0.1); // Alternating slight tilt
        
        // Offset to create "behind" effect - each image is slightly offset inward
        // Image 1 is behind 3, Image 2 is behind 1, Image 3 is behind 2
        const behindIndex = (positionIndex + 2) % 3; // Which image this one is behind
        const behindAngle = (behindIndex * 2 * Math.PI / 3) - Math.PI / 2;
        const offsetX = Math.cos(behindAngle) * bannerSettings.collageSpacing; // Configurable spacing
        const offsetY = Math.sin(behindAngle) * bannerSettings.collageSpacing;
        
        return {
          img,
          drawWidth,
          drawHeight,
          x: baseX + offsetX,
          y: baseY + offsetY,
          rotation,
          sortedIndex,
          zIndex: imageData.zIndex ?? sortedIndex,
          orientation
        };
      });
      
      // Draw in z-index order (already sorted, but maintain for clarity)
      imageData.forEach((data) => {
        ctx.save();
        
        // Apply configurable shadow
        applyImageShadow(ctx);
        
        ctx.translate(data.x, data.y);
        ctx.rotate(data.rotation);
        
        // Apply per-image transformations on top of existing rotation
        if (data.orientation) {
          const rotationRad = (data.orientation.rotation * Math.PI) / 180;
          ctx.rotate(rotationRad);
          let scaleX = data.orientation.flipHorizontal ? -1 : 1;
          let scaleY = data.orientation.flipVertical ? -1 : 1;
          ctx.scale(scaleX, scaleY);
        }
        
        ctx.drawImage(data.img, -data.drawWidth / 2, -data.drawHeight / 2, data.drawWidth, data.drawHeight);
        ctx.restore();
      });
      
    } else {
      // 4+ images: Improved grid layout with spacing and shadows
      const cols = Math.ceil(Math.sqrt(validImages.length));
      const rows = Math.ceil(validImages.length / cols);
      
      // Add padding between images
      const padding = 8;
      const totalPadding = padding * (cols - 1);
      const totalPaddingV = padding * (rows - 1);
      const cellWidth = (imgAreaWidth - totalPadding) / cols;
      const cellHeight = (imgAreaHeight - totalPaddingV) / rows;
      
      validImages.forEach((imageData, sortedIndex) => {
        const { img, orientation, zoom, originalIndex } = imageData;
        // Use original index for positioning to maintain layout
        const positionIndex = originalIndex ?? sortedIndex;
        const col = positionIndex % cols;
        const row = Math.floor(positionIndex / cols);
        const x = imgAreaX + col * (cellWidth + padding);
        const y = row * (cellHeight + padding);
        
        // Scale to fit with some margin, using per-image zoom
        const margin = 4;
        const baseScale = Math.min(
          (cellWidth - margin * 2) / img.width,
          (cellHeight - margin * 2) / img.height
        );
        const scale = baseScale * zoom;
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const drawX = x + (cellWidth - drawWidth) / 2;
        const drawY = y + (cellHeight - drawHeight) / 2;
        
        // Apply per-image transformations with shadow
        ctx.save();
        applyImageShadow(ctx);
        applyImageTransform(ctx, img, drawX, drawY, drawWidth, drawHeight, orientation);
        ctx.restore();
      });
    }
    
    // Restore context if diagonal split was used
    if (splitStyle !== 'vertical') {
      ctx.restore();
    }
  }

  function drawText(ctx, width, height) {
    let textAreaWidth, textAreaX, textAreaY;
    
    // Determine text area based on layout
    if (bannerSettings.imageLayout === 'full' || bannerSettings.imageLayout === 'center') {
      // Text overlay on full image
      textAreaWidth = width;
      textAreaX = 0;
      textAreaY = 0;
    } else if (bannerSettings.imageLayout === 'right') {
      textAreaWidth = width * bannerSettings.textImageRatio;
      textAreaX = 0;
      textAreaY = 0;
    } else if (bannerSettings.imageLayout === 'left') {
      textAreaWidth = width * bannerSettings.textImageRatio;
      textAreaX = width - textAreaWidth;
      textAreaY = 0;
    } else if (bannerSettings.imageLayout === 'split') {
      textAreaWidth = width / 2;
      textAreaX = 0;
      textAreaY = 0;
    } else if (bannerSettings.imageLayout === 'collage') {
      // Collage layout - handle left/right positioning and diagonal splits
      const imageSide = bannerSettings.collageImageSide || 'right';
      const splitStyle = bannerSettings.collageSplitStyle || 'vertical';
      
      if (splitStyle === 'vertical') {
        textAreaWidth = width * bannerSettings.textImageRatio;
        textAreaX = imageSide === 'right' ? 0 : width - textAreaWidth;
        textAreaY = 0;
      } else {
        // Diagonal split - calculate based on ratio
        textAreaWidth = width * bannerSettings.textImageRatio;
        textAreaX = imageSide === 'right' ? 0 : width - textAreaWidth;
        textAreaY = 0;
      }
    } else {
      textAreaWidth = width * bannerSettings.textImageRatio;
      textAreaX = 0;
      textAreaY = 0;
    }
    
    // Draw text background
    if (bannerSettings.textBackground && bannerSettings.textBackgroundOpacity > 0) {
      ctx.save();
      if (bannerSettings.imageLayout === 'collage' && bannerSettings.collageSplitStyle !== 'vertical') {
        // Diagonal split - use path for diagonal clipping
        ctx.beginPath();
        const splitStyle = bannerSettings.collageSplitStyle;
        const imageSide = bannerSettings.collageImageSide || 'right';
        
        if (splitStyle === 'diagonal-forward') {
          // Forward slash: / (top-left to bottom-right)
          if (imageSide === 'right') {
            // Text on left, diagonal from top-left to bottom-right
            ctx.moveTo(0, 0);
            ctx.lineTo(textAreaWidth, 0);
            ctx.lineTo(width * bannerSettings.textImageRatio, height);
            ctx.lineTo(0, height);
          } else {
            // Text on right, diagonal from top-right to bottom-left
            ctx.moveTo(width - textAreaWidth, 0);
            ctx.lineTo(width, 0);
            ctx.lineTo(width, height);
            ctx.lineTo(width - (width * bannerSettings.textImageRatio), height);
          }
        } else if (splitStyle === 'diagonal-backward') {
          // Backward slash: \ (top-right to bottom-left)
          if (imageSide === 'right') {
            // Text on left, diagonal from top-right to bottom-left
            ctx.moveTo(0, 0);
            ctx.lineTo(textAreaWidth, 0);
            ctx.lineTo(0, height);
            ctx.lineTo(0, height);
          } else {
            // Text on right, diagonal from top-left to bottom-right
            ctx.moveTo(width - textAreaWidth, 0);
            ctx.lineTo(width, 0);
            ctx.lineTo(width - (width * bannerSettings.textImageRatio), height);
            ctx.lineTo(width - textAreaWidth, height);
          }
        }
        ctx.closePath();
        ctx.clip();
      }
      
      ctx.fillStyle = bannerSettings.textBackground;
      ctx.globalAlpha = bannerSettings.textBackgroundOpacity;
      if (bannerSettings.imageLayout === 'collage' && bannerSettings.collageSplitStyle !== 'vertical') {
        ctx.fill();
      } else {
        ctx.fillRect(textAreaX, textAreaY, textAreaWidth, height);
      }
      ctx.globalAlpha = 1.0;
      ctx.restore();
    }
    
    // Draw background pattern on text area if pattern is enabled
    if (bannerSettings.backgroundType === 'pattern' && bannerSettings.backgroundPattern !== 'none') {
      ctx.save();
      // Clip to text area
      if (bannerSettings.imageLayout === 'collage' && bannerSettings.collageSplitStyle !== 'vertical') {
        // Use same diagonal path as above
        ctx.beginPath();
        const splitStyle = bannerSettings.collageSplitStyle;
        const imageSide = bannerSettings.collageImageSide || 'right';
        
        if (splitStyle === 'diagonal-forward') {
          if (imageSide === 'right') {
            ctx.moveTo(0, 0);
            ctx.lineTo(textAreaWidth, 0);
            ctx.lineTo(width * bannerSettings.textImageRatio, height);
            ctx.lineTo(0, height);
          } else {
            ctx.moveTo(width - textAreaWidth, 0);
            ctx.lineTo(width, 0);
            ctx.lineTo(width, height);
            ctx.lineTo(width - (width * bannerSettings.textImageRatio), height);
          }
        } else if (splitStyle === 'diagonal-backward') {
          if (imageSide === 'right') {
            ctx.moveTo(0, 0);
            ctx.lineTo(textAreaWidth, 0);
            ctx.lineTo(0, height);
            ctx.lineTo(0, height);
          } else {
            ctx.moveTo(width - textAreaWidth, 0);
            ctx.lineTo(width, 0);
            ctx.lineTo(width - (width * bannerSettings.textImageRatio), height);
            ctx.lineTo(width - textAreaWidth, height);
          }
        }
        ctx.closePath();
        ctx.clip();
      } else {
        ctx.beginPath();
        ctx.rect(textAreaX, textAreaY, textAreaWidth, height);
        ctx.clip();
      }
      // Translate to text area origin and draw pattern
      ctx.translate(textAreaX, textAreaY);
      drawBackgroundPattern(ctx, textAreaWidth, height, bannerSettings.backgroundPattern);
      ctx.restore();
    }
    
    // Clip text area for diagonal splits
    if (bannerSettings.imageLayout === 'collage' && bannerSettings.collageSplitStyle !== 'vertical') {
      ctx.save();
      ctx.beginPath();
      const splitStyle = bannerSettings.collageSplitStyle;
      const imageSide = bannerSettings.collageImageSide || 'right';
      
      if (splitStyle === 'diagonal-forward') {
        if (imageSide === 'right') {
          ctx.moveTo(0, 0);
          ctx.lineTo(textAreaWidth, 0);
          ctx.lineTo(width * bannerSettings.textImageRatio, height);
          ctx.lineTo(0, height);
        } else {
          ctx.moveTo(width - textAreaWidth, 0);
          ctx.lineTo(width, 0);
          ctx.lineTo(width, height);
          ctx.lineTo(width - (width * bannerSettings.textImageRatio), height);
        }
      } else if (splitStyle === 'diagonal-backward') {
        if (imageSide === 'right') {
          ctx.moveTo(0, 0);
          ctx.lineTo(textAreaWidth, 0);
          ctx.lineTo(0, height);
          ctx.lineTo(0, height);
        } else {
          ctx.moveTo(width - textAreaWidth, 0);
          ctx.lineTo(width, 0);
          ctx.lineTo(width - (width * bannerSettings.textImageRatio), height);
          ctx.lineTo(width - textAreaWidth, height);
        }
      }
      ctx.closePath();
      ctx.clip();
    }
    
    // Text settings
    ctx.fillStyle = bannerSettings.textColor;
    ctx.textBaseline = 'top';
    
    const padding = bannerSettings.padding;
    let currentY = height * 0.2;
    const centerX = textAreaX + textAreaWidth / 2;
    const leftX = textAreaX + padding;
    const rightX = textAreaX + textAreaWidth - padding;
    const maxTextWidth = textAreaWidth - (padding * 2);
    
    // Use flexible text elements if enabled
    if (bannerSettings.useFlexibleTextElements && bannerSettings.textElements) {
      // Sync content from mapped fields
      const enabledElements = bannerSettings.textElements
        .filter(el => el.enabled)
        .sort((a, b) => a.order - b.order);
      
      for (const element of enabledElements) {
        // Sync content from mapped field if not custom
        if (element.mappedField !== 'custom') {
          const fieldMap = {
            title: bannerSettings.title,
            titleHebrew: bannerSettings.titleHebrew,
            subtitle: bannerSettings.subtitle,
            subtitleHebrew: bannerSettings.subtitleHebrew,
            yearEnglish: bannerSettings.yearEnglish,
            yearHebrew: bannerSettings.yearHebrew,
            category: bannerSettings.category,
            categoryHebrew: bannerSettings.categoryHebrew,
          };
          if (fieldMap[element.mappedField] !== undefined) {
            element.content = fieldMap[element.mappedField] || '';
          }
        }
        
        if (!element.content) continue;
        
        // Apply margins
        currentY += element.marginTop || 0;
        
        // Calculate position
        const elementY = element.positionY !== null ? element.positionY : currentY;
        const elementX = element.align === 'center' ? centerX :
                        element.align === 'right' ? rightX : leftX;
        
        // Calculate available width (accounting for padding)
        const availableWidth = maxTextWidth - (element.paddingLeft || 0) - (element.paddingRight || 0);
        
        // Set font
        const fontFamily = element.language === 'hebrew' 
          ? (element.fontFamily || bannerSettings.hebrewFontFamily || 'Frank Ruhl Libre, Cardo, serif')
          : (element.fontFamily || bannerSettings.fontFamily || 'Cormorant Garamond, Times New Roman, serif');
        
        const fontWeight = element.fontWeight === 'bold' ? 'bold' : element.fontWeight || 'normal';
        ctx.font = formatFontForCanvas(fontFamily, element.fontSize, fontWeight);
        ctx.fillStyle = element.color || bannerSettings.textColor;
        ctx.textAlign = element.align || 'center';
        
        // Wrap text
        const textLines = wrapText(ctx, element.content, availableWidth);
        const lineHeight = element.lineHeight || 1.2;
        const fontSize = element.fontSize;
        
        // Apply padding
        const textStartX = elementX + (element.paddingLeft || 0) - (element.paddingRight || 0);
        const textStartY = elementY + (element.paddingTop || 0);
        
        // Draw text lines
        textLines.forEach((line, index) => {
          if (line.trim()) { // Only draw non-empty lines
            ctx.fillText(line, textStartX, textStartY + (index * fontSize * lineHeight));
          }
        });
        
        // Update currentY for next element
        const textHeight = textLines.length * fontSize * lineHeight;
        currentY = elementY + textHeight + (element.paddingTop || 0) + (element.paddingBottom || 0) + (element.marginBottom || 0);
      }
    } else {
      // Legacy text rendering
      // Title (English)
    if (bannerSettings.title) {
      const fontSize = bannerSettings.titleEnglishFontSize || bannerSettings.fontSize * 1.2;
      const textAlign = bannerSettings.titleEnglishAlign || bannerSettings.textAlign;
      const textX = textAlign === 'center' ? centerX : 
                    textAlign === 'right' ? rightX : leftX;
      
      const lineHeight = bannerSettings.textLineHeight ?? 1.2;
      ctx.font = formatFontForCanvas(bannerSettings.fontFamily, fontSize, 'bold');
      ctx.textAlign = textAlign;
      const titleLines = wrapText(ctx, bannerSettings.title, maxTextWidth);
      titleLines.forEach((line, index) => {
        ctx.fillText(line, textX, currentY + (index * fontSize * lineHeight));
      });
      currentY += titleLines.length * fontSize * lineHeight + (bannerSettings.textSpacingTitle ?? 20);
      
      // Text separator below English title
      if (bannerSettings.textSeparatorEnabled && bannerSettings.textSeparatorPosition === 'below-english') {
        // Add margin above separator
        const marginTop = bannerSettings.textSeparatorMarginTop || 10;
        currentY += marginTop;
        
        const separatorY = currentY;
        const separatorWidth = maxTextWidth * (bannerSettings.textSeparatorWidth / 100 || 0.6);
        
        // Calculate separator X position based on alignment
        let separatorX;
        if (bannerSettings.textSeparatorAlign === 'left') {
          separatorX = leftX;
        } else if (bannerSettings.textSeparatorAlign === 'right') {
          separatorX = rightX - separatorWidth;
        } else {
          separatorX = centerX - (separatorWidth / 2);
        }
        
        // Create settings object for separator drawing
        const separatorSettings = {
          separatorStyle: bannerSettings.textSeparatorStyle || 'line',
          separatorThickness: bannerSettings.textSeparatorThickness || 2,
          separatorColor: bannerSettings.textSeparatorColor || bannerSettings.textColor,
          textColor: bannerSettings.textColor
        };
        
        drawSeparator(ctx, separatorX, separatorY, separatorWidth, separatorSettings);
        
        // Add margin below separator
        const marginBottom = bannerSettings.textSeparatorMarginBottom || 15;
        currentY += marginBottom;
      }
    }
    
    // Decorative separator between English and Hebrew title
    if (bannerSettings.title && bannerSettings.titleHebrew) {
      // Add margin above separator
      const marginTop = bannerSettings.separatorMarginTop || 15;
      currentY += marginTop;
      
      const separatorY = currentY;
      const separatorWidth = maxTextWidth * (bannerSettings.separatorWidth / 100 || 0.6);
      
      // Calculate separator X position based on alignment
      let separatorX;
      if (bannerSettings.separatorAlignment === 'left') {
        separatorX = leftX;
      } else if (bannerSettings.separatorAlignment === 'right') {
        separatorX = rightX - separatorWidth;
      } else {
        separatorX = centerX - (separatorWidth / 2);
      }
      
      drawSeparator(ctx, separatorX, separatorY, separatorWidth, bannerSettings);
      
      // Add margin below separator
      const marginBottom = bannerSettings.separatorMarginBottom || 15;
      currentY += marginBottom;
    }
    
    // Title (Hebrew)
    if (bannerSettings.titleHebrew) {
      const fontSize = bannerSettings.titleHebrewFontSize || bannerSettings.fontSize * 1.2;
      const textAlign = bannerSettings.titleHebrewAlign || bannerSettings.textAlign;
      const textX = textAlign === 'center' ? centerX : 
                    textAlign === 'right' ? rightX : leftX;
      
      const lineHeight = bannerSettings.textLineHeight ?? 1.2;
      // Ensure font is properly formatted - extract primary font name
      const hebrewFont = bannerSettings.hebrewFontFamily || 'Frank Ruhl Libre, Cardo, serif';
      // Canvas requires font names with spaces to be quoted
      const fontString = formatFontForCanvas(hebrewFont, fontSize, 'bold');
      console.log('Setting Hebrew title font:', fontString, 'Current hebrewFontFamily:', bannerSettings.hebrewFontFamily);
      ctx.font = fontString;
      ctx.textAlign = textAlign;
      
      // Verify font was set correctly
      const actualFont = ctx.font;
      console.log('Actual canvas font after setting:', actualFont);
      const titleHebrewLines = wrapText(ctx, bannerSettings.titleHebrew, maxTextWidth);
      titleHebrewLines.forEach((line, index) => {
        ctx.fillText(line, textX, currentY + (index * fontSize * lineHeight));
      });
      currentY += titleHebrewLines.length * fontSize * lineHeight + (bannerSettings.textSpacingTitle ?? 20);
      
      // Text separator below Hebrew title
      if (bannerSettings.textSeparatorEnabled && bannerSettings.textSeparatorPosition === 'below-hebrew') {
        // Add margin above separator
        const marginTop = bannerSettings.textSeparatorMarginTop || 10;
        currentY += marginTop;
        
        const separatorY = currentY;
        const separatorWidth = maxTextWidth * (bannerSettings.textSeparatorWidth / 100 || 0.6);
        
        // Calculate separator X position based on alignment
        let separatorX;
        if (bannerSettings.textSeparatorAlign === 'left') {
          separatorX = leftX;
        } else if (bannerSettings.textSeparatorAlign === 'right') {
          separatorX = rightX - separatorWidth;
        } else {
          separatorX = centerX - (separatorWidth / 2);
        }
        
        // Create settings object for separator drawing
        const separatorSettings = {
          separatorStyle: bannerSettings.textSeparatorStyle || 'line',
          separatorThickness: bannerSettings.textSeparatorThickness || 2,
          separatorColor: bannerSettings.textSeparatorColor || bannerSettings.textColor,
          textColor: bannerSettings.textColor
        };
        
        drawSeparator(ctx, separatorX, separatorY, separatorWidth, separatorSettings);
        
        // Add margin below separator
        const marginBottom = bannerSettings.textSeparatorMarginBottom || 15;
        currentY += marginBottom;
      }
    }
    
    // Year (English and Hebrew) - Larger and more prominent, on same line with separator
    if (bannerSettings.yearEnglish || bannerSettings.yearHebrew) {
      ctx.textBaseline = 'middle';
      
      const englishFontSize = bannerSettings.yearEnglishFontSize || bannerSettings.fontSize * 1.8;
      const hebrewFontSize = bannerSettings.yearHebrewFontSize || bannerSettings.fontSize * 1.8;
      const yearAlign = bannerSettings.yearEnglishAlign || bannerSettings.yearHebrewAlign || 'center';
      const yearY = currentY + Math.max(englishFontSize, hebrewFontSize) / 2;
      
      // If both years exist, draw them separately with a decorative separator
      if (bannerSettings.yearEnglish && bannerSettings.yearHebrew) {
        // Measure text widths
        ctx.font = formatFontForCanvas(bannerSettings.fontFamily, englishFontSize, 'bold');
        const englishWidth = ctx.measureText(bannerSettings.yearEnglish).width;
        
        ctx.font = formatFontForCanvas(bannerSettings.hebrewFontFamily, hebrewFontSize, 'bold');
        const hebrewWidth = ctx.measureText(bannerSettings.yearHebrew).width;
        
        // Even spacing on both sides of separator
        const spacing = Math.max(englishFontSize, hebrewFontSize) * 0.3;
        const separatorSize = Math.max(englishFontSize, hebrewFontSize) * 0.15;
        const totalWidth = englishWidth + spacing + separatorSize + spacing + hebrewWidth;
        
        // Calculate start position based on alignment
        let startX;
        if (yearAlign === 'center') {
          startX = centerX - totalWidth / 2;
        } else if (yearAlign === 'right') {
          startX = rightX - totalWidth;
        } else {
          startX = leftX;
        }
        
        // Draw English year
        ctx.font = formatFontForCanvas(bannerSettings.fontFamily, englishFontSize, 'bold');
        ctx.textAlign = 'right';
        ctx.fillText(bannerSettings.yearEnglish, startX + englishWidth, yearY);
        
        // Draw decorative separator between the two years
        const separatorX = startX + englishWidth + spacing + separatorSize / 2;
        drawSeparator(ctx, separatorX - separatorSize / 2, yearY, separatorSize, bannerSettings, true);
        
        // Draw Hebrew year
        const hebrewFont = bannerSettings.hebrewFontFamily || 'Frank Ruhl Libre, Cardo, serif';
        ctx.font = formatFontForCanvas(hebrewFont, hebrewFontSize, 'bold');
        ctx.textAlign = 'left';
        ctx.fillText(bannerSettings.yearHebrew, startX + englishWidth + spacing + separatorSize + spacing, yearY);
      } else {
        // Single year
        const fontSize = bannerSettings.yearEnglish ? englishFontSize : hebrewFontSize;
        const fontFamily = bannerSettings.yearEnglish ? bannerSettings.fontFamily : bannerSettings.hebrewFontFamily;
        const yearText = bannerSettings.yearEnglish || bannerSettings.yearHebrew;
        const textX = yearAlign === 'center' ? centerX : 
                      yearAlign === 'right' ? rightX : leftX;
        
        ctx.font = formatFontForCanvas(fontFamily, fontSize, 'bold');
        ctx.textAlign = yearAlign;
        ctx.fillText(yearText, textX, yearY);
      }
      
      currentY += Math.max(englishFontSize, hebrewFontSize) * (bannerSettings.textLineHeight ?? 1.2) + (bannerSettings.textSpacingYear ?? 20);
    }
    
    // Reset text baseline
    ctx.textBaseline = 'top';
    
    // Subtitle (English)
    if (bannerSettings.subtitle) {
      const fontSize = bannerSettings.subtitleEnglishFontSize || bannerSettings.fontSize * 0.45;
      const textAlign = bannerSettings.subtitleEnglishAlign || bannerSettings.textAlign;
      const textX = textAlign === 'center' ? centerX : 
                    textAlign === 'right' ? rightX : leftX;
      const lineHeight = bannerSettings.textLineHeight ?? 1.2;
      
      ctx.font = formatFontForCanvas(bannerSettings.fontFamily, fontSize, 'normal');
      ctx.textAlign = textAlign;
      const subtitleLines = wrapText(ctx, bannerSettings.subtitle, maxTextWidth);
      subtitleLines.forEach((line, index) => {
        ctx.fillText(line, textX, currentY + (index * fontSize * lineHeight));
      });
      currentY += subtitleLines.length * fontSize * lineHeight + (bannerSettings.textSpacingSubtitle ?? 10);
    }
    
    // Subtitle (Hebrew)
    if (bannerSettings.subtitleHebrew) {
      const fontSize = bannerSettings.subtitleHebrewFontSize || bannerSettings.fontSize * 0.45;
      const textAlign = bannerSettings.subtitleHebrewAlign || bannerSettings.textAlign;
      const textX = textAlign === 'center' ? centerX : 
                    textAlign === 'right' ? rightX : leftX;
      const lineHeight = bannerSettings.textLineHeight ?? 1.2;
      
      // Ensure font is properly formatted
      const hebrewFont = bannerSettings.hebrewFontFamily || 'Frank Ruhl Libre, Cardo, serif';
      const fontString = formatFontForCanvas(hebrewFont, fontSize, 'normal');
      console.log('Setting Hebrew subtitle font:', fontString);
      ctx.font = fontString;
      ctx.textAlign = textAlign;
      const subtitleHebrewLines = wrapText(ctx, bannerSettings.subtitleHebrew, maxTextWidth);
      subtitleHebrewLines.forEach((line, index) => {
        ctx.fillText(line, textX, currentY + (index * fontSize * lineHeight));
      });
    }
    } // End of legacy text rendering
    
    // Ribbon in top corner (left or right)
    if (bannerSettings.category || bannerSettings.categoryHebrew) {
      ctx.save();
      
      // Measure text first to determine ribbon size
      let categoryText = '';
      if (bannerSettings.category) {
        categoryText = bannerSettings.category.toUpperCase();
      }
      if (bannerSettings.categoryHebrew) {
        if (categoryText) categoryText += ' / ';
        categoryText += bannerSettings.categoryHebrew;
      }
      
      // Set font and measure text width
      ctx.font = `bold ${bannerSettings.fontSize * 0.7}px ${bannerSettings.fontFamily}`;
      const textMetrics = ctx.measureText(categoryText);
      const textWidth = textMetrics.width;
      
      // Ribbon dimensions - bigger with negative margin for overflow effect
      const negativeMargin = 45; // How much ribbon extends beyond canvas
      const ribbonPadding = 40; // Minimal padding for better text centering
      // Add a minimum width if textWidth is less than a threshold
      const minRibbonWidth = 150; // Minimum ribbon width
      const calculatedWidth = (textWidth * 2) + (ribbonPadding * 2);
      const ribbonWidth = Math.max(calculatedWidth, minRibbonWidth);
      const ribbonHeight = 50; // Increased height
      
      // Determine angle and position based on ribbon position setting
      const ribbonPosition = bannerSettings.ribbonPosition || 'right';
      const isRight = ribbonPosition === 'right';
      const angle = isRight ? Math.PI / 4 : -Math.PI / 4; // 45 degrees for right, -45 for left
      
      // Position ribbon so it extends beyond the top corner
      // The ribbon should overflow the canvas edges to look like it's cut off
      const ribbonHalfWidth = ribbonWidth / 2;
      const ribbonHalfHeight = ribbonHeight / 2;
      
      // Calculate where the ribbon center should be so it extends beyond the corner
      // When rotated 45 degrees, the corner offset from center is:
      const cos45 = Math.cos(Math.abs(angle));
      const sin45 = Math.sin(Math.abs(angle));
      const cornerOffsetX = ribbonHalfWidth * cos45 - ribbonHalfHeight * sin45;
      const cornerOffsetY = ribbonHalfWidth * sin45 + ribbonHalfHeight * cos45;
      
      // Position center so ribbon extends beyond top corner of canvas by negativeMargin
      const ribbonCenterX = isRight 
        ? width + negativeMargin - cornerOffsetX  // Top right
        : -negativeMargin + cornerOffsetX;        // Top left
      const ribbonCenterY = -negativeMargin + cornerOffsetY;
      
      // Clip to canvas bounds for overflow cutoff effect
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      
      // Create ribbon path (diagonal ribbon shape)
      ctx.translate(ribbonCenterX, ribbonCenterY);
      ctx.rotate(angle);
      
      // Draw ribbon background with shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      
      // Ribbon shape (folded ribbon effect)
      ctx.fillStyle = bannerSettings.ribbonColor || '#DC2626';
      ctx.beginPath();
      
      // Main ribbon body (rounded rectangle)
      const cornerRadius = 5;
      const halfWidth = ribbonWidth / 2;
      const halfHeight = ribbonHeight / 2;
      
      // Draw rounded rectangle
      ctx.moveTo(-halfWidth + cornerRadius, -halfHeight);
      ctx.lineTo(halfWidth - cornerRadius, -halfHeight);
      ctx.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + cornerRadius);
      ctx.lineTo(halfWidth, halfHeight - cornerRadius);
      ctx.quadraticCurveTo(halfWidth, halfHeight, halfWidth - cornerRadius, halfHeight);
      ctx.lineTo(-halfWidth + cornerRadius, halfHeight);
      ctx.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - cornerRadius);
      ctx.lineTo(-halfWidth, -halfHeight + cornerRadius);
      ctx.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + cornerRadius, -halfHeight);
      ctx.closePath();
      ctx.fill();
      
      // Add fold effect on top left
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.moveTo(-halfWidth, -halfHeight);
      ctx.lineTo(-halfWidth + 20, -halfHeight - 5);
      ctx.lineTo(-halfWidth + 40, -halfHeight);
      ctx.closePath();
      ctx.fill();
      
      // Add fold effect on bottom right
      ctx.beginPath();
      ctx.moveTo(halfWidth, halfHeight);
      ctx.lineTo(halfWidth - 20, halfHeight + 5);
      ctx.lineTo(halfWidth - 40, halfHeight);
      ctx.closePath();
      ctx.fill();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Draw text on ribbon (always white for contrast)
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${bannerSettings.fontSize * 0.7}px ${bannerSettings.fontFamily}`;
      ctx.fillText(categoryText, 0, 0);
      
      ctx.restore();
    }
    
    // Bottom Border with Auction Info
    if (bannerSettings.showBottomBorder) {
      ctx.save();
      
      const borderHeight = bannerSettings.bottomBorderHeight || 70;
      const borderPosition = bannerSettings.bottomBorderPosition || 'bottom';
      
      // Draw border background based on position
      ctx.fillStyle = bannerSettings.bottomBorderColor || '#2563EB';
      
      if (borderPosition === 'top' || borderPosition === 'bottom') {
        // Horizontal border (top or bottom)
        const borderY = borderPosition === 'top' ? 0 : height - borderHeight;
        ctx.fillRect(0, borderY, width, borderHeight);
      } else {
        // Vertical border (left or right)
        const borderWidth = borderHeight; // Use height setting as width for vertical borders
        const borderX = borderPosition === 'left' ? 0 : width - borderWidth;
        ctx.fillRect(borderX, 0, borderWidth, height);
      }
      
      // Draw text (white for contrast)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${bannerSettings.fontSize * 0.5}px ${bannerSettings.fontFamily}`;
      
      // Build text content
      let borderText = '';
      if (auctionHouse && auctionHouse.name) {
        borderText += auctionHouse.name;
      }
      if (auction && auction.title) {
        if (borderText) borderText += ' • ';
        borderText += auction.title;
      }
      if (auction && auction.startDate) {
        if (borderText) borderText += ' • ';
        const date = new Date(auction.startDate);
        const formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        borderText += formattedDate;
      }
      
      // If no auction/auctionHouse data, use placeholder or banner settings
      if (!borderText) {
        borderText = bannerSettings.title || 'Banner';
      }
      
      if (borderText) {
        const padding = 20;
        
        if (borderPosition === 'top' || borderPosition === 'bottom') {
          // Horizontal border - text alignment
          ctx.textAlign = bannerSettings.bottomBorderTextAlign || 'left';
          ctx.textBaseline = 'middle';
          
          const borderY = borderPosition === 'top' ? 0 : height - borderHeight;
          let textX;
          if (bannerSettings.bottomBorderTextAlign === 'center') {
            textX = width / 2;
          } else if (bannerSettings.bottomBorderTextAlign === 'right') {
            textX = width - padding;
          } else {
            textX = padding;
          }
          
          ctx.fillText(borderText, textX, borderY + borderHeight / 2);
        } else {
          // Vertical border - text rotated
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const borderWidth = borderHeight;
          const borderX = borderPosition === 'left' ? 0 : width - borderWidth;
          
          // Rotate text for vertical borders
          ctx.save();
          if (borderPosition === 'left') {
            ctx.translate(borderX + borderWidth / 2, height / 2);
            ctx.rotate(-Math.PI / 2); // Rotate -90 degrees
          } else {
            ctx.translate(borderX + borderWidth / 2, height / 2);
            ctx.rotate(Math.PI / 2); // Rotate 90 degrees
          }
          
          // For vertical borders, text alignment affects vertical position along the height
          // After rotation, Y axis represents the vertical position along the banner height
          let textY = 0;
          if (bannerSettings.bottomBorderTextAlign === 'center') {
            textY = 0; // Centered vertically
          } else if (bannerSettings.bottomBorderTextAlign === 'right') {
            textY = height / 2 - padding; // Near bottom (after rotation)
          } else {
            textY = -height / 2 + padding; // Near top (after rotation)
          }
          
          ctx.fillText(borderText, 0, textY);
          ctx.restore();
        }
      }
      
      ctx.restore();
    }
    
    // Restore clipping context if diagonal split was used
    if (bannerSettings.imageLayout === 'collage' && bannerSettings.collageSplitStyle !== 'vertical') {
      ctx.restore();
    }
  }

  function downloadBanner() {
    if (!generatedBannerUrl) return;
    
    const link = document.createElement('a');
    link.download = `banner-${type}-${Date.now()}.png`;
    link.href = generatedBannerUrl;
    link.click();
  }

  async function saveBannerToLot() {
    if (!generatedBannerUrl || !selectedBannerLotId) {
      alert('Please generate a banner and select a lot first.');
      return;
    }

    try {
      savingToLot = true;

      // Convert base64 to Blob
      const base64Data = generatedBannerUrl.split(',')[1]; // Remove data:image/png;base64, prefix
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      
      // Create a File from the Blob
      const file = new File([blob], `banner-${selectedBannerLotId}-${Date.now()}.png`, { type: 'image/png' });

      // Upload the banner image
      const uploadFormData = new FormData();
      uploadFormData.append('files', file);
      uploadFormData.append('lotId', selectedBannerLotId);

      const uploadResponse = await fetch('/api/upload/image', {
        method: 'POST',
        body: uploadFormData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload banner image');
      }

      const { images: uploadedImages } = await uploadResponse.json();
      
      if (!uploadedImages || uploadedImages.length === 0) {
        throw new Error('No images returned from upload');
      }

      // Create image record in database (API will handle unsetting existing primary if needed)
      const imageResponse = await fetch(`/api/lots/${selectedBannerLotId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          images: uploadedImages.map((img, index) => ({
            url: img.url,
            key: img.key,
            displayOrder: 0, // Banner should be first
            isPrimary: setAsPrimaryImage
          }))
        })
      });

      if (!imageResponse.ok) {
        throw new Error('Failed to save image record');
      }

      alert('Banner saved to lot successfully!');
      
      // Call onSave callback if provided
      if (onSave) {
        onSave(generatedBannerUrl);
      }
    } catch (error) {
      console.error('Error saving banner to lot:', error);
      alert(`Failed to save banner to lot: ${error.message}`);
    } finally {
      savingToLot = false;
    }
  }

  function updateGradientColor(index, color) {
    const colors = [...bannerSettings.backgroundGradient.colors];
    colors[index] = color;
    bannerSettings.backgroundGradient = {
      ...bannerSettings.backgroundGradient,
      colors
    };
  }
  
  // Update primary image URL based on featured image or first image
  function updatePrimaryImage() {
    if (selectedBannerImages.length > 0) {
      const featuredImage = selectedBannerImages.find(img => img.isFeatured) || selectedBannerImages[0];
      bannerSettings.primaryImageUrl = featuredImage.url || featuredImage.displayUrl || '';
      bannerSettings.backgroundImageUrl = featuredImage.url || featuredImage.displayUrl || '';
    } else {
      bannerSettings.primaryImageUrl = '';
      bannerSettings.backgroundImageUrl = '';
    }
  }
  
  // Move image up in order
  function moveImageUp(index) {
    if (index > 0) {
      const newImages = [...selectedBannerImages];
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      selectedBannerImages = newImages;
      updatePrimaryImage();
    }
  }
  
  // Move image down in order
  function moveImageDown(index) {
    if (index < selectedBannerImages.length - 1) {
      const newImages = [...selectedBannerImages];
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
      selectedBannerImages = newImages;
      updatePrimaryImage();
    }
  }
</script>

<div class="bg-white rounded-lg shadow-lg p-4 border-2 border-purple-200">
  <div class="flex items-center justify-between mb-3">
    <h2 class="text-xl font-bold text-gray-900">
      Banner Generator - {type === 'lot' ? 'Lot' : type === 'auction' ? 'Auction' : 'Auction House'}
    </h2>
    {#if !showTemplateSelector}
      <button
        onclick={() => showSaveTemplateDialog = true}
        class="text-xs text-purple-600 hover:text-purple-800 px-3 py-1.5 border border-purple-300 rounded hover:bg-purple-50"
        title="Save current settings as template"
      >
        💾 Save Template
      </button>
    {/if}
  </div>
  
  <!-- Template Selector -->
  {#if showTemplateSelector}
    <div class="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Choose a Template</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <!-- Blank Template -->
        <button
          onclick={startBlank}
          class="p-4 bg-white border-2 border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
        >
          <div class="font-semibold text-gray-900 mb-1">Blank Template</div>
          <div class="text-xs text-gray-600">Start with default settings</div>
        </button>
        
        <!-- Saved Templates -->
        {#each savedTemplates as template}
          <div class="relative group">
            <button
              onclick={() => loadTemplate(template)}
              class="w-full p-4 bg-white border-2 border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
            >
              <div class="font-semibold text-gray-900 mb-1">{template.name}</div>
              <div class="text-xs text-gray-600">
                {new Date(template.createdAt).toLocaleDateString()}
              </div>
            </button>
            <button
              onclick={(e) => deleteTemplate(template.id, e)}
              class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-opacity"
              title="Delete template"
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
      
      {#if savedTemplates.length === 0}
        <p class="text-sm text-gray-500 text-center py-4">No saved templates yet. Start with blank or save your first template!</p>
      {/if}
    </div>
  {/if}
  
  <!-- Save Template Dialog -->
  {#if showSaveTemplateDialog}
    <div 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
      role="button"
      tabindex="0"
      onclick={(e) => {
        // Only close if clicking directly on the backdrop, not on the dialog content
        if (e.target === e.currentTarget) {
          showSaveTemplateDialog = false;
        }
      }}
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          showSaveTemplateDialog = false;
        }
      }}
    >
      <div 
        class="bg-white rounded-lg p-6 max-w-md w-full mx-4" 
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-template-title"
      >
        <h3 id="save-template-title" class="text-lg font-semibold text-gray-900 mb-4">Save Template</h3>
        <div class="mb-4">
          <label for="template-name" class="block text-sm font-medium text-gray-700 mb-2">
            Template Name
          </label>
          <input
            id="template-name"
            type="text"
            bind:value={templateName}
            placeholder="e.g., Classic Auction Banner"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                saveAsTemplate();
              } else if (e.key === 'Escape') {
                showSaveTemplateDialog = false;
              }
            }}
          />
        </div>
        <div class="flex gap-3 justify-end">
          <button
            onclick={() => {
              showSaveTemplateDialog = false;
              templateName = '';
            }}
            class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onclick={saveAsTemplate}
            class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  {#if !showTemplateSelector}
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- Left: Settings -->
    <div class="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
      <!-- Lot Selection (only for lot type) -->
      {#if type === 'lot' && lots && lots.length > 0}
        <div>
          <label for="lot-select" class="block text-sm font-medium text-gray-700 mb-2">
            Select Lot (Optional)
          </label>
          <select
            id="lot-select"
            bind:value={selectedBannerLotId}
            onchange={(e) => loadLotImages(e.target.value)}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
          >
            <option value="">-- Use Auction Defaults --</option>
            {#each lots as lot}
              <option value={lot.id}>
                Lot #{lot.lotNumber}: {lot.title}
              </option>
            {/each}
          </select>
        </div>
      {/if}
      
      <!-- Image Selection -->
      <ImageSelection
        bind:selectedLotImages
        bind:selectedBannerImages
        bind:bannerSettings
        {applyPresetCollagePositions}
        {updatePrimaryImage}
        bind:isCollapsed={collapsedSections.imageSelection}
      />
      
      <!-- Image Settings -->
      <ImageSettings
        bind:selectedBannerImages
        bind:bannerSettings
        {applyPresetCollagePositions}
        {updatePrimaryImage}
        bind:isCollapsed={collapsedSections.imageSettings}
      />
      
      <!-- Layout Settings -->
      <LayoutSettings
        bind:bannerSettings
        {imageLayouts}
        bind:isCollapsed={collapsedSections.layout}
      />
      
      <!-- Background Settings -->
      <BackgroundSettings
        backgroundPresets={backgroundPresets}
        applyBackgroundPreset={applyBackgroundPreset}
        bind:bannerSettings
        {backgroundTypes}
        {updateGradientColor}
        bind:isCollapsed={collapsedSections.background}
        {selectedLotImages}
        {type}
      />
      
      <!-- Flexible Text Elements -->
      <TextElementSettings
        bind:bannerSettings
        {fonts}
        {hebrewFonts}
        {convertToHebrewYear}
        bind:isCollapsed={collapsedSections.textContent}
      />
      
      <!-- Legacy Text Content (shown when flexible elements disabled) -->
      {#if !bannerSettings.useFlexibleTextElements}
        <TextContentSettings
          bind:bannerSettings
          {convertToHebrewYear}
          bind:isCollapsed={collapsedSections.textContent}
        />
      {/if}
      
      <!-- Typography Settings -->
      <TypographySettings
        bind:bannerSettings
        {fonts}
        {hebrewFonts}
        {convertToHebrewYear}
        bind:isCollapsed={collapsedSections.typography}
      />
      
      <!-- Separator Settings -->
      <CollapsibleSection
        title="Separator Design"
        bind:isCollapsed={collapsedSections.separator}
        bgColor="bg-indigo-50"
        borderColor="border-indigo-200"
        hoverColor="hover:bg-indigo-100"
      >
        <div class="space-y-3">
          <div>
            <label for="separator-style" class="block text-xs font-medium text-gray-700 mb-1">
              Separator Style
            </label>
            <select
              id="separator-style"
              bind:value={bannerSettings.separatorStyle}
              class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="line">Line</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double Line</option>
              <option value="diamond">Diamond</option>
              <option value="circle">Circle</option>
              <option value="square">Square</option>
            </select>
          </div>
          
          <div>
            <label for="separator-alignment" class="block text-xs font-medium text-gray-700 mb-1">
              Alignment
            </label>
            <select
              id="separator-alignment"
              bind:value={bannerSettings.separatorAlignment}
              class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          
          <div>
            <label for="separator-width" class="block text-xs font-medium text-gray-700 mb-1">
              Width: {bannerSettings.separatorWidth || 60}%
            </label>
            <input
              id="separator-width"
              type="range"
              min="20"
              max="100"
              step="5"
              bind:value={bannerSettings.separatorWidth}
              class="w-full"
            />
          </div>
          
          <div>
            <label for="separator-thickness" class="block text-xs font-medium text-gray-700 mb-1">
              Thickness: {bannerSettings.separatorThickness || 2}px
            </label>
            <input
              id="separator-thickness"
              type="range"
              min="1"
              max="10"
              step="1"
              bind:value={bannerSettings.separatorThickness}
              class="w-full"
            />
          </div>
          
          <div>
            <label for="separator-color" class="block text-xs font-medium text-gray-700 mb-1">
              Color (leave empty to use text color)
            </label>
            <div class="flex gap-2">
              <input
                id="separator-color"
                type="color"
                value={bannerSettings.separatorColor || bannerSettings.textColor}
                oninput={(e) => bannerSettings.separatorColor = e.target.value}
                class="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                bind:value={bannerSettings.separatorColor}
                placeholder="Uses text color if empty"
                class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="button"
                onclick={() => bannerSettings.separatorColor = ''}
                class="px-2 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Reset
              </button>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="separator-margin-top" class="block text-xs font-medium text-gray-700 mb-1">
                Margin Above: {bannerSettings.separatorMarginTop || 15}px
              </label>
              <input
                id="separator-margin-top"
                type="range"
                min="0"
                max="50"
                step="5"
                bind:value={bannerSettings.separatorMarginTop}
                class="w-full"
              />
            </div>
            
            <div>
              <label for="separator-margin-bottom" class="block text-xs font-medium text-gray-700 mb-1">
                Margin Below: {bannerSettings.separatorMarginBottom || 15}px
              </label>
              <input
                id="separator-margin-bottom"
                type="range"
                min="0"
                max="50"
                step="5"
                bind:value={bannerSettings.separatorMarginBottom}
                class="w-full"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>
      
      <!-- Overlay Stamp Settings -->
      <CollapsibleSection
        title="Overlay Stamp"
        bind:isCollapsed={collapsedSections.overlayStamp}
        bgColor="bg-yellow-50"
        borderColor="border-yellow-200"
        hoverColor="hover:bg-yellow-100"
      >
        <div class="space-y-3">
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={bannerSettings.showOverlayStamp}
              class="mr-2 h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
            />
            <span class="text-xs font-medium text-gray-700">Show Overlay Stamp</span>
          </label>
          
          {#if bannerSettings.showOverlayStamp}
            {#if type === 'lot' && selectedLotImages.length > 0}
              <div class="mb-2">
                <div class="block text-xs font-medium text-gray-700 mb-2">Image Source</div>
                <div class="flex gap-2 mb-2">
                  <button
                    type="button"
                    onclick={() => overlayStampSource = 'library'}
                    class="flex-1 px-3 py-1.5 text-xs rounded border transition-colors {overlayStampSource === 'library' ? 'bg-yellow-600 text-white border-yellow-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
                  >
                    From Library
                  </button>
                  <button
                    type="button"
                    onclick={() => overlayStampSource = 'url'}
                    class="flex-1 px-3 py-1.5 text-xs rounded border transition-colors {overlayStampSource === 'url' ? 'bg-yellow-600 text-white border-yellow-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
                  >
                    Custom URL
                  </button>
                </div>
              </div>
            {/if}
            
            {#if overlayStampSource === 'library' && type === 'lot' && selectedLotImages.length > 0}
              <div>
                <div class="block text-xs font-medium text-gray-700 mb-2">Select from Library</div>
                <div class="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                  {#each selectedLotImages as image}
                    {@const isSelected = bannerSettings.overlayStampUrl === (image.displayUrl || image.url)}
                    <div
                      class="relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all {isSelected ? 'border-yellow-600 ring-2 ring-yellow-300' : 'border-gray-300 hover:border-yellow-400'}"
                      role="button"
                      tabindex="0"
                      onclick={() => {
                        bannerSettings.overlayStampUrl = image.displayUrl || image.url;
                      }}
                      onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          bannerSettings.overlayStampUrl = image.displayUrl || image.url;
                        }
                      }}
                    >
                      <img
                        src={image.displayUrl || image.url}
                        alt=""
                        class="w-full h-16 object-cover"
                      />
                      {#if isSelected}
                        <div class="absolute top-1 right-1 bg-yellow-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                          ✓
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              <div>
                <label for="overlay-stamp-url" class="block text-xs font-medium text-gray-700 mb-1">
                  Stamp Image URL
                </label>
                <input
                  id="overlay-stamp-url"
                  type="text"
                  bind:value={bannerSettings.overlayStampUrl}
                  placeholder="https://example.com/stamp.png"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            {/if}
            
            <div>
              <label for="overlay-stamp-position" class="block text-xs font-medium text-gray-700 mb-1">
                Position
              </label>
              <select
                id="overlay-stamp-position"
                bind:value={bannerSettings.overlayStampPosition}
                class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="top-left">Top Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="center">Center</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            
            {#if bannerSettings.overlayStampPosition === 'custom'}
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label for="overlay-stamp-x" class="block text-xs font-medium text-gray-700 mb-1">
                    X: {bannerSettings.overlayStampX || 50}%
                  </label>
                  <input
                    id="overlay-stamp-x"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    bind:value={bannerSettings.overlayStampX}
                    class="w-full"
                  />
                </div>
                <div>
                  <label for="overlay-stamp-y" class="block text-xs font-medium text-gray-700 mb-1">
                    Y: {bannerSettings.overlayStampY || 50}%
                  </label>
                  <input
                    id="overlay-stamp-y"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    bind:value={bannerSettings.overlayStampY}
                    class="w-full"
                  />
                </div>
              </div>
            {/if}
            
            <div>
              <label for="overlay-stamp-size" class="block text-xs font-medium text-gray-700 mb-1">
                Size: {bannerSettings.overlayStampSize || 200}px
              </label>
              <input
                id="overlay-stamp-size"
                type="range"
                min="50"
                max="500"
                step="10"
                bind:value={bannerSettings.overlayStampSize}
                class="w-full"
              />
            </div>
            
            <div>
              <label for="overlay-stamp-rotation" class="block text-xs font-medium text-gray-700 mb-1">
                Rotation: {bannerSettings.overlayStampRotation || 0}°
              </label>
              <input
                id="overlay-stamp-rotation"
                type="range"
                min="-180"
                max="180"
                step="5"
                bind:value={bannerSettings.overlayStampRotation}
                class="w-full"
              />
            </div>
            
            <div>
              <label for="overlay-stamp-opacity" class="block text-xs font-medium text-gray-700 mb-1">
                Opacity: {Math.round((bannerSettings.overlayStampOpacity || 0.5) * 100)}%
              </label>
              <input
                id="overlay-stamp-opacity"
                type="range"
                min="0"
                max="1"
                step="0.1"
                bind:value={bannerSettings.overlayStampOpacity}
                class="w-full"
              />
            </div>
            
            <div>
              <label for="overlay-stamp-alignment" class="block text-xs font-medium text-gray-700 mb-1">
                Alignment
              </label>
              <select
                id="overlay-stamp-alignment"
                bind:value={bannerSettings.overlayStampAlignment}
                class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="top-left">Top Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="center">Center</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </div>
          {/if}
        </div>
      </CollapsibleSection>
        
      <!-- Image Shadow Settings -->
      <ImageShadowSettings
        bind:bannerSettings
        bind:isCollapsed={collapsedSections.imageShadows}
      />
      
      <!-- Logo Settings -->
      <CollapsibleSection
        title="Logo"
        bind:isCollapsed={collapsedSections.logo}
        bgColor="bg-gray-50"
        borderColor="border-gray-200"
        hoverColor="hover:bg-gray-100"
      >
        <div class="space-y-3">
          <div>
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                bind:checked={bannerSettings.showLogo}
                class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span class="text-xs font-medium text-gray-700">Show Logo</span>
            </label>
          </div>
          
          {#if bannerSettings.showLogo}
            {#if auctionHouse?.logoUrl && !bannerSettings.useCustomLogo}
              <div class="p-3 bg-blue-50 border border-blue-200 rounded">
                <p class="text-xs font-medium text-gray-700 mb-2">
                  Using Auction House Logo
                </p>
                <div class="flex items-center gap-3 mb-3">
                  <div class="flex-shrink-0">
                    <img 
                      src={auctionHouse.logoUrl} 
                      alt="Auction House Logo" 
                      class="h-16 w-16 object-contain border border-gray-200 rounded bg-white p-2"
                      onerror={async (e) => {
                        // If image fails to load (e.g., S3 key), try to get presigned URL
                        if (auctionHouse.logoUrl && !auctionHouse.logoUrl.startsWith('http')) {
                          try {
                            const res = await fetch('/api/images/presigned', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ keys: [auctionHouse.logoUrl] })
                            });
                            if (res.ok) {
                              const { urls } = await res.json();
                              if (urls[auctionHouse.logoUrl]) {
                                e.target.src = urls[auctionHouse.logoUrl];
                              }
                            }
                          } catch (err) {
                            console.warn('Error loading logo preview:', err);
                          }
                        }
                      }}
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs text-gray-600 break-all">{auctionHouse.logoUrl}</p>
                  </div>
                </div>
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    bind:checked={bannerSettings.useCustomLogo}
                    class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span class="text-xs font-medium text-gray-700">Use Custom Logo URL Instead</span>
                </label>
              </div>
            {/if}
            
            {#if bannerSettings.useCustomLogo || !auctionHouse?.logoUrl}
              <div>
                <label for="logo-url" class="block text-xs font-medium text-gray-700 mb-1">
                  Custom Logo URL
                </label>
                <input
                  id="logo-url"
                  type="text"
                  bind:value={bannerSettings.logoUrl}
                  placeholder="Enter logo URL"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {#if bannerSettings.logoUrl}
                  <div class="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                    <p class="text-xs font-medium text-gray-700 mb-2">Preview:</p>
                    <img 
                      src={bannerSettings.logoUrl} 
                      alt="Custom Logo Preview" 
                      class="h-16 w-16 object-contain border border-gray-200 rounded bg-white p-2"
                      onerror={async (e) => {
                        // If image fails to load (e.g., S3 key), try to get presigned URL
                        if (bannerSettings.logoUrl && !bannerSettings.logoUrl.startsWith('http')) {
                          try {
                            const res = await fetch('/api/images/presigned', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ keys: [bannerSettings.logoUrl] })
                            });
                            if (res.ok) {
                              const { urls } = await res.json();
                              if (urls[bannerSettings.logoUrl]) {
                                e.target.src = urls[bannerSettings.logoUrl];
                              }
                            }
                          } catch (err) {
                            console.warn('Error loading custom logo preview:', err);
                          }
                        }
                      }}
                    />
                  </div>
                {/if}
              </div>
            {/if}
            {#if auctionHouse?.id}
              <div>
                <label for="logo-upload" class="block text-xs font-medium text-gray-700 mb-1">
                  Upload Logo for Auction House
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onchange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    try {
                      const formData = new FormData();
                      formData.append('files', file);
                      
                      const uploadResponse = await fetch('/api/upload/image', {
                        method: 'POST',
                        body: formData
                      });
                      
                      if (!uploadResponse.ok) {
                        throw new Error('Failed to upload logo');
                      }
                      
                      const { images } = await uploadResponse.json();
                      if (images && images.length > 0) {
                        const logoUrl = images[0].url;
                        bannerSettings.logoUrl = logoUrl;
                        
                        // Update auction house logo URL
                        const updateResponse = await fetch(`/api/auction-houses/${auctionHouse.id}`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ logoUrl })
                        });
                        
                        if (updateResponse.ok) {
                          const updated = await updateResponse.json();
                          // Update local auctionHouse reference if needed
                          if (updated.auctionHouse) {
                            auctionHouse.logoUrl = updated.auctionHouse.logoUrl;
                          }
                        }
                      }
                      
                      e.target.value = '';
                    } catch (error) {
                      console.error('Error uploading logo:', error);
                      alert('Failed to upload logo. Please try again.');
                    }
                  }}
                />
                <p class="mt-1 text-xs text-gray-500">
                  Upload a logo to save it to your auction house
                </p>
              </div>
            {/if}
            
            <div>
              <label for="logo-position" class="block text-xs font-medium text-gray-700 mb-1">
                Position
              </label>
              <select
                id="logo-position"
                bind:value={bannerSettings.logoPosition}
                class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="top-left">Top Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </div>
            
            <div>
              <label for="logo-size" class="block text-xs text-gray-600 mb-1">
                Size: {bannerSettings.logoSize}px
              </label>
              <input
                id="logo-size"
                type="range"
                min="50"
                max="300"
                step="10"
                bind:value={bannerSettings.logoSize}
                class="w-full"
              />
            </div>
            
            <div>
              <label for="logo-opacity" class="block text-xs text-gray-600 mb-1">
                Opacity: {(bannerSettings.logoOpacity * 100).toFixed(0)}%
              </label>
              <input
                id="logo-opacity"
                type="range"
                min="0"
                max="1"
                step="0.1"
                bind:value={bannerSettings.logoOpacity}
                class="w-full"
              />
            </div>
            
            <div>
              <label for="logo-margin" class="block text-xs text-gray-600 mb-1">
                Margin: {bannerSettings.logoMargin}px
              </label>
              <input
                id="logo-margin"
                type="range"
                min="0"
                max="100"
                step="5"
                bind:value={bannerSettings.logoMargin}
                class="w-full"
              />
            </div>
          {/if}
        </div>
      </CollapsibleSection>
      
      <!-- Watermark Settings -->
      <CollapsibleSection
        title="Watermark"
        bind:isCollapsed={collapsedSections.watermark}
        bgColor="bg-cyan-50"
        borderColor="border-cyan-200"
        hoverColor="hover:bg-cyan-100"
      >
        <div class="space-y-3">
          <div>
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                bind:checked={bannerSettings.showWatermark}
                class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span class="text-xs font-medium text-gray-700">Show Watermark</span>
            </label>
            <p class="text-xs text-gray-500 mt-1 ml-6">Add a subtle watermark to the background</p>
          </div>
          
          {#if bannerSettings.showWatermark}
            <div>
              <label class="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  bind:checked={bannerSettings.watermarkUseLogo}
                  class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span class="text-xs font-medium text-gray-700">Use Logo as Watermark</span>
              </label>
            </div>
            
            {#if !bannerSettings.watermarkUseLogo}
              <div>
                <label for="watermark-url" class="block text-xs font-medium text-gray-700 mb-1">
                  Custom Watermark URL
                </label>
                <input
                  id="watermark-url"
                  type="text"
                  bind:value={bannerSettings.watermarkUrl}
                  placeholder="Enter watermark image URL"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            {/if}
            
            <div>
              <label for="watermark-position" class="block text-xs font-medium text-gray-700 mb-1">
                Position
              </label>
              <select
                id="watermark-position"
                bind:value={bannerSettings.watermarkPosition}
                class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="center">Center</option>
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="tile">Tile (Repeat)</option>
              </select>
            </div>
            
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="watermark-size" class="block text-xs font-medium text-gray-700 mb-1">
                  Size: {bannerSettings.watermarkSize || 300}px
                </label>
                <input
                  id="watermark-size"
                  type="range"
                  min="50"
                  max="800"
                  step="50"
                  bind:value={bannerSettings.watermarkSize}
                  class="w-full"
                />
              </div>
              
              <div>
                <label for="watermark-opacity" class="block text-xs font-medium text-gray-700 mb-1">
                  Opacity: {Math.round((bannerSettings.watermarkOpacity || 0.1) * 100)}%
                </label>
                <input
                  id="watermark-opacity"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={bannerSettings.watermarkOpacity ? bannerSettings.watermarkOpacity * 100 : 10}
                  oninput={(e) => bannerSettings.watermarkOpacity = e.target.value / 100}
                  class="w-full"
                />
              </div>
            </div>
            
            <div>
              <label for="watermark-rotation" class="block text-xs font-medium text-gray-700 mb-1">
                Rotation: {bannerSettings.watermarkRotation || 0}°
              </label>
              <input
                id="watermark-rotation"
                type="range"
                min="-180"
                max="180"
                step="15"
                bind:value={bannerSettings.watermarkRotation}
                class="w-full"
              />
            </div>
          {/if}
        </div>
      </CollapsibleSection>
    
      <!-- Actions -->
      <BannerActions
        generatingBanner={generatingBanner}
        generatedBannerUrl={generatedBannerUrl}
        onGenerate={generateQuickBanner}
        onDownload={downloadBanner}
        canGenerate={!!bannerSettings.title}
      />

      <!-- Save to Lot (only for lot type) -->
      {#if type === 'lot' && generatedBannerUrl && selectedBannerLotId}
        <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
          <div class="flex items-center">
            <input
              type="checkbox"
              id="set-as-primary"
              bind:checked={setAsPrimaryImage}
              class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label for="set-as-primary" class="text-sm font-medium text-gray-700 cursor-pointer">
              Set as primary/default image
            </label>
          </div>
          <button
            onclick={saveBannerToLot}
            disabled={savingToLot}
            class="w-full bg-blue-600 text-white py-2 text-sm rounded hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {savingToLot ? 'Saving...' : '💾 Save Banner to Lot'}
          </button>
        </div>
      {/if}
    </div>
    
    <!-- Right: Preview -->
    <BannerPreview {generatedBannerUrl} />
  </div>
  {/if}
</div>
