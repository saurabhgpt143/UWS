import React, { useState, useEffect, useRef } from 'react';
import { 
  Building, MapPin, Phone, Tag, Calendar, Clock, Truck, Box, User, Weight, Printer, RefreshCw, Sliders, Sparkles, Power, Camera, Upload, X, Loader2, Bluetooth, Radio, Activity 
} from 'lucide-react';
import { 
  ReceiptSection, BarcodeSection, SpacerSection, TextSection 
} from '../types';

interface ReceiptEditorProps {
  sections: ReceiptSection[];
  onUpdateSections: (newSections: ReceiptSection[]) => void;
  onPrint: () => void;
  isPrinting: boolean;
  paperWidthMm: 58 | 80;
  onSetPaperWidth: (width: 58 | 80) => void;
  previewNode?: React.ReactNode;
}

const getFormattedDate = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const getFormattedTime = () => {
  const d = new Date();
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
};

const resizeImageBase64 = (base64Str: string, maxDimension: number = 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', 0.8);
      resolve(compressed);
    };
    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };
    img.src = base64Str;
  });
};

export default function ReceiptEditor({
  sections,
  onUpdateSections,
  onPrint,
  isPrinting,
  paperWidthMm,
  onSetPaperWidth,
  previewNode,
}: ReceiptEditorProps) {
  // Configurable states
  const [isPowerOn, setIsPowerOn] = useState<boolean>(true);
  const [companyName, setCompanyName] = useState<string>('M.G. INDUSTRIES');
  const [address1, setAddress1] = useState<string>('Vinoba Bhave Ward, Panagar');
  const [address2, setAddress2] = useState<string>('Jabalpur (M.P.) India 483220');
  const [phone, setPhone] = useState<string>('+91 9752556113');
  const [ticketNo, setTicketNo] = useState<string>('WS-804903');
  const [date, setDate] = useState<string>(getFormattedDate());
  const [time, setTime] = useState<string>(getFormattedTime());
  const [weight, setWeight] = useState<number>(0);
  const [vehicle, setVehicle] = useState<string>('');
  const [material, setMaterial] = useState<string>('');
  const [operator, setOperator] = useState<string>('');

  // Camera & Image Upload Vision OCR States
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [scanError, setScanError] = useState<string>('');
  const [scanSuccess, setScanSuccess] = useState<string>('');

  // Vehicle Plate Scanning States
  const vehicleFileInputRef = useRef<HTMLInputElement | null>(null);
  const vehicleVideoRef = useRef<HTMLVideoElement | null>(null);
  const vehicleActiveStreamRef = useRef<MediaStream | null>(null);

  const [isVehicleScanning, setIsVehicleScanning] = useState<boolean>(false);
  const [isVehicleUploading, setIsVehicleUploading] = useState<boolean>(false);
  const [vehicleScanStatus, setVehicleScanStatus] = useState<string>('');
  const [vehicleScanError, setVehicleScanError] = useState<string>('');
  const [vehicleScanSuccess, setVehicleScanSuccess] = useState<string>('');

  // Material Vision Scanning States
  const materialFileInputRef = useRef<HTMLInputElement | null>(null);
  const materialVideoRef = useRef<HTMLVideoElement | null>(null);
  const materialActiveStreamRef = useRef<MediaStream | null>(null);

  const [isMaterialScanning, setIsMaterialScanning] = useState<boolean>(false);
  const [isMaterialUploading, setIsMaterialUploading] = useState<boolean>(false);
  const [materialScanStatus, setMaterialScanStatus] = useState<string>('');
  const [materialScanError, setMaterialScanError] = useState<string>('');
  const [materialScanSuccess, setMaterialScanSuccess] = useState<string>('');

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (vehicleActiveStreamRef.current) {
        vehicleActiveStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (materialActiveStreamRef.current) {
        materialActiveStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Bluetooth Web Bluetooth & Virtual BLE States
  const [isBtConnected, setIsBtConnected] = useState<boolean>(false);
  const [isBtConnecting, setIsBtConnecting] = useState<boolean>(false);
  const [btDevice, setBtDevice] = useState<any | null>(null);
  const [btError, setBtError] = useState<string>('');
  const [isVirtualBt, setIsVirtualBt] = useState<boolean>(false);
  const btIntervalRef = useRef<any>(null);
  const btDeviceRef = useRef<any>(null);

  // Cleanup bluetooth on unmount
  useEffect(() => {
    return () => {
      if (btIntervalRef.current) {
        clearInterval(btIntervalRef.current);
      }
      if (btDeviceRef.current && btDeviceRef.current.gatt?.connected) {
        btDeviceRef.current.gatt.disconnect();
      }
    };
  }, []);

  const connectRealBluetooth = async () => {
    if (!(navigator as any).bluetooth) {
      setBtError('Web Bluetooth is blocked by browser policies in this frame or not supported. Try the Virtual BLE Simulator!');
      return;
    }

    setBtError('');
    setIsBtConnecting(true);
    setIsVirtualBt(false);
    
    if (btIntervalRef.current) {
      clearInterval(btIntervalRef.current);
      btIntervalRef.current = null;
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['weight_scale'] },
          { services: ['0000181d-0000-1000-8000-00805f9b34fb'] },
          { namePrefix: 'Scale' },
          { namePrefix: 'Weigh' },
          { namePrefix: 'BLE' },
          { namePrefix: 'Electronic' },
          { namePrefix: 'Weight' }
        ],
        optionalServices: [
          'weight_scale',
          '0000181d-0000-1000-8000-00805f9b34fb',
          'generic_access',
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
        ]
      });

      btDeviceRef.current = device;
      setBtDevice(device);

      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to the scale GATT server.');
      }

      let characteristic: any = null;
      try {
        const service = await server.getPrimaryService('weight_scale');
        characteristic = await service.getCharacteristic('weight_measurement');
      } catch (e) {
        console.warn('Standard weight scale service not found. Searching other characteristics...');
        try {
          const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
          characteristic = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
        } catch (e2) {
          const services = await server.getPrimaryServices();
          for (const s of services) {
            const chars = await s.getCharacteristics();
            if (chars.length > 0) {
              characteristic = chars[0];
              break;
            }
          }
        }
      }

      if (!characteristic) {
        throw new Error('No weight characteristic found on this device.');
      }

      await characteristic.startNotifications();
      
      const handleValueChange = (event: any) => {
        const value = event.target.value;
        if (!value) return;

        try {
          const flags = value.getUint8(0);
          const isImperial = (flags & 0x01) !== 0;
          let rawWeight = value.getUint16(1, true);

          let parsed = rawWeight;
          if (!isImperial) {
            if (rawWeight > 20000) {
              parsed = Math.round(rawWeight / 1000);
            } else if (rawWeight > 0) {
              parsed = Math.round(rawWeight * 0.01);
            }
          } else {
            parsed = Math.round(rawWeight * 0.45359237);
          }

          if (parsed > 0) {
            handleWeightChange(parsed);
          }
        } catch (parseErr) {
          try {
            const decoder = new TextDecoder('utf-8');
            const textStr = decoder.decode(value);
            const num = textStr.match(/\d+(\.\d+)?/);
            if (num) {
              const val = Math.round(parseFloat(num[0]));
              if (val > 0) handleWeightChange(val);
            }
          } catch (decoderErr) {
            console.error('Weight parse failed:', decoderErr);
          }
        }
      };

      characteristic.addEventListener('characteristicvaluechanged', handleValueChange);
      
      device.addEventListener('gattserverdisconnected', () => {
        setIsBtConnected(false);
        setBtDevice(null);
        btDeviceRef.current = null;
        setBtError('Bluetooth scale connection lost.');
      });

      setIsBtConnected(true);
      setBtError('');
    } catch (err: any) {
      const isCancellation = err.name === 'NotFoundError' || err.message?.includes('cancelled') || err.message?.includes('chooser');
      if (isCancellation) {
        console.log('User cancelled Bluetooth pairing or device not found:', err.message);
        setBtError('Bluetooth device search cancelled.');
      } else if (err.name === 'SecurityError') {
        console.warn('Web Bluetooth security restriction:', err);
        setBtError('Web Bluetooth permissions are restricted inside standard frames. Try the Virtual BLE Simulator!');
      } else {
        console.error('Real BLE scale connection error:', err);
        setBtError(err.message || 'Bluetooth connection failed.');
      }
    } finally {
      setIsBtConnecting(false);
    }
  };

  const connectVirtualBluetooth = () => {
    setBtError('');
    setIsBtConnecting(true);
    setIsVirtualBt(true);

    if (btIntervalRef.current) {
      clearInterval(btIntervalRef.current);
    }

    if (btDeviceRef.current && btDeviceRef.current.gatt?.connected) {
      btDeviceRef.current.gatt.disconnect();
    }

    setTimeout(() => {
      setIsBtConnecting(false);
      setIsBtConnected(true);
      setBtDevice({ name: 'Cosmo-Scale BLE v4.2' });

      let baseWeight = weight > 0 ? weight : 5420;
      let counter = 0;

      btIntervalRef.current = setInterval(() => {
        const noise = Math.floor((Math.random() - 0.5) * 6);
        if (counter % 12 === 0) {
          baseWeight += Math.floor((Math.random() - 0.5) * 20);
          if (baseWeight < 10) baseWeight = 5420;
        }
        const newSimWeight = Math.max(0, baseWeight + noise);
        handleWeightChange(newSimWeight);
        counter++;
      }, 1000);
    }, 800);
  };

  const disconnectBluetooth = () => {
    if (btIntervalRef.current) {
      clearInterval(btIntervalRef.current);
      btIntervalRef.current = null;
    }
    if (btDeviceRef.current && btDeviceRef.current.gatt?.connected) {
      btDeviceRef.current.gatt.disconnect();
    }
    btDeviceRef.current = null;
    setBtDevice(null);
    setIsBtConnected(false);
    setIsVirtualBt(false);
    setBtError('');
  };

  const startCameraScan = async () => {
    setScanError('');
    setScanSuccess('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      activeStreamRef.current = stream;
      setIsScanning(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 150);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setScanError('Failed to access camera. Please check your browser/iframe permissions.');
    }
  };

  const stopCameraScan = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => track.stop());
      activeStreamRef.current = null;
    }
    setIsScanning(false);
  };

  const captureAndUpload = async () => {
    if (!videoRef.current) return;
    setIsUploading(true);
    setScanStatus('Capturing high-contrast display snapshot...');
    
    try {
      const video = videoRef.current;
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 480;
      
      const maxDim = 1024;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas context');
      
      ctx.drawImage(video, 0, 0, width, height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.85);
      
      stopCameraScan();
      await sendImageToGeminiOCR(base64Image);
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || 'Failed to capture frame.');
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setScanError('');
    setScanSuccess('');
    setIsUploading(true);
    setScanStatus('Reading image file...');
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const rawBase64 = reader.result as string;
        setScanStatus('Compressing and scaling image...');
        const compressedBase64 = await resizeImageBase64(rawBase64, 1024);
        await sendImageToGeminiOCR(compressedBase64);
      } catch (err: any) {
        console.error('File compression/upload error:', err);
        setScanError(err.message || 'Failed to process and upload image.');
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setScanError('Failed to read file from disk.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const sendImageToGeminiOCR = async (base64Image: string) => {
    setScanStatus('Gemini is reading scale digits...');
    try {
      const res = await fetch('/api/scan-weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
      
      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error('Server returned an invalid non-JSON response. Please ensure the backend server has started successfully.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Server failed to read scale digits');
      }
      if (data.weight !== null && data.weight !== undefined) {
        const extractedVal = parseInt(data.weight);
        handleWeightChange(extractedVal);
        setScanSuccess(`AI Scale Vision Read: ${extractedVal} KG (${data.reasoning || 'Extracted successfully'})`);
        
        setTimeout(() => {
          setScanSuccess('');
        }, 8000);
      } else {
        setScanError(`Gemini could not identify scale digits: ${data.reasoning || 'No readable numbers visible.'}`);
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      setScanError(err.message || 'Gemini OCR analysis failed. Please ensure display numbers are clear and try again.');
    } finally {
      setIsUploading(false);
      setScanStatus('');
    }
  };

  const startVehicleCameraScan = async () => {
    setVehicleScanError('');
    setVehicleScanSuccess('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      vehicleActiveStreamRef.current = stream;
      setIsVehicleScanning(true);
      setTimeout(() => {
        if (vehicleVideoRef.current) {
          vehicleVideoRef.current.srcObject = stream;
        }
      }, 150);
    } catch (err: any) {
      console.error('Vehicle Camera access error:', err);
      setVehicleScanError('Failed to access camera. Please check your browser/iframe permissions.');
    }
  };

  const stopVehicleCameraScan = () => {
    if (vehicleActiveStreamRef.current) {
      vehicleActiveStreamRef.current.getTracks().forEach(track => track.stop());
      vehicleActiveStreamRef.current = null;
    }
    setIsVehicleScanning(false);
  };

  const captureVehicleAndUpload = async () => {
    if (!vehicleVideoRef.current) return;
    setIsVehicleUploading(true);
    setVehicleScanStatus('Capturing high-contrast license plate snapshot...');
    
    try {
      const video = vehicleVideoRef.current;
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 480;
      
      const maxDim = 1024;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas context');
      
      ctx.drawImage(video, 0, 0, width, height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.85);
      
      stopVehicleCameraScan();
      await sendImageToGeminiVehicleOCR(base64Image);
    } catch (err: any) {
      console.error(err);
      setVehicleScanError(err.message || 'Failed to capture frame.');
      setIsVehicleUploading(false);
    }
  };

  const handleVehicleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setVehicleScanError('');
    setVehicleScanSuccess('');
    setIsVehicleUploading(true);
    setVehicleScanStatus('Reading image file...');
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const rawBase64 = reader.result as string;
        setVehicleScanStatus('Compressing and scaling image...');
        const compressedBase64 = await resizeImageBase64(rawBase64, 1024);
        await sendImageToGeminiVehicleOCR(compressedBase64);
      } catch (err: any) {
        console.error('Vehicle file compression/upload error:', err);
        setVehicleScanError(err.message || 'Failed to process and upload image.');
        setIsVehicleUploading(false);
      }
    };
    reader.onerror = () => {
      setVehicleScanError('Failed to read file from disk.');
      setIsVehicleUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const sendImageToGeminiVehicleOCR = async (base64Image: string) => {
    setVehicleScanStatus('Gemini is identifying the vehicle number plate...');
    try {
      const res = await fetch('/api/scan-vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
      
      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error('Server returned an invalid non-JSON response. Please ensure the backend server has started successfully.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Server failed to identify vehicle plate');
      }
      if (data.vehicleNumber !== null && data.vehicleNumber !== undefined) {
        const extractedVal = String(data.vehicleNumber).trim().toUpperCase();
        setVehicle(extractedVal);
        setVehicleScanSuccess(`AI License Plate Read: "${extractedVal}" (${data.reasoning || 'Extracted successfully'})`);
        
        setTimeout(() => {
          setVehicleScanSuccess('');
        }, 8000);
      } else {
        setVehicleScanError(`Gemini could not identify any vehicle or license plate numbers: ${data.reasoning || 'No readable alphanumeric values visible.'}`);
      }
    } catch (err: any) {
      console.error('Vehicle OCR Error:', err);
      setVehicleScanError(err.message || 'Gemini OCR analysis failed. Please ensure the plate/marking is clear and try again.');
    } finally {
      setIsVehicleUploading(false);
      setVehicleScanStatus('');
    }
  };

  const startMaterialCameraScan = async () => {
    setMaterialScanError('');
    setMaterialScanSuccess('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      materialActiveStreamRef.current = stream;
      setIsMaterialScanning(true);
      setTimeout(() => {
        if (materialVideoRef.current) {
          materialVideoRef.current.srcObject = stream;
        }
      }, 150);
    } catch (err: any) {
      console.error('Material Camera access error:', err);
      setMaterialScanError('Failed to access camera. Please check your browser/iframe permissions.');
    }
  };

  const stopMaterialCameraScan = () => {
    if (materialActiveStreamRef.current) {
      materialActiveStreamRef.current.getTracks().forEach(track => track.stop());
      materialActiveStreamRef.current = null;
    }
    setIsMaterialScanning(false);
  };

  const captureMaterialAndUpload = async () => {
    if (!materialVideoRef.current) return;
    setIsMaterialUploading(true);
    setMaterialScanStatus('Capturing snapshot of material...');
    
    try {
      const video = materialVideoRef.current;
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 480;
      
      const maxDim = 1024;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas context');
      
      ctx.drawImage(video, 0, 0, width, height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.85);
      
      stopMaterialCameraScan();
      await sendImageToGeminiMaterialOCR(base64Image);
    } catch (err: any) {
      console.error(err);
      setMaterialScanError(err.message || 'Failed to capture frame.');
      setIsMaterialUploading(false);
    }
  };

  const handleMaterialFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setMaterialScanError('');
    setMaterialScanSuccess('');
    setIsMaterialUploading(true);
    setMaterialScanStatus('Reading image file...');
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const rawBase64 = reader.result as string;
        setMaterialScanStatus('Compressing and scaling image...');
        const compressedBase64 = await resizeImageBase64(rawBase64, 1024);
        await sendImageToGeminiMaterialOCR(compressedBase64);
      } catch (err: any) {
        console.error('Material file compression/upload error:', err);
        setMaterialScanError(err.message || 'Failed to process and upload image.');
        setIsMaterialUploading(false);
      }
    };
    reader.onerror = () => {
      setMaterialScanError('Failed to read file from disk.');
      setIsMaterialUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const sendImageToGeminiMaterialOCR = async (base64Image: string) => {
    setMaterialScanStatus('Gemini is analyzing the material cargo in image...');
    try {
      const res = await fetch('/api/scan-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
      
      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error('Server returned an invalid non-JSON response. Please ensure the backend server has started successfully.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Server failed to analyze material');
      }
      if (data.materialName) {
        const extractedVal = String(data.materialName).trim();
        setMaterial(extractedVal);
        setMaterialScanSuccess(`AI Material Identified: "${extractedVal}" (${data.confidence || 'Detected successfully'})`);
        
        setTimeout(() => {
          setMaterialScanSuccess('');
        }, 8000);
      } else {
        setMaterialScanError(`Gemini could not identify any material in image: ${data.reasoning || 'No recognizable industrial raw material spotted.'}`);
      }
    } catch (err: any) {
      console.error('Material Identification Error:', err);
      setMaterialScanError(err.message || 'Gemini analysis failed. Please ensure the material photo is clear and try again.');
    } finally {
      setIsMaterialUploading(false);
      setMaterialScanStatus('');
    }
  };

  // Trigger regeneration on any input state change
  useEffect(() => {
    generateWeighedReceipt();
  }, [companyName, address1, address2, phone, ticketNo, date, time, weight, vehicle, material, operator, paperWidthMm]);

  const generateWeighedReceipt = () => {
    const charsPerLine = paperWidthMm === 58 ? 32 : 48;
    const doubleWidth = paperWidthMm === 58 ? 16 : 24;

    const formatLeftRight = (left: string, right: string, width: number) => {
      const spaces = width - left.length - right.length;
      return left + (spaces > 0 ? ' '.repeat(spaces) : ' ') + right;
    };

    // Construct lines
    const ticketBlockText = [
      formatLeftRight('TICKET NO:', ticketNo, charsPerLine),
      formatLeftRight('DATE:', date, charsPerLine),
      formatLeftRight('TIME:', time, charsPerLine)
    ].join('\n');

    const weightTextVal = `${Math.round(weight)} KG`;
    const weightBlockText = formatLeftRight('WEIGHT:', weightTextVal, doubleWidth);

    const metaBlockText = [
      'VEHICLE:'.padEnd(10, ' ') + vehicle,
      'MATERIAL:'.padEnd(10, ' ') + material,
      'OPERATOR:'.padEnd(10, ' ') + operator
    ].join('\n');

    const signatureLine1 = paperWidthMm === 58
      ? '____________        ____________'
      : '__________________            __________________';
    
    const signatureLine2 = paperWidthMm === 58
      ? '  OPERATOR            DRIVER   '
      : '     OPERATOR                  DRIVER     ';

    const updatedSections: ReceiptSection[] = [
      {
        id: 'sec-comp-title',
        type: 'text',
        enabled: true,
        content: {
          text: companyName,
          align: 'center',
          bold: true
        } as TextSection
      },
      {
        id: 'sec-comp-subtitle',
        type: 'text',
        enabled: true,
        content: {
          text: `${address1}\n${address2}\nPH: ${phone}`,
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
          text: ticketBlockText,
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
          text: weightBlockText,
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
          text: metaBlockText,
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
          text: `${signatureLine1}\n${signatureLine2}`,
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

    onUpdateSections(updatedSections);
  };

  const handleWeightChange = (val: number) => {
    if (isNaN(val)) return;
    setWeight(Math.max(0, val));
  };

  const handleRandomizeTicket = () => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    setTicketNo(`WS-${rand}`);
  };

  const handleSetCurrentTime = () => {
    setDate(getFormattedDate());
    setTime(getFormattedTime());
  };

  const loadPreset = (presetName: string) => {
    if (presetName === 'mg') {
      setCompanyName('M.G. INDUSTRIES');
      setAddress1('Vinoba Bhave Ward, Panagar');
      setAddress2('Jabalpur (M.P.) India 483220');
      setPhone('+91 9752556113');
      setVehicle('');
      setMaterial('');
      setOperator('ADMIN');
    } else if (presetName === 'galaxy') {
      setCompanyName('GALAXY LOGISTICS HUB');
      setAddress1('Platform 9, Orion Arm Terminal');
      setAddress2('Andromeda Sector 4, Solar Core');
      setPhone('+01 8894-COSMOS');
      setVehicle('VESSEL-77B');
      setMaterial('Star Core Alloys');
      setOperator('COSMO-BOT-9');
    }
  };

  return (
    <div className="space-y-6" id="receipt-editor-root">
      
      {/* 2. LIVE SCALE AND WEIGHT DIALS */}
      <div className="bg-[#0D1322] rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5">
        
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Weight size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Live Weigh Scale Terminal</h3>
              <p className="text-[10px] text-slate-400">Manage scale power, zero/tare calibration, and adjust weight</p>
            </div>
          </div>
        </div>

        {/* Industrial Scale Hardware Shell - Vermillion/Orange Red */}
        <div className="max-w-md mx-auto w-full bg-gradient-to-br from-red-600 via-red-500 to-red-800 p-4 rounded-3xl border-4 border-red-950 shadow-2xl relative overflow-hidden">
          
          {/* Subtle industrial texture and metallic brackets */}
          <div className="absolute top-0 inset-x-0 h-1 bg-red-400/30" />
          
          {/* Simulated hardware rivets/screws at corners */}
          <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-stone-400 border border-stone-600 shadow-sm flex items-center justify-center"><div className="w-0.5 h-0.5 bg-stone-700 rounded-full" /></div>
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-stone-400 border border-stone-600 shadow-sm flex items-center justify-center"><div className="w-0.5 h-0.5 bg-stone-700 rounded-full" /></div>
          <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-stone-400 border border-stone-600 shadow-sm flex items-center justify-center"><div className="w-0.5 h-0.5 bg-stone-700 rounded-full" /></div>
          <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-stone-400 border border-stone-600 shadow-sm flex items-center justify-center"><div className="w-0.5 h-0.5 bg-stone-700 rounded-full" /></div>
          
          {/* Faceplate (Black Textured Area) */}
          <div className="bg-[#0f0f12] p-4 rounded-2xl border border-neutral-950 shadow-inner space-y-3">
            
            {/* Header: Brand and Screws */}
            <div className="flex items-center justify-between px-2">
              {/* Little screw left */}
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              
              {/* Phoenix Logo */}
              <div className="flex flex-col items-center">
                <span className="text-sky-400 font-extrabold tracking-widest text-[13px] font-sans italic drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  PHOENIX
                </span>
                <div className="h-[1.5px] w-14 bg-sky-400 mt-0.5" />
              </div>
              
              {/* Little screw right */}
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            </div>

            {/* Scale main panel with screen and keypad column */}
            <div className="grid grid-cols-12 gap-3 items-stretch">
              
              {/* Glowing Red Segment Screen - 9 cols */}
              <div className="col-span-9 bg-[#040405] rounded-xl border-2 border-stone-900 p-4 relative flex flex-col justify-between min-h-[120px] shadow-[inset_0_4px_12px_rgba(0,0,0,0.95)] overflow-hidden">
                {/* Subtle digital filter grid lines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[size:100%_4px] pointer-events-none opacity-30" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.06)_0%,transparent_85%)] pointer-events-none" />
                
                {/* Status/Stable indication */}
                <div className="text-[7.5px] uppercase tracking-wider text-red-900 font-bold flex justify-between">
                  <span className={isPowerOn && isBtConnected ? "text-emerald-500 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse" : ""}>
                    {isPowerOn ? (isBtConnected ? "● BLE LIVE" : "● STANDBY") : ""}
                  </span>
                  <span>{isPowerOn ? "NET" : ""}</span>
                </div>

                {/* Big segment digits */}
                <div className="flex items-baseline justify-end h-full mt-2 relative">
                  {isPowerOn ? (
                    <div className="flex items-baseline space-x-1 font-mono font-bold">
                      <span className="text-5xl tracking-widest text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.9)] select-none tabular-nums animate-pulse">
                        {Math.round(weight)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-red-950/20 text-5xl font-mono tracking-widest select-none">
                      8888
                    </span>
                  )}
                </div>

                {/* Capacity Label */}
                <div className="text-[8px] text-zinc-500 font-semibold tracking-wider uppercase text-left mt-2">
                  Cap.. 10000kg
                </div>
              </div>

              {/* Membrane Buttons Column - 3 cols */}
              <div className="col-span-3 flex flex-col justify-between space-y-2 bg-[#0c0c0e] p-1.5 rounded-xl border border-neutral-800">
                
                {/* Power button */}
                <button
                  type="button"
                  onClick={() => setIsPowerOn(!isPowerOn)}
                  className={`flex flex-col items-center justify-center py-1.5 rounded border transition-all ${
                    isPowerOn 
                      ? 'border-red-900 bg-gradient-to-b from-neutral-800 to-neutral-900 text-red-400 hover:text-red-300' 
                      : 'border-emerald-950 bg-gradient-to-b from-neutral-800 to-neutral-900 text-emerald-400 hover:text-emerald-300'
                  } shadow-md active:scale-95 cursor-pointer`}
                  title="Toggle Display Power"
                >
                  <Power size={11} className="stroke-[3px]" />
                  <span className="text-[6px] font-bold uppercase mt-0.5 tracking-tight">POWER</span>
                </button>

                {/* Tare button */}
                <button
                  type="button"
                  onClick={() => isPowerOn && handleWeightChange(0)}
                  disabled={!isPowerOn}
                  className={`flex flex-col items-center justify-center py-1 rounded border border-neutral-700 bg-gradient-to-b from-neutral-800 to-neutral-900 text-neutral-300 hover:text-white shadow-md active:scale-95 ${
                    !isPowerOn ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  title="Zero/Tare Scale"
                >
                  <span className="text-[10px] font-bold tracking-tighter leading-none">→T←</span>
                  <span className="text-[6px] font-bold uppercase mt-0.5 tracking-tight">TARE</span>
                </button>

                {/* Zero button */}
                <button
                  type="button"
                  onClick={() => isPowerOn && handleWeightChange(0)}
                  disabled={!isPowerOn}
                  className={`flex flex-col items-center justify-center py-1 rounded border border-neutral-700 bg-gradient-to-b from-neutral-800 to-neutral-900 text-neutral-300 hover:text-white shadow-md active:scale-95 ${
                    !isPowerOn ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  title="Zero/Tare Scale"
                >
                  <span className="text-[10px] font-bold tracking-tighter leading-none">→0←</span>
                  <span className="text-[6px] font-bold uppercase mt-0.5 tracking-tight">ZERO</span>
                </button>

              </div>

            </div>

            {/* Lower panel line and screws */}
            <div className="flex items-center justify-between px-6 pt-1">
              <div className="w-1 h-1 rounded-full bg-zinc-600" />
              <div className="text-[6.5px] text-zinc-600 font-mono tracking-widest uppercase">
                Model: ODS-K
              </div>
              <div className="w-1 h-1 rounded-full bg-zinc-600" />
            </div>

          </div>
        </div>

        {/* Weight input */}
        <div className="pt-2 space-y-4">
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Set Scale Weight</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="99999"
                value={weight === 0 ? '' : weight}
                onChange={(e) => handleWeightChange(parseInt(e.target.value) || 0)}
                placeholder="0"
                disabled={!isPowerOn}
                className="w-full bg-[#070A11] border border-slate-800 rounded-xl py-2.5 px-3 pl-9 pr-12 text-sm font-bold text-amber-400 placeholder-amber-500/30 focus:outline-none focus:border-amber-400 font-mono transition-all disabled:opacity-40"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500/40 pointer-events-none">
                <Weight size={14} />
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none font-mono">
                KG
              </div>
            </div>
          </div>

          {/* AI scale vision scan or upload */}
          <div className="pt-3 border-t border-slate-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Display OCR Scanner</span>
              <span className="text-[9px] text-amber-500/80 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center space-x-1">
                <Sparkles size={10} className="animate-pulse text-amber-400" />
                <span>GEMINI 3.5 VISION</span>
              </span>
            </div>

            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Buttons Row */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!isPowerOn || isUploading || isScanning}
                onClick={startCameraScan}
                className="flex items-center justify-center space-x-2 py-2 px-3 bg-[#0a0f1d] border border-slate-800/80 hover:border-amber-500/30 text-slate-300 hover:text-white rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Camera size={13} className="text-amber-500" />
                <span>Scan with Camera</span>
              </button>

              <button
                type="button"
                disabled={!isPowerOn || isUploading || isScanning}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center space-x-2 py-2 px-3 bg-[#0a0f1d] border border-slate-800/80 hover:border-amber-500/30 text-slate-300 hover:text-white rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Upload size={13} className="text-amber-500" />
                <span>Upload Scale Photo</span>
              </button>
            </div>

            {/* Live Camera Scanner Feed View */}
            {isScanning && (
              <div className="relative bg-black rounded-xl border-2 border-slate-800 overflow-hidden shadow-2xl flex flex-col items-center">
                {/* Simulated Scanning Laser Overlay */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent top-1/4 animate-bounce z-10 shadow-[0_0_10px_rgba(245,158,11,1)]" />
                
                {/* Framing border corners */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-amber-500 pointer-events-none z-10" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-amber-500 pointer-events-none z-10" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-amber-500 pointer-events-none z-10" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-amber-500 pointer-events-none z-10" />

                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-auto max-h-[220px] object-cover scale-x-[-1]"
                />

                <div className="absolute inset-0 bg-black/20 flex flex-col justify-end p-3 space-y-2 bg-gradient-to-t from-black/80 via-black/10 to-transparent">
                  <p className="text-[10px] text-amber-400 font-bold text-center tracking-wider bg-black/60 py-1 px-2 rounded-lg self-center backdrop-blur-sm">
                    Point camera at glowing digits of the weighing display
                  </p>
                  <div className="flex justify-center space-x-2">
                    <button
                      type="button"
                      onClick={captureAndUpload}
                      className="flex items-center space-x-1 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs tracking-wider transition-all cursor-pointer shadow-lg active:scale-95"
                    >
                      <Sparkles size={11} />
                      <span>CAP & EXTRACT</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCameraScan}
                      className="flex items-center space-x-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs tracking-wider transition-all cursor-pointer active:scale-95"
                    >
                      <X size={11} />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Uploading Status */}
            {isUploading && (
              <div className="bg-[#09152b] rounded-xl border border-blue-900/40 p-4 flex items-center space-x-3.5 animate-pulse shadow-md">
                <Loader2 size={18} className="animate-spin text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-200">{scanStatus}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Gemini 3.5 model is locating numerical LED/LCD grids...</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {scanError && (
              <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 flex items-start space-x-2.5">
                <X size={15} className="text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-200">Vision Recognition Error</p>
                  <p className="text-[10px] text-red-300/80 mt-0.5 leading-relaxed">{scanError}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {scanSuccess && (
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3 flex items-start space-x-2.5 shadow-sm">
                <Sparkles size={15} className="text-emerald-400 mt-0.5 shrink-0 animate-pulse" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-emerald-200">Scale Digit Extraction Success</p>
                  <p className="text-[10px] text-emerald-300/80 mt-0.5 leading-relaxed">{scanSuccess}</p>
                </div>
              </div>
            )}
          </div>

          {/* Bluetooth Live Weight Feeding Section */}
          <div className="pt-3 border-t border-slate-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Bluetooth Weight Feeding</span>
              <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border flex items-center space-x-1 transition-all ${
                isBtConnected 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : isBtConnecting 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
              }`}>
                {isBtConnecting ? (
                  <>
                    <Loader2 size={10} className="animate-spin text-amber-400" />
                    <span>CONNECTING</span>
                  </>
                ) : isBtConnected ? (
                  <>
                    <Activity size={10} className="animate-pulse text-emerald-400" />
                    <span>BLE LIVE</span>
                  </>
                ) : (
                  <>
                    <Bluetooth size={10} />
                    <span>DISCONNECTED</span>
                  </>
                )}
              </span>
            </div>

            {/* If connected, display the live status and feed rate */}
            {isBtConnected && (
              <div className="bg-[#040812] border border-slate-800/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Radio size={14} className="text-emerald-400 animate-pulse shrink-0" />
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[160px]">{btDevice?.name || 'Scale BLE'}</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 uppercase">1.0Hz Data Rate</span>
                </div>

                {/* Telemetry Indicator Sparkle / Feed Line */}
                <div className="flex items-center justify-between bg-[#070d1d] px-2.5 py-1.5 rounded-lg border border-slate-950">
                  <div className="flex items-center space-x-1.5">
                    <Activity size={11} className="text-emerald-500 animate-pulse shrink-0" />
                    <span className="text-[10px] font-medium text-slate-400">Current Live Weight:</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">{weight} KG</span>
                </div>

                {/* Sim controls if connected to the virtual simulation */}
                {isVirtualBt && (
                  <div className="pt-1.5 space-y-1.5 border-t border-slate-800/40">
                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Simulate Placement Payload</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleWeightChange(180)}
                        className="text-[9px] py-1 bg-[#090f1e] border border-slate-800 rounded text-slate-300 hover:text-white font-mono hover:border-amber-500/30 cursor-pointer active:scale-95"
                      >
                        +180 KG
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWeightChange(3520)}
                        className="text-[9px] py-1 bg-[#090f1e] border border-slate-800 rounded text-slate-300 hover:text-white font-mono hover:border-amber-500/30 cursor-pointer active:scale-95"
                      >
                        +3.5 Ton
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWeightChange(0)}
                        className="text-[9px] py-1 bg-red-950/20 border border-red-900/20 rounded text-red-400 hover:text-red-300 font-mono cursor-pointer active:scale-95"
                      >
                        Zero
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={disconnectBluetooth}
                  className="w-full mt-1.5 py-1.5 text-center text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-900/30 rounded-xl transition-all cursor-pointer"
                >
                  Disconnect Bluetooth Feed
                </button>
              </div>
            )}

            {/* Error messaging for bluetooth */}
            {btError && (
              <div className="bg-red-950/10 border border-red-900/20 rounded-xl p-3 flex items-start space-x-2.5">
                <X size={14} className="text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-red-200">Bluetooth Sync Failed</p>
                  <p className="text-[10px] text-red-300/80 mt-0.5 leading-relaxed">{btError}</p>
                </div>
              </div>
            )}

            {/* If not connected, show the Scan buttons */}
            {!isBtConnected && !isBtConnecting && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!isPowerOn}
                  onClick={connectRealBluetooth}
                  className="flex items-center justify-center space-x-2 py-2 px-3 bg-[#0a0f1d] border border-slate-800/80 hover:border-emerald-500/30 text-slate-300 hover:text-white rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Connect to a physical BLE Weighing Scale (Standard 0x181D Profile)"
                >
                  <Bluetooth size={13} className="text-emerald-500" />
                  <span>Connect BLE Scale</span>
                </button>

                <button
                  type="button"
                  disabled={!isPowerOn}
                  onClick={connectVirtualBluetooth}
                  className="flex items-center justify-center space-x-2 py-2 px-3 bg-[#0a0f1d] border border-slate-800/80 hover:border-emerald-500/30 text-slate-300 hover:text-white rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Test using a high-fidelity virtual live weight feed"
                >
                  <Activity size={13} className="text-emerald-500" />
                  <span>Virtual BLE Simulator</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 3. EDITABLE DETAILS PANEL */}
      <div className="bg-[#0D1322] rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
        
        {/* Company info section */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-amber-500/70 uppercase tracking-widest flex items-center space-x-1.5 border-b border-slate-800/80 pb-2">
            <Building size={12} />
            <span>Weighing Slip Header Config</span>
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Company Title</label>
              <input 
                type="text" 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-[#070A11] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number</label>
              <input 
                type="text" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#070A11] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Address Line 1</label>
              <input 
                type="text" 
                value={address1} 
                onChange={(e) => setAddress1(e.target.value)}
                className="w-full bg-[#070A11] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Address Line 2</label>
              <input 
                type="text" 
                value={address2} 
                onChange={(e) => setAddress2(e.target.value)}
                className="w-full bg-[#070A11] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Ticket Details */}
        <div className="space-y-4 pt-2">
          <h4 className="text-[10px] font-bold text-amber-500/70 uppercase tracking-widest flex items-center space-x-1.5 border-b border-slate-800/80 pb-2">
            <Tag size={12} />
            <span>Ticket Details &amp; Meta Fields</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block flex justify-between items-center">
                <span>Ticket No</span>
                <button type="button" onClick={handleRandomizeTicket} className="text-[8px] text-amber-400 hover:underline flex items-center space-x-0.5">
                  <RefreshCw size={8} /> <span>Random</span>
                </button>
              </label>
              <input 
                type="text" 
                value={ticketNo} 
                onChange={(e) => setTicketNo(e.target.value)}
                className="w-full bg-[#070A11] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl py-2 px-3 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block flex justify-between items-center">
                <span>Date</span>
                <button type="button" onClick={handleSetCurrentTime} className="text-[8px] text-amber-400 hover:underline">Now</button>
              </label>
              <input 
                type="text" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#070A11] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Time</label>
              <input 
                type="text" 
                value={time} 
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-[#070A11] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-2 col-span-1 md:col-span-3 border border-slate-800/40 p-4 rounded-xl bg-[#080d1a]/50">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Vehicle No</label>
                <div className="flex items-center space-x-2">
                  <span className="text-[8px] text-amber-500/80 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center space-x-0.5">
                    <Sparkles size={8} />
                    <span>Plate OCR</span>
                  </span>
                  
                  <button
                    type="button"
                    disabled={isVehicleScanning || isVehicleUploading}
                    onClick={startVehicleCameraScan}
                    className="text-[9px] px-2 py-0.5 bg-[#0e172a] border border-slate-800 hover:border-amber-500/30 text-amber-400 hover:text-white rounded flex items-center space-x-1 cursor-pointer transition-all active:scale-95 disabled:opacity-35"
                    title="Scan Vehicle Plate via Camera"
                  >
                    <Camera size={9} />
                    <span>Scan</span>
                  </button>

                  <button
                    type="button"
                    disabled={isVehicleScanning || isVehicleUploading}
                    onClick={() => vehicleFileInputRef.current?.click()}
                    className="text-[9px] px-2 py-0.5 bg-[#0e172a] border border-slate-800 hover:border-amber-500/30 text-amber-400 hover:text-white rounded flex items-center space-x-1 cursor-pointer transition-all active:scale-95 disabled:opacity-35"
                    title="Upload Vehicle Plate Image"
                  >
                    <Upload size={9} />
                    <span>Upload</span>
                  </button>
                </div>
              </div>

              {/* Hidden File Input for Vehicle Plate */}
              <input 
                type="file" 
                ref={vehicleFileInputRef}
                onChange={handleVehicleFileUpload}
                accept="image/*"
                className="hidden"
              />

              <input 
                type="text" 
                value={vehicle} 
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="e.g. MH-12-PQ-4567 or FLEET ID"
                className="w-full bg-[#070A11] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all uppercase font-mono"
              />

              {/* Live Vehicle Scanner Camera Feed View */}
              {isVehicleScanning && (
                <div className="relative bg-black rounded-xl border-2 border-slate-800 overflow-hidden shadow-2xl flex flex-col items-center mt-2">
                  {/* Laser Scanning Line */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent top-1/2 -translate-y-1/2 animate-bounce z-10 shadow-[0_0_10px_rgba(245,158,11,1)]" />
                  
                  {/* Framing Brackets */}
                  <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-amber-500 pointer-events-none z-10" />
                  <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-amber-500 pointer-events-none z-10" />
                  <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-amber-500 pointer-events-none z-10" />
                  <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-amber-500 pointer-events-none z-10" />

                  <video 
                    ref={vehicleVideoRef}
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-auto max-h-[160px] object-cover"
                  />

                  <div className="absolute inset-0 bg-black/30 flex flex-col justify-end p-2 space-y-1.5 bg-gradient-to-t from-black/85 via-black/10 to-transparent">
                    <p className="text-[9px] text-amber-400 font-bold text-center tracking-wide bg-black/70 py-1 px-1.5 rounded self-center backdrop-blur-sm">
                      Align License Plate or Vehicle marking in the grid
                    </p>
                    <div className="flex justify-center space-x-1.5">
                      <button
                        type="button"
                        onClick={captureVehicleAndUpload}
                        className="flex items-center space-x-1 py-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] tracking-wide transition-all cursor-pointer shadow-lg active:scale-95"
                      >
                        <Sparkles size={10} />
                        <span>CAP & EXTRACT</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopVehicleCameraScan}
                        className="flex items-center space-x-1 py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded text-[10px] tracking-wide transition-all cursor-pointer active:scale-95"
                      >
                        <X size={10} />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Uploading Status */}
              {isVehicleUploading && (
                <div className="bg-[#09152b] rounded-xl border border-blue-900/40 p-3 flex items-center space-x-3.5 animate-pulse shadow-md mt-2">
                  <Loader2 size={16} className="animate-spin text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-200">{vehicleScanStatus}</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Gemini is segmenting characters from plate markings...</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {vehicleScanError && (
                <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-2.5 flex items-start space-x-2 mt-2">
                  <X size={13} className="text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-red-200">Vision Recognition Error</p>
                    <p className="text-[9px] text-red-300/80 mt-0.5 leading-relaxed">{vehicleScanError}</p>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {vehicleScanSuccess && (
                <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-2.5 flex items-start space-x-2 shadow-sm mt-2">
                  <Sparkles size={13} className="text-emerald-400 mt-0.5 shrink-0 animate-pulse" />
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-emerald-200">Vehicle Scan Success</p>
                    <p className="text-[9px] text-emerald-300/80 mt-0.5 leading-relaxed">{vehicleScanSuccess}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 col-span-1 md:col-span-3 border border-slate-800/40 p-4 rounded-xl bg-[#080d1a]/50">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Material Type</label>
                <div className="flex items-center space-x-2">
                  <span className="text-[8px] text-amber-500/80 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center space-x-0.5">
                    <Sparkles size={8} />
                    <span>Material AI</span>
                  </span>
                  
                  <button
                    type="button"
                    disabled={isMaterialScanning || isMaterialUploading}
                    onClick={startMaterialCameraScan}
                    className="text-[9px] px-2 py-0.5 bg-[#0e172a] border border-slate-800 hover:border-amber-500/30 text-amber-400 hover:text-white rounded flex items-center space-x-1 cursor-pointer transition-all active:scale-95 disabled:opacity-35"
                    title="Scan Material Cargo via Camera"
                  >
                    <Camera size={9} />
                    <span>Scan</span>
                  </button>

                  <button
                    type="button"
                    disabled={isMaterialScanning || isMaterialUploading}
                    onClick={() => materialFileInputRef.current?.click()}
                    className="text-[9px] px-2 py-0.5 bg-[#0e172a] border border-slate-800 hover:border-amber-500/30 text-amber-400 hover:text-white rounded flex items-center space-x-1 cursor-pointer transition-all active:scale-95 disabled:opacity-35"
                    title="Upload Material Cargo Image"
                  >
                    <Upload size={9} />
                    <span>Upload</span>
                  </button>
                </div>
              </div>

              {/* Hidden File Input for Material */}
              <input 
                type="file" 
                ref={materialFileInputRef}
                onChange={handleMaterialFileUpload}
                accept="image/*"
                className="hidden"
              />

              <input 
                type="text" 
                value={material} 
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="e.g. Coal, Sand, Gravel, Cement, Wood"
                className="w-full bg-[#070A11] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              />

              {/* Live Material Scanner Camera Feed View */}
              {isMaterialScanning && (
                <div className="relative bg-black rounded-xl border-2 border-slate-800 overflow-hidden shadow-2xl flex flex-col items-center mt-2">
                  {/* Laser Scanning Line */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent top-1/2 -translate-y-1/2 animate-bounce z-10 shadow-[0_0_10px_rgba(245,158,11,1)]" />
                  
                  {/* Framing Brackets */}
                  <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-amber-500 pointer-events-none z-10" />
                  <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-amber-500 pointer-events-none z-10" />
                  <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-amber-500 pointer-events-none z-10" />
                  <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-amber-500 pointer-events-none z-10" />

                  <video 
                    ref={materialVideoRef}
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-auto max-h-[160px] object-cover"
                  />

                  <div className="absolute inset-0 bg-black/30 flex flex-col justify-end p-2 space-y-1.5 bg-gradient-to-t from-black/85 via-black/10 to-transparent">
                    <p className="text-[9px] text-amber-400 font-bold text-center tracking-wide bg-black/70 py-1 px-1.5 rounded self-center backdrop-blur-sm">
                      Align the material cargo/heap in the grid
                    </p>
                    <div className="flex justify-center space-x-1.5">
                      <button
                        type="button"
                        onClick={captureMaterialAndUpload}
                        className="flex items-center space-x-1 py-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] tracking-wide transition-all cursor-pointer shadow-lg active:scale-95"
                      >
                        <Sparkles size={10} />
                        <span>ANALYZE & IDENTIFY</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopMaterialCameraScan}
                        className="flex items-center space-x-1 py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded text-[10px] tracking-wide transition-all cursor-pointer active:scale-95"
                      >
                        <X size={10} />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Uploading Status */}
              {isMaterialUploading && (
                <div className="bg-[#09152b] rounded-xl border border-blue-900/40 p-3 flex items-center space-x-3.5 animate-pulse shadow-md mt-2">
                  <Loader2 size={16} className="animate-spin text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-200">{materialScanStatus}</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Gemini is classification profiling the texture & features...</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {materialScanError && (
                <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-2.5 flex items-start space-x-2 mt-2">
                  <X size={13} className="text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-red-200">Vision Analysis Error</p>
                    <p className="text-[9px] text-red-300/80 mt-0.5 leading-relaxed">{materialScanError}</p>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {materialScanSuccess && (
                <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-2.5 flex items-start space-x-2 shadow-sm mt-2">
                  <Sparkles size={13} className="text-emerald-400 mt-0.5 shrink-0 animate-pulse" />
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-emerald-200">Material Analysis Success</p>
                    <p className="text-[9px] text-emerald-300/80 mt-0.5 leading-relaxed">{materialScanSuccess}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Operator Name</label>
              <input 
                type="text" 
                value={operator} 
                onChange={(e) => setOperator(e.target.value)}
                className="w-full bg-[#070A11] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Live Receipt Preview */}
      {previewNode}

      {/* 4. CORE PRINT ACTION */}
      <button
        onClick={onPrint}
        disabled={isPrinting}
        className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center space-x-2.5 tracking-wider uppercase shadow-xl hover:shadow-amber-500/10 active:scale-98 transition-all"
        id="btn-trigger-print"
      >
        <Printer size={15} className={isPrinting ? "animate-spin" : ""} />
        <span>
          {isPrinting ? 'Feeding Thermal Slip...' : 'Print Slip'}
        </span>
      </button>

    </div>
  );
}
