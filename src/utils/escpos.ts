import { ReceiptSection, ItemsSection, TotalsSection, BarcodeSection, QrcodeSection, ImageSection, TextSection, SpacerSection, HeaderSection, FooterSection } from '../types';
import { getRasterBits } from './dither';

/**
 * ESC/POS binary command constants
 */
export const ESC_POS = {
  INIT: [0x1B, 0x40],                     // ESC @ - Initialize
  ALIGN_LEFT: [0x1B, 0x61, 0x00],         // ESC a 0 - Align Left
  ALIGN_CENTER: [0x1B, 0x61, 0x01],       // ESC a 1 - Align Center
  ALIGN_RIGHT: [0x1B, 0x61, 0x02],        // ESC a 2 - Align Right
  BOLD_ON: [0x1B, 0x45, 0x01],            // ESC E 1 - Bold On
  BOLD_OFF: [0x1B, 0x45, 0x00],           // ESC E 0 - Bold Off
  UNDERLINE_ON: [0x1B, 0x2D, 0x01],       // ESC - 1 - Underline On
  UNDERLINE_OFF: [0x1B, 0x2D, 0x00],      // ESC - 0 - Underline Off
  DOUBLE_SIZE_ON: [0x1D, 0x21, 0x11],     // GS ! 17 (0x11) - Double Width & Height
  DOUBLE_HEIGHT_ON: [0x1D, 0x21, 0x01],   // GS ! 1 - Double Height Only
  DOUBLE_WIDTH_ON: [0x1D, 0x21, 0x10],    // GS ! 16 - Double Width Only
  TEXT_SIZE_NORMAL: [0x1D, 0x21, 0x00],   // GS ! 0 - Normal size
  INVERT_ON: [0x1D, 0x42, 0x01],          // GS B 1 - Reverse white on black On
  INVERT_OFF: [0x1D, 0x42, 0x00],         // GS B 0 - Reverse Off
  FEED_LINE: [0x0A],                      // LF - Line feed
  PAPER_CUT: [0x1D, 0x56, 0x42, 0x00],    // GS V 66 0 - Feed paper and cut (partial)
};

/**
 * Converts a string to Uint8Array using standard CP437/ASCII encoding
 */
export function stringToBytes(str: string): Uint8Array {
  // Simple mapping for standard ASCII, safe for browser-based ESC/POS
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[i] = code < 128 ? code : 63; // Map non-ASCII to '?'
  }
  return bytes;
}

/**
 * Compiles a structured array of ReceiptSections into a single raw ESC/POS Uint8Array
 */
export async function compileEscPos(
  sections: ReceiptSection[],
  paperWidthMm: 58 | 80
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const charsPerLine = paperWidthMm === 58 ? 32 : 48; // Standard fonts: 32 chars on 58mm, 48 chars on 80mm

  // Initialize printer
  chunks.push(new Uint8Array(ESC_POS.INIT));

  for (const section of sections) {
    if (!section.enabled) continue;

    switch (section.type) {
      case 'header': {
        const h = section.content as HeaderSection;
        // Title (centered, bold, double height)
        chunks.push(new Uint8Array(ESC_POS.ALIGN_CENTER));
        chunks.push(new Uint8Array(ESC_POS.BOLD_ON));
        chunks.push(new Uint8Array(ESC_POS.DOUBLE_HEIGHT_ON));
        chunks.push(stringToBytes(h.title + '\n'));
        chunks.push(new Uint8Array(ESC_POS.DOUBLE_SIZE_ON)); // reset text size

        // Subtitle (centered, normal size)
        if (h.subtitle) {
          chunks.push(new Uint8Array(ESC_POS.TEXT_SIZE_NORMAL));
          chunks.push(new Uint8Array(ESC_POS.BOLD_OFF));
          chunks.push(stringToBytes(h.subtitle + '\n'));
        }

        // Metadata table (e.g. date, invoice number)
        if (h.metadata && h.metadata.length > 0) {
          chunks.push(new Uint8Array(ESC_POS.TEXT_SIZE_NORMAL));
          chunks.push(new Uint8Array(ESC_POS.ALIGN_LEFT));
          chunks.push(new Uint8Array(ESC_POS.BOLD_OFF));
          
          for (const item of h.metadata) {
            const left = item.label;
            const right = item.value;
            const spacesCount = charsPerLine - left.length - right.length;
            const spaces = spacesCount > 0 ? ' '.repeat(spacesCount) : ' ';
            chunks.push(stringToBytes(`${left}${spaces}${right}\n`));
          }
        }
        
        // Add a clean separator
        chunks.push(stringToBytes('-'.repeat(charsPerLine) + '\n'));
        break;
      }

      case 'text': {
        const t = section.content as TextSection;
        // Apply text alignment
        if (t.align === 'center') {
          chunks.push(new Uint8Array(ESC_POS.ALIGN_CENTER));
        } else if (t.align === 'right') {
          chunks.push(new Uint8Array(ESC_POS.ALIGN_RIGHT));
        } else {
          chunks.push(new Uint8Array(ESC_POS.ALIGN_LEFT));
        }

        // Apply text styling
        chunks.push(new Uint8Array(t.bold ? ESC_POS.BOLD_ON : ESC_POS.BOLD_OFF));
        chunks.push(new Uint8Array(t.underline ? ESC_POS.UNDERLINE_ON : ESC_POS.UNDERLINE_OFF));
        chunks.push(new Uint8Array(t.invert ? ESC_POS.INVERT_ON : ESC_POS.INVERT_OFF));

        // Adjust Font Sizes
        let sizeByte = 0x00;
        if (t.doubleWidth) sizeByte |= 0x10;
        if (t.doubleHeight) sizeByte |= 0x01;
        chunks.push(new Uint8Array([0x1D, 0x21, sizeByte])); // GS !

        chunks.push(stringToBytes(t.text + '\n'));

        // Reset formatting
        chunks.push(new Uint8Array(ESC_POS.TEXT_SIZE_NORMAL));
        chunks.push(new Uint8Array(ESC_POS.BOLD_OFF));
        chunks.push(new Uint8Array(ESC_POS.UNDERLINE_OFF));
        chunks.push(new Uint8Array(ESC_POS.INVERT_OFF));
        break;
      }

      case 'items': {
        const it = section.content as ItemsSection;
        chunks.push(new Uint8Array(ESC_POS.ALIGN_LEFT));
        chunks.push(new Uint8Array(ESC_POS.TEXT_SIZE_NORMAL));
        chunks.push(new Uint8Array(ESC_POS.BOLD_OFF));

        // Table headers if enabled
        if (it.showHeaders !== false) {
          if (paperWidthMm === 58) {
            // E.g. "Item            Qty    Total"
            // Widths: Item: 16 chars, Qty: 6 chars, Total: 10 chars
            const headers = 'Item            Qty     Price';
            chunks.push(stringToBytes(headers + '\n'));
            chunks.push(stringToBytes('-'.repeat(charsPerLine) + '\n'));
          } else {
            // 80mm - 48 chars
            // "Item                            Qty    Price   Total"
            // Widths: Item: 28, Qty: 5, Price: 7, Total: 8
            const headers = 'Item                         Qty   Price   Total';
            chunks.push(stringToBytes(headers + '\n'));
            chunks.push(stringToBytes('-'.repeat(charsPerLine) + '\n'));
          }
        }

        for (const row of it.rows) {
          const isWeighed = row.weight !== undefined && row.weight > 0;
          const qtyStr = isWeighed ? `${row.weight.toFixed(3)}kg` : `${row.qty ?? 1}x`;
          const priceStr = `$${row.price.toFixed(2)}`;
          const totalStr = `$${row.total.toFixed(2)}`;

          if (paperWidthMm === 58) {
            // 32 chars format:
            // "ItemName (up to 14 chars)  Qty  Total"
            const nameSpace = 14;
            let displayName = row.name;
            if (displayName.length > nameSpace - 1) {
              displayName = displayName.substring(0, nameSpace - 2) + '..';
            }
            const nameCol = displayName.padEnd(nameSpace, ' ');
            const qtyCol = qtyStr.padStart(8, ' ');
            const totalCol = totalStr.padStart(10, ' ');
            chunks.push(stringToBytes(`${nameCol}${qtyCol}${totalCol}\n`));
          } else {
            // 80mm 48 chars format:
            // Item (23), Qty (7), Price (8), Total (10)
            let displayName = row.name;
            if (displayName.length > 22) {
              displayName = displayName.substring(0, 20) + '..';
            }
            const nameCol = displayName.padEnd(23, ' ');
            const qtyCol = qtyStr.padStart(7, ' ');
            const priceCol = priceStr.padStart(8, ' ');
            const totalCol = totalStr.padStart(10, ' ');
            chunks.push(stringToBytes(`${nameCol}${qtyCol}${priceCol}${totalCol}\n`));
          }
        }
        break;
      }

      case 'totals': {
        const tot = section.content as TotalsSection;
        chunks.push(new Uint8Array(ESC_POS.ALIGN_LEFT));
        chunks.push(new Uint8Array(ESC_POS.TEXT_SIZE_NORMAL));
        
        // Separator line
        chunks.push(stringToBytes('-'.repeat(charsPerLine) + '\n'));

        for (const row of tot.rows) {
          chunks.push(new Uint8Array(row.isBold ? ESC_POS.BOLD_ON : ESC_POS.BOLD_OFF));
          
          const label = row.label;
          const val = row.value;
          const spacesCount = charsPerLine - label.length - val.length;
          const spaces = spacesCount > 0 ? ' '.repeat(spacesCount) : ' ';
          chunks.push(stringToBytes(`${label}${spaces}${val}\n`));
        }
        chunks.push(new Uint8Array(ESC_POS.BOLD_OFF));
        break;
      }

      case 'barcode': {
        const b = section.content as BarcodeSection;
        chunks.push(new Uint8Array(ESC_POS.ALIGN_CENTER));
        
        // ESC/POS Barcode commands
        // GS h - set height
        chunks.push(new Uint8Array([0x1D, 0x68, b.height]));
        // GS H - set HRI character print position (0 = off, 2 = bottom)
        const printText = b.includeText !== false ? 0x02 : 0x00;
        chunks.push(new Uint8Array([0x1D, 0x48, printText]));

        // Select barcode system (GS k)
        // Format m = CODE128 (73), then length of content, then data bytes
        // We'll standardise on CODE128 for general usefulness
        const barcodeData = stringToBytes(b.value);
        const formatByte = 73; // Code 128
        
        // Code 128 data packets must start with code subset identifier, e.g. '{B' (0x7B, 0x42)
        const wrapperBytes = new Uint8Array(barcodeData.length + 2);
        wrapperBytes[0] = 0x7B; // '{'
        wrapperBytes[1] = 0x42; // 'B'
        wrapperBytes.set(barcodeData, 2);

        const commandHeader = new Uint8Array([0x1D, 0x6B, formatByte, wrapperBytes.length]);
        
        chunks.push(commandHeader);
        chunks.push(wrapperBytes);
        chunks.push(new Uint8Array(ESC_POS.FEED_LINE));
        break;
      }

      case 'qrcode': {
        const qr = section.content as QrcodeSection;
        chunks.push(new Uint8Array(ESC_POS.ALIGN_CENTER));

        // Standard EPSON QR Code commands (GS ( k)
        // Function 180: Set size of QR module (2 to 16)
        const size = Math.max(2, Math.min(16, Math.floor(qr.size / 30)));
        chunks.push(new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, size]));

        // Function 181: Set QR error correction level (48 = L, 49 = M, 50 = Q, 51 = H)
        chunks.push(new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x44, 49])); // Level M

        // Function 180 (Store QR data): GS ( k pL pH cn fn m d1...dk
        const qrData = stringToBytes(qr.value);
        const len = qrData.length + 3;
        const pL = len % 256;
        const pH = Math.floor(len / 256);
        
        const storeCommand = new Uint8Array([0x1D, 0x28, 0x6B, pL, pH, 49, 80, 48]);
        chunks.push(storeCommand);
        chunks.push(qrData);

        // Function 181: Print QR code symbol
        chunks.push(new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 48]));
        chunks.push(new Uint8Array(ESC_POS.FEED_LINE));
        break;
      }

      case 'spacer': {
        const sp = section.content as SpacerSection;
        chunks.push(new Uint8Array(ESC_POS.ALIGN_LEFT));
        chunks.push(new Uint8Array(ESC_POS.TEXT_SIZE_NORMAL));

        let char = ' ';
        if (sp.style === 'dashed') char = '-';
        else if (sp.style === 'solid') char = '_';
        else if (sp.style === 'stars') char = '*';
        else if (sp.style === 'dots') char = '.';
        else if (sp.style === 'double') char = '=';

        for (let i = 0; i < sp.height; i++) {
          if (char === ' ') {
            chunks.push(new Uint8Array(ESC_POS.FEED_LINE));
          } else {
            chunks.push(stringToBytes(char.repeat(charsPerLine) + '\n'));
          }
        }
        break;
      }

      case 'image': {
        const img = section.content as ImageSection;
        if (!img.dataUrl) break;

        try {
          // In actual print compile, the dithered raster base64 must be downloaded, converted to ImageData,
          // then raster compressed via standard ESC/POS GS v 0 raster image drawing!
          const imgBits = await loadRasterDataFromUrl(img.dataUrl, charsPerLine * 8);
          if (imgBits) {
            chunks.push(new Uint8Array(ESC_POS.ALIGN_CENTER));
            
            // GS v 0 m xL xH yL yH d1...dk
            const { width, height, bytesPerRow, data } = imgBits;
            const xL = bytesPerRow % 256;
            const xH = Math.floor(bytesPerRow / 256);
            const yL = height % 256;
            const yH = Math.floor(height / 256);

            const imageHeader = new Uint8Array([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
            chunks.push(imageHeader);
            chunks.push(data);
            chunks.push(new Uint8Array(ESC_POS.FEED_LINE));
          }
        } catch (e) {
          console.error('Failed to compile image section for ESC/POS:', e);
        }
        break;
      }

      case 'footer': {
        const f = section.content as FooterSection;
        chunks.push(new Uint8Array(ESC_POS.ALIGN_CENTER));
        chunks.push(new Uint8Array(ESC_POS.TEXT_SIZE_NORMAL));
        chunks.push(new Uint8Array(ESC_POS.BOLD_OFF));

        // Print custom ASCII art if provided
        if (f.asciiArt) {
          chunks.push(stringToBytes(f.asciiArt + '\n'));
        }

        // Print footer text
        chunks.push(stringToBytes(f.text + '\n'));
        break;
      }
    }
  }

  // Feed 4 lines to finish and cut paper
  chunks.push(stringToBytes('\n\n\n\n'));
  chunks.push(new Uint8Array(ESC_POS.PAPER_CUT));

  // Merge chunks
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Loads a base64 image URL, draws it to a virtual canvas, and produces 1-bit raster data
 */
async function loadRasterDataFromUrl(
  dataUrl: string,
  targetWidth: number
): Promise<{ width: number; height: number; bytesPerRow: number; data: Uint8Array } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = targetWidth / img.width;
        const h = Math.round(img.height * scale);
        
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = h;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, h);
        ctx.drawImage(img, 0, 0, targetWidth, h);
        
        const imgData = ctx.getImageData(0, 0, targetWidth, h);
        // Process as already dithered 1-bit black/white.
        const bytesPerRow = Math.ceil(targetWidth / 8);
        const buffer = new Uint8Array(bytesPerRow * h);
        const pixels = imgData.data;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < targetWidth; x++) {
            const pixelIdx = (y * targetWidth + x) * 4;
            // RGB luma threshold
            const r = pixels[pixelIdx];
            const g = pixels[pixelIdx + 1];
            const b = pixels[pixelIdx + 2];
            const isWhite = (0.299 * r + 0.587 * g + 0.114 * b) > 127;

            if (!isWhite) {
              const byteIdx = y * bytesPerRow + Math.floor(x / 8);
              const bitOffset = 7 - (x % 8);
              buffer[byteIdx] |= (1 << bitOffset);
            }
          }
        }

        resolve({
          width: targetWidth,
          height: h,
          bytesPerRow,
          data: buffer
        });
      } catch (err) {
        console.error('Error compiling raster image:', err);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Utility to convert an array of bytes to styled Hex presentation for console preview
 */
export function bytesToHexDump(bytes: Uint8Array): string[] {
  const lines: string[] = [];
  const bytesPerLine = 16;

  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const slice = bytes.slice(i, i + bytesPerLine);
    
    // Address index
    const addr = i.toString(16).toUpperCase().padStart(4, '0');
    
    // Hex pairs
    const hexParts: string[] = [];
    for (let j = 0; j < bytesPerLine; j++) {
      if (j < slice.length) {
        hexParts.push(slice[j].toString(16).toUpperCase().padStart(2, '0'));
      } else {
        hexParts.push('  ');
      }
    }
    
    // ASCII characters representation
    let ascii = '';
    for (let j = 0; j < slice.length; j++) {
      const b = slice[j];
      if (b >= 32 && b <= 126) {
        ascii += String.fromCharCode(b);
      } else if (b === 0x0A) {
        ascii += '↵'; // Line return representation
      } else {
        ascii += '.'; // Non-printable character indicator
      }
    }

    lines.push(`${addr}:  ${hexParts.slice(0, 8).join(' ')}  ${hexParts.slice(8).join(' ')}  |${ascii}|`);
  }

  return lines;
}
