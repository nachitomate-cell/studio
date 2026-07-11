// Descarga one-shot de fotos de perfil IG para /ruta-bac -> public/bac/logos/{id}.jpg
// Uso: node scripts/descargar-logos-bac.mjs
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const LOCALES = [
  ["fatkidburgers", "fatkidburgers"],
  ["plantabaja_valpo", "plantabaja_valpo"],
  ["laconquistada_valparaiso", "laconquistada_valparaiso"],
  ["momovalparaiso", "momovalparaiso"],
  ["bardepisco", "bardepisco"],
  ["casalegrevalparaiso", "casalegrevalparaiso"],
  ["faunahotelrestaurante", "faunahotelrestaurante"],
  ["kapura_valparaiso", "kapura_valparaiso"],
  ["jardincervecero_cl", "jardincervecero_cl"],
  ["ilpaparazzovalparaiso", "ilpaparazzovalparaiso"],
  ["hotzenplotz_alegre", "hotzenplotz_alegre"],
  ["terratvalpo", "terratvalpo"],
  ["quintorumbo", "quintorumbo.cocinaybar"],
  ["corazoncontinto", "corazoncontinto.cl"],
  ["almamiavalparaiso", "almamiavalparaiso"],
  ["malizioso_pizzeria", "malizioso.pizzeria"],
  ["medialunavalpo", "medialunavalpo"],
  ["raizchilena", "raizchilena.cl"],
  ["terapiavalpo", "terapiavalpo"],
  ["piano_cafe", "piano.cafe.valpo"],
  ["parrilla_doncesar", "parrilla.doncesar"],
  ["cafeparaiso", "cafeparaiso3.0"],
  ["cocinapuerto", "cocinapuerto_valpo"],
  ["mariamaria_valpo", "mariamaria_valpo"],
  ["aidas_pizzeria", "aidas.pizzeria"],
  ["barlemutt", "barlemutt"],
];

const HEADERS = {
  "x-ig-app-id": "936619743392459",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

const outDir = path.resolve("public/bac/logos");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
const failed = [];

// Instagram rechaza el fetch de Node (undici) con 400; curl sí pasa.
async function curlJson(url) {
  const { stdout } = await run("curl", [
    "-s", "-f",
    "-H", `x-ig-app-id: ${HEADERS["x-ig-app-id"]}`,
    "-H", `User-Agent: ${HEADERS["User-Agent"]}`,
    url,
  ], { maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function curlBinary(url, dest) {
  await run("curl", [
    "-s", "-f", "-L",
    "-H", `User-Agent: ${HEADERS["User-Agent"]}`,
    "-o", dest,
    url,
  ]);
}

for (const [id, handle] of LOCALES) {
  try {
    const json = await curlJson(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`
    );
    const picUrl =
      json?.data?.user?.profile_pic_url_hd || json?.data?.user?.profile_pic_url;
    if (!picUrl) throw new Error("sin profile_pic_url");

    const dest = path.join(outDir, `${id}.jpg`);
    await curlBinary(picUrl, dest);
    const { size } = await import("node:fs").then((fs) =>
      fs.promises.stat(dest)
    );
    if (size < 1000) throw new Error(`imagen sospechosamente chica (${size}b)`);

    ok++;
    console.log(`OK  ${id} (@${handle}) ${(size / 1024).toFixed(0)}KB`);
  } catch (e) {
    failed.push([id, handle, e.message]);
    console.log(`FAIL ${id} (@${handle}): ${e.message}`);
  }
  await sleep(900);
}

console.log(`\n${ok}/${LOCALES.length} descargados`);
if (failed.length) {
  console.log("Fallidos:");
  for (const [id, handle, msg] of failed) console.log(` - ${id} (@${handle}): ${msg}`);
}
