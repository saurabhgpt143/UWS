/**
 * Image processing and 1-bit dithering algorithms for thermal printing simulation
 */

// Bayer 4x4 ordered dithering matrix
const BAYER_4X4 = [
  [0,  8,  2,  10],
  [12, 4,  14, 6],
  [3,  11, 1,  9],
  [15, 7,  13, 5]
];

/**
 * Apply contrast and brightness adjustments to a grayscale value [0-255]
 * @param val Original value
 * @param brightness 0 to 200 (100 is neutral)
 * @param contrast 0 to 200 (100 is neutral)
 */
export function adjustPixel(val: number, brightness: number, contrast: number): number {
  // 1. Brightness
  let res = val + (brightness - 100);

  // 2. Contrast
  const factor = (259 * (contrast + 100)) / (255 * (259 - contrast));
  res = factor * (res - 128) + 128;

  return Math.max(0, Math.min(255, res));
}

/**
 * Processes image pixel data and applies the selected dithering algorithm.
 * Returns an ImageData object ready to be drawn on a canvas.
 */
export function ditherImage(
  srcData: ImageData,
  algorithm: 'floyd-steinberg' | 'bayer' | 'threshold' | 'none',
  brightness: number,
  contrast: number,
  invert: boolean
): ImageData {
  const width = srcData.width;
  const height = srcData.height;
  
  // Clone the pixel data
  const dstData = new ImageData(new Uint8ClampedArray(srcData.data), width, height);
  const data = dstData.data;

  // Step 1: Convert to Grayscale & Adjust Brightness/Contrast
  const gray = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    
    // Standard luminance formula
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const adjusted = adjustPixel(luma, brightness, contrast);
    
    gray[i / 4] = adjusted;
  }

  // Helper to get array index
  const idx = (x: number, y: number) => y * width + x;

  // Step 2: Apply Dithering
  if (algorithm === 'none') {
    // Standard Grayscale with optional threshold/clamping (no dither pattern)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = idx(x, y);
        let val = gray[i];
        
        // Output black or white based on standard middle threshold
        const finalVal = val >= 128 ? 255 : 0;
        const color = invert ? (255 - finalVal) : finalVal;
        
        const dataIdx = i * 4;
        data[dataIdx] = color;
        data[dataIdx + 1] = color;
        data[dataIdx + 2] = color;
        data[dataIdx + 3] = 255;
      }
    }
  } else if (algorithm === 'threshold') {
    // Simple 50% Threshold B&W cut
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = idx(x, y);
        const finalVal = gray[i] >= 128 ? 255 : 0;
        const color = invert ? (255 - finalVal) : finalVal;
        
        const dataIdx = i * 4;
        data[dataIdx] = color;
        data[dataIdx + 1] = color;
        data[dataIdx + 2] = color;
        data[dataIdx + 3] = 255;
      }
    }
  } else if (algorithm === 'bayer') {
    // Ordered Bayer 4x4 Dithering
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = idx(x, y);
        const val = gray[i];
        
        // Scale Bayer threshold [0, 15] to range [0, 255]
        const bayerVal = BAYER_4X4[y % 4][x % 4];
        const threshold = (bayerVal + 1) * 16 - 1; 

        const finalVal = val > threshold ? 255 : 0;
        const color = invert ? (255 - finalVal) : finalVal;
        
        const dataIdx = i * 4;
        data[dataIdx] = color;
        data[dataIdx + 1] = color;
        data[dataIdx + 2] = color;
        data[dataIdx + 3] = 255;
      }
    }
  } else if (algorithm === 'floyd-steinberg') {
    // Floyd-Steinberg Error Diffusion
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = idx(x, y);
        const oldPixel = gray[i];
        const newPixel = oldPixel >= 128 ? 255 : 0;
        
        gray[i] = newPixel;
        
        const error = oldPixel - newPixel;

        // Distribute error to neighbors
        if (x + 1 < width) {
          gray[idx(x + 1, y)] += error * (7 / 16);
        }
        if (x - 1 >= 0 && y + 1 < height) {
          gray[idx(x - 1, y + 1)] += error * (3 / 16);
        }
        if (y + 1 < height) {
          gray[idx(x, y + 1)] += error * (5 / 16);
        }
        if (x + 1 < width && y + 1 < height) {
          gray[idx(x + 1, y + 1)] += error * (1 / 16);
        }
        
        const color = invert ? (255 - newPixel) : newPixel;
        const dataIdx = i * 4;
        data[dataIdx] = color;
        data[dataIdx + 1] = color;
        data[dataIdx + 2] = color;
        data[dataIdx + 3] = 255;
      }
    }
  }

  return dstData;
}

/**
 * Encodes dithered 1-bit Image Data into raw raster bits for ESC/POS printing.
 * Every 8 horizontal pixels are packed into 1 byte (MSB is left-most pixel).
 * A value of 1 in the bit map represents BLACK (burn thermal pin), and 0 is WHITE.
 */
export function getRasterBits(ditheredData: ImageData): {
  width: number;
  height: number;
  bytesPerRow: number;
  data: Uint8Array;
} {
  const width = ditheredData.width;
  const height = ditheredData.height;
  const bytesPerRow = Math.ceil(width / 8);
  const buffer = new Uint8Array(bytesPerRow * height);
  const pixels = ditheredData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4;
      // Get luminance (since it's already dithered B&W, looking at Red channel is enough)
      const isWhite = pixels[pixelIdx] > 127;
      
      if (!isWhite) {
        // Black pixel! In thermal printer ESC/POS raster commands, 1 = Black, 0 = White
        const byteIdx = y * bytesPerRow + Math.floor(x / 8);
        const bitOffset = 7 - (x % 8);
        buffer[byteIdx] |= (1 << bitOffset);
      }
    }
  }

  return {
    width,
    height,
    bytesPerRow,
    data: buffer
  };
}
