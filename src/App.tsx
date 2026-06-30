import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  Printer, Settings, Sparkles, Wifi, Check, AlertCircle, RefreshCw, 
  Trash2, Copy, FileText, Smartphone, Laptop, Share2, X, Mail, MessageSquare, ExternalLink, Download, FileCode, ImageIcon, MessageCircle
} from 'lucide-react';
import { ReceiptSection, PaperType, PrinterConfig, PrinterLog, TextSection, SpacerSection, BarcodeSection, HeaderSection, ItemsSection, TotalsSection, QrcodeSection, FooterSection } from './types';
import ReceiptEditor from './components/ReceiptEditor';
import { compileEscPos } from './utils/escpos';
import { btPrinter } from './utils/bluetooth';

// Available Paper styles
const PAPER_ROLL_STYLES: PaperType[] = [
  {
    id: 'white',
    name: 'Classic Mono',
    label: 'White Roll (Black Ink)',
    widthMm: 58,
    pxWidth: 260,
    bgClass: 'bg-[#FFFFFA] border-stone-200 shadow-sm',
    textClass: 'text-[#1D1C1A]',
    burnClass: 'decoration-[#1D1C1A]',
    hexColor: '#1D1C1A'
  },
  {
    id: 'blue',
    name: 'Blue Ribbon',
    label: 'Ivory Roll (Retro Blue Ink)',
    widthMm: 58,
    pxWidth: 260,
    bgClass: 'bg-[#FFFDF3] border-stone-200/50 shadow-sm',
    textClass: 'text-[#1B4FA3]',
    burnClass: 'decoration-[#1B4FA3]',
    hexColor: '#1B4FA3'
  },
  {
    id: 'gameboy',
    name: 'Pocket Green',
    label: 'GameBoy Printer (Thermal Moss Green)',
    widthMm: 58,
    pxWidth: 260,
    bgClass: 'bg-[#C5CFB6] border-stone-400 shadow-inner',
    textClass: 'text-[#2D3C2C]',
    burnClass: 'decoration-[#2D3C2C]',
    hexColor: '#2D3C2C'
  },
  {
    id: 'yellow',
    name: 'Sticky Note',
    label: 'Sticky Paper (Luminous Canary Yellow)',
    widthMm: 58,
    pxWidth: 260,
    bgClass: 'bg-[#FFFCA0] border-yellow-200 shadow-sm',
    textClass: 'text-stone-900',
    burnClass: 'decoration-stone-900',
    hexColor: '#1C1917'
  },
  {
    id: 'pink',
    name: 'Pastel Sticker',
    label: 'Pink Label (Soft Bubblegum Pink)',
    widthMm: 58,
    pxWidth: 260,
    bgClass: 'bg-[#FFE2EE] border-pink-200 shadow-sm',
    textClass: 'text-stone-800',
    burnClass: 'decoration-stone-800',
    hexColor: '#292524'
  }
];

// Default receipt template on boot
const INITIAL_SECTIONS: ReceiptSection[] = [
  {
    id: 'sec-comp-title',
    type: 'text',
    enabled: true,
    content: {
      text: 'M.G. INDUSTRIES',
      align: 'center',
      bold: true
    } as TextSection
  },
  {
    id: 'sec-comp-subtitle',
    type: 'text',
    enabled: true,
    content: {
      text: 'Vinoba Bhave Ward, Panagar\nJabalpur (M.P.) India 483220\nPH: +91 9752556113',
      align: 'center',
      bold: false
    } as TextSection
  },
  {
    id: 'sec-divider-1',
    type: 'spacer',
    enabled: true,
    content: {
      style: 'solid',
      height: 1
    } as SpacerSection
  },
  {
    id: 'sec-ticket-info',
    type: 'text',
    enabled: true,
    content: {
      text: 'TICKET NO:             WS-804903\nDATE:                 24/06/2026\nTIME:                      01:06',
      align: 'left',
      bold: false
    } as TextSection
  },
  {
    id: 'sec-divider-2-dashed',
    type: 'spacer',
    enabled: true,
    content: {
      style: 'dashed',
      height: 1
    } as SpacerSection
  },
  {
    id: 'sec-divider-2-solid',
    type: 'spacer',
    enabled: true,
    content: {
      style: 'solid',
      height: 1
    } as SpacerSection
  },
  {
    id: 'sec-weight-display',
    type: 'text',
    enabled: true,
    content: {
      text: 'WEIGHT:     0 KG',
      align: 'left',
      bold: true,
      doubleWidth: true,
      doubleHeight: true
    } as TextSection
  },
  {
    id: 'sec-divider-3',
    type: 'spacer',
    enabled: true,
    content: {
      style: 'dashed',
      height: 1
    } as SpacerSection
  },
  {
    id: 'sec-meta-info',
    type: 'text',
    enabled: true,
    content: {
      text: 'VEHICLE:  \nMATERIAL: \nOPERATOR: ',
      align: 'left',
      bold: false
    } as TextSection
  },
  {
    id: 'sec-blank-spacer',
    type: 'spacer',
    enabled: true,
    content: {
      style: 'blank',
      height: 1
    } as SpacerSection
  },
  {
    id: 'sec-signatures',
    type: 'text',
    enabled: true,
    content: {
      text: '____________        ____________\n  OPERATOR            DRIVER   ',
      align: 'left',
      bold: false
    } as TextSection
  },
  {
    id: 'sec-divider-4',
    type: 'spacer',
    enabled: true,
    content: {
      style: 'solid',
      height: 1
    } as SpacerSection
  },
  {
    id: 'sec-barcode',
    type: 'barcode',
    enabled: true,
    content: {
      value: 'VERIFIED WEIGHING TERMINAL',
      format: 'CODE128',
      height: 30,
      includeText: true
    } as BarcodeSection
  }
];

const generateReceiptPlainText = (sections: ReceiptSection[]): string => {
  return sections
    .filter(s => s.enabled)
    .map(s => {
      switch (s.type) {
        case 'text': {
          const content = s.content as TextSection;
          return content.text || '';
        }
        case 'spacer': {
          const content = s.content as SpacerSection;
          const style = content.style;
          const height = content.height || 1;
          if (style === 'solid') {
            return '━'.repeat(32);
          } else if (style === 'dashed') {
            return '╌'.repeat(32);
          } else if (style === 'double') {
            return '═'.repeat(32);
          } else if (style === 'stars') {
            return '*'.repeat(32);
          } else if (style === 'dots') {
            return '•'.repeat(32);
          } else {
            return '\n'.repeat(height);
          }
        }
        case 'barcode': {
          const content = s.content as BarcodeSection;
          return `[Barcode: ${content.value}]`;
        }
        case 'qrcode': {
          const content = s.content as QrcodeSection;
          return `[QR Code: ${content.value}]`;
        }
        case 'header': {
          const content = s.content as HeaderSection;
          let out = content.title ? `*** ${content.title.toUpperCase()} ***\n` : '';
          if (content.subtitle) {
            out += `${content.subtitle}\n`;
          }
          if (content.metadata) {
            out += content.metadata.map(m => `${m.label}: ${m.value}`).join('\n') + '\n';
          }
          return out.trim();
        }
        case 'items': {
          const content = s.content as ItemsSection;
          let out = '';
          if (content.showHeaders) {
            out += 'Item          Qty    Price    Total\n';
            out += '━'.repeat(32) + '\n';
          }
          out += (content.rows || []).map(r => {
            const name = (r.name || '').padEnd(12).slice(0, 12);
            const qty = r.qty !== undefined ? String(r.qty).padStart(5) : (r.weight !== undefined ? `${r.weight}kg`.padStart(5) : '     ');
            const price = `$${r.price.toFixed(2)}`.padStart(8);
            const total = `$${r.total.toFixed(2)}`.padStart(8);
            return `${name}${qty}${price}${total}`;
          }).join('\n');
          return out;
        }
        case 'totals': {
          const content = s.content as TotalsSection;
          return (content.rows || []).map(r => `${r.label.padEnd(16)}: ${r.value}`).join('\n');
        }
        case 'footer': {
          const content = s.content as FooterSection;
          let out = content.text || '';
          if (content.asciiArt) {
            out += `\n${content.asciiArt}`;
          }
          return out;
        }
        case 'image': {
          return '[Image Graphic]';
        }
        default:
          return '';
      }
    })
    .join('\n');
};

export default function App() {
  const [sections, setSections] = useState<ReceiptSection[]>(INITIAL_SECTIONS);
  const [paperWidthMm, setPaperWidthMm] = useState<58 | 80>(58);
  const [selectedPaperStyle, setSelectedPaperStyle] = useState<PaperType>(PAPER_ROLL_STYLES[0]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  const receiptRef = useRef<HTMLDivElement>(null);

  // Hardware bluetooth state
  const [btConnected, setBtConnected] = useState<boolean>(false);
  const [btDeviceName, setBtDeviceName] = useState<string>('');

  // Simulation state
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printProgress, setPrintProgress] = useState<number>(0);

  // Sharing states
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [pngUrl, setPngUrl] = useState<string>('');
  const [pngLoading, setPngLoading] = useState<boolean>(false);
  const [previewPngLoading, setPreviewPngLoading] = useState<boolean>(false);

  const CLEAN_RECEIPT_CSS = `
    * {
      box-sizing: border-box !important;
      margin: 0;
      padding: 0;
    }
    .font-mono {
      font-family: monospace, Courier, "Courier New", ui-monospace !important;
    }
    .select-none {
      user-select: none !important;
    }
    .mx-auto {
      margin-left: auto !important;
      margin-right: auto !important;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .text-left {
      text-align: left !important;
    }
    .font-bold {
      font-weight: bold !important;
    }
    .uppercase {
      text-transform: uppercase !important;
    }
    .tracking-wider {
      letter-spacing: 0.05em !important;
    }
    .tracking-widest {
      letter-spacing: 0.1em !important;
    }
    .leading-snug {
      line-height: 1.375 !important;
    }
    .leading-tight {
      line-height: 1.25 !important;
    }
    .leading-none {
      line-height: 1 !important;
    }
    .border-b {
      border-bottom-width: 1px !important;
    }
    .border-t {
      border-top-width: 1px !important;
    }
    .border-dashed {
      border-style: dashed !important;
    }
    .pb-2 {
      padding-bottom: 0.5rem !important;
    }
    .mb-2 {
      margin-bottom: 0.5rem !important;
    }
    .pb-1 {
      padding-bottom: 0.25rem !important;
    }
    .pt-2 {
      padding-top: 0.5rem !important;
    }
    .pb-0.5 {
      padding-bottom: 0.125rem !important;
    }
    .mb-1 {
      margin-bottom: 0.25rem !important;
    }
    .mt-2 {
      margin-top: 0.5rem !important;
    }
    .mt-0.5 {
      margin-top: 0.125rem !important;
    }
    .space-y-0.5 > * + * {
      margin-top: 0.125rem !important;
    }
    .space-y-1 > * + * {
      margin-top: 0.25rem !important;
    }
    .flex {
      display: flex !important;
    }
    .justify-between {
      justify-content: space-between !important;
    }
    .items-center {
      align-items: center !important;
    }
    .items-stretch {
      align-items: stretch !important;
    }
    .flex-col {
      flex-direction: column !important;
    }
    .flex-1 {
      flex: 1 1 0% !important;
    }
    .shrink-0 {
      flex-shrink: 0 !important;
    }
    .truncate {
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    .underline {
      text-decoration-line: underline !important;
    }
    .bg-current {
      background-color: currentColor !important;
    }
    .text-white {
      color: #ffffff !important;
    }
    .px-1.5 {
      padding-left: 0.375rem !important;
      padding-right: 0.375rem !important;
    }
    .py-0.5 {
      padding-top: 0.125rem !important;
      padding-bottom: 0.125rem !important;
    }
    .rounded-xs {
      border-radius: 1px !important;
    }
    .rounded {
      border-radius: 0.25rem !important;
    }
    .p-1 {
      padding: 0.25rem !important;
    }
    .bg-white {
      background-color: #ffffff !important;
    }
    .border {
      border-width: 1px !important;
      border-style: solid !important;
    }
    .border-stone-200 {
      border-color: #e7e5e4 !important;
    }
    .mb-1 {
      margin-bottom: 0.25rem !important;
    }
    .grid {
      display: grid !important;
    }
    .grid-cols-15 {
      grid-template-columns: repeat(15, minmax(0, 1fr)) !important;
    }
    .w-14 {
      width: 3.5rem !important;
    }
    .h-14 {
      height: 3.5rem !important;
    }
    .w-full {
      width: 100% !important;
    }
    .h-full {
      height: 100% !important;
    }
    .h-8 {
      height: 2rem !important;
    }
    .space-x-px > * + * {
      margin-left: 1px !important;
    }
    .w-4\\/5 {
      width: 80% !important;
    }
    .max-w-\\[160px\\] {
      max-width: 160px !important;
    }
    .bg-transparent {
      background-color: transparent !important;
    }
    .scale-x-\\[1\\.3\\] {
      transform: scaleX(1.3) !important;
    }
    .bg-slate-900 {
      background-color: #0f172a !important;
    }
  `;

  const handleSharePreviewPng = async (shouldShare: boolean) => {
    if (!receiptRef.current) return;
    setPreviewPngLoading(true);
    try {
      // Small timeout to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 150));
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3, // Crisp resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#fefefc', // Force clean light paper background
        onclone: (clonedDoc) => {
          // Remove all complex style and link sheets to prevent parser crashes
          const links = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
          links.forEach(el => el.remove());
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach(el => el.remove());

          // Inject ultra clean, simple, standard styles for maximum compatibility
          const customStyle = clonedDoc.createElement('style');
          customStyle.textContent = CLEAN_RECEIPT_CSS;
          clonedDoc.head.appendChild(customStyle);
        }
      });
      const dataUrl = canvas.toDataURL('image/png');
      
      if (shouldShare) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `weighbridge-receipt-${paperWidthMm}mm.png`, {
          type: 'image/png',
        });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Weighbridge Thermal Receipt Image',
            text: `Visual PNG image of thermal receipt for ${paperWidthMm}mm paper`,
          });
        } else {
          // Fallback to Blob Object URL download for iframe sandbox compatibility
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `weighbridge-receipt-${paperWidthMm}mm.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        }
      } else {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `weighbridge-receipt-${paperWidthMm}mm.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch (err: any) {
      if (err && (err.name === 'AbortError' || err.message?.toLowerCase().includes('canceled') || err.message?.toLowerCase().includes('cancelled') || err.message?.toLowerCase().includes('abort'))) {
        console.log('Share canceled by user.');
        return;
      }
      console.error('Failed to generate preview PNG:', err);
    } finally {
      setPreviewPngLoading(false);
    }
  };

  // Update paper visual dimensions when width setting changes
  useEffect(() => {
    const updated = {
      ...selectedPaperStyle,
      widthMm: paperWidthMm,
      pxWidth: paperWidthMm === 58 ? 260 : 330
    };
    setSelectedPaperStyle(updated);
  }, [paperWidthMm]);

  // Reset and auto-generate PNG when modal is opened
  useEffect(() => {
    if (isShareOpen) {
      setPngUrl(''); // Reset PNG so it is regenerated fresh
      handleGeneratePng();
    }
  }, [isShareOpen]);

  const handleGeneratePng = async () => {
    if (!receiptRef.current) return;
    setPngLoading(true);
    try {
      // Small timeout to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 150));
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3, // Crisp resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#fefefc', // Force clean light paper background
        onclone: (clonedDoc) => {
          // Remove all complex style and link sheets to prevent parser crashes
          const links = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
          links.forEach(el => el.remove());
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach(el => el.remove());

          // Inject ultra clean, simple, standard styles for maximum compatibility
          const customStyle = clonedDoc.createElement('style');
          customStyle.textContent = CLEAN_RECEIPT_CSS;
          clonedDoc.head.appendChild(customStyle);
        }
      });
      const dataUrl = canvas.toDataURL('image/png');
      setPngUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate PNG receipt image:', err);
    } finally {
      setPngLoading(false);
    }
  };


  // Connect to Bluetooth printer
  const handleConnectBluetooth = async () => {
    if (btConnected) {
      btPrinter.disconnect();
      setBtConnected(false);
      setBtDeviceName('');
      return;
    }

    try {
      const name = await btPrinter.connect();
      setBtConnected(true);
      setBtDeviceName(name);
    } catch (err: any) {
      alert(err.message || 'Bluetooth Connection failed.');
    }
  };

  // Compile layout and print (Trigger visual print feeding and Bluetooth writes)
  const handlePrint = async () => {
    if (isPrinting) return;

    setIsPrinting(true);
    setPrintProgress(0);

    // Open share dialog box immediately on clicking print slip!
    setIsShareOpen(true);

    // 1. Compile exact ESC/POS binary data
    let compiledBytes = new Uint8Array();
    try {
      compiledBytes = await compileEscPos(sections, paperWidthMm);
    } catch (err) {
      console.error('Failed compiling receipt data:', err);
    }

    // 2. Start visual paper feeding simulator in blocks
    const totalDuration = paperWidthMm === 58 ? 3200 : 4200; // time in ms
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / totalDuration) * 100);
      setPrintProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setIsPrinting(false);
      }
    }, 50);

    // 3. Dispatch to hardware printer in background if connected
    if (btConnected) {
      try {
        await btPrinter.print(compiledBytes);
      } catch (err: any) {
        console.error('Hardware print failed:', err);
        alert(`Bluetooth Print Interrupted: ${err.message}`);
      }
    }
  };

  const handleCopyText = () => {
    const plainText = generateReceiptPlainText(sections);
    navigator.clipboard.writeText(plainText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
      });
  };

  const handleWhatsAppShare = () => {
    const plainText = generateReceiptPlainText(sections);
    const encodedText = encodeURIComponent(plainText);
    const url = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(url, '_blank');
  };

  const handleEmailShare = () => {
    const plainText = generateReceiptPlainText(sections);
    const subject = encodeURIComponent('Weighbridge Receipt Slip');
    const body = encodeURIComponent(plainText);
    const url = `mailto:?subject=${subject}&body=${body}`;
    window.open(url, '_blank');
  };

  const handleSmsShare = () => {
    const plainText = generateReceiptPlainText(sections);
    const body = encodeURIComponent(plainText);
    const url = `sms:?body=${body}`;
    window.open(url, '_blank');
  };

  const handleNativeShare = async () => {
    const plainText = generateReceiptPlainText(sections);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Weighbridge Receipt Slip',
          text: plainText,
        });
      } catch (err: any) {
        console.error('Web Share failed:', err);
      }
    } else {
      handleCopyText();
    }
  };

  const handleDownloadPng = async () => {
    if (!pngUrl) return;
    try {
      const res = await fetch(pngUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `weighbridge-receipt-${paperWidthMm}mm.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error('Failed to download PNG:', err);
    }
  };

  const handleSharePng = async () => {
    if (!pngUrl) return;
    try {
      const res = await fetch(pngUrl);
      const blob = await res.blob();
      const file = new File([blob], `weighbridge-receipt-${paperWidthMm}mm.png`, {
        type: 'image/png',
      });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Weighbridge Thermal Receipt Image',
          text: `Visual PNG image of thermal receipt for ${paperWidthMm}mm paper`,
        });
      } else {
        handleDownloadPng();
      }
    } catch (err: any) {
      if (err && (err.name === 'AbortError' || err.message?.toLowerCase().includes('canceled') || err.message?.toLowerCase().includes('cancelled') || err.message?.toLowerCase().includes('abort'))) {
        console.log('Share canceled by user.');
        return;
      }
      console.error('Web Share failed for PNG, downloading fallback:', err);
      handleDownloadPng();
    }
  };

  // High-fidelity HTML presentation of standard receipt nodes to render inside virtual paper roll
  const renderThermalReceiptHtml = () => {
    const charsCount = paperWidthMm === 58 ? 32 : 48;
    const currentColor = selectedPaperStyle.hexColor || '#1D1C1A';

    const getAlphaColor = (hex: string, alpha: number) => {
      if (hex.startsWith('#')) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      return hex;
    };

    return (
      <div 
        className={`font-mono select-none mx-auto ${selectedPaperStyle.textClass}`} 
        style={{ 
          width: `${charsCount}ch`,
          maxWidth: '100%',
          fontSize: paperWidthMm === 58 ? '11px' : '9px',
          lineHeight: '1.25',
          letterSpacing: '0px',
          textAlign: 'left'
        }}
      >
        {sections
          .filter((s) => s.enabled)
          .map((sec) => {
            switch (sec.type) {
              case 'header': {
                const h = sec.content as any;
                return (
                  <div 
                    key={sec.id} 
                    className="border-b border-dashed pb-2 mb-2 text-center" 
                    style={{ borderColor: currentColor }}
                    id={`preview-${sec.id}`}
                  >
                    <h3 className="font-bold text-xs uppercase tracking-wider">{h.title}</h3>
                    {h.subtitle && <p className="text-[8px] opacity-80 leading-snug">{h.subtitle}</p>}
                    
                    {h.metadata && h.metadata.length > 0 && (
                      <div className="space-y-0.5 mt-2 text-[8px] opacity-75">
                        {h.metadata.map((meta: any, idx: number) => (
                          <div key={idx} className="flex justify-between">
                            <span className="font-semibold">{meta.label}:</span>
                            <span className="text-right">{meta.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              case 'items': {
                const it = sec.content as any;
                return (
                  <div 
                    key={sec.id} 
                    className="text-[8.5px] py-1 border-b border-dashed" 
                    style={{ borderColor: getAlphaColor(currentColor, 0.6) }}
                    id={`preview-${sec.id}`}
                  >
                    {it.showHeaders !== false && (
                      <div 
                        className="flex justify-between font-bold border-b pb-0.5 mb-1 text-[8px] uppercase"
                        style={{ borderColor: getAlphaColor(currentColor, 0.3) }}
                      >
                        <span>Item Ledger</span>
                        <span>Total</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      {it.rows?.map((row: any, idx: number) => {
                        const isWeighed = row.weight !== undefined && row.weight > 0;
                        return (
                          <div key={idx} className="flex justify-between leading-snug">
                            <div className="text-left max-w-[70%] truncate">
                              <span>{row.name}</span>
                              <span className="block text-[7.5px] opacity-70 text-stone-500 font-mono">
                                {isWeighed ? (
                                  <>{row.weight.toFixed(3)} kg @ ${row.price.toFixed(2)}/kg</>
                                ) : (
                                  <>Qty: {row.qty ?? 1} @ ${row.price.toFixed(2)}</>
                                )}
                              </span>
                            </div>
                            <span className="font-semibold text-right shrink-0 font-mono">${row.total.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              case 'totals': {
                const tot = sec.content as any;
                return (
                  <div 
                    key={sec.id} 
                    className="text-[8.5px] py-1 space-y-0.5 border-b border-dashed" 
                    style={{ borderColor: getAlphaColor(currentColor, 0.8) }}
                    id={`preview-${sec.id}`}
                  >
                    {tot.rows?.map((row: any, idx: number) => (
                      <div key={idx} className={`flex justify-between ${row.isBold ? 'font-bold text-[9.5px]' : ''}`}>
                        <span>{row.label}</span>
                        <span>{row.value}</span>
                      </div>
                    ))}
                  </div>
                );
              }

              case 'text': {
                const t = sec.content as any;
                const alignClass = 
                  t.align === 'center' ? 'text-center' : t.align === 'right' ? 'text-right' : 'text-left';
                
                const customStyle: React.CSSProperties = {
                  whiteSpace: 'pre',
                };

                const styleClass = `
                  ${t.bold ? 'font-bold' : ''} 
                  ${t.underline ? 'underline ' + selectedPaperStyle.burnClass : ''} 
                  ${t.invert ? 'bg-current text-white px-1.5 py-0.5 rounded-xs' : ''}
                `;

                if (t.doubleWidth || t.doubleHeight) {
                  customStyle.display = 'inline-block';
                  customStyle.transform = `scale(${t.doubleWidth ? 2 : 1}, ${t.doubleHeight ? 2 : 1})`;
                  customStyle.transformOrigin = t.align === 'center' ? 'center top' : t.align === 'right' ? 'right top' : 'left top';
                  customStyle.width = t.doubleWidth ? '50%' : '100%';
                  customStyle.height = t.doubleHeight ? '200%' : '100%';
                  customStyle.marginBottom = t.doubleHeight ? '1.1em' : '0px';
                }

                return (
                  <p 
                    key={sec.id} 
                    className={`py-0.5 whitespace-pre leading-tight ${alignClass} ${styleClass}`}
                    style={customStyle}
                    id={`preview-${sec.id}`}
                  >
                    {t.text}
                  </p>
                );
              }

              case 'spacer': {
                const sp = sec.content as any;
                let char = ' ';
                if (sp.style === 'dashed') char = '-';
                else if (sp.style === 'solid') char = '_';
                else if (sp.style === 'stars') char = '*';
                else if (sp.style === 'dots') char = '.';
                else if (sp.style === 'double') char = '=';

                return (
                  <div 
                    key={sec.id} 
                    className="text-center font-mono leading-none py-1 select-none opacity-80"
                    style={{ letterSpacing: '0px', whiteSpace: 'pre' }}
                  >
                    {char === ' ' ? '\n'.repeat(sp.height) : char.repeat(charsCount)}
                  </div>
                );
              }

              case 'barcode': {
                const b = sec.content as any;
                return (
                  <div key={sec.id} className="flex flex-col items-center py-2 select-none" id={`preview-${sec.id}`}>
                    <div className="flex items-stretch h-8 space-x-px w-4/5 max-w-[160px] mb-0.5">
                      {Array.from({ length: 42 }).map((_, i) => {
                        // Simulated barcode strips
                        const isLine = (i * 7 + 13) % 11 > 3;
                        const isWide = (i * 3 + 7) % 5 === 0;
                        return (
                          <div
                            key={i}
                            className={`h-full flex-1 ${isLine ? 'bg-current' : 'bg-transparent'} ${isWide ? 'scale-x-[1.3]' : ''}`}
                          />
                        );
                      })}
                    </div>
                    {b.includeText !== false && <span className="text-[7.5px] tracking-widest font-mono opacity-85">{b.value}</span>}
                  </div>
                );
              }

              case 'qrcode': {
                const qr = sec.content as any;
                return (
                  <div key={sec.id} className="flex flex-col items-center py-2 select-none" id={`preview-${sec.id}`}>
                    <div className="grid grid-cols-15 w-14 h-14 bg-white p-1 border border-stone-200 mb-1 gap-[1px]">
                      {Array.from({ length: 225 }).map((_, i) => {
                        const row = Math.floor(i / 15);
                        const col = i % 15;
                        const isTopLeft = row < 4 && col < 4;
                        const isTopRight = row < 4 && col >= 11;
                        const isBottomLeft = row >= 11 && col < 4;
                        
                        const isFinderRing = 
                           (isTopLeft && (row === 0 || row === 3 || col === 0 || col === 3)) ||
                           (isTopRight && (row === 0 || row === 3 || col === 11 || col === 14)) ||
                           (isBottomLeft && (row === 11 || row === 14 || col === 0 || col === 3));
                           
                        const isFinderDot = 
                          (isTopLeft && row === 1.5 && col === 1.5) || // close approximate center
                          (isTopRight && row === 1.5 && col === 12.5) ||
                          (isBottomLeft && row === 12.5 && col === 1.5);
                          
                        const isCenterDark = isFinderRing || isFinderDot || ((row + col) % 2 === 0 && !isTopLeft && !isTopRight && !isBottomLeft);
                        return (
                          <div
                            key={i}
                            className={`w-full h-full ${isCenterDark ? 'bg-slate-900' : 'bg-transparent'}`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[7.5px] font-mono opacity-85">{qr.value}</span>
                  </div>
                );
              }

              case 'image': {
                const img = sec.content as any;
                if (!img.dataUrl) return null;
                return (
                  <div key={sec.id} className="flex flex-col items-center py-2 select-none" id={`preview-${sec.id}`}>
                    <img 
                      src={img.dataUrl} 
                      alt="Dithered visual print" 
                      className="max-w-[160px] h-auto rounded border border-stone-100"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <span className="text-[6.5px] text-stone-400 font-mono mt-0.5">DITHER_1BIT_RASTER</span>
                  </div>
                );
              }

              case 'footer': {
                const f = sec.content as any;
                return (
                  <div 
                    key={sec.id} 
                    className="text-center pt-2 pb-1 border-t border-dashed" 
                    style={{ borderColor: getAlphaColor(currentColor, 0.4) }}
                    id={`preview-${sec.id}`}
                  >
                    {f.asciiArt && (
                      <pre className="text-[7.5px] opacity-80 overflow-hidden leading-tight py-1 font-mono text-center">
                        {f.asciiArt}
                      </pre>
                    )}
                    <p className="text-[8.5px] font-bold uppercase tracking-wide leading-tight">{f.text}</p>
                  </div>
                );
              }

              default:
                return null;
            }
          })}
      </div>
    );
  };

const UniverseScaleLogo = () => (
  <svg className="w-10 h-10 text-amber-400" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer orbit rings */}
    <circle cx="50" cy="50" r="47" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" className="text-amber-500/40" />
    <circle cx="50" cy="50" r="43" stroke="currentColor" strokeWidth="0.8" className="text-amber-500/25" />
    
    {/* Star dust and nebula points */}
    <circle cx="24" cy="28" r="0.8" fill="#FFE082" />
    <circle cx="78" cy="22" r="0.6" fill="#FFF" />
    <circle cx="76" cy="74" r="0.8" fill="#FFF59D" />
    <circle cx="28" cy="76" r="0.5" fill="#FFE082" />
    <circle cx="50" cy="12" r="1.2" fill="#FFE082" />
    <circle cx="12" cy="50" r="1" fill="#FFE082" />
    <circle cx="88" cy="50" r="1" fill="#FFE082" />
    
    {/* Spiral stellar galaxy in background pivot */}
    <ellipse cx="50" cy="38" rx="16" ry="6" fill="#F59E0B" className="opacity-30 blur-xs" transform="rotate(22 50 38)" />
    <ellipse cx="50" cy="38" rx="8" ry="3.5" fill="#FFFBEB" className="opacity-65" transform="rotate(22 50 38)" />
    
    {/* Golden pillar */}
    <path d="M50 20 L50 82" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-amber-400" />
    {/* Plinth */}
    <path d="M40 82 L60 82" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-amber-400" />
    <path d="M36 86 L64 86" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-amber-400" />
    
    {/* Balance Beam */}
    <path d="M18 28 Q50 23 82 28" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" className="text-amber-400" />
    {/* Pointer spire */}
    <path d="M50 20 L50 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-400" />
    <circle cx="50" cy="24" r="3.5" fill="#0F172A" stroke="currentColor" strokeWidth="2" className="text-amber-400" />
    
    {/* Left Pan Strings & Plate */}
    <path d="M18 28 L10 55 M18 28 L26 55" stroke="currentColor" strokeWidth="0.8" className="text-amber-400/60" />
    <path d="M8 55 Q18 59 28 55" stroke="currentColor" strokeWidth="2" fill="none" className="text-amber-400" />
    {/* Sun and crescent moon representation */}
    <circle cx="18" cy="46" r="3" fill="#FCD34D" />
    <path d="M17 46 A 3 3 0 0 1 21 43" fill="#FFF" opacity="0.9" />
    
    {/* Right Pan Strings & Plate */}
    <path d="M82 28 L74 55 M82 28 L90 55" stroke="currentColor" strokeWidth="0.8" className="text-amber-400/60" />
    <path d="M72 55 Q82 59 92 55" stroke="currentColor" strokeWidth="2" fill="none" className="text-amber-400" />
    {/* Stars/Planets representation on right plate */}
    <circle cx="82" cy="46" r="2.5" fill="#818CF8" />
    <circle cx="85" cy="43" r="1" fill="#FFF" />
  </svg>
);

  return (
    <div className="min-h-screen bg-[#090D16] text-stone-100 font-sans antialiased relative overflow-hidden" id="application-body">
      {/* Immersive background stars */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#141B2D_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />
      
      {/* Navigation Header bar */}
      <header className="bg-[#0D1322]/95 border-b border-slate-800/80 sticky top-0 z-50 backdrop-blur-md shadow-lg" id="navigation-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo brand */}
          <div className="flex items-center space-x-3.5 select-none">
            <img src="/logo.svg" alt="UWS Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.35)] animate-pulse" />
            <div>
              <h1 className="text-sm font-black text-amber-400 tracking-wider font-mono">UWS</h1>
              <p className="text-[9px] text-amber-500/70 font-semibold tracking-widest uppercase">Universe Weighing System • Balancing the Cosmos</p>
            </div>
          </div>

          {/* WhatsApp Support Button */}
          <a
            href="https://wa.me/+916232101154"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-bold text-emerald-400 transition-all active:scale-95"
            id="whatsapp-header-support-btn"
          >
            <MessageCircle size={14} className="animate-bounce" />
            <span className="hidden sm:inline">WhatsApp Support</span>
            <span className="sm:hidden">Support</span>
          </a>

        </div>
      </header>

      {/* Main Container Wrapper */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10" id="main-content-grid">
        <ReceiptEditor
          sections={sections}
          onUpdateSections={setSections}
          onPrint={handlePrint}
          isPrinting={isPrinting}
          paperWidthMm={paperWidthMm}
          onSetPaperWidth={setPaperWidthMm}
          previewNode={
            <div className="bg-[#0E1524] rounded-3xl border border-slate-800 p-6 shadow-2xl flex flex-col items-center">
              <div className="w-full flex items-center justify-between pb-4 border-b border-slate-800/60 mb-6">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                    <Printer size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Live Receipt Preview</h3>
                    <p className="text-[10px] text-slate-400 font-sans">Real-time simulation of the generated thermal printout</p>
                  </div>
                </div>
              </div>

              {/* Realistic Paper roll sheet */}
              <div 
                ref={receiptRef}
                className={`w-full border border-stone-200 shadow-xl relative rounded-xs transition-all ${selectedPaperStyle.bgClass}`}
                style={{ 
                  minHeight: '300px',
                  width: `${selectedPaperStyle.pxWidth}px`,
                  maxWidth: '100%',
                  padding: '24px 16px'
                }}
              >
                {/* Subtle paper background texture or details */}
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#e5e5e5_50%,transparent_50%)] bg-[size:8px_100%] opacity-40 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-2 bg-[linear-gradient(45deg,transparent_25%,#fff_25%,#fff_75%,transparent_75%),linear-gradient(-45deg,transparent_25%,#fff_25%,#fff_75%,transparent_75%)] bg-[size:6px_6px] opacity-30 pointer-events-none" />
                
                {renderThermalReceiptHtml()}
              </div>

              {/* PNG Sharing & Export Toolbar */}
              <div className="w-full mt-6 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase font-sans">
                  Quick Export PNG
                </span>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    onClick={async () => {
                      if (previewPngLoading) return;
                      await handleSharePreviewPng(false); // download
                    }}
                    disabled={previewPngLoading}
                    className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer disabled:opacity-40"
                    title="Download PNG to device"
                    id="preview-btn-download-png"
                  >
                    {previewPngLoading ? (
                      <RefreshCw size={13} className="animate-spin text-amber-400" />
                    ) : (
                      <Download size={13} />
                    )}
                    <span>Download PNG</span>
                  </button>

                  <button
                    onClick={async () => {
                      if (previewPngLoading) return;
                      await handleSharePreviewPng(true); // share
                    }}
                    disabled={previewPngLoading}
                    className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 hover:border-amber-500/40 rounded-xl text-xs font-semibold text-amber-400 transition-all cursor-pointer disabled:opacity-40"
                    title="Share receipt PNG image"
                    id="preview-btn-share-png"
                  >
                    {previewPngLoading ? (
                      <RefreshCw size={13} className="animate-spin text-amber-400" />
                    ) : (
                      <Share2 size={13} />
                    )}
                    <span>Share PNG</span>
                  </button>
                </div>
              </div>
            </div>
          }
        />
      </main>

      {/* Standard bottom watermark footer */}
      <footer className="bg-[#070A11] border-t border-slate-900 py-6 text-center text-[10px] text-amber-500/55 font-medium tracking-wide uppercase select-none relative z-10">
        <span>UWS • Universe Weighing System • Balancing The Cosmos • © 2026</span>
      </footer>

      {/* Floating WhatsApp Support Badge */}
      <div className="fixed bottom-6 right-6 z-40 group flex flex-col items-end" id="whatsapp-floating-support">
        <a
          href="https://wa.me/+916232101154"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 p-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full shadow-[0_4px_24px_rgba(16,185,129,0.4)] transition-all duration-300 hover:scale-110 active:scale-95 relative"
        >
          {/* Pulsing glow layer */}
          <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping opacity-75 pointer-events-none" />
          
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 ease-out whitespace-nowrap text-xs font-bold text-slate-950 uppercase tracking-wider leading-none">
            Support
          </span>
        </a>
      </div>

      {/* Immersive Share Dialog Modal */}
      {isShareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in" id="share-modal-backdrop">
          <div 
            className="bg-[#0E1524] border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]"
            id="share-modal-container"
          >
            {/* Ambient gold glow accent */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/60 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Share2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Share Weighbridge Receipt</h3>
                  <p className="text-[10px] text-slate-400 font-sans">Distribute the digital image or plaintext copy instantly</p>
                </div>
              </div>
              <button 
                onClick={() => setIsShareOpen(false)}
                className="p-1.5 hover:bg-slate-800/80 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Close dialog"
                id="close-share-dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Split Dual-Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-1 pr-1 pb-2">
              
              {/* Left Column: High-Fidelity Ticket Image */}
              <div className="flex flex-col space-y-3">
                <div className="flex items-center space-x-1.5">
                  <ImageIcon size={14} className="text-amber-400" />
                  <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider font-mono">
                    Visual Image Ticket
                  </span>
                </div>
                
                <div className="bg-[#080D18] rounded-2xl border border-slate-800/80 p-4 flex-1 min-h-[220px] max-h-[340px] overflow-y-auto flex flex-col items-center justify-center relative">
                  {pngLoading ? (
                    <div className="flex flex-col items-center space-y-3">
                      <RefreshCw className="animate-spin text-amber-400" size={24} />
                      <span className="text-xs text-slate-400 font-medium font-sans">Generating high-fidelity ticket image...</span>
                    </div>
                  ) : pngUrl ? (
                    <div className="relative group max-w-full">
                      <img 
                        src={pngUrl} 
                        alt="Weighbridge Thermal Receipt" 
                        className="border border-slate-700/50 rounded-lg shadow-lg max-w-[180px] h-auto object-contain bg-[#fefefc]" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center pointer-events-none">
                        <span className="text-[10px] bg-slate-900/90 border border-slate-700 text-slate-200 px-2 py-1 rounded font-sans">
                          Sharp 3x Scale
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={handleGeneratePng}
                      className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                    >
                      Generate Preview Image
                    </button>
                  )}
                </div>

                {/* Image-based share and download buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleDownloadPng}
                    disabled={!pngUrl || pngLoading}
                    className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-slate-800/50 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-800/50 border border-slate-700/60 rounded-xl text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer active:scale-95"
                    id="share-btn-download-png"
                  >
                    <Download size={13} />
                    <span>Download PNG</span>
                  </button>

                  <button 
                    onClick={handleSharePng}
                    disabled={!pngUrl || pngLoading}
                    className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 disabled:hover:bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 rounded-xl text-xs font-semibold text-amber-400 transition-all cursor-pointer active:scale-95"
                    id="share-btn-native-png"
                  >
                    <Share2 size={13} />
                    <span>Share Image</span>
                  </button>
                </div>

                <div className="bg-[#070A11]/60 border border-slate-800/60 rounded-xl p-2.5 text-[10px] text-slate-400 text-center leading-relaxed font-sans">
                  The generated PNG is rendered at <strong className="text-amber-400 font-medium">3x high-fidelity scale</strong>, matching standard thermal printing aspect ratios.
                </div>
              </div>

              {/* Right Column: Plaintext Ticket */}
              <div className="flex flex-col space-y-3">
                <div className="flex items-center space-x-1.5">
                  <FileText size={14} className="text-amber-400" />
                  <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider font-mono">
                    Plaintext Ticket Preview
                  </span>
                </div>

                <div className="relative group bg-[#080D18] rounded-2xl border border-slate-800/80 p-4 flex-1 min-h-[220px] max-h-[340px] overflow-y-auto font-mono text-xs text-amber-200/90 leading-relaxed whitespace-pre-wrap select-all">
                  {generateReceiptPlainText(sections)}
                </div>

                {/* Primary text-based share buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleCopyText}
                    className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer active:scale-95"
                    id="share-btn-copy"
                  >
                    {copied ? (
                      <>
                        <Check size={13} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy Plaintext</span>
                      </>
                    )}
                  </button>

                  <button 
                    onClick={handleWhatsAppShare}
                    className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl text-xs font-semibold text-emerald-400 transition-all cursor-pointer active:scale-95"
                    id="share-btn-whatsapp"
                  >
                    <MessageSquare size={13} />
                    <span>WhatsApp</span>
                  </button>

                  <button 
                    onClick={handleEmailShare}
                    className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 rounded-xl text-xs font-semibold text-blue-400 transition-all cursor-pointer active:scale-95"
                    id="share-btn-email"
                  >
                    <Mail size={13} />
                    <span>Email</span>
                  </button>

                  <button 
                    onClick={handleSmsShare}
                    className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 rounded-xl text-xs font-semibold text-purple-400 transition-all cursor-pointer active:scale-95"
                    id="share-btn-sms"
                  >
                    <Smartphone size={13} />
                    <span>SMS</span>
                  </button>
                </div>

                {/* Native system sharing */}
                <button 
                  onClick={handleNativeShare}
                  className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-[#090D16] border border-amber-500/30 hover:border-amber-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98]"
                  id="share-btn-native"
                >
                  <Share2 size={13} />
                  <span>Use System Share Sheet</span>
                  <ExternalLink size={12} className="opacity-60" />
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
