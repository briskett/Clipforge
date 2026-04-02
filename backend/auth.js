const express = require('express');
const { supabase } = require('./supabase');

const router = express.Router();

// Auth middleware - verifies Supabase JWT token
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        // Verify the JWT with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            username: user.user_metadata?.username || user.email.split('@')[0]
        };
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ error: 'Authentication failed' });
    }
}

// Get current user info
router.get('/me', authMiddleware, async (req, res) => {
    try {
        // Get subscription info
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('tier, created_at')
            .eq('user_id', req.user.id)
            .single();

        res.json({
            success: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                username: req.user.username,
                tier: subscription?.tier || 'free',
                memberSince: subscription?.created_at
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

module.exports = { router, authMiddleware };
