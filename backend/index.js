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
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
if (!fs.existsSync('clips')) {
    fs.mkdirSync('clips');
}
if (!fs.existsSync('temp')) {
    fs.mkdirSync('temp');
}

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

// Helper function to get transcript using OpenAI Whisper
async function getTranscript(audioPath) {
    const transcript = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
    });
    return transcript.text;
}

// Helper function to analyze transcript and find highlights
async function findHighlights(transcript, videoDuration) {
    const prompt = `
    Analyze this video transcript and suggest 3-5 short clips that would be most engaging.
    Ensure the duration of these clips are no lesser than 30 seconds.
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
                "start": 0,
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

// Helper function to get video duration
function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration);
        });
    });
}

// Upload video route (unchanged)
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

// Manual clip generation (unchanged)
app.post('/generate-clip', (req, res) => {
    const { videoId, startTime, endTime } = req.body;

    db.query('SELECT * FROM videos WHERE id = ?', [videoId], (err, result) => {
        if (err || !result.length) {
            return res.status(404).send('Video not found');
        }

        const videoPath = result[0].file_path;
        const clipName = `${Date.now()}.mp4`;
        const clipPath = `clips/${clipName}`;

        ffmpeg(videoPath)
            .setStartTime(startTime)
            .setDuration(endTime - startTime)
            .output(clipPath)
            .on('end', () => {
                db.query('INSERT INTO clips (video_id, start_time, end_time, clip_path) VALUES (?, ?, ?, ?)',
                    [videoId, startTime, endTime, clipPath], (err, result) => {
                        if (err) {
                            return res.status(500).send('Error saving clip data');
                        }
                        res.status(200).json({ message: 'Clip generated', clipPath });
                    });
            })
            .run();
    });
});

// NEW: Auto-generate clips endpoint
app.post('/auto-generate-clips', upload.single('video'), async (req, res) => {
    try {
        const videoPath = req.file.path;
        const videoName = req.file.filename;

        // Save video to database first
        const dbResult = await new Promise((resolve, reject) => {
            db.query('INSERT INTO videos (file_name, file_path) VALUES (?, ?)',
                [videoName, videoPath], (err, result) => {
                    if (err) reject(err);
                    resolve(result);
                });
        });

        const videoId = dbResult.insertId;
        const videoDuration = await getVideoDuration(videoPath);

        // Extract audio and get transcript
        const audioPath = await extractAudio(videoPath);
        const transcript = await getTranscript(audioPath);

        // Find highlights using AI
        const clips = await findHighlights(transcript, videoDuration);

        // Generate each clip
        const generatedClips = [];
        for (const clip of clips) {
            const clipName = `auto-${Date.now()}-${Math.floor(Math.random() * 1000)}.mp4`;
            const clipPath = path.join('clips', clipName);

            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .setStartTime(clip.start)
                    .setDuration(clip.end - clip.start)
                    .output(clipPath)
                    .on('end', () => resolve())
                    .on('error', reject)
                    .run();
            });

            // Save clip to database
            await new Promise((resolve, reject) => {
                db.query('INSERT INTO clips (video_id, start_time, end_time, clip_path, reason) VALUES (?, ?, ?, ?, ?)',
                    [videoId, clip.start, clip.end, clipPath, clip.reason],
                    (err) => err ? reject(err) : resolve());
            });

            generatedClips.push({
                path: clipPath,
                start: clip.start,
                end: clip.end,
                reason: clip.reason
            });
        }

        // Clean up temporary audio file
        fs.unlinkSync(audioPath);

        res.status(200).json({
            message: 'Clips generated successfully',
            videoId,
            clips: generatedClips,
            transcript: transcript // Optional: return transcript for debugging
        });

    } catch (error) {
        console.error('Error in auto-generate-clips:', error);
        res.status(500).json({
            error: 'Failed to generate clips',
            details: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});