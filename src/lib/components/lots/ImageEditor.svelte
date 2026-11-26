<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  let {
    imageUrl = '',
    imageId = null,
    lotId = null,
    onSave = () => {},
    onCancel = () => {}
  } = $props();

  let canvas = $state(null);
  let image = $state(null);
  let rotation = $state(0);
  let scaleX = $state(1);
  let scaleY = $state(1);
  let cropX = $state(0);
  let cropY = $state(0);
  let cropWidth = $state(0);
  let cropHeight = $state(0);
  let isCropping = $state(false);
  let cropStartX = $state(0);
  let cropStartY = $state(0);
  let imageWidth = $state(0);
  let imageHeight = $state(0);
  let maxWidth = $state(1920);
  let maxHeight = $state(1920);
  let quality = $state(0.9);
  let saving = $state(false);

  $effect(() => {
    if (imageUrl && canvas) {
      loadImage();
    }
  });

  async function loadImage() {
    try {
      let imageSrc = imageUrl;
      
      // Check if the image URL is from a different origin (S3, etc.)
      try {
        const urlObj = new URL(imageUrl, window.location.origin);
        const isExternal = urlObj.origin !== window.location.origin && 
                          !urlObj.hostname.includes(window.location.hostname);
        
        // If external, use proxy endpoint to avoid CORS issues
        if (isExternal) {
          imageSrc = `/api/images/proxy?url=${encodeURIComponent(imageUrl)}`;
        }
      } catch (urlError) {
        // If URL parsing fails, try using the original URL
        console.warn('Could not parse image URL, using original:', urlError);
      }
      
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        image = img;
        imageWidth = img.width;
        imageHeight = img.height;
        cropWidth = img.width;
        cropHeight = img.height;
        maxWidth = Math.min(img.width, 1920);
        maxHeight = Math.min(img.height, 1920);
        drawImage();
      };
      
      img.onerror = (err) => {
        console.error('Failed to load image:', err);
        alert(ui("Failed to load image. Please check the image URL or try again."));
      };
      
      img.src = imageSrc;
    } catch (err) {
      console.error('Error loading image:', err);
      alert(ui("Failed to load image. Please try again."));
    }
  }

  function drawImage() {
    if (!canvas || !image) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate display size (fit to canvas)
    const scale = Math.min(
      canvas.width / imageWidth,
      canvas.height / imageHeight
    );
    const displayWidth = imageWidth * scale;
    const displayHeight = imageHeight * scale;
    const offsetX = (canvas.width - displayWidth) / 2;
    const offsetY = (canvas.height - displayHeight) / 2;
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    
    ctx.drawImage(
      image,
      offsetX,
      offsetY,
      displayWidth,
      displayHeight
    );
    
    ctx.restore();
    
    // Draw crop overlay if cropping (draw after transformations, in normal canvas space)
    if (isCropping) {
      // Convert image coordinates to canvas display coordinates
      const cropCanvasX = cropX * scale + offsetX;
      const cropCanvasY = cropY * scale + offsetY;
      const cropCanvasWidth = cropWidth * scale;
      const cropCanvasHeight = cropHeight * scale;
      
      // Draw dark overlay outside crop area
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Clear the crop area (make it transparent to show image)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(cropCanvasX, cropCanvasY, cropCanvasWidth, cropCanvasHeight);
      ctx.globalCompositeOperation = 'source-over';
      
      // Draw crop border
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(cropCanvasX, cropCanvasY, cropCanvasWidth, cropCanvasHeight);
      
      // Draw corner handles for better UX
      const handleSize = 8;
      ctx.fillStyle = '#3b82f6';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      
      // Top-left
      ctx.fillRect(cropCanvasX - handleSize/2, cropCanvasY - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(cropCanvasX - handleSize/2, cropCanvasY - handleSize/2, handleSize, handleSize);
      // Top-right
      ctx.fillRect(cropCanvasX + cropCanvasWidth - handleSize/2, cropCanvasY - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(cropCanvasX + cropCanvasWidth - handleSize/2, cropCanvasY - handleSize/2, handleSize, handleSize);
      // Bottom-left
      ctx.fillRect(cropCanvasX - handleSize/2, cropCanvasY + cropCanvasHeight - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(cropCanvasX - handleSize/2, cropCanvasY + cropCanvasHeight - handleSize/2, handleSize, handleSize);
      // Bottom-right
      ctx.fillRect(cropCanvasX + cropCanvasWidth - handleSize/2, cropCanvasY + cropCanvasHeight - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(cropCanvasX + cropCanvasWidth - handleSize/2, cropCanvasY + cropCanvasHeight - handleSize/2, handleSize, handleSize);
    }
  }

  function rotate(degrees) {
    rotation = (rotation + degrees) % 360;
    drawImage();
  }

  function flipHorizontal() {
    scaleX *= -1;
    drawImage();
  }

  function flipVertical() {
    scaleY *= -1;
    drawImage();
  }

  function getCanvasToImageCoords(e) {
    if (!canvas || !image) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the scale used to fit the image in the canvas
    const scale = Math.min(
      canvas.width / imageWidth,
      canvas.height / imageHeight
    );
    
    // Calculate the displayed image dimensions
    const displayWidth = imageWidth * scale;
    const displayHeight = imageHeight * scale;
    
    // Calculate the offset to center the image
    const offsetX = (canvas.width - displayWidth) / 2;
    const offsetY = (canvas.height - displayHeight) / 2;
    
    // Get mouse position relative to canvas (accounting for actual canvas size vs displayed size)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    
    // Convert canvas coordinates to image coordinates
    const imageX = (canvasX - offsetX) / scale;
    const imageY = (canvasY - offsetY) / scale;
    
    return {
      x: Math.max(0, Math.min(imageWidth, imageX)),
      y: Math.max(0, Math.min(imageHeight, imageY))
    };
  }

  function startCrop(e) {
    if (!canvas || !image) return;
    const coords = getCanvasToImageCoords(e);
    cropStartX = coords.x;
    cropStartY = coords.y;
    isCropping = true;
  }

  function updateCrop(e) {
    if (!isCropping || !canvas || !image) return;
    const coords = getCanvasToImageCoords(e);
    const currentX = coords.x;
    const currentY = coords.y;
    
    cropX = Math.max(0, Math.min(cropStartX, currentX));
    cropY = Math.max(0, Math.min(cropStartY, currentY));
    cropWidth = Math.abs(currentX - cropStartX);
    cropHeight = Math.abs(currentY - cropStartY);
    
    // Constrain to image bounds
    if (cropX + cropWidth > imageWidth) {
      cropWidth = imageWidth - cropX;
    }
    if (cropY + cropHeight > imageHeight) {
      cropHeight = imageHeight - cropY;
    }
    
    drawImage();
  }

  function endCrop() {
    isCropping = false;
  }

  function resetCrop() {
    cropX = 0;
    cropY = 0;
    cropWidth = imageWidth;
    cropHeight = imageHeight;
    drawImage();
  }

  function resetAll() {
    rotation = 0;
    scaleX = 1;
    scaleY = 1;
    cropX = 0;
    cropY = 0;
    cropWidth = imageWidth;
    cropHeight = imageHeight;
    drawImage();
  }

  async function saveImage() {
    if (!image || !lotId) return;
    
    saving = true;
    try {
      // Create a temporary canvas for the final image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      // Apply transformations
      const finalWidth = cropWidth;
      const finalHeight = cropHeight;
      
      // Limit to max dimensions
      let outputWidth = finalWidth;
      let outputHeight = finalHeight;
      if (outputWidth > maxWidth || outputHeight > maxHeight) {
        const scale = Math.min(maxWidth / outputWidth, maxHeight / outputHeight);
        outputWidth = outputWidth * scale;
        outputHeight = outputHeight * scale;
      }
      
      tempCanvas.width = outputWidth;
      tempCanvas.height = outputHeight;
      
      // Draw the cropped and transformed image
      tempCtx.save();
      tempCtx.translate(outputWidth / 2, outputHeight / 2);
      tempCtx.rotate((rotation * Math.PI) / 180);
      tempCtx.scale(scaleX, scaleY);
      tempCtx.translate(-outputWidth / 2, -outputHeight / 2);
      
      // Draw the cropped portion
      tempCtx.drawImage(
        image,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, outputWidth, outputHeight
      );
      
      tempCtx.restore();
      
      // Convert to blob
      tempCanvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error(ui("Failed to create image blob"));
        }
        
        // Upload the edited image
        const formData = new FormData();
        formData.append('file', blob, 'edited-image.jpg');
        formData.append('lotId', lotId);
        if (imageId) {
          formData.append('imageId', imageId);
        }
        
        const response = await fetch('/api/lots/images/edit', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: ui("Failed to save image") }));
          throw new Error(error.message || ui("Failed to save image"));
        }
        
        const result = await response.json();
        onSave(result);
      }, 'image/jpeg', quality);
    } catch (error) {
      console.error('Error saving image:', error);
      alert(ui("Failed to save image: {value0}", { value0: error.message }));
    } finally {
      saving = false;
    }
  }
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
  <div class="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-gray-900">{ui("Edit Image")}</h2>
        <button
          type="button"
          onclick={onCancel}
          class="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          aria-label={ui("Close")}
        >
          ×
        </button>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Canvas Preview -->
        <div class="lg:col-span-2">
          <div class="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
            <canvas
              bind:this={canvas}
              class="max-w-full h-auto border border-gray-300 rounded cursor-crosshair"
              onmousedown={startCrop}
              onmousemove={updateCrop}
              onmouseup={endCrop}
              onmouseleave={endCrop}
            ></canvas>
          </div>
        </div>
        
        <!-- Controls -->
        <div class="space-y-4">
          <!-- Rotation -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-semibold text-gray-900 mb-3">{ui("Rotation")}</h3>
            <div class="flex gap-2">
              <button
                type="button"
                onclick={() => rotate(-90)}
                class="flex-1 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
              >
                ↺ -90°
              </button>
              <button
                type="button"
                onclick={() => rotate(90)}
                class="flex-1 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
              >
                ↻ +90°
              </button>
            </div>
            <div class="mt-2">
              <button
                type="button"
                onclick={() => rotate(180)}
                class="w-full px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
              >
                ↻ 180°
              </button>
            </div>
          </div>
          
          <!-- Flip/Mirror -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-semibold text-gray-900 mb-3">{ui("Flip/Mirror")}</h3>
            <div class="flex gap-2">
              <button
                type="button"
                onclick={flipHorizontal}
                class="flex-1 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
              >
                {ui("↔ Horizontal")}
              </button>
              <button
                type="button"
                onclick={flipVertical}
                class="flex-1 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
              >
                {ui("↕ Vertical")}
              </button>
            </div>
          </div>
          
          <!-- Crop -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-semibold text-gray-900 mb-3">{ui("Crop")}</h3>
            <p class="text-xs text-gray-600 mb-2">{ui("Click and drag on the image to select crop area")}</p>
            <button
              type="button"
              onclick={resetCrop}
              class="w-full px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
            >
              {ui("Reset Crop")}
            </button>
          </div>
          
          <!-- Resize -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-semibold text-gray-900 mb-3">{ui("Resize")}</h3>
            <div class="space-y-2">
              <div>
                <label class="block text-xs text-gray-700 mb-1">{ui("Max Width (px)")}</label>
                <input
                  type="number"
                  bind:value={maxWidth}
                  min="100"
                  max="5000"
                  class="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-700 mb-1">{ui("Max Height (px)")}</label>
                <input
                  type="number"
                  bind:value={maxHeight}
                  min="100"
                  max="5000"
                  class="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-700 mb-1">{ui("Quality:")} {(quality * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  bind:value={quality}
                  min="0.1"
                  max="1"
                  step="0.1"
                  class="w-full"
                />
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex gap-2">
              <button
                type="button"
                onclick={resetAll}
                class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
              >
                {ui("Reset All")}
              </button>
              <button
                type="button"
                onclick={onCancel}
                class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
              >
                {ui("Cancel")}
              </button>
              <button
                type="button"
                onclick={saveImage}
                disabled={saving}
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                {saving ? ui("Saving...") : ui("Save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  canvas {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }
</style>

