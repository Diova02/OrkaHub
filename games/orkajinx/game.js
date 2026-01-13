import { OrkaCloud, supabase } from '../../core/scripts/orka-cloud.js';
import { palavrasPT, palavrasEN } from './palavras.js';

// --- ESTADO LOCAL ---
let state = {
    roomId: null,
    roomCode: null,
    playerId: OrkaCloud.getPlayerId(),
    nickname: OrkaCloud.getNickname() || 'Anonimo',
    isHost: false,
    language: 'pt-BR',
    dictionary: palavrasPT,
    round: 1,
    players: [] // { id, nickname, is_ready, current_word }
};

// --- DOM ELEMENTS ---
const screens = {
    lobby: document.getElementById('scene-lobby'),
    waiting: document.getElementById('scene-waiting'),
    game: document.getElementById('scene-game')
};

const inputs = {
    roomCode: document.getElementById('input-room-code'),
    word: document.getElementById('word-input')
};

// --- INICIALIZAÇÃO ---
async function init() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
        inputs.roomCode.value = code;
        joinRoom(code);
    }
}

// --- NAVEGAÇÃO ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.style.display = 'none');
    screens[screenName].style.display = 'flex'; 
}

// --- LÓGICA DE SALA ---

// 1. Criar Sala
document.getElementById('btn-create').addEventListener('click', async () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    // ATENÇÃO: Usando 'jinx_rooms'
    const { data, error } = await supabase
        .from('jinx_rooms') 
        .insert({ 
            code: code, 
            language: state.language,
            status: 'waiting'
        })
        .select()
        .single();

    if (error) {
        console.error(error);
        return alert('Erro ao criar sala. Verifique o console.');
    }

    state.isHost = true;
    enterRoom(data);
});

// 2. Entrar na Sala
document.getElementById('btn-join').addEventListener('click', () => {
    const code = inputs.roomCode.value.toUpperCase();
    if (code.length < 4) return;
    joinRoom(code);
});

async function joinRoom(code) {
    const { data, error } = await supabase
        .from('jinx_rooms')
        .select('*')
        .eq('code', code)
        .single();

    if (error || !data) return alert('Sala não encontrada.');
    if (data.status !== 'waiting') return alert('Jogo já começou.');

    enterRoom(data);
}

// 3. Configurar Entrada
async function enterRoom(roomData) {
    state.roomId = roomData.id;
    state.roomCode = roomData.code;
    state.language = roomData.language;
    state.dictionary = (state.language === 'en-US') ? palavrasEN : palavrasPT;

    // Registrar Jogador na tabela JINX
    await supabase.from('jinx_room_players').insert({
        room_id: state.roomId,
        player_id: state.playerId,
        nickname: state.nickname
    });

    // Atualizar UI
    document.getElementById('display-code').innerText = state.roomCode;
    showScreen('waiting');
    
    // Iniciar Realtime
    subscribeToRoom();
}

// --- REALTIME & SINCRONIA ---

function subscribeToRoom() {
    const channel = supabase.channel(`room:${state.roomId}`);

    channel
        // ATENÇÃO: Tabelas atualizadas aqui também!
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jinx_room_players', filter: `room_id=eq.${state.roomId}` }, handlePlayerChange)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jinx_rooms', filter: `id=eq.${state.roomId}` }, handleRoomChange)
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                fetchPlayers(); 
            }
        });
}

async function fetchPlayers() {
    const { data } = await supabase.from('jinx_room_players').select('*').eq('room_id', state.roomId);
    state.players = data;
    renderPlayers();
    checkGameLogic();
}

function handlePlayerChange(payload) {
    if (payload.eventType === 'INSERT') {
        state.players.push(payload.new);
    } else if (payload.eventType === 'UPDATE') {
        const index = state.players.findIndex(p => p.id === payload.new.id);
        if (index !== -1) state.players[index] = payload.new;
    } else if (payload.eventType === 'DELETE') {
        state.players = state.players.filter(p => p.id !== payload.old.id);
        if (payload.old.player_id === state.playerId) window.location.reload();
    }
    renderPlayers();
    checkGameLogic();
}

function handleRoomChange(payload) {
    if (payload.new.status === 'playing' && screens.game.style.display === 'none') {
        startGameUI();
    }
    if (payload.new.status === 'finished') {
        endGame(true);
    }
}

// --- LÓGICA DO GAMEPLAY ---

document.getElementById('btn-start').addEventListener('click', async () => {
    await supabase.from('jinx_rooms').update({ status: 'playing' }).eq('id', state.roomId);
});

function startGameUI() {
    showScreen('game');
    document.getElementById('word-input').focus();
}

function renderPlayers() {
    const waitingList = document.getElementById('waiting-list');
    if (waitingList) {
        waitingList.innerHTML = state.players.map(p => `<div style="margin:5px;">${p.nickname}</div>`).join('');
        const btnStart = document.getElementById('btn-start');
        if (state.isHost && state.players.length >= 2) btnStart.disabled = false;
        else btnStart.disabled = true;
    }

    const grid = document.getElementById('players-grid');
    if (grid) {
        grid.innerHTML = '';
        state.players.forEach(p => {
            const isMe = p.player_id === state.playerId;
            const isReady = p.is_ready;
            
            const allReady = state.players.every(pl => pl.is_ready);
            let displayWord = '...';
            
            if (isReady && !allReady) displayWord = 'PRONTO';
            if (allReady) displayWord = p.current_word || '';

            const html = `
                <div class="player-card ${isReady ? 'ready active' : 'active'}">
                    <div class="player-avatar">
                        <span class="material-icons" style="color:#666; font-size:30px;">person</span>
                    </div>
                    <div class="player-nick">${p.nickname} ${isMe ? '(Você)' : ''}</div>
                    <div class="player-word-display">${displayWord}</div>
                </div>
            `;
            grid.innerHTML += html;
        });
    }
}

async function checkGameLogic() {
    if (!state.isHost) return; 
    if (screens.game.style.display === 'none') return;

    const allReady = state.players.every(p => p.is_ready);
    
    if (allReady) {
        setTimeout(async () => {
            const words = state.players.map(p => p.current_word);
            const firstWord = words[0];
            const allMatch = words.every(w => w === firstWord);

            if (allMatch) {
                await finishGame();
            } else {
                await resetRound();
            }
        }, 2000);
    }
}

inputs.word.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const word = inputs.word.value.trim().toUpperCase();
        
        if (!state.dictionary.includes(word)) {
            inputs.word.classList.add('error');
            setTimeout(() => inputs.word.classList.remove('error'), 500);
            return;
        }

        inputs.word.value = '';
        inputs.word.disabled = true;
        
        await supabase
            .from('jinx_room_players')
            .update({ is_ready: true, current_word: word })
            .eq('player_id', state.playerId)
            .eq('room_id', state.roomId);
    }
});

async function resetRound() {
    state.round++;
    document.getElementById('round-counter').innerText = `Rodada ${state.round}`;
    
    await supabase
        .from('jinx_room_players')
        .update({ is_ready: false, current_word: '' })
        .eq('room_id', state.roomId);
        
    inputs.word.disabled = false;
    inputs.word.focus();
}

async function finishGame() {
    await supabase.from('jinx_room_history').insert({
        code: state.roomCode,
        player_names: state.players.map(p => p.nickname),
        rounds_count: state.round,
        result: 'win'
    });

    await supabase.from('jinx_rooms').update({ status: 'finished' }).eq('id', state.roomId);

    setTimeout(async () => {
        await supabase.from('jinx_rooms').delete().eq('id', state.roomId);
    }, 5000);
}

function endGame(win) {
    inputs.word.disabled = true;
    document.getElementById('status-text').innerText = win ? 'SINCRONIA PERFEITA!' : 'Fim de jogo.';
    document.getElementById('status-text').style.color = win ? 'var(--status-correct)' : '#666';
    
    setTimeout(() => {
        alert('Vitória! A sala será encerrada.');
        window.location.reload();
    }, 4000);
}

document.getElementById('btn-lang-pt').onclick = () => setLang('pt-BR');
document.getElementById('btn-lang-en').onclick = () => setLang('en-US');

function setLang(lang) {
    state.language = lang;
    document.getElementById('btn-lang-pt').style.background = lang === 'pt-BR' ? 'var(--orka-accent)' : '#222';
    document.getElementById('btn-lang-en').style.background = lang === 'en-US' ? 'var(--orka-accent)' : '#222';
    document.getElementById('btn-lang-pt').style.color = lang === 'pt-BR' ? '#fff' : '#888';
    document.getElementById('btn-lang-en').style.color = lang === 'en-US' ? '#fff' : '#888';
}

window.onbeforeunload = async () => {
    if (state.roomId) {
        supabase.from('jinx_room_players').delete().eq('player_id', state.playerId).then();
    }
};

init();