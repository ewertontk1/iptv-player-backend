# I'll update the existing patched server.js to include the tryRemotePaths logic and a more robust /proxy route
# Then I'll write a new zip with the updated backend and frontend and provide the zip path.
from pathlib import Path
import re, zipfile, shutil

root = Path("/mnt/data")
patched_server_path = root / "patched_project" / "backend" / "server.js"
if not patched_server_path.exists():
    # fallback to original server.js uploaded
    patched_server_path = root / "server.js"
assert patched_server_path.exists(), "server.js not found"

server_js = patched_server_path.read_text(encoding="utf-8")

# We'll insert tryRemotePaths function and replace any existing /proxy route implementation.
try_remote_func = r"""
/**
 * tryRemotePaths: tenta vários padrões comuns de URL no provedor e retorna o primeiro que responder 200/206.
 * Retorna um objeto { url, status } ou null se nenhum padrão funcionar.
 */
async function tryRemotePaths(user, pass, id, ext, streamType) {
  const base = 'https://imperiotv.cloud'; // ajustar se necessário (https recomendado)
  const patterns = [
    `${base}/movie/${user}/${pass}/${id}.${ext}`,
    `${base}/vod/${user}/${pass}/${id}.${ext}`,
    `${base}/series/${user}/${pass}/${id}.${ext}`,
    `${base}/live/${user}/${pass}/${id}.${ext}`,
    // fallback genérico
    `${base}/${streamType || 'movie'}/${user}/${pass}/${id}.${ext}`
  ];

  for (const url of patterns) {
    try {
      // Tentar com uma requisição curta (Range) para verificar existência/permits
      const resp = await axios.get(url, { responseType: 'stream', headers: { Range: 'bytes=0-1' }, validateStatus: s => s < 500, timeout: 10000 });
      if (resp.status === 200 || resp.status === 206) {
        // fecha o stream do teste para liberar conexão
        try { resp.data.destroy(); } catch(e) {}
        return { url, status: resp.status };
      }
    } catch (err) {
      // console.warn('tryRemotePaths failed for', url, err && err.message);
    }
  }
  return null;
}
"""

# New robust proxy route using tryRemotePaths
new_proxy_route = r"""
app.get('/proxy', async (req, res) => {
  try {
    const { user, pass, id, ext, streamType } = req.query;
    if (!user || !pass || !id || !ext) {
      return res.status(400).send('Missing params: user, pass, id, ext required');
    }

    // Repassa range se existir
    const rangeHeader = req.headers.range;

    // Tenta descobrir qual padrão de URL funciona
    const found = await tryRemotePaths(user, pass, id, ext, streamType);
    if (!found) {
      console.error('No remote URL pattern matched for', { user, id, ext, streamType });
      return res.status(404).send('Remote URL not found by known patterns');
    }

    // Fazer a requisição final com suporte a Range (seek)
    const remoteResp = await axios.get(found.url, {
      responseType: 'stream',
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
      validateStatus: (s) => s < 500,
      timeout: 20000
    });

    // Repassar status e headers relevantes
    res.status(remoteResp.status);
    ['content-type','content-length','content-range','accept-ranges'].forEach(h => {
      const v = remoteResp.headers[h];
      if (v) res.setHeader(h, v);
    });

    // CORS headers (em produção, ajuste para seu domínio)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range,Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Accept-Ranges,Content-Length,Content-Type');

    // Pipe do stream remoto para o cliente
    remoteResp.data.pipe(res);
    remoteResp.data.on('error', (err) => {
      console.error('Remote stream error', err && err.message ? err.message : err);
      try { res.end(); } catch(e) {}
    });
  } catch (err) {
    console.error('Proxy error', err && err.message ? err.message : err);
    res.status(502).send('Proxy error');
  }
});
"""

# Strategy:
# 1. Ensure axios is required (should be).
# 2. Insert tryRemotePaths function near top (after imports) if not present.
# 3. Replace existing app.get('/proxy' ... ) block with new_proxy_route.
# Use regex to find existing /proxy block.
if "function tryRemotePaths" not in server_js and "tryRemotePaths(" not in server_js:
    # Insert after initial requires (after the first block of requires and app initializations)
    # Find last require or app.use line to insert after
    insert_pos = None
    # try to find "app.use" occurrences to insert after
    m = re.search(r"(app\.use\([^\)]*\);\s*)", server_js)
    if m:
        insert_pos = m.end()
    else:
        # fallback to after initial require lines: find first "const app =" occurrence
        m2 = re.search(r"(const app\s*=\s*express\(\)\s*;)", server_js)
        insert_pos = m2.end() if m2 else 0
    server_js = server_js[:insert_pos] + "\n\n" + try_remote_func + "\n\n" + server_js[insert_pos:]

# Replace existing proxy route
# Regex to match app.get('/proxy' ... }); including nested braces - use non-greedy match until '\n});' at line start
proxy_pattern = re.compile(r"app\.get\(\s*['\"]\/proxy['\"][\s\S]*?\n\}\s*\)\s*;\s*", re.MULTILINE)
if proxy_pattern.search(server_js):
    server_js = proxy_pattern.sub(new_proxy_route + "\n", server_js, count=1)
else:
    # If not found, append new proxy route before app.listen
    if "app.listen" in server_js:
        server_js = server_js.replace("app.listen(", new_proxy_route + "\n\napp.listen(")
    else:
        server_js = server_js + "\n\n" + new_proxy_route

# Write updated server.js to a new zip for download
out_dir = root / "patched_project_updated"
if out_dir.exists():
    shutil.rmtree(out_dir)
sh_backend = out_dir / "backend"
sh_frontend = out_dir / "frontend"
sh_backend.mkdir(parents=True, exist_ok=True)
sh_frontend.mkdir(parents=True, exist_ok=True)

# write backend server.js and copy package.json and frontend index.html from patched_project if exists
sh_backend_path = sh_backend / "server.js"
sh_backend_path.write_text(server_js, encoding="utf-8")

# copy package.json
src_package = root / "patched_project" / "backend" / "package.json"
if not src_package.exists():
    src_package = root / "package.json"
shutil.copy(src_package, sh_backend / "package.json")

# copy frontend index.html from patched_project or original
src_index = root / "patched_project" / "frontend" / "index.html"
if not src_index.exists():
    src_index = root / "index.html"
shutil.copy(src_index, sh_frontend / "index.html")

# create zip
zip_path = root / "iptv-player-proxy-updated.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for f in [sh_backend / "server.js", sh_backend / "package.json", sh_frontend / "index.html"]:
        zf.write(f, arcname=str(f.relative_to(out_dir)))

print("Updated server.js written. ZIP ready:", str(zip_path))

