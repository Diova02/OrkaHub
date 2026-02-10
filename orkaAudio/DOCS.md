# 📚 Documentação Técnica OrkaAudio

## 🎛️ Mixagem e Controle

### `setVolume(bus, value)`
Ajusta o ganho de um canal específico.
- **bus**: `'master'`, `'music'`, ou `'sfx'`.
- **value**: Float entre `0.0` e `1.0`.

### `setEffect(effect, bus)`
Aplica filtros de áudio em tempo real ao canal.
- **effect**: `'normal'`, `'muffled'` (passa-baixa), `'radio'` (passa-banda).
- **bus**: `'music'` ou `'sfx'`.

---

## 🎵 Reprodução e Transição

### `playMusic(key, options)`
Toca uma música em loop no canal de música. Se houver uma música tocando, ela será interrompida.
- **options**: `{ volume, loop: true }`.

### `switchMusic(key, options)`
A função mais poderosa. Faz a transição entre a trilha atual e uma nova.
- **options**: 
    - `duration`: Tempo da transição (padrão 2s).
    - `useBend`: Ativa o efeito de "vinil parando" na música que sai.

---

## 🔊 Áudio Espacial

### `setFollow(instance, source, listener, maxDist)`
Vincula o volume de um som à distância entre dois objetos.
- **instance**: O objeto retornado pela função `play`.
- **source**: Objeto com coordenadas `{x, y}` (Ex: Inimigo).
- **listener**: Objeto com coordenadas `{x, y}` (Ex: Player).
- **maxDist**: Distância em pixels onde o som se torna inaudível.

---

## 🛠️ Utilidades

### `enableConfigSave(bool)`
Define se as alterações de volume devem ser persistidas no `localStorage` sob a chave `OrkaAudio_Volumes`.