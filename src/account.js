import { getApiBase, login, register, fetchMe } from './api.js'

const AUTH_TOKEN_KEY = 'merch-auth-token'
const STORE_ID_KEY = 'merch-store-id'

let auth = { token: null, user: null, stores: [], activeStoreId: null }

function render() {
  const status = document.getElementById('auth-status')
  const sel = document.getElementById('store-select')
  if (!auth.user) {
    status.textContent = `未登录 · API ${getApiBase()}`
    sel.innerHTML = '<option value="">无门店</option>'
    return
  }
  status.textContent = `已登录：${auth.user.email}`
  sel.innerHTML = auth.stores.length
    ? auth.stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
    : '<option value="">无门店</option>'
  if (auth.activeStoreId && auth.stores.some(s => s.id === auth.activeStoreId)) {
    sel.value = auth.activeStoreId
  } else if (auth.stores[0]) {
    auth.activeStoreId = auth.stores[0].id
    sel.value = auth.activeStoreId
    localStorage.setItem(STORE_ID_KEY, auth.activeStoreId)
  }
}

async function hydrateFromToken(token) {
  const me = await fetchMe(token)
  auth.token = token
  auth.user = { id: me.id, email: me.email, name: me.name }
  auth.stores = (me.memberships || []).map(m => ({ id: m.store.id, name: m.store.name, role: m.role }))
  const saved = localStorage.getItem(STORE_ID_KEY)
  auth.activeStoreId = saved && auth.stores.some(s => s.id === saved) ? saved : auth.stores[0]?.id || null
  if (auth.activeStoreId) localStorage.setItem(STORE_ID_KEY, auth.activeStoreId)
  render()
}

async function doLogin() {
  const email = prompt('邮箱')
  const pwd = prompt('密码')
  if (!email || !pwd) return
  try {
    const res = await login(email, pwd)
    localStorage.setItem(AUTH_TOKEN_KEY, res.token)
    await hydrateFromToken(res.token)
    alert('登录成功')
  } catch (e) {
    alert(e.message || '登录失败')
  }
}

async function doRegister() {
  const email = prompt('注册邮箱')
  const pwd = prompt('注册密码（至少8位）')
  const storeName = prompt('门店名（可留空）')
  if (!email || !pwd) return
  try {
    const res = await register({ email, password: pwd, storeName: storeName || undefined })
    localStorage.setItem(AUTH_TOKEN_KEY, res.token)
    await hydrateFromToken(res.token)
    alert('注册并登录成功')
  } catch (e) {
    alert(e.message || '注册失败')
  }
}

function doLogout() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(STORE_ID_KEY)
  auth = { token: null, user: null, stores: [], activeStoreId: null }
  render()
}

function bind() {
  document.getElementById('login-btn').onclick = doLogin
  document.getElementById('register-btn').onclick = doRegister
  document.getElementById('logout-btn').onclick = doLogout
  document.getElementById('store-select').onchange = (e) => {
    auth.activeStoreId = e.target.value || null
    if (auth.activeStoreId) localStorage.setItem(STORE_ID_KEY, auth.activeStoreId)
    render()
  }
}

async function init() {
  bind()
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (!token) {
    render()
    return
  }
  try {
    await hydrateFromToken(token)
  } catch {
    doLogout()
  }
}

init()
