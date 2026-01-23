import { OrkaMath } from '../../core/scripts/orka-lib.js';

// Mapa de tradução dos tipos de comparação
const TYPE_TRANSLATIONS = {
    // Físicos
    'peso': { pt: 'do mais LEVE ao mais PESADO', en: 'from LIGHTEST to HEAVIEST' },
    'altura': { pt: 'do MENOR ao MAIOR (Altura)', en: 'from SHORTEST to TALLEST' },
    'velocidade': { pt: 'do mais LENTO ao mais RÁPIDO', en: 'from SLOWEST to FASTEST' },
    'temperatura': { pt: 'do mais FRIO ao mais QUENTE', en: 'from COLDEST to HOTTEST' },
    'ano': { pt: 'do mais ANTIGO ao mais RECENTE', en: 'from OLDEST to NEWEST' },
    'duracao': { pt: 'do mais CURTO ao mais LONGO', en: 'from SHORTEST to LONGEST' },
    'populacao': { pt: 'do MENOS habitado ao MAIS habitado', en: 'from LEAST populated to MOST populated' },
    'bilheteria': { pt: 'da MENOR bilheteria à MAIOR bilheteria', en: 'from LOWEST box office to HIGHEST' },
    'imdb': { pt: 'da PIOR nota ao MELHOR avaliado (IMDB)', en: 'from LOWEST rated to HIGHEST rated' },
    'custo': { pt: 'do mais BARATO ao mais CARO', en: 'from CHEAPEST to MOST EXPENSIVE' }
};

// Banco de Dados (Elements já estão na ordem CORRETA de resolução)
const DB = [
    {
        type: "peso",
        elements: ["Formiga", "Beija-flor", "Rato", "Gato Doméstico", "Humano", "Cavalo", "Elefante Africano", "Baleia Azul"],
        resposta: ["3mg", "4g", "300g", "4kg", "70kg", "400kg", "6.000kg", "140.000kg"]
    },
    {
        type: "ano",
        elements: ["Roda", "Papel", "Bússola", "Lâmpada", "Avião", "Internet", "Smartphone", "IA Generativa"],
        resposta: ["3500 AC", "105 DC", "206 DC", "1879", "1903", "1983", "2007", "2020s"]
    },
    {
        type: "populacao",
        elements: ["Vaticano", "Mônaco", "Islândia", "Uruguai", "Portugal", "Argentina", "Brasil", "China"],
        resposta: ["~800", "~39 mil", "~370 mil", "~3.4 mi", "~10 mi", "~46 mi", "~215 mi", "~1.4 bi"]
    },
    {
        type: "altura",
        elements: ["Monte Fuji", "Mont Blanc", "Kilimanjaro", "Denali", "Aconcágua", "Everest"],
        resposta: ["3.776m", "4.807m", "5.895m", "6.190m", "6.961m", "8.848m"]
    },
    {
        type: "temperatura", // Temp média superficial
        elements: ["Netuno", "Urano", "Jupiter", "Marte", "Terra", "Mercúrio", "Vênus", "Sol"],
        resposta: ["-200°C", "-195°C","-120°C", "-60°C", "15°C", "167°C", "464°C", "5.500°C"]
    },
    {
        type: "peso",
        elements: ["Grão de Areia", "Gota de Chuva", "Moeda de 1 real", "Caneta BIC", "Smartphone", "Bola de Futebol", "Tijolo"],
        resposta: ["~0.004g", "~0.03g", "7g", "10g", "~200g", "450g", "2.5kg"]
    },
    {
        type: "bilheteria",
        elements: ["O Iluminado", "Pulp Fiction", "O Senhor dos Anéis: A Sociedade", "Coringa", "Vingadores: Ultimato", "Avatar"],
        resposta: ["$46 mi", "$213 mi", "$898 mi", "$1.07 bi", "$2.79 bi", "$2.92 bi"]
    },
    {
        type: "ano",
        elements: ["Pong", "Pac-Man", "Super Mario Bros", "Doom", "GTA San Andreas", "Minecraft", "Fortnite", "GTA VI (Trailer)"],
        resposta: ["1972", "1980", "1985", "1993", "2004", "2011", "2017", "2023"]
    },
    {
        type: "duracao", // Filmes famosos
        elements: ["Toy Story", "Rei Leão", "Vingadores", "Pulp Fiction", "Avatar 2", "O Senhor dos Anéis: Retorno do Rei", "E o Vento Levou"],
        resposta: ["1h 21m", "1h 28m", "2h 23m", "2h 34m", "3h 12m", "3h 21m", "3h 58m"]
    },
    {
        type: "ano", // Lançamento de Redes Sociais
        elements: ["LinkedIn", "Facebook", "YouTube", "Twitter/X", "WhatsApp", "Instagram", "Snapchat", "TikTok"],
        resposta: ["2003", "2004", "2005", "2006", "2009", "2010", "2011", "2016"]
    },
    {
        type: "imdb", // Séries (Nota média aproximada)
        elements: ["Velma", "She-Hulk", "The Witcher", "Stranger Things", "The Office", "Game of Thrones", "Chernobyl", "Breaking Bad"],
        resposta: ["1.6", "5.3", "8.0", "8.7","9.0", "9.2", "9.3","9.5"] 
        // Nota: GoT e Chernobyl variam, mas Breaking Bad costuma ser o topo. Ajustei para ordem crescente.
    },
    {
        type: "ano", // Descobertas/Invenções
        elements: ["Fogo (Controle)", "Roda", "Escrita", "Dinheiro", "Pólvora", "Imprensa", "Motor a Vapor", "Penicilina"],
        resposta: ["~1 mi AC", "~3500 AC", "~3200 AC", "~700 AC", "~900 DC", "1440", "1712", "1928"]
    },
    {
        type: "velocidade", // Velocidade da luz/som
        elements: ["Som (no ar)", "Bala de Rifle", "Velocidade de Escape (Terra)", "Sonda Voyager 1", "Luz"],
        resposta: ["343 m/s", "1.000 m/s", "11.200 m/s", "17.000 m/s", "299.792.458 m/s"]
    },
    {
        type: "peso", // Corpos Celestes (Massa relativa à Terra)
        elements: ["Lua", "Marte", "Vênus", "Terra", "Netuno", "Saturno", "Júpiter", "Sol"],
        resposta: ["0.01x", "0.1x", "0.8x", "1x", "17x", "95x", "317x", "333.000x"]
    },
    {
        type: "ano", // Linguagens de Programação
        elements: ["Assembly", "C", "SQL", "C++", "Python", "Java", "JavaScript", "Rust"],
        resposta: ["1949", "1972", "1974", "1985", "1991", "1995", "1995", "2010"]
    },
    {
        type: "populacao", // Redes Sociais (Usuários Ativos Mensais aprox.)
        elements: ["Pinterest", "X (Twitter)", "Snapchat", "TikTok", "Instagram", "YouTube", "Facebook"],
        resposta: ["450 mi", "550 mi", "750 mi", "1.5 bi", "2 bi", "2.5 bi", "3 bi"]
    },
    {
        type: "altura", // Estruturas famosas
        elements: ["Cristo Redentor", "Estátua da Liberdade", "Pirâmide de Gizé", "Torre Eiffel", "Empire State", "One World Trade Center", "Burj Khalifa"],
        resposta: ["38m", "93m", "139m", "324m", "443m", "541m", "828m"]
    },
    {
        type: "ano", // Lançamento de Filmes da Marvel (MCU)
        elements: ["Homem de Ferro", "Thor", "Vingadores", "Guardiões da Galáxia", "Guerra Civil", "Pantera Negra", "Ultimato", "Eternos"],
        resposta: ["2008", "2011", "2012", "2014", "2016", "2018", "2019", "2021"]
    },
    {
        type: "peso", // Raças de Cachorro (Médio)
        elements: ["Chihuahua", "Pug", "Beagle", "Border Collie", "Husky Siberiano", "Golden Retriever", "Rottweiler", "São Bernardo"],
        resposta: ["2kg", "8kg", "11kg", "20kg", "27kg", "34kg", "50kg", "80kg"]
    },
    {
        type: "velocidade", // Esportes (Velocidade da bola/objeto em recordes)
        elements: ["Curling", "Tenis de Mesa", "Futebol (Chute)", "Beisebol", "Tênis (Saque)", "Flecha (Arco prof.)", "Badminton (Smash)", "Tiro Esportivo"],
        resposta: ["40 km/h", "110 km/h", "130 km/h", "170 km/h", "263 km/h", "300 km/h", "493 km/h", "3.000+ km/h"]
    },
    {
        type: "ano", // Guerras e Conflitos (Início)
        elements: ["Guerra dos 100 Anos", "Independência do Brasil", "Guerra Civil Americana", "1ª Guerra Mundial", "2ª Guerra Mundial", "Guerra Fria", "Guerra do Golfo"],
        resposta: ["1337", "1822", "1861", "1914", "1939", "1947", "1990"]
    }
    // Adicione mais jogos aqui para testar o ciclo...
];

export const GameData = {
    getLevel: (dateObj, lang = 'pt') => {
        // --- CÁLCULO DE CICLO ROBUSTO ---
        // 1. Define data base (Marco Zero)
        const start = new Date('2024-01-01T00:00:00'); 
        
        // 2. Normaliza a data recebida para meia-noite (evita bugs de fuso)
        const current = new Date(dateObj);
        current.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);

        // 3. Calcula diferença em dias
        const diffTime = current - start;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // 4. Garante índice positivo e cíclico (Loop)
        // Se diffDays for 0 (01/01/2024) -> Pega jogo 0
        // Se diffDays for 2 (03/01/2024) -> Pega jogo 0 (Se DB tiver apenas 2 jogos)
        let index = diffDays % DB.length;
        
        // Proteção contra datas anteriores a 2024 (caso aconteça)
        if (index < 0) index = (index + DB.length) % DB.length;

        const rawLevel = DB[index];
        
        // --- MONTAGEM DO NÍVEL ---
        const typeKey = rawLevel.type;
        const promptText = TYPE_TRANSLATIONS[typeKey] 
            ? TYPE_TRANSLATIONS[typeKey][lang === 'pt-BR' ? 'pt' : 'en'] 
            : `Order by ${typeKey}`;

        // Mapeia os itens mantendo o ID da posição correta
        const orderedItems = rawLevel.elements.map((name, i) => ({
            id: i, // ID = Posição correta no array final
            name: name,
            value: rawLevel.resposta[i],
            imgUrl: null
        }));

        // A semente do aleatório deve ser baseada na DATA ESPECÍFICA
        // Se usarmos new Date(), todo reload muda. Usando dateObj, o embaralhamento é fixo por dia.
        const seed = OrkaMath.getDateSeed(current); 
        const rng = OrkaMath.createSeededRNG(seed);
        
        // Embaralha
        let shuffled = [...orderedItems];
        shuffled = OrkaMath.shuffle(shuffled, rng);
        shuffled = OrkaMath.shuffle(shuffled, rng);

        console.log(`📅 Jogo carregado para: ${current.toLocaleDateString()} | Index do DB: ${index}`);

        return {
            prompt: promptText,
            type: rawLevel.type,
            items: shuffled, 
            totalItems: orderedItems.length
        };
    }
};