const STORAGE_KEYS = {
    openai: 'clipforge_openai_key',
    elevenlabs: 'clipforge_elevenlabs_key',
};

export function getStoredApiKey(provider) {
    return localStorage.getItem(STORAGE_KEYS[provider]) || '';
}

export function hasStoredApiKey(provider) {
    return !!getStoredApiKey(provider);
}

export function saveStoredApiKey(provider, apiKey) {
    localStorage.setItem(STORAGE_KEYS[provider], apiKey);
}

export function removeStoredApiKey(provider) {
    localStorage.removeItem(STORAGE_KEYS[provider]);
}

export function getApiKeyHeaders() {
    const headers = {};
    const openaiKey = getStoredApiKey('openai');
    const elevenLabsKey = getStoredApiKey('elevenlabs');
    if (openaiKey) headers['X-OpenAI-Key'] = openaiKey;
    if (elevenLabsKey) headers['X-ElevenLabs-Key'] = elevenLabsKey;
    return headers;
}
