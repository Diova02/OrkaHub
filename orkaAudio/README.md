# 🐋 OrkaAudio v2.0
Uma engine de áudio espacial leve e poderosa para jogos web no Orka Hub.

## ✨ Destaques
- **Bus System:** Controle volumes e efeitos (SFX/Music) separadamente.
- **Spatial Audio:** Som 2D dinâmico baseado em distância (Atenuação/Pan).
- **Auto-Save:** Salva preferências de volume automaticamente.
- **Cinematic Transitions:** Troca de música com Pitch Bend e Crossfade.

## 🚀 Início Rápido

1. **Importação:**

`import { OrkaAudio } from './OrkaAudio.js';`

2. **Inicialização (Obrigatório via clique do usuário):**

```
button.onclick = async () => {
    await OrkaAudio.init();
};
```

3. **Carregar e Tocar:**

```
await OrkaAudio.load('pulo', 'assets/jump.mp3');
OrkaAudio.playSFX('pulo');
```

## 📱 Suporte Mobile
OrkaAudio inclui um sistema automático de "Unlock" para iOS e Android. Basta chamar init() em qualquer interação do usuário.