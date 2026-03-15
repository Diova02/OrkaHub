//id = nome da pasta. Ao adicionar um jogo, atualizar assets de ícones, prints e descs na const de tradução.
export const gamesList = [
    { id: 'zoo', type: 'daily', title: 'ORKA ZOO', allowPortrait: true, releaseDate: '2026-01-05', lastUpdate: '2026-01-31', active: true,
        
        description: `
        <span style="font-size:16px;"><b>🦁 Bem-vindo(a) ao <span style="color:#2f9e44;">Orka Zoo</span> 🐾</b></span><br><br>

        Todos os dias, um novo animal misterioso aguarda para ser descoberto. Sua missão é simples: usar lógica, conhecimento e um pouco de intuição para revelar qual criatura está escondida no zoológico da Orka.<br><br>

        Digite o nome de um animal na caixa de busca e faça seu palpite. A cada tentativa, o jogo revelará pistas comparando o animal que você escolheu com o animal secreto do dia. Observe atentamente as informações — elas são a chave para chegar à resposta correta.<br><br>

        <b>As pistas são baseadas nas seguintes categorias:</b><br>
        • <b>Peso</b><br>
        • <b>Dieta</b> (Herbívoro, Carnívoro, Onívoro...)<br>
        • <b>Habitat</b> (Aquático, Aéreo, Terrestre...)<br>
        • <b>Continente</b> onde a espécie é encontrada<br>
        • <b>Classe / Subclasse</b> biológica<br>
        • <b>População média</b> estimada (milhares, milhões ou bilhões)<br>
        • <b>Ciclo circadiano</b> — para os verdadeiros exploradores da natureza 🌙☀️<br><br>

        <b>Interprete as cores das células para se aproximar da resposta:</b><br>
        🟩 <b>Verde</b> — Característica correta.<br>
        🟥 <b>Vermelho</b> — Característica incorreta.<br>
        🟨 <b>Amarelo</b> — Existe semelhança, mas não corresponde exatamente ao animal secreto.<br><br>

        Cada palpite revela novas pistas. Compare as características, refine sua estratégia e veja quantas tentativas você precisa para descobrir o animal do dia.<br><br>

        Boa sorte, explorador — o zoológico está cheio de segredos esperando para serem revelados. 🐘🦉🐢<br><br>

        <span style="opacity:0.8;">Desenvolvido por <b>Diova</b> • <a href="https://orka-hub.vercel.app" target="_blank">Orka Studio</a> • 2026</span>
        `,


        influencers: [
        //     { id: 'player_1', channel: 'https://youtube.com/c/gameplayrj' },
             { id: '611e833c-0a72-4fd8-b712-6ad5dbdce7c8', channel: 'https://youtube.com/@Orka.Studio' }
        ]
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