// =========================
// ORKA CLOUD — Analytics Core
// =========================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle&target=browser'

// 🔐 Conexão com o Supabase

const supabaseUrl = 'https://lvwlixmcgfuuiizeelmo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2d2xpeG1jZ2Z1dWlpemVlbG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTUwMzQsImV4cCI6MjA4MzQ3MTAzNH0.qa0nKUXewE0EqUePwfzQbBOaHypRqkhUxRnY5qgsDbo'
const supabase = createClient(supabaseUrl, supabaseKey)

// =========================
// UTILIDADES
// =========================

// Retorna ou cria um ID único para o jogador
function getPlayerId() {
  let id = localStorage.getItem('orka_player_id')

  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('orka_player_id', id)
  }

  return id
}

// Retorna o nickname salvo (se existir)
function getNickname() {
  return localStorage.getItem('orka_nickname')
}

// =========================
// REGISTRO DE JOGADOR
// =========================

async function registerPlayer(playerId) {
  await supabase
    .from('players')
    .insert({ id: playerId })
    .select()
    .maybeSingle()
}

// =========================
// NICKNAME
// =========================

async function askForNickname(playerId) {
  let nickname = getNickname()

  if (!nickname) {
    nickname = prompt('Como você quer ser chamado? (opcional)')

    if (nickname && nickname.trim() !== '') {
      localStorage.setItem('orka_nickname', nickname)

      await supabase
        .from('players')
        .update({ nickname })
        .eq('id', playerId)
    }
  }
}

async function updateNickname(newNickname) {
  const playerId = getPlayerId()

  localStorage.setItem('orka_nickname', newNickname)

  await supabase
    .from('players')
    .update({ nickname: newNickname })
    .eq('id', playerId)
}

// =========================
// SESSÕES
// =========================

async function startSession(gameId) {
  const sessionId = crypto.randomUUID()
  const playerId = getPlayerId()

  await registerPlayer(playerId)
  await askForNickname(playerId)

  await supabase.from('sessions').insert({
    id: sessionId,
    player_id: playerId,
    game_id: gameId
  })

  return sessionId
}

async function endSession(sessionId) {
  await supabase
    .from('sessions')
    .update({ ended_at: new Date() })
    .eq('id', sessionId)
}

// =========================
// API PÚBLICA
// =========================

export const OrkaCloud = {
  startSession,
  endSession,
  getNickname,
  updateNickname
}
