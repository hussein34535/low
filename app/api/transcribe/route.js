import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Convert the File object to a Buffer-like object (needed for some SDKs) or pass directly
        // Groq SDK supports File objects directly in Node context? Actually standard FormData behavior.
        // Let's safe-bet and write to simple temp file or pass as stream if possible.
        // But Next.js Edge runtime vs Node runtime matters. We are using Node runtime (default).

        // Creating a temporary file for the upload
        // Note: In Vercel serverless, we can only write to /tmp

        const buffer = Buffer.from(await file.arrayBuffer());
        const tempFilePath = path.join('/tmp', `input-${Date.now()}.webm`); // Using .webm as likely format from MediaRecorder

        // Ensure /tmp exists (it does on Vercel, but local windows might not have it)
        // On Windows local, /tmp might fail. Let's use os.tmpdir() logic or just local .tmp
        // For simplicity in this environment:
        const isWindows = process.platform === "win32";
        const tempDir = isWindows ? path.join(process.cwd(), '.tmp') : '/tmp';

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const filePath = path.join(tempDir, `audio-${Date.now()}.webm`);
        fs.writeFileSync(filePath, buffer);

        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-large-v3",
            response_format: "json",
            language: "ar", // Force Arabic
            temperature: 0.0
        });

        // Cleanup
        try { fs.unlinkSync(filePath); } catch (e) { }

        return NextResponse.json({ text: transcription.text });
    } catch (error) {
        console.error('Transcription error:', error);
        return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
    }
}
