import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useMediaQuery } from '@/hooks/use-media-query'
import { MarketDataError, MarketDataLoading } from '@/features/markets/components/market-data-states'
import {
  DEFAULT_LIQUIDITY_TIMEFRAME,
  liquidityTimeframes,
  type LiquidityTimeframeId,
} from '@/features/workspace/data'

import type { Coin } from '@/features/markets/types'
import { useCoins, useMarketData } from '@/store/market-data'
import { usePreferences } from '@/store/preferences'

import { buildOracleRequest } from '@/features/ai/build-request'
import { callOracle, localAnalysis, OracleClientError } from '@/features/ai/client'
import { modelInfo } from '@/features/ai/models'
import { useAi } from '@/features/ai/store'
import type { LastRequestInfo } from '@/features/ai/types'

import { Conversation } from './components/conversation'
import { HistorySheet } from './components/history-sheet'
import { InputBar } from './components/input-bar'
import { MarketContextSheet } from './components/market-context-sheet'
import { RequestStatusStrip } from './components/request-status'
import { OracleSidebar } from './components/sidebar'
import { cardSummary, marketHealth, newId, nowLabel } from './data'
import { useMarketIntelligence } from '@/features/markets/hooks/use-market-intelligence'
import { surfaceSource } from '@/features/markets/services/market-router'
import { buildMarketContext } from './services/market-context'
import { loadSavedAnalyses, persistSavedAnalyses } from './services/history'
import type { OracleMessage, OracleMode, SavedAnalysis, Suggestion } from './types'

/**
 * Oracle — Forge's command center. A calm conversation with a market
 * analyst: structured response cards instead of chat bubbles, a live
 * context rail on desktop (full Market Context sheet on demand), a
 * Trader/Teacher mode, and locally saved analyses.
 *
 * Responses route ONE normalized payload (real candles + Liquidity Model +
 * Setup Intelligence) through the selected Oracle model — the deterministic
 * Local engine by default, or the server model router (Claude/GPT/Gemini/
 * AgentRouter) when configured. Failures surface as honest error cards.
 * Market data is live, from the shared store.
 */
export function OraclePage() {
  const { preferences } = usePreferences()
  const { modelId } = useAi()
  const coins = useCoins()
  const { loading, refresh } = useMarketData()
  const [messages, setMessages] = useState<OracleMessage[]>([])
  const [activeCoinId, setActiveCoinId] = useState('bitcoin')
  // Seed from Settings preferences; a session override persists separately.
  const [timeframeId, setTimeframeId] = useState<LiquidityTimeframeId>(
    preferences.defaultAnalysisTimeframe,
  )
  const [mode, setMode] = useState<OracleMode>(() => {
    try {
      const session = sessionStorage.getItem('forge.oracle.mode')
      if (session === 'teacher' || session === 'trader') return session
    } catch {
      /* storage unavailable — ignore */
    }
    return preferences.defaultOracleMode
  })
  const [thinking, setThinking] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [saved, setSaved] = useState<SavedAnalysis[]>(() => loadSavedAnalyses())
  // The last analysis request — model/provider/status/latency/cost for the
  // key-free status strip. Never contains API keys.
  const [lastRequest, setLastRequest] = useState<LastRequestInfo | null>(null)
  // The mobile composer is portaled to <body> so no routed-content ancestor
  // (the page-transition wrapper animates filter/transform, which act as a
  // containing block for position:fixed) can ever move it off the viewport.
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [composerHost] = useState(() => document.createElement('div'))
  useEffect(() => {
    document.body.appendChild(composerHost)
    return () => {
      document.body.removeChild(composerHost)
    }
  }, [composerHost])
  // Ref guards — close the double-submit / double-regenerate races before
  // state propagates.
  const sendingRef = useRef(false)
  const thinkingRef = useRef(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  // The floating composer is the single source of truth for the bottom
  // offset: its live height is published as --forge-composer-h so the page
  // clearance, the conversation scroll anchor and the empty-state sizing all
  // reference the same measured value (no scattered hardcoded paddings).
  // A callback ref (not a mount effect) so it fires exactly when the node
  // attaches — the composer isn't rendered during the loading/error guards.
  const composerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const update = () => {
      document.documentElement.style.setProperty('--forge-composer-h', `${el.offsetHeight}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    thinkingRef.current = thinking
  }, [thinking])

  // Mode persists for the session; history persists on the device.
  useEffect(() => {
    try {
      sessionStorage.setItem('forge.oracle.mode', mode)
    } catch {
      /* storage unavailable — ignore */
    }
  }, [mode])

  const activeCoin = coins.find((coin) => coin.id === activeCoinId) ?? coins[0]
  const timeframe = useMemo(
    () =>
      liquidityTimeframes.find((tf) => tf.id === timeframeId) ??
      liquidityTimeframes.find((tf) => tf.id === DEFAULT_LIQUIDITY_TIMEFRAME)!,
    [timeframeId],
  )
  // activeCoin can be undefined while the first market load is in flight —
  // the memos stay null-safe and the render guards below take over.
  const health = useMemo(
    () => (activeCoin ? marketHealth(activeCoin, timeframe) : null),
    [activeCoin, timeframe],
  )
  // The exact market read Oracle works from — the same Forge Liquidity
  // Model output as the workspace Snapshot (one detector, one source of
  // truth). Cached per window, so this adds no network traffic.
  const intelligence = useMarketIntelligence(activeCoin, timeframe.id)
  const snapshot = useMemo(
    () =>
      activeCoin
        ? buildMarketContext(
            activeCoin,
            timeframe,
            intelligence.analysis,
            intelligence.candles,
            // Honest data timestamp (newest closed candle), not fetch time.
            intelligence.dataAt,
            surfaceSource(
              activeCoin,
              intelligence.provider,
              intelligence.symbol,
              intelligence.analysis?.candleGranularity ?? null,
            ),
          )
        : null,
    [activeCoin, timeframe, intelligence],
  )
  const hasStreaming = messages.some((message) => message.streaming)

  // A live mirror of the state the async response flow needs AFTER the
  // render that switched the coin/timeframe — so a hint that pins another
  // asset analyzes that asset's real data, never the previous window's.
  const stateRef = useRef({ activeCoin, timeframe, intelligence, snapshot })
  stateRef.current = { activeCoin, timeframe, intelligence, snapshot }

  /** Wait until the window's intelligence has settled (ready/insufficient/error). */
  async function waitForWindow(coinId: string, tfId: LiquidityTimeframeId, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const current = stateRef.current
      if (current.activeCoin.id === coinId && current.timeframe.id === tfId) {
        const status = current.intelligence.status
        if (status === 'ready' || status === 'insufficient' || status === 'error') return
      }
      await new Promise((resolve) => window.setTimeout(resolve, 150))
    }
  }

  /**
   * Core response flow — resolves the analysis target (hints may pin a
   * coin/timeframe), waits for that window's real intelligence, then routes
   * ONE normalized payload through the selected Oracle model (Local engine
   * or the server model router). Failures surface as honest error cards.
   * Shared by a fresh user turn and Regenerate.
   */
  const runResponse = useCallback(
    async (prompt: string, hints: { coinId?: string; timeframeId?: LiquidityTimeframeId }, exchange: string) => {
      if (sendingRef.current) return
      sendingRef.current = true
      setThinking(true)

      const targetCoinId = hints.coinId ?? stateRef.current.activeCoin.id
      const targetTfId = hints.timeframeId ?? stateRef.current.timeframe.id
      if (hints.coinId && hints.coinId !== stateRef.current.activeCoin.id) setActiveCoinId(hints.coinId)
      if (hints.timeframeId && hints.timeframeId !== stateRef.current.timeframe.id) setTimeframeId(hints.timeframeId)

      // The switch above re-fetches the window's candles — wait for it to
      // settle (bounded) so the payload carries the RIGHT asset's data.
      await waitForWindow(targetCoinId, targetTfId, 6000)

      const current = stateRef.current
      const targetCoin = current.activeCoin
      const targetTimeframe = current.timeframe
      const selected = modelId
      const isLocal = selected === 'local'

      const request = buildOracleRequest({
        coin: targetCoin,
        timeframeId: targetTimeframe.id,
        analysis: current.intelligence.analysis,
        candles: current.intelligence.candles,
        snapshot: current.snapshot,
        source: current.snapshot?.source ?? 'unknown',
        freshness: current.intelligence.freshness,
        requestedAnalysis: prompt,
        mode,
        responseDetail: 'default',
      })
      request.model = selected

      const base = {
        role: 'oracle' as const,
        time: nowLabel(),
        streaming: false as const,
        prompt,
        coinId: targetCoin.id,
        timeframeId: targetTimeframe.id,
        exchange,
      }
      const info = modelInfo(selected)
      const startedAt = performance.now()

      try {
        const result = isLocal ? localAnalysis(request) : await callOracle(request)
        const message: OracleMessage = {
          ...base,
          id: newId(),
          card: {
            kind: 'ai',
            analysis: result.analysis,
            meta: result.meta,
            modelLabel: info.label,
          },
        }
        setMessages((ms) => [...ms, message])
        setLastRequest({
          modelLabel: info.label,
          provider: result.meta.provider,
          status: 'ok',
          code: null,
          latencyMs: result.meta.latencyMs,
          estimatedCostUsd: result.meta.estimatedCostUsd,
          promptTokens: result.meta.promptTokens,
          completionTokens: result.meta.completionTokens,
          at: Date.now(),
        })
      } catch (cause) {
        const error =
          cause instanceof OracleClientError
            ? cause
            : new OracleClientError('service_unavailable', 'Oracle could not complete the analysis.')
        const message: OracleMessage = {
          ...base,
          id: newId(),
          card: {
            kind: 'ai-error',
            code: error.code,
            message: error.message,
            detail: error.detail,
            modelLabel: info.label,
          },
        }
        setMessages((ms) => [...ms, message])
        setLastRequest({
          modelLabel: info.label,
          provider: info.providerLabel,
          status: 'error',
          code: error.code,
          latencyMs: Math.round(performance.now() - startedAt),
          estimatedCostUsd: null,
          promptTokens: null,
          completionTokens: null,
          at: Date.now(),
        })
      } finally {
        setThinking(false)
        sendingRef.current = false
      }
    },
    [mode, modelId],
  )

  function send(text: string, coinId?: string, chart?: Coin) {
    const trimmed = text.trim()
    if (!trimmed || thinking || sendingRef.current) return

    const exchange = newId()
    setMessages((ms) => [
      ...ms,
      {
        id: newId(),
        role: 'user',
        time: nowLabel(),
        text: trimmed,
        exchange,
        ...(chart ? { chart } : {}),
      },
    ])
    // A chart attachment also pins the analysis to that asset.
    runResponse(trimmed, { coinId: coinId ?? chart?.id }, exchange)
  }

  /** Composer path — chart arrives as a Coin, becomes the message hint. */
  function handleComposerSend(text: string, chart?: Coin) {
    send(text, chart?.id, chart)
  }

  /** Replay a response for the same prompt — no duplicate user bubble. */
  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (thinkingRef.current || sendingRef.current) return
      const message = messagesRef.current.find((m) => m.id === messageId)
      if (!message?.prompt || !message.exchange) return

      // Drop the old oracle responses for that exchange, keep the user
      // message, then run the staged flow again.
      setMessages((ms) => ms.filter((m) => !(m.role === 'oracle' && m.exchange === message.exchange)))
      runResponse(
        message.prompt,
        { coinId: message.coinId, timeframeId: message.timeframeId },
        message.exchange,
      )
    },
    [runResponse],
  )

  const handleStreamed = useCallback((id: string) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, streaming: false } : m)))
  }, [])

  /** Save an oracle message's card to local history. */
  const handleSave = useCallback(
    (message: OracleMessage) => {
      if (!message.card || !message.prompt) return null
      const coinId = message.coinId ?? activeCoin.id
      const timeframeIdHint = message.timeframeId ?? timeframe.id
      const exists = saved.some(
        (item) =>
          item.coinId === coinId &&
          item.timeframeId === timeframeIdHint &&
          item.prompt === message.prompt,
      )
      if (exists) return 'exists'
      const item: SavedAnalysis = {
        id: newId(),
        coinId,
        timeframeId: timeframeIdHint,
        prompt: message.prompt,
        card: message.card,
        summary: cardSummary(message.card),
        mode,
        createdAt: Date.now(),
      }
      const next = [item, ...saved]
      setSaved(next)
      persistSavedAnalyses(next)
      return 'saved'
    },
    // Optional chaining: deps are evaluated every render, and activeCoin can
    // still be undefined during the first market load.
    [saved, activeCoin?.id, timeframe.id, mode],
  )

  /** Reopen a saved analysis — restore its asset/window and add the card. */
  const handleOpenSaved = useCallback((item: SavedAnalysis) => {
    setActiveCoinId(item.coinId)
    setTimeframeId(item.timeframeId)
    setMessages((ms) => [
      ...ms,
      {
        id: newId(),
        role: 'oracle',
        time: nowLabel(),
        card: item.card,
        streaming: false,
        prompt: item.prompt,
        coinId: item.coinId,
        timeframeId: item.timeframeId,
        exchange: newId(),
        fromHistory: true,
      },
    ])
    setHistoryOpen(false)
  }, [])

  const handleDeleteSaved = useCallback((id: string) => {
    const next = saved.filter((item) => item.id !== id)
    setSaved(next)
    persistSavedAnalyses(next)
  }, [saved])

  function handlePick(suggestion: Suggestion) {
    send(suggestion.prompt, suggestion.coinId)
  }

  // No coin to analyze yet — first load or a total feed outage. Never
  // fabricate an asset to analyze. Past these guards activeCoin is defined,
  // so the health/snapshot memos above are non-null too.
  if (loading && !activeCoin) {
    return <MarketDataLoading className="mx-auto max-w-6xl pt-4" />
  }
  if (!activeCoin) {
    return <MarketDataError onRetry={refresh} className="mx-auto max-w-6xl pt-4" />
  }

  // The shell's <main> already adds pb-20 on mobile; subtract it here so the
  // total bottom clearance (page + shell) equals the measured composer height
  // exactly — no dead space, no double-counting.
  return (
    <div className="mx-auto max-w-6xl pb-[calc(var(--forge-composer-h,13.5rem)_-_5rem)] lg:pb-0">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        {/* Conversation column */}
        <div className="min-w-0">
          <Conversation
            messages={messages}
            isThinking={thinking}
            hasStreaming={hasStreaming}
            coin={activeCoin}
            timeframeId={timeframeId}
            mode={mode}
            modelLabel={modelInfo(modelId).label}
            onStreamed={handleStreamed}
            onRegenerate={handleRegenerate}
            onSave={handleSave}
            onPickSuggestion={handlePick}
          />

          {/* Floating composer — pinned to the viewport bottom on mobile
              via a portal to <body> (immune to the page transition's
              filter/transform), sticky inside the column on desktop.
              Messages scroll beneath its gradient fade either way. */}
          {isDesktop ? (
            <div
              ref={composerRef}
              className="sticky bottom-0 z-20 bg-gradient-to-t from-background via-background/90 to-transparent px-0 pb-[max(env(safe-area-inset-bottom,0px),1rem)] pt-6"
            >
              <RequestStatusStrip info={lastRequest} />
              <InputBar
                onSend={handleComposerSend}
                disabled={thinking}
                activeCoin={activeCoin}
                mode={mode}
                onModeChange={setMode}
                onOpenContext={() => setContextOpen(true)}
                onOpenHistory={() => setHistoryOpen(true)}
                historyCount={saved.length}
              />
            </div>
          ) : (
            createPortal(
              <div
                ref={composerRef}
                className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/90 to-transparent px-4 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] pt-6 sm:px-6"
              >
                <RequestStatusStrip info={lastRequest} />
                <InputBar
                  onSend={handleComposerSend}
                  disabled={thinking}
                  activeCoin={activeCoin}
                  mode={mode}
                  onModeChange={setMode}
                  onOpenContext={() => setContextOpen(true)}
                  onOpenHistory={() => setHistoryOpen(true)}
                  historyCount={saved.length}
                />
              </div>,
              composerHost,
            )
          )}
        </div>

        {/* Desktop context rail */}
        <OracleSidebar
          coin={activeCoin}
          timeframeId={timeframeId}
          onTimeframeChange={setTimeframeId}
          health={health!}
        />
      </div>

      {/* Market Context — full snapshot of what Oracle is analyzing */}
      <MarketContextSheet
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        snapshot={snapshot!}
        timeframeId={timeframeId}
        onTimeframeChange={setTimeframeId}
      />

      {/* Oracle History — saved analyses */}
      <HistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={saved}
        onOpen={handleOpenSaved}
        onDelete={handleDeleteSaved}
      />
    </div>
  )
}
