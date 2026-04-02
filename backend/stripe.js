const express = require('express');
const router = express.Router();
const { supabase } = require('./supabase');

// Stripe setup - will be initialized when STRIPE_SECRET_KEY is set
let stripe = null;

if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized');
} else {
    console.log('⚠️ Stripe not configured - set STRIPE_SECRET_KEY in .env');
}

const { TIERS, updateUserSubscription } = require('./subscriptions');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Create checkout session for subscription
router.post('/create-checkout-session', async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { tierId } = req.body;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const tier = TIERS[tierId];
    if (!tier || tier.id === 'free') {
        return res.status(400).json({ error: 'Invalid tier selected' });
    }

    if (!tier.stripePriceId) {
        return res.status(400).json({ 
            error: 'Stripe price not configured for this tier',
            hint: 'Set STRIPE_' + tierId.toUpperCase() + '_PRICE_ID in your .env file'
        });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            customer_email: userEmail,
            metadata: {
                userId,
                tierId
            },
            line_items: [
                {
                    price: tier.stripePriceId,
                    quantity: 1,
                },
            ],
            success_url: `${FRONTEND_URL}/?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/?subscription=cancelled`,
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        console.error('Stripe checkout error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// Create billing portal session (for managing subscription)
router.post('/create-portal-session', async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }

    const userId = req.user?.id;
    
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        // Get user's Stripe customer ID from Supabase
        const { data: subscription, error } = await supabase
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', userId)
            .single();

        if (error || !subscription?.stripe_customer_id) {
            return res.status(400).json({ error: 'No active subscription found' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: `${FRONTEND_URL}/`,
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        console.error('Stripe portal error:', error);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

// Webhook to handle Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('⚠️ Stripe webhook secret not configured');
        return res.status(500).json({ error: 'Webhook not configured' });
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const { userId, tierId } = session.metadata;
            
            console.log(`✅ Subscription created for user ${userId} - Tier: ${tierId}`);
            
            // Update user's subscription in Supabase
            await updateUserSubscription(
                userId,
                tierId,
                session.customer,
                session.subscription
            );
            break;
        }

        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            console.log(`📝 Subscription updated: ${subscription.id}`);
            break;
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            console.log(`❌ Subscription cancelled: ${subscription.id}`);
            
            // Find user by stripe_subscription_id and downgrade to free
            const { data: sub } = await supabase
                .from('subscriptions')
                .select('user_id, stripe_customer_id')
                .eq('stripe_subscription_id', subscription.id)
                .single();
            
            if (sub) {
                await updateUserSubscription(sub.user_id, 'free', sub.stripe_customer_id, null);
                console.log(`👤 User ${sub.user_id} downgraded to free tier`);
            }
            break;
        }

        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            console.log(`⚠️ Payment failed for invoice: ${invoice.id}`);
            break;
        }

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

module.exports = { router };
