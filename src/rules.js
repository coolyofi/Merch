import { fetchRules, createRule, updateRuleStatus } from './api.js'
import { getRuleSet, DEFAULT_RULE_VERSION } from './calc.js'
import { AUTH_TOKEN_KEY } from './ui.js'

let token = null
let rules = []
let inited = false

export function setRulesToken(t) {
  token = t
}

function showMsg(msg) {
  const el = document.getElementById('rule-msg')
  if (el) el.textContent = msg
}

function renderRules() {
  const tbody = document.querySelector('#rule-table tbody')
  if (!tbody) return
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

async function loadRules() {
  if (!token) token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (!token) { showMsg('请先登录'); return }
  rules = await fetchRules(token)
  renderRules()
}

async function createDraft() {
  const versionEl = document.getElementById('rule-version-input')
  const version = versionEl?.value.trim()
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
    versionEl.value = ''
    await loadRules()
  } catch (e) {
    showMsg(e.message || '创建失败')
  }
}

export function initRules() {
  if (inited) return
  inited = true
  document.getElementById('rule-create-btn')?.addEventListener('click', createDraft)
  document.getElementById('refresh-rules-btn')?.addEventListener('click', loadRules)
  loadRules()
}
