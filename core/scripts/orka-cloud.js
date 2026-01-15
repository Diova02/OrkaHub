// =========================
// ORKA CLOUD V3.1 — Ultimate Core
// =========================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle&target=browser'

const supabaseUrl = 'https://lvwlixmcgfuuiizeelmo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2d2xpeG1jZ2Z1dWlpemVlbG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTUwMzQsImV4cCI6MjA4MzQ3MTAzNH0.qa0nKUXewE0EqUePwfzQbBOaHypRqkhUxRnY5qgsDbo'

export const supabase = createClient(supabaseUrl, supabaseKey)

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

const BOUNCE_THRESHOLD = 5000;
const INACTIVITY_LIMIT = 10 * 60 * 1000;
let timers = { inactivity: null, bounce: null };

// =========================
// 1. AUTH & INIT (NOVO)
// =========================
async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    state.userId = session ? session.user.id : (await supabase.auth.signInAnonymously()).data.user.id;
    await ensureProfile(state.userId);
    return state.userId;
}

// Função leve apenas para carregar dados (Usada no Hub)
async function init() {
    await initAuth();
    return state.profile;
}

async function ensureProfile(uid) {
    const { data: remote } = await supabase.from('players').select('*').eq('id', uid).maybeSingle();
    
    if (!remote) {
        const localNick = localStorage.getItem('orka_nickname');
        const newProfile = { id: uid, nickname: localNick || null, language: 'pt-BR', bolo: 0, profile_image: 'default' };
        await supabase.from('players').insert(newProfile);
        Object.assign(state.profile, newProfile);
    } else {
        state.profile = { 
            nickname: remote.nickname, 
            bolo: remote.bolo, 
            image: remote.profile_image, 
            language: remote.language 
        };
        supabase.from('players').update({ last_seen_at: new Date() }).eq('id', uid);
    }
}

// =========================
// 2. ECONOMIA & RECOMPENSAS
// =========================
async function addBolo(amount) {
    if (!state.userId) return;
    state.profile.bolo += amount; 
    const { error } = await supabase.rpc('add_bolo', { amount });
    if (error) state.profile.bolo -= amount;
}

async function claimDailyReward(gameTag, amount = 1) {
    if (!state.userId) return false;
    const { data, error } = await supabase.rpc('claim_daily_reward', { game_tag: gameTag, amount });
    if (!error && data === true) { state.profile.bolo += amount; return true; }
    return false;
}

async function checkDailyClaimStatus(gameTag) {
    if (!state.userId) return false;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('daily_rewards').select('id').eq('player_id', state.userId).eq('game_id', gameTag).eq('reward_date', today).maybeSingle();
    return !!data;
}

async function setProfileImage(imgName) {
    state.profile.image = imgName;
    if (state.userId) await supabase.from('players').update({ profile_image: imgName }).eq('id', state.userId);
}

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
    await initAuth();
    state.sessionId = crypto.randomUUID();
    monitorInactivity();
    if (timers.bounce) clearTimeout(timers.bounce);
    timers.bounce = setTimeout(() => { if (state.isActive) persistSession(); }, BOUNCE_THRESHOLD);
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
    const isImportant = Object.keys(metadata).length > 0;
    if (!state.sessionSaved && !isImportant && duration < 5) return;
    if (!state.sessionSaved) await persistSession();
    await supabase.from('sessions').update({ ended_at: new Date(), duration_seconds: duration, metadata }).eq('id', state.sessionId);
    state.sessionId = null;
}

async function track(eventName, type = 'interaction', data = {}) {
    if (!state.sessionSaved && state.sessionId) await persistSession();
    if (state.sessionId && state.userId) {
        supabase.from('analytics_events').insert({
            session_id: state.sessionId, player_id: state.userId,
            event_name: eventName, event_type: type, event_data: data
        });
    }
}

// Helpers
function logAdImpression(adId, adType) { track('ad_impression', 'ad_impression', { ad_id: adId, ad_type: adType }); }
function logAdClick(adId, adType) { track('ad_click', 'ad_click', { ad_id: adId, ad_type: adType }); }

function monitorInactivity() {
    const reset = () => {
        if (timers.inactivity) clearTimeout(timers.inactivity);
        timers.inactivity = setTimeout(() => { endSession({ reason: 'timeout' }); window.location.href = '../../index.html'; }, INACTIVITY_LIMIT);
    };
    ['mousemove','click','keydown','touchstart'].forEach(e => document.addEventListener(e, reset));
    reset();
}

function clearTimers() { clearTimeout(timers.bounce); clearTimeout(timers.inactivity); }

export const OrkaCloud = {
    init, // <--- NOVO
    startSession, endSession, track,
    logAdImpression, logAdClick,
    getNickname: () => state.profile.nickname,
    updateNickname: async (n) => { state.profile.nickname=n; localStorage.setItem('orka_nickname',n); if(state.userId) await supabase.from('players').update({nickname:n}).eq('id',state.userId); },
    getBolo: () => state.profile.bolo,
    addBolo, claimDailyReward, checkDailyClaimStatus,
    getAvatarUrl, setProfileImage,
    getLanguage: () => state.profile.language,
    setLanguage: async (l) => { state.profile.language=l; localStorage.setItem('orka_language',l); if(state.userId) await supabase.from('players').update({language:l}).eq('id',state.userId); },
    getUserId: () => state.userId
};