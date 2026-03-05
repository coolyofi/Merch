import { login, register, fetchMe } from './api.js'
import { AUTH_TOKEN_KEY } from './ui.js'

let currentTab = 'login'
let onAuthed = null

export function initAccount(onLogin) {
  onAuthed = onLogin
  bindAccountUI()
  initState()
}

function bindAccountUI() {
  window.switchTab = switchTab
  window.doSubmit = doSubmit
  window.doLogout = doLogout
  window.goToApp = () => { location.hash = '#/app' }
  document.getElementById('input-email')?.addEventListener('keydown', onEnter)
  document.getElementById('input-pwd')?.addEventListener('keydown', onEnter)
  document.getElementById('input-name')?.addEventListener('keydown', onEnter)
}

function switchTab(tab) {
  currentTab = tab
  document.getElementById('tab-login').classList.toggle('active', tab === 'login')
  document.getElementById('tab-register').classList.toggle('active', tab === 'register')
  document.getElementById('submit-btn').textContent = tab === 'login' ? '登录' : '注册'
  document.getElementById('field-name').style.display = tab === 'register' ? 'flex' : 'none'
  setMsg('')
}

async function doSubmit() {
  const email = document.getElementById('input-email').value.trim()
  const pwd   = document.getElementById('input-pwd').value
  if (!email || !pwd) { setMsg('请填写邮箱和密码'); return }
  if (!/^\S+@\S+\.\S+$/.test(email)) { setMsg('请输入正确的邮箱格式'); return }
  if (pwd.length < 8) { setMsg('密码至少需要 8 位'); return }

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
    setMsg('成功，正在进入…', true)
    if (typeof onAuthed === 'function') onAuthed(token)
    window.dispatchEvent(new CustomEvent('auth:login', { detail: { token, email } }))
  } catch (e) {
    let msg = e.message || '操作失败'
    if (e.issues && Array.isArray(e.issues)) {
      msg += '\n' + e.issues.map(i => i.message || i.code || JSON.stringify(i)).join('\n')
    }
    setMsg(msg)
    btn.disabled = false
  }
}

function doLogout() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  showAuthCard()
  window.dispatchEvent(new CustomEvent('auth:logout'))
}

function setMsg(msg, ok = false) {
  const el = document.getElementById('auth-msg')
  if (!el) return
  el.textContent = msg
  el.className = 'login-msg' + (ok ? ' ok' : '')
}

function showAuthCard() {
  document.getElementById('auth-card')?.style.setProperty('display','flex')
  document.getElementById('loggedin-card')?.style.setProperty('display','none')
}

function showLoggedIn(email) {
  document.getElementById('auth-card')?.style.setProperty('display','none')
  document.getElementById('loggedin-card')?.style.setProperty('display','flex')
  const el = document.getElementById('user-display')
  if (el) el.textContent = email
}

function onEnter(e) { if (e.key === 'Enter') doSubmit() }

async function initState() {
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
