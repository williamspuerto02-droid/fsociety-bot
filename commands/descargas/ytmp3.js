import axios from "axios";
import yts from "yt-search";

const APIS = [
  "https://dv-yer-api.online/ytmp3",
  "https://dvyer-api.onrender.com/ytmp3",
];

const APIKEY = "dvyer911840240197";

// Evita duplicados si el comando se ejecuta 2 veces
const running = new Set();

function cleanText(txt = "") {
  return String(txt || "").replace(/\s+/g, " ").trim();
}

function getChatId(ctx) {
  const msg = ctx.m || ctx.msg || {};
  return msg?.key?.remoteJid || ctx.chat || ctx.from || "";
}

function getInput(ctx) {
  const msg = ctx.m || ctx.msg || {};
  return cleanText(
    Array.isArray(ctx.args)
      ? ctx.args.join(" ")
      : msg.text || msg.body || msg.caption || ""
  );
}

function getSender(ctx) {
  const msg = ctx.m || ctx.msg || {};
  return msg.sender || ctx.sender || msg?.key?.participant || msg?.key?.remoteJid || "";
}

function getYoutubeUrl(text = "") {
  const match = String(text).match(
    /https?:\/\/(?:www\.)?(youtube\.com|youtu\.be)\/[^\s]+/i
  );
  return match ? match[0] : "";
}

function getYoutubeId(url = "") {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "").split("?")[0];
    }

    const id = u.searchParams.get("v");
    if (id) return id;

    const match = u.pathname.match(/\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]{11})/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function youtubeThumb(url = "") {
  const id = getYoutubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
}

async function getVideoInfo(input) {
  const directUrl = getYoutubeUrl(input);

  if (directUrl) {
    return {
      url: directUrl,
      title: "YouTube MP3",
      thumbnail: youtubeThumb(directUrl),
    };
  }

  const search = await yts(input);
  const video = search?.videos?.[0];

  if (!video?.url) throw new Error("No encontré esa canción en YouTube.");

  return {
    url: video.url,
    title: video.title || "YouTube MP3",
    thumbnail: video.thumbnail || youtubeThumb(video.url),
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
    data.filename?.replace(/\.mp3$/i, "") ||
    fallback ||
    "YouTube MP3"
  );
}

function pickThumbnail(data = {}, fallback = "") {
  return (
    data.thumbnail ||
    data.result?.thumbnail ||
    data.image ||
    data.result?.image ||
    fallback ||
    ""
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

function publicError(error) {
  const msg = String(error?.message || error || "").toLowerCase();

  if (
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("econnreset") ||
    msg.includes("socket") ||
    msg.includes("timeout") ||
    msg.includes("443") ||
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
      react: { text: emoji, key: msg.key },
    });
  } catch {}
}

async function getBuffer(url) {
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/*",
      },
      maxContentLength: 300 * 1024,
    });

    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

async function callApi(videoUrl) {
  let lastError = null;

  for (const api of APIS) {
    try {
      const { data } = await axios.get(api, {
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
      if (!audioUrl) throw new Error("La API no devolvió audio.");

      return data;
    } catch (e) {
      lastError = e;
      console.log("YTMP3 API falló:", api);
    }
  }

  throw lastError || new Error("API no disponible.");
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
      const thumbnailUrl = pickThumbnail(data, video.thumbnail || youtubeThumb(video.url));
      const thumbBuffer = await getBuffer(thumbnailUrl);

      await sock.sendMessage(
        chatId,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`,
          ptt: false,
          jpegThumbnail: thumbBuffer || undefined,
          contextInfo: {
            externalAdReply: {
              title,
              body: "Audio MP3",
              mediaType: 1,
              renderLargerThumbnail: true,
              showAdAttribution: false,
              sourceUrl: video.url,
              thumbnailUrl,
              thumbnail: thumbBuffer || undefined,
            },
          },
        },
        quoted
      );

      await react(sock, msg, "✅");
    } catch (e) {
      console.error("YTMP3 ERROR:", e?.response?.data || e?.message || e);

      await react(sock, msg, "❌");

      await sock.sendMessage(
        chatId,
        {
          text:
            "╭━━〔 *❌ YTMP3 ERROR* 〕━━⬣\n" +
            `┃ ${publicError(e)}\n` +
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