// =================================================================
//  ORKA CLOUD V4.0 — Modular Hub Edition
//  Refatorado para Segurança, Organização e Robustez
// =================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle&target=browser'

// ⚠️ IMPORTANTE: Configure o RLS (Row Level Security) no Supabase para proteger estes dados.
const CONFIG = {
    url: 'https://lvwlixmcgfuuiizeelmo.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2d2xpeG1jZ2Z1dWlpemVlbG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTUwMzQsImV4cCI6MjA4MzQ3MTAzNH0.qa0nKUXewE0EqUePwfzQbBOaHypRqkhUxRnY5qgsDbo',
    bounceThreshold: 5000,      // Tempo mínimo para considerar uma sessão válida
    inactivityLimit: 600000,    // 10 minutos
    defaultLang: 'pt-BR'
};

export const supabase = createClient(CONFIG.url, CONFIG.key);

// --- ESTADO LOCAL (CACHE) ---
let state = {
    // Sessão
    sessionId: null,
    gameId: null,
    startTime: null,
    isActive: false,
    sessionSaved: false,
    authPromise: null, // Controle de Race Condition

    // Usuário
    userId: null,
    email: null,
    existsOnDB: false,
    profile: {
        nickname: null,
        bolo: 0,
        image: 'default',
        language: CONFIG.defaultLang,
        is_registered: false,
        role: 'user',
        inventory: { avatars: ['default'] }
    }
};

let timers = { inactivity: null, bounce: null };


// =================================================================
//  REGION 1: AUTENTICAÇÃO & INICIALIZAÇÃO
// =================================================================

// Monitora mudanças de estado (ex: login em outra aba ou logout)
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && state.userId && session?.user?.id !== state.userId) {
        console.log("🔄 Usuário alterado. Recarregando página...");
        window.location.reload();
    }
    if (event === 'SIGNED_OUT') {
        window.location.reload();
    }
});

async function init() {
    await initAuth();
    return state.profile;
}

async function initAuth() {
    // Verifica sessão existente
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        state.userId = session.user.id;
        state.email = session.user.email;
    } else {
        // Login Anônimo (Transparente)
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) console.error("Erro no Login Anônimo:", error);
        state.userId = data?.user?.id;
        state.email = null;
    }
    
    await _ensureProfile(state.userId);
    return state.userId;
}

// --- CONTA & REGISTRO ---

async function registerAccount(email, password) {
    if (!state.userId) return { error: "Sem conexão." };

    // Tenta vincular o email à conta anônima atual
    const { error } = await supabase.auth.updateUser({ email, password });

    if (error) return { error: _translateAuthError(error.message) };

    // Se sucesso, marca como registrado e dá bônus
    if (!state.profile.is_registered) {
        await supabase.from('players').update({ is_registered: true }).eq('id', state.userId);
        await addBolo(5); // 🎁 Bônus de boas-vindas
        state.profile.is_registered = true;
        return { success: true, bonus: true };
    }
    return { success: true, bonus: false };
}

async function loginAccount(email, password) {
    // Login substitui a sessão atual
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: _translateAuthError(error.message) };
    return { success: true };
}

async function logout() {
    await supabase.auth.signOut();
}

// Helpers de Auth
function _translateAuthError(msg) {
    if (msg.includes("already registered")) return "Este email já tem conta.";
    if (msg.includes("Invalid login")) return "Email ou senha incorretos.";
    if (msg.includes("password")) return "Senha muito fraca (min 6 dígitos).";
    return msg;
}

async function _ensureProfile(uid) {
    if (!uid) return;

    // 1. Tenta buscar no banco (LEITURA)
    const { data: remote } = await supabase.from('players').select('*').eq('id', uid).maybeSingle();
    
    if (remote) {
        // Se achou, ótimo. Carrega e marca que existe.
        state.existsOnDB = true;
        state.profile = { 
            nickname: remote.nickname, 
            bolo: remote.bolo, 
            image: remote.profile_image, 
            language: remote.language,
            is_registered: remote.is_registered,
            role: remote.role || 'user',
            inventory: remote.inventory || { avatars: ['default'] }
        };
        // Update leve de "visto por último" (não cria usuário novo, só atualiza quem existe)
        supabase.from('players').update({ last_seen_at: new Date() }).eq('id', uid);
    } else {
        // 2. Se NÃO achou, NÃO CRIA NADA. Apenas configura a memória local.
        state.existsOnDB = false;
        const localNick = localStorage.getItem('orka_nickname');
        // Mantém os defaults definidos no state.profile
        if (localNick) state.profile.nickname = localNick;
    }
}

// NOVA FUNÇÃO ÚNICA: Chama isso quando o usuário fizer algo importante
async function _syncUser() {
    // Se já existe no banco OU não temos ID, não faz nada
    if (state.existsOnDB || !state.userId) return;

    const newProfile = { 
        id: state.userId, 
        nickname: state.profile.nickname, 
        language: state.profile.language || 'pt-BR', 
        bolo: state.profile.bolo || 0, 
        profile_image: state.profile.image || 'default',
        inventory: state.profile.inventory
    };
    
    // Agora sim, CRIA o registro
    const { error } = await supabase.from('players').insert(newProfile);
    
    if (!error) {
        state.existsOnDB = true;
        console.log("👤 Perfil anônimo criado no DB.");
    }
}

// =================================================================
//  REGION 2: GAMEPLAY (SAVES & LEADERBOARD)
// =================================================================

/**
 * Carrega o save do jogo.
 * @param {string} gameId - ID do jogo (ex: 'orka-zoo')
 * @param {object} defaultState - Estado padrão caso não exista save (Otimização UX)
 */
async function loadGameSave(gameId, defaultState = null) {
    if (!state.userId) return defaultState;

    try {
        const { data } = await supabase.from('game_saves')
            .select('save_data')
            .eq('player_id', state.userId)
            .eq('game_id', gameId)
            .maybeSingle();

        if (data) {
            console.log(`☁️ Save carregado: ${gameId}`);
            return data.save_data; 
        }
    } catch (e) {
        console.warn("⚠️ Falha ao buscar save:", e);
    }
    return defaultState;
}

async function saveGameProgress(gameId, dataObject) {
    if (!state.userId) return;

    // --- FIX DA PARAFERNALHA ---
    // Se o usuário ainda não existe no DB (Lazy Load), cria ele AGORA antes de salvar o jogo
    if (state.existsOnDB === false) { 
        console.log("👤 Lazy Load: Criando usuário no DB antes de salvar...");
        await _syncUser(); 
    }
    // ---------------------------

    const { error } = await supabase.from('game_saves').upsert({
        player_id: state.userId,
        game_id: gameId,
        save_data: dataObject,
        updated_at: new Date()
    });

    if (error) console.error(`🚨 Erro ao salvar ${gameId}:`, error.message);
    else console.log(`☁️ Progresso salvo: ${gameId}`);
}

async function getLeaderboard(gameId, dateObj = new Date()) {
    const dateStr = dateObj.toISOString().split('T')[0];
    
    const { data, error } = await supabase
        .from('leaderboards')
        .select(`score, player_id, players(nickname, profile_image)`) 
        .eq('game_id', gameId)
        .eq('played_at', dateStr)
        .order('score', { ascending: true }) 
        .limit(10);

    if (error) {
        console.error("Erro Leaderboard:", error);
        return [];
    }
    
    return data.map(entry => ({
        nickname: entry.players?.nickname || 'Anônimo',
        avatar: _resolveAvatarUrl(entry.players?.profile_image), 
        score: entry.score,
        isMe: entry.player_id === state.userId
    }));
}

async function submitScore(gameId, score, dateObj = new Date()) {
    if (!state.userId) await initAuth();
    
    // --- FIX DA PARAFERNALHA ---
    if (state.existsOnDB === false) await _syncUser();
    // ---------------------------

    const dateStr = dateObj.toISOString().split('T')[0];
    
    // ... resto da função submitScore igual ...
    const { error } = await supabase.from('leaderboards').upsert({ 
        game_id: gameId, player_id: state.userId, score: score, played_at: dateStr
    }, { onConflict: 'game_id, player_id, played_at' });
    
    if (error) return { error: error.message };
    return { success: true, newRecord: true };
}


// =================================================================
//  REGION 3: ECONOMIA & LOJA (SECURE)
// =================================================================

async function addBolo(amount) {
    if (!state.userId) return;
    state.profile.bolo += amount; // Atualização Otimista UI
    const { error } = await supabase.rpc('add_bolo', { amount });
    if (error) state.profile.bolo -= amount; // Reverte se falhar
}

/**
 * Compra segura via RPC.
 * Requer função SQL 'buy_item' no Supabase.
 */
async function unlockItem(itemId, type = 'avatars', cost = 0) {
    if (!state.userId) return false;
    await _syncUser();

    // 1. Pré-cheque local (UX rápida)
    if (state.profile.bolo < cost) return false;
    if (_hasItemLocal(itemId, type)) return true;

    // 2. Execução Segura no Servidor
    // Você precisa criar essa RPC no SQL Editor do Supabase
    const { data, error } = await supabase.rpc('buy_item', { 
        item_id: itemId, 
        item_type: type, 
        item_cost: cost 
    });

    if (!error && data === true) {
        // Sucesso: Atualiza estado local
        state.profile.bolo -= cost;
        if (!state.profile.inventory[type]) state.profile.inventory[type] = [];
        state.profile.inventory[type].push(itemId);
        return true;
    }

    console.error("Erro na compra:", error);
    return false;
}

function hasItem(itemId, type = 'avatars') {
    return _hasItemLocal(itemId, type);
}

function _hasItemLocal(itemId, type) {
    const list = state.profile.inventory?.[type] || [];
    return list.includes(itemId);
}

async function claimDailyReward(gameTag, amount = 1) {
    if (!state.userId) return false;
    const { data, error } = await supabase.rpc('claim_daily_reward', { game_tag: gameTag, amount });
    if (!error && data === true) { 
        state.profile.bolo += amount; 
        return true; 
    }
    return false;
}

async function checkDailyClaimStatus(gameTag) {
    if (!state.userId) return false;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('daily_rewards')
        .select('id')
        .eq('player_id', state.userId)
        .eq('game_id', gameTag)
        .eq('reward_date', today)
        .maybeSingle();
    return !!data;
}

// =================================================================
//  REGION 4: SESSÃO & ANALYTICS
// =================================================================

async function startSession(gameId) {
    state.gameId = gameId;
    state.startTime = Date.now();
    state.isActive = true;
    state.sessionId = crypto.randomUUID();
    console.log(`🚀 Sessão iniciada: ${state.sessionId}`);

    initAuth(); // Async, não bloqueia o jogo
    
    _monitorInactivity();
    if (timers.bounce) clearTimeout(timers.bounce);
    
    // Só salva a sessão após X segundos (evita bounce rate alto no banco)
    timers.bounce = setTimeout(() => { 
        if (state.isActive) _persistSession(); 
    }, CONFIG.bounceThreshold);
    
    return state.sessionId;
}

async function endSession(metadata = {}) {
    if (!state.sessionId) return;
    state.isActive = false;
    _clearTimers();
    
    const duration = Math.floor((Date.now() - state.startTime) / 1000);
    const isImportant = Object.keys(metadata).length > 0;
    
    // Ignora sessões muito curtas irrelevantes
    if (!state.sessionSaved && !isImportant && duration < 5) return;
    
    if (!state.sessionSaved) await _persistSession();
    
    await supabase.from('sessions').update({ 
        ended_at: new Date(), 
        duration_seconds: duration, 
        metadata 
    }).eq('id', state.sessionId);
}

async function _persistSession() {
    if (state.sessionSaved) return;
    if (!state.userId && state.authPromise) state.authPromise;
    await _syncUser();

    const info = { ua: navigator.userAgent, mobile: /Mobi|Android/i.test(navigator.userAgent) };
    const { error } = await supabase.from('sessions').insert({
        id: state.sessionId, 
        player_id: state.userId, 
        game_id: state.gameId,
        started_at: new Date(state.startTime), 
        platform_info: info
    });
    
    if (!error) state.sessionSaved = true;
}

async function track(eventName, type = 'interaction', data = {}) {
    // Força persistência da sessão se o evento ocorrer antes do Bounce Check
    if (!state.sessionSaved && state.sessionId) await _persistSession();

    if (state.sessionId && state.userId) {
        supabase.from('analytics_events').insert({
            session_id: state.sessionId,
            player_id: state.userId,
            event_name: eventName,
            event_type: type,
            event_data: data
        }).then(({ error }) => {
            if (error) console.error("Track error:", error.message);
        });
    }
}

// =================================================================
//  REGION 5: UTILITÁRIOS & HELPERS
// =================================================================

function _monitorInactivity() {
    const reset = () => {
        if (timers.inactivity) clearTimeout(timers.inactivity);
        timers.inactivity = setTimeout(() => { 
            endSession({ reason: 'timeout' }); 
            window.location.href = '../../index.html'; // Opcional: Redireciona
        }, CONFIG.inactivityLimit);
    };
    ['mousemove','click','keydown','touchstart'].forEach(e => document.addEventListener(e, reset));
    reset();
}

function _clearTimers() { clearTimeout(timers.bounce); clearTimeout(timers.inactivity); }

function _resolveAvatarUrl(imgName) {
    const slug = imgName || 'default';
    return `../../assets/avatars/${slug}.png`;
}

// =================================================================
//  EXPORTS (PUBLIC API)
// =================================================================

export const OrkaCloud = {
    // Sistema
    init,
    
    // Auth
    registerAccount, loginAccount, logout, 
    getUserId: () => state.userId,
    getEmail: () => state.email,
    isRegistered: () => state.profile.is_registered,
    
    // Perfil
    getNickname: () => state.profile.nickname,
    updateNickname: async (n) => { 
        state.profile.nickname = n; 
        localStorage.setItem('orka_nickname', n); 
        if(state.userId) { 
            await _syncUser();
            await supabase.from('players').update({nickname:n}).eq('id',state.userId);
        } 
    },
    getRole: () => state.profile.role,

    getLanguage: () => state.profile.language,
    setLanguage: async (l) => { 
        state.profile.language = l; 
        localStorage.setItem('orka_language', l); 
        if(state.userId) await supabase.from('players').update({language:l}).eq('id',state.userId); 
    },
    getAvatarUrl: () => _resolveAvatarUrl(state.profile.image),
    setProfileImage: async (img) => {
        state.profile.image = img;
        if(state.userId) await supabase.from('players').update({profile_image: img}).eq('id', state.userId);
    },

    // Economia & Loja
    getBolo: () => state.profile.bolo,
    addBolo, 
    claimDailyReward, 
    checkDailyClaimStatus,
    hasItem, 
    unlockItem, // Agora Seguro via RPC

    // Gameplay
    loadGameSave, 
    saveGameProgress,
    getLeaderboard,
    submitScore,

    // Analytics
    startSession, 
    endSession, 
    track,
    logAdImpression: (id, type) => track('ad_impression', 'ad_impression', { ad_id: id, ad_type: type }),
    logAdClick: (id, type) => track('ad_click', 'ad_click', { ad_id: id, ad_type: type }),
    
    // Legado/Helper OTP (opcional manter exposto)
    requestEmailLogin: async (email) => { return supabase.auth.signInWithOtp({ email }); },
    verifyEmailLogin: async (email, token) => { return supabase.auth.verifyOtp({ email, token, type: 'email' }); }
};