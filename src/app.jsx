import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './stylesheets/app.css';

const STEPS = [
    { id: 1, title: 'Choose Subreddit', icon: '📖' },
    { id: 2, title: 'Select Background', icon: '🎬' },
    { id: 3, title: 'Pick Voice', icon: '🎙️' },
    { id: 4, title: 'Review Story', icon: '✏️' },
    { id: 5, title: 'Generate Video', icon: '🚀' },
];

const SUBREDDITS = [
    { id: 'AITA', name: 'Am I The Asshole', description: 'Moral dilemmas and judgment calls', color: '#FF4500' },
    { id: 'TIFU', name: 'Today I F***ed Up', description: 'Embarrassing mistakes and regrets', color: '#FF6B35' },
    { id: 'MaliciousCompliance', name: 'Malicious Compliance', description: 'Following rules to absurd ends', color: '#7B68EE' },
    { id: 'AmIOverreacting', name: 'Am I Overreacting', description: 'Validating emotional responses', color: '#20B2AA' },
    { id: 'relationship_advice', name: 'Relationship Advice', description: 'Love, drama, and heartbreak', color: '#FF69B4' },
    { id: 'confession', name: 'Confessions', description: 'Deep secrets revealed', color: '#8B0000' },
];

const BACKGROUNDS = [
    { id: 'minecraft', name: 'Minecraft Parkour', description: 'Classic viral background', preview: '🎮', isDefault: true },
    { id: 'custom', name: 'Upload Your Own', description: 'Use your own video', preview: '📁', isDefault: false },
];

const VOICES = [
    { id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde', description: 'Deep, authoritative male voice', gender: 'male' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Warm, friendly female voice', gender: 'female' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Young, energetic male voice', gender: 'male' },
    { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Elegant British female voice', gender: 'female' },
    { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Soft, expressive female voice', gender: 'female' },
    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Calm, narrative male voice', gender: 'male' },
];

function App() {
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedSubreddit, setSelectedSubreddit] = useState(null);
    const [selectedBackground, setSelectedBackground] = useState('minecraft');
    const [customBackgroundFile, setCustomBackgroundFile] = useState(null);
    const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
    const [generatedStory, setGeneratedStory] = useState('');
    const [isGeneratingStory, setIsGeneratingStory] = useState(false);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState('');
    const [progress, setProgress] = useState('');
    
    // Voice preview state
    const [playingVoice, setPlayingVoice] = useState(null);
    const [loadingVoice, setLoadingVoice] = useState(null);
    const audioRef = useRef(null);

    // Stop audio when leaving voice selection step
    useEffect(() => {
        if (currentStep !== 3 && audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
            setPlayingVoice(null);
        }
    }, [currentStep]);

    const playVoicePreview = async (voiceId, e) => {
        e.stopPropagation(); // Prevent card selection when clicking play
        
        // If same voice is playing, stop it
        if (playingVoice === voiceId) {
            audioRef.current?.pause();
            setPlayingVoice(null);
            return;
        }
        
        // Stop any currently playing audio
        if (audioRef.current) {
            audioRef.current.pause();
        }
        
        setLoadingVoice(voiceId);
        
        try {
            // Fetch preview URL from backend
            const response = await axios.get(`http://localhost:5000/preview-voice/${voiceId}`);
            const previewUrl = `http://localhost:5000${response.data.previewUrl}`;
            
            // Create and play audio
            const audio = new Audio(previewUrl);
            audioRef.current = audio;
            
            audio.onended = () => {
                setPlayingVoice(null);
            };
            
            audio.onerror = () => {
                setPlayingVoice(null);
                setLoadingVoice(null);
                alert('Failed to load voice preview');
            };
            
            await audio.play();
            setPlayingVoice(voiceId);
            
        } catch (error) {
            console.error('Error playing voice preview:', error);
            alert('Failed to load voice preview. Please try again.');
        } finally {
            setLoadingVoice(null);
        }
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1: return selectedSubreddit !== null;
            case 2: return selectedBackground === 'minecraft' || customBackgroundFile !== null;
            case 3: return selectedVoice !== null;
            case 4: return generatedStory.trim().length > 0;
            case 5: return true;
            default: return false;
        }
    };

    const handleNext = async () => {
        if (currentStep === 3 && !generatedStory) {
            // Generate story when moving to step 4
            await generateStory();
        }
        if (currentStep < 5) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const generateStory = async () => {
        setIsGeneratingStory(true);
        setProgress('Crafting your story with AI...');
        try {
            const response = await axios.post('http://localhost:5000/generate-story-text', {
                genre: selectedSubreddit
            });
            setGeneratedStory(response.data.story);
            setProgress('');
        } catch (error) {
            console.error('Error generating story:', error);
            alert('Failed to generate story. Please try again.');
        } finally {
            setIsGeneratingStory(false);
        }
    };

    const generateVideo = async () => {
        setIsGeneratingVideo(true);
        setProgress('Creating your video...');
        
        try {
            const formData = new FormData();
            formData.append('genre', selectedSubreddit);
            formData.append('story', generatedStory);
            formData.append('voiceId', selectedVoice);
            
            if (selectedBackground === 'custom' && customBackgroundFile) {
                formData.append('customBackground', customBackgroundFile);
            }

            const response = await axios.post('http://localhost:5000/finalize-story', {
                genre: selectedSubreddit,
                story: generatedStory,
                voiceId: selectedVoice,
                backgroundType: selectedBackground
            });

            setGeneratedVideoUrl(response.data.videoPath);
            setProgress('');
        } catch (error) {
            console.error('Error generating video:', error);
            alert('Failed to generate video. Please try again.');
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    const resetWizard = () => {
        setCurrentStep(1);
        setSelectedSubreddit(null);
        setSelectedBackground('minecraft');
        setCustomBackgroundFile(null);
        setSelectedVoice(VOICES[0].id);
        setGeneratedStory('');
        setGeneratedVideoUrl('');
        setProgress('');
    };

    return (
        <div className="app-container">
            <div className="wizard-wrapper">
                {/* Header */}
                <header className="wizard-header">
                    <h1 className="logo">
                        <span className="logo-icon">🎬</span>
                        ClipForge
                    </h1>
                    <p className="tagline">Create viral Reddit story videos in minutes</p>
                </header>

                {/* Progress Steps */}
                <div className="steps-container">
                    {STEPS.map((step, index) => (
                        <div 
                            key={step.id}
                            className={`step-item ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
                        >
                            <div className="step-circle">
                                {currentStep > step.id ? '✓' : step.icon}
                            </div>
                            <span className="step-title">{step.title}</span>
                            {index < STEPS.length - 1 && <div className="step-connector" />}
                        </div>
                    ))}
                </div>

                {/* Step Content */}
                <div className="step-content">
                    {/* Step 1: Choose Subreddit */}
                    {currentStep === 1 && (
                        <div className="step-panel fade-in">
                            <h2>What kind of story do you want?</h2>
                            <p className="step-description">Choose a subreddit style for your AI-generated story</p>
                            
                            <div className="subreddit-grid">
                                {SUBREDDITS.map((sub) => (
                                    <div
                                        key={sub.id}
                                        className={`subreddit-card ${selectedSubreddit === sub.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedSubreddit(sub.id)}
                                        style={{ '--accent-color': sub.color }}
                                    >
                                        <div className="subreddit-header">
                                            <span className="subreddit-icon">r/</span>
                                            <span className="subreddit-name">{sub.id}</span>
                                        </div>
                                        <h3>{sub.name}</h3>
                                        <p>{sub.description}</p>
                                        {selectedSubreddit === sub.id && (
                                            <div className="selected-badge">✓ Selected</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Select Background */}
                    {currentStep === 2 && (
                        <div className="step-panel fade-in">
                            <h2>Choose your background video</h2>
                            <p className="step-description">This plays behind your story narration</p>
                            
                            <div className="background-grid">
                                {BACKGROUNDS.map((bg) => (
                                    <div
                                        key={bg.id}
                                        className={`background-card ${selectedBackground === bg.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedBackground(bg.id)}
                                    >
                                        <div className="background-preview">{bg.preview}</div>
                                        <h3>{bg.name}</h3>
                                        <p>{bg.description}</p>
                                        {bg.isDefault && <span className="recommended-badge">Recommended</span>}
                                        {selectedBackground === bg.id && (
                                            <div className="selected-badge">✓ Selected</div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {selectedBackground === 'custom' && (
                                <div className="custom-upload-section">
                                    <label className="file-upload-label">
                                        <input
                                            type="file"
                                            accept="video/*"
                                            onChange={(e) => setCustomBackgroundFile(e.target.files[0])}
                                            className="file-input"
                                        />
                                        <div className="file-upload-box">
                                            {customBackgroundFile ? (
                                                <>
                                                    <span className="file-icon">✅</span>
                                                    <span>{customBackgroundFile.name}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="file-icon">📤</span>
                                                    <span>Click to upload video</span>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Pick Voice */}
                    {currentStep === 3 && (
                        <div className="step-panel fade-in">
                            <h2>Select a narrator voice</h2>
                            <p className="step-description">Powered by ElevenLabs AI voices — click the play button to preview</p>
                            
                            <div className="voice-grid">
                                {VOICES.map((voice) => (
                                    <div
                                        key={voice.id}
                                        className={`voice-card ${selectedVoice === voice.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedVoice(voice.id)}
                                    >
                                        <div className="voice-avatar">
                                            {voice.gender === 'male' ? '👨' : '👩'}
                                        </div>
                                        <h3>{voice.name}</h3>
                                        <p>{voice.description}</p>
                                        
                                        <button 
                                            className={`voice-preview-btn ${playingVoice === voice.id ? 'playing' : ''}`}
                                            onClick={(e) => playVoicePreview(voice.id, e)}
                                            disabled={loadingVoice !== null && loadingVoice !== voice.id}
                                        >
                                            {loadingVoice === voice.id ? (
                                                <span className="btn-spinner"></span>
                                            ) : playingVoice === voice.id ? (
                                                <>⏹ Stop</>
                                            ) : (
                                                <>▶ Preview</>
                                            )}
                                        </button>
                                        
                                        {selectedVoice === voice.id && (
                                            <div className="selected-badge">✓ Selected</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Review Story */}
                    {currentStep === 4 && (
                        <div className="step-panel fade-in">
                            <h2>Review & Edit Your Story</h2>
                            <p className="step-description">Make sure everything reads exactly how you want it spoken</p>
                            
                            {isGeneratingStory ? (
                                <div className="loading-state">
                                    <div className="spinner"></div>
                                    <p>{progress}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="warning-banner">
                                        <span className="warning-icon">⚠️</span>
                                        <div>
                                            <strong>Important:</strong> ElevenLabs will read text exactly as written. 
                                            Spell out abbreviations (e.g., "Am I The Asshole" instead of "AITA"). 
                                            Avoid unusual brackets or punctuation as WhisperX captions will display them.
                                        </div>
                                    </div>
                                    
                                    <textarea
                                        className="story-editor"
                                        value={generatedStory}
                                        onChange={(e) => setGeneratedStory(e.target.value)}
                                        placeholder="Your AI-generated story will appear here..."
                                        rows={15}
                                    />
                                    
                                    <div className="story-actions">
                                        <button 
                                            className="btn-secondary"
                                            onClick={generateStory}
                                            disabled={isGeneratingStory}
                                        >
                                            🔄 Regenerate Story
                                        </button>
                                        <span className="char-count">
                                            {generatedStory.length} characters
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 5: Generate Video */}
                    {currentStep === 5 && (
                        <div className="step-panel fade-in">
                            <h2>Generate Your Video</h2>
                            
                            {!generatedVideoUrl && !isGeneratingVideo && (
                                <>
                                    <p className="step-description">Review your selections before generating</p>
                                    
                                    <div className="summary-card">
                                        <div className="summary-item">
                                            <span className="summary-label">Subreddit Style</span>
                                            <span className="summary-value">r/{selectedSubreddit}</span>
                                        </div>
                                        <div className="summary-item">
                                            <span className="summary-label">Background</span>
                                            <span className="summary-value">
                                                {selectedBackground === 'minecraft' ? 'Minecraft Parkour' : customBackgroundFile?.name}
                                            </span>
                                        </div>
                                        <div className="summary-item">
                                            <span className="summary-label">Voice</span>
                                            <span className="summary-value">
                                                {VOICES.find(v => v.id === selectedVoice)?.name}
                                            </span>
                                        </div>
                                        <div className="summary-item">
                                            <span className="summary-label">Story Length</span>
                                            <span className="summary-value">{generatedStory.length} characters</span>
                                        </div>
                                    </div>

                                    <button 
                                        className="btn-generate"
                                        onClick={generateVideo}
                                    >
                                        🚀 Generate Video
                                    </button>
                                </>
                            )}

                            {isGeneratingVideo && (
                                <div className="loading-state">
                                    <div className="spinner large"></div>
                                    <h3>Creating your masterpiece...</h3>
                                    <p className="progress-text">{progress || 'This may take a few minutes'}</p>
                                    <div className="progress-steps">
                                        <div className="progress-step active">Converting text to speech</div>
                                        <div className="progress-step">Processing background video</div>
                                        <div className="progress-step">Generating captions</div>
                                        <div className="progress-step">Adding background music</div>
                                        <div className="progress-step">Final rendering</div>
                                    </div>
                                </div>
                            )}

                            {generatedVideoUrl && (
                                <div className="video-result">
                                    <div className="success-banner">
                                        <span>🎉</span> Your video is ready!
                                    </div>
                                    
                                    <div className="video-player-container">
                                        <video
                                            controls
                                            src={`http://localhost:5000/${generatedVideoUrl}`}
                                            className="generated-video"
                                        />
                                    </div>

                                    <div className="video-actions">
                                        <a 
                                            href={`http://localhost:5000/${generatedVideoUrl}`}
                                            download
                                            className="btn-download"
                                        >
                                            📥 Download Video
                                        </a>
                                        <button 
                                            className="btn-secondary"
                                            onClick={resetWizard}
                                        >
                                            ✨ Create Another
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation */}
                {!(currentStep === 5 && (isGeneratingVideo || generatedVideoUrl)) && (
                    <div className="wizard-navigation">
                        <button 
                            className="btn-back"
                            onClick={handleBack}
                            disabled={currentStep === 1}
                        >
                            ← Back
                        </button>
                        
                        {currentStep < 5 ? (
                            <button 
                                className="btn-next"
                                onClick={handleNext}
                                disabled={!canProceed() || isGeneratingStory}
                            >
                                {currentStep === 3 && !generatedStory ? 'Generate Story →' : 'Next →'}
                            </button>
                        ) : (
                            !generatedVideoUrl && !isGeneratingVideo && (
                                <button 
                                    className="btn-next"
                                    onClick={generateVideo}
                                    disabled={isGeneratingVideo}
                                >
                                    Generate Video 🚀
                                </button>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
