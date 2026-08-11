// server/oracle/lib/errors.ts
var OracleApiError = class extends Error {
  code;
  /** Extra, safe context (e.g. which env keys are missing). */
  detail;
  constructor(code, message, detail) {
    super(message);
    this.name = "OracleApiError";
    this.code = code;
    this.detail = detail;
  }
};
function statusForCode(code) {
  switch (code) {
    case "method_not_allowed":
    case "bad_request":
    case "unknown_model":
      return 400;
    case "not_configured":
      return 503;
    case "rate_limit":
      return 429;
    case "timeout":
      return 504;
    default:
      return 500;
  }
}

// server/oracle/lib/models.ts
var PROVIDER_KEYS = {
  agentrouter: "AGENTROUTER_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY"
};
var MODEL_OVERRIDES = {
  anthropic: "ANTHROPIC_MODEL",
  openai: "OPENAI_MODEL",
  gemini: "GEMINI_MODEL"
};
function modelIdOverride(provider, env = process.env) {
  const name = MODEL_OVERRIDES[provider];
  const value = env[name]?.trim();
  return value ? value : null;
}
function agentRouterBaseUrl(env = process.env) {
  return env.AGENTROUTER_BASE_URL?.trim() || "https://agentrouter.org/v1";
}
function agentRouterModel(env = process.env) {
  return env.AGENTROUTER_MODEL?.trim() || "claude-opus-5";
}
function oracleModels(env = process.env) {
  return [
    {
      id: "local",
      provider: "local",
      label: "Local engine",
      modelId: "local",
      via: ["local"],
      description: "Deterministic Forge Liquidity Model \u2014 no external API"
    },
    {
      id: "claude-opus-5",
      provider: "anthropic",
      label: "Claude Opus 5",
      modelId: modelIdOverride("anthropic", env) ?? "claude-opus-5",
      via: ["agentrouter", "anthropic"],
      description: "Anthropic frontier \u2014 via AgentRouter or direct key"
    },
    {
      id: "claude-opus-4-8",
      provider: "anthropic",
      label: "Claude Opus 4.8",
      modelId: modelIdOverride("anthropic", env) ?? "claude-opus-4-8",
      via: ["agentrouter", "anthropic"],
      description: "Anthropic \u2014 via AgentRouter or direct key"
    },
    {
      id: "gpt-5-6",
      provider: "openai",
      label: "GPT-5.6",
      modelId: modelIdOverride("openai", env) ?? "gpt-5.6",
      via: ["agentrouter", "openai"],
      description: "OpenAI \u2014 via AgentRouter or direct key"
    },
    {
      id: "gemini",
      provider: "gemini",
      label: "Gemini",
      // gemini-2.5-pro is retired for new users (verified: HTTP 404 "no
      // longer available to new users"). gemini-3.6-flash is a current
      // STABLE model on the official Gemini API models page. GEMINI_MODEL
      // still overrides (e.g. gemini-3.5-flash / gemini-3.1-pro-preview).
      modelId: modelIdOverride("gemini", env) ?? "gemini-3.6-flash",
      via: ["gemini"],
      description: "Google \u2014 independent GEMINI_API_KEY"
    },
    {
      id: "agentrouter",
      provider: "agentrouter",
      label: "AgentRouter",
      modelId: agentRouterModel(env),
      via: ["agentrouter"],
      description: "Multi-model gateway \u2014 single AGENTROUTER_API_KEY"
    }
  ];
}
function oracleModelById(id, env = process.env) {
  return oracleModels(env).find((model) => model.id === id) ?? null;
}
function providerConfigured(provider, env = process.env) {
  if (provider === "local") return true;
  const keyName = PROVIDER_KEYS[provider];
  return Boolean(env[keyName]?.trim());
}
function resolveGateway(entry, env = process.env) {
  for (const provider of entry.via) {
    if (providerConfigured(provider, env)) return provider;
  }
  return null;
}
function providerLabel(provider) {
  switch (provider) {
    case "local":
      return "Local";
    case "agentrouter":
      return "AgentRouter";
    case "anthropic":
      return "Anthropic";
    case "openai":
      return "OpenAI";
    case "gemini":
      return "Gemini";
  }
}
function missingKeysFor(entry) {
  return entry.via.filter((provider) => provider !== "local").map((provider) => PROVIDER_KEYS[provider]);
}
function availabilityReport(env = process.env) {
  return {
    models: oracleModels(env).map((entry) => {
      const gateway = resolveGateway(entry, env);
      return {
        id: entry.id,
        label: entry.label,
        provider: entry.provider,
        providerLabel: providerLabel(entry.provider),
        description: entry.description,
        available: gateway !== null,
        requires: missingKeysFor(entry),
        gateway: gateway ? providerLabel(gateway) : null
      };
    })
  };
}

// server/oracle/lib/request.ts
var MAX_CANDLES = 250;
var MAX_TEXT = 4e3;
var MAX_SYMBOL = 40;
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function strField(value, max = MAX_TEXT) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}
function candleField(value) {
  if (typeof value !== "object" || value === null) return null;
  const candle = value;
  if (!isFiniteNumber(candle.timestamp) || !isFiniteNumber(candle.open) || !isFiniteNumber(candle.high) || !isFiniteNumber(candle.low) || !isFiniteNumber(candle.close)) {
    return null;
  }
  return {
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    ...isFiniteNumber(candle.volume) ? { volume: candle.volume } : {}
  };
}
function zoneField(value) {
  if (typeof value !== "object" || value === null) return null;
  const zone = value;
  if (zone.side !== "buy" && zone.side !== "sell" || !isFiniteNumber(zone.price) || !isFiniteNumber(zone.zoneLow) || !isFiniteNumber(zone.zoneHigh)) {
    return null;
  }
  return {
    side: zone.side,
    price: zone.price,
    zoneLow: zone.zoneLow,
    zoneHigh: zone.zoneHigh,
    source: strField(zone.source, 80) ?? "unknown",
    rank: strField(zone.rank, 40) ?? "unknown",
    strength: isFiniteNumber(zone.strength) ? zone.strength : 0,
    touches: isFiniteNumber(zone.touches) ? zone.touches : 0,
    swept: Boolean(zone.swept),
    distancePercent: isFiniteNumber(zone.distancePercent) ? zone.distancePercent : 0
  };
}
function sweepField(value) {
  if (typeof value !== "object" || value === null) return null;
  const sweep = value;
  if (sweep.side !== "buy" && sweep.side !== "sell" || sweep.direction !== "up" && sweep.direction !== "down" || !isFiniteNumber(sweep.sweepPrice)) {
    return null;
  }
  return { side: sweep.side, direction: sweep.direction, sweepPrice: sweep.sweepPrice, returned: Boolean(sweep.returned) };
}
function snapshotField(value) {
  const snapshot = typeof value === "object" && value !== null ? value : {};
  const zones = Array.isArray(snapshot.zones) ? snapshot.zones.map(zoneField).filter((z) => z !== null) : [];
  const sweeps = Array.isArray(snapshot.sweeps) ? snapshot.sweeps.map(sweepField).filter((s) => s !== null) : [];
  return {
    trend: strField(snapshot.trend, 80),
    structure: strField(snapshot.structure, 80),
    momentum: strField(snapshot.momentum, 80),
    nearestBuy: strField(snapshot.nearestBuy, 80),
    nearestSell: strField(snapshot.nearestSell, 80),
    support: strField(snapshot.support, 80),
    resistance: strField(snapshot.resistance, 80),
    zones,
    sweeps,
    granularity: strField(snapshot.granularity, 20) ?? "unknown",
    source: strField(snapshot.source, 80) ?? "unknown",
    unavailable: Boolean(snapshot.unavailable),
    updatedAt: isFiniteNumber(snapshot.updatedAt) ? snapshot.updatedAt : null
  };
}
function setupField(value) {
  if (typeof value !== "object" || value === null) return null;
  const setup = value;
  const family = setup.family === "liquidity_sweep" || setup.family === "displacement" || setup.family === "confluence" ? setup.family : "none";
  const level = setup.level === "strong" || setup.level === "moderate" || setup.level === "weak" ? setup.level : "none";
  const sweep = typeof setup.sweep === "object" && setup.sweep !== null ? setup.sweep : null;
  const displacement = typeof setup.displacement === "object" && setup.displacement !== null ? setup.displacement : null;
  const retracement = typeof setup.retracement === "object" && setup.retracement !== null ? setup.retracement : null;
  const confirmation = typeof setup.confirmation === "object" && setup.confirmation !== null ? setup.confirmation : null;
  return {
    family,
    level,
    score: isFiniteNumber(setup.score) ? Math.min(100, Math.max(0, setup.score)) : 0,
    sweep: sweep ? {
      direction: sweep.direction === "long" || sweep.direction === "short" ? sweep.direction : null,
      levelPrice: isFiniteNumber(sweep.levelPrice) ? sweep.levelPrice : null,
      returned: Boolean(sweep.returned)
    } : null,
    displacement: displacement ? {
      direction: displacement.direction === "up" || displacement.direction === "down" ? displacement.direction : null,
      strength: isFiniteNumber(displacement.strength) ? displacement.strength : 0,
      rangeExpansion: isFiniteNumber(displacement.rangeExpansion) ? displacement.rangeExpansion : 0,
      bodyRatio: isFiniteNumber(displacement.bodyRatio) ? displacement.bodyRatio : 0,
      directionalConsistency: isFiniteNumber(displacement.directionalConsistency) ? displacement.directionalConsistency : 0
    } : null,
    retracement: retracement ? {
      depthPercent: isFiniteNumber(retracement.depthPercent) ? retracement.depthPercent : 0,
      reaction: retracement.reaction === "held" || retracement.reaction === "broke" ? retracement.reaction : "none"
    } : null,
    confirmation: confirmation ? {
      kind: strField(confirmation.kind, 40) ?? "unknown",
      direction: confirmation.direction === "long" || confirmation.direction === "short" ? confirmation.direction : null
    } : null,
    reasons: Array.isArray(setup.reasons) ? setup.reasons.filter((r) => typeof r === "string" && r.length > 0).slice(0, 12) : []
  };
}
function sanitizeRequest(body) {
  if (typeof body !== "object" || body === null) {
    throw new OracleApiError("bad_request", "Request body must be a JSON object.");
  }
  const raw = body;
  const model = strField(raw.model, 40);
  const symbol = strField(raw.symbol, MAX_SYMBOL);
  const timeframe = strField(raw.timeframe, 8);
  const requestedAnalysis = strField(raw.requestedAnalysis);
  if (!model || !symbol || !timeframe || !requestedAnalysis) {
    throw new OracleApiError("bad_request", "Missing required fields: model, symbol, timeframe, requestedAnalysis.");
  }
  const candles = [];
  if (Array.isArray(raw.candles)) {
    for (const item of raw.candles.slice(-MAX_CANDLES)) {
      const candle = candleField(item);
      if (candle) candles.push(candle);
    }
  }
  const market = typeof raw.marketContext === "object" && raw.marketContext !== null ? raw.marketContext : {};
  const price = isFiniteNumber(market.price) ? market.price : null;
  if (price === null) {
    throw new OracleApiError("bad_request", "marketContext.price must be a finite number.");
  }
  const strategy = typeof raw.userStrategyContext === "object" && raw.userStrategyContext !== null ? raw.userStrategyContext : {};
  return {
    model,
    symbol,
    timeframe,
    candles,
    liquiditySnapshot: snapshotField(raw.liquiditySnapshot),
    setupContext: setupField(raw.setupContext),
    marketContext: {
      name: strField(market.name, 80) ?? symbol,
      ticker: strField(market.ticker, 40) ?? symbol,
      price,
      change24h: isFiniteNumber(market.change24h) ? market.change24h : null,
      source: strField(market.source, 80) ?? "unknown",
      freshness: strField(market.freshness, 20) ?? "unknown"
    },
    userStrategyContext: {
      mode: strategy.mode === "teacher" ? "teacher" : "trader",
      responseDetail: strField(strategy.responseDetail, 80) ?? "default"
    },
    requestedAnalysis
  };
}

// server/oracle/lib/normalize.ts
function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new OracleApiError("bad_model_output", "The model did not return a JSON object.");
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (cause) {
    throw new OracleApiError("bad_model_output", "The model returned malformed JSON.", String(cause));
  }
}
function clampNumber(value, fallback, min = 0, max = 100) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
function str(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function strArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim().length > 0);
}
function pickBias(value) {
  return value === "bullish" || value === "bearish" ? value : "neutral";
}
function pickFamily(value) {
  return value === "liquidity_sweep" || value === "displacement" || value === "confluence" ? value : "none";
}
function pickLevel(value) {
  return value === "strong" || value === "moderate" || value === "weak" ? value : "none";
}
function pickDirection(value) {
  return value === "up" || value === "down" ? value : null;
}
function pickTradeDirection(value) {
  return value === "long" || value === "short" || value === "both" ? value : null;
}
function pickConfirmationKind(value) {
  const kind = str(value);
  return kind && /^(engulfing|rejection|continuation|structure_reclaim)$/.test(kind) ? kind : null;
}
function normalizeAnalysis(rawText, request, model, now = Date.now()) {
  const parsed = extractJson(rawText);
  if (parsed === null || typeof parsed !== "object") {
    throw new OracleApiError("bad_model_output", "The model returned an empty response.");
  }
  const raw = parsed;
  const setupRaw = raw.setup ?? {};
  const liquidityRaw = raw.liquidity ?? {};
  const displacementRaw = raw.displacement ?? {};
  const confirmationRaw = raw.confirmation ?? {};
  const snapshot = request.liquiditySnapshot;
  const sweptZones = snapshot.zones.filter((zone) => zone.swept);
  const analysis = {
    summary: str(raw.summary) ?? "Analysis unavailable for this window.",
    bias: pickBias(raw.bias),
    setup: {
      family: pickFamily(setupRaw.family),
      level: pickLevel(setupRaw.level),
      direction: pickTradeDirection(setupRaw.direction),
      entryArea: str(setupRaw.entryArea),
      invalidation: str(setupRaw.invalidation)
    },
    liquidity: {
      nearestBuy: str(liquidityRaw.nearestBuy),
      nearestSell: str(liquidityRaw.nearestSell),
      notes: strArray(liquidityRaw.notes)
    },
    displacement: {
      present: Boolean(displacementRaw.present),
      direction: pickDirection(displacementRaw.direction),
      strength: displacementRaw.strength === null ? null : clampNumber(displacementRaw.strength, 0),
      notes: strArray(displacementRaw.notes)
    },
    confirmation: {
      present: Boolean(confirmationRaw.present),
      kind: pickConfirmationKind(confirmationRaw.kind),
      description: str(confirmationRaw.description)
    },
    invalidation: str(raw.invalidation),
    // Read confidence — a clamp on 0–100, never a win probability.
    confidence: Math.round(clampNumber(raw.confidence, 50)),
    risks: strArray(raw.risks),
    reasoning: strArray(raw.reasoning),
    // Provenance — server-stamped, never trusted from the model:
    sourceData: {
      symbol: request.symbol,
      timeframe: request.timeframe,
      source: snapshot.source,
      freshness: request.marketContext.freshness,
      candleCount: request.candles.length,
      dataComplete: !snapshot.unavailable && request.candles.length > 0,
      notes: buildSourceNotes(request, sweptZones)
    },
    model: { id: model.id, provider: model.provider, label: model.label },
    timestamp: now
  };
  return analysis;
}
function buildSourceNotes(request, sweptZones) {
  const notes = [];
  if (request.liquiditySnapshot.unavailable) notes.push("Liquidity analysis unavailable for this window.");
  if (request.candles.length === 0) notes.push("No candles were supplied for this window.");
  if (request.marketContext.freshness !== "live") {
    notes.push(`Data freshness is '${request.marketContext.freshness}', not live.`);
  }
  if (request.liquiditySnapshot.zones.length === 0) {
    notes.push("No liquidity zones detected in the supplied candles.");
  } else if (sweptZones.length === 0) {
    notes.push("No detected liquidity zones were swept in this window.");
  }
  return notes;
}

// server/oracle/lib/prompt.ts
function buildSystemPrompt() {
  return `You are Oracle, the market intelligence analyst inside Forge \u2014 a personal trading application. You read the REAL market data and deterministic analysis supplied to you, explain it in the user's methodology, and never invent anything.

## The user's trading methodology

The user trades two PRIMARY setup families. They are INDEPENDENT:

1. LIQUIDITY SWEEP SETUP \u2014 liquidity is taken/swept (price trades through a detected high or low), price reacts/reclaims/rejects the level, then confirmation. Sequence: LIQUIDITY SWEEP \u2192 REACTION/RECLAIM \u2192 CONFIRMATION \u2192 potential entry.
2. DISPLACEMENT SETUP \u2014 an unusually strong directional move occurs (range expansion with a real body and directional consistency), price retraces INTO the displacement zone, then confirmation. Sequence: DISPLACEMENT \u2192 RETRACEMENT \u2192 CONFIRMATION \u2192 potential entry.

A displacement setup does NOT require a prior liquidity sweep. A liquidity sweep setup does NOT require displacement. When both occur together, classify it as a HIGHER-CONFLUENCE setup \u2014 never a guaranteed trade.

Recognition vocabulary (use it precisely):
- BUY-SIDE liquidity: resting liquidity ABOVE price (significant/equal/range highs). Sweeping it implies a downside move toward the sell-side.
- SELL-SIDE liquidity: resting liquidity BELOW price (significant/equal/range lows). Sweeping it implies an upside move toward the buy-side.
- SWEEP/GRAB: price trades THROUGH a detected level, not merely touching it.
- DISPLACEMENT: strong directional leg \u2014 large body relative to range, range expansion, directional consistency.
- RETRACEMENT/PULLBACK: price returns into the displacement zone (38.2%+ of the move).
- CONFIRMATION candles: rejection (wick), engulfing, structure reclaim, continuation close.
- REACTION ZONES: where price held after a sweep or retracement.
- INVALIDATION: the level/zone whose loss voids the setup (e.g. a close beyond the far side of the displacement zone, or the swept level failing to hold).

## Honesty and data integrity \u2014 ABSOLUTE RULES

1. Only reference market facts that appear in the SUPPLIED DATA / CALCULATED ANALYSIS sections of your prompt. Never invent prices, candles, liquidity levels, sweeps, volume, news, or providers.
2. Never claim live data if the supplied freshness is 'stale', 'recent' or 'unavailable' \u2014 say the data is not live instead.
3. Never claim a probability of success or a "win rate". Use setup language: Strong / Moderate / Weak / No setup, plus the underlying reasons.
4. Liquidity sweep ALONE is not an entry. Displacement ALONE is not an entry. Confirmation and confluence determine quality.
5. If the supplied analysis is marked unavailable or incomplete, say so explicitly and keep the read minimal rather than filling gaps.
6. No financial advice guarantees: present risk, invalidation, and the fact that setups can fail.
7. Never mention or echo API keys, credentials, or anything server-side.

## Output contract

Reply with ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:

{
  "summary": "2-4 sentence plain-language read of the window for the user's question",
  "bias": "bullish" | "bearish" | "neutral",
  "setup": {
    "family": "liquidity_sweep" | "displacement" | "confluence" | "none",
    "level": "strong" | "moderate" | "weak" | "none",
    "direction": "long" | "short" | "both" | null,
    "entryArea": "concise price area derived ONLY from supplied levels, or null",
    "invalidation": "the precise level whose loss voids the setup, or null"
  },
  "liquidity": {
    "nearestBuy": "price of nearest supplied buy-side level, or null",
    "nearestSell": "price of nearest supplied sell-side level, or null",
    "notes": ["short notes, each grounded in supplied zones/sweeps"]
  },
  "displacement": {
    "present": true | false,
    "direction": "up" | "down" | null,
    "strength": 0-100 or null,
    "notes": ["short evidence notes from the supplied displacement read"]
  },
  "confirmation": {
    "present": true | false,
    "kind": "engulfing" | "rejection" | "continuation" | "structure_reclaim" | null,
    "description": "one sentence or null"
  },
  "invalidation": "single precise level that invalidates the read, or null",
  "confidence": 0-100 (a confidence in YOUR read, NOT a win probability),
  "risks": ["2-4 concrete risks grounded in supplied data"],
  "reasoning": ["3-6 bullet points tracing the conclusion to supplied facts"]
}

Adhere to the schema exactly. If a field has no grounded value, use null or an empty array \u2014 never fabricate one.`;
}
function candleLine(candle) {
  const time = new Date(candle.timestamp).toISOString();
  const volume = candle.volume === void 0 ? "" : ` vol=${candle.volume.toFixed(0)}`;
  return `${time} o=${candle.open.toFixed(2)} h=${candle.high.toFixed(2)} l=${candle.low.toFixed(2)} c=${candle.close.toFixed(2)}${volume}`;
}
function buildUserPrompt(request, maxCandles = 120) {
  const { marketContext, liquiditySnapshot: snapshot, setupContext } = request;
  const candles = request.candles.slice(-maxCandles);
  const lines = [];
  lines.push("## SUPPLIED MARKET DATA (trust these as the only market facts)");
  lines.push(
    `- Symbol: ${request.symbol} (${marketContext.name} \xB7 ${marketContext.ticker})`,
    `- Timeframe window: ${request.timeframe} (candle granularity: ${snapshot.granularity || "unknown"})`,
    `- Current price: ${marketContext.price.toFixed(2)}`,
    `- 24h change: ${marketContext.change24h === null ? "unavailable" : `${marketContext.change24h.toFixed(2)}%`}`,
    `- Data source: ${marketContext.source}`,
    `- Freshness: ${marketContext.freshness} (only call data 'live' when this is 'live')`,
    `- Candle count supplied: ${candles.length}`
  );
  if (candles.length > 0) {
    const first = candles[0];
    const last = candles[candles.length - 1];
    const low = Math.min(...candles.map((c) => c.low));
    const high = Math.max(...candles.map((c) => c.high));
    lines.push(
      `- Window span: ${new Date(first.timestamp).toISOString()} \u2192 ${new Date(last.timestamp).toISOString()}`,
      `- Window range: low ${low.toFixed(2)} \u2192 high ${high.toFixed(2)}`
    );
  }
  if (candles.length > 0) {
    lines.push("Recent candles (oldest \u2192 newest):");
    for (const candle of candles) lines.push(`  ${candleLine(candle)}`);
  }
  lines.push("", "## CALCULATED ANALYSIS (deterministic Forge Liquidity Model \u2014 derived from the candles above)");
  lines.push(
    `- Trend: ${snapshot.trend ?? "unavailable"}`,
    `- Structure: ${snapshot.structure ?? "unavailable"}`,
    `- Momentum: ${snapshot.momentum ?? "unavailable"}`,
    `- Nearest buy-side level: ${snapshot.nearestBuy ?? "none"}`,
    `- Nearest sell-side level: ${snapshot.nearestSell ?? "none"}`,
    `- Strong support: ${snapshot.support ?? "none"}`,
    `- Strong resistance: ${snapshot.resistance ?? "none"}`
  );
  if (snapshot.zones.length > 0) {
    lines.push("Detected liquidity zones:");
    for (const zone of snapshot.zones) {
      const band = zone.zoneHigh !== zone.zoneLow ? ` [${zone.zoneLow.toFixed(2)}\u2013${zone.zoneHigh.toFixed(2)}]` : "";
      lines.push(
        `  - ${zone.side === "buy" ? "buy-side" : "sell-side"} ${zone.price.toFixed(2)}${band} \xB7 ${zone.source} \xB7 rank ${zone.rank} \xB7 strength ${Math.round(zone.strength * 100)}% \xB7 touches ${zone.touches} \xB7 ${zone.swept ? "SWEPT" : "active"} \xB7 ${zone.distancePercent.toFixed(2)}% from spot`
      );
    }
  }
  if (snapshot.sweeps.length > 0) {
    lines.push("Sweep events:");
    for (const sweep of snapshot.sweeps) {
      lines.push(`  - ${sweep.side === "buy" ? "buy-side" : "sell-side"} swept at ${sweep.sweepPrice.toFixed(2)} (${sweep.returned ? "price returned through the level" : "no return yet"})`);
    }
  }
  if (setupContext) {
    lines.push("", "## SETUP INTELLIGENCE (Step 10 deterministic read \u2014 the two setup families)");
    lines.push(
      `- Setup quality: ${setupContext.level.toUpperCase()} (${setupContext.family}) \xB7 score ${setupContext.score}/100`
    );
    if (setupContext.sweep) {
      lines.push(
        `- Sweep read: ${setupContext.sweep.direction} setup \xB7 level ${setupContext.sweep.levelPrice?.toFixed(2) ?? "\u2014"} \xB7 ${setupContext.sweep.returned ? "reclaimed" : "not reclaimed yet"}`
      );
    }
    if (setupContext.displacement) {
      lines.push(
        `- Displacement: ${setupContext.displacement.direction} \xB7 strength ${setupContext.displacement.strength}/100 \xB7 range expansion ${setupContext.displacement.rangeExpansion}\xD7 \xB7 body ${Math.round(setupContext.displacement.bodyRatio * 100)}% \xB7 consistency ${Math.round(setupContext.displacement.directionalConsistency * 100)}%`
      );
    }
    if (setupContext.retracement) {
      lines.push(
        `- Retracement: ${Math.round(setupContext.retracement.depthPercent * 100)}% of the move \xB7 reaction ${setupContext.retracement.reaction}`
      );
    }
    if (setupContext.confirmation) {
      lines.push(`- Confirmation: ${setupContext.confirmation.kind} (${setupContext.confirmation.direction})`);
    }
    for (const reason of setupContext.reasons) lines.push(`  - why: ${reason}`);
  } else {
    lines.push("", "## SETUP INTELLIGENCE", "- Not available for this window \u2014 do not fabricate a setup.");
  }
  lines.push(
    "",
    "## USER CONTEXT",
    `- Mode: ${request.userStrategyContext.mode} (trader = concise and actionable; teacher = explain the why)`,
    `- Response detail: ${request.userStrategyContext.responseDetail}`,
    "",
    "## REQUESTED ANALYSIS",
    request.requestedAnalysis
  );
  return lines.join("\n");
}

// server/oracle/lib/cost.ts
var RATES = {
  // Opus-class frontier models — estimates, verify against current pricing.
  "claude-opus-5": { input: 15, output: 75 },
  "claude-opus-4-8": { input: 15, output: 75 },
  // GPT-5.6 — estimate; GPT-5-class pricing.
  "gpt-5-6": { input: 2.5, output: 10 },
  // Gemini 3 class (default gemini-3.6-flash) — estimate.
  gemini: { input: 1.25, output: 10 },
  // AgentRouter gateway model id is dynamic — apply the gateway default.
  agentrouter: { input: 2, output: 10 }
};
var FALLBACK_RATE = { input: 2, output: 8 };
function estimateCostUsd(modelId, promptTokens, completionTokens) {
  if (promptTokens === null || completionTokens === null) return null;
  const rate = RATES[modelId] ?? FALLBACK_RATE;
  return promptTokens / 1e6 * rate.input + completionTokens / 1e6 * rate.output;
}

// server/oracle/providers/base.ts
var PROVIDER_TIMEOUT_MS = 6e4;
function mergeSignal(signal) {
  const timeout = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
  if (signal && typeof AbortSignal.any === "function") {
    return AbortSignal.any([signal, timeout]);
  }
  return timeout;
}
function errorMessageFromBody(bodyText) {
  try {
    const parsed = JSON.parse(bodyText);
    const candidate = typeof parsed.message === "string" ? parsed.message : typeof parsed.error === "object" ? parsed.error?.message ?? null : null;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 300);
  } catch {
  }
  const trimmed = bodyText.trim().slice(0, 300);
  return trimmed.length > 0 ? trimmed : null;
}
function throwProviderError(provider, status, bodyText, fallback) {
  const message = errorMessageFromBody(bodyText);
  if (status === 429) {
    throw new OracleApiError("rate_limit", `Rate limit reached on ${provider}.`, message ?? void 0);
  }
  if (status === 408 || status === 504) {
    throw new OracleApiError("timeout", `${provider} timed out.`, message ?? void 0);
  }
  throw new OracleApiError("provider_error", `${provider} request failed (${status}).`, message ?? fallback);
}
async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const body = await response.text();
  return { status: response.status, body };
}

// server/oracle/providers/openai.ts
async function callOpenAICompatible(options) {
  const { baseUrl, apiKey, providerLabel: providerLabel2, modelId, system, user, signal, maxTokensField = "max_tokens" } = options;
  const { status, body } = await fetchJson(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      [maxTokensField]: 2e3,
      temperature: 0.2
    }),
    signal: mergeSignal(signal)
  });
  if (status !== 200) {
    throwProviderError(providerLabel2, status, body, "Provider returned an unexpected response.");
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (cause) {
    throwProviderError(providerLabel2, status, body, `Provider returned malformed JSON: ${String(cause)}`);
  }
  const choice = parsed?.choices?.[0];
  const text = typeof choice?.message?.content === "string" ? choice.message.content : "";
  if (!text.trim()) {
    throwProviderError(providerLabel2, status, body, "Provider returned an empty completion.");
  }
  const usage = parsed?.usage;
  const promptTokens = typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : null;
  const completionTokens = typeof usage?.completion_tokens === "number" ? usage.completion_tokens : null;
  return { text, promptTokens, completionTokens };
}

// server/oracle/providers/agentrouter.ts
async function callAgentRouter(options, env = process.env) {
  const apiKey = env.AGENTROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AgentRouter is not configured (AGENTROUTER_API_KEY missing).");
  }
  return callOpenAICompatible({
    baseUrl: agentRouterBaseUrl(env),
    apiKey,
    providerLabel: "AgentRouter",
    modelId: options.modelId,
    system: options.system,
    user: options.user,
    signal: options.signal
  });
}

// server/oracle/providers/anthropic.ts
var ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
var ANTHROPIC_VERSION = "2023-06-01";
async function callAnthropic(options, apiKey) {
  const { status, body } = await fetchJson(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model: options.modelId,
      max_tokens: 2e3,
      system: options.system,
      messages: [{ role: "user", content: options.user }]
    }),
    signal: mergeSignal(options.signal)
  });
  if (status !== 200) {
    throwProviderError("Anthropic", status, body, "Provider returned an unexpected response.");
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (cause) {
    throwProviderError("Anthropic", status, body, `Provider returned malformed JSON: ${String(cause)}`);
  }
  const content = parsed?.content ?? [];
  const text = content.find((block) => block.type === "text")?.text ?? "";
  if (!text.trim()) {
    throwProviderError("Anthropic", status, body, "Provider returned an empty completion.");
  }
  const usage = parsed?.usage;
  const promptTokens = typeof usage?.input_tokens === "number" ? usage.input_tokens : null;
  const completionTokens = typeof usage?.output_tokens === "number" ? usage.output_tokens : null;
  return { text, promptTokens, completionTokens };
}

// server/oracle/providers/gemini.ts
var GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
async function callGemini(options, apiKey) {
  const model = encodeURIComponent(options.modelId);
  const { status, body } = await fetchJson(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: options.system }] },
      contents: [{ role: "user", parts: [{ text: options.user }] }],
      generationConfig: { maxOutputTokens: 2e3, temperature: 0.2 }
    }),
    signal: mergeSignal(options.signal)
  });
  if (status !== 200) {
    throwProviderError("Gemini", status, body, "Provider returned an unexpected response.");
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (cause) {
    throwProviderError("Gemini", status, body, `Provider returned malformed JSON: ${String(cause)}`);
  }
  const candidates = parsed?.candidates ?? [];
  const text = candidates[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) {
    throwProviderError("Gemini", status, body, "Provider returned an empty completion.");
  }
  const usage = parsed?.usageMetadata;
  const promptTokens = typeof usage?.promptTokenCount === "number" ? usage.promptTokenCount : null;
  const completionTokens = typeof usage?.candidatesTokenCount === "number" ? usage.candidatesTokenCount : null;
  return { text, promptTokens, completionTokens };
}

// server/oracle/lib/router.ts
function directAdapterFor(gateway, env) {
  switch (gateway) {
    case "agentrouter":
      return (options) => callAgentRouter(options, env);
    case "anthropic": {
      const apiKey = env.ANTHROPIC_API_KEY?.trim() ?? "";
      return (options) => callAnthropic(options, apiKey);
    }
    case "openai": {
      const apiKey = env.OPENAI_API_KEY?.trim() ?? "";
      return (options) => callOpenAICompatible({
        baseUrl: "https://api.openai.com/v1",
        apiKey,
        providerLabel: "OpenAI",
        modelId: options.modelId,
        system: options.system,
        user: options.user,
        signal: options.signal,
        maxTokensField: "max_completion_tokens"
      });
    }
    case "gemini": {
      const apiKey = env.GEMINI_API_KEY?.trim() ?? "";
      return (options) => callGemini(options, apiKey);
    }
  }
}
async function routeAnalysis(request, env = process.env, signal) {
  const startedAt = Date.now();
  const entry = oracleModelById(request.model, env);
  if (!entry) {
    throw new OracleApiError("unknown_model", `Unknown Oracle model "${request.model}".`);
  }
  if (entry.provider === "local") {
    throw new OracleApiError("bad_request", "The local engine runs on the client \u2014 pick a server model.");
  }
  const gateway = resolveGateway(entry, env);
  if (!gateway) {
    throw new OracleApiError(
      "not_configured",
      `No provider key configured for ${entry.label}.`,
      `Configure one of: ${entry.via.filter((p) => p !== "local").map((p) => PROVIDER_KEYS[p]).join(", ")}`
    );
  }
  if (gateway === "local") {
    throw new OracleApiError("bad_request", "The local engine runs on the client \u2014 pick a server model.");
  }
  const call = directAdapterFor(gateway, env);
  let result;
  try {
    result = await call({
      modelId: entry.modelId,
      system: buildSystemPrompt(),
      user: buildUserPrompt(request),
      signal
    });
  } catch (cause) {
    if (cause instanceof OracleApiError) throw cause;
    const label = providerLabel(gateway);
    if (isAbortLike(cause)) {
      throw new OracleApiError("timeout", `${label} timed out.`, safeErrorDetail(cause));
    }
    throw new OracleApiError("provider_error", `${label} request failed.`, safeErrorDetail(cause));
  }
  const analysis = normalizeAnalysis(result.text, request, {
    id: entry.id,
    provider: gateway,
    label: entry.label
  });
  const meta = {
    provider: gateway,
    modelId: entry.modelId,
    latencyMs: Date.now() - startedAt,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    estimatedCostUsd: estimateCostUsd(entry.id, result.promptTokens, result.completionTokens),
    success: true
  };
  return { analysis, meta };
}
function isAbortLike(cause) {
  if (cause instanceof Error) {
    return cause.name === "AbortError" || cause.name === "TimeoutError" || /timed? ?out|aborted/i.test(cause.message);
  }
  return false;
}
function safeErrorDetail(cause) {
  const message = cause instanceof Error ? cause.message : String(cause);
  const trimmed = message.trim().replace(/\s+/g, " ").slice(0, 300);
  return trimmed.length > 0 ? trimmed : void 0;
}

// server/oracle/handler.ts
function respondError(res, code, message, detail) {
  res.status(statusForCode(code)).json({
    ok: false,
    error: { code, message, detail }
  });
}
async function handleOracle(req, res) {
  if (req.method === "GET") {
    res.status(200).json(availabilityReport(process.env));
    return;
  }
  if (req.method !== "POST") {
    respondError(res, "method_not_allowed", 'Use POST /api/oracle with { action: "analyze" | "models" }.');
    return;
  }
  const body = req.body ?? {};
  const action = typeof body.action === "string" ? body.action : null;
  if (action === "models") {
    res.status(200).json(availabilityReport(process.env));
    return;
  }
  if (action !== "analyze") {
    respondError(res, "bad_request", 'Unknown Oracle action \u2014 expected "analyze" or "models".');
    return;
  }
  let request;
  try {
    request = sanitizeRequest(req.body);
  } catch (cause) {
    if (cause instanceof OracleApiError) {
      respondError(res, cause.code, cause.message, cause.detail);
      return;
    }
    respondError(res, "bad_request", "Could not read the request body.");
    return;
  }
  try {
    const signal = AbortSignal.timeout(55e3);
    const { analysis, meta } = await routeAnalysis(request, process.env, signal);
    res.status(200).json({ ok: true, analysis, meta });
  } catch (cause) {
    if (cause instanceof OracleApiError) {
      respondError(res, cause.code, cause.message, cause.detail);
      return;
    }
    respondError(res, "service_unavailable", "Oracle could not complete the analysis.");
  }
}

// server/oracle/entry.ts
var entry_default = handleOracle;
export {
  entry_default as default
};
