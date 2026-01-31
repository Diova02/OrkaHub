// core/scripts/orka-cloud.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle&target=browser'

const CONFIG = {
    url: 'https://lvwlixmcgfuuiizeelmo.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2d2xpeG1jZ2Z1dWlpemVlbG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTUwMzQsImV4cCI6MjA4MzQ3MTAzNH0.qa0nKUXewE0EqUePwfzQbBOaHypRqkhUxRnY5qgsDbo'
};

const supabase = createClient(CONFIG.url, CONFIG.key);

let state = {
    user: null,
    profile: null
};

// =================================================================
//  1. AUTENTICAÇÃO E PERFIL
// =================================================================

async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        state.user = session.user;
        state.session = session; // [NOVO] Guarda a sessão para uso síncrono
    } else {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) console.error("OrkaCloud: Erro de Auth", error);
        state.user = data?.user;
        state.session = data?.session; // [NOVO]
    }

    // 2. Garantia de Existência do Perfil (Bootstrapping)
    if (state.user) {
        // Tenta buscar o perfil
        const { data } = await supabase.from('players').select('*').eq('id', state.user.id).maybeSingle();
        state.profile = data;

        if (!state.profile) {
            console.log("🆕 Novo usuário detectado (Ghost). Criando linha na tabela players...");
            
            // CRÍTICO: Cria a linha inicial para satisfazer a Foreign Key da tabela sessions
            const { error: insertError } = await supabase.from('players').insert([
                { id: state.user.id, nickname: 'Ghost', is_registered: false }
            ]);

            if (insertError) {
                console.error("❌ Falha fatal ao criar player:", insertError);
            } else {
                // Busca de novo para garantir que temos o objeto atualizado
                await _syncProfile();
            }
        } else {
            // Se já existe, apenas atualiza o 'visto por último'
            await supabase.from('players').update({ last_seen_at: new Date() }).eq('id', state.user.id);
        }
    }
    
    return state.user;
}

async function _syncProfile() {
    // [AJUSTE] cake_balance agora é read-only aqui.
    const { data } = await supabase.from('players').select('*').eq('id', state.user.id).maybeSingle();
    state.profile = data;
}

async function updateProfile(updates) {
    if (!state.user) return;
    
    // [PROTEÇÃO] Removemos campos sensíveis ou de cache manual antes de enviar
    const { cake_balance, id, created_at, ...safeUpdates } = updates;

    state.profile = { ...state.profile, ...safeUpdates };

    const payload = { id: state.user.id, ...safeUpdates, last_seen_at: new Date() };
    await supabase.from('players').upsert(payload);
}

// =================================================================
//  2. GAME DATA (SAVES & LEADERBOARDS)
// =================================================================

// [NOVO] Suporte a Date Reference para jogos diários
async function loadSave(gameId, dateRef = null) {
    if (!state.user) return null;
    
    let query = supabase.from('game_saves')
        .select('save_data')
        .eq('player_id', state.user.id)
        .eq('game_id', gameId);

    if (dateRef) {
        query = query.eq('date_reference', dateRef);
    } else {
        query = query.is('date_reference', null); // Jogos contínuos (RPG, etc)
    }

    const { data } = await query.maybeSingle();
    return data ? data.save_data : null;
}


async function saveGame(gameId, data, dateRef = null) {
    if (!state.user) return;
    
    // Configura o payload limpo
    const payload = {
        player_id: state.user.id,
        game_id: gameId,          // Ex: "zoo"
        date_reference: dateRef,  // Ex: "2026-01-27"
        save_data: data,
        updated_at: new Date()
    };

    console.log("☁️ Uploading Save:", payload);

    // Agora a constraint é dinâmica e precisa
    const conflictColumns = dateRef 
        ? 'player_id, game_id, date_reference' 
        : 'player_id, game_id'; 

    const { error } = await supabase.from('game_saves').upsert(payload, { 
        onConflict: conflictColumns 
    });

    if (error) console.error("❌ Erro ao salvar na nuvem:", error);
}

// core/scripts/orka-cloud.js

async function submitScore(gameId, score, dateRef = null) {
    if (!state.user) {
        console.warn("⚠️ OrkaCloud: Tentativa de enviar score sem usuário logado.");
        return;
    }
    
    // Se não passar data, usa hoje
    const today = dateRef || new Date().toISOString().split('T')[0];
    
    // Payload preparado
    const payload = {
        player_id: state.user.id, 
        game_id: gameId,
        score: score,
        played_at: today
    };

    console.group(`🚀 OrkaCloud: Enviando Score (${gameId})`);
    console.log("📦 Payload:", payload);
    console.log("🔑 Constraint Esperada: leaderboards_player_game_date_key");

    try {
        const { data, error } = await supabase.from('leaderboards').upsert(payload, { 
            onConflict: 'player_id, game_id, played_at'
        }).select();

        if (error) {
            console.error("❌ ERRO NO BANCO:", error.message, error.details);
            console.error("💡 Dica: Verifique se a constraint 'leaderboards_player_game_date_key' existe no SQL.");
        } else {
            console.log("✅ Sucesso! Score salvo/atualizado:", data);
        }
    } catch (e) {
        console.error("🔥 Erro Crítico na Requisição:", e);
    } finally {
        console.groupEnd();
    }
}

async function getLeaderboard(gameId, dateObj = new Date()) {
    const dateStr = dateObj instanceof Date ? dateObj.toISOString().split('T')[0] : dateObj;
    
    const { data, error } = await supabase
        .from('leaderboards')
        .select(`score, player_id, players(nickname, profile_image)`) 
        .eq('game_id', gameId)
        .eq('played_at', dateStr)
        .order('score', { ascending: true }) // Confirme se o jogo é "menor score" ou "maior score"
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

// [NOVO] Verifica se já pegou recompensa diária
async function checkDailyClaim(gameId) {
    if (!state.user) return false;
    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase.from('daily_claims')
        .select('id')
        .eq('player_id', state.user.id)
        .eq('game_id', gameId)
        .eq('claimed_at', today)
        .maybeSingle();
        
    return !!data; // Retorna true se já existir
}

// =================================================================
//  3. SESSÃO & ANALYTICS
// =================================================================

async function startSession(gameId) {
    if (!state.user) await initAuth();
    
    const sessionId = crypto.randomUUID();
    const { error } = await supabase.from('sessions').insert({
        id: sessionId,
        player_id: state.user.id,
        game_id: gameId,
        started_at: new Date(),
        last_heartbeat_at: new Date(), // [NOVO] Inicializa o heartbeat
        platform_info: { ua: navigator.userAgent, mobile: /Mobi/i.test(navigator.userAgent) }
    });
    
    if (error) console.warn("OrkaCloud: Falha ao criar sessão", error);
    return sessionId;
}

async function updateSession(sessionId, payload) {
    // [NOVO] Sempre atualiza o last_heartbeat_at
    await supabase.from('sessions').update({
        ...payload,
        last_heartbeat_at: new Date()
    }).eq('id', sessionId);
}

function endSessionBeacon(sessionId, finalPayload) {
    if (!sessionId) return;
    
    const url = `${CONFIG.url}/rest/v1/sessions?id=eq.${sessionId}`;
    
    // Tenta pegar o token do localStorage se o state sumiu
    const storageKey = `sb-${new URL(CONFIG.url).hostname.split('.')[0]}-auth-token`;
    const savedSession = JSON.parse(localStorage.getItem(storageKey));
    const token = state.session?.access_token || savedSession?.access_token;

    const body = JSON.stringify({
        ...finalPayload,
        ended_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString()
    });

    const headers = {
        'apikey': CONFIG.key,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };

    // Só adiciona Authorization se realmente tiver um token
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    fetch(url, { 
        method: 'PATCH', 
        headers: headers, 
        body: body, 
        keepalive: true 
    }).catch(e => {}); // No fechamento da aba, não adianta muito o console.warn
}

// =================================================================
//  4. ECONOMIA (RPCs)
// =================================================================

async function secureTransaction(rpcName, params) {
    if (!state.user) return { error: "No user" };
    return await supabase.rpc(rpcName, params);
}

export const OrkaCloud = {
    initAuth,
    getUser: () => state.user,
    getProfile: () => state.profile,
    updateProfile,
    
    loadSave,
    saveGame,
    submitScore,
    getLeaderboard,
    checkDailyClaim, // [EXPORT NOVO]
    
    startSession,
    updateSession,
    endSessionBeacon,
    getClient: () => supabase,

    // [IMPORTANTE] Certifique-se que suas RPCs no Supabase foram atualizadas 
    // para inserir na tabela 'cake_transactions' em vez de update direto no player.
    // JS Sugerido
    addBolo: (amount) => {
        // Garante que é um número inteiro antes de enviar
        const cleanAmount = parseInt(amount, 10);
        
        if (isNaN(cleanAmount)) {
            console.error("Erro: 'amount' inválido para add_bolo");
            return;
        }

        // A chave 'amount' aqui deve bater com o nome do parâmetro na função SQL acima
        return secureTransaction('add_bolo', { p_amount: cleanAmount });
    },
    claimDaily: (gameTag) => secureTransaction('claim_daily_reward', { game_tag: gameTag }),

    // Admin Tools
    //deleteGhost: () => secureTransaction('clean_ghost_users', {}),
    
    // Limpeza de Transição (Ghost -> Real)
    deleteGhost: async (oldGhostId) => {
        if (!oldGhostId) return;
        console.log("👻 Faxina: Apagando rastro do fantasma", oldGhostId);
        await secureTransaction('delete_old_guest', { ghost_id: oldGhostId });
    }
};