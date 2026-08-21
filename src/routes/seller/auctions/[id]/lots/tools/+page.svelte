<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';
  
  let auction = $state(null);
  let lots = $state([]);
  let loading = $state(true);
  let selectedLotId = $state('');
  let selectedLot = $state(null);
  
  // Ginzey America color scheme
  const ginzeyColors = {
    antiquePaper: '#F5F1E8', // Base color - antique paper
    red: '#C41E3A', // Secondary color - red
    blue: '#1E3A8A', // Secondary color - blue
    darkText: '#2C1810', // Dark brown for text on antique paper
    lightText: '#FFFFFF' // White for text on colored backgrounds
  };

  // Banner generation settings
  let bannerSettings = $state({
    width: 1200,
    height: 630,
    title: '',
    titleHebrew: '',
    subtitle: '',
    subtitleHebrew: '',
    category: '',
    categoryHebrew: '',
    yearEnglish: '', // English year (e.g., "1890")
    yearHebrew: '', // Hebrew year (e.g., "תר\"נ")
    primaryImageUrl: '',
    backgroundImageUrl: '',
    primaryImageFile: null, // For file upload (single)
    primaryImageFiles: [], // For multiple file uploads (collage)
    backgroundImageFile: null, // For file upload
    textColor: ginzeyColors.darkText,
    backgroundColor: 'rgba(245, 241, 232, 0.95)', // High opacity antique paper for text readability
    fontSize: 48,
    fontFamily: 'Cormorant Garamond, Times New Roman, serif', // Serif font for English
    hebrewFontFamily: 'Frank Ruhl Libre, Cardo, serif', // Frank Ruhl or Cardo for Hebrew
    // Text positioning and spacing - centered layout
    textMarginLeft: 0, // Will be calculated for centering
    textMarginRight: 0,
    textMarginTop: 80,
    textMarginBottom: 60,
    textPadding: 20,
    textAreaWidth: 50, // 50% for text area (other 50% for image)
    // Category ribbon colors and position
    categoryColor: ginzeyColors.red, // Default to red, can be changed to blue
    categoryRibbonPosition: 'top-right', // 'top-left' or 'top-right'
    baseBackgroundColor: ginzeyColors.antiquePaper,
    backgroundImageOpacity: 0.25, // Opacity for background image (0.25 = subtle but visible)
    // Primary image blending and rounding options
    primaryImageRounded: true, // Enable rounded corners on primary image
    primaryImageCornerRadius: 20, // Corner radius in pixels
    primaryImageBlend: true, // Enable blending/fade on left edge
    primaryImageBlendWidth: 40, // Width of blend gradient in pixels
    // Collage layout options
    collageCenterImageSize: 0.6, // Size of center (first) image as percentage (0.6 = 60%)
    collageOtherImageSize: 0.35, // Size of other images as percentage
    collageSpacing: 15, // Spacing between images in pixels
    collageStaggerAmount: 0.1 // Amount of stagger (0.1 = 10% offset)
  });
  
  // Available fonts - serif for English, vintage Hebrew fonts
  const fonts = [
    { name: 'Cormorant Garamond (Serif)', value: 'Cormorant Garamond, serif', supportsHebrew: false, default: true },
    { name: 'Playfair Display (Serif)', value: 'Playfair Display, serif', supportsHebrew: false },
    { name: 'Times New Roman (Serif)', value: 'Times New Roman, serif', supportsHebrew: true },
    { name: 'Georgia (Serif)', value: 'Georgia, serif', supportsHebrew: true },
    { name: 'Arial (Sans-serif)', value: 'Arial, sans-serif', supportsHebrew: true }
  ];
  
  const hebrewFonts = [
    { name: 'Frank Ruhl Libre (Serif, Recommended)', value: 'Frank Ruhl Libre, Times New Roman, serif', default: true },
    { name: 'Cardo (Serif, Recommended)', value: 'Cardo, Times New Roman, serif' },
    { name: 'David Libre (Serif)', value: 'David Libre, Times New Roman, serif' },
    { name: 'Noto Serif Hebrew (Serif)', value: 'Noto Serif Hebrew, Georgia, serif' },
    { name: 'Tinos (Serif)', value: 'Tinos, Times New Roman, serif' },
    { name: 'Suez One (Serif)', value: 'Suez One, Times New Roman, serif' },
    { name: 'Times New Roman (Serif)', value: 'Times New Roman, serif' },
    { name: 'Georgia (Serif)', value: 'Georgia, serif' },
    { name: 'David (Serif)', value: 'David, Times New Roman, serif' },
    { name: 'Miriam (Serif)', value: 'Miriam, Times New Roman, serif' },
    { name: 'Noto Sans Hebrew (Sans-serif)', value: 'Noto Sans Hebrew, Arial, sans-serif' },
    { name: 'Heebo (Sans-serif)', value: 'Heebo, Arial, sans-serif' },
    { name: 'Rubik (Sans-serif)', value: 'Rubik, Arial, sans-serif' },
    { name: 'Alef (Sans-serif)', value: 'Alef, Arial, sans-serif' },
    { name: 'Assistant (Sans-serif)', value: 'Assistant, Arial, sans-serif' },
    { name: 'Varela Round (Sans-serif)', value: 'Varela Round, Arial, sans-serif' },
    { name: 'Secular One (Sans-serif)', value: 'Secular One, Arial, sans-serif' },
    { name: 'Miriam Libre (Sans-serif)', value: 'Miriam Libre, Arial, sans-serif' },
    { name: 'Arimo (Sans-serif)', value: 'Arimo, Arial, sans-serif' },
    { name: 'Arial Hebrew (Sans-serif)', value: 'Arial Hebrew, Arial, sans-serif' }
  ];
  
  // Convert Gregorian year to Hebrew year format (e.g., 1850 -> תר"נ)
  function convertToHebrewYear(year) {
    if (!year || isNaN(year)) return '';
    
    const yearNum = parseInt(year);
    if (yearNum < 1000 || yearNum > 9999) {
      return '';
    }
    
    // Convert to Hebrew calendar year (add 3760 for approximate conversion)
    // Hebrew year = Gregorian year + 3760 (approximately)
    const hebrewYear = yearNum + 3760;
    
    // Hebrew numerals mapping
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
    
    let result = '';
    let remaining = hebrewYear;
    
    // Handle thousands (5000+)
    if (remaining >= 5000) {
      result += 'ה\'';
      remaining -= 5000;
    }
    
    // Convert hundreds (100-900)
    // Hebrew: 100=ק, 200=ר, 300=ש, 400=ת, 500=תק, 600=תר, 700=תש, 800=תת, 900=תתק
    const hundredsDigit = Math.floor(remaining / 100);
    if (hundredsDigit > 0) {
      if (hundredsDigit <= 4) {
        result += hundreds[hundredsDigit];
        remaining -= hundredsDigit * 100;
      } else {
        // For 500-900: ת (400) + the remainder (100-500)
        result += 'ת';
        remaining -= 400;
        const remainderHundreds = hundredsDigit - 4;
        if (remainderHundreds > 0 && remainderHundreds <= 4) {
          result += hundreds[remainderHundreds];
          remaining -= remainderHundreds * 100;
        } else if (remainderHundreds === 5) {
          // 900 = תתק
          result += 'תק';
          remaining -= 500;
        }
      }
    }
    
    // Convert tens (10-90)
    const tensDigit = Math.floor(remaining / 10);
    if (tensDigit > 0 && tensDigit <= 9) {
      result += tens[tensDigit];
      remaining -= tensDigit * 10;
    }
    
    // Convert ones (1-9)
    if (remaining > 0 && remaining <= 9) {
      result += ones[remaining];
    }
    
    // Add geresh (׳) apostrophe right before the last character
    // This is the standard Hebrew year notation (e.g., תר"נ for 1850)
    // Skip if result starts with ה' (thousands marker already has apostrophe)
    if (result.length > 1 && !result.startsWith('ה\'')) {
      const lastChar = result.slice(-1);
      const beforeLast = result.slice(0, -1);
      // Check if geresh is already present before the last char
      const lastTwoChars = result.slice(-2);
      if (!lastTwoChars.includes('׳') && !lastTwoChars.includes('״')) {
        result = beforeLast + '׳' + lastChar;
      }
    } else if (result.length > 1 && result.startsWith('ה\'')) {
      // For years with ה', add geresh before last char of the remaining part
      const afterThousands = result.slice(2); // Remove ה'
      if (afterThousands.length > 1) {
        const lastChar = afterThousands.slice(-1);
        const beforeLast = afterThousands.slice(0, -1);
        const lastTwoChars = afterThousands.slice(-2);
        if (!lastTwoChars.includes('׳') && !lastTwoChars.includes('״')) {
          result = 'ה\'' + beforeLast + '׳' + lastChar;
        }
      }
    }
    
    return result || '';
  }
  
  const presetDimensions = [
    { name: 'Social Media (Facebook/Twitter)', width: 1200, height: 630 },
    { name: 'Page Template', width: 1559, height: 945 },
    { name: 'Instagram Post', width: 1080, height: 1080 },
    { name: 'Instagram Story', width: 1080, height: 1920 },
    { name: 'Email Header', width: 600, height: 200 },
    { name: 'Custom', width: 1200, height: 630 }
  ];
  
  let selectedPreset = $state('Social Media (Facebook/Twitter)');
  
  let generatedBannerUrl = $state(null);
  let generating = $state(false);
  
  $effect(() => {
    if ($page.params.id) {
      loadData();
    }
  });
  
  async function loadData() {
    try {
      loading = true;
      const [auctionRes, lotsRes] = await Promise.all([
        fetch(`/api/auctions/${$page.params.id}`),
        fetch(`/api/lots?auctionId=${$page.params.id}`)
      ]);
      
      auction = await auctionRes.json();
      lots = await lotsRes.json();
      
      // Set default values from auction
      if (auction) {
        bannerSettings.title = auction.title;
        bannerSettings.subtitle = auction.description.substring(0, 100);
        bannerSettings.primaryImageUrl = auction.imageUrl;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      loading = false;
    }
  }
  
  function selectLot(lot) {
    selectedLot = lot;
    selectedLotId = lot.id;
    bannerSettings.title = lot.title || '';
    bannerSettings.subtitle = lot.description ? lot.description.substring(0, 150) : '';
    // Both primary and background default to lot's image
    bannerSettings.primaryImageUrl = lot.imageUrl || '';
    bannerSettings.backgroundImageUrl = lot.imageUrl || '';
    // Pull Hebrew fields from lot if available
    bannerSettings.titleHebrew = lot.HebrewTitle || lot.hebrewTitle || lot.titleHebrew || '';
    bannerSettings.subtitleHebrew = lot.HebrewDescription || lot.hebrewDescription || lot.descriptionHebrew || '';
    // Keep category Hebrew empty (not typically stored in lot)
    bannerSettings.categoryHebrew = '';
    // Extract year from title if it contains a year (e.g., "c. 1890" or "1850")
    const yearMatch = lot.title?.match(/\b(18|19|20)\d{2}\b/);
    if (yearMatch) {
      bannerSettings.yearEnglish = yearMatch[0];
      // Convert to Hebrew year (simplified - you might want to use a proper Hebrew calendar library)
      bannerSettings.yearHebrew = convertToHebrewYear(yearMatch[0]);
    }
  }
  
  // Check if text contains Hebrew characters
  function containsHebrew(text) {
    return /[\u0590-\u05FF]/.test(text);
  }
  
  // Set text direction based on content
  function getTextDirection(text) {
    return containsHebrew(text) ? 'rtl' : 'ltr';
  }
  
  // Function to draw multiple images in a staggered collage layout
  async function drawImageCollage(ctx, imageFiles, areaX, areaY, areaWidth, areaHeight, settings) {
    const numImages = imageFiles.length;
    if (numImages === 0) return;
    
    const cornerRadius = settings.primaryImageRounded ? settings.primaryImageCornerRadius : 0;
    const padding = settings.collageSpacing || 15;
    const blendWidth = settings.primaryImageBlend ? (settings.primaryImageBlendWidth || 40) : 0;
    const centerSize = settings.collageCenterImageSize || 0.6;
    const otherSize = settings.collageOtherImageSize || 0.35;
    const staggerAmount = settings.collageStaggerAmount || 0.1;
    
    // Calculate layout based on number of images
    let imageLayouts = [];
    
    if (numImages === 1) {
      // Single image - centered, full area
      imageLayouts.push({ x: 0.5 - centerSize/2, y: 0.5 - centerSize/2, width: centerSize, height: centerSize });
    } else {
      // First image (center, larger)
      const centerX = 0.5 - centerSize / 2;
      const centerY = 0.5 - centerSize / 2;
      imageLayouts.push({ x: centerX, y: centerY, width: centerSize, height: centerSize });
      
      // Normalize spacing to relative units
      const spacingX = padding / areaWidth;
      const spacingY = padding / areaHeight;
      
      // Position other images around the center based on pattern:
      // 1: [1]
      // 2: [1, 2]
      // 3: [2, 1, 3]
      // 4: [2, 1, 3, 4]
      if (numImages === 2) {
        // Layout: 1,2 (center image + one other to the right)
        imageLayouts.push({ 
          x: 0.5 + centerSize/2 + spacingX, 
          y: 0.5 - otherSize/2, 
          width: otherSize, 
          height: otherSize 
        });
      } else if (numImages === 3) {
        // Layout: 2,1,3 (left, center, right)
        imageLayouts.push({ 
          x: 0.5 - centerSize/2 - otherSize - spacingX, 
          y: 0.5 - otherSize/2, 
          width: otherSize, 
          height: otherSize 
        }); // Image 2 - left
        imageLayouts.push({ 
          x: 0.5 + centerSize/2 + spacingX, 
          y: 0.5 - otherSize/2, 
          width: otherSize, 
          height: otherSize 
        }); // Image 3 - right
      } else if (numImages === 4) {
        // Layout: 2,1,3,4 (left, center, right, bottom)
        imageLayouts.push({ 
          x: 0.5 - centerSize/2 - otherSize - spacingX, 
          y: 0.5 - otherSize/2, 
          width: otherSize, 
          height: otherSize 
        }); // Image 2 - left
        imageLayouts.push({ 
          x: 0.5 + centerSize/2 + spacingX, 
          y: 0.5 - otherSize/2, 
          width: otherSize, 
          height: otherSize 
        }); // Image 3 - right
        imageLayouts.push({ 
          x: 0.5 - otherSize/2, 
          y: 0.5 + centerSize/2 + spacingY, 
          width: otherSize, 
          height: otherSize 
        }); // Image 4 - bottom
      } else {
        // 5+ images - arrange around center
        const angleStep = (2 * Math.PI) / (numImages - 1);
        const radius = centerSize / 2 + otherSize / 2 + padding / Math.min(areaWidth, areaHeight);
        
        for (let i = 1; i < numImages; i++) {
          const angle = (i - 1) * angleStep;
          const offsetX = Math.cos(angle) * radius;
          const offsetY = Math.sin(angle) * radius;
          imageLayouts.push({
            x: 0.5 + offsetX - otherSize / 2,
            y: 0.5 + offsetY - otherSize / 2,
            width: otherSize,
            height: otherSize
          });
        }
      }
    }
    
    // Load and draw each image
    const imagePromises = imageFiles.map((file, index) => {
      return new Promise((resolve) => {
        if (!file) {
          resolve();
          return;
        }
        
        const img = new Image();
        const imgSrc = URL.createObjectURL(file);
        
        img.onload = () => {
          try {
            const layout = imageLayouts[index] || imageLayouts[0];
            const imgX = areaX + (layout.x * areaWidth);
            const imgY = areaY + (layout.y * areaHeight);
            const imgWidth = layout.width * areaWidth;
            const imgHeight = layout.height * areaHeight;
            
            // Save context for clipping
            ctx.save();
            
            // Create rounded rectangle path if rounding is enabled
            if (settings.primaryImageRounded && cornerRadius > 0) {
              ctx.beginPath();
              ctx.moveTo(imgX + cornerRadius, imgY);
              ctx.lineTo(imgX + imgWidth - cornerRadius, imgY);
              ctx.quadraticCurveTo(imgX + imgWidth, imgY, imgX + imgWidth, imgY + cornerRadius);
              ctx.lineTo(imgX + imgWidth, imgY + imgHeight - cornerRadius);
              ctx.quadraticCurveTo(imgX + imgWidth, imgY + imgHeight, imgX + imgWidth - cornerRadius, imgY + imgHeight);
              ctx.lineTo(imgX + cornerRadius, imgY + imgHeight);
              ctx.quadraticCurveTo(imgX, imgY + imgHeight, imgX, imgY + imgHeight - cornerRadius);
              ctx.lineTo(imgX, imgY + cornerRadius);
              ctx.quadraticCurveTo(imgX, imgY, imgX + cornerRadius, imgY);
              ctx.closePath();
              ctx.clip();
            }
            
            // Draw image
            ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
            
            // Restore context
            ctx.restore();
          } catch (error) {
            console.error(`Error drawing image ${index + 1}:`, error);
          } finally {
            // Clean up object URL
            URL.revokeObjectURL(imgSrc);
            resolve();
          }
        };
        
        img.onerror = (error) => {
          console.warn(`Image ${index + 1} failed to load:`, error);
          URL.revokeObjectURL(imgSrc);
          resolve(); // Continue even if one image fails
        };
        
        img.src = imgSrc;
      });
    });
    
    await Promise.all(imagePromises);
    
    // Add blending/fade on left edge if enabled
    if (settings.primaryImageBlend && blendWidth > 0) {
      const gradient = ctx.createLinearGradient(areaX, 0, areaX + blendWidth, 0);
      gradient.addColorStop(0, 'rgba(245, 241, 232, 0.7)');
      gradient.addColorStop(1, 'rgba(245, 241, 232, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(areaX, areaY, blendWidth, areaHeight);
    }
  }
  
  async function generateBanner() {
    generating = true;
    generatedBannerUrl = null;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bannerSettings.width;
      canvas.height = bannerSettings.height;
      const ctx = canvas.getContext('2d');
      
      // Load background image if provided (much more subtle)
      const backgroundImageSrc = bannerSettings.backgroundImageFile 
        ? URL.createObjectURL(bannerSettings.backgroundImageFile)
        : bannerSettings.backgroundImageUrl;
      
      if (backgroundImageSrc) {
        await new Promise((resolve, reject) => {
          const bgImg = new Image();
          bgImg.crossOrigin = bannerSettings.backgroundImageFile ? 'anonymous' : 'anonymous';
          bgImg.onload = () => {
            // Draw background image with reduced opacity for subtlety - visible across entire canvas
            const bgOpacity = bannerSettings.backgroundImageOpacity || 0.25;
            ctx.globalAlpha = bgOpacity; // Subtle background image
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1.0; // Reset alpha
            
            // Clean up object URL if we created one
            if (bannerSettings.backgroundImageFile) {
              URL.revokeObjectURL(backgroundImageSrc);
            }
            resolve();
          };
          bgImg.onerror = () => {
            // Fallback to antique paper background if image fails to load
            ctx.fillStyle = bannerSettings.baseBackgroundColor || ginzeyColors.antiquePaper;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (bannerSettings.backgroundImageFile) {
              URL.revokeObjectURL(backgroundImageSrc);
            }
            resolve();
          };
          bgImg.src = backgroundImageSrc;
        });
      } else {
        // Solid antique paper background if no background image
        ctx.fillStyle = bannerSettings.baseBackgroundColor || ginzeyColors.antiquePaper;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Load and draw primary image(s) (right side - remaining space after text area)
      const imgAreaTextWidth = (canvas.width * bannerSettings.textAreaWidth) / 100;
      const imgAreaWidth = canvas.width - imgAreaTextWidth;
      const imgAreaHeight = canvas.height;
      const imgAreaX = imgAreaTextWidth;
      const imgAreaY = 0;
      
      // Check if we have multiple images for collage
      const hasMultipleImages = bannerSettings.primaryImageFiles && bannerSettings.primaryImageFiles.length > 0;
      const hasSingleImage = bannerSettings.primaryImageFile || bannerSettings.primaryImageUrl;
      
      if (hasMultipleImages) {
        // Draw collage of multiple images
        await drawImageCollage(ctx, bannerSettings.primaryImageFiles, imgAreaX, imgAreaY, imgAreaWidth, imgAreaHeight, bannerSettings);
      } else if (hasSingleImage) {
        // Draw single image
        const primaryImageSrc = bannerSettings.primaryImageFile
          ? URL.createObjectURL(bannerSettings.primaryImageFile)
          : bannerSettings.primaryImageUrl;
        
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = bannerSettings.primaryImageFile ? 'anonymous' : 'anonymous';
          img.onload = () => {
            const cornerRadius = bannerSettings.primaryImageRounded ? bannerSettings.primaryImageCornerRadius : 0;
            
            // Save context for clipping
            ctx.save();
            
            // Create rounded rectangle path if rounding is enabled
            if (bannerSettings.primaryImageRounded && cornerRadius > 0) {
              ctx.beginPath();
              ctx.moveTo(imgAreaX + cornerRadius, imgAreaY);
              ctx.lineTo(imgAreaX + imgAreaWidth - cornerRadius, imgAreaY);
              ctx.quadraticCurveTo(imgAreaX + imgAreaWidth, imgAreaY, imgAreaX + imgAreaWidth, imgAreaY + cornerRadius);
              ctx.lineTo(imgAreaX + imgAreaWidth, imgAreaY + imgAreaHeight - cornerRadius);
              ctx.quadraticCurveTo(imgAreaX + imgAreaWidth, imgAreaY + imgAreaHeight, imgAreaX + imgAreaWidth - cornerRadius, imgAreaY + imgAreaHeight);
              ctx.lineTo(imgAreaX + cornerRadius, imgAreaY + imgAreaHeight);
              ctx.quadraticCurveTo(imgAreaX, imgAreaY + imgAreaHeight, imgAreaX, imgAreaY + imgAreaHeight - cornerRadius);
              ctx.lineTo(imgAreaX, imgAreaY + cornerRadius);
              ctx.quadraticCurveTo(imgAreaX, imgAreaY, imgAreaX + cornerRadius, imgAreaY);
              ctx.closePath();
              ctx.clip();
            }
            
            // Draw image
            ctx.drawImage(img, imgAreaX, imgAreaY, imgAreaWidth, imgAreaHeight);
            
            // Restore context
            ctx.restore();
            
            // Add blending/fade on left edge if enabled
            if (bannerSettings.primaryImageBlend) {
              const blendWidth = bannerSettings.primaryImageBlendWidth || 40;
              const gradient = ctx.createLinearGradient(imgAreaX, 0, imgAreaX + blendWidth, 0);
              gradient.addColorStop(0, 'rgba(245, 241, 232, 0.7)'); // Antique paper color with opacity
              gradient.addColorStop(1, 'rgba(245, 241, 232, 0)');
              ctx.fillStyle = gradient;
              ctx.fillRect(imgAreaX, imgAreaY, blendWidth, imgAreaHeight);
            }
            
            // Clean up object URL if we created one
            if (bannerSettings.primaryImageFile) {
              URL.revokeObjectURL(primaryImageSrc);
            }
            resolve();
          };
          img.onerror = () => {
            // If primary image fails, continue without it
            console.warn('Primary image failed to load');
            if (bannerSettings.primaryImageFile) {
              URL.revokeObjectURL(primaryImageSrc);
            }
            resolve();
          };
          img.src = primaryImageSrc;
        });
      }
      
      // Draw text content - centered in left 50% of banner with vintage/antique theme
      // First, add a semi-transparent background behind text area so background image shows through
      const textAreaWidth = (canvas.width * bannerSettings.textAreaWidth) / 100;
      const textAreaCenterX = textAreaWidth / 2;
      const horizontalPadding = 40; // Padding from edges
      const maxTextWidth = textAreaWidth - (horizontalPadding * 2);
      
      // Draw semi-transparent antique paper background behind text area - allows background image to show through
      // Convert hex color to rgba for transparency
      const baseColor = bannerSettings.baseBackgroundColor || ginzeyColors.antiquePaper;
      // Extract RGB values from hex
      const r = parseInt(baseColor.slice(1, 3), 16);
      const g = parseInt(baseColor.slice(3, 5), 16);
      const b = parseInt(baseColor.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.75)`; // 75% opacity - allows background image to show through
      ctx.fillRect(0, 0, textAreaWidth, canvas.height);
      
      // Calculate total height of all text elements first (for vertical centering)
      let totalTextHeight = 0;
      
      // Title (English)
      if (bannerSettings.title) {
        ctx.font = `bold ${bannerSettings.fontSize * 1.2}px ${bannerSettings.fontFamily}`;
        const titleHeight = measureTextHeight(ctx, bannerSettings.title, maxTextWidth, bannerSettings.fontSize * 1.5);
        totalTextHeight += titleHeight + bannerSettings.textPadding;
      }
      
      // Decorative line
      if (bannerSettings.title && bannerSettings.titleHebrew) {
        totalTextHeight += bannerSettings.textPadding;
      }
      
      // Title (Hebrew)
      if (bannerSettings.titleHebrew) {
        ctx.font = `bold ${bannerSettings.fontSize * 1.2}px ${bannerSettings.hebrewFontFamily}`;
        const titleHebrewHeight = measureTextHeight(ctx, bannerSettings.titleHebrew, maxTextWidth, bannerSettings.fontSize * 1.5);
        totalTextHeight += titleHebrewHeight + bannerSettings.textPadding;
      }
      
      // Year
      if (bannerSettings.yearEnglish || bannerSettings.yearHebrew) {
        totalTextHeight += bannerSettings.fontSize * 0.8 + bannerSettings.textPadding;
      }
      
      // Subtitle (English)
      if (bannerSettings.subtitle) {
        ctx.font = `${bannerSettings.fontSize * 0.45}px ${bannerSettings.fontFamily}`;
        const subtitleHeight = measureTextHeight(ctx, bannerSettings.subtitle, maxTextWidth, bannerSettings.fontSize * 0.7);
        totalTextHeight += subtitleHeight + bannerSettings.textPadding;
      }
      
      // Subtitle (Hebrew)
      if (bannerSettings.subtitleHebrew) {
        ctx.font = `${bannerSettings.fontSize * 0.45}px ${bannerSettings.hebrewFontFamily}`;
        const subtitleHebrewHeight = measureTextHeight(ctx, bannerSettings.subtitleHebrew, maxTextWidth, bannerSettings.fontSize * 0.7);
        totalTextHeight += subtitleHebrewHeight + bannerSettings.textPadding;
      }
      
      // Category ribbon is positioned at corner, doesn't affect text height calculation
      
      // Calculate starting Y position to center content vertically
      const textAreaHeight = canvas.height;
      const verticalPadding = Math.max(bannerSettings.textMarginTop, bannerSettings.textMarginBottom);
      const availableHeight = textAreaHeight - (verticalPadding * 2);
      const startY = (textAreaHeight - totalTextHeight) / 2;
      
      // Now draw text
      ctx.fillStyle = bannerSettings.textColor;
      ctx.textBaseline = 'top'; // Use top baseline for consistent positioning
      
      // Start from calculated centered position
      let currentY = startY;
      
      // Draw title (English) - centered, serif font for vintage look - BIGGER
      if (bannerSettings.title) {
        ctx.font = `bold ${bannerSettings.fontSize * 1.2}px ${bannerSettings.fontFamily}`;
        ctx.textAlign = 'center';
        const titleHeight = wrapTextCentered(ctx, bannerSettings.title, textAreaCenterX, currentY, maxTextWidth, bannerSettings.fontSize * 1.5);
        currentY += titleHeight + bannerSettings.textPadding;
      }
      
      // Draw decorative line between English and Hebrew titles
      if (bannerSettings.title && bannerSettings.titleHebrew) {
        const lineY = currentY - (bannerSettings.textPadding / 2);
        const lineWidth = maxTextWidth * 0.6;
        const lineX = textAreaCenterX - (lineWidth / 2);
        
        // Draw decorative vintage line with ornament
        ctx.strokeStyle = bannerSettings.textColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Left ornament
        ctx.moveTo(lineX, lineY);
        ctx.lineTo(lineX + 15, lineY);
        ctx.moveTo(lineX + 5, lineY - 3);
        ctx.lineTo(lineX + 5, lineY + 3);
        // Center line
        ctx.moveTo(lineX + 20, lineY);
        ctx.lineTo(lineX + lineWidth - 20, lineY);
        // Right ornament
        ctx.moveTo(lineX + lineWidth - 15, lineY);
        ctx.lineTo(lineX + lineWidth, lineY);
        ctx.moveTo(lineX + lineWidth - 5, lineY - 3);
        ctx.lineTo(lineX + lineWidth - 5, lineY + 3);
        ctx.stroke();
        
        currentY += bannerSettings.textPadding;
      }
      
      // Draw title (Hebrew) if provided - centered, Frank Ruhl or Cardo font - BIGGER
      if (bannerSettings.titleHebrew) {
        ctx.font = `bold ${bannerSettings.fontSize * 1.2}px ${bannerSettings.hebrewFontFamily}`;
        ctx.textAlign = 'center';
        const titleHebrewHeight = wrapTextCentered(ctx, bannerSettings.titleHebrew, textAreaCenterX, currentY, maxTextWidth, bannerSettings.fontSize * 1.5);
        currentY += titleHebrewHeight + bannerSettings.textPadding;
      }
      
      // Draw year (English and Hebrew) - centered together with vintage styling - BIGGER
      if (bannerSettings.yearEnglish || bannerSettings.yearHebrew) {
        ctx.font = `italic ${bannerSettings.fontSize * 0.7}px ${bannerSettings.fontFamily}`;
        ctx.textAlign = 'center';
        let yearText = '';
        if (bannerSettings.yearEnglish) {
          yearText = bannerSettings.yearEnglish;
        }
        if (bannerSettings.yearHebrew) {
          if (yearText) yearText += ' / ';
          yearText += bannerSettings.yearHebrew;
        }
        if (yearText) {
          ctx.fillText(yearText, textAreaCenterX, currentY);
          currentY += bannerSettings.fontSize * 0.8 + bannerSettings.textPadding;
        }
      }
      
      // Draw subtitle (English) - centered
      if (bannerSettings.subtitle) {
        ctx.font = `${bannerSettings.fontSize * 0.45}px ${bannerSettings.fontFamily}`;
        ctx.textAlign = 'center';
        const subtitleHeight = wrapTextCentered(ctx, bannerSettings.subtitle, textAreaCenterX, currentY, maxTextWidth, bannerSettings.fontSize * 0.7);
        currentY += subtitleHeight + bannerSettings.textPadding;
      }
      
      // Draw subtitle (Hebrew) if provided - centered
      if (bannerSettings.subtitleHebrew) {
        ctx.font = `${bannerSettings.fontSize * 0.45}px ${bannerSettings.hebrewFontFamily}`;
        ctx.textAlign = 'center';
        const subtitleHebrewHeight = wrapTextCentered(ctx, bannerSettings.subtitleHebrew, textAreaCenterX, currentY, maxTextWidth, bannerSettings.fontSize * 0.7);
        currentY += subtitleHebrewHeight + bannerSettings.textPadding;
      }
      
      // Draw category ribbon if provided - simple diagonal ribbon (no fold) from corner
      if (bannerSettings.category || bannerSettings.categoryHebrew) {
        // Scale based on banner size
        const scaleFactor = Math.min(canvas.width / 1200, canvas.height / 630);
        const ribbonLength = 350 * scaleFactor; // Length of the ribbon
        const ribbonThickness = 90 * scaleFactor; // Thickness of the ribbon
        
        ctx.font = `bold ${bannerSettings.fontSize * 0.6}px ${bannerSettings.fontFamily}`;
        const categoryText = bannerSettings.category ? bannerSettings.category.toUpperCase() : '';
        const categoryHebrewText = bannerSettings.categoryHebrew || '';
        
        // Measure text to ensure it fits inside ribbon
        let textWidth = 0;
        if (categoryText) {
          textWidth += ctx.measureText(categoryText).width;
        }
        if (categoryHebrewText) {
          ctx.font = `bold ${bannerSettings.fontSize * 0.6}px ${bannerSettings.hebrewFontFamily}`;
          textWidth += ctx.measureText(categoryHebrewText).width + (categoryText ? 20 : 0);
        }
        
        const isTopRight = bannerSettings.categoryRibbonPosition === 'top-right';
        const angle = Math.PI / 4; // 45 degrees
        const cos45 = Math.cos(angle);
        const sin45 = Math.sin(angle);
        
        // Position ribbon starting from corner
        let cornerX, cornerY;
        if (isTopRight) {
          // Top-right: start at top-right corner of text area
          cornerX = textAreaWidth;
          cornerY = 0;
        } else {
          // Top-left: start at top-left corner
          cornerX = 0;
          cornerY = 0;
        }
        
        // Calculate pivot point for rotation (the corner)
        const pivotX = cornerX;
        const pivotY = cornerY;
        
        // Calculate the center of the horizontal ribbon before rotation
        // For top-left: ribbon extends right from corner, so center is at cornerX + ribbonLength/2
        // For top-right: ribbon extends left from corner, so center is at cornerX - ribbonLength/2
        const ribbonCenterX = isTopRight 
          ? pivotX - ribbonLength / 2
          : pivotX + ribbonLength / 2;
        const ribbonCenterY = pivotY + ribbonThickness / 2;
        
        // Draw ribbon shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.save();
        ctx.translate(pivotX + 4, pivotY + 4);
        ctx.rotate(isTopRight ? -angle : angle);
        ctx.fillRect(-ribbonLength / 2, 0, ribbonLength, ribbonThickness);
        ctx.restore();
        
        // Draw main ribbon
        ctx.fillStyle = bannerSettings.categoryColor || ginzeyColors.red;
        ctx.save();
        ctx.translate(pivotX, pivotY);
        ctx.rotate(isTopRight ? -angle : angle);
        ctx.fillRect(-ribbonLength / 2, 0, ribbonLength, ribbonThickness);
        ctx.restore();
        
        // Draw ribbon border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2 * scaleFactor;
        ctx.save();
        ctx.translate(pivotX, pivotY);
        ctx.rotate(isTopRight ? -angle : angle);
        ctx.strokeRect(-ribbonLength / 2, 0, ribbonLength, ribbonThickness);
        ctx.restore();
        
        // Draw category text INSIDE the ribbon (rotated to match diagonal)
        ctx.fillStyle = ginzeyColors.lightText;
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.translate(pivotX, pivotY);
        ctx.rotate(isTopRight ? -angle : angle);
        
        // Draw text centered inside ribbon
        ctx.textAlign = 'center';
        if (categoryText) {
          ctx.font = `bold ${bannerSettings.fontSize * 0.6}px ${bannerSettings.fontFamily}`;
          ctx.fillText(categoryText, 0, ribbonThickness / 2);
        }
        if (categoryHebrewText) {
          ctx.font = `bold ${bannerSettings.fontSize * 0.6}px ${bannerSettings.hebrewFontFamily}`;
          const offset = categoryText ? ctx.measureText(categoryText).width / 2 + 15 : 0;
          ctx.fillText(categoryHebrewText, offset, ribbonThickness / 2);
        }
        
        ctx.restore();
      }
      
      // Draw "Ginzey America" branding at bottom - centered (always at bottom, not affected by vertical centering)
      ctx.font = `italic ${bannerSettings.fontSize * 0.35}px ${bannerSettings.fontFamily}`;
      ctx.fillStyle = ginzeyColors.darkText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('Ginzey America', textAreaCenterX, canvas.height - bannerSettings.textMarginBottom - 20);
      
      // Convert canvas to image
      generatedBannerUrl = canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating banner:', error);
      alert(`Error generating banner: ${error.message || 'Please check image files and try again.'}`);
    } finally {
      generating = false;
    }
  }
  
  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    let totalHeight = 0;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        context.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
        totalHeight += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, x, currentY);
    totalHeight += lineHeight;
    return totalHeight;
  }
  
  function wrapTextRTL(context, text, x, y, maxWidth, lineHeight) {
    // For RTL text, we need to handle it differently
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    let totalHeight = 0;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = (words[n] + ' ' + line).trim();
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        context.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
        totalHeight += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, x, currentY);
    totalHeight += lineHeight;
    return totalHeight;
  }
  
  function wrapTextCentered(context, text, centerX, startY, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = startY;
    let totalHeight = 0;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        context.fillText(line.trim(), centerX, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
        totalHeight += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line.trim(), centerX, currentY);
    totalHeight += lineHeight;
    return totalHeight;
  }
  
  // Helper function to measure text height without drawing (for centering calculations)
  function measureTextHeight(context, text, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let totalHeight = 0;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        line = words[n] + ' ';
        totalHeight += lineHeight;
      } else {
        line = testLine;
      }
    }
    totalHeight += lineHeight;
    return totalHeight;
  }
  
  function downloadBanner() {
    if (!generatedBannerUrl) return;
    
    const link = document.createElement('a');
    link.download = `banner-${selectedLot?.id || auction?.id || 'banner'}.png`;
    link.href = generatedBannerUrl;
    link.click();
  }
  
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
</script>

{#if loading}
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <PumbiLoader size="lg" label="Loading" />
      <p class="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
{:else if auction}
  <div class="min-h-screen bg-gray-50">
    <div class="container mx-auto px-4 py-8">
      <button
        onclick={() => goto(`/seller/auctions/${auction.id}/lots`)}
        class="text-blue-600 hover:text-blue-800 mb-6 flex items-center"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Lots Management
      </button>

      <div class="mb-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">Banner Generator Tool</h1>
        <p class="text-gray-600 text-lg">Create promotional banners for your Judaica lots and auctions</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Settings Panel -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-lg shadow-lg p-6 sticky top-4">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Banner Settings</h2>
            
            <!-- Lot Selection -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Select Lot (Optional)
              </label>
              <select
                bind:value={selectedLotId}
                onchange={(e) => {
                  const lotId = e.target.value;
                  if (lotId) {
                    const lot = lots.find(l => l.id === lotId);
                    if (lot) {
                      selectLot(lot);
                    }
                  } else {
                    selectedLot = null;
                    selectedLotId = '';
                    // Reset to auction defaults
                    if (auction) {
                      bannerSettings.title = auction.title;
                      bannerSettings.subtitle = auction.description.substring(0, 150);
                      bannerSettings.primaryImageUrl = auction.imageUrl;
                      bannerSettings.backgroundImageUrl = auction.imageUrl;
                    }
                  }
                }}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">-- Select a lot --</option>
                {#each lots as lot}
                  <option value={lot.id}>
                    Lot #{lot.lotNumber}: {lot.title}
                  </option>
                {/each}
              </select>
              {#if selectedLot}
                <div class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p class="text-sm font-semibold text-blue-900">Selected: Lot #{selectedLot.lotNumber}</p>
                  <p class="text-xs text-blue-700 mt-1">{selectedLot.title}</p>
                </div>
              {/if}
            </div>

            <!-- Font Selection -->
            <div class="mb-4">
              <label for="fontFamily" class="block text-sm font-medium text-gray-700 mb-2">
                English Font
              </label>
              <select
                id="fontFamily"
                bind:value={bannerSettings.fontFamily}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {#each fonts as font}
                  <option value={font.value} selected={font.default}>{font.name}</option>
                {/each}
              </select>
            </div>

            <div class="mb-4">
              <label for="hebrewFontFamily" class="block text-sm font-medium text-gray-700 mb-2">
                Hebrew Font
              </label>
              <select
                id="hebrewFontFamily"
                bind:value={bannerSettings.hebrewFontFamily}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {#each hebrewFonts as font}
                  <option value={font.value}>{font.name}</option>
                {/each}
              </select>
            </div>

            <!-- Title -->
            <div class="mb-4">
              <label for="title" class="block text-sm font-medium text-gray-700 mb-2">
                Title (English) *
              </label>
              <input
                id="title"
                type="text"
                bind:value={bannerSettings.title}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                placeholder="Auction or Lot Title"
              />
              {#if bannerSettings.title}
                <p class="mt-1 text-xs text-gray-500">Preview: {bannerSettings.title}</p>
              {/if}
            </div>

            <!-- Title Hebrew -->
            <div class="mb-4">
              <label for="titleHebrew" class="block text-sm font-medium text-gray-700 mb-2">
                Title (Hebrew)
              </label>
              <input
                id="titleHebrew"
                type="text"
                bind:value={bannerSettings.titleHebrew}
                dir="rtl"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-right"
                placeholder="כותרת בעברית"
              />
              {#if bannerSettings.titleHebrew}
                <p class="mt-1 text-xs text-gray-500">Hebrew: {bannerSettings.titleHebrew}</p>
              {/if}
            </div>

            <!-- Subtitle -->
            <div class="mb-4">
              <label for="subtitle" class="block text-sm font-medium text-gray-700 mb-2">
                Subtitle / Description (English)
              </label>
              <textarea
                id="subtitle"
                bind:value={bannerSettings.subtitle}
                rows="3"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                placeholder="Brief description..."
              ></textarea>
              {#if bannerSettings.subtitle}
                <p class="mt-1 text-xs text-gray-500">Length: {bannerSettings.subtitle.length} characters</p>
              {/if}
            </div>

            <!-- Subtitle Hebrew -->
            <div class="mb-4">
              <label for="subtitleHebrew" class="block text-sm font-medium text-gray-700 mb-2">
                Subtitle / Description (Hebrew)
              </label>
              <textarea
                id="subtitleHebrew"
                bind:value={bannerSettings.subtitleHebrew}
                rows="3"
                dir="rtl"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-right"
                placeholder="תיאור קצר בעברית..."
              ></textarea>
              {#if bannerSettings.subtitleHebrew}
                <p class="mt-1 text-xs text-gray-500">Hebrew length: {bannerSettings.subtitleHebrew.length} characters</p>
              {/if}
            </div>

            <!-- Category -->
            <div class="mb-4">
              <label for="category" class="block text-sm font-medium text-gray-700 mb-2">
                Category (English)
              </label>
              <input
                id="category"
                type="text"
                bind:value={bannerSettings.category}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                placeholder="e.g., Menorahs, Torah Scrolls"
              />
              {#if bannerSettings.category}
                <p class="mt-1 text-xs text-gray-500">Category: {bannerSettings.category}</p>
              {/if}
            </div>

            <!-- Category Hebrew -->
            <div class="mb-4">
              <label for="categoryHebrew" class="block text-sm font-medium text-gray-700 mb-2">
                Category (Hebrew)
              </label>
              <input
                id="categoryHebrew"
                type="text"
                bind:value={bannerSettings.categoryHebrew}
                dir="rtl"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-right"
                placeholder="למשל: מנורות, ספרי תורה"
              />
              {#if bannerSettings.categoryHebrew}
                <p class="mt-1 text-xs text-gray-500">Hebrew category: {bannerSettings.categoryHebrew}</p>
              {/if}
            </div>

            <!-- Year (English) -->
            <div class="mb-4">
              <label for="yearEnglish" class="block text-sm font-medium text-gray-700 mb-2">
                Year (English)
              </label>
              <input
                id="yearEnglish"
                type="text"
                bind:value={bannerSettings.yearEnglish}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                placeholder="e.g., 1890 or c. 1850"
                oninput={(e) => {
                  // Auto-convert to Hebrew year if possible
                  const yearMatch = e.target.value.match(/\b(18|19|20)\d{2}\b/);
                  if (yearMatch) {
                    bannerSettings.yearHebrew = convertToHebrewYear(yearMatch[0]);
                  }
                }}
              />
              {#if bannerSettings.yearEnglish}
                <p class="mt-1 text-xs text-gray-500">English year: {bannerSettings.yearEnglish}</p>
              {/if}
            </div>

            <!-- Year (Hebrew) -->
            <div class="mb-4">
              <label for="yearHebrew" class="block text-sm font-medium text-gray-700 mb-2">
                Year (Hebrew)
              </label>
              <input
                id="yearHebrew"
                type="text"
                bind:value={bannerSettings.yearHebrew}
                dir="rtl"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-right"
                placeholder="תר״נ"
              />
              {#if bannerSettings.yearHebrew}
                <p class="mt-1 text-xs text-gray-500">Hebrew year: {bannerSettings.yearHebrew}</p>
              {/if}
            </div>

            <!-- Primary Image -->
            <div class="mb-4">
              <label for="primaryImage" class="block text-sm font-medium text-gray-700 mb-2">
                Primary Image(s) *
              </label>
              
              <!-- Multiple File Upload Option (Collage) -->
              <div class="mb-2">
                <label for="primaryImageFiles" class="block text-xs text-gray-600 mb-1">
                  Upload Multiple Images (Collage)
                </label>
                <input
                  id="primaryImageFiles"
                  type="file"
                  accept="image/*"
                  multiple
                  onchange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      bannerSettings.primaryImageFiles = files;
                      bannerSettings.primaryImageFile = null; // Clear single file
                      bannerSettings.primaryImageUrl = ''; // Clear URL
                    }
                  }}
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                />
                <p class="text-xs text-gray-500 mt-1">Select multiple images for a staggered collage layout</p>
              </div>
              
              <!-- Single File Upload Option -->
              <div class="mb-2">
                <label for="primaryImageFile" class="block text-xs text-gray-600 mb-1">
                  Upload Single Image File
                </label>
                <input
                  id="primaryImageFile"
                  type="file"
                  accept="image/*"
                  onchange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      bannerSettings.primaryImageFile = file;
                      bannerSettings.primaryImageFiles = []; // Clear multiple files
                      bannerSettings.primaryImageUrl = ''; // Clear URL
                    }
                  }}
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                />
              </div>
              
              <!-- OR divider -->
              <div class="flex items-center my-2">
                <div class="flex-1 border-t border-gray-300"></div>
                <span class="px-2 text-xs text-gray-500">OR</span>
                <div class="flex-1 border-t border-gray-300"></div>
              </div>
              
              <!-- URL Input Option -->
              <div>
                <label for="primaryImageUrl" class="block text-xs text-gray-600 mb-1">
                  Image URL
                </label>
                <input
                  id="primaryImageUrl"
                  type="url"
                  bind:value={bannerSettings.primaryImageUrl}
                  oninput={(e) => {
                    if (e.target.value) {
                      bannerSettings.primaryImageFile = null; // Clear file when URL is entered
                      bannerSettings.primaryImageFiles = []; // Clear multiple files
                    }
                  }}
                  class="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              
              <!-- Preview Multiple Images -->
              {#if bannerSettings.primaryImageFiles && bannerSettings.primaryImageFiles.length > 0}
                <div class="mt-2">
                  <p class="text-xs text-gray-600 mb-2">Collage Preview ({bannerSettings.primaryImageFiles.length} image(s)):</p>
                  <div class="grid grid-cols-2 gap-2">
                    {#each bannerSettings.primaryImageFiles as file}
                      <div class="relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt="Collage image preview"
                          class="w-full h-24 object-cover rounded-lg border border-gray-200"
                          onerror={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <button
                          type="button"
                          onclick={() => {
                            bannerSettings.primaryImageFiles = bannerSettings.primaryImageFiles.filter(f => f !== file);
                          }}
                          class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                          title="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    {/each}
                  </div>
                </div>
              <!-- Preview Single File -->
              {:else if bannerSettings.primaryImageFile}
                <div class="mt-2">
                  <img
                    src={URL.createObjectURL(bannerSettings.primaryImageFile)}
                    alt="Primary image preview"
                    class="w-full h-32 object-cover rounded-lg border border-gray-200"
                    onerror={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <p class="text-xs text-gray-500 mt-1">File: {bannerSettings.primaryImageFile.name}</p>
                </div>
              <!-- Preview URL -->
              {:else if bannerSettings.primaryImageUrl}
                <div class="mt-2">
                  <img
                    src={bannerSettings.primaryImageUrl}
                    alt="Primary image preview"
                    class="w-full h-32 object-cover rounded-lg border border-gray-200"
                    onerror={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              {/if}
              
              <!-- Primary Image Styling Options -->
              <div class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">Image Styling Options</h4>
                
                <!-- Rounded Corners Toggle -->
                <div class="mb-3">
                  <label class="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      bind:checked={bannerSettings.primaryImageRounded}
                      class="mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span class="text-sm text-gray-700">Enable Rounded Corners</span>
                  </label>
                </div>
                
                <!-- Corner Radius -->
                {#if bannerSettings.primaryImageRounded}
                  <div class="mb-3">
                    <label for="cornerRadius" class="block text-xs text-gray-600 mb-1">
                      Corner Radius: {bannerSettings.primaryImageCornerRadius}px
                    </label>
                    <input
                      id="cornerRadius"
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      bind:value={bannerSettings.primaryImageCornerRadius}
                      class="w-full"
                    />
                  </div>
                {/if}
                
                <!-- Blending Toggle -->
                <div class="mb-3">
                  <label class="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      bind:checked={bannerSettings.primaryImageBlend}
                      class="mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span class="text-sm text-gray-700">Enable Edge Blending (Fade)</span>
                  </label>
                </div>
                
                <!-- Blend Width -->
                {#if bannerSettings.primaryImageBlend}
                  <div>
                    <label for="blendWidth" class="block text-xs text-gray-600 mb-1">
                      Blend Width: {bannerSettings.primaryImageBlendWidth}px
                    </label>
                    <input
                      id="blendWidth"
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      bind:value={bannerSettings.primaryImageBlendWidth}
                      class="w-full"
                    />
                    <p class="text-xs text-gray-500 mt-1">Controls how far the fade extends from the left edge</p>
                  </div>
                {/if}
                
                <!-- Collage Layout Options (only show if multiple images) -->
                {#if bannerSettings.primaryImageFiles && bannerSettings.primaryImageFiles.length > 1}
                  <div class="mt-4 pt-4 border-t border-gray-300">
                    <h5 class="text-sm font-semibold text-gray-700 mb-3">Collage Layout Options</h5>
                    
                    <!-- Center Image Size -->
                    <div class="mb-3">
                      <label for="centerImageSize" class="block text-xs text-gray-600 mb-1">
                        Center Image Size: {Math.round(bannerSettings.collageCenterImageSize * 100)}%
                      </label>
                      <input
                        id="centerImageSize"
                        type="range"
                        min="0.3"
                        max="0.8"
                        step="0.05"
                        bind:value={bannerSettings.collageCenterImageSize}
                        class="w-full"
                      />
                      <p class="text-xs text-gray-500 mt-1">Size of the first (center) image</p>
                    </div>
                    
                    <!-- Other Images Size -->
                    <div class="mb-3">
                      <label for="otherImageSize" class="block text-xs text-gray-600 mb-1">
                        Other Images Size: {Math.round(bannerSettings.collageOtherImageSize * 100)}%
                      </label>
                      <input
                        id="otherImageSize"
                        type="range"
                        min="0.15"
                        max="0.5"
                        step="0.05"
                        bind:value={bannerSettings.collageOtherImageSize}
                        class="w-full"
                      />
                      <p class="text-xs text-gray-500 mt-1">Size of surrounding images</p>
                    </div>
                    
                    <!-- Spacing -->
                    <div class="mb-3">
                      <label for="collageSpacing" class="block text-xs text-gray-600 mb-1">
                        Image Spacing: {bannerSettings.collageSpacing}px
                      </label>
                      <input
                        id="collageSpacing"
                        type="range"
                        min="5"
                        max="50"
                        step="5"
                        bind:value={bannerSettings.collageSpacing}
                        class="w-full"
                      />
                      <p class="text-xs text-gray-500 mt-1">Space between images</p>
                    </div>
                    
                    <!-- Stagger Amount -->
                    <div>
                      <label for="collageStagger" class="block text-xs text-gray-600 mb-1">
                        Stagger Amount: {Math.round(bannerSettings.collageStaggerAmount * 100)}%
                      </label>
                      <input
                        id="collageStagger"
                        type="range"
                        min="0"
                        max="0.3"
                        step="0.05"
                        bind:value={bannerSettings.collageStaggerAmount}
                        class="w-full"
                      />
                      <p class="text-xs text-gray-500 mt-1">Amount of offset/stagger for surrounding images</p>
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Background Image -->
            <div class="mb-4">
              <label for="backgroundImage" class="block text-sm font-medium text-gray-700 mb-2">
                Background Image (Optional)
              </label>
              
              <!-- File Upload Option -->
              <div class="mb-2">
                <label for="backgroundImageFile" class="block text-xs text-gray-600 mb-1">
                  Upload Image File
                </label>
                <input
                  id="backgroundImageFile"
                  type="file"
                  accept="image/*"
                  onchange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      bannerSettings.backgroundImageFile = file;
                      bannerSettings.backgroundImageUrl = ''; // Clear URL when file is selected
                    }
                  }}
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                />
              </div>
              
              <!-- OR divider -->
              <div class="flex items-center my-2">
                <div class="flex-1 border-t border-gray-300"></div>
                <span class="px-2 text-xs text-gray-500">OR</span>
                <div class="flex-1 border-t border-gray-300"></div>
              </div>
              
              <!-- URL Input Option -->
              <div>
                <label for="backgroundImageUrl" class="block text-xs text-gray-600 mb-1">
                  Image URL
                </label>
                <input
                  id="backgroundImageUrl"
                  type="url"
                  bind:value={bannerSettings.backgroundImageUrl}
                  oninput={(e) => {
                    if (e.target.value) {
                      bannerSettings.backgroundImageFile = null; // Clear file when URL is entered
                    }
                  }}
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  placeholder="https://example.com/background.jpg"
                />
              </div>
              
              <p class="mt-1 text-xs text-gray-500">If not provided, antique paper background will be used</p>
              
              <!-- Preview -->
              {#if bannerSettings.backgroundImageFile}
                <div class="mt-2">
                  <img
                    src={URL.createObjectURL(bannerSettings.backgroundImageFile)}
                    alt="Background image preview"
                    class="w-full h-32 object-cover rounded-lg border border-gray-200 opacity-30"
                    onerror={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <p class="text-xs text-gray-500 mt-1">File: {bannerSettings.backgroundImageFile.name} (shown at 30% opacity for preview)</p>
                </div>
              {:else if bannerSettings.backgroundImageUrl}
                <div class="mt-2">
                  <img
                    src={bannerSettings.backgroundImageUrl}
                    alt="Background image preview"
                    class="w-full h-32 object-cover rounded-lg border border-gray-200 opacity-30"
                    onerror={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <p class="text-xs text-gray-500 mt-1">(shown at 30% opacity for preview)</p>
                </div>
              {/if}
            </div>

            <!-- Base Background Color -->
            <div class="mb-4">
              <label for="baseBackgroundColor" class="block text-sm font-medium text-gray-700 mb-2">
                Base Background Color (Antique Paper)
              </label>
              <input
                id="baseBackgroundColor"
                type="color"
                bind:value={bannerSettings.baseBackgroundColor}
                class="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
              <p class="text-xs text-gray-500 mt-1">Default: Antique paper (#F5F1E8)</p>
            </div>

            <!-- Text Color -->
            <div class="mb-4">
              <label for="textColor" class="block text-sm font-medium text-gray-700 mb-2">
                Text Color
              </label>
              <input
                id="textColor"
                type="color"
                bind:value={bannerSettings.textColor}
                class="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
              <p class="text-xs text-gray-500 mt-1">Default: Dark brown (#2C1810)</p>
            </div>

            <!-- Category Ribbon -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Category Ribbon (Ginzey America Colors)
              </label>
              
              <!-- Ribbon Position -->
              <div class="mb-3">
                <label for="ribbonPosition" class="block text-xs text-gray-600 mb-1">
                  Ribbon Position
                </label>
                <div class="flex gap-2">
                  <button
                    type="button"
                    onclick={() => bannerSettings.categoryRibbonPosition = 'top-left'}
                    class="flex-1 px-3 py-2 rounded-lg border-2 transition-colors {bannerSettings.categoryRibbonPosition === 'top-left' ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-white'}"
                  >
                    <span class="text-xs">Top Left</span>
                  </button>
                  <button
                    type="button"
                    onclick={() => bannerSettings.categoryRibbonPosition = 'top-right'}
                    class="flex-1 px-3 py-2 rounded-lg border-2 transition-colors {bannerSettings.categoryRibbonPosition === 'top-right' ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-white'}"
                  >
                    <span class="text-xs">Top Right</span>
                  </button>
                </div>
              </div>
              
              <!-- Ribbon Color -->
              <div class="mb-2">
                <label class="block text-xs text-gray-600 mb-1">
                  Ribbon Color
                </label>
                <div class="flex gap-2 mb-2">
                  <button
                    type="button"
                    onclick={() => bannerSettings.categoryColor = ginzeyColors.red}
                    class="flex-1 px-3 py-2 rounded-lg border-2 transition-colors {bannerSettings.categoryColor === ginzeyColors.red ? 'border-red-600 bg-red-50' : 'border-gray-300 bg-white'}"
                  >
                    <div class="w-full h-6 rounded" style="background-color: {ginzeyColors.red};"></div>
                    <span class="text-xs mt-1">Red</span>
                  </button>
                  <button
                    type="button"
                    onclick={() => bannerSettings.categoryColor = ginzeyColors.blue}
                    class="flex-1 px-3 py-2 rounded-lg border-2 transition-colors {bannerSettings.categoryColor === ginzeyColors.blue ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-white'}"
                  >
                    <div class="w-full h-6 rounded" style="background-color: {ginzeyColors.blue};"></div>
                    <span class="text-xs mt-1">Blue</span>
                  </button>
                </div>
                <input
                  id="categoryColor"
                  type="color"
                  bind:value={bannerSettings.categoryColor}
                  class="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <!-- Banner Dimensions -->
            <div class="mb-4">
              <label for="dimensions" class="block text-sm font-medium text-gray-700 mb-2">
                Banner Size
              </label>
              <select
                id="dimensions"
                bind:value={selectedPreset}
                onchange={(e) => {
                  const preset = presetDimensions.find(p => p.name === e.target.value);
                  if (preset) {
                    bannerSettings.width = preset.width;
                    bannerSettings.height = preset.height;
                  }
                }}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {#each presetDimensions as preset}
                  <option value={preset.name}>{preset.name} ({preset.width}×{preset.height})</option>
                {/each}
              </select>
            </div>

            <!-- Custom Dimensions (if Custom selected) -->
            {#if selectedPreset === 'Custom'}
              <div class="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <label for="customWidth" class="block text-sm font-medium text-gray-700 mb-2">
                    Width
                  </label>
                  <input
                    id="customWidth"
                    type="number"
                    bind:value={bannerSettings.width}
                    min="100"
                    max="4000"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="customHeight" class="block text-sm font-medium text-gray-700 mb-2">
                    Height
                  </label>
                  <input
                    id="customHeight"
                    type="number"
                    bind:value={bannerSettings.height}
                    min="100"
                    max="4000"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            {/if}

            <!-- Background Image Opacity (Subtlety) -->
            <div class="mb-4">
              <label for="backgroundImageOpacity" class="block text-sm font-medium text-gray-700 mb-2">
                Background Image Opacity (Subtlety)
              </label>
              <input
                id="backgroundImageOpacity"
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value="0.25"
                oninput={(e) => {
                  // Store for use in generateBanner function
                  bannerSettings.backgroundImageOpacity = parseFloat(e.target.value);
                }}
                class="w-full"
              />
              <p class="text-xs text-gray-500 mt-1">Lower = more subtle background image (default: 0.15)</p>
            </div>

            <!-- Text Positioning Section -->
            <div class="mb-6 border-t pt-4">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Text Positioning & Spacing</h3>
              
              <!-- Text Area Width -->
              <div class="mb-4">
                <label for="textAreaWidth" class="block text-sm font-medium text-gray-700 mb-2">
                  Text Area Width (%)
                </label>
                <input
                  id="textAreaWidth"
                  type="number"
                  bind:value={bannerSettings.textAreaWidth}
                  min="30"
                  max="70"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p class="text-xs text-gray-500 mt-1">Width of text area (default: 50% - image takes remaining space)</p>
              </div>

              <!-- Margins -->
              <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label for="textMarginLeft" class="block text-sm font-medium text-gray-700 mb-2">
                    Left Margin (px)
                  </label>
                  <input
                    id="textMarginLeft"
                    type="number"
                    bind:value={bannerSettings.textMarginLeft}
                    min="0"
                    max="500"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="textMarginTop" class="block text-sm font-medium text-gray-700 mb-2">
                    Top Margin (px)
                  </label>
                  <input
                    id="textMarginTop"
                    type="number"
                    bind:value={bannerSettings.textMarginTop}
                    min="0"
                    max="500"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="textMarginRight" class="block text-sm font-medium text-gray-700 mb-2">
                    Right Margin (px)
                  </label>
                  <input
                    id="textMarginRight"
                    type="number"
                    bind:value={bannerSettings.textMarginRight}
                    min="0"
                    max="500"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="textMarginBottom" class="block text-sm font-medium text-gray-700 mb-2">
                    Bottom Margin (px)
                  </label>
                  <input
                    id="textMarginBottom"
                    type="number"
                    bind:value={bannerSettings.textMarginBottom}
                    min="0"
                    max="500"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <!-- Text Padding (spacing between elements) -->
              <div class="mb-4">
                <label for="textPadding" class="block text-sm font-medium text-gray-700 mb-2">
                  Text Padding/Spacing (px)
                </label>
                <input
                  id="textPadding"
                  type="number"
                  bind:value={bannerSettings.textPadding}
                  min="0"
                  max="100"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p class="text-xs text-gray-500 mt-1">Spacing between text elements (title, subtitle, etc.)</p>
              </div>
            </div>

            <!-- Generate Button -->
            <button
              onclick={generateBanner}
              disabled={generating || !bannerSettings.title || (!bannerSettings.primaryImageUrl && !bannerSettings.primaryImageFile && (!bannerSettings.primaryImageFiles || bannerSettings.primaryImageFiles.length === 0))}
              class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating...' : 'Generate Banner'}
            </button>
          </div>
        </div>

        <!-- Preview Panel -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Banner Preview</h2>
            
            {#if generatedBannerUrl}
              <div class="mb-6">
                <img
                  src={generatedBannerUrl}
                  alt="Generated Banner"
                  class="w-full rounded-lg shadow-lg"
                />
              </div>
              <button
                onclick={downloadBanner}
                class="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                Download Banner
              </button>
            {:else}
              <div class="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="mt-4 text-gray-600">Configure settings and click "Generate Banner" to create your promotional banner</p>
              </div>
            {/if}
          </div>

          <!-- Quick Templates -->
          <div class="mt-6 bg-white rounded-lg shadow-lg p-6">
            <h3 class="text-xl font-bold text-gray-900 mb-4">Ginzey America Quick Templates</h3>
            <div class="grid grid-cols-2 gap-4">
              <button
                onclick={() => {
                  bannerSettings.category = 'Menorahs';
                  bannerSettings.textColor = ginzeyColors.darkText;
                  bannerSettings.baseBackgroundColor = ginzeyColors.antiquePaper;
                  bannerSettings.categoryColor = ginzeyColors.red;
                }}
                class="px-4 py-2 bg-red-50 text-red-800 rounded-lg hover:bg-red-100 transition-colors border-2 border-red-200"
              >
                Menorahs (Red Sticker)
              </button>
              <button
                onclick={() => {
                  bannerSettings.category = 'Torah Scrolls';
                  bannerSettings.textColor = ginzeyColors.darkText;
                  bannerSettings.baseBackgroundColor = ginzeyColors.antiquePaper;
                  bannerSettings.categoryColor = ginzeyColors.blue;
                }}
                class="px-4 py-2 bg-blue-50 text-blue-800 rounded-lg hover:bg-blue-100 transition-colors border-2 border-blue-200"
              >
                Torah Scrolls (Blue Sticker)
              </button>
              <button
                onclick={() => {
                  bannerSettings.category = 'Ceremonial Silver';
                  bannerSettings.textColor = ginzeyColors.darkText;
                  bannerSettings.baseBackgroundColor = ginzeyColors.antiquePaper;
                  bannerSettings.categoryColor = ginzeyColors.red;
                }}
                class="px-4 py-2 bg-red-50 text-red-800 rounded-lg hover:bg-red-100 transition-colors border-2 border-red-200"
              >
                Ceremonial Silver (Red Sticker)
              </button>
              <button
                onclick={() => {
                  bannerSettings.category = 'Antique Judaica';
                  bannerSettings.textColor = ginzeyColors.darkText;
                  bannerSettings.baseBackgroundColor = ginzeyColors.antiquePaper;
                  bannerSettings.categoryColor = ginzeyColors.blue;
                }}
                class="px-4 py-2 bg-blue-50 text-blue-800 rounded-lg hover:bg-blue-100 transition-colors border-2 border-blue-200"
              >
                Antique Judaica (Blue Sticker)
              </button>
            </div>
            <div class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p class="text-sm text-amber-800">
                <strong>Ginzey America Color Scheme:</strong> Antique paper base (#F5F1E8) with red (#C41E3A) and blue (#1E3A8A) accent stickers
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

