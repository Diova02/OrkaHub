// =================================================================
//  ORKA CLOUD V5.0 — Core Service Layer
//  Responsabilidade: Comunicação Pura com Supabase (I/O)
// =================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle&target=browser'

const CONFIG = {
    url: 'https://lvwlixmcgfuuiizeelmo.supabase.co',
    // ⚠️ Idealmente, usar variáveis de ambiente em build steps profissionais
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2d2xpeG1jZ2Z1dWlpemVlbG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTUwMzQsImV4cCI6MjA4MzQ3MTAzNH0.qa0nKUXewE0EqUePwfzQbBOaHypRqkhUxRnY5qgsDbo'
};

const supabase = createClient(CONFIG.url, CONFIG.key);

// Estado Mínimo Global (Apenas Cache de Identidade)
let state = {
    user: null,
    sessionToken: null,
    profile: null
};

// =================================================================
//  1. AUTENTICAÇÃO E PERFIL
// =================================================================

async function initAuth() {
    // 1. Tenta recuperar sessão existente
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        state.user = session.user;
    } else {
        // 2. Login Anônimo Silencioso
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) console.error("OrkaCloud: Erro de Auth", error);
        state.user = data?.user;
    }

    if (state.user) await _syncProfile();
    return state.user;
}

async function _syncProfile() {
    // Busca perfil ou retorna null (O GameManager decide o que fazer se for null)
    const { data } = await supabase.from('players').select('*').eq('id', state.user.id).maybeSingle();
    state.profile = data;
}

// Atualiza dados do jogador (Nick, Avatar, Lang)
async function updateProfile(updates) {
    if (!state.user) return;
    
    // Atualização Otimista Local
    state.profile = { ...state.profile, ...updates };

    // Envia ao Banco (Upsert garante criação se não existir)
    const payload = { id: state.user.id, ...updates, last_seen_at: new Date() };
    await supabase.from('players').upsert(payload);
}

// =================================================================
//  2. GAME DATA (SAVES & LEADERBOARDS)
// =================================================================

async function loadSave(gameId) {
    if (!state.user) return null;
    const { data } = await supabase.from('game_saves')
        .select('save_data').eq('player_id', state.user.id).eq('game_id', gameId).maybeSingle();
    return data ? data.save_data : null;
}

async function saveGame(gameId, data) {
    if (!state.user) return;
    await supabase.from('game_saves').upsert({
        player_id: state.user.id,
        game_id: gameId,
        save_data: data,
        updated_at: new Date()
    });
}

async function submitScore(gameId, score) {
    if (!state.user) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('leaderboards').upsert({
        player_id: state.user.id,
        game_id: gameId,
        score: score,
        played_at: today
    }, { onConflict: 'game_id, player_id, played_at' });
}

async function getLeaderboard(gameId, dateObj = new Date()) {
    // Garante formato YYYY-MM-DD
    const dateStr = dateObj instanceof Date ? dateObj.toISOString().split('T')[0] : dateObj;
    
    // Nota: 'ascending: true' favorece MENOR tempo (Eagle Aim). 
    // Se no futuro tiver jogo de PONTOS, precisaremos de um parametro extra aqui.
    const { data, error } = await supabase
        .from('leaderboards')
        .select(`score, player_id, players(nickname, profile_image)`) 
        .eq('game_id', gameId)
        .eq('played_at', dateStr)
        .order('score', { ascending: true }) 
        .limit(50);

    if (error) {
        console.error("OrkaCloud: Erro Leaderboard", error);
        return [];
    }
    
    return data.map(entry => ({
        nickname: entry.players?.nickname || 'Anônimo',
        avatar: entry.players?.profile_image || 'default', 
        score: entry.score,
        isMe: entry.player_id === state.user?.id
    }));
}

// =================================================================
//  3. SESSÃO & ANALYTICS (BEACON SUPPORT)
// =================================================================

async function startSession(gameId) {
    if (!state.user) await initAuth();
    
    const sessionId = crypto.randomUUID();
    const { error } = await supabase.from('sessions').insert({
        id: sessionId,
        player_id: state.user.id,
        game_id: gameId,
        started_at: new Date(),
        platform_info: { ua: navigator.userAgent, mobile: /Mobi/i.test(navigator.userAgent) }
    });
    
    if (error) console.warn("OrkaCloud: Falha ao criar sessão", error);
    return sessionId;
}

// Atualização Parcial (Heartbeat)
async function updateSession(sessionId, payload) {
    await supabase.from('sessions').update(payload).eq('id', sessionId);
}

function endSessionBeacon(sessionId, finalPayload) {
    if (!sessionId) return;
    
    // URL para atualizar a sessão específica
    const url = `${CONFIG.url}/rest/v1/sessions?id=eq.${sessionId}`;
    
    const body = JSON.stringify({
        ...finalPayload,
        ended_at: new Date().toISOString()
    });

    // A mágica: keepalive: true mantém a requisição viva mesmo se a aba fechar
    fetch(url, {
        method: 'PATCH',
        headers: {
            'apikey': CONFIG.key,
            'Authorization': `Bearer ${CONFIG.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: body,
        keepalive: true 
    }).catch(err => {
        // Silencioso em produção, mas útil ver no console agora
        console.warn("OrkaCloud: Erro ao finalizar sessão (Keepalive)", err);
    });
}

// =================================================================
//  4. ECONOMIA SEGURA (RPCs)
// =================================================================

async function secureTransaction(rpcName, params) {
    if (!state.user) return { error: "No user" };
    return await supabase.rpc(rpcName, params);
}

// =================================================================
//  EXPORTS
// =================================================================

export const OrkaCloud = {
    initAuth,
    getUser: () => state.user,
    getProfile: () => state.profile,
    updateProfile,
    
    // Data
    loadSave,
    saveGame,
    submitScore,
    getLeaderboard,
    
    // Session
    startSession,
    updateSession,
    endSessionBeacon,
    trackEvent: async (name, data) => { /* Implementar insert em analytics_events */ },
    getClient: () => supabase,

    // Economy
    addBolo: (amount) => secureTransaction('add_bolo', { amount }),
    buyItem: (itemId, cost) => secureTransaction('buy_item', { item_id: itemId, item_cost: cost }),
    claimDaily: (gameTag) => secureTransaction('claim_daily_reward', { game_tag: gameTag, amount: 1 })
};