const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('⚠️ Missing Supabase environment variables!');
    console.error('Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
}

// Service role client - has admin access, bypasses RLS
// ONLY use this on the backend, never expose the service key to frontend
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

module.exports = { supabase };


