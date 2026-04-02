const express = require('express');
const multer = require('multer');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const cors = require('cors');
const { OpenAI } = require('openai');
const { spawn } = require('child_process');
const { router: authRouter, authMiddleware } = require('./auth');
const { router: subscriptionRouter, checkQuota, incrementUserGeneration, canGenerate } = require('./subscriptions');
const { router: stripeRouter } = require('./stripe');
require('dotenv').config();

const app = express();
const port = 5000;

// Configuration
const TEST_MODE = false; // Set to false to use real OpenAI API
const ENABLE_SHORT_FORM = true; // Set to false for normal 16:9 videos

app.use(cors());
app.use(express.json());
app.use('/clips', express.static(path.join(__dirname, 'clips')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/clips', express.static(path.join(__dirname, 'clips')));
app.use('/temp', express.static(path.join(__dirname, 'temp')));


// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// ElevenLabs setup
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY3;
const DEFAULT_VOICE_ID = '2EiwWnXFnvU5JabPnv8n';

// Available voice models
const VOICE_MODELS = {
    '2EiwWnXFnvU5JabPnv8n': { name: 'Clyde', description: 'Deep, authoritative male voice' },
    'EXAVITQu4vr4xnSDxMaL': { name: 'Sarah', description: 'Warm, friendly female voice' },
    'TX3LPaxmHKxFdv7VOQHJ': { name: 'Liam', description: 'Young, energetic male voice' },
    'XB0fDUnXU5powFXDhCwa': { name: 'Charlotte', description: 'Elegant British female voice' },
    'pFZP5JQG7iQjIQuC4Bku': { name: 'Lily', description: 'Soft, expressive female voice' },
    'onwK4e9ZLuTAKqWW03F9': { name: 'Daniel', description: 'Calm, narrative male voice' },
};

const getElevenLabsUrl = (voiceId) => `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || DEFAULT_VOICE_ID}`;

// Auth routes
app.use('/auth', authRouter);

// Subscription routes (protected)
app.use('/subscription', authMiddleware, subscriptionRouter);

// Stripe routes (webhook needs raw body, so it handles its own parsing)
app.use('/stripe', stripeRouter);

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

function loadWhisperXWords(jsonPath) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const words = data.segments.flatMap(segment => segment.words || []);
    return words.map(w => ({
        start: w.start,
        end: w.end,
        text: w.word.trim()
    }));
}

function groupWordsIntoSubtitles(words, groupSize = 3) {
    const subtitles = [];
    for (let i = 0; i < words.length; i += groupSize) {
        const chunk = words.slice(i, i + groupSize);
        if (chunk.length === 0) continue;
        subtitles.push({
            start: chunk[0].start,
            end: chunk[chunk.length - 1].end,
            text: chunk.map(w => w.text).join(' ')
        });
    }
    return subtitles;
}

async function runWhisperX(audioPath, outputDir) {
    return new Promise((resolve, reject) => {
        const jsonPath = path.join(outputDir, path.basename(audioPath, path.extname(audioPath)) + '.json');

        const whisper = spawn('whisperx', [
            audioPath,
            '--output_dir', outputDir,
            '--output_format', 'json',
            '--language', 'en'
        ]);

        whisper.stdout.on('data', (data) => {
            console.log(`[WhisperX STDOUT] ${data}`);
        });

        whisper.stderr.on('data', (data) => {
            console.error(`[WhisperX STDERR] ${data}`);
        });

        whisper.on('close', (code) => {
            if (code === 0) {
                console.log('✅ WhisperX alignment complete.');
                resolve(jsonPath);
            } else {
                reject(new Error(`WhisperX exited with code ${code}`));
            }
        });
    });
}

// Generate subtitles only (no burning)
app.post('/generate-subtitles-json', async (req, res) => {
    try {
        const { clipPath } = req.body;

        const audioPath = await extractAudio(clipPath);
        const outputDir = 'whisperx_output';
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

        console.log("🧠 Running WhisperX on:", audioPath);
        const jsonPath = await runWhisperX(audioPath, outputDir);

        console.log("📖 Parsing WhisperX output JSON:", jsonPath);
        const words = loadWhisperXWords(jsonPath);
        const subtitles = groupWordsIntoSubtitles(words);

        fs.unlinkSync(audioPath);

        res.json({
            success: true,
            subtitles
        });

    } catch (error) {
        console.error("❌ Failed to generate subtitle JSON:", error);
        res.status(500).json({
            success: false,
            error: "Failed to generate subtitle JSON"
        });
    }
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

function parseSRT(srtContent) {
    const blocks = srtContent.split('\n\n');
    const subtitles = [];

    blocks.forEach(block => {
        if (!block.trim()) return;

        const lines = block.split('\n');
        if (lines.length < 3) return;

        const [start, end] = lines[1].split(' --> ').map(parseSRTTime);
        const text = lines.slice(2).join(' ');
        const words = text.split(' ');
        const totalDuration = end - start;

        const groupSize = 3;
        const minGroupSize = 2;

        let chunks = [];
        for (let i = 0; i < words.length; i += groupSize) {
            const remaining = words.length - i;
            if (remaining < minGroupSize && chunks.length > 0) {
                chunks[chunks.length - 1].push(...words.slice(i));
                break;
            }
            chunks.push(words.slice(i, i + groupSize));
        }

        // 🔥 NEW: smarter timing distribution using character length
        const totalChars = chunks.reduce((sum, chunk) => sum + chunk.join(' ').length, 0);
        let currentStart = start;

        chunks.forEach(chunkWords => {
            const chunkText = chunkWords.join(' ');
            const weight = chunkText.length / totalChars;
            const chunkDuration = totalDuration * weight;
            const chunkEnd = currentStart + chunkDuration;

            subtitles.push({
                start: currentStart,
                end: chunkEnd,
                text: chunkText
            });

            currentStart = chunkEnd;
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
    return `[Script Info]
Title: RuneScape Pop Subtitles
ScriptType: v4.00+
PlayResX: 384
PlayResY: 288

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Runescape UF Regular,42,&H0000FFFF,&H000000FF,&H00303030,&H80000000,0,0,0,0,100,100,0,0,1,1,1,2,20,20,30,0

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${
        subtitles.map(sub => {
            const start = formatASSTime(sub.start);
            const end = formatASSTime(sub.end);
            return `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\fad(50,50)}${sub.text}\\N`;
        }).join('\n')
    }`;
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
            // Simplified and corrected filter chain
            command
                .videoFilters([
                    {
                        filter: 'scale',
                        options: {
                            w: 1080,
                            h: 1920,
                            force_original_aspect_ratio: 'increase'
                        }
                    },
                    {
                        filter: 'crop',
                        options: {
                            w: 1080,
                            h: 1920
                        }
                    }
                ])
                .outputOptions([
                    '-movflags +faststart',
                    '-preset fast',
                    '-crf' +
                    ' 18'
                ]);
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
You are a professional video editor specializing in creating viral short-form content. Analyze this transcript and identify the absolute BEST clips (10-90 seconds each) that would perform well on platforms like TikTok, Instagram Reels, and YouTube Shorts.

## Selection Criteria (in order of priority):
1. **Hook Potential** - First 3 seconds must be extremely attention-grabbing
2. **Emotional Impact** - Look for:
   - Surprising revelations
   - Controversial statements
   - Inspiring moments
   - Humorous segments
3. **Educational Value** - Clear, actionable insights that viewers would screenshot
4. **Story Arc** - Should feel like a complete mini-story (setup, tension, resolution)
5. **Pacing** - Prefer segments with varied vocal energy (not monotone)

## Technical Requirements:
- Clip duration MUST be between 10-90 seconds
- Always include 0.5s buffer before/after the selected segment
- Never cut mid-sentence
- Prefer segments where speaker is building to a climax

## Output Format (STRICT JSON):
{
  "clips": [
    {
      "start": 42.5, // Exact start time (seconds)
      "end": 72.3,   // Exact end time (seconds)
      "title": "The shocking truth about...", // Viral-style title
      "reason": "Contains a surprising statistic followed by emotional reaction", // Why this will perform well
      "hook_text": "You won't believe what happens at 0:43", // Text for the first frame
      "keywords": ["surprise", "revelation", "shocking"] // SEO/tag keywords
    }
  ],
  "summary": "This video contains 3 viral-worthy moments focusing on..." // Overall assessment
}

## Transcript (${videoDuration}s total):
${transcript}
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
    const videoId = `vid_${Date.now()}`;

    console.log(`📥 Video uploaded: ${videoName}`);
    res.status(200).json({ message: 'Video uploaded successfully', videoId, videoPath, videoName });
});

app.post('/generate-story-text', async (req, res) => {
    const { genre } = req.body;
    if (!genre) return res.status(400).json({ error: 'Genre is required' });

    try {
        let story;
        if (TEST_MODE) {
            console.log('🧪 TEST MODE: Skipping GPT story generation...');
            story = 'Test mode enabled – using pre-recorded audio.';
        } else {
            console.log('📚 Generating story from GPT...');
            const storyPrompt = `
You are a Reddit user writing a story that fits perfectly in r/${genre.toLowerCase()}.

Write the post in the exact tone, formatting, and storytelling style used by real people on that subreddit. 
It should sound like someone casually sharing their story online — not like a script,
 a novel, or something trying to be too polished.
 Keep the language natural and believable. Avoid big, fancy words, weird metaphors,
  or theatrical phrases that don’t match how people actually talk.

Start with the story’s title right at the beginning — no need to label it as “Title”
 or put it in brackets. Just start with the title as the first line like a regular Reddit post.

Use proper pacing and flow, like someone typing out a story in one sitting.
 No weird symbols, no brackets, and nothing that would sound robotic or strange
  when read out loud by ElevenLabs.
  Dialogue and inner thoughts should feel realistic — nothing exaggerated
   or overly dramatic unless it fits the tone of the subreddit.

You can end the story on a cliffhanger if it makes it more engaging or
 creates a good reason for a follow-up post later. Just make it feel like something
  that could actually go viral because it’s funny, awkward, dramatic, or super relatable
   — not because it sounds like it was written by a screenwriter.

Important: Always spell out acronyms like “Am I The Asshole” instead
 of using short versions. Keep it easy to read and easy to listen to.`;

            const storyResponse = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'user', content: storyPrompt }]
            });
            story = storyResponse.choices[0].message.content.trim();
            console.log('✅ Story generated.');
        }

        res.json({
            success: true,
            story
        });

    } catch (err) {
        console.error("Failed to generate story:", err);
        res.status(500).json({ error: 'Failed to generate story', details: err.message || err.toString() });
    }
});

// Get available voice models
app.get('/voices', (req, res) => {
    const voices = Object.entries(VOICE_MODELS).map(([id, info]) => ({
        id,
        ...info
    }));
    res.json({ success: true, voices });
});

// Voice preview - generates or serves cached preview audio
const PREVIEW_TEXT = "Hey there! This is what I sound like. I can narrate your Reddit stories with emotion and clarity.";
const voicePreviewsDir = path.join(__dirname, 'voice_previews');

// Create voice previews directory
if (!fs.existsSync(voicePreviewsDir)) fs.mkdirSync(voicePreviewsDir);

// Serve voice previews statically
app.use('/voice_previews', express.static(voicePreviewsDir));

app.get('/preview-voice/:voiceId', async (req, res) => {
    const { voiceId } = req.params;
    
    // Validate voice ID
    if (!VOICE_MODELS[voiceId]) {
        return res.status(400).json({ error: 'Invalid voice ID' });
    }
    
    const previewPath = path.join(voicePreviewsDir, `${voiceId}.mp3`);
    
    // Check if preview already exists (cached)
    if (fs.existsSync(previewPath)) {
        console.log(`🎵 Serving cached preview for ${VOICE_MODELS[voiceId].name}`);
        return res.json({ 
            success: true, 
            previewUrl: `/voice_previews/${voiceId}.mp3`,
            cached: true
        });
    }
    
    // Generate new preview
    try {
        console.log(`🎙️ Generating voice preview for ${VOICE_MODELS[voiceId].name}...`);
        
        const ttsResponse = await fetch(getElevenLabsUrl(voiceId), {
            method: 'POST',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: PREVIEW_TEXT,
                model_id: "eleven_flash_v2_5",
                voice_settings: {
                    stability: 0.4,
                    similarity_boost: 0.75
                }
            })
        });
        
        if (!ttsResponse.ok) {
            const errText = await ttsResponse.text();
            console.error('❌ ElevenLabs preview error:', errText);
            throw new Error(`Failed to generate preview: ${errText}`);
        }
        
        const arrayBuffer = await ttsResponse.arrayBuffer();
        fs.writeFileSync(previewPath, Buffer.from(arrayBuffer));
        
        console.log(`✅ Preview generated and cached for ${VOICE_MODELS[voiceId].name}`);
        
        res.json({ 
            success: true, 
            previewUrl: `/voice_previews/${voiceId}.mp3`,
            cached: false
        });
        
    } catch (error) {
        console.error('❌ Failed to generate voice preview:', error);
        res.status(500).json({ error: 'Failed to generate voice preview' });
    }
});

// The rest of the original `/generate-story` remains, expecting the reviewed story from frontend
// Protected route with quota check
app.post('/finalize-story', authMiddleware, checkQuota, async (req, res) => {
    const { genre, story, voiceId, backgroundType } = req.body;
    if (!genre || !story) return res.status(400).json({ error: 'Genre and story are required' });
    
    // Log quota info
    console.log(`📊 User ${req.user.id} generating video (${req.quota.used + 1}/${req.quota.limit} this month)`);

    const selectedVoiceId = voiceId || DEFAULT_VOICE_ID;
    console.log(`🎙️ Using voice: ${VOICE_MODELS[selectedVoiceId]?.name || 'Unknown'} (${selectedVoiceId})`);

    try {

        let audioPath;
        if (TEST_MODE) {
            console.log('🧪 TEST MODE: Skipping ElevenLabs, using pre-existing MP3...');
            audioPath = path.join(__dirname, 'temp', 'sample.mp3');
        } else {
            console.log('🗣️ Sending to ElevenLabs for TTS...');
            const ttsResponse = await fetch(getElevenLabsUrl(selectedVoiceId), {
                method: 'POST',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: story,
                    model_id: "eleven_flash_v2_5",
                    voice_settings: {
                        stability: 0.4,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!ttsResponse.ok) {
                const errText = await ttsResponse.text();
                console.error('❌ ElevenLabs TTS error:', errText);
                throw new Error(`Failed to generate voice: ${errText}`);
            }

            audioPath = path.join('temp', `story-${Date.now()}.mp3`);
            const arrayBuffer = await ttsResponse.arrayBuffer();
            fs.writeFileSync(audioPath, Buffer.from(arrayBuffer));
        }

        const getAudioDuration = (audioPath) => {
            return new Promise((resolve, reject) => {
                ffmpeg.ffprobe(audioPath, (err, metadata) => {
                    if (err) return reject(err);
                    resolve(metadata.format.duration);
                });
            });
        };
        const audioDuration = await getAudioDuration(audioPath);
        const bufferedDuration = audioDuration + 0; // modify buffer duration here, for avoiding abrupt audio
        // i set it to zero because it messed with subtitles timing.

        const parkourSource = path.join(__dirname, '/background/parkour1.mp4');
        const parkourClip = path.join('temp', `parkour-clip-${Date.now()}.mp4`);
        const parkourDuration = await getVideoDuration(parkourSource);

        const maxStart = Math.max(0, parkourDuration - bufferedDuration);
        const randomStart = parseFloat((Math.random() * maxStart).toFixed(2));
        console.log(`🎯 Trimming video from ${randomStart}s for ${bufferedDuration}s (maxStart: ${maxStart})`);
        console.log("🎞️ Parkour duration:", parkourDuration);
        console.log("🔊 Audio + buffer duration:", bufferedDuration);

        await new Promise((resolve, reject) => {
            const command = ffmpeg(parkourSource)
                .setStartTime(randomStart)
                .setDuration(bufferedDuration);

            if (ENABLE_SHORT_FORM) {
                command
                    .videoFilters([
                        {
                            filter: 'scale',
                            options: {
                                w: 1080,
                                h: 1920,
                                force_original_aspect_ratio: 'increase'
                            }
                        },
                        {
                            filter: 'crop',
                            options: {
                                w: 1080,
                                h: 1920
                            }
                        }
                    ])
                    .outputOptions([
                        '-movflags +faststart',
                        '-preset fast',
                        '-crf 18'
                    ]);
            }

            command
                .output(parkourClip)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });



        const outputDir = 'whisperx_output';
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
        const jsonPath = await runWhisperX(audioPath, outputDir);
        const words = loadWhisperXWords(jsonPath);


        let subtitles;

        if (TEST_MODE) {
            console.log("⚠️ TEST MODE: Using WhisperX word timings directly for subtitles");
            subtitles = groupWordsIntoSubtitles(words);
        } else {
            console.log("🧠 Aligning generated story text to WhisperX timings");
            const storyWords = story.split(/\s+/);
            const matchedWords = words.map((w, i) => ({
                start: w.start,
                end: w.end,
                text: storyWords[i] || ''
            }));
            subtitles = groupWordsIntoSubtitles(matchedWords);
        }

        const finalVideo = path.join('clips', `story-${Date.now()}.mp4`);

        console.log("🔊 Merging audio from:", audioPath);
        console.log("🎞️ Merging into video:", parkourClip);
        console.log("📤 Output path will be:", finalVideo);

        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(parkourClip)     // 🎥 Video
                .input(audioPath)       // 🔊 Audio
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions([
                    '-map 0:v:0',        // map video stream
                    '-map 1:a:0',        // map audio stream
                    '-shortest'          // cut to shortest of video/audio
                ])
                .output(finalVideo)
                .on('start', (cmdLine) => {
                    console.log("📸 ffmpeg merge command:", cmdLine);
                })
                .on('end', resolve)
                .on('error', (err) => {
                    console.error("❌ ffmpeg merge error:", err);
                    reject(err);
                })
                .run();
        });


        const subtitledVideoPath = finalVideo.replace('.mp4', '-subtitled.mp4');
        await addSubtitlesToClip(finalVideo, subtitles, subtitledVideoPath);

// Overwrite original with subtitled version
        fs.unlinkSync(finalVideo);
        fs.renameSync(subtitledVideoPath, finalVideo);

// Speed up then repeat replacement
        const speedUpPath = finalVideo.replace('.mp4', '-spedup.mp4');

        await new Promise((resolve, reject) => {
            ffmpeg(finalVideo)
                .videoFilter('setpts=0.7143*PTS') // 1 / 1.4 = ~0.7143 division to set pitch of audio
                .audioFilter('atempo=1.4')        // audio tempo
                .outputOptions('-movflags +faststart')
                .output(speedUpPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        fs.unlinkSync(finalVideo); // remove the original
        fs.renameSync(speedUpPath, finalVideo); // overwrite with sped-up version


        const musicDir = path.join(__dirname, 'music', genre.toLowerCase());
        const musicFiles = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));

        if (musicFiles.length === 0) {
            throw new Error(`No music files found for genre: ${genre}`);
        }

        const randomMusicFile = musicFiles[Math.floor(Math.random() * musicFiles.length)];
        const musicPath = path.join(musicDir, randomMusicFile);

        console.log(`🎵 Adding background music from: ${musicPath}`);

        const withMusicPath = finalVideo.replace('.mp4', '-withmusic.mp4');

        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(finalVideo)           // Original sped-up video
                .input(musicPath)            // Background music
                .inputOptions('-stream_loop', '-1') // loop music infinitely

                .complexFilter([
                    '[1:a]volume=0.15[a1]',  // Lower volume of music
                    '[0:a][a1]amix=inputs=2:duration=shortest' // cuts music to shortest of video/audio
                ])
                .audioCodec('aac')
                .videoCodec('copy')          // Copy video stream
                .output(withMusicPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

// Replace final video with version that has music
        fs.unlinkSync(finalVideo);
        fs.renameSync(withMusicPath, finalVideo);

        // Record the generation for quota tracking
        const updatedUsage = incrementUserGeneration(req.user.id);
        console.log(`✅ Generation recorded for user ${req.user.id} (${updatedUsage.generations} total this month)`);

        res.json({
            success: true,
            story,
            videoPath: finalVideo,
            usage: {
                used: updatedUsage.generations,
                limit: req.quota.limit,
                remaining: req.quota.limit - updatedUsage.generations
            }
        });

    } catch (err) {
        console.error("Failed to finalize story:", err);
        res.status(500).json({ error: 'Failed to finalize story', details: err.message || err.toString() });
    }
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


// MODIFIED: add-subtitles route using WhisperX
app.post('/add-subtitles', async (req, res) => {
    try {
        const { clipPath } = req.body;

        const audioPath = await extractAudio(clipPath);
        const outputDir = 'whisperx_output';
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

        console.log("🧠 Running WhisperX on:", audioPath);
        console.log("👉 Command:", command);
        const jsonPath = await runWhisperX(audioPath, outputDir);

        console.log("📖 Parsing WhisperX output JSON:", jsonPath);
        const words = loadWhisperXWords(jsonPath);
        const subtitles = groupWordsIntoSubtitles(words);

        fs.unlinkSync(audioPath);

        const subbedPath = clipPath.replace('.mp4', '-subbed.mp4');
        await addSubtitlesToClip(clipPath, subtitles, subbedPath);

        res.json({
            success: true,
            originalPath: clipPath,
            subtitledPath: subbedPath
        });

        console.log(`💬 Subtitles generated: ${subtitles.length} entries`);

    } catch (error) {
        console.error("❌ Failed to add subtitles:", error);
        res.status(500).json({
            success: false,
            error: "Failed to add subtitles"
        });
    }
});

app.post('/burn-edited-subtitles', async (req, res) => {
    try {
        const { clipPath, subtitles } = req.body;
        if (!clipPath || !Array.isArray(subtitles)) {
            return res.status(400).json({ error: "Missing clipPath or subtitles" });
        }

        const outputPath = clipPath.replace('.mp4', '-custom-subbed.mp4');
        await addSubtitlesToClip(clipPath, subtitles, outputPath);

        res.json({
            success: true,
            subtitledPath: outputPath
        });
    } catch (err) {
        console.error("🔥 Burn failed:", err);
        res.status(500).json({ error: "Failed to burn subtitles" });
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
        const videoId = `vid_${Date.now()}`;

        console.log(`📥 Uploaded video: ${videoName}`);

        // Get video duration
        const duration = await getVideoDuration(videoPath);
        console.log(`⏱️ Video duration: ${duration.toFixed(2)} seconds`);

        // Extract audio
        console.log(`🎧 Extracting audio from video...`);
        const audioPath = await extractAudio(videoPath);
        console.log(`✅ Audio extracted: ${audioPath}`);

        // Get transcript
        console.log(`📝 Transcribing audio with Whisper...`);
        const transcript = await getTranscript(audioPath);
        fs.unlinkSync(audioPath);
        console.log(`✅ Transcription complete.`);

        // Find highlights
        console.log(`✨ Finding viral highlights in transcript...`);
        const clips = await findHighlights(transcript, duration);
        console.log(`🎯 Found ${clips.length} highlight(s).`);

        const generatedClips = [];

        for (const [index, clip] of clips.entries()) {
            try {
                console.log(`📦 Generating clip ${index + 1}/${clips.length} (${clip.start}s → ${clip.end}s)`);

                const clipName = `clip-${Date.now()}-${Math.floor(Math.random() * 1000)}.mp4`;
                const clipPath = path.join('clips', clipName);

                await generateBasicClip(videoPath, clip.start, clip.end, clipPath);
                console.log(`✅ Clip saved: ${clipPath}`);

                generatedClips.push({
                    path: clipPath,
                    start: clip.start,
                    end: clip.end,
                    reason: clip.reason
                });
            } catch (error) {
                console.error(`❌ Failed to generate clip ${clip.start}-${clip.end}:`, error);
            }
        }

        console.log(`🚀 Clip generation complete. Total generated: ${generatedClips.length}`);

        res.json({
            success: true,
            clips: generatedClips,
            videoId
        });
    } catch (error) {
        console.error("❌ Auto clip generation failed:", error);
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