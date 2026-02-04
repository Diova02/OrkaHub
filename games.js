//id = nome da pasta. Ao adicionar um jogo, atualizar assets de ícones, prints e descs na const de tradução.
export const gamesList = [
    { id: 'zoo', type: 'daily', title: 'ORKA ZOO', allowPortrait: true, releaseDate: '2026-01-05', lastUpdate: '2026-01-31', active: true },
    { id: 'jinx', type: 'web', title: 'ORKA JINX', allowPortrait: true, releaseDate: '2026-01-13', active: true },
    { id: 'eagle', type: 'daily', title: 'EAGLE AIM', allowPortrait: false, releaseDate: '2026-01-17', active: true },
    { id: 'listit', type: 'daily', title: 'LISTIT', allowPortrait: true, releaseDate: '2026-01-25', active: true },
    { id: 'firewall', type: 'web', title: 'FIREWALL', allowPortrait: false, releaseDate: null, active: true }
];

// 2. Mapeamento de Tags por Jogo (Facilita a manutenção)
export const gamesTags = {
    eagle: ['mira', 'reflexo', 'diario', 'leaderboard'],
    zoo: ['logica', 'puzzle', 'diario'],
    listit: ['logica', 'puzzle', 'diario'],
    jinx: ['logica', 'mp_closed', 'casual'],
    firewall: ['roguelike', 'leaderboard', 'estrategia', 'acao']
};

export const shelves = {
    NEW_UPDATED: { id: 'new_updated', title: 'Novidades do Hub', priority: 0, dynamic: true },
    DAILY: { id: 'daily', title: 'Jogue Todo Dia!', tags: ['diario'], priority: 1 },
    SKILL: { id: 'skill', title: 'Habilidade e Estratégia', tags: ['mira', 'reflexo', 'estrategia'], priority: 2 },
    SOCIAL: { id: 'social', title: 'Interaja com o Mundo', tags: ['mp_closed', 'mp_open', 'leaderboard'], priority: 2 },
    MIND: { id: 'mind', title: 'Jogue com Inteligência', tags: ['logica', 'estrategia', 'puzzle'], priority: 2 },
    // BLOODLY: { id: 'bloodly', title: 'O Suco da Adrenalina', tags: ['reflexo', 'acao'], priority: 2 },
    // COZY: { id: 'cozy', title: 'Para Relaxar (Zen)', tags: ['casual', 'zen'], priority: 2 },
    SOON: { id: 'soon', title: 'Em Breve', priority: 3 }
};