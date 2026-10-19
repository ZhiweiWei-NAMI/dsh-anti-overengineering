window.__ModuleLoader__.load({
  id: "dsh-anti-overengineering",
  factory(require) {
    const React = require("react");
    const NS = "anti-overengineering.usage";
    const dictionaries = {
      en: {
        line: "Session · Jev: {calls} calls · Input tokens: {tokens} · Rule hits: {rules} · Est. USD {usd}",
        turn: "This turn · Jev: {calls} calls · Input tokens: {tokens} · Rule hits: {rules} · Est. USD {usd}",
        none: "none", unknown: "unknown",
        tokensPartial: "{tokens} ({known}/{calls} calls reported)",
        partial: "{usd} ({priced}/{calls} calls priced)",
        failed: "Jev session usage unavailable",
      },
      zh: {
        line: "本会话 · Jev：{calls} 次调用 · 输入 token：{tokens} · 规则命中：{rules} · 预估 USD {usd}",
        turn: "本轮 · Jev：{calls} 次调用 · 输入 token：{tokens} · 规则命中：{rules} · 预估 USD {usd}",
        none: "无", unknown: "未知",
        tokensPartial: "{tokens}（{known}/{calls} 次已报告）",
        partial: "{usd}（{priced}/{calls} 次已计价）",
        failed: "Jev 会话用量暂不可用",
      },
    };
    const count = value => Number.isSafeInteger(value) && value >= 0;
    function validUsage(value) {
      return value && count(value.calls) && count(value.pricedCalls)
        && value.pricedCalls <= value.calls && Number.isFinite(value.estimatedUsd)
        && value.estimatedUsd >= 0 && value.ruleCounts && !Array.isArray(value.ruleCounts)
        && typeof value.ruleCounts === "object" && Object.entries(value.ruleCounts)
          .every(([id, n]) => /^AE\d{2}$/.test(id) && count(n))
        && (value.inputTokens === undefined && value.tokenCalls === undefined
          || count(value.inputTokens) && count(value.tokenCalls) && value.tokenCalls <= value.calls);
    }
    function valid(value) {
      return value === null || validUsage(value)
        && (value.currentTurn === undefined || validUsage(value.currentTurn));
    }
    function formatUsage(usage, key, t) {
      const rules = Object.entries(usage.ruleCounts).filter(([, n]) => n > 0)
        .sort(([a], [b]) => a.localeCompare(b)).map(([id, n]) => id + "×" + n).join(" · ") || t("none");
      const amount = usage.estimatedUsd.toFixed(6);
      const usd = usage.calls === 0 ? amount : usage.pricedCalls === 0 ? t("unknown")
        : usage.pricedCalls === usage.calls ? amount
          : t("partial", { usd: amount, priced: String(usage.pricedCalls), calls: String(usage.calls) });
      const tokens = usage.calls === 0 ? "0" : !usage.tokenCalls ? t("unknown")
        : usage.tokenCalls === usage.calls ? String(usage.inputTokens)
          : t("tokensPartial", { tokens: String(usage.inputTokens), known: String(usage.tokenCalls), calls: String(usage.calls) });
      return t(key, { calls: String(usage.calls), tokens, rules, usd });
    }
    function Tail({ sessionId, turn, useResource, t }) {
      const result = useResource("dsh-resource://anti-overengineering-usage/" + encodeURIComponent(sessionId) + "/" + turn.turn);
      if (result.status === "loading" || result.status === "none"
        || (result.status === "live" && result.value === null)) return null;
      let text = t("failed");
      if (result.status === "live") {
        const usage = result.value;
        text = (usage.currentTurn ? formatUsage(usage.currentTurn, "turn", t) + " ｜ " : "")
          + formatUsage(usage, "line", t);
      }
      return React.createElement("div", {
        "data-anti-overengineering-usage": "",
        style: { color: "var(--dsw-alias-label-tertiary)", font: "var(--dsw-font-xxs-12)", overflowWrap: "anywhere" },
      }, text);
    }
    return {
      inject: ["slots", "locale", "connection", "resources"],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries));
        ctx.effect(() => ctx.resources.register({
          protocol: "anti-overengineering-usage",
          async *open(address, { signal }) {
            try {
              const parts = new URL(address).pathname.split("/");
              const delays = [100, 250, 500, 1000, 2000];
              for (let attempt = 0; !signal.aborted; attempt++) {
                const result = await ctx.connection.rpc.call("/api", "anti-overengineering/turn-usage", {
                  sessionId: decodeURIComponent(parts[1]), turn: Number(parts[2]),
                }, signal);
                if (signal.aborted) return;
                if (result.ok && result.value?.pending === true) {
                  await new Promise(resolve => {
                    const finish = () => {
                      clearTimeout(timer);
                      signal.removeEventListener("abort", finish);
                      resolve();
                    };
                    const timer = setTimeout(finish, delays[Math.min(attempt, delays.length - 1)]);
                    signal.addEventListener("abort", finish, { once: true });
                    if (signal.aborted) finish();
                  });
                  continue;
                }
                if (result.ok && !valid(result.value)) throw new Error("Invalid Jev usage response");
                yield result;
                return;
              }
            } catch (error) {
              if (!signal.aborted) yield { ok: false, error: { code: "usage-unavailable", message: String(error), details: {} } };
            }
          },
        }));
        ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
          name: "conversation.chat.turnTail", id: "dsh-anti-overengineering.usage", order: 90, locale: NS,
        }, Tail));
      },
    };
  },
});
