import axios from "axios";
import yts from "yt-search";

const API = "https://dv-yer-api.online/ytmp3";
const APIKEY = "dvyer911840240197";

const running = new Set();

function cleanText(txt = "") {
  return String(txt || "").replace(/\s+/g, " ").trim();
}

function getChatId(ctx) {
  const msg = ctx.m || ctx.msg || {};
  return msg?.key?.remoteJid || ctx.chat || ctx.from || "";
}

function getSender(ctx) {
  const msg = ctx.m || ctx.msg || {};
  return msg.sender || ctx.sender || msg?.key?.participant || msg?.key?.remoteJid || "";
}

function getInput(ctx) {
  const msg = ctx.m || ctx.msg || {};

  return cleanText(
    Array.isArray(ctx.args)
      ? ctx.args.join(" ")
      : msg.text || msg.body || msg.caption || ""
  );
}

function getYoutubeUrl(text = "") {
  const match = String(text).match(
    /https?:\/\/(?:www\.)?(youtube\.com|youtu\.be)\/[^\s]+/i
  );

  return match ? match[0] : "";
}

async function getVideoInfo(input) {
  const directUrl = getYoutubeUrl(input);

  if (directUrl) {
    return {
      url: directUrl,
      title: "YouTube MP3",
    };
  }

  const search = await yts(input);
  const video = search?.videos?.[0];

  if (!video?.url) {
    throw new Error("No encontré esa canción en YouTube.");
  }

  return {
    url: video.url,
    title: video.title || "YouTube MP3",
  };
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
    data.audio ||
    data.result?.url ||
    data.result?.link ||
    data.result?.download ||
    data.result?.audio ||
    ""
  );
}

function pickTitle(data = {}, fallback = "YouTube MP3") {
  return (
    data.title ||
    data.result?.title ||
    String(data.filename || "").replace(/\.mp3$/i, "") ||
    fallback ||
    "YouTube MP3"
  );
}

function cleanFileName(name = "audio") {
  return (
    String(name || "audio")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/[^\w .()[\]-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "audio"
  );
}

function cleanError(error) {
  const msg = String(error?.message || error || "").toLowerCase();

  if (
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("econnreset") ||
    msg.includes("socket") ||
    msg.includes("timeout") ||
    msg.includes("443") ||
    msg.includes("194.") ||
    msg.includes("http")
  ) {
    return "La API de música está caída o saturada. Intenta otra vez en un momento.";
  }

  if (msg.includes("no encontré") || msg.includes("no encontre")) {
    return "No encontré esa canción en YouTube.";
  }

  return "No se pudo enviar la música.";
}

async function react(sock, msg, emoji) {
  try {
    if (!msg?.key) return;

    await sock.sendMessage(msg.key.remoteJid, {
      react: {
        text: emoji,
        key: msg.key,
      },
    });
  } catch {}
}

async function callApi(videoUrl) {
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

  if (!audioUrl) {
    console.log("Respuesta API ytmp3:", data);
    throw new Error("La API no devolvió audio.");
  }

  return data;
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
    const sender = getSender(ctx);
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const input = getInput(ctx);

    const lockKey = `${chatId}:${sender}:${input.toLowerCase()}`;

    try {
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

      if (running.has(lockKey)) return;
      running.add(lockKey);

      await react(sock, msg, "🕓");

      const video = await getVideoInfo(input);
      const data = await callApi(video.url);

      const audioUrl = pickAudioUrl(data);
      const title = cleanFileName(pickTitle(data, video.title));

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
    } catch (error) {
      console.error("YTMP3 ERROR:", error?.response?.data || error?.message || error);

      await react(sock, msg, "❌");

      await sock.sendMessage(
        chatId,
        {
          text:
            "╭━━〔 *❌ YTMP3 ERROR* 〕━━⬣\n" +
            `┃ ${cleanError(error)}\n` +
            "╰━━━━━━━━━━━━━━━━━━⬣",
          ...global.channelInfo,
        },
        quoted
      );
    } finally {
      running.delete(lockKey);
    }
  },
};