import React from 'react';

const SubtitleEditor = ({ subtitles, onUpdate }) => {
    const handleChange = (index, field, value) => {
        const updated = [...subtitles];
        updated[index][field] = field === 'text' ? value : parseFloat(value);
        onUpdate(updated);
    };



    return (
        <div style={{ marginTop: '20px' }}>
            <h2>Edit Subtitles</h2>
            {subtitles.map((subtitle, index) => (
                <div key={index} style={{ marginBottom: '10px' }}>
                    <input
                        type="number"
                        value={subtitle.start}
                        onChange={(e) => handleChange(index, 'start', e.target.value)}
                        step="0.01"
                        style={{ width: '80px', marginRight: '5px' }}
                    />
                    <input
                        type="number"
                        value={subtitle.end}
                        onChange={(e) => handleChange(index, 'end', e.target.value)}
                        step="0.01"
                        style={{ width: '80px', marginRight: '5px' }}
                    />
                    <input
                        type="text"
                        value={subtitle.text}
                        onChange={(e) => handleChange(index, 'text', e.target.value)}
                        style={{ width: '60%' }}
                    />
                </div>
            ))}
        </div>
    );
};

export default SubtitleEditor;
