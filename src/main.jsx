import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import App from './App';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import './stylesheets/app.css';

// Protected Route wrapper component
function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();
    
    if (loading) {
        return (
            <div className="auth-loading">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }
    
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    
    return children;
}

// Public Route - redirects to app if already logged in
function PublicRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();
    
    if (loading) {
        return (
            <div className="auth-loading">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }
    
    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }
    
    return children;
}

function AppRoutes() {
    return (
        <Routes>
            {/* Public routes */}
            <Route path="/login" element={
                <PublicRoute>
                    <Login />
                </PublicRoute>
            } />
            <Route path="/signup" element={
                <PublicRoute>
                    <Signup />
                </PublicRoute>
            } />
            
            {/* Legal pages - always accessible */}
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            
            {/* Protected routes */}
            <Route path="/" element={
                <ProtectedRoute>
                    <App />
                </ProtectedRoute>
            } />
            
            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

const root = createRoot(document.getElementById('root'));
root.render(
    <BrowserRouter>
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    </BrowserRouter>
);
