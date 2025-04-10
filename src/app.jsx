import React, { useState } from 'react';
import axios from 'axios';

function App() {
    const [file, setFile] = useState(null);
    const [videoId, setVideoId] = useState(null);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(10);
    const [clipUrl, setClipUrl] = useState('');
    const [autoClips, setAutoClips] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState('');

    const uploadVideo = async () => {
        const formData = new FormData();
        formData.append('video', file);

        try {
            const response = await axios.post('http://localhost:5000/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setVideoId(response.data.videoId);
            alert('Video uploaded successfully');
        } catch (error) {
            console.error('Error uploading video:', error);
            alert('Upload failed: ' + error.message);
        }
    };

    const generateClip = async () => {
        if (!file) {
            alert('Please upload a video first');
            return;
        }

        const formData = new FormData();
        formData.append('video', file);
        formData.append('startTime', startTime);
        formData.append('endTime', endTime);

        try {
            const response = await axios.post('http://localhost:5000/generate-clip', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setClipUrl(response.data.clipPath);
        } catch (error) {
            console.error('Error generating clip:', error);
            alert('Clip generation failed: ' + error.message);
        }
    };

    const generateAutoClips = async () => {
        if (!file) {
            alert('Please select a video file first');
            return;
        }

        setIsProcessing(true);
        setProgress('Uploading video...');

        try {
            const formData = new FormData();
            formData.append('video', file);

            setProgress('Analyzing content with AI...');
            const response = await axios.post(
                'http://localhost:5000/auto-generate-clips',
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        setProgress(`Uploading: ${percentCompleted}%`);
                    }
                }
            );

            setProgress('Generating clips...');
            setAutoClips(response.data.clips);
            setVideoId(response.data.videoId);
            setProgress('Done!');
        } catch (error) {
            console.error('Error generating auto clips:', error);
            alert('Auto clip generation failed: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const addSubtitlesToClip = async (clipPath) => {
        try {
            setProgress('Adding subtitles...');
            const response = await axios.post('http://localhost:5000/add-subtitles', {
                clipPath: clipPath
            });

            // Update the clip in state with the subtitled version
            setAutoClips(prevClips =>
                prevClips.map(clip =>
                    clip.path === clipPath
                        ? { ...clip, subtitledPath: response.data.subtitledPath }
                        : clip
                )
            );
            setProgress('Subtitles added successfully!');
        } catch (error) {
            console.error('Error adding subtitles:', error);
            alert('Failed to add subtitles: ' + error.message);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h1>Clipping Software V0.2</h1>

            {/* File Upload Section */}
            <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '5px' }}>
                <h2>Upload Video</h2>
                <input
                    type="file"
                    onChange={(e) => setFile(e.target.files[0])}
                    accept="video/*"
                    style={{ marginBottom: '10px' }}
                />
                <div>
                    <button onClick={uploadVideo} style={{ marginRight: '10px' }}>
                        Upload Video
                    </button>
                    <button onClick={generateAutoClips} disabled={isProcessing}>
                        {isProcessing ? 'Processing...' : 'Auto-Generate Highlights'}
                    </button>
                </div>
                {isProcessing && <p>{progress}</p>}
            </div>

            {/* Manual Clip Generation */}
            <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '5px' }}>
                <h2>Manual Clip Generation</h2>
                <div style={{ marginBottom: '10px' }}>
                    <label style={{ marginRight: '10px' }}>
                        Start Time (seconds):
                        <input
                            type="number"
                            value={startTime}
                            onChange={(e) => setStartTime(Number(e.target.value))}
                            style={{ marginLeft: '5px' }}
                        />
                    </label>
                    <label>
                        End Time (seconds):
                        <input
                            type="number"
                            value={endTime}
                            onChange={(e) => setEndTime(Number(e.target.value))}
                            style={{ marginLeft: '5px' }}
                        />
                    </label>
                </div>
                <button onClick={generateClip} disabled={!file}>
                    Generate Manual Clip
                </button>
            </div>

            {/* Results Section */}
            <div>
                {/* Manual Clip Result */}
                {clipUrl && (
                    <div style={{ marginBottom: '20px' }}>
                        <h3>Generated Clip</h3>
                        <video
                            src={`http://localhost:5000/${clipUrl}`}
                            controls
                            style={{ width: '100%', maxWidth: '600px' }}
                        />
                    </div>
                )}

                {/* Auto-Generated Clips */}
                {autoClips.length > 0 && (
                    <div>
                        <h2>AI-Generated Highlights</h2>
                        {autoClips.map((clip, index) => (
                            <div key={index} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #eee' }}>
                                <h4>Highlight #{index + 1}</h4>
                                <p><strong>Reason:</strong> {clip.reason}</p>
                                <p><strong>Segment:</strong> {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s</p>

                                <video
                                    src={`http://localhost:5000/${clip.path}`}
                                    controls
                                    style={{ width: '100%', maxWidth: '600px', marginBottom: '10px' }}
                                />

                                {!clip.subtitledPath && (
                                    <button
                                        onClick={() => addSubtitlesToClip(clip.path)}
                                        style={{ marginRight: '10px' }}
                                    >
                                        Add Subtitles
                                    </button>
                                )}

                                {clip.subtitledPath && (
                                    <div>
                                        <h5>With Subtitles:</h5>
                                        <video
                                            src={`http://localhost:5000/${clip.subtitledPath}`}
                                            controls
                                            style={{ width: '100%', maxWidth: '600px' }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;