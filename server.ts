import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Request logger to help debug any routing or content-type mismatch
import fs from 'fs';
const LOG_FILE = path.join(process.cwd(), 'server_debug.log');

// Clear log on startup
try {
  fs.writeFileSync(LOG_FILE, `--- Server started at ${new Date().toISOString()} ---\n`);
} catch (e) {
  console.error('Failed to clear log file', e);
}

function logDebug(message: string) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  console.log(message);
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {
    // ignore
  }
}

app.use((req, res, next) => {
  logDebug(`[Request] ${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}`);
  next();
});

// Endpoint to view logs
app.get('/api/debug-logs', (req, res) => {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      res.type('text/plain').send(content);
    } else {
      res.status(404).send('Log file not found');
    }
  } catch (err: any) {
    res.status(500).send(`Error reading logs: ${err.message}`);
  }
});

// Increase payload limit to 50mb to support high-resolution base64 images from camera uploads
app.use(express.json({ limit: '50mb' }));

// Initialise Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn('GEMINI_API_KEY environment variable is not defined. AI receipt generation will be limited.');
}

/**
 * API Endpoint: AI Receipt Generator
 * Uses gemini-3.5-flash and structured JSON outputs
 */
app.post('/api/generate-receipt', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  if (!ai) {
    // Return a styled mockup fallback if API key is not configured yet
    res.json(getFallbackMockupReceipt(prompt));
    return;
  }

  try {
    const systemPrompt = `You are a creative Receipt Printer Layout Assistant.
Your task is to take any user prompt and generate a hilarious, interesting, beautiful, or retro virtual receipt, ticket, sticker or journal log.
Interpret their request literally or creatively (e.g., if they ask for "speed ticket for Alice", generate an official-looking Space Patrol ticket with violation points).

Generate standard receipt details:
- Title (e.g., "COFFEE BOUTIQUE" or "ZOMBIE POST DISPATCH")
- Subtitle / Tagline
- Metadata rows (e.g., Date, Cashier Name, Ticket #, Ship Class, etc.)
- List of items with descriptive names, quantity, price, and total calculation
- Totals block (Subtotal, taxes/fees, custom discounts, Grand Total)
- Barcode value & format (usually CODE128)
- QR code value (URLs, custom messages, easter eggs)
- Footer text (e.g. "THANKS FOR SAVING THE WORLD!")
- Custom ASCII Art! Craft a retro 1-bit thermal style ASCII art matching the vibe. The ASCII art must fit within 28-32 character width! Use standard characters like * . = # + o - / \\ | ( ) but keep it simple, robust, and clean.

Strictly adhere to the provided JSON schema. Ensure price arithmetic matches (quantity * price = total, totals sum up).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Create a thermal printer receipt for: "${prompt}"`,
      config: {
        systemInstruction: systemPrompt,
        temperature: 1.0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['title', 'subtitle', 'metadata', 'items', 'totals', 'footerText'],
          properties: {
            title: { type: Type.STRING, description: 'Store, event, or corporate title in all-caps' },
            subtitle: { type: Type.STRING, description: 'Slogan, class, or sub-header description' },
            metadata: {
              type: Type.ARRAY,
              description: 'General parameters like Date, Time, Cashier, Docket #, or Class',
              items: {
                type: Type.OBJECT,
                required: ['label', 'value'],
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING },
                },
              },
            },
            items: {
              type: Type.ARRAY,
              description: 'Individual items listed in the receipt',
              items: {
                type: Type.OBJECT,
                required: ['name', 'qty', 'price', 'total'],
                properties: {
                  name: { type: Type.STRING, description: 'Item title, brief and retro-styled' },
                  qty: { type: Type.INTEGER },
                  price: { type: Type.NUMBER },
                  total: { type: Type.NUMBER, description: 'Equal to qty * price' },
                },
              },
            },
            totals: {
              type: Type.ARRAY,
              description: 'Totals breakdown like Subtotal, Tax, Galactic Fee, Total',
              items: {
                type: Type.OBJECT,
                required: ['label', 'value', 'isBold'],
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING },
                  isBold: { type: Type.BOOLEAN },
                },
              },
            },
            barcodeValue: { type: Type.STRING, description: 'Alpha-numeric text for CODE128 barcode' },
            qrcodeValue: { type: Type.STRING, description: 'Target URL or message for QR code' },
            footerText: { type: Type.STRING, description: 'Funny checkout comment or standard thank you' },
            asciiArt: { type: Type.STRING, description: 'A cute 1-bit ASCII art, max width 28 chars, 5-10 lines max' },
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from AI.');
    }

    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error('Error in AI receipt generation:', error);
    res.status(500).json({
      error: 'Failed to generate receipt content. FALLBACK MOCKUP RENDERED.',
      fallback: getFallbackMockupReceipt(prompt),
    });
  }
});

/**
 * API Endpoint: Scan Weight from Image
 * Uses gemini-3.5-flash to read weighing scale numerical display values from camera snaps or uploads
 */
app.post('/api/scan-weight', async (req, res) => {
  const { image } = req.body;

  if (!image) {
    res.status(400).json({ error: 'Image data is required' });
    return;
  }

  if (!ai) {
    res.status(503).json({ error: 'Gemini API is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.' });
    return;
  }

  try {
    // Parse base64 data URL
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let base64Data = image;

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        'Read and extract the current weight displayed in the image. Return a JSON object with the weight integer value.'
      ],
      config: {
        systemInstruction: `You are an expert OCR helper for industrial weighing terminal systems.
Analyze the image of a weighing scale display (which could be an LED, LCD, crane scale, or other display) and identify the main numeric digits of the current weight.
Ignore secondary labels like "Model ODS-K", "Cap.. 10000kg", or unrelated numbers if any. Focus on the main large glowing or active digital numbers showing the weight.
Extract that value as a single integer representing weight (usually in kilograms).
Return only a JSON object adhering to the specified schema. If the scale is turned off or no readable digits are present, return null for the weight.`,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['weight'],
          properties: {
            weight: { 
              type: Type.INTEGER, 
              description: 'The extracted weight value as an integer (e.g. 2564), or null if no weight display can be found.' 
            },
            reasoning: { 
              type: Type.STRING, 
              description: 'A brief 1-sentence description of the digits spotted on the display.' 
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini.');
    }

    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error('Error scanning weight from image:', error);
    res.status(500).json({ error: error.message || 'Failed to scan weight from image' });
  }
});

/**
 * API Endpoint: Scan Vehicle Number from Image
 * Uses gemini-3.5-flash to read license plates, container markings, or truck numbers from camera snaps or uploads
 */
app.post('/api/scan-vehicle', async (req, res) => {
  const { image } = req.body;

  if (!image) {
    res.status(400).json({ error: 'Image data is required' });
    return;
  }

  if (!ai) {
    res.status(503).json({ error: 'Gemini API is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.' });
    return;
  }

  try {
    // Parse base64 data URL
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let base64Data = image;

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        'Read and extract the vehicle registration number, license plate, or truck ID number displayed in the image. Return a JSON object with the extracted string.'
      ],
      config: {
        systemInstruction: `You are an expert OCR helper for logistics and weighbridge terminal systems.
Analyze the image of a truck, car, license plate, or registration marking.
Find the main vehicle plate or ID (e.g. MH-12-PQ-4567, AP-21-TX-9876, HR-55-A-1100, DL-3C-CAN-2321, or standard alphanumeric truck fleet IDs).
Extract the cleanest, fully capitalized representation of the vehicle registration plate.
Return only a JSON object adhering to the specified schema. If no vehicle number or license plate can be found, return null for the vehicleNumber.`,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['vehicleNumber'],
          properties: {
            vehicleNumber: { 
              type: Type.STRING, 
              description: 'The extracted vehicle license plate or registration number (e.g. "MH12PQ4567"), or null if not found.' 
            },
            reasoning: { 
              type: Type.STRING, 
              description: 'A brief 1-sentence description explaining where the plate was spotted or why it could not be read.' 
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini.');
    }

    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error('Error scanning vehicle number from image:', error);
    res.status(500).json({ error: error.message || 'Failed to scan vehicle number from image' });
  }
});

/**
 * API Endpoint: Identify Material from Image
 * Uses gemini-3.5-flash to identify what kind of industrial/logistics cargo material is visible
 */
app.post('/api/scan-material', async (req, res) => {
  const { image } = req.body;

  if (!image) {
    res.status(400).json({ error: 'Image data is required' });
    return;
  }

  if (!ai) {
    res.status(503).json({ error: 'Gemini API is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.' });
    return;
  }

  try {
    // Parse base64 data URL
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let base64Data = image;

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        'Analyze this image and identify the industrial, agricultural, or logistic material cargo shown (e.g. Coal, Sand, Gravel, Cement, Wood, Soil, Iron Ore, Scrap Metal, Bricks, Wheat, Corn, Sugar, Chemical, or other logistics cargo). Return a JSON object with the materialName and confidence description.'
      ],
      config: {
        systemInstruction: `You are an expert material classification assistant for industrial weighbridge, terminal, and warehouse loading bays.
Analyze the image of the vehicle loading bed, container cargo, heap, or raw materials.
Identify the material shown. Be specific and keep it concise (e.g. "River Sand", "Bituminous Coal", "Scrap Metal", "Wheat Grains", "Gravel Aggregate", "Sack Cement", "Teak Logs").
Return only a JSON object adhering to the specified schema. If no specific material is identifiable, return a reasonable guess or "General Cargo".`,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['materialName', 'confidence'],
          properties: {
            materialName: { 
              type: Type.STRING, 
              description: 'The classified name of the material cargo found in the image (e.g. "Bituminous Coal", "River Sand", "Crushed Gravel").' 
            },
            confidence: { 
              type: Type.STRING, 
              description: 'A brief 1-sentence assessment of confidence or texture hints seen (e.g., "Identified dark black coal grains with high confidence.").' 
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini.');
    }

    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error('Error identifying material from image:', error);
    res.status(500).json({ error: error.message || 'Failed to identify material from image' });
  }
});

// Fallback receipt designer in case API key is missing or calls error out
function getFallbackMockupReceipt(prompt: string) {
  const cleanPrompt = prompt.substring(0, 30);
  const dateStr = new Date().toLocaleDateString('en-US');
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return {
    title: 'AI THERMAL CO.',
    subtitle: 'Simulated Receipt Platform',
    metadata: [
      { label: 'DATE', value: dateStr },
      { label: 'TIME', value: timeStr },
      { label: 'PROMPT', value: cleanPrompt },
      { label: 'CASHIER', value: 'GEMINI_FALLBACK' },
      { label: 'TICKET#', value: '7721-098' },
    ],
    items: [
      { name: 'AI Synthesis Query', qty: 1, price: 0.00, total: 0.00 },
      { name: 'Creative Printing Service', qty: 1, price: 12.50, total: 12.50 },
      { name: 'Offline Buffer Simulator', qty: 3, price: 4.50, total: 13.50 },
    ],
    totals: [
      { label: 'SUBTOTAL', value: '$26.00', isBold: false },
      { label: 'TAX (8.5%)', value: '$2.21', isBold: false },
      { label: 'TOTAL', value: '$28.21', isBold: true },
    ],
    barcodeValue: 'AIPRINT2026',
    qrcodeValue: 'https://ai.studio/build',
    footerText: 'THANK YOU! SET UP YOUR GEMINI_API_KEY FOR LIVE GENERATIVE CREATIONS.',
    asciiArt: `
   ( \\  / )
  (   \\/   )
   \\      /
    \\    /
     \\  /
      \\/
    * LOVE *
`,
  };
}

// Global Express Error Handler to catch JSON parser limits, payload too large, or other errors and return clean JSON instead of HTML
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Express Error Handler]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected error occurred on the server.',
    code: err.code || 'SERVER_ERROR'
  });
});

// Vite and Static File Setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Thermal Printer Server running on http://localhost:${PORT}`);
  });
}

startServer();
