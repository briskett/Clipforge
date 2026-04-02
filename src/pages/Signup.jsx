import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../stylesheets/auth.css';

export default function Signup() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const validateForm = () => {
        if (!formData.username.trim()) {
            setError('Username is required');
            return false;
        }
        if (formData.username.length < 3) {
            setError('Username must be at least 3 characters');
            return false;
        }
        if (!formData.email.trim()) {
            setError('Email is required');
            return false;
        }
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return false;
        }
        if (!agreedToTerms) {
            setError('You must agree to the Terms of Service and Privacy Policy');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!validateForm()) return;

        setLoading(true);

        try {
            const data = await register(formData.email, formData.password, formData.username, agreedToTerms);
            
            // Check if email confirmation is required
            if (data.user && !data.session) {
                setSuccess('Account created! Please check your email to confirm your account.');
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(err.message || 'Failed to create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Password strength indicator
    const getPasswordStrength = () => {
        const password = formData.password;
        if (!password) return { level: 0, text: '', color: '' };
        
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        if (strength <= 2) return { level: strength, text: 'Weak', color: 'var(--danger)' };
        if (strength <= 3) return { level: strength, text: 'Fair', color: 'var(--warning)' };
        if (strength <= 4) return { level: strength, text: 'Good', color: '#22c55e' };
        return { level: strength, text: 'Strong', color: 'var(--success)' };
    };

    const passwordStrength = getPasswordStrength();

    return (
        <div className="auth-container">
            <div className="auth-wrapper">
                {/* Logo */}
                <div className="auth-header">
                    <h1 className="logo">
                        <span className="logo-icon">🎬</span>
                        ClipForge
                    </h1>
                    <p className="auth-tagline">Create your account and start making viral content.</p>
                </div>

                {/* Signup Form */}
                <div className="auth-card">
                    <h2>Create Account</h2>
                    
                    {error && (
                        <div className="auth-error">
                            <span className="error-icon">⚠️</span>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="auth-success">
                            <span className="success-icon">✅</span>
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <div className="input-wrapper">
                                <span className="input-icon">👤</span>
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    placeholder="Your display name"
                                    required
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <div className="input-wrapper">
                                <span className="input-icon">📧</span>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="you@example.com"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <div className="input-wrapper">
                                <span className="input-icon">🔒</span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="At least 8 characters"
                                    required
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                            {formData.password && (
                                <div className="password-strength">
                                    <div className="strength-bars">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div 
                                                key={i}
                                                className={`strength-bar ${i <= passwordStrength.level ? 'active' : ''}`}
                                                style={{ backgroundColor: i <= passwordStrength.level ? passwordStrength.color : '' }}
                                            />
                                        ))}
                                    </div>
                                    <span style={{ color: passwordStrength.color }}>{passwordStrength.text}</span>
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <div className="input-wrapper">
                                <span className="input-icon">🔒</span>
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Confirm your password"
                                    required
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                <span className="input-hint error">Passwords don't match</span>
                            )}
                            {formData.confirmPassword && formData.password === formData.confirmPassword && (
                                <span className="input-hint success">✓ Passwords match</span>
                            )}
                        </div>

                        {/* Terms & Privacy Checkbox */}
                        <div className="terms-checkbox">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                />
                                <span className="checkmark"></span>
                                <span className="checkbox-text">
                                    I agree to the{' '}
                                    <Link to="/terms" target="_blank">Terms of Service</Link>
                                    {' '}and{' '}
                                    <Link to="/privacy" target="_blank">Privacy Policy</Link>
                                </span>
                            </label>
                        </div>

                        <button 
                            type="submit" 
                            className="auth-submit-btn"
                            disabled={loading || !agreedToTerms}
                        >
                            {loading ? (
                                <>
                                    <span className="btn-spinner"></span>
                                    Creating account...
                                </>
                            ) : (
                                <>Create Account</>
                            )}
                        </button>
                    </form>

                    <div className="auth-divider">
                        <span>or</span>
                    </div>

                    <p className="auth-switch">
                        Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                </div>

                {/* Footer */}
                <div className="auth-footer">
                    <Link to="/terms">Terms of Service</Link>
                    <span className="footer-dot">•</span>
                    <Link to="/privacy">Privacy Policy</Link>
                </div>
            </div>
        </div>
    );
}
