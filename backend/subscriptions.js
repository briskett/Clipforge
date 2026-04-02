const express = require('express');
const { supabase } = require('./supabase');

const router = express.Router();

// Subscription tiers configuration
const TIERS = {
    free: {
        id: 'free',
        name: 'Free',
        price: 0,
        generationsPerMonth: 2,
        features: ['2 videos per month', 'Basic voices', 'Standard quality'],
        stripePriceId: null
    },
    starter: {
        id: 'starter',
        name: 'Starter',
        price: 999, // cents
        generationsPerMonth: 15,
        features: ['15 videos per month', 'All voices', 'HD quality', 'Priority processing'],
        stripePriceId: process.env.STRIPE_STARTER_PRICE_ID
    },
    creator: {
        id: 'creator',
        name: 'Creator',
        price: 2499, // cents
        generationsPerMonth: 50,
        features: ['50 videos per month', 'All voices', 'HD quality', 'Priority processing', 'Custom backgrounds'],
        stripePriceId: process.env.STRIPE_CREATOR_PRICE_ID,
        popular: true
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 4999, // cents
        generationsPerMonth: 150,
        features: ['150 videos per month', 'All voices', 'HD quality', 'Priority processing', 'Custom backgrounds', 'API access'],
        stripePriceId: process.env.STRIPE_PRO_PRICE_ID
    }
};

// Get current month string (e.g., '2026-01')
function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Get user's subscription tier
async function getUserTier(userId) {
    const { data, error } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .single();
    
    if (error || !data) return 'free';
    return data.tier;
}

// Get user's usage for current month
async function getUserMonthlyUsage(userId) {
    const month = getCurrentMonth();
    
    const { data, error } = await supabase
        .from('monthly_usage')
        .select('generations')
        .eq('user_id', userId)
        .eq('month', month)
        .single();
    
    if (error || !data) return 0;
    return data.generations;
}

// Increment user's generation count
async function incrementUserGeneration(userId) {
    const month = getCurrentMonth();
    
    // Try to update existing record
    const { data: existing } = await supabase
        .from('monthly_usage')
        .select('id, generations')
        .eq('user_id', userId)
        .eq('month', month)
        .single();
    
    if (existing) {
        // Update existing record
        const { data, error } = await supabase
            .from('monthly_usage')
            .update({ 
                generations: existing.generations + 1,
                last_generation_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select('generations')
            .single();
        
        if (error) throw error;
        return data.generations;
    } else {
        // Insert new record
        const { data, error } = await supabase
            .from('monthly_usage')
            .insert({
                user_id: userId,
                month: month,
                generations: 1,
                last_generation_at: new Date().toISOString()
            })
            .select('generations')
            .single();
        
        if (error) throw error;
        return data.generations;
    }
}

// Check if user can generate
async function canGenerate(userId) {
    const tier = await getUserTier(userId);
    const tierConfig = TIERS[tier];
    const used = await getUserMonthlyUsage(userId);
    
    return {
        canGenerate: used < tierConfig.generationsPerMonth,
        used,
        limit: tierConfig.generationsPerMonth,
        remaining: Math.max(0, tierConfig.generationsPerMonth - used),
        tier,
        tierName: tierConfig.name
    };
}

// Middleware to check generation quota
async function checkQuota(req, res, next) {
    const userId = req.user?.id;
    
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
        const quotaStatus = await canGenerate(userId);
        
        if (!quotaStatus.canGenerate) {
            return res.status(403).json({
                error: 'Generation limit reached',
                message: `You've used all ${quotaStatus.limit} generations for this month. Upgrade your plan for more!`,
                ...quotaStatus
            });
        }
        
        req.quota = quotaStatus;
        next();
    } catch (error) {
        console.error('Quota check error:', error);
        res.status(500).json({ error: 'Failed to check quota' });
    }
}

// Update user's subscription tier
async function updateUserSubscription(userId, tier, stripeCustomerId = null, stripeSubscriptionId = null) {
    const { data, error } = await supabase
        .from('subscriptions')
        .update({
            tier,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

// ROUTES

// Get available tiers
router.get('/tiers', (req, res) => {
    const tiersPublic = Object.values(TIERS).map(tier => ({
        id: tier.id,
        name: tier.name,
        price: tier.price,
        priceDisplay: tier.price === 0 ? 'Free' : `$${(tier.price / 100).toFixed(2)}/mo`,
        generationsPerMonth: tier.generationsPerMonth,
        features: tier.features,
        popular: tier.popular || false
    }));
    
    res.json({ success: true, tiers: tiersPublic });
});

// Get user's subscription status and usage
router.get('/status', async (req, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
        const quotaStatus = await canGenerate(userId);
        const tier = TIERS[quotaStatus.tier];
        
        res.json({
            success: true,
            subscription: {
                tier: quotaStatus.tier,
                tierName: tier.name,
                price: tier.price,
                features: tier.features
            },
            usage: {
                used: quotaStatus.used,
                limit: quotaStatus.limit,
                remaining: quotaStatus.remaining,
                percentUsed: Math.round((quotaStatus.used / quotaStatus.limit) * 100)
            },
            canGenerate: quotaStatus.canGenerate
        });
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ error: 'Failed to get subscription status' });
    }
});

module.exports = {
    router,
    TIERS,
    checkQuota,
    canGenerate,
    incrementUserGeneration,
    updateUserSubscription,
    getUserTier
};
