// Sends the monthly-update result to Telegram (env TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).
// Called only on a new deploy or a failure — not on "no new report" days (the cron fires
// daily from the 20th, so notifying those would mean ~10 messages a month).
// Never fails the workflow: missing secrets or API errors only print a warning.
import fs from "node:fs";

const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId, JOB_FAILED = "", FAILED_STEPS = "", PAGE_URL = "", RUN_URL = "" } = process.env;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let report = null;
try {
  report = JSON.parse(fs.readFileSync("logs/download-result.json", "utf8"));
} catch {
  // download step did not get far enough to write a report
}
const keys = (report?.downloadedItems ?? []).flatMap((i) => (i.localPath || "").match(/\d{4}-\d{2}/g) || []);
const period = keys.sort().pop();
const failed = FAILED_STEPS.split(",").map((s) => s.trim()).filter(Boolean);
if (JOB_FAILED === "true" && !failed.length) failed.push("기타 (실행 로그 확인)");

const lines = failed.length
  ? [`❌ <b>kresident 월간 통계 업데이트</b> 실패`, `실패한 단계: ${esc(failed.join(", "))}`]
  : [`✅ <b>kresident 월간 통계 업데이트</b> 완료`, `${esc(period || "새")} 통계월보 반영 · 다운로드 ${report?.summary?.downloaded ?? "-"}건`];
if (report?.summary?.failed) lines.push(`⚠️ 다운로드 실패 ${report.summary.failed}건`);
const links = [PAGE_URL && `<a href="${esc(PAGE_URL)}">대시보드</a>`, RUN_URL && `<a href="${esc(RUN_URL)}">실행 로그</a>`].filter(Boolean);
if (links.length) lines.push("", links.join(" · "));

if (!token || !chatId) {
  console.log("::warning::TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set; skipping Telegram notification");
} else {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: lines.join("\n"), parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const body = await res.json();
    console.log(body.ok ? "Telegram notification sent" : `::warning::Telegram API returned ok=false (${body.description})`);
  } catch (error) {
    console.log(`::warning::Telegram send failed: ${error.name}`);
  }
}
