// Aria 背景视频插件 (bg-video) v14 — 完整版：设置页 + 侧边栏入口 + Ctrl+K 命令
// 设置项：视频路径 / 视频可见度 / 视频水平位置 / 侧栏透明度 / 总开关
// 配置通过 ctx.storage 持久化，重启后依然生效；设置页改完即时重绘。
import { jsx, jsxs, Fragment } from 'react/jsx-runtime'
import { useState, useEffect } from 'react'
import {
  host,
  Button,
  Input,
  Switch,
  Tip,
  SegmentedControl,
  PALETTE_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA
} from '@hermes/plugin-sdk'

const ID = 'bg-video'

// 模块级运行时配置（内存态，注入循环读取；storage 为持久层）

// ── 打包版：默认视频用插件自带 bg-default.mp4，自动定位 ───────────
// 优先用设置里填的路径；未填则用 window.hermesDesktop.desktopPluginsRoot()
// 拼出本插件目录下的 bg-default.mp4（别人下载后也能直接用）。
let DEFAULT_PATH = '' // 运行时解析

async function resolveDefaultPath() {
  if (DEFAULT_PATH) return DEFAULT_PATH
  try {
    const root = await window.hermesDesktop?.desktopPluginsRoot?.()
    if (root) {
      DEFAULT_PATH = root.replace(/[\\/]+$/, '') + '\\bg-video\\bg-default.mp4'
      return DEFAULT_PATH
    }
  } catch (e) {
    /* ignore */
  }
  return ''
}

let cfg = {
  enabled: true,
  videoPath: '', // 空 = 用插件自带 bg-default.mp4
  opacity: 0.2, // 视频可见度
  videoPosition: 50, // 视频内容在窗口内的水平位置 0=最左 50=居中 100=最右
  sidebarAlpha: 0.6 // 侧栏深蓝不透明度
}

function loadCfg(ctx)
    // 解析默认视频路径（打包自带的 bg-default.mp4）
    if (!cfg.videoPath) {
      resolveDefaultPath().then(p => {
        if (p && !cfg.videoPath) {
          cfg.videoPath = p
          saveCfg(ctx)
        }
      })
    } {
  try {
    const s = ctx.storage
    cfg = {
      enabled: s.get('enabled', true),
      videoPath: s.get('videoPath', ''),
      opacity: s.get('opacity', 0.2),
      videoPosition: s.get('videoPosition', 50),
      sidebarAlpha: s.get('sidebarAlpha', 0.6)
    }
  } catch (e) {
    /* storage 不可用时用默认值 */
  }
}

function saveCfg(ctx) {
  try {
    ctx.storage.set('enabled', cfg.enabled)
    ctx.storage.set('videoPath', cfg.videoPath)
    ctx.storage.set('opacity', cfg.opacity)
    ctx.storage.set('videoPosition', cfg.videoPosition)
    ctx.storage.set('sidebarAlpha', cfg.sidebarAlpha)
  } catch (e) {
    /* ignore */
  }
}

function toFileURL(p) {
  return 'file:///' + String(p).split('\\').map(s => encodeURIComponent(s)).join('/')
}

// ── 背景处理（读 cfg）─────────────────────────────────────────────
function bgAlpha(colorStr) {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return 0
  const m = colorStr.match(/\/\s*([0-9.]+)\)\s*$/)
  if (m) return parseFloat(m[1])
  if (colorStr.startsWith('rgba(') || colorStr.startsWith('hsla(')) {
    return parseFloat(colorStr.split(',').pop().replace(/[^\d.]/g, ''))
  }
  return 1
}

function hasBg(el) {
  const cs = getComputedStyle(el)
  const c = cs.backgroundColor || ''
  const i = cs.backgroundImage || ''
  return bgAlpha(c) >= 0.5 || (i && i !== 'none')
}

function nukePseudo(el) {
  const rid = 'ap' + Math.random().toString(36).slice(2, 7)
  el.dataset.ariaRid = rid
  let st = document.getElementById('aria-pseudo-style')
  if (!st) {
    st = document.createElement('style')
    st.id = 'aria-pseudo-style'
    document.head.appendChild(st)
  }
  st.textContent += `\n[data-aria-rid="${rid}"]::before,[data-aria-rid="${rid}"]::after{background:transparent!important;}`
}

function deepCleanSidebar(el) {
  const kids = el.querySelectorAll('*')
  for (const k of kids) {
    if (k.id === 'aria-bg-video' || k.id === 'aria-bg-badge' || k.id === 'aria-bg-style') continue
    const cs = getComputedStyle(k)
    const c = cs.backgroundColor || ''
    const i = cs.backgroundImage || ''
    if (bgAlpha(c) >= 0.3 || (i && i !== 'none')) {
      k.style.setProperty('background', 'transparent', 'important')
      nukePseudo(k)
    }
  }
}

function processBackgrounds() {
  if (!cfg.enabled) return { cleared: 0, tinted: 0 }
  const vw = window.innerWidth
  const vh = window.innerHeight
  let cleared = 0
  let tinted = 0
  const all = document.querySelectorAll('body *')
  for (const el of all) {
    if (el.id === 'aria-bg-video' || el.id === 'aria-bg-badge' || el.id === 'aria-bg-style') continue
    const r = el.getBoundingClientRect()
    if (r.width < 60 || r.height < 60) continue
    if (!hasBg(el)) continue
    const wRatio = r.width / vw
    const hRatio = r.height / vh
    if (wRatio >= 0.5 && hRatio >= 0.4) {
      el.style.setProperty('background', 'transparent', 'important')
      cleared++
      nukePseudo(el)
    } else if (wRatio >= 0.08 && wRatio <= 0.48 && hRatio >= 0.55) {
      const sbg = `rgba(13, 38, 103, ${cfg.sidebarAlpha})`
      el.style.setProperty('background', sbg, 'important')
      tinted++
      nukePseudo(el)
      deepCleanSidebar(el)
    }
  }
  return { cleared, tinted }
}

function ensureStyle() {
  if (document.getElementById('aria-bg-style')) return
  const s = document.createElement('style')
  s.id = 'aria-bg-style'
  s.textContent = `
    html, body { background: transparent !important; }
    #root, #root > div, [data-app], [data-tauri] { background: transparent !important; }
  `
  document.head.appendChild(s)
}

function upsertVideo() {
  if (!cfg.enabled) {
    const old = document.getElementById('aria-bg-video')
    if (old) old.remove()
    return null
  }
  let v = document.getElementById('aria-bg-video')
  if (!v) {
    v = document.createElement('video')
    v.id = 'aria-bg-video'
    v.autoplay = true
    v.loop = true
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    Object.assign(v.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw', // 窗口永远全屏
      height: '100%',
      objectFit: 'cover',
      objectPosition: cfg.videoPosition + '% 50%', // 内容在窗口内水平移动
      opacity: String(cfg.opacity),
      pointerEvents: 'none',
      zIndex: '-1',
      border: '0',
      margin: '0'
    })
    document.body.appendChild(v)
    const pr = v.play()
    if (pr && pr.catch) pr.catch(() => {})
  }
  // 应用当前配置：窗口保持全屏，内容用 object-position 在窗口内移动
  v.src = toFileURL(cfg.videoPath)
  v.style.left = '0'
  v.style.width = '100vw'
  v.style.objectPosition = cfg.videoPosition + '% 50%'
  v.style.opacity = String(cfg.opacity)
  // 诊断徽标：显示 cfg 值与实际应用值，验证水平位置是否真正生效
  let dbg = document.getElementById('aria-bg-badge')
  if (!dbg) {
    dbg = document.createElement('div')
    dbg.id = 'aria-bg-badge'
    Object.assign(dbg.style, {
      position: 'fixed',
      top: '52px',
      right: '24px',
      zIndex: '2147483647',
      background: 'rgba(0,0,0,0.85)',
      color: '#ff7eb6',
      padding: '6px 10px',
      borderRadius: '8px',
      fontSize: '11px',
      fontFamily: 'monospace',
      pointerEvents: 'none',
      boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
      maxWidth: '440px',
      whiteSpace: 'pre-wrap',
      lineHeight: '1.5'
    })
    document.body.appendChild(dbg)
  }
  dbg.textContent =
    `🎬 cfg: pos=${cfg.videoPosition}% op=${cfg.opacity}\n` +
    `applied: objectPosition=${v.style.objectPosition}`
  return v
}

function injectLoop() {
  if (typeof document === 'undefined' || !document.body) return
  ensureStyle()
  upsertVideo()
  processBackgrounds()
}

// ── 设置页组件 ────────────────────────────────────────────────────
function SettingsPage({ ctx }) {
  const [form, setForm] = useState({ ...cfg })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(t)
  }, [saved])

  const set = (k, val) => {
    setForm(f => ({ ...f, [k]: val }))
    // 实时预览：滑块/开关一改就应用（无需点保存）
    if (k === 'enabled' || k === 'opacity' || k === 'videoPosition' || k === 'videoPath') {
      cfg[k] = val
      upsertVideo()
    }
    if (k === 'sidebarAlpha') {
      cfg[k] = val
      processBackgrounds()
    }
  }

  const onSave = () => {
    Object.assign(cfg, form)
    saveCfg(ctx)
    injectLoop()
    setSaved(true)
    host.notify({ kind: 'success', message: '🎬 背景视频设置已保存并生效' })
  }

  const row = (label, children) =>
    jsxs('div', {
      className: 'flex items-center justify-between gap-4 py-3',
      children: [
        jsx('div', { className: 'text-sm font-medium', children: label }),
        children
      ]
    })

  return jsxs('div', {
    className: 'mx-auto flex h-full max-w-2xl flex-col gap-6 overflow-y-auto p-8',
    children: [
      jsx('div', {
        className: 'text-xl font-semibold',
        children: '🎬 背景视频设置'
      }),
      jsx('p', {
        className: 'text-(--ui-text-secondary) text-sm',
        children:
          '修改后点「保存并应用」即时生效，无需重启客户端。设置会自动保存，下次启动依然生效。'
      }),

      // 总开关
      row(
        '启用背景视频',
        jsx(Switch, {
          checked: form.enabled,
          onCheckedChange: v => set('enabled', v)
        })
      ),

      // 视频路径
      row(
        '视频文件路径',
        jsx('div', {
          className: 'flex w-72 flex-col gap-1',
          children: [
            jsx(Input, {
              value: form.videoPath,
              onChange: e => set('videoPath', e.target.value),
              placeholder: 'D:\\path\\video.mp4',
              spellCheck: false
            }),
            jsx('span', {
              className: 'text-(--ui-text-tertiary) text-xs',
              children: '本地视频绝对路径，支持中文/空格'
            })
          ]
        })
      ),

      // 视频可见度
      row(
        '视频可见度',
        jsxs('div', {
          className: 'flex w-72 items-center gap-3',
          children: [
            jsx('input', {
              type: 'range',
              min: '0.05',
              max: '0.5',
              step: '0.05',
              value: form.opacity,
              onChange: e => set('opacity', parseFloat(e.target.value)),
              className: 'w-40 accent-(--ui-accent)'
            }),
            jsx('span', {
              className: 'text-sm tabular-nums',
              children: Math.round(form.opacity * 100) + '%'
            })
          ]
        })
      ),

      // 视频水平位置
      row(
        '视频水平位置',
        jsxs('div', {
          className: 'flex w-72 items-center gap-3',
          children: [
            jsx('input', {
              type: 'range',
              min: '0',
              max: '100',
              step: '5',
              value: form.videoPosition,
              onChange: e => set('videoPosition', parseInt(e.target.value, 10)),
              className: 'w-40 accent-(--ui-accent)'
            }),
            jsx('span', {
              className: 'text-sm tabular-nums',
              children: form.videoPosition + '%'
            })
          ]
        })
      ),
      jsx('p', {
        className: 'text-(--ui-text-tertiary) -mt-4 text-xs',
        children:
          '0% = 内容靠左，50% = 居中，100% = 内容靠右（窗口始终全屏，只移动画面）'
      }),

      // 侧栏透明度
      row(
        '侧边栏透明度',
        jsxs('div', {
          className: 'flex w-72 items-center gap-3',
          children: [
            jsx('input', {
              type: 'range',
              min: '0.3',
              max: '1',
              step: '0.05',
              value: form.sidebarAlpha,
              onChange: e => set('sidebarAlpha', parseFloat(e.target.value)),
              className: 'w-40 accent-(--ui-accent)'
            }),
            jsx('span', {
              className: 'text-sm tabular-nums',
              children: Math.round(form.sidebarAlpha * 100) + '%'
            })
          ]
        })
      ),
      jsx('p', {
        className: 'text-(--ui-text-tertiary) -mt-4 text-xs',
        children: '越小越透（视频越明显），100% = 完全不透'
      }),

      // 保存
      jsxs('div', {
        className: 'flex items-center gap-3 pt-2',
        children: [
          jsx(Button, {
            onClick: onSave,
            children: saved ? '✓ 已保存并生效' : '保存并应用'
          }),
          jsx(Tip, {
            label: '改完点这里，界面立即重绘'
          })
        ]
      })
    ]
  })
}

// ── 插件导出 ──────────────────────────────────────────────────────
export default {
  id: ID,
  name: 'Aria 背景视频',
  register(ctx) {
    loadCfg(ctx)

    // 注入循环：每 1.5s 保持背景状态（防 React 重渲染刷回）
    if (typeof document !== 'undefined') {
      let booted = false
      const iv = setInterval(() => {
        if (!booted && document.body) {
          booted = true
          injectLoop()
        } else if (booted) {
          processBackgrounds()
        }
      }, 1500)
    }

    // 设置页路由
    ctx.register({
      id: 'settings-page',
      area: ROUTES_AREA,
      title: '背景视频设置',
      data: { path: '/bg-video-settings' },
      render: () => jsx(SettingsPage, { ctx })
    })

    // 侧边栏入口
    ctx.register({
      id: 'nav',
      area: SIDEBAR_NAV_AREA,
      data: {
        path: '/bg-video-settings',
        label: '背景视频',
        codicon: 'play-circle'
      }
    })

    // Ctrl+K 命令
    ctx.register({
      id: 'cmd',
      area: PALETTE_AREA,
      data: {
        label: '打开背景视频设置',
        keywords: ['bg-video', '背景视频', '皮肤'],
        run: () => host.navigate('/bg-video-settings')
      }
    })
  }
}
