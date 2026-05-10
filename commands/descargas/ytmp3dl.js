import axios from "axios";

const API_BASE = "https://dv-yer-api.online/ytmp3";
const API_KEY = "dvyer911840240197";

function isYouTubeUrl(url = "") {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
}

function pickAudioUrl(data) {
  return (
    data?.result?.url ||
    data?.result?.link ||
    data?.result?.download ||
    data?.result?.audio ||
    data?.url ||
    data?.link ||
    data?.download ||
    data?.audio ||
    null
  );
}

function pickTitle(data) {
  return (
    data?.result?.title ||
    data?.title ||
    "audio_youtube"
  );
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    if (!text) {
      return m.reply(
        `❌ Ingresa un enlace de YouTube.\n\n` +
        `Ejemplo:\n${usedPrefix + command} https://www.youtube.com/watch?v=dQw4w9WgXcQ`
      );
    }

    const url = text.trim();

    if (!isYouTubeUrl(url)) {
      return m.reply("❌ El enlace no parece ser de YouTube.");
    }

    await m.reply("⏳ Descargando audio, espera un momento...");

    const apiUrl =
      `${API_BASE}?mode=link` +
      `&url=${encodeURIComponent(url)}` +
      `&apikey=${encodeURIComponent(API_KEY)}`;

    const { data } = await axios.get(apiUrl, {
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const audioUrl = pickAudioUrl(data);
    const title = pickTitle(data);

    if (!audioUrl) {
      console.log("Respuesta API ytmp3:", data);
      return m.reply("❌ No se pudo obtener el enlace del audio desde la API.");
    }

    const cleanTitle = String(title)
      .replace(/[\\/:*?"<>|]/g, "")
      .slice(0, 80);

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: audioUrl },
        mimetype: "audio/mpeg",
        fileName: `${cleanTitle}.mp3`,
        ptt: false,
      },
      { quoted: m }
    );

  } catch (error) {
    console.error("Error ytmp3:", error?.response?.data || error);

    const msg =
      error?.code === "ECONNABORTED"
        ? "❌ La API tardó demasiado en responder."
        : "❌ Ocurrió un error al descargar el audio.";

    await m.reply(msg);
  }
};

handler.help = ["ytmp3 <url>"];
handler.tags = ["descargas"];
handler.command = ["ytmp5"];

export default handler;