import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './PricingModal.css';

const API_URL = 'http://localhost:5000';

export default function PricingModal({ isOpen, onClose, currentTier }) {
    const { session } = useAuth();
    const [tiers, setTiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(null);

    // Create axios instance with auth
    const api = axios.create({ baseURL: API_URL });
    api.interceptors.request.use((config) => {
        if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
        }
        return config;
    });

    useEffect(() => {
        if (isOpen) {
            fetchTiers();
        }
    }, [isOpen]);

    const fetchTiers = async () => {
        try {
            const response = await api.get('/subscription/tiers');
            setTiers(response.data.tiers);
        } catch (error) {
            console.error('Failed to fetch tiers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (tierId) => {
        if (tierId === 'free' || tierId === currentTier) return;
        
        setSubscribing(tierId);
        try {
            const response = await api.post('/stripe/create-checkout-session', {
                tierId
            });
            
            // Redirect to Stripe checkout
            window.location.href = response.data.url;
        } catch (error) {
            console.error('Failed to create checkout session:', error);
            alert(error.response?.data?.error || 'Failed to start checkout. Please try again.');
        } finally {
            setSubscribing(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="pricing-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>
                
                <div className="modal-header">
                    <h2>Upgrade Your Plan</h2>
                    <p>Get more video generations and unlock premium features</p>
                </div>

                {loading ? (
                    <div className="modal-loading">
                        <div className="spinner"></div>
                        <p>Loading plans...</p>
                    </div>
                ) : (
                    <div className="pricing-grid">
                        {tiers.map((tier) => (
                            <div 
                                key={tier.id}
                                className={`pricing-card ${tier.popular ? 'popular' : ''} ${currentTier === tier.id ? 'current' : ''}`}
                            >
                                {tier.popular && <div className="popular-badge">Most Popular</div>}
                                {currentTier === tier.id && <div className="current-badge">Current Plan</div>}
                                
                                <h3>{tier.name}</h3>
                                <div className="price">
                                    <span className="amount">
                                        {tier.price === 0 ? 'Free' : `$${(tier.price / 100).toFixed(2)}`}
                                    </span>
                                    {tier.price > 0 && <span className="period">/month</span>}
                                </div>
                                
                                <div className="generations">
                                    <strong>{tier.generationsPerMonth}</strong> videos/month
                                </div>
                                
                                <ul className="features-list">
                                    {tier.features.map((feature, idx) => (
                                        <li key={idx}>
                                            <span className="check">✓</span>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                                
                                <button
                                    className={`tier-btn ${currentTier === tier.id ? 'current' : ''}`}
                                    onClick={() => handleSubscribe(tier.id)}
                                    disabled={currentTier === tier.id || tier.id === 'free' || subscribing !== null}
                                >
                                    {subscribing === tier.id ? (
                                        <>
                                            <span className="btn-spinner small"></span>
                                            Processing...
                                        </>
                                    ) : currentTier === tier.id ? (
                                        'Current Plan'
                                    ) : tier.id === 'free' ? (
                                        'Free Forever'
                                    ) : (
                                        'Upgrade Now'
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="modal-footer">
                    <p>🔒 Secure payment powered by Stripe</p>
                    <p>Cancel anytime • No hidden fees</p>
                </div>
            </div>
        </div>
    );
}

