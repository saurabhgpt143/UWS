/**
 * Web Bluetooth Connector for ESC/POS Thermal Printers
 */

// Declaring Bluetooth interfaces for TypeScript compilation
type BluetoothDevice = any;
type BluetoothRemoteGATTServer = any;
type BluetoothRemoteGATTCharacteristic = any;

// Common generic serial/printer BLE services and characteristics
const BT_PRINTER_SERVICES = [
  '0000ffe0-0000-1000-8000-00805f9b34fb', // FFE0 - generic Chinese BLE clones (e.g. Goojprt, PT-210)
  '000018f0-0000-1000-8000-00805f9b34fb', // Generic POS Printer Service
  'e7e1a190-273d-11e6-bdf4-0800200c9a66', // some ESC/POS printer brands
];

const BT_PRINTER_CHARACTERISTICS = [
  '0000ffe1-0000-1000-8000-00805f9b34fb', // FFE1 - standard write characteristic
  '00002af1-0000-1000-8000-00805f9b34fb', // standard printer data write characteristic
  '000018f0-0000-1000-8000-00805f9b34fb',
];

export class BluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private isWriting: boolean = false;

  get isConnected(): boolean {
    return !!this.writeCharacteristic && !!this.device?.gatt?.connected;
  }

  get deviceName(): string {
    return this.device?.name || 'Unknown Printer';
  }

  /**
   * Scans and connects to a nearby Bluetooth printer
   */
  async connect(): Promise<string> {
    const nav = navigator as any;
    if (!nav.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser. Try Chrome, Edge, or Opera.');
    }

    try {
      console.log('Requesting Bluetooth device...');
      const device = await nav.bluetooth.requestDevice({
        filters: [
          { services: BT_PRINTER_SERVICES },
          { namePrefix: 'POS' },
          { namePrefix: 'MPT' },
          { namePrefix: 'Printer' },
          { namePrefix: 'GP-' },
          { namePrefix: 'MTP' },
          { namePrefix: 'QS' },
        ],
        optionalServices: [
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7e1a190-273d-11e6-bdf4-0800200c9a66',
        ],
      });

      this.device = device;
      console.log(`Found device: ${device.name}. Connecting to GATT Server...`);

      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Could not connect to GATT server.');
      }
      this.server = server;

      // Scan through common services and find a write characteristic
      let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

      const services = await server.getPrimaryServices();
      for (const service of services) {
        console.log(`Checking service UUID: ${service.uuid}`);
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          console.log(`Checking characteristic UUID: ${char.uuid}, properties:`, char.properties);
          // Check if we can write without response, or write
          if (char.properties.writeWithoutResponse || char.properties.write) {
            characteristic = char;
            break;
          }
        }
        if (characteristic) break;
      }

      if (!characteristic) {
        throw new Error('No write characteristic found on this device. Is it a compatible ESC/POS thermal printer?');
      }

      this.writeCharacteristic = characteristic;

      // Watch for disconnects
      device.addEventListener('gattserverdisconnected', () => {
        console.warn('Printer disconnected!');
        this.disconnect();
      });

      return device.name || 'BT Receipt Printer';
    } catch (err) {
      this.disconnect();
      console.error('Bluetooth connection failed:', err);
      throw err;
    }
  }

  /**
   * Disconnects the printer
   */
  disconnect() {
    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch (e) {
      // Ignored
    }
    this.device = null;
    this.server = null;
    this.writeCharacteristic = null;
    this.isWriting = false;
  }

  /**
   * Sends binary bytes to the printer in managed, chunked queues.
   * Thermal BLE printers have small input buffers, so sending too fast causes packet loss.
   */
  async print(bytes: Uint8Array, progressCallback?: (sent: number, total: number) => void): Promise<void> {
    if (!this.isConnected || !this.writeCharacteristic) {
      throw new Error('Printer is not connected.');
    }

    if (this.isWriting) {
      throw new Error('Another printing job is currently in progress.');
    }

    this.isWriting = true;

    try {
      // Small chunks are safest for BLE printers. 40-100 bytes is optimal.
      const CHUNK_SIZE = 64; 
      const DELAY_BETWEEN_CHUNKS_MS = 25; // 25ms delay to let the print motor and buffer catch up

      let offset = 0;
      const total = bytes.length;

      while (offset < total) {
        if (!this.isConnected) {
          throw new Error('Printer disconnected mid-job.');
        }

        const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
        
        // Write standard without response for speed, fallback to write if needed
        if (this.writeCharacteristic.properties.writeWithoutResponse) {
          await this.writeCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.writeCharacteristic.writeValueWithResponse(chunk);
        }

        offset += chunk.length;
        if (progressCallback) {
          progressCallback(offset, total);
        }

        // Slight wait
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_CHUNKS_MS));
      }
    } catch (err) {
      console.error('Failed sending print packet:', err);
      throw err;
    } finally {
      this.isWriting = false;
    }
  }
}

export const btPrinter = new BluetoothPrinter();
