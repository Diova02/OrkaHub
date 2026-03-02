//id = nome da pasta. Ao adicionar um jogo, atualizar assets de ícones, prints e descs na const de tradução.
export const gamesList = [
    { id: 'zoo', type: 'daily', title: 'ORKA ZOO', allowPortrait: true, releaseDate: '2026-01-05', lastUpdate: '2026-01-31', active: true
        
        // description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc a justo congue, tristique tortor non, ullamcorper metus. Praesent pharetra dui est, faucibus pharetra enim tristique quis. Nunc tempor lobortis magna. Donec ut venenatis mauris, a ultricies nulla. In convallis lacinia luctus. Pellentesque fringilla est quis molestie commodo. Morbi tempus, sapien vitae lacinia fringilla, neque orci fringilla nulla, ut rhoncus ligula augue et odio. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. In pharetra arcu nisi, eu aliquet ipsum dictum quis. Etiam sed dictum velit, at pretium nisi. Curabitur porttitor vulputate elementum. Ut vulputate lorem eget leo vestibulum, efficitur suscipit lectus scelerisque. Integer quis mi in mauris tristique hendrerit eu vitae justo. Phasellus vulputate orci elit, at fringilla elit vehicula nec.<br>Proin elit nisl, aliquam sed diam ac, tincidunt egestas dui. Ut nec lacus vel leo laoreet porttitor. Nam aliquet finibus erat, non luctus elit maximus id. Pellentesque porta lobortis est, consectetur gravida orci fermentum congue. Nulla non tellus est. Aenean eu sapien quis purus vehicula auctor. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed feugiat ut ligula volutpat semper. Sed malesuada bibendum sem id vehicula. Etiam ex ex, porttitor non aliquet sit amet, egestas id turpis. Donec malesuada est non eros convallis, nec convallis tortor tincidunt. Proin in est porttitor, elementum velit ac, ullamcorper leo. Quisque nisi nisi, fringilla non vestibulum at, fermentum eget sapien. Nulla ornare, neque scelerisque ornare commodo, nisl est mollis dolor, nec tincidunt est libero sed velit. Pellentesque rutrum, nulla et lacinia bibendum, nunc ante sodales urna, nec dictum neque erat ac odio.<br>Suspendisse potenti. Morbi at nibh facilisis, vestibulum purus quis, suscipit dui. Curabitur a augue semper, cursus justo sit amet, tristique metus. Cras vel sem euismod, eleifend odio at, imperdiet mi. Aliquam sollicitudin odio et rhoncus luctus. Pellentesque dictum vitae libero at volutpat. Curabitur ac tempus est. Cras a felis ut elit mattis suscipit nec ac augue. Integer semper tincidunt egestas.<br>Nunc nec tortor id mauris malesuada venenatis sit amet eget leo. Vestibulum tempus lectus et ornare gravida. Maecenas iaculis, diam vel dignissim consectetur, elit lectus pellentesque sem, vel sodales felis ante eget leo. Nunc a lacus in nibh pellentesque ultrices quis vel sapien. Ut lacus mi, tincidunt eu faucibus eget, rhoncus et risus. Phasellus pharetra congue tortor vel consectetur. Pellentesque volutpat dignissim diam sit amet mollis. Fusce ut dolor quis nisi posuere sagittis. Nullam accumsan turpis augue, eu imperdiet orci efficitur eu. In mollis, odio porta ullamcorper ultricies, orci lacus luctus mi, quis pharetra leo turpis ac sapien. Praesent bibendum sollicitudin porta. Proin vulputate egestas nulla ac porttitor. Proin venenatis enim eget porttitor consequat.',
        // influencers: [
        //     { id: 'player_1', nick: 'GameplayRJ', avatar: 'https://github.com/identicons/rj.png', channel: 'https://youtube.com/c/gameplayrj' },
        //     { id: 'player_2', nick: 'Alanzoka', avatar: 'https://github.com/identicons/alan.png', channel: 'https://twitch.tv/alanzoka' }
        // ]
     },
    { id: 'jinx', type: 'web', title: 'ORKA JINX', allowPortrait: true, releaseDate: '2026-01-13', active: true },
    { id: 'eagle', type: 'daily', title: 'EAGLE AIM', allowPortrait: false, releaseDate: '2026-01-17', active: true },
    { id: 'listit', type: 'daily', title: 'LISTIT', allowPortrait: true, releaseDate: '2026-01-25', active: true },
    { id: 'firewall', type: 'web', title: 'FIREWALL', allowPortrait: false, releaseDate: '2026-02-10', active: true },
    { id: 'pulse', type: 'web', title: 'ECHO PULSE', allowPortrait: false, releaseDate: '2026-03-02', active: true }
];

// 2. Mapeamento de Tags por Jogo (Facilita a manutenção)
export const gamesTags = {
    eagle: ['mira', 'reflexo', 'diario', 'leaderboard'],
    zoo: ['logica', 'puzzle', 'diario'],
    listit: ['logica', 'puzzle', 'diario'],
    jinx: ['logica', 'mp_closed', 'casual'],
    firewall: ['roguelike', 'estrategia', 'acao'],
    pulse: ['casual', 'reflexo']
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