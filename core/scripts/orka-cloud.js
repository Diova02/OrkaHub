// =========================
// ORKA CLOUD V3 — Ultimate Core
// =========================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle&target=browser'

// 🔐 Configurações
const supabaseUrl = 'https://lvwlixmcgfuuiizeelmo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2d2xpeG1jZ2Z1dWlpemVlbG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTUwMzQsImV4cCI6MjA4MzQ3MTAzNH0.qa0nKUXewE0EqUePwfzQbBOaHypRqkhUxRnY5qgsDbo'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Estado Global
let state = {
    sessionId: null,
    userId: null,
    gameId: null,
    startTime: null,
    isActive: false,
    sessionSaved: false,
    profile: {
        nickname: null,
        bolo: 0,
        image: 'default',
        language: 'pt-BR'
    }
};

const BOUNCE_THRESHOLD = 5000; // 5s
const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10min
let timers = { inactivity: null, bounce: null };

// =========================
// 1. AUTH & PROFILE
// =========================
async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    state.userId = session ? session.user.id : (await supabase.auth.signInAnonymously()).data.user.id;
    await ensureProfile(state.userId);
    return state.userId;
}

async function ensureProfile(uid) {
    // Tenta Sync Remoto
    const { data: remote } = await supabase.from('players').select('*').eq('id', uid).maybeSingle();
    
    if (!remote) {
        // Cria Novo
        const localNick = localStorage.getItem('orka_nickname');
        const newProfile = { id: uid, nickname: localNick || null, language: 'pt-BR', bolo: 0, profile_image: 'default' };
        await supabase.from('players').insert(newProfile);
        Object.assign(state.profile, newProfile);
    } else {
        // Carrega Existente
        state.profile = { 
            nickname: remote.nickname, 
            bolo: remote.bolo, 
            image: remote.profile_image, 
            language: remote.language 
        };
        // Atualiza Last Seen
        supabase.from('players').update({ last_seen_at: new Date() }).eq('id', uid);
    }
}

// =========================
// 2. ECONOMIA & AVATAR
// =========================
async function addBolo(amount) {
    if (!state.userId) return;
    state.profile.bolo += amount; // Otimista
    const { error } = await supabase.rpc('add_bolo', { amount });
    if (error) state.profile.bolo -= amount; // Reverte erro
}

async function setProfileImage(imgName) {
    state.profile.image = imgName;
    if (state.userId) await supabase.from('players').update({ profile_image: imgName }).eq('id', state.userId);
}

// Retorna o caminho da imagem ou NULL (para usar icone)
function getAvatarUrl() {
    if (!state.profile.image || state.profile.image === 'default') return null;
    return `../../assets/pictures/${state.profile.image}`;
}

// =========================
// 3. SESSÃO & TRACKING
// =========================
async function startSession(gameId) {
    state.gameId = gameId;
    state.startTime = Date.now();
    state.isActive = true;
    
    await initAuth(); // Garante usuário
    
    state.sessionId = crypto.randomUUID();
    monitorInactivity();
    
    // Anti-Bounce: Salva após 5s
    if (timers.bounce) clearTimeout(timers.bounce);
    timers.bounce = setTimeout(() => {
        if (state.isActive) persistSession();
    }, BOUNCE_THRESHOLD);
    
    return state.sessionId;
}

async function persistSession() {
    if (state.sessionSaved) return;
    const info = { ua: navigator.userAgent, mobile: /Mobi|Android/i.test(navigator.userAgent) };
    
    const { error } = await supabase.from('sessions').insert({
        id: state.sessionId, player_id: state.userId, game_id: state.gameId,
        started_at: new Date(state.startTime), platform_info: info
    });
    if (!error) state.sessionSaved = true;
}

async function endSession(metadata = {}) {
    if (!state.sessionId) return;
    state.isActive = false;
    clearTimers();

    const duration = Math.floor((Date.now() - state.startTime) / 1000);
    
    // Se foi muito rápido e não salvou ainda, ignora (Bounce real)
    // A MENOS que tenha metadados (vitória/derrota), aí salvamos mesmo se for rápido
    const isImportant = Object.keys(metadata).length > 0;
    
    if (!state.sessionSaved && !isImportant && duration < 5) return;
    if (!state.sessionSaved) await persistSession();

    await supabase.from('sessions').update({
        ended_at: new Date(), duration_seconds: duration, metadata
    }).eq('id', state.sessionId);
    
    state.sessionId = null;
}

// =========================
// 4. ADS & EVENTS
// =========================
async function track(eventName, type = 'interaction', data = {}) {
    // Se interagiu, não é bounce. Salva a sessão se ainda não salvou.
    if (!state.sessionSaved && state.sessionId) await persistSession();
    
    if (state.sessionId && state.userId) {
        supabase.from('analytics_events').insert({
            session_id: state.sessionId, player_id: state.userId,
            event_name: eventName, event_type: type, event_data: data
        });
    }
}

// Helper para Ads (Prepara tracking automático)
function logAdImpression(adId, adType) {
    track('ad_impression', 'ad_impression', { ad_id: adId, ad_type: adType });
}
function logAdClick(adId, adType) {
    track('ad_click', 'ad_click', { ad_id: adId, ad_type: adType });
}

// =========================
// 5. UTILS
// =========================
function monitorInactivity() {
    const reset = () => {
        if (timers.inactivity) clearTimeout(timers.inactivity);
        timers.inactivity = setTimeout(() => {
            endSession({ reason: 'timeout' });
            window.location.href = '../../index.html';
        }, INACTIVITY_LIMIT);
    };
    ['mousemove','click','keydown','touchstart'].forEach(e => document.addEventListener(e, reset));
    reset();
}

function clearTimers() {
    clearTimeout(timers.bounce);
    clearTimeout(timers.inactivity);
}

// Export
export const OrkaCloud = {
    startSession, endSession, track,
    // Ads Helpers
    logAdImpression, logAdClick,
    // Profile
    getNickname: () => state.profile.nickname,
    updateNickname: async (n) => { state.profile.nickname=n; localStorage.setItem('orka_nickname',n); if(state.userId) await supabase.from('players').update({nickname:n}).eq('id',state.userId); },
    getBolo: () => state.profile.bolo,
    addBolo,
    getAvatarUrl, setProfileImage,
    // Lang
    getLanguage: () => state.profile.language,
    setLanguage: async (l) => { state.profile.language=l; localStorage.setItem('orka_language',l); if(state.userId) await supabase.from('players').update({language:l}).eq('id',state.userId); },
    // Core
    getUserId: () => state.userId
};