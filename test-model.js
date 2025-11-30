
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// Load env
let apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/VITE_GOOGLE_API_KEY=(.*)/);
      if (match) {
        apiKey = match[1].trim();
      }
    }
  } catch (e) {
    console.error('Error loading .env.local', e);
  }
}

if (!apiKey) {
  console.error('No API Key found in environment or .env.local');
  process.exit(1);
}

const google = createGoogleGenerativeAI({
  apiKey,
});

async function testModelWithTools(modelId) {
  console.log(`Testing model with tools: ${modelId}`);
  try {
    const result = await generateText({
      model: google(modelId),
      prompt: 'List files in current directory', // Should trigger tool
      tools: {
        list_directory: tool({
          description: 'List files in a directory',
          parameters: z.object({
            path: z.string().optional().describe('The path to list'),
          }),
          execute: async ({ path }) => {
            return `Files: a.txt, b.txt (simulated for ${path || '.'})`;
          },
        }),
      },
    });
    console.log(`Success: ${modelId}`);
    console.log('Text:', result.text);
    console.log('Tool Calls:', result.toolCalls?.length);
  } catch (error) {
    console.error(`Failed: ${modelId}`, error.message);
    console.error(error);
  }
}

testModelWithTools('gemini-3-pro-preview');
