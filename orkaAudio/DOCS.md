# 🔊 OrkaAudio API v2.0 - Documentação Técnica

O OrkaAudio é um motor de áudio robusto baseado na Web Audio API, projetado para facilitar o gerenciamento de sons, trilhas sonoras e efeitos em aplicações web e jogos.

---

# 🚀 Início Rápido

Para que o nosso motor funcione, seguimos 3 passos simples:
1- Inicializamos o motor.
2- Carregamos os assets.
3- Tocamos os sons onde for necessário.

Veja no exemplo abaixo:

```javascript
import { OrkaAudio } from './orka-audio.js';

// Carregar sons
await OrkaAudio.loadAll({
  'click': 'assets/sfx/click.mp3',
  'theme': 'assets/music/main_theme.ogg'
});

// Tocar um som
OrkaAudio.playSFX('click');
```

---

# 🛠️ Ciclo de Vida e Configuração

Nosso motor possui listeners de inicialização automática aplicados diretamente no momento da importação ao seu javascript.
Muitos navegadores são autoritários em relação à execução de som automática, por isso, em caso de falha do listener padrão, considere usar a função init();

## init()

Inicializa o AudioContext e restaura volumes salvos.  
O motor tenta se inicializar automaticamente no primeiro clique do usuário, mas você pode chamar este método manualmente.

**Retorno:**  
Promise<void>

```javascript
//exemplo
window.addEventListener('click', startAudio, { once: true })
```

---

## enableConfigSave(bool)

Ativa ou desativa a persistência automática dos volumes no localStorage.
O padrão é "true", assim todos os volumes podem ser consultados diretamente usando getVolume();

**Uso:**
```javascript
OrkaAudio.enableConfigSave(false); // Desativa o salvamento.
```

---

## _unlockAudio()

Método interno que anexa listeners de eventos (click, touchstart) para desbloquear o áudio em navegadores mobile (política de autoplay).  
Chamado automaticamente pelo init.

---

# 📂 Carregamento de Assets

## load(key, path)

Carrega um único arquivo de áudio e o armazena no cache.

**Exemplo:**
```javascript
await OrkaAudio.load('jump', 'sounds/jump.wav');
```

---

## loadAll(soundMap)

Carrega múltiplos sons a partir de um objeto chave/valor. (Recomendado!)

**Exemplo:**
```javascript
const assets = { explosion: 'sfx/boom.mp3', bg: 'music/lvl1.mp3' };
await OrkaAudio.loadAll(assets);
```

---

# 🎛️ Mixagem e Barramentos (Buses)

## createBus(name)

Cria um canal de áudio personalizado (ex: 'vozes', 'ambiente') com seu próprio nó de ganho, efeitos e analisador.

**Uso:**
```javascript
OrkaAudio.createBus('ui');
```

---

## setVolume(bus, val)

Define o volume de um canal específico ou do 'master'.

**Valores:** 0.0 a 1.0.

**Exemplo:**
```javascript
OrkaAudio.setVolume('music', 0.5);
```

---

## setPlaybackRate(busName, rate)

Altera a velocidade de reprodução de todas as instâncias ativas de um bus e define a velocidade para futuros sons.

**Exemplo:**
```javascript
OrkaAudio.setPlaybackRate('sfx', 0.5); // Efeito de câmera lenta.
```

---

# ✨ Efeitos de Áudio

## setEffect(effect, busName)

Aplica filtros pré-definidos a um canal.

**Efeitos:**
- 'normal'
- 'muffled' (abafado/lowpass)
- 'radio' (telefone/bandpass)

**Exemplo:**
```javascript
OrkaAudio.setEffect('muffled', 'music');
```

---

## setMuffled(bus, active) / setRadio(bus, active)

Atalhos semânticos para os efeitos.

**Exemplo:**
```javascript
OrkaAudio.setMuffled('sfx', true);
```

---

## getEffect(bus)

Retorna o nome do efeito atualmente ativo no canal.

---

# 🎵 Reprodução e Controle

## play(key, busName, options)

Método base para reprodução.

**Opções:**
```javascript
{ loop: boolean, volume: number }
```

**Retorno:**  
Objeto instance (usado para parar ou manipular o som individualmente).

---

## playSFX(key, options)

Atalho para tocar sons curtos no canal 'sfx' sem loop.

---

## playMusic(key, options)

Toca uma música no canal 'music' com loop.

- Se a música já estiver tocando, ela não é reiniciada.
- Se houver outra música tocando, faz o switchMusic automaticamente.

---

## switchMusic(key, options)

Realiza uma transição suave entre músicas.

- A trilha atual sofre um Pitch Bend Down (efeito de disco parando) e Fade Out
- A nova entra com Fade In

**Opção extra:**
```javascript
{ duration: number }
```

---

## stop(instance) / stopAll(busName)

Para uma instância específica ou todos os sons de um canal (ou globalmente se busName for nulo).

---

# 🌊 Fades e Dinâmica

## fade(target, targetVol, duration)

Realiza um fade linear no volume.

**Target pode ser:**
- Nome de um bus ('music')
- Uma instância retornada pelo play

**Exemplo:**
```javascript
OrkaAudio.fade('music', 0, 2.0); // Fade out de 2 segundos na música.
```

---

## fadeAll(busName, targetVol, duration)

Semelhante ao fade, focado especificamente em canais.

---

# 🛠️ Funcionalidades Avançadas

## setFollow(instance, sourceObj, listenerObj, maxDist)

Cria um efeito de Áudio Espacial 2D.

O volume da instância será calculado com base na distância entre o sourceObj e o listenerObj.

**Objetos:**
Devem possuir propriedades .x e .y.

**Exemplo:**
```javascript
OrkaAudio.setFollow(shot, player, enemy, 300);
```

---

## getFrequencyData(busName)

Obtém os dados de frequência (FFT) em tempo real do canal solicitado.

**Uso:**  
Ideal para criar Visualizadores de Áudio em Canvas.

**Retorno:**  
Uint8Array.

---

# 📝 Resumo de Estrutura de Dados

Ao manipular uma instância (retornada pelo play), você tem acesso a:

```javascript
instance.source // O AudioBufferSourceNode
instance.gain   // O GainNode individual daquele som
instance.bus    // Nome do canal vinculado
instance.key    // A chave do som carregado
```