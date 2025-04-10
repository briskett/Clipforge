const express = require('express');
const multer = require('multer');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const mysql = require('mysql2');
const fs = require('fs');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = 5000;

// Configuration
const TEST_MODE = true; // Set to false to use real OpenAI API
const ENABLE_SHORT_FORM = true; // Set to false for normal 16:9 videos

app.use(cors());
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'CSC648Team5!',
    database: 'opus_clips'
});

// Multer setup for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Create directories if they don't exist
['uploads', 'clips', 'temp', 'fonts'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Helper function to extract audio for transcription
function extractAudio(videoPath) {
    const audioPath = path.join('temp', `audio-${Date.now()}.mp3`);
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .output(audioPath)
            .noVideo()
            .audioCodec('libmp3lame')
            .on('end', () => resolve(audioPath))
            .on('error', reject)
            .run();
    });
}

// Get transcript from audio using Whisper
async function getTranscript(audioPath) {
    if (TEST_MODE) {
        console.log("TEST MODE: Using sample transcript");
        return SAMPLE_DATA.transcript;
    }

    try {
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-1",
        });
        return response.text;
    } catch (error) {
        console.error("Error in getTranscript:", error);
        throw new Error("Failed to transcribe audio");
    }
}

// Get transcript with word-level timings
async function getTimedTranscript(audioPath) {
    if (TEST_MODE) {
        console.log("TEST MODE: Using sample timed transcript");
        return SAMPLE_DATA.timedTranscript;
    }

    const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
        response_format: "srt"
    });
    return parseSRT(response);
}

// Parse SRT format to extract word timings
function parseSRT(srtContent) {
    const blocks = srtContent.split('\n\n');
    const subtitles = [];

    blocks.forEach(block => {
        if (!block.trim()) return;

        const lines = block.split('\n');
        if (lines.length < 3) return;

        const [start, end] = lines[1].split(' --> ').map(parseSRTTime);
        const text = lines.slice(2).join(' ');

        subtitles.push({
            start,
            end,
            text
        });
    });

    return subtitles;
}

function parseSRTTime(timeStr) {
    const [hms, ms] = timeStr.split(',');
    const [h, m, s] = hms.split(':');
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

// Sample data for testing (bypasses OpenAI API calls)
const SAMPLE_DATA = {
    transcript: "This is a sample transcript for testing purposes. It contains multiple sentences to simulate a real video transcript.",
    timedTranscript: [
        { start: 0, end: 5, text: "This is a sample transcript" },
        { start: 5, end: 10, text: "for testing purposes" },
        { start: 10, end: 15, text: "It contains multiple sentences" },
        { start: 15, end: 20, text: "to simulate a real video" }
    ],
    highlights: [
        { start: 0, end: 10, reason: "Opening introduction" },
        { start: 10, end: 20, reason: "Main content section" }
    ]
};

// Generate ASS subtitle file with animations
function generateASSSubtitles(subtitles) {
    let assContent = `[Script Info]
Title: Basic Subtitles
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,24

[Events]
Format: Layer, Start, End, Style, Text
`;

    subtitles.forEach((sub) => {
        const start = formatASSTime(sub.start);
        const end = formatASSTime(sub.end);
        assContent += `Dialogue: 0,${start},${end},Default,${sub.text}\\N\n`;
    });

    return assContent;
}

function formatASSTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${h}:${m}:${s}.${ms}`;
}

// Generate basic clip without subtitles
async function generateBasicClip(videoPath, startTime, endTime, outputPath) {
    return new Promise((resolve, reject) => {
        const command = ffmpeg(videoPath)
            .setStartTime(startTime)
            .setDuration(endTime - startTime);

        // Add short-form vertical video conversion if enabled
        if (ENABLE_SHORT_FORM) {
            command
                .videoFilters([
                    'scale=1080:1920', // Vertical 9:16 aspect
                    'crop=1080:1920',   // Ensure exact dimensions
                    'setsar=1:1'        // Set sample aspect ratio
                ])
                .outputOptions('-movflags faststart');
        }

        command
            .output(outputPath)
            .on('end', resolve)
            .on('error', (err) => {
                console.error('Error generating basic clip:', err);
                reject(err);
            })
            .run();
    });
}

// Add subtitles to an existing clip
async function addSubtitlesToClip(clipPath, subtitles, outputPath) {
    const assPath = path.join('temp', `subtitles-${Date.now()}.ass`);

    try {
        fs.writeFileSync(assPath, generateASSSubtitles(subtitles));

        await new Promise((resolve, reject) => {
            const command = ffmpeg(clipPath);

            // Different positioning for short-form vs normal videos
            const subtitleFilter = ENABLE_SHORT_FORM
                ? `subtitles=${assPath.replace(/\\/g, '/')}:force_style='Alignment=2,MarginV=100,Fontsize=36'`
                : `subtitles=${assPath.replace(/\\/g, '/')}:force_style='Alignment=2,MarginV=40,Fontsize=24'`;

            command
                .videoFilter(subtitleFilter)
                .output(outputPath)
                .on('end', () => {
                    fs.unlinkSync(assPath);
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error adding subtitles:', err);
                    reject(err);
                })
                .run();
        });
    } finally {
        if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
    }
}
// Helper function to analyze transcript and find highlights
async function findHighlights(transcript, videoDuration) {
    if (TEST_MODE) {
        console.log("TEST MODE: Using sample highlights");
        return SAMPLE_DATA.highlights;
    }

    const prompt = `
  Analyze this video transcript and suggest 3-5 short clips (each 30-60 seconds) that would be most engaging.
  Consider moments with:
  - Emotional peaks (excitement, surprise)
  - Important information
  - Interesting transitions
  - Unique insights
  
  Video duration: ${videoDuration} seconds
  Format your response as JSON with this structure:
  {
      "clips": [
          {
              "start": 42.5,
              "end": 48.2,
              "reason": "Exciting moment when the speaker reveals the key finding"
          }
      ]
  }
  
  Transcript: ${transcript}
  `;

    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content).clips;
}

// Get video duration
function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration);
        });
    });
}

// Upload video route
app.post('/upload', upload.single('video'), (req, res) => {
    const videoPath = req.file.path;
    const videoName = req.file.filename;

    db.query('INSERT INTO videos (file_name, file_path) VALUES (?, ?)', [videoName, videoPath], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }
        res.status(200).json({ message: 'Video uploaded successfully', videoId: result.insertId });
    });
});

// Generate basic clip (no subtitles)
app.post('/generate-clip', upload.single('video'), async (req, res) => {
    try {
        const videoPath = req.file.path;
        const { startTime = 0, endTime = 30 } = req.body;

        const clipName = `clip-${Date.now()}.mp4`;
        const clipPath = path.join('clips', clipName);

        await generateBasicClip(videoPath, startTime, endTime, clipPath);

        res.status(200).json({
            message: 'Clip generated successfully',
            clipPath
        });
    } catch (error) {
        console.error('Error generating clip:', error);
        res.status(500).json({
            error: 'Failed to generate clip',
            details: error.message
        });
    }
});

// Add subtitles to existing clip
app.post('/add-subtitles', async (req, res) => {
    try {
        const { clipPath } = req.body;

        const audioPath = await extractAudio(clipPath);
        const subtitles = await getTimedTranscript(audioPath);
        fs.unlinkSync(audioPath);

        const subbedPath = clipPath.replace('.mp4', '-subbed.mp4');
        await addSubtitlesToClip(clipPath, subtitles, subbedPath);

        res.json({
            success: true,
            originalPath: clipPath,
            subtitledPath: subbedPath
        });
    } catch (error) {
        console.error("Failed to add subtitles:", error);
        res.status(500).json({
            success: false,
            error: "Failed to add subtitles"
        });
    }
});

// Auto-generate clips endpoint (basic clips only)
app.post('/auto-generate-clips', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No video file uploaded" });
        }

        const videoPath = req.file.path;
        const videoName = req.file.filename;

        // Save to database
        const [dbResult] = await db.promise().query(
            'INSERT INTO videos (file_name, file_path) VALUES (?, ?)',
            [videoName, videoPath]
        );
        const videoId = dbResult.insertId;

        // Get video duration
        const duration = await getVideoDuration(videoPath);

        // Extract audio and get transcript
        const audioPath = await extractAudio(videoPath);
        const transcript = await getTranscript(audioPath);
        fs.unlinkSync(audioPath);

        // Find highlights
        const clips = await findHighlights(transcript, duration);

        // Generate basic clips
        const generatedClips = [];
        for (const clip of clips) {
            try {
                const clipName = `clip-${Date.now()}-${Math.floor(Math.random() * 1000)}.mp4`;
                const clipPath = path.join('clips', clipName);

                await generateBasicClip(videoPath, clip.start, clip.end, clipPath);

                // Save to database
                await db.promise().query(
                    'INSERT INTO clips (video_id, start_time, end_time, clip_path, reason) VALUES (?, ?, ?, ?, ?)',
                    [videoId, clip.start, clip.end, clipPath, clip.reason]
                );

                generatedClips.push({
                    path: clipPath,
                    start: clip.start,
                    end: clip.end,
                    reason: clip.reason
                });
            } catch (error) {
                console.error(`Failed to generate clip ${clip.start}-${clip.end}:`, error);
            }
        }

        res.json({
            success: true,
            clips: generatedClips,
            videoId
        });
    } catch (error) {
        console.error("Auto clip generation failed:", error);
        res.status(500).json({
            success: false,
            error: "Clip generation failed",
            details: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});