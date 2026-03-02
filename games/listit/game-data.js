import { OrkaMath } from '../../core/orka-lib.js';

// Mapa de tradução dos tipos de comparação
export const TYPE_TRANSLATIONS = {
    'peso': { pt: 'do mais LEVE ao mais PESADO', en: 'from LIGHTEST to HEAVIEST' },
    'altura': { pt: 'do MENOR ao MAIOR (Altura)', en: 'from SHORTEST to TALLEST' },
    'velocidade': { pt: 'do mais LENTO ao mais RÁPIDO', en: 'from SLOWEST to FASTEST' },
    'temperatura': { pt: 'do mais FRIO ao mais QUENTE', en: 'from COLDEST to HOTTEST' },
    'ano': { pt: 'do mais ANTIGO ao mais RECENTE', en: 'from OLDEST to NEWEST' },
    'duracao': { pt: 'do mais CURTO ao mais LONGO', en: 'from SHORTEST to LONGEST' },
    'lifespan': { pt: 'do que vive MENOS para o que vive MAIS', en: 'from SHORTEST to LONGEST lifespan' },
    'populacao': { pt: 'do MENOS habitado ao MAIS habitado', en: 'from LEAST populated to MOST populated' },
    'bilheteria': { pt: 'da MENOR bilheteria à MAIOR bilheteria', en: 'from LOWEST box office to HIGHEST' },
    'imdb': { pt: 'da PIOR nota ao MELHOR avaliado (IMDB)', en: 'from LOWEST rated to HIGHEST rated' },
    'seguidores': { pt: 'do MENOS seguido ao MAIS seguido', en: 'from LEAST followed to MOST followed' },
    'streams': { pt: 'do MENOS ouvido ao MAIS ouvido', en: 'from LEAST streamed to MOST streamed' },
    'vendas': { pt: 'do MENOS vendido ao MAIS vendido', en: 'from LEAST sold to MOST sold' },
    'gols': { pt: 'de quem fez MENOS gols para MAIS gols', en: 'from LEAST goals to MOST goals' },
    'area': { pt: 'da MENOR área à MAIOR área', en: 'from SMALLEST area to LARGEST area' },
    'episodios': { pt: 'de MENOS episódios para MAIS episódios', en: 'from FEWEST episodes to MOST episodes' },
    'oscars': { pt: 'de MENOS Oscars para MAIS Oscars', en: 'from FEWEST Oscars to MOST Oscars' },
    'calorias': { pt: 'do MENOS calórico ao MAIS calórico', en: 'from LEAST calories to MOST calories' },
    'distancia': { pt: 'do mais PRÓXIMO da Terra ao mais DISTANTE', en: 'from CLOSEST to Earth to FURTHEST' },
    'profundidade': { pt: 'do mais RASO ao mais PROFUNDO', en: 'from SHALLOWEST to DEEPEST' }
};

// Banco de Dados (Sempre 8 itens ordenados)
const DB = [
    {
        type: "peso",
        theme: "Animais",
        elements: ["Formiga", "Beija-flor", "Rato", "Gato Doméstico", "Humano", "Cavalo", "Elefante Africano", "Baleia Azul"],
        resposta: ["3mg", "4g", "300g", "4kg", "70kg", "400kg", "6.000kg", "140.000kg"]
    },
    {
        type: "ano",
        theme: "Invenções",
        elements: ["Roda", "Papel", "Bússola", "Lâmpada", "Avião", "Internet", "Smartphone", "IA Generativa"],
        resposta: ["3500 AC", "105 DC", "206 DC", "1879", "1903", "1983", "2007", "2020s"]
    },
    {
        type: "populacao",
        theme: "Geografia",
        elements: ["Vaticano", "Mônaco", "Islândia", "Uruguai", "Portugal", "Argentina", "Brasil", "China"],
        resposta: ["~800", "~39 mil", "~370 mil", "~3.4 mi", "~10 mi", "~46 mi", "~215 mi", "~1.4 bi"]
    },
    {
        type: "altura",
        theme: "Geografia",
        elements: ["Pico da Neblina", "Monte Fuji", "Mont Blanc", "Kilimanjaro", "Denali", "Aconcágua", "K2", "Everest"],
        resposta: ["2.995m", "3.776m", "4.807m", "5.895m", "6.190m", "6.961m", "8.611m", "8.848m"]
    },
    {
        type: "temperatura",
        theme: "Astronomia",
        elements: ["Netuno", "Urano", "Jupiter", "Marte", "Terra", "Mercúrio", "Vênus", "Sol"],
        resposta: ["-200°C", "-195°C","-120°C", "-60°C", "15°C", "167°C", "464°C", "5.500°C"]
    },
    {
        type: "peso",
        theme: "Cotidiano",
        elements: ["Grão de Areia", "Gota de Chuva", "Moeda de 1 real", "Caneta BIC", "Smartphone", "Bola de Futebol", "Notebook", "Tijolo"],
        resposta: ["~0.004g", "~0.03g", "7g", "10g", "~200g", "450g", "~2kg", "2.5kg"]
    },
    {
        type: "bilheteria",
        theme: "Cinema",
        elements: ["O Iluminado", "Pulp Fiction", "O Senhor dos Anéis: A Sociedade", "Coringa", "Star Wars: O Despertar da Força", "Titanic", "Vingadores: Ultimato", "Avatar"],
        resposta: ["$46 mi", "$213 mi", "$898 mi", "$1.07 bi", "$2.07 bi", "$2.26 bi", "$2.79 bi", "$2.92 bi"]
    },
    {
        type: "ano",
        theme: "Games",
        elements: ["Pong", "Pac-Man", "Super Mario Bros", "Doom", "GTA San Andreas", "Minecraft", "Fortnite", "GTA VI (Trailer)"],
        resposta: ["1972", "1980", "1985", "1993", "2004", "2011", "2017", "2023"]
    },
    {
        type: "lifespan",
        theme: "Animais",
        elements: ["Formiga", "Rato", "Gato Doméstico", "Cão Doméstico", "Vaca", "Elefante Africano", "Baleia Azul", "Tigre"],
        resposta: ["~1 ano", "~2 anos", "~15 anos", "~12 anos", "~20 anos", "~70 anos", "~90 anos", "~15 anos"]
    },
    {
        type: "duracao",
        theme: "Cinema",
        elements: ["Toy Story", "Rei Leão", "Vingadores", "Pulp Fiction", "Avatar 2", "Titanic", "O Senhor dos Anéis: Retorno do Rei", "E o Vento Levou"],
        resposta: ["1h 21m", "1h 28m", "2h 23m", "2h 34m", "3h 12m", "3h 14m", "3h 21m", "3h 58m"]
    },
    {
        type: "ano",
        theme: "Redes Sociais",
        elements: ["LinkedIn", "Facebook", "YouTube", "X/Twitter", "WhatsApp", "Instagram", "Snapchat", "TikTok"], // Padronizado
        resposta: ["2003", "2004", "2005", "2006", "2009", "2010", "2011", "2016"]
    },
    {
        type: "imdb",
        theme: "Séries",
        elements: ["Velma", "She-Hulk", "The Witcher", "Stranger Things", "The Office", "Game of Thrones", "Chernobyl", "Breaking Bad"],
        resposta: ["1.6", "5.3", "8.0", "8.7","9.0", "9.2", "9.3","9.5"]
    },
    {
        type: "ano",
        theme: "Invenções",
        elements: ["Fogo", "Roda", "Escrita", "Dinheiro", "Pólvora", "Imprensa", "Motor a Vapor", "Penicilina"],
        resposta: ["~1 mi AC", "~3500 AC", "~3200 AC", "~700 AC", "~900 DC", "1440", "1712", "1928"]
    },
    {
        type: "peso",
        theme: "Astronomia",
        elements: ["Lua", "Marte", "Vênus", "Terra", "Netuno", "Saturno", "Júpiter", "Sol"],
        resposta: ["0.01x", "0.1x", "0.8x", "1x", "17x", "95x", "317x", "333.000x"]
    },
    {
        type: "ano",
        theme: "Linguagens de programação",
        elements: ["Assembly", "C", "SQL", "C++", "Python", "Java", "JavaScript", "Rust"],
        resposta: ["1949", "1972", "1974", "1985", "1991", "1995", "1995", "2010"]
    },
    {
        type: "populacao",
        theme: "Redes sociais",
        elements: ["LinkedIn", "Pinterest", "X/Twitter", "Snapchat", "TikTok", "Instagram", "YouTube", "Facebook"], // Padronizado
        resposta: ["350 mi", "450 mi", "550 mi", "750 mi", "1.5 bi", "2 bi", "2.5 bi", "3 bi"]
    },
    {
        type: "altura",
        theme: "Arquitetura",
        elements: ["Cristo Redentor", "Estátua da Liberdade", "Pirâmide de Gizé", "Torre Eiffel", "Empire State", "One World Trade Center", "Shanghai Tower", "Burj Khalifa"],
        resposta: ["38m", "93m", "139m", "324m", "443m", "541m", "632m", "828m"]
    },
    {
        type: "ano",
        theme: "Filmes da Marvel",
        elements: ["Homem de Ferro", "Thor", "Vingadores", "Guardiões da Galáxia", "Guerra Civil", "Pantera Negra", "Vingadores: Ultimato", "Eternos"], // Padronizado
        resposta: ["2008", "2011", "2012", "2014", "2016", "2018", "2019", "2021"]
    },
    {
        type: "peso",
        theme: "Raças de Cachorro",
        elements: ["Chihuahua", "Pug", "Beagle", "Border Collie", "Husky Siberiano", "Golden Retriever", "Rottweiler", "São Bernardo"],
        resposta: ["2kg", "8kg", "11kg", "20kg", "27kg", "34kg", "50kg", "80kg"]
    },
    {
        type: "ano",
        theme: "História",
        elements: ["Guerra dos 100 Anos", "Independência do Brasil", "Guerra Civil Americana", "1ª Guerra Mundial", "2ª Guerra Mundial", "Guerra Fria", "Guerra do Vietnã", "Guerra do Golfo"],
        resposta: ["1337", "1822", "1861", "1914", "1939", "1947", "1955", "1990"]
    },
    {
        type: "peso",
        theme: "Pokémon",
        elements: ["Gastly", "Pikachu", "Charizard", "Venusaur", "Blastoise", "Snorlax", "Groudon", "Celesteela"],
        resposta: ["0.1kg", "6.0kg", "90.5kg", "100kg", "101.1kg", "460kg", "950kg", "999.9kg"]
    },
    {
        type: "bilheteria",
        theme: "Disney/Pixar",
        elements: ["Enrolados", "Divertida Mente", "O Rei Leão (1994)", "Procurando Dory", "Toy Story 4", "Frozen", "Frozen II", "O Rei Leão (2019)"],
        resposta: ["$592 mi", "$857 mi", "$968 mi", "$1.02 bi", "$1.07 bi", "$1.28 bi", "$1.45 bi", "$1.66 bi"]
    },
    {
        type: "seguidores",
        theme: "Celebridades",
        elements: ["Neymar Jr", "Taylor Swift", "Dwayne Johnson", "Kylie Jenner", "Selena Gomez", "Lionel Messi", "Cristiano Ronaldo", "Instagram"],
        resposta: ["~215 mi", "~270 mi", "~390 mi", "~400 mi", "~430 mi", "~480 mi", "~600 mi", "~650 mi"]
    },
    {
        type: "streams",
        theme: "Música",
        elements: ["Senorita", "Believer", "One Dance", "Rockstar", "Sunflower", "Shape of You", "Blinding Lights", "Despacito"],
        resposta: ["~2.5 bi", "~2.6 bi", "~2.7 bi", "~2.8 bi", "~2.9 bi", "~3.6 bi", "~3.8 bi", "~4.0 bi"]
    },
    {
        type: "vendas",
        theme: "Literatura",
        elements: ["O Diário de Anne Frank", "O Código Da Vinci", "O Pequeno Príncipe", "O Hobbit", "Harry Potter (Pedra Filosofal)", "O Senhor dos Anéis", "Dom Quixote", "Bíblia Sagrada"],
        resposta: ["35 mi", "80 mi", "140 mi", "100 mi", "120 mi", "150 mi", "500 mi", "5 bi"]
    },
    {
        type: "ano",
        theme: "Arte",
        elements: ["Mona Lisa", "A Ronda Noturna", "Moça com Brinco de Pérola", "A Noite Estrelada", "O Grito", "Abaporu", "A Persistência da Memória", "Guernica"],
        resposta: ["1503", "1642", "1665", "1889", "1893", "1928", "1931", "1937"]
    },
    {
        type: "gols",
        theme: "Futebol",
        elements: ["Neymar Jr", "Lewandowski", "Zlatan Ibrahimović", "Ferenc Puskás", "Pelé", "Romário", "Lionel Messi", "Cristiano Ronaldo"],
        resposta: ["~430", "~630", "~570", "~729", "~762", "~772", "~820", "~870"]
    },
    {
        type: "velocidade",
        theme: "Animais",
        elements: ["Tartaruga Gigante", "Humano (Médio)", "Usain Bolt (Max)", "Canguru", "Avestruz", "Guepardo", "Águia Real", "Falcão-peregrino"],
        resposta: ["0.3 km/h", "12 km/h", "44 km/h", "70 km/h", "72 km/h", "120 km/h", "320 km/h", "390 km/h"]
    },
    {
        type: "episodios",
        theme: "Animes",
        elements: ["Parasyte", "Death Note", "Fullmetal Alchemist: Brotherhood", "Attack on Titan", "Fairy Tail", "Naruto Shippuden", "One Piece", "Sazae-san"],
        resposta: ["24", "37", "64", "87", "328", "500", "1000+", "7000+"]
    },
    {
        type: "vendas",
        theme: "Games",
        elements: ["Wii U", "GameCube", "Xbox One", "Nintendo 3DS", "PlayStation Portable (PSP)", "Nintendo Switch", "Nintendo DS", "PlayStation 2"],
        resposta: ["13 mi", "21 mi", "~58 mi", "75 mi", "80 mi", "~139 mi", "154 mi", "155 mi"]
    },
    {
        type: "area",
        theme: "Geografia",
        elements: ["Vaticano", "Mônaco", "Maldivas", "Japão", "França", "Brasil", "China", "Rússia"],
        resposta: ["0.44 km²", "2 km²", "300 km²", "377 mil km²", "551 mil km²", "8.5 mi km²", "9.5 mi km²", "17 mi km²"]
    },
    {
        type: "bilheteria",
        theme: "Cinema",
        elements: ["Mulher-Gato", "Lanterna Verde", "Adão Negro", "O Homem de Aço", "Esquadrão Suicida", "Mulher-Maravilha", "Batman vs Superman", "Aquaman"],
        resposta: ["$82 mi", "$219 mi", "$393 mi", "$668 mi", "$746 mi", "$822 mi", "$873 mi", "$1.15 bi"]
    },
    {
        type: "duracao",
        theme: "Música BR",
        elements: ["Ai Se Eu Te Pego - Michel Teló", "Garota de Ipanema - Tom Jobim", "Evidências - Chitãozinho & Xororó", "Aquarela - Toquinho", "Construção - Chico Buarque", "Eduardo e Mônica - Legião Urbana", "Faroeste Caboclo - Legião Urbana", "Jesus Numa Moto (Ao Vivo) - Os Paralamas do Sucesso"]
,
        resposta: ["2:46", "3:13", "4:39", "5:30", "6:24", "4:32", "9:03", "12:30"]
    },
    {
        type: "calorias",
        theme: "Comida",
        elements: ["Água Mineral", "Alface", "Maçã", "Ovo Cozido", "Banana", "Pão Francês", "Big Mac", "Pizza Inteira"],
        resposta: ["0 kcal", "15 kcal", "52 kcal", "70 kcal", "100 kcal", "135 kcal", "502 kcal", "~2000 kcal"]
    },
    {
        type: "distancia",
        theme: "Astronomia",
        elements: ["Estação Espacial - ISS", "Hubble", "Lua", "Marte", "Sol", "Voyager 1", "Alpha Centauri", "Andrômeda"],
        resposta: ["400 km", "540 km", "384 mil km", "54 mi km", "150 mi km", "24 bi km", "4 anos-luz", "2.5 mi anos-luz"]
    },
    {
        type: "oscars",
        theme: "Cinema",
        elements: ["O Iluminado", "Cidadão Kane", "Gênio indomável" ,"Matrix", "O Resgate do Soldado Ryan", "La La Land", "Tudo em Todo Lugar", "O Senhor dos Anéis: O Retorno do Rei"],
        resposta: ["0", "1", "2", "4", "5", "6", "7", "11"]
    },
    {
        type: "duracao",
        theme: "Período Gestacional",
        elements: ["Hamster", "Coelho", "Cachorro", "Tigre", "Humano", "Vaca", "Girafa", "Elefante"],
        resposta: ["18 dias", "30 dias", "60 dias", "3.5 meses", "9 meses", "9.5 meses", "15 meses", "22 meses"]
    },
    {
        type: "gols",
        theme: "Futebol",
        elements: ["Kaká", "Bebeto", "Zico", "Romário", "Ronaldo Fenômeno", "Marta", "Pelé", "Neymar Jr"],
        resposta: ["29", "39", "48", "55", "62", "115", "77", "79"]
    },
    {
        type: "duracao",
        theme: "Geografia",
        elements: ["Rio Tâmisa", "Rio Sena", "Rio Colorado", "Rio São Francisco", "Rio Mississipi", "Rio Yangtzé", "Rio Amazonas", "Rio Nilo"],
        resposta: ["346 km", "777 km", "2.330 km", "2.830 km", "3.730 km", "6.300 km", "6.400 km", "6.650 km"]
    },
    {
        type: "populacao",
        theme: "Estádios Esportivos",
        elements: ["Vila Belmiro", "Allianz Parque", "Arena Neo Química", "La Bombonera", "Old Trafford", "Maracanã", "Santiago Bernabéu", "Camp Nou"],
        resposta: ["~16 mil", "~43 mil", "~49 mil", "~54 mil", "~74 mil", "~78 mil", "~81 mil", "~99 mil"]
    },
    {
        type: "ano",
        theme: "Tecnologia",
        elements: ["MS-DOS", "Linux/Kernel)", "Windows 95", "MacOS X", "Windows XP", "Android", "Windows 10", "Windows 11"],
        resposta: ["1981", "1991", "1995", "2001", "2001", "2008", "2015", "2021"]
    },
    {
        type: "altura",
        theme: "Arquitetura BR",
        elements: ["Edifício Copan", "Edifício Itália", "Mirante do Vale", "Altino Arantes", "Kingdom Park", "Infinity Coast", "Yachthouse", "One Tower"],
        resposta: ["118m", "165m", "170m", "161m", "181m", "234m", "281m", "290m"]
    },
    {
        type: "velocidade",
        theme: "Cotidiano",
        elements: ["Skate", "Bicicleta", "Carro - Estrada", "Trem Bala", "Carro de F1", "Avião Comercial", "Caça Supersônico", "Ônibus Espacial"],
        resposta: ["15 km/h", "25 km/h", "110 km/h", "320 km/h", "370 km/h", "900 km/h", "2.400 km/h", "28.000 km/h"]
    },
    {
        type: "vendas",
        theme: "Música",
        elements: ["Rehab - Amy Winehouse", "Halo - Beyoncé", "Poker Face - Lady Gaga", "Rolling in the Deep - Adele", "Uptown Funk", "Old Town Road", "Despacito", "White Christmas"],
        resposta: ["5 mi", "10 mi", "14 mi", "20 mi", "20 mi", "18 mi", "24 mi", "50 mi"]
    },
    {
        type: "ano",
        theme: "Star Wars",
        elements: ["Uma Nova Esperança", "O Império Contra-Ataca", "O Retorno de Jedi", "A Ameaça Fantasma", "A Vingança dos Sith", "O Despertar da Força", "Rogue One", "A Ascensão Skywalker"],
        resposta: ["1977", "1980", "1983", "1999", "2005", "2015", "2016", "2019"]
    },
    {
        type: "lispan",
        theme: "Animais",
        elements: ["Mosca", "Rato", "Coelho", "Gato Doméstico", "Leão", "Chimpanzé", "Elefante Africano", "Tartaruga de Galápagos"],
        resposta: ["28 dias", "2 anos", "10 anos", "15 anos", "20 anos", "40 anos", "70 anos", "170 anos"]
    },
    {
        type: "duracao",
        theme: "Séries de TV (n de temporadas)",
        //elementos devem estar em ordem de duração crescente, do menor para o mais longo
        elements: ["Fleabag", "Chernobyl", "The Queen's Gambit", "Stranger Things", "Breaking Bad", "Game of Thrones", "Grey's Anatomy", "The Simpsons"],
        resposta: ["1 temporada", "1 temporada", "2 temporadas", "4 temporadas", "5 temporadas", "8 temporadas", "19 temporadas", "34 temporadas"]
    },
    {
        type: "peso",
        theme: "Frutas",
        elements: ["Morango", "Limão", "Maçã", "Laranja", "Abacaxi", "Melancia", "Abóbora", "Coco"],
        resposta: ["~20g", "~100g", "~150g", "~200g", "~1kg", "~2kg", "~5kg", "~15kg"]
    },
    {
        type: "peso",
        theme: "Animais Marinhos",
        elements: ["Água-viva", "Peixe-palhaço", "Tartaruga Marinha", "Golfinho", "Foca", "Leão-marinho", "Orca", "Baleia Azul"],
        resposta: ["~2kg", "~250g", "~150kg", "~300kg", "~400kg", "~1.000kg", "~6.000kg", "~140.000kg"]
    }
    //crie novas entradas aqui seguindo o mesmo formato, sem repetir a mesma sequência de elementos e sempre com 8 elementos ordenados do menor para o maior + as respostas corretas.
];

export const GameData = {
    getLevel: (dateObj, lang = 'pt') => {
        const start = new Date('2024-01-01T00:00:00'); 
        const current = new Date(dateObj);
        current.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);

        const diffTime = current - start;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let index = diffDays % DB.length;
        if (index < 0) index = (index + DB.length) % DB.length;

        const rawLevel = DB[index];
        const typeKey = rawLevel.type;
        
        // Texto do Prompt principal
        const promptText = TYPE_TRANSLATIONS[typeKey] 
            ? TYPE_TRANSLATIONS[typeKey][lang === 'pt-BR' ? 'pt' : 'en'] 
            : `Order by ${typeKey}`;

        // Itens
        const orderedItems = rawLevel.elements.map((name, i) => ({
            id: i,
            name: name,
            value: rawLevel.resposta[i],
            imgUrl: null
        }));

        const seed = OrkaMath.getDateSeed(current); 
        const rng = OrkaMath.createSeededRNG(seed);
        
        let shuffled = [...orderedItems];
        shuffled = OrkaMath.shuffle(shuffled, rng);
        shuffled = OrkaMath.shuffle(shuffled, rng);

        console.log(`📅 Jogo carregado para: ${current.toLocaleDateString()} | Index: ${index} | Tema: ${rawLevel.theme}`);

        return {
            prompt: promptText,
            theme: rawLevel.theme || "Geral", // Passamos o tema
            type: rawLevel.type,
            items: shuffled, 
            totalItems: orderedItems.length
        };
    }
};