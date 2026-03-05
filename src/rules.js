import { login, fetchRules, createRule, updateRuleStatus } from './api.js'
import { getRuleSet, DEFAULT_RULE_VERSION } from './calc.js'

const AUTH_TOKEN_KEY = 'merch-auth-token'

let token = localStorage.getItem(AUTH_TOKEN_KEY) || null
let rules = []

async function ensureLogin() {
  if (token) return token
  const email = prompt('登录邮箱')
  const pwd = prompt('密码')
  if (!email || !pwd) return null
  const res = await login(email, pwd)
  token = res.token
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  return token
}

function renderRules() {
  const tbody = document.querySelector('#rule-table tbody')
  tbody.innerHTML = ''
  rules.forEach((r) => {
    const tr = document.createElement('tr')
    const canReview = r.status === 'DRAFT'
    const canPublish = r.status === 'REVIEW'
    tr.innerHTML = `
      <td>${r.version}</td>
      <td>${r.status}</td>
      <td>${r.publishedAt ? new Date(r.publishedAt).toLocaleString() : '—'}</td>
      <td>
        <button class="btn-ghost" data-id="${r.id}" data-action="review" ${canReview ? '' : 'disabled'}>提审</button>
        <button class="btn-ghost" data-id="${r.id}" data-action="publish" ${canPublish ? '' : 'disabled'}>发布</button>
      </td>
    `
    tbody.appendChild(tr)
  })

  tbody.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        const id = btn.dataset.id
        const target = btn.dataset.action === 'review' ? 'REVIEW' : 'PUBLISHED'
        await updateRuleStatus(token, id, target)
        await loadRules()
      } catch (e) {
        showMsg(e.message || '状态更新失败')
      }
    }
  })
}

function showMsg(msg) {
  document.getElementById('rule-msg').textContent = msg
}

async function loadRules() {
  rules = await fetchRules(token)
  renderRules()
}

async function createDraft() {
  const version = document.getElementById('rule-version-input').value.trim()
  if (!version) return showMsg('请输入规则版本号')
  try {
    const payload = getRuleSet(DEFAULT_RULE_VERSION)
    await createRule(token, {
      version,
      description: 'Draft from baseline',
      payload,
      status: 'DRAFT',
    })
    showMsg('规则草稿创建成功')
    document.getElementById('rule-version-input').value = ''
    await loadRules()
  } catch (e) {
    showMsg(e.message || '创建失败')
  }
}

async function init() {
  try {
    token = await ensureLogin()
    if (!token) return showMsg('未登录')
    document.getElementById('rule-create-btn').onclick = createDraft
    document.getElementById('refresh-rules-btn').onclick = loadRules
    await loadRules()
  } catch (e) {
    showMsg(e.message || '加载失败')
  }
}

init()
