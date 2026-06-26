export type ReceiptSectionType =
  | 'header'
  | 'items'
  | 'totals'
  | 'barcode'
  | 'qrcode'
  | 'image'
  | 'text'
  | 'spacer'
  | 'footer';

export interface HeaderSection {
  title: string;
  subtitle?: string;
  metadata?: { label: string; value: string }[];
}

export interface ItemRow {
  name: string;
  qty?: number;
  weight?: number; // Weight in kg or lbs
  price: number;
  total: number;
}

export interface ItemsSection {
  rows: ItemRow[];
  showHeaders?: boolean;
}

export interface TotalRow {
  label: string;
  value: string;
  isBold?: boolean;
}

export interface TotalsSection {
  rows: TotalRow[];
}

export interface BarcodeSection {
  value: string;
  format: 'CODE128' | 'CODE39' | 'EAN13' | 'UPCA';
  height: number; // 24 to 72 px
  includeText?: boolean;
}

export interface QrcodeSection {
  value: string;
  size: number; // 100 to 250 px
}

export interface ImageSection {
  dataUrl: string; // Base64 of the image
  originalUrl?: string; // Original uploaded image
  ditherType: 'floyd-steinberg' | 'bayer' | 'threshold' | 'none';
  brightness: number; // 0 to 200 (100 is neutral)
  contrast: number; // 0 to 200 (100 is neutral)
  invert: boolean;
  scaleToWidth: boolean;
}

export interface TextSection {
  text: string;
  align: 'left' | 'center' | 'right';
  bold?: boolean;
  underline?: boolean;
  doubleWidth?: boolean;
  doubleHeight?: boolean;
  invert?: boolean;
}

export interface SpacerSection {
  style: 'blank' | 'dashed' | 'solid' | 'stars' | 'dots' | 'double';
  height: number; // line breaks or rows
}

export interface FooterSection {
  text: string;
  asciiArt?: string;
}

export interface ReceiptSection {
  id: string;
  type: ReceiptSectionType;
  enabled: boolean;
  content:
    | HeaderSection
    | ItemsSection
    | TotalsSection
    | BarcodeSection
    | QrcodeSection
    | ImageSection
    | TextSection
    | SpacerSection
    | FooterSection;
}

export interface PaperType {
  id: string;
  name: string;
  label: string;
  widthMm: 58 | 80;
  pxWidth: number; // Width in layout pixels
  bgClass: string; // CSS class for paper color
  textClass: string; // CSS class for print color
  burnClass: string; // CSS class for thermal burn look
}

export interface PrinterConfig {
  speed: number; // 1 (slowest) to 5 (fastest)
  burnTime: number; // density multiplier
  soundEnabled: boolean;
  volume: number; // 0 to 1
  autoCut: boolean;
}

export interface PrinterLog {
  id: string;
  title: string;
  timestamp: string;
  paperType: string;
  sections: ReceiptSection[];
}
