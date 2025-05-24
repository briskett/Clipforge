import React from 'react';
import axios from 'axios';

export default function StoryGenerator({
                                           selectedGenre,
                                           setSelectedGenre,
                                           generatedStory,
                                           setGeneratedStory,
                                           setProgress,
                                           setGeneratedVideoUrl,
                                           generatedVideoUrl
                                       }) {
    const genreOptions = [
        'confession',
        'AITA',
        'TIFU',
        'AmIOverreacting',
        'relationship_advice',
        'MaliciousCompliance'
    ];

    const generateStory = async () => {
        if (!selectedGenre) {
            alert('Please select a genre first');
            return;
        }

        try {
            setProgress(`Generating a ${selectedGenre} story...`);
            const response = await axios.post('http://localhost:5000/generate-story-text', {
                genre: selectedGenre
            });
            setGeneratedStory(response.data.story);
            setProgress('Story generated successfully!');
        } catch (error) {
            console.error('Error generating story:', error);
            alert('Story generation failed: ' + (error.response?.data?.details || error.message));
        }
    };

    return (
        <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '5px' }}>
            <h2>Generate AI Story</h2>
            <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                style={{ marginRight: '10px' }}
            >
                <option value="">Select Genre</option>
                {genreOptions.map((genre, idx) => (
                    <option key={idx} value={genre}>{genre}</option>
                ))}
            </select>
            <button onClick={generateStory}>Generate Story</button>

            {generatedStory && (
                <div style={{ marginTop: '20px', whiteSpace: 'pre-wrap' }}>
                    <h3>{selectedGenre} Story:</h3>
                    <p>{generatedStory}</p>
                </div>
            )}

            {generatedStory && (
                <div style={{ marginTop: '20px' }}>
                    <h3>Edit Story:</h3>
                    <textarea
                        value={generatedStory}
                        onChange={(e) => setGeneratedStory(e.target.value)}
                        rows={10}
                        style={{ width: '100%', whiteSpace: 'pre-wrap' }}
                    />
                    <button
                        style={{ marginTop: '10px' }}
                        onClick={async () => {
                            try {
                                setProgress('Finalizing story...');
                                const response = await axios.post('http://localhost:5000/finalize-story', {
                                    genre: selectedGenre,
                                    story: generatedStory
                                });
                                setGeneratedVideoUrl(response.data.videoPath);
                                setProgress('Video generated successfully!');
                            } catch (err) {
                                console.error('Finalize error:', err);
                                alert('Failed to finalize story.');
                            }
                        }}
                    >
                        Finalize and Generate Video
                    </button>
                </div>
            )}

            {generatedVideoUrl && (
                <div style={{ marginTop: '20px' }}>
                    <h4>Generated Video:</h4>
                    <video
                        controls
                        src={`http://localhost:5000/${generatedVideoUrl}`}
                        style={{ width: '100%', maxWidth: '600px' }}
                    />
                </div>
            )}
        </div>
    );
}
