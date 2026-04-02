import React from 'react';
import { Link } from 'react-router-dom';
import '../stylesheets/legal.css';

export default function Privacy() {
    return (
        <div className="legal-container">
            <div className="legal-wrapper">
                {/* Header */}
                <div className="legal-header">
                    <Link to="/" className="back-to-home">
                        <span>←</span> Back to ClipForge
                    </Link>
                    <h1>Privacy Policy</h1>
                    <p className="last-updated">Last Updated: January 5, 2026</p>
                </div>

                {/* Content */}
                <div className="legal-content">
                    <section>
                        <h2>1. Introduction</h2>
                        <p>
                            ClipForge ("we," "our," or "us") respects your privacy and is committed to 
                            protecting your personal data. This Privacy Policy explains how we collect, 
                            use, disclose, and safeguard your information when you use our Service.
                        </p>
                    </section>

                    <section>
                        <h2>2. Information We Collect</h2>
                        
                        <h3>2.1 Information You Provide</h3>
                        <ul>
                            <li><strong>Account Information:</strong> Email address, username, and password when you create an account</li>
                            <li><strong>Content:</strong> Stories you edit or create, voice selections, and video preferences</li>
                            <li><strong>Communications:</strong> Any messages or feedback you send to us</li>
                        </ul>

                        <h3>2.2 Information Collected Automatically</h3>
                        <ul>
                            <li><strong>Usage Data:</strong> Information about how you use the Service, including features accessed and actions taken</li>
                            <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
                            <li><strong>Log Data:</strong> IP address, access times, and referring URLs</li>
                        </ul>
                    </section>

                    <section>
                        <h2>3. How We Use Your Information</h2>
                        <p>We use the collected information to:</p>
                        <ul>
                            <li>Provide, maintain, and improve the Service</li>
                            <li>Process your video generation requests</li>
                            <li>Create and manage your account</li>
                            <li>Communicate with you about the Service</li>
                            <li>Ensure security and prevent fraud</li>
                            <li>Comply with legal obligations</li>
                            <li>Analyze usage patterns to improve user experience</li>
                        </ul>
                    </section>

                    <section>
                        <h2>4. Third-Party Services</h2>
                        <p>
                            ClipForge uses third-party services to provide its functionality. These services 
                            may collect and process your data according to their own privacy policies:
                        </p>
                        <ul>
                            <li><strong>OpenAI:</strong> For AI story generation and transcription services</li>
                            <li><strong>ElevenLabs:</strong> For text-to-speech voice synthesis</li>
                        </ul>
                        <p>
                            We encourage you to review the privacy policies of these services to understand 
                            how they handle your data.
                        </p>
                    </section>

                    <section>
                        <h2>5. Data Storage and Security</h2>
                        <p>
                            We implement appropriate technical and organizational security measures to protect 
                            your personal data against unauthorized access, alteration, disclosure, or destruction.
                        </p>
                        <ul>
                            <li>Passwords are securely hashed using industry-standard algorithms</li>
                            <li>Authentication tokens are encrypted and have limited validity</li>
                            <li>Generated videos are stored temporarily and may be deleted periodically</li>
                        </ul>
                    </section>

                    <section>
                        <h2>6. Data Retention</h2>
                        <p>We retain your data for as long as necessary to:</p>
                        <ul>
                            <li>Provide you with the Service</li>
                            <li>Comply with legal obligations</li>
                            <li>Resolve disputes and enforce agreements</li>
                        </ul>
                        <p>
                            Generated video content may be automatically deleted after a period of inactivity 
                            to manage storage resources.
                        </p>
                    </section>

                    <section>
                        <h2>7. Your Rights</h2>
                        <p>Depending on your location, you may have the following rights:</p>
                        <ul>
                            <li><strong>Access:</strong> Request a copy of your personal data</li>
                            <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                            <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                            <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                            <li><strong>Objection:</strong> Object to certain processing of your data</li>
                        </ul>
                        <p>
                            To exercise these rights, please contact us using the information provided below.
                        </p>
                    </section>

                    <section>
                        <h2>8. Cookies and Tracking</h2>
                        <p>
                            We use local storage and session storage in your browser to maintain your 
                            authentication state. We do not use third-party tracking cookies for advertising purposes.
                        </p>
                    </section>

                    <section>
                        <h2>9. Children's Privacy</h2>
                        <p>
                            ClipForge is not intended for use by children under the age of 13. We do not 
                            knowingly collect personal information from children under 13. If you believe 
                            a child has provided us with personal information, please contact us immediately.
                        </p>
                    </section>

                    <section>
                        <h2>10. International Data Transfers</h2>
                        <p>
                            Your information may be transferred to and processed in countries other than 
                            your country of residence. These countries may have different data protection 
                            laws. By using the Service, you consent to such transfers.
                        </p>
                    </section>

                    <section>
                        <h2>11. Changes to This Policy</h2>
                        <p>
                            We may update this Privacy Policy from time to time. We will notify you of 
                            any significant changes by posting the new Privacy Policy on this page and 
                            updating the "Last Updated" date.
                        </p>
                    </section>

                    <section>
                        <h2>12. Contact Us</h2>
                        <p>
                            If you have questions or concerns about this Privacy Policy or our data practices, 
                            please contact us at:
                        </p>
                        <p className="contact-info">
                            <strong>Email:</strong> privacy@clipforge.app
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="legal-footer">
                    <Link to="/terms">Terms of Service</Link>
                    <span className="footer-dot">•</span>
                    <Link to="/login">Sign In</Link>
                    <span className="footer-dot">•</span>
                    <Link to="/signup">Create Account</Link>
                </div>
            </div>
        </div>
    );
}

