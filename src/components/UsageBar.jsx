import React from 'react';
import './UsageBar.css';

export default function UsageBar({ used, limit, tier, onUpgrade }) {
    const percentage = Math.min(100, Math.round((used / limit) * 100));
    const remaining = limit - used;
    
    const getBarColor = () => {
        if (percentage >= 90) return 'var(--danger)';
        if (percentage >= 70) return 'var(--warning)';
        return 'var(--accent-primary)';
    };

    return (
        <div className="usage-bar-container">
            <div className="usage-info">
                <span className="usage-text">
                    <strong>{remaining}</strong> of {limit} videos remaining
                </span>
                <span className={`tier-badge tier-${tier}`}>
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </span>
            </div>
            
            <div className="usage-bar-track">
                <div 
                    className="usage-bar-fill"
                    style={{ 
                        width: `${percentage}%`,
                        backgroundColor: getBarColor()
                    }}
                />
            </div>
            
            {percentage >= 70 && (
                <button className="upgrade-prompt" onClick={onUpgrade}>
                    {percentage >= 100 ? '🚀 Upgrade to continue' : '⚡ Upgrade for more'}
                </button>
            )}
        </div>
    );
}


