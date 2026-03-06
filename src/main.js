import './style.css'
import { initUI as initWorkspace, restoreSession, AUTH_TOKEN_KEY } from './ui.js'
import { initAccount } from './account.js'

const views = {
  app: document.getElementById('view-app'),
  login: document.getElementById('view-login'),
}

let workspaceInited = false
let rulesInited = false

function showView(key) {
  Object.entries(views).forEach(([k, el]) => {
    if (el) el.style.display = k === key ? 'block' : 'none'
  })
}

async function ensureAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) return token
  return null
}

async function go(route) {
  const token = await ensureAuth()
  if (route === 'app') {
    if (!token) { showView('login'); location.hash = '#/login'; return }
  }
  if (route === 'app') {
    showView('app')
    if (!workspaceInited) {
      workspaceInited = true
      initWorkspace()
      await restoreSession()
    }
    return
  }
  // login or default
  showView('login')
}

function parseHash() {
  const h = location.hash.replace('#','')
  if (h.startsWith('/app')) return 'app'
  if (h.startsWith('/login')) return 'login'
  return 'app'
}

window.addEventListener('hashchange', () => go(parseHash()))
window.addEventListener('auth:login', async () => { await restoreSession(); go('app') })
window.addEventListener('auth:logout', () => {
  workspaceInited = false
  rulesInited = false
  showView('login')
  location.hash = '#/login'
})

document.addEventListener('DOMContentLoaded', () => {
  initAccount(() => go('app'))
  go(parseHash())
})
