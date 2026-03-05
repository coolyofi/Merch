import { login, register, fetchMe } from './api.js'

const AUTH_TOKEN_KEY = 'merch-auth-token'

let currentTab = 'login'

// ── Tab switch ──────────────────────────────────────────────────────────────
window.switchTab = function(tab) {
  currentTab = tab
  document.getElementById('tab-login').classList.toggle('active', tab === 'login')
  document.getElementById('tab-register').classList.toggle('active', tab === 'register')
  document.getElementById('submit-btn').textContent = tab === 'login' ? '登录' : '注册'
  document.getElementById('field-name').style.display = tab === 'register' ? 'flex' : 'none'
  setMsg('')
}

// ── Submit ──────────────────────────────────────────────────────────────────
window.doSubmit = async function() {
  const email = document.getElementById('input-email').value.trim()
  const pwd   = document.getElementById('input-pwd').value
  if (!email || !pwd) { setMsg('请填写邮箱和密码'); return }

  const btn = document.getElementById('submit-btn')
  btn.disabled = true
  setMsg('')
  try {
    let token
    if (currentTab === 'login') {
      const res = await login(email, pwd)
      token = res.token
    } else {
      const name = document.getElementById('input-name').value.trim() || undefined
      const res = await register({ email, password: pwd, name })
      token = res.token
    }
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    setMsg('成功，正在跳转…', true)
    setTimeout(() => { window.location.href = '/app/' }, 600)
  } catch (e) {
    setMsg(e.message || '操作失败')
    btn.disabled = false
  }
}

// ── Logout ──────────────────────────────────────────────────────────────────
window.doLogout = function() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  showAuthCard()
}

// ── Go to app ───────────────────────────────────────────────────────────────
window.goToApp = function() {
  window.location.href = '/app/'
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function setMsg(msg, ok = false) {
  const el = document.getElementById('auth-msg')
  el.textContent = msg
  el.className = 'login-msg' + (ok ? ' ok' : '')
}

function showAuthCard() {
  document.getElementById('auth-card').style.display = 'flex'
  document.getElementById('loggedin-card').style.display = 'none'
}

function showLoggedIn(email) {
  document.getElementById('auth-card').style.display = 'none'
  document.getElementById('loggedin-card').style.display = 'flex'
  document.getElementById('user-display').textContent = email
}

// ── Enter key support ────────────────────────────────────────────────────────
function onEnter(e) { if (e.key === 'Enter') window.doSubmit() }
document.getElementById('input-email').addEventListener('keydown', onEnter)
document.getElementById('input-pwd').addEventListener('keydown', onEnter)
document.getElementById('input-name').addEventListener('keydown', onEnter)

// ── Init ────────────────────────────────────────────────────────────────────
async function init() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (!token) { showAuthCard(); return }
  try {
    const me = await fetchMe(token)
    showLoggedIn(me.email)
  } catch {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    showAuthCard()
  }
}

init()
