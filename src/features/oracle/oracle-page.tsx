import { useMemo, useRef, useState } from 'react'

import { coins } from '@/features/markets/data'
import {
  DEFAULT_LIQUIDITY_TIMEFRAME,
  liquidityTimeframes,
  type LiquidityTimeframeId,
} from '@/features/workspace/data'

import { Conversation } from './components/conversation'
import { InputBar } from './components/input-bar'
import { MobileContextSheet } from './components/mobile-context-sheet'
import { OracleSidebar } from './components/sidebar'
import { buildOracleResponse, marketHealth, newId, nowLabel, resolveCoin } from './data'
import type { OracleMessage, Suggestion } from './types'

/**
 * Oracle — Forge's command center. A calm conversation with a market
 * analyst: structured response cards instead of chat bubbles, a live
 * context rail on desktop (bottom sheet on mobile), and a floating
 * composer. All responses are mock — no AI connected yet.
 */
export function OraclePage() {
  const [messages, setMessages] = useState<OracleMessage[]>([])
  const [activeCoinId, setActiveCoinId] = useState('bitcoin')
  const [timeframeId, setTimeframeId] = useState<LiquidityTimeframeId>(DEFAULT_LIQUIDITY_TIMEFRAME)
  const [thinking, setThinking] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Ref guard — closes the double-submit race before state propagates.
  const sendingRef = useRef(false)

  const activeCoin = coins.find((coin) => coin.id === activeCoinId) ?? coins[0]
  const timeframe = useMemo(
    () =>
      liquidityTimeframes.find((tf) => tf.id === timeframeId) ??
      liquidityTimeframes.find((tf) => tf.id === DEFAULT_LIQUIDITY_TIMEFRAME)!,
    [timeframeId],
  )
  const health = useMemo(() => marketHealth(activeCoin, timeframe), [activeCoin, timeframe])
  const hasStreaming = messages.some((message) => message.streaming)

  function send(text: string, coinId?: string) {
    const trimmed = text.trim()
    if (!trimmed || thinking || sendingRef.current) return
    sendingRef.current = true

    const target = coinId
      ? (coins.find((coin) => coin.id === coinId) ?? activeCoin)
      : resolveCoin(trimmed, activeCoin)
    setActiveCoinId(target.id)

    setMessages((ms) => [...ms, { id: newId(), role: 'user', time: nowLabel(), text: trimmed }])
    setThinking(true)

    // Mock latency, then stream the composed response card(s).
    window.setTimeout(() => {
      const cards = buildOracleResponse(trimmed, { coin: target, timeframe })
      setMessages((ms) => [
        ...ms,
        ...cards.map((card) => ({
          id: newId(),
          role: 'oracle' as const,
          time: nowLabel(),
          card,
          streaming: true,
        })),
      ])
      setThinking(false)
      sendingRef.current = false
    }, 900)
  }

  function handleStreamed(id: string) {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, streaming: false } : m)))
  }

  function handlePick(suggestion: Suggestion) {
    send(suggestion.prompt, suggestion.coinId)
  }

  return (
    <div className="mx-auto max-w-6xl pb-44 lg:pb-0">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        {/* Conversation column */}
        <div className="min-w-0">
          <Conversation
            messages={messages}
            isThinking={thinking}
            hasStreaming={hasStreaming}
            coin={activeCoin}
            timeframeId={timeframeId}
            onStreamed={handleStreamed}
            onPickSuggestion={handlePick}
          />

          {/* Floating composer — fixed to the viewport bottom on mobile,
              sticky inside the column on desktop. Messages scroll beneath
              its gradient fade either way. */}
          <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/90 to-transparent px-4 pb-[max(env(safe-area-inset-bottom,0px),1rem)] pt-10 sm:px-6 lg:sticky lg:inset-x-auto lg:px-0">
            <InputBar onSend={send} disabled={thinking} onOpenContext={() => setSheetOpen(true)} />
          </div>
        </div>

        {/* Desktop context rail */}
        <OracleSidebar
          coin={activeCoin}
          timeframeId={timeframeId}
          onTimeframeChange={setTimeframeId}
          health={health}
        />
      </div>

      {/* Mobile context sheet */}
      <MobileContextSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        coin={activeCoin}
        timeframeId={timeframeId}
        onTimeframeChange={setTimeframeId}
        health={health}
      />
    </div>
  )
}
