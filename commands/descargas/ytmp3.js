import axios from "axios";
import yts from "yt-search";

const API = "https://dv-yer-api.online/ytmp3";
const APIKEY = "dvyer911840240197";

function textClean(txt = "") {
  return String(txt || "").replace(/\s+/g, " ").trim();
}

function getInput(ctx) {
  const msg = ctx.m || ctx.msg || {};
  return textClean(
    Array.isArray(ctx.args)
      ? ctx.args.join(" ")
      : msg.text || msg.body || msg.caption || ""
  );
}

function getChatId(ctx) {
  const msg = ctx.m || ctx.msg || {};
  return msg?.key?.remoteJid || ctx.chat || ctx.from || "";
}

function getYoutubeUrl(text = "") {
  const match = text.match(/https?:\/\/(?:www\.)?(youtube\.com|youtu\.be)\/[^\s]+/i);
  return match ? match[0] : "";
}

async function getVideoUrl(input) {
  const directUrl = getYoutubeUrl(input);
  if (directUrl) return directUrl;

  const search = await yts(input);
  const video = search?.videos?.[0];

  if (!video?.url) throw new Error("No encontré esa canción en YouTube.");
  return video.url;
}

function pickAudioUrl(data = {}) {
  return (
    data.download_url_full ||
    data.stream_url_full ||
    data.direct_url ||
    data.download_url ||
    data.stream_url ||
    data.url ||
    data.link ||
    data.result?.url ||
    data.result?.link ||
    data.result?.download ||
    data.result?.audio ||
    ""
  );
}

function cleanFileName(name = "audio") {
  return String(name || "audio")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function react(sock, msg, emoji) {
  try {
    if (!msg?.key) return;
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: emoji, key: msg.key },
    });
  } catch {}
}

export default {
  command: ["ytmp3", "yta", "ytaudio"],
  categoria: "descarga",
  category: "descarga",
  description: "Descarga música MP3 de YouTube",

  run: async (ctx) => {
    const { sock } = ctx;
    const msg = ctx.m || ctx.msg || {};
    const chatId = getChatId(ctx);
    const quoted = msg?.key ? { quoted: msg } : undefined;

    try {
      const input = getInput(ctx);

      if (!sock || !chatId) return;

      if (!input) {
        return await sock.sendMessage(
          chatId,
          {
            text:
              "╭━━〔 *🎧 YTMP3* 〕━━⬣\n" +
              "┃ Usa:\n" +
              "┃ *.ytmp3 <link o nombre>*\n" +
              "┃\n" +
              "┃ Ejemplo:\n" +
              "┃ *.ytmp3 Ozuna Odisea*\n" +
              "╰━━━━━━━━━━━━━━━━━━⬣",
            ...global.channelInfo,
          },
          quoted
        );
      }

      await react(sock, msg, "🕓");

      const videoUrl = await getVideoUrl(input);

      const { data } = await axios.get(API, {
        timeout: 120000,
        params: {
          mode: "link",
          url: videoUrl,
          apikey: APIKEY,
        },
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
      });

      const audioUrl = pickAudioUrl(data);
      const title = cleanFileName(data.title || data.result?.title || "YouTube MP3");

      if (!audioUrl) {
        console.log("Respuesta API ytmp3:", data);
        throw new Error("La API no devolvió el enlace del audio.");
      }

      await sock.sendMessage(
        chatId,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`,
          ptt: false,
        },
        quoted
      );

      await react(sock, msg, "✅");
    } catch (e) {
      console.error("YTMP3 ERROR:", e?.response?.data || e);

      await react(sock, msg, "❌");

      await sock.sendMessage(
        chatId,
        {
          text:
            "╭━━〔 *❌ YTMP3 ERROR* 〕━━⬣\n" +
            `┃ ${e?.message || "No se pudo enviar la música."}\n` +
            "╰━━━━━━━━━━━━━━━━━━⬣",
          ...global.channelInfo,
        },
        quoted
      );
    }
  },
};