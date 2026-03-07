export const GAME_STATE = {
    PEACE: 'PEACE',
    WAR: 'WAR',
    ENDED: 'ENDED'
};

export const TURN_PHASE = {
    DRAW: 1,
    ENERGY: 2,
    SUMMON: 3,
    AUXILIARY: 4,
    ADVANCE: 5,
    CONFLICT: 6 // Pode ser Desafio (Paz) ou Ataque (Guerra)
};

export const ZONES = {
    DECK: 'DECK',
    HAND: 'HAND',
    ROYAL_LINE: 'ROYAL_LINE',
    FRONT_LINE: 'FRONT_LINE',
    GRAVEYARD: 'GRAVEYARD'
};

export const POSITION = {
    STANDING: 'STANDING', // Em pé (Defesa A)
    FALLEN: 'FALLEN'      // Caída (Defesa B)
};