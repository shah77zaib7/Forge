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

import { Conversation } from './components/conversation'
import { HistorySheet } from './components/history-sheet'
import { InputBar } from './components/input-bar'
import { MarketContextSheet } from './components/market-context-sheet'
import { OracleSidebar } from './components/sidebar'
import { cardSummary, marketHealth, newId, nowLabel, THINK_DURATION } from './data'
import { useMarketIntelligence } from '@/features/markets/hooks/use-market-intelligence'
import { buildMarketContext } from './services/market-context'
import { loadSavedAnalyses, persistSavedAnalyses } from './services/history'
import { oracleService } from './services/oracle-service'
import type {
  ConversationContext,
  OracleMessage,
  OracleMode,
  SavedAnalysis,
  Suggestion,
} from './types'

/**
 * Oracle — Forge's command center. A calm conversation with a market
 * analyst: structured response cards instead of chat bubbles, a live
 * context rail on desktop (full Market Context sheet on demand), a
 * Trader/Teacher mode, and locally saved analyses.
 *
 * All responses come from the MockOracleService — a deterministic engine
 * behind the OracleService contract, so a real AI can replace it later
 * without UI changes. Market data is live, from the shared store.
 */
export function OraclePage() {
  const { preferences } = usePreferences()
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
            intelligence.fetchedAt,
            intelligence.status === 'ready' && intelligence.analysis
              ? `${timeframe.id === '1M' || timeframe.id === '5M' || timeframe.id === '15M' ? 'Exchange klines' : 'CoinGecko'} · ${intelligence.analysis.candleGranularity}`
              : 'OHLC history',
          )
        : null,
    [activeCoin, timeframe, intelligence],
  )
  const hasStreaming = messages.some((message) => message.streaming)

  /**
   * Core response flow — resolve the question against the conversation
   * context, enter the staged thinking phase, then stream the composed
   * card(s). Shared by a fresh user turn and Regenerate.
   */
  const runResponse = useCallback(
    (prompt: string, hints: { coinId?: string; timeframeId?: LiquidityTimeframeId }, exchange: string) => {
      if (sendingRef.current) return
      sendingRef.current = true

      const conversation: ConversationContext = {
        coin: activeCoin,
        timeframe,
        mode,
        recentUserMessages: messagesRef.current
          .filter((m) => m.role === 'user')
          .slice(-6)
          .map((m) => m.text ?? ''),
        recentPrompts: messagesRef.current
          .filter((m) => m.role === 'oracle' && m.prompt)
          .slice(-6)
          .map((m) => m.prompt!),
      }
      const response = oracleService.respond({
        userMessage: prompt,
        conversation,
        mode,
        coinIdHint: hints.coinId,
        timeframeIdHint: hints.timeframeId,
      })

      setActiveCoinId(response.coin.id)
      setTimeframeId(response.timeframe.id)
      setThinking(true)

      // Staged thinking phase, then the cards stream themselves in.
      window.setTimeout(() => {
        setMessages((ms) => [
          ...ms,
          ...response.cards.map((card) => ({
            id: newId(),
            role: 'oracle' as const,
            time: nowLabel(),
            card,
            streaming: true,
            prompt,
            coinId: response.coin.id,
            timeframeId: response.timeframe.id,
            exchange,
          })),
        ])
        setThinking(false)
        sendingRef.current = false
      }, THINK_DURATION)
    },
    [activeCoin, timeframe, mode],
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
