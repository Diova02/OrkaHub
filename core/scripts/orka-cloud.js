// =========================
// ORKA CLOUD — V3 (Analytics, Economy & Social)
// =========================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle&target=browser'

// 🔐 Configurações
const supabaseUrl = 'https://lvwlixmcgfuuiizeelmo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2d2xpeG1jZ2Z1dWlpemVlbG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTUwMzQsImV4cCI6MjA4MzQ3MTAzNH0.qa0nKUXewE0EqUePwfzQbBOaHypRqkhUxRnY5qgsDbo'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Estado Global da Aplicação
let state = {
    sessionId: null,
    userId: null,
    gameId: null,
    startTime: null,
    isActive: false,
    sessionSaved: false,
    // Cache do Perfil (Para acesso instantâneo na UI)
    profile: {
        nickname: null,
        bolo: 0,
        image: 'default_avatar.png',
        language: 'pt-BR'
    }
};

// Configurações
const BOUNCE_THRESHOLD = 5000; 
const INACTIVITY_LIMIT = 10 * 60 * 1000;
let inactivityTimer = null;
let bounceTimer = null;

// =========================
// 1. GESTÃO DE USUÁRIO E PERFIL
// =========================

async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        state.userId = session.user.id;
    } else {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) { console.error("OrkaAuth Error:", error); return null; }
        state.userId = data.user.id;
    }

    await ensureProfile(state.userId);
    return state.userId;
}

async function ensureProfile(uid) {
    // 1. Tenta carregar do banco
    const { data: remoteProfile } = await supabase
        .from('players')
        .select('nickname, bolo, profile_image, language')
        .eq('id', uid)
        .maybeSingle();

    // 2. Tenta carregar backup local (fallback)
    const localNick = localStorage.getItem('orka_nickname');
    const localLang = localStorage.getItem('orka_language') || navigator.language.split('-')[0]; // Detecta 'pt' ou 'en'

    if (!remoteProfile) {
        // CRIA NOVO PERFIL
        const newProfile = {
            id: uid,
            nickname: localNick || null,
            language: ['pt', 'en'].includes(localLang) ? localLang : 'pt', // Validação básica
            bolo: 0, // Default do banco
            profile_image: 'default_avatar.png'
        };

        await supabase.from('players').insert(newProfile);
        
        // Atualiza estado local
        state.profile = { ...state.profile, ...newProfile };
    } else {
        // PERFIL EXISTENTE: Sincroniza estado
        state.profile = {
            nickname: remoteProfile.nickname,
            bolo: remoteProfile.bolo,
            image: remoteProfile.profile_image,
            language: remoteProfile.language
        };

        // Atualiza Last Seen
        supabase.from('players').update({ last_seen_at: new Date() }).eq('id', uid);
    }
}

// =========================
// 2. ECONOMIA E CUSTOMIZAÇÃO (NOVO)
// =========================

// Adiciona (ou remove se negativo) Bolos de forma segura
async function addBolo(amount) {
    if (!state.userId) return;

    // Atualiza UI localmente instantaneamente (Otimismo)
    state.profile.bolo += amount;
    
    // Chama a função segura no banco
    const { error } = await supabase.rpc('add_bolo', { amount: amount });
    
    if (error) {
        console.error("Erro na transação:", error);
        state.profile.bolo -= amount; // Reverte se falhar
    } else {
        console.log(`OrkaEconomy: ${amount > 0 ? '+' : ''}${amount} Bolos`);
    }
}

async function setProfileImage(imageName) {
    state.profile.image = imageName;
    if (state.userId) {
        await supabase.from('players').update({ profile_image: imageName }).eq('id', state.userId);
    }
}

// =========================
// 3. INTERNACIONALIZAÇÃO (i18n)
// =========================

function getLanguage() {
    return state.profile.language || 'pt';
}

async function setLanguage(lang) {
    if (lang !== 'pt' && lang !== 'en') return; // Segurança básica
    
    state.profile.language = lang;
    localStorage.setItem('orka_language', lang); // Backup Local

    if (state.userId) {
        // Salva preferência na nuvem
        await supabase.from('players').update({ language: lang }).eq('id', state.userId);
    }
    
    // Dispara evento para a UI se atualizar (opcional)
    window.dispatchEvent(new CustomEvent('orka-lang-change', { detail: lang }));
}

// =========================
// 4. GESTÃO DE SESSÃO
// =========================

async function startSession(gameId) {
    state.gameId = gameId;
    state.startTime = Date.now();
    state.isActive = true;
    
    await initAuth(); // Carrega perfil e idioma antes de tudo

    state.sessionId = crypto.randomUUID(); 
    startInactivityMonitor();

    if (bounceTimer) clearTimeout(bounceTimer);
    bounceTimer = setTimeout(() => {
        if (state.isActive) persistSessionStart();
    }, BOUNCE_THRESHOLD);

    return state.sessionId;
}

async function persistSessionStart() {
    if (state.sessionSaved) return;
    
    const deviceInfo = {
        ua: navigator.userAgent,
        screen: `${window.screen.width}x${window.screen.height}`,
        mobile: /Mobi|Android/i.test(navigator.userAgent)
    };

    const { error } = await supabase.from('sessions').insert({
        id: state.sessionId,
        player_id: state.userId,
        game_id: state.gameId,
        started_at: new Date(state.startTime),
        platform_info: deviceInfo
    });

    if (!error) state.sessionSaved = true;
}

async function endSession(metadata = {}) {
    if (!state.sessionId) return;
    state.isActive = false;
    clearTimeout(bounceTimer);
    stopInactivityMonitor();

    const duration = Math.floor((Date.now() - state.startTime) / 1000);

    if (!state.sessionSaved && duration < (BOUNCE_THRESHOLD / 1000)) return;

    if (!state.sessionSaved) await persistSessionStart();

    await supabase.from('sessions').update({
        ended_at: new Date(),
        duration_seconds: duration,
        metadata: metadata
    }).eq('id', state.sessionId);

    state.sessionId = null;
}

// =========================
// 5. RASTREAMENTO E UTILITÁRIOS
// =========================

async function track(eventName, eventType = 'click', data = {}) {
    if (!state.sessionSaved && state.sessionId) await persistSessionStart();
    if (!state.sessionId || !state.userId) return;

    supabase.from('analytics_events').insert({
        session_id: state.sessionId,
        player_id: state.userId,
        event_name: eventName,
        event_type: eventType,
        event_data: data
    });
}

function startInactivityMonitor() {
    const resetTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            endSession({ reason: "inactivity_timeout" });
            window.location.href = '../../index.html'; 
        }, INACTIVITY_LIMIT);
    };
    window.onload = document.onmousemove = document.onkeydown = document.ontouchstart = document.onclick = resetTimer;
}

async function updateNickname(newNickname) {
    state.profile.nickname = newNickname;
    localStorage.setItem('orka_nickname', newNickname);
    if (state.userId) {
        await supabase.from('players').update({ nickname: newNickname }).eq('id', state.userId);
    }
}

// =========================
// EXPORTAÇÃO PÚBLICA
// =========================
export const OrkaCloud = {
    startSession,
    endSession,
    track,
    // Perfil & Economia
    getNickname: () => state.profile.nickname,
    updateNickname,
    getBolo: () => state.profile.bolo,
    addBolo, 
    getProfileImage: () => state.profile.image,
    setProfileImage,
    // Idioma
    getLanguage,
    setLanguage,
    // Utils
    getUserId: () => state.userId
};