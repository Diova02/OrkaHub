// cards_db.js (Simulando o JSON que virá do seu banco/arquivo)

export const CARDS_DB = [
    // --- CRIATURAS BASE ---
    {
        id: "AU - 001",
        nome: { pt: "Recruta Escudo-de-Carvalho" },
        custo: { green: 1 },
        tipo: "criatura",
        subtipo: "base",
        efeito: [], 
        raridade: "comum",
        raca: "soldado",
        ataque: 1,
        defesaA: 3,
        defesaB: 1
    },
    {
        id: "AU - 002",
        nome: { pt: "Piromante Impaciente" },
        custo: { red: 2 },
        tipo: "criatura",
        subtipo: "base",
        efeito: ["damageFrontlineOnSummon"], // Causa dano ao entrar
        raridade: "incomum",
        raca: "mago",
        ataque: 3,
        defesaA: 1,
        defesaB: 1
    },
    
    // --- CRIATURAS METAMORFAS (Exigem Evolução) ---
    {
        id: "AU - 003",
        nome: { pt: "General Forja-Sangue" },
        custo: { red: 3, green: 1 }, // Custo misto
        tipo: "criatura",
        subtipo: "metamorfa",
        efeito: ["boostAlliedAttack"], 
        raridade: "rara",
        raca: "soldado", // Pode exigir um vassalo da raça 'soldado'
        ataque: 5,
        defesaA: 4,
        defesaB: 3
    },

    // --- CARTAS AUXILIARES ---
    {
        id: "AU - 004",
        nome: { pt: "Golpe de Estado Prematuro" },
        custo: { yellow: 2 },
        tipo: "auxiliar",
        tipo_ativacao: "inimigo", // Requer clicar em uma carta inimiga
        efeito: ["dealDirectDamage", "selfDestroy"], 
        raridade: "incomum"
    },
    {
        id: "AU - 005",
        nome: { pt: "Bênção da Coroa" },
        custo: { blue: 1 },
        tipo: "auxiliar",
        tipo_ativacao: "aliado", // Requer clicar em uma criatura aliada
        efeito: ["healDefenseA", "selfDestroy"],
        raridade: "comum"
    },
    {
        id: "AU - 006",
        nome: { pt: "Selo de Fartura" },
        custo: { yellow: 1 },
        tipo: "auxiliar",
        tipo_ativacao: "campo", // Efeito global, não precisa de alvo específico
        efeito: ["generateExtraEnergy", "sealOnField"], // Não tem selfDestroy, fica no campo/selada
        raridade: "rara"
    }
];

// Função auxiliar para buscar a carta no "banco"
export const getCardIdentity = (dbId) => CARDS_DB.find(c => c.id === dbId);