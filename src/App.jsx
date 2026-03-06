import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const STORAGE_KEY = 'eikan-file-manager-v8'
const APP_STATE_ID = '11111111-1111-1111-1111-111111111111'
const AUTH_KEY = 'eikan-auth-ok'
const AUTH_PASSWORD = 'nagata'

const POSITIONS = ['投手', '捕手', '一塁手', '二塁手', '三塁手', '遊撃手', '外野手']
const ALL_BATTING_FIELDS = ['打率', '打数', '安打', '本塁打', '打点', '得点', '盗塁', '失策', '出塁率', '長打率', 'OPS']
const ALL_PITCHING_FIELDS = ['防御率', '勝敗S', '投球回', '奪三振率', '与四球率', 'WHIP']

const DEFAULT_SETTINGS = {
  battingSummaryFields: ALL_BATTING_FIELDS,
  pitchingSummaryFields: ALL_PITCHING_FIELDS,
}

const MONTHS = (() => {
  const arr = []
  const schoolOrder = [
    { grade: 1, start: 4, end: 12 },
    { grade: 1, start: 1, end: 3 },
    { grade: 2, start: 4, end: 12 },
    { grade: 2, start: 1, end: 3 },
    { grade: 3, start: 4, end: 8 },
  ]

  for (const block of schoolOrder) {
    for (let month = block.start; month <= block.end; month++) {
      arr.push({ id: `${block.grade}-${month}`, label: `${block.grade}年${month}月`, grade: block.grade, month })
    }
  }

  arr.push({ id: 'graduation', label: '卒業時', grade: 3, month: 8.5 })
  return arr
})()

function getTypeFromPosition(position) {
  return position === '投手' ? '投手' : '野手'
}

function isNationalMonth(monthObj) {
  return monthObj && [8, 11, 3].includes(monthObj.month)
}

function emptyBattingGame() {
  return {
    played: false,
    atBats: '',
    hits: '',
    doubles: '',
    triples: '',
    homeRuns: '',
    rbi: '',
    runs: '',
    steals: '',
    errors: '',
    walks: '',
  }
}

function emptyPitchingGame() {
  return {
    played: false,
    win: false,
    loss: false,
    save: false,
    innings: '',
    hitsAllowed: '',
    homeRunsAllowed: '',
    strikeouts: '',
    walksAllowed: '',
    runsAllowed: '',
    earnedRuns: '',
  }
}

function emptyMonthData() {
  return {
    image: '',
    subImage: '',
    battingGames: [],
    pitchingGames: [],
  }
}

function createPlayer(name = '新しい選手', generation = '2026', position = '外野手') {
  return {
    id: Date.now().toString() + Math.random().toString(16).slice(2),
    name,
    generation,
    position,
    tags: '',
    months: {},
  }
}

function normalizeMonthData(data) {
  return {
    ...emptyMonthData(),
    ...(data || {}),
    battingGames: Array.isArray(data?.battingGames) ? data.battingGames : [],
    pitchingGames: Array.isArray(data?.pitchingGames) ? data.pitchingGames : [],
  }
}

async function loadData() {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('data')
      .eq('id', APP_STATE_ID)
      .maybeSingle()

    if (!error && data?.data) {
      const parsed = data.data
      return {
        players: Array.isArray(parsed.players) ? parsed.players : [createPlayer()],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        players: [
          createPlayer('エース候補', '2026', '投手'),
          createPlayer('主砲候補', '2026', '外野手'),
        ],
        settings: DEFAULT_SETTINGS,
      }
    }

    const parsed = JSON.parse(raw)
    return {
      players: Array.isArray(parsed.players) ? parsed.players : [createPlayer()],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    }
  } catch (e) {
    console.error('Supabase load error:', e)
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return {
          players: Array.isArray(parsed.players) ? parsed.players : [createPlayer()],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        }
      }
    } catch {}

    return {
      players: [createPlayer()],
      settings: DEFAULT_SETTINGS,
    }
  }
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function parseInningsToOuts(value) {
  if (value === '' || value == null) return 0
  const str = String(value).trim()
  if (!str) return 0
  const [wholePart, decimalPart = '0'] = str.split('.')
  const whole = Number(wholePart)
  const outsDigit = Number(decimalPart)
  if (!Number.isFinite(whole) || !Number.isFinite(outsDigit)) return 0
  return whole * 3 + outsDigit
}

function outsToDisplay(outs) {
  const whole = Math.floor(outs / 3)
  const remain = outs % 3
  return `${whole}.${remain}`
}

function rate3(value) {
  if (!Number.isFinite(value)) return '-'
  const s = value.toFixed(3)
  if (s.startsWith('0')) return s.slice(1)
  if (s.startsWith('-0')) return '-' + s.slice(2)
  return s
}

function rate2(value) {
  if (!Number.isFinite(value)) return '-'
  return value.toFixed(2)
}

function sumBattingGames(games) {
  const total = {
    played: 0,
    atBats: 0,
    hits: 0,
    doubles: 0,
    triples: 0,
    homeRuns: 0,
    rbi: 0,
    runs: 0,
    steals: 0,
    errors: 0,
    walks: 0,
  }

  for (const game of games || []) {
    if (game.played) total.played += 1
    total.atBats += num(game.atBats)
    total.hits += num(game.hits)
    total.doubles += num(game.doubles)
    total.triples += num(game.triples)
    total.homeRuns += num(game.homeRuns)
    total.rbi += num(game.rbi)
    total.runs += num(game.runs)
    total.steals += num(game.steals)
    total.errors += num(game.errors)
    total.walks += num(game.walks)
  }

  const singles = Math.max(0, total.hits - total.doubles - total.triples - total.homeRuns)
  const totalBases = singles + total.doubles * 2 + total.triples * 3 + total.homeRuns * 4
  const avg = total.atBats > 0 ? total.hits / total.atBats : 0
  const obp = total.atBats + total.walks > 0 ? (total.hits + total.walks) / (total.atBats + total.walks) : 0
  const slg = total.atBats > 0 ? totalBases / total.atBats : 0

  return {
    ...total,
    avg,
    obp,
    slg,
    ops: obp + slg,
  }
}

function sumPitchingGames(games) {
  const total = {
    played: 0,
    wins: 0,
    losses: 0,
    saves: 0,
    outs: 0,
    hitsAllowed: 0,
    homeRunsAllowed: 0,
    strikeouts: 0,
    walksAllowed: 0,
    runsAllowed: 0,
    earnedRuns: 0,
  }

  for (const game of games || []) {
    if (game.played) total.played += 1
    if (game.win) total.wins += 1
    if (game.loss) total.losses += 1
    if (game.save) total.saves += 1
    total.outs += parseInningsToOuts(game.innings)
    total.hitsAllowed += num(game.hitsAllowed)
    total.homeRunsAllowed += num(game.homeRunsAllowed)
    total.strikeouts += num(game.strikeouts)
    total.walksAllowed += num(game.walksAllowed)
    total.runsAllowed += num(game.runsAllowed)
    total.earnedRuns += num(game.earnedRuns)
  }

  const inningsValue = total.outs / 3
  return {
    ...total,
    inningsDisplay: outsToDisplay(total.outs),
    era: inningsValue > 0 ? (total.earnedRuns * 9) / inningsValue : 0,
    k9: inningsValue > 0 ? (total.strikeouts * 9) / inningsValue : 0,
    bb9: inningsValue > 0 ? (total.walksAllowed * 9) / inningsValue : 0,
    whip: inningsValue > 0 ? (total.hitsAllowed + total.walksAllowed) / inningsValue : 0,
  }
}

function battingSummaryObject(total) {
  return {
    試合数: String(total.played),
    打率: rate3(total.avg),
    打数: String(total.atBats),
    安打: String(total.hits),
    本塁打: String(total.homeRuns),
    打点: String(total.rbi),
    得点: String(total.runs),
    盗塁: String(total.steals),
    失策: String(total.errors),
    出塁率: rate3(total.obp),
    長打率: rate3(total.slg),
    OPS: rate3(total.ops),
  }
}

function pitchingSummaryObject(total) {
  return {
    試合数: String(total.played),
    防御率: rate2(total.era),
    勝敗S: `${total.wins}勝${total.losses}敗${total.saves}S`,
    投球回: `${total.inningsDisplay}投球回`,
    奪三振率: rate2(total.k9),
    与四球率: rate2(total.bb9),
    WHIP: rate2(total.whip),
  }
}

function battingLine1(summary) {
  return `打率${summary['打率']} 出塁率${summary['出塁率']} 長打率${summary['長打率']} OPS${summary['OPS']}`
}

function battingLine2(summary) {
  return `${summary['打数']}打数 ${summary['安打']}安打 ${summary['本塁打']}本 ${summary['打点']}打点 ${summary['得点']}得点 ${summary['盗塁']}盗塁 ${summary['失策']}失策`
}

function pitchingLine1(summary) {
  return `防${summary['防御率']} ${summary['勝敗S']}`
}

function pitchingLine2(summary) {
  return `${summary['投球回']} 奪三振率${summary['奪三振率']} 与四球率${summary['与四球率']} WHIP${summary['WHIP']}`
}

function MiniNumberField({ label, value, onChange }) {
  return (
    <div style={styles.miniFieldWrap}>
      <div style={styles.miniLabel}>{label}</div>
      <input
        style={styles.tinyInput}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
      />
    </div>
  )
}

function MiniCheckField({ label, checked, onChange }) {
  return (
    <label style={styles.checkFieldWrap}>
      <div style={styles.miniLabel}>{label}</div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export default function App() {
  const [players, setPlayers] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [monthIndex, setMonthIndex] = useState(0)
  const [generationFilter, setGenerationFilter] = useState('すべて')
  const [typeFilter, setTypeFilter] = useState('すべて')
  const [searchText, setSearchText] = useState('')
  const [mode, setMode] = useState('main')
  const [passwordInput, setPasswordInput] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(() => localStorage.getItem(AUTH_KEY) === 'ok')

  useEffect(() => {
    async function init() {
      const loaded = await loadData()
      setPlayers(loaded.players)
      setSettings(loaded.settings)
      setSelectedPlayerId(loaded.players[0]?.id || '')
    }
    init()
  }, [])

  useEffect(() => {
    if (players.length === 0) return

    const payload = { players, settings }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))

    async function saveToSupabase() {
      const { error } = await supabase
        .from('app_state')
        .upsert([{ id: APP_STATE_ID, data: payload }], { onConflict: 'id' })

      if (error) {
        console.error('Supabase save error:', error)
      } else {
        console.log('Supabase save success')
      }
    }

    saveToSupabase()
  }, [players, settings])

  const generations = useMemo(() => ['すべて', ...Array.from(new Set(players.map((p) => p.generation)))], [players])

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      const okGeneration = generationFilter === 'すべて' || p.generation === generationFilter
      const okType = typeFilter === 'すべて' || getTypeFromPosition(p.position) === typeFilter
      const keyword = searchText.trim().toLowerCase()
      const okSearch = keyword === '' || p.name.toLowerCase().includes(keyword) || (p.tags || '').toLowerCase().includes(keyword)
      return okGeneration && okType && okSearch
    })
  }, [players, generationFilter, typeFilter, searchText])

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) || players[0] || null
  const playerType = selectedPlayer ? getTypeFromPosition(selectedPlayer.position) : '野手'
  const currentMonth = MONTHS[monthIndex]
  const currentData = normalizeMonthData(selectedPlayer?.months?.[currentMonth.id])

  useEffect(() => {
    if (!selectedPlayer && filteredPlayers[0]) {
      setSelectedPlayerId(filteredPlayers[0].id)
    }
  }, [selectedPlayer, filteredPlayers])

  const monthBattingSummary = battingSummaryObject(sumBattingGames(currentData.battingGames))
  const monthPitchingSummary = pitchingSummaryObject(sumPitchingGames(currentData.pitchingGames))

  const careerBattingSummary = useMemo(() => {
    if (!selectedPlayer) return battingSummaryObject(sumBattingGames([]))
    const games = []
    for (const monthKey of Object.keys(selectedPlayer.months || {})) {
      games.push(...normalizeMonthData(selectedPlayer.months[monthKey]).battingGames)
    }
    return battingSummaryObject(sumBattingGames(games))
  }, [selectedPlayer])

  const careerPitchingSummary = useMemo(() => {
    if (!selectedPlayer) return pitchingSummaryObject(sumPitchingGames([]))
    const games = []
    for (const monthKey of Object.keys(selectedPlayer.months || {})) {
      games.push(...normalizeMonthData(selectedPlayer.months[monthKey]).pitchingGames)
    }
    return pitchingSummaryObject(sumPitchingGames(games))
  }, [selectedPlayer])

  const nationalBattingSummary = useMemo(() => {
    if (!selectedPlayer) return battingSummaryObject(sumBattingGames([]))
    const games = []
    for (const monthObj of MONTHS) {
      if (!isNationalMonth(monthObj)) continue
      games.push(...normalizeMonthData(selectedPlayer.months?.[monthObj.id]).battingGames)
    }
    return battingSummaryObject(sumBattingGames(games))
  }, [selectedPlayer])

  const nationalPitchingSummary = useMemo(() => {
    if (!selectedPlayer) return pitchingSummaryObject(sumPitchingGames([]))
    const games = []
    for (const monthObj of MONTHS) {
      if (!isNationalMonth(monthObj)) continue
      games.push(...normalizeMonthData(selectedPlayer.months?.[monthObj.id]).pitchingGames)
    }
    return pitchingSummaryObject(sumPitchingGames(games))
  }, [selectedPlayer])

  function updatePlayer(playerId, patch) {
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, ...patch } : p)))
  }

  function updateMonthData(playerId, monthId, patch) {
    setPlayers((prev) => prev.map((p) => {
      if (p.id !== playerId) return p
      return {
        ...p,
        months: {
          ...p.months,
          [monthId]: {
            ...normalizeMonthData(p.months[monthId]),
            ...patch,
          }
        }
      }
    }))
  }

  function addPlayer(type) {
    const name = window.prompt('選手名を入力してください', type === '投手' ? '新しい投手' : '新しい野手')
    if (!name) return
    const generation = window.prompt('世代を入力してください', '2026') || '2026'
    const defaultPosition = type === '投手' ? '投手' : '外野手'
    const newPlayer = createPlayer(name, generation, defaultPosition)
    setPlayers((prev) => [...prev, newPlayer])
    setSelectedPlayerId(newPlayer.id)
    setMode('main')
  }

  function deleteSelectedPlayer() {
    if (!selectedPlayer) return
    const ok = window.confirm(`${selectedPlayer.name} を削除しますか？`)
    if (!ok) return
    const nextPlayers = players.filter((p) => p.id !== selectedPlayer.id)
    setPlayers(nextPlayers)
    setSelectedPlayerId(nextPlayers[0]?.id || '')
  }

  function handleImage(file, key = 'image') {
    if (!selectedPlayer || !file) return
    const reader = new FileReader()
    reader.onload = () => updateMonthData(selectedPlayer.id, currentMonth.id, { [key]: reader.result })
    reader.readAsDataURL(file)
  }

  function groupedPlayers() {
    const result = {}
    for (const p of filteredPlayers) {
      const type = getTypeFromPosition(p.position)
      if (!result[p.generation]) result[p.generation] = { 投手: [], 野手: [] }
      result[p.generation][type].push(p)
    }
    return result
  }

  function updateBattingGame(index, key, value) {
    const next = [...currentData.battingGames]
    next[index] = { ...next[index], [key]: value }
    updateMonthData(selectedPlayer.id, currentMonth.id, { battingGames: next })
  }

  function updatePitchingGame(index, key, value) {
    const next = [...currentData.pitchingGames]
    next[index] = { ...next[index], [key]: value }
    updateMonthData(selectedPlayer.id, currentMonth.id, { pitchingGames: next })
  }

  function addBattingGame() {
    updateMonthData(selectedPlayer.id, currentMonth.id, { battingGames: [...currentData.battingGames, emptyBattingGame()] })
  }

  function addPitchingGame() {
    updateMonthData(selectedPlayer.id, currentMonth.id, { pitchingGames: [...currentData.pitchingGames, emptyPitchingGame()] })
  }

  function deleteBattingGame(index) {
    updateMonthData(selectedPlayer.id, currentMonth.id, { battingGames: currentData.battingGames.filter((_, i) => i !== index) })
  }

  function deletePitchingGame(index) {
    updateMonthData(selectedPlayer.id, currentMonth.id, { pitchingGames: currentData.pitchingGames.filter((_, i) => i !== index) })
  }

  function toggleSummaryField(groupKey, field) {
    const current = settings[groupKey]
    const exists = current.includes(field)
    setSettings((prev) => ({
      ...prev,
      [groupKey]: exists ? current.filter((x) => x !== field) : [...current, field]
    }))
  }

  function exportBackup() {
    const data = { players, settings }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eikan_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importBackup(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result)
        if (data.players) setPlayers(data.players)
        if (data.settings) setSettings(data.settings)
        alert('バックアップ読み込み成功')
      } catch {
        alert('バックアップファイルが不正です')
      }
    }
    reader.readAsText(file)
  }

  const groups = groupedPlayers()

  function handleUnlock() {
    if (passwordInput === AUTH_PASSWORD) {
      localStorage.setItem(AUTH_KEY, 'ok')
      setIsUnlocked(true)
      setPasswordInput('')
    } else {
      alert('パスワードが違います')
    }
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_KEY)
    setIsUnlocked(false)
  }

  if (!isUnlocked) {
    return (
      <div style={styles.authWrap}>
        <div style={styles.authCard}>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>栄冠ナイン管理</h2>
          <div style={{ marginBottom: 10 }}>パスワードを入力してください</div>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUnlock()
            }}
            style={styles.input}
            placeholder="パスワード"
          />
          <button style={{ ...styles.button, width: '100%', marginTop: 10 }} onClick={handleUnlock}>
            入室
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <h2 style={styles.title}>栄冠ナイン管理</h2>
          <div style={styles.modeRow}>
            <button style={{ ...styles.modeButton, ...(mode === 'main' ? styles.activeModeButton : {}) }} onClick={() => setMode('main')}>通常</button>
            <button style={{ ...styles.modeButton, ...(mode === 'settings' ? styles.activeModeButton : {}) }} onClick={() => setMode('settings')}>設定</button>
          </div>
        </div>

        <div style={styles.filterBox}>
          <select value={generationFilter} onChange={(e) => setGenerationFilter(e.target.value)} style={styles.input}>
            {generations.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={styles.input}>
            <option value="すべて">すべて</option>
            <option value="投手">投手</option>
            <option value="野手">野手</option>
          </select>
          <input style={styles.input} value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="名前・タグ検索" />
        </div>

        <div style={styles.buttonRow}>
          <button onClick={() => addPlayer('投手')} style={styles.button}>投手追加</button>
          <button onClick={() => addPlayer('野手')} style={styles.button}>野手追加</button>
        </div>

        <div style={styles.buttonRow}>
          <button style={styles.button} onClick={exportBackup}>バックアップ保存</button>
          <input
            type="file"
            accept=".json"
            onChange={(e) => importBackup(e.target.files?.[0])}
          />
        </div>

        <div style={styles.treeArea}>
          {Object.keys(groups).length === 0 ? (
            <div>選手がいません</div>
          ) : (
            Object.keys(groups).sort().map((generation) => (
              <div key={generation} style={{ marginBottom: 16 }}>
                <div style={styles.folder}>{generation}世代</div>
                {['投手', '野手'].map((type) => (
                  <div key={type} style={{ marginLeft: 12, marginTop: 6 }}>
                    <div style={styles.subFolder}>{type}</div>
                    <div style={{ marginLeft: 12 }}>
                      {groups[generation][type].length === 0 ? (
                        <div style={styles.emptyText}>なし</div>
                      ) : (
                        groups[generation][type].map((player) => (
                          <button
                            key={player.id}
                            onClick={() => {
                              setSelectedPlayerId(player.id)
                              setMode('main')
                            }}
                            style={{ ...styles.playerButton, backgroundColor: player.id === selectedPlayerId ? '#dbeafe' : 'white' }}
                          >
                            {player.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={styles.main}>
        {mode === 'settings' ? (
          <div style={styles.settingsWrap}>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>表示設定</h2>
              <div style={styles.settingSection}>
                <div style={styles.settingTitle}>野手サマリーに表示する項目</div>
                <div style={styles.checkboxGrid}>
                  {ALL_BATTING_FIELDS.map((field) => (
                    <label key={field} style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={settings.battingSummaryFields.includes(field)}
                        onChange={() => toggleSummaryField('battingSummaryFields', field)}
                      />
                      <span>{field}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.settingSection}>
                <div style={styles.settingTitle}>投手サマリーに表示する項目</div>
                <div style={styles.checkboxGrid}>
                  {ALL_PITCHING_FIELDS.map((field) => (
                    <label key={field} style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={settings.pitchingSummaryFields.includes(field)}
                        onChange={() => toggleSummaryField('pitchingSummaryFields', field)}
                      />
                      <span>{field}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : !selectedPlayer ? (
          <div>左から選手を選んでください</div>
        ) : (
          <>
            <div style={styles.headerCard}>
              <div style={styles.headerMainRow}>
                <div>
                  <h2 style={{ margin: 0 }}>{selectedPlayer.name}</h2>
                  <div style={styles.metaText}>{selectedPlayer.generation}世代 / {selectedPlayer.position}</div>
                </div>
                <div style={styles.headerStatsGrid}>
                  <div style={styles.headerStatsBox}>
                    {playerType === '投手' ? (
                      <>
                        <div style={styles.headerStatsLabel}>通算成績（{careerPitchingSummary['試合数']}試合）</div>
                        <div style={styles.headerStatsText}>{pitchingLine1(careerPitchingSummary)}</div>
                        <div style={styles.headerStatsText}>{pitchingLine2(careerPitchingSummary)}</div>
                      </>
                    ) : (
                      <>
                        <div style={styles.headerStatsLabel}>通算成績（{careerBattingSummary['試合数']}試合）</div>
                        <div style={styles.headerStatsText}>{battingLine1(careerBattingSummary)}</div>
                        <div style={styles.headerStatsText}>{battingLine2(careerBattingSummary)}</div>
                      </>
                    )}
                  </div>
                  <div style={styles.headerStatsBox}>
                    {playerType === '投手' ? (
                      <>
                        <div style={styles.headerStatsLabel}>全国大会（{nationalPitchingSummary['試合数']}試合）</div>
                        <div style={styles.headerStatsText}>{pitchingLine1(nationalPitchingSummary)}</div>
                        <div style={styles.headerStatsText}>{pitchingLine2(nationalPitchingSummary)}</div>
                      </>
                    ) : (
                      <>
                        <div style={styles.headerStatsLabel}>全国大会（{nationalBattingSummary['試合数']}試合）</div>
                        <div style={styles.headerStatsText}>{battingLine1(nationalBattingSummary)}</div>
                        <div style={styles.headerStatsText}>{battingLine2(nationalBattingSummary)}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div style={styles.buttonRow}>
                <button onClick={handleLogout} style={styles.button}>ロック</button>
                <button onClick={deleteSelectedPlayer} style={{ ...styles.button, backgroundColor: '#fee2e2' }}>選手削除</button>
              </div>
            </div>

            <div style={styles.infoCard}>
              <div style={styles.compactInfoRow}>
                <div style={styles.compactFieldWide}>
                  <div style={styles.label}>選手名</div>
                  <input style={styles.smallInput} value={selectedPlayer.name} onChange={(e) => updatePlayer(selectedPlayer.id, { name: e.target.value })} />
                </div>
                <div style={styles.compactField}>
                  <div style={styles.label}>世代</div>
                  <input style={styles.smallInput} value={selectedPlayer.generation} onChange={(e) => updatePlayer(selectedPlayer.id, { generation: e.target.value })} />
                </div>
                <div style={styles.compactField}>
                  <div style={styles.label}>ポジション</div>
                  <select style={styles.smallInput} value={selectedPlayer.position} onChange={(e) => updatePlayer(selectedPlayer.id, { position: e.target.value })}>
                    {POSITIONS.map((position) => <option key={position} value={position}>{position}</option>)}
                  </select>
                </div>
                <div style={styles.compactField}>
                  <div style={styles.label}>タグ</div>
                  <input style={styles.smallInput} value={selectedPlayer.tags} onChange={(e) => updatePlayer(selectedPlayer.id, { tags: e.target.value })} placeholder="エース、主砲" />
                </div>
              </div>
            </div>

            <div style={styles.topContentGrid}>
              <div style={styles.card}>
                <div style={styles.cardTitle}>画像</div>
                <div style={styles.imageStack}>
                  <div>
                    <div
                      style={styles.dropAreaSmall}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const file = e.dataTransfer.files?.[0]
                        if (file) handleImage(file, 'image')
                      }}
                    >
                      {currentData.image ? (
                        <img src={currentData.image} alt="player" style={styles.image} />
                      ) : (
                        <div>ここに画像をドラッグ＆ドロップ</div>
                      )}
                    </div>
                    <div style={styles.buttonRow}>
                      <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0], 'image')} />
                      <button style={styles.button} onClick={() => updateMonthData(selectedPlayer.id, currentMonth.id, { image: '' })}>画像削除</button>
                    </div>
                  </div>

                  {playerType === '投手' && (
                    <div>
                      <div
                        style={styles.dropAreaSmall}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          const file = e.dataTransfer.files?.[0]
                          if (file) handleImage(file, 'subImage')
                        }}
                      >
                        {currentData.subImage ? (
                          <img src={currentData.subImage} alt="player-sub" style={styles.image} />
                        ) : (
                          <div>ここに画像をドラッグ＆ドロップ</div>
                        )}
                      </div>
                      <div style={styles.buttonRow}>
                        <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0], 'subImage')} />
                        <button style={styles.button} onClick={() => updateMonthData(selectedPlayer.id, currentMonth.id, { subImage: '' })}>画像削除</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.summarySideCard}>
                <div style={styles.summaryHeaderLeft}>
                  <button style={styles.button} onClick={() => setMonthIndex((m) => Math.max(0, m - 1))}>← 前の月</button>
                  <div style={{ fontWeight: 'bold', fontSize: 22 }}>{currentMonth.label}</div>
                  <button style={styles.button} onClick={() => setMonthIndex((m) => Math.min(MONTHS.length - 1, m + 1))}>次の月 →</button>
                </div>

                <div style={styles.monthCompactWrap}>
                  {[1, 2, 3].map((grade) => {
                    const gradeMonths = MONTHS.filter((m) => m.id !== 'graduation' && m.grade === grade)
                    return (
                      <div key={grade} style={styles.gradeRow}>
                        <div style={styles.gradeLabel}>{grade}年生</div>
                        <div style={styles.gradeMonthsWrap}>
                          {gradeMonths.map((m) => {
                            const index = MONTHS.findIndex((x) => x.id === m.id)
                            return (
                              <button
                                key={m.id}
                                onClick={() => setMonthIndex(index)}
                                style={{ ...styles.monthTinyChip, backgroundColor: index === monthIndex ? '#1d4ed8' : '#e5e7eb', color: index === monthIndex ? 'white' : 'black' }}
                              >
                                {m.month}
                              </button>
                            )
                          })}
                          {grade === 3 && (
                            <button
                              onClick={() => setMonthIndex(MONTHS.findIndex((m) => m.id === 'graduation'))}
                              style={{ ...styles.monthTinyChip, backgroundColor: currentMonth.id === 'graduation' ? '#1d4ed8' : '#e5e7eb', color: currentMonth.id === 'graduation' ? 'white' : 'black' }}
                            >
                              卒
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {playerType === '投手' ? (
                  <>
                    <div style={styles.summaryBlockTight}>
                      <div style={styles.summaryTitle}>月合計（{monthPitchingSummary['試合数']}試合・投手）</div>
                      <div style={styles.summaryLine}>{pitchingLine1(monthPitchingSummary)}</div>
                      <div style={styles.summaryLine}>{pitchingLine2(monthPitchingSummary)}</div>
                    </div>
                    <div style={styles.summaryBlockTight}>
                      <div style={styles.summaryTitle}>月合計（{monthBattingSummary['試合数']}試合・野手）</div>
                      <div style={styles.summaryLine}>{battingLine1(monthBattingSummary)}</div>
                      <div style={styles.summaryLine}>{battingLine2(monthBattingSummary)}</div>
                    </div>
                    <div style={styles.summaryBlockTight}>
                      <div style={styles.summaryTitle}>通算（{careerPitchingSummary['試合数']}試合・投手）</div>
                      <div style={styles.summaryLine}>{pitchingLine1(careerPitchingSummary)}</div>
                      <div style={styles.summaryLine}>{pitchingLine2(careerPitchingSummary)}</div>
                    </div>
                    <div style={styles.summaryBlockTight}>
                      <div style={styles.summaryTitle}>通算（{careerBattingSummary['試合数']}試合・野手）</div>
                      <div style={styles.summaryLine}>{battingLine1(careerBattingSummary)}</div>
                      <div style={styles.summaryLine}>{battingLine2(careerBattingSummary)}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={styles.summaryBlockTight}>
                      <div style={styles.summaryTitle}>月合計（{monthBattingSummary['試合数']}試合）</div>
                      <div style={styles.summaryLine}>{battingLine1(monthBattingSummary)}</div>
                      <div style={styles.summaryLine}>{battingLine2(monthBattingSummary)}</div>
                    </div>
                    <div style={styles.summaryBlockTight}>
                      <div style={styles.summaryTitle}>通算（{careerBattingSummary['試合数']}試合）</div>
                      <div style={styles.summaryLine}>{battingLine1(careerBattingSummary)}</div>
                      <div style={styles.summaryLine}>{battingLine2(careerBattingSummary)}</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>野手成績入力</h3>
                <button style={styles.button} onClick={addBattingGame}>試合追加</button>
              </div>
              <div style={styles.gamesWrap}>
                {currentData.battingGames.length === 0 ? (
                  <div style={styles.emptyText}>まだ入力がありません</div>
                ) : currentData.battingGames.map((game, index) => (
                  <div key={index} style={styles.oneLineGameRow}>
                    <div style={styles.gameIndex}>#{index + 1}</div>
                    <MiniCheckField label="出場" checked={!!game.played} onChange={(v) => updateBattingGame(index, 'played', v)} />
                    <MiniNumberField label="打数" value={game.atBats} onChange={(v) => updateBattingGame(index, 'atBats', v)} />
                    <MiniNumberField label="安打" value={game.hits} onChange={(v) => updateBattingGame(index, 'hits', v)} />
                    <MiniNumberField label="二塁打" value={game.doubles} onChange={(v) => updateBattingGame(index, 'doubles', v)} />
                    <MiniNumberField label="三塁打" value={game.triples} onChange={(v) => updateBattingGame(index, 'triples', v)} />
                    <MiniNumberField label="本塁打" value={game.homeRuns} onChange={(v) => updateBattingGame(index, 'homeRuns', v)} />
                    <MiniNumberField label="打点" value={game.rbi} onChange={(v) => updateBattingGame(index, 'rbi', v)} />
                    <MiniNumberField label="得点" value={game.runs} onChange={(v) => updateBattingGame(index, 'runs', v)} />
                    <MiniNumberField label="盗塁" value={game.steals} onChange={(v) => updateBattingGame(index, 'steals', v)} />
                    <MiniNumberField label="失策" value={game.errors} onChange={(v) => updateBattingGame(index, 'errors', v)} />
                    <MiniNumberField label="四死球" value={game.walks} onChange={(v) => updateBattingGame(index, 'walks', v)} />
                    <button style={styles.smallDeleteButton} onClick={() => deleteBattingGame(index)}>削除</button>
                  </div>
                ))}
              </div>
            </div>

            {playerType === '投手' && (
              <div style={styles.card}>
                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>投手成績入力</h3>
                  <button style={styles.button} onClick={addPitchingGame}>試合追加</button>
                </div>
                <div style={styles.gamesWrap}>
                  {currentData.pitchingGames.length === 0 ? (
                    <div style={styles.emptyText}>まだ入力がありません</div>
                  ) : currentData.pitchingGames.map((game, index) => (
                    <div key={index} style={styles.oneLineGameRow}>
                      <div style={styles.gameIndex}>#{index + 1}</div>
                      <MiniCheckField label="登板" checked={!!game.played} onChange={(v) => updatePitchingGame(index, 'played', v)} />
                      <MiniCheckField label="勝" checked={!!game.win} onChange={(v) => updatePitchingGame(index, 'win', v)} />
                      <MiniCheckField label="敗" checked={!!game.loss} onChange={(v) => updatePitchingGame(index, 'loss', v)} />
                      <MiniCheckField label="S" checked={!!game.save} onChange={(v) => updatePitchingGame(index, 'save', v)} />
                      <MiniNumberField label="投球回" value={game.innings} onChange={(v) => updatePitchingGame(index, 'innings', v)} />
                      <MiniNumberField label="被安打" value={game.hitsAllowed} onChange={(v) => updatePitchingGame(index, 'hitsAllowed', v)} />
                      <MiniNumberField label="被本" value={game.homeRunsAllowed} onChange={(v) => updatePitchingGame(index, 'homeRunsAllowed', v)} />
                      <MiniNumberField label="奪三振" value={game.strikeouts} onChange={(v) => updatePitchingGame(index, 'strikeouts', v)} />
                      <MiniNumberField label="与四球" value={game.walksAllowed} onChange={(v) => updatePitchingGame(index, 'walksAllowed', v)} />
                      <MiniNumberField label="失点" value={game.runsAllowed} onChange={(v) => updatePitchingGame(index, 'runsAllowed', v)} />
                      <MiniNumberField label="自責" value={game.earnedRuns} onChange={(v) => updatePitchingGame(index, 'earnedRuns', v)} />
                      <button style={styles.smallDeleteButton} onClick={() => deletePitchingGame(index)}>削除</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  authWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    padding: 16,
    boxSizing: 'border-box'
  },
  authCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    boxSizing: 'border-box',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
  },
  app: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    fontFamily: 'sans-serif'
  },
  sidebar: {
    width: 340,
    backgroundColor: 'white',
    borderRight: '1px solid #d1d5db',
    padding: 16,
    boxSizing: 'border-box'
  },
  sidebarTop: { marginBottom: 12 },
  main: {
    flex: 1,
    padding: 16,
    boxSizing: 'border-box'
  },
  title: {
    marginTop: 0,
    marginBottom: 10
  },
  modeRow: {
    display: 'flex',
    gap: 8,
  },
  modeButton: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  activeModeButton: { backgroundColor: '#dbeafe' },
  filterBox: {
    display: 'grid',
    gap: 8,
    marginBottom: 12
  },
  input: {
    width: '100%',
    padding: 8,
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: 8
  },
  smallInput: {
    width: '100%',
    padding: '6px 8px',
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    height: 34,
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8
  },
  button: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  treeArea: {
    maxHeight: 'calc(100vh - 240px)',
    overflowY: 'auto',
    paddingRight: 4
  },
  folder: {
    fontWeight: 'bold',
    fontSize: 18
  },
  subFolder: {
    fontWeight: 'bold',
    color: '#374151'
  },
  playerButton: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '6px 8px',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    marginTop: 4
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4
  },
  headerCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  headerMainRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  headerStatsGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  headerStatsBox: {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: '10px 12px',
    color: '#374151',
  },
  headerStatsLabel: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  headerStatsText: {
    fontSize: 14,
    lineHeight: 1.4,
  },
  infoCard: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12
  },
  summarySideCard: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    height: 'fit-content',
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12
  },
  metaText: {
    color: '#6b7280',
    marginTop: 4
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 4,
    fontSize: 13,
  },
  miniLabel: {
    fontWeight: 'bold',
    marginBottom: 3,
    fontSize: 11,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  compactInfoRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 0.8fr 1fr 1fr',
    gap: 8,
    alignItems: 'end',
  },
  compactFieldWide: { minWidth: 0 },
  compactField: { minWidth: 0 },
  summaryHeaderLeft: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  monthCompactWrap: {
    display: 'grid',
    gap: 8,
    marginTop: 10,
    marginBottom: 12,
  },
  gradeRow: {
    display: 'grid',
    gridTemplateColumns: '60px 1fr',
    gap: 8,
    alignItems: 'center',
  },
  gradeLabel: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  gradeMonthsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthTinyChip: {
    minWidth: 32,
    height: 28,
    padding: '0 8px',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
  },
  summaryBlockTight: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: '8px 10px',
    marginBottom: 8,
  },
  summaryTitle: {
    fontWeight: 'bold',
    marginBottom: 2,
    fontSize: 15,
  },
  summaryLine: {
    lineHeight: 1.4,
    fontSize: 15,
  },
  topContentGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.8fr',
    gap: 12,
    marginBottom: 12,
    alignItems: 'start',
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
    fontSize: 18,
  },
  imageStack: {
    display: 'grid',
    gap: 14,
  },
  dropAreaSmall: {
    height: 260,
    border: '2px dashed #94a3b8',
    borderRadius: 12,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    marginBottom: 8,
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { margin: 0 },
  gamesWrap: {
    display: 'grid',
    gap: 4,
  },
  oneLineGameRow: {
    display: 'flex',
    alignItems: 'end',
    gap: 6,
    overflowX: 'auto',
    padding: '6px 0',
    borderBottom: '1px solid #e5e7eb',
  },
  gameIndex: {
    minWidth: 32,
    fontWeight: 'bold',
    paddingBottom: 6,
    fontSize: 13,
  },
  miniFieldWrap: {
    minWidth: 46,
  },
  checkFieldWrap: {
    minWidth: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingBottom: 3,
  },
  tinyInput: {
    width: 46,
    padding: '2px 4px',
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    height: 26,
    textAlign: 'center',
    fontSize: 12,
  },
  smallDeleteButton: {
    padding: '4px 7px',
    borderRadius: 8,
    border: '1px solid #fecaca',
    backgroundColor: '#fee2e2',
    cursor: 'pointer',
    height: 28,
    fontSize: 12,
  },
  settingsWrap: {
    maxWidth: 1000,
  },
  settingSection: {
    marginTop: 24,
  },
  settingTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    fontSize: 18,
  },
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fafafa',
  },
}
