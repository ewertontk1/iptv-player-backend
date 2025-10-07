// 1. Importar as ferramentas necessárias
const express = require('express');
const axios = require('axios');
const cors = require('cors');

// 2. Configurações da aplicação
const app = express();
const PORT = process.env.PORT || 3000;

// Informações de acesso ao serviço de TV
const credentials = {
    user: 'Evertonviamar',
    pass: '185675284',
    server: 'http://imperiotv.cloud'
};

// 3. Middlewares
app.use(cors()); // CORS enabled (Access-Control-Allow-Origin: *)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Recebida requisição: ${req.method} ${req.url}`);
    next();
});

// 4. Definição das Rotas da API

// Rota principal para verificar se o servidor está no ar
app.get('/', (req, res) => {
    res.send('Servidor do App de TV está funcionando!');
});

// Rota para buscar as listas principais (filmes, séries, canais)
app.get('/api/list/:category', async (req, res) => {
    const { category } = req.params;
    const actions = {
        movies: 'get_vod_streams',
        series: 'get_series',
        live: 'get_live_streams'
    };
    const action = actions[category];

    if (!action) {
        return res.status(400).json({ message: 'Categoria inválida.' });
    }

    const apiUrl = `${credentials.server}/player_api.php?username=${credentials.user}&password=${credentials.pass}&action=${action}`;
    console.log(`Buscando lista da API externa: ${apiUrl}`);

    try {
        const response = await axios.get(apiUrl, { timeout: 10000 });
        res.json(response.data || []);
    } catch (error) {
        console.error(`Erro ao buscar lista de ${category}:`, error.message);
        res.status(500).json({ message: `Falha ao se comunicar com o servidor de TV para buscar ${category}.` });
    }
});

// NOVA ROTA: Rota para buscar detalhes de uma série específica (temporadas/episódios)
app.get('/api/series-info/:seriesId', async (req, res) => {
    const { seriesId } = req.params;
    const action = 'get_series_info';

    const apiUrl = `${credentials.server}/player_api.php?username=${credentials.user}&password=${credentials.pass}&action=${action}&series_id=${seriesId}`;
    console.log(`Buscando detalhes da série da API externa: ${apiUrl}`);

    try {
        const response = await axios.get(apiUrl, { timeout: 10000 });
        res.json(response.data);
    } catch (error) {
        console.error(`Erro ao buscar detalhes da série ${seriesId}:`, error.message);
        res.status(500).json({ message: `Falha ao buscar detalhes da série ${seriesId}.` });
    }
});


// 5. Iniciar o servidor


// --- PROXY ROUTE: repassa streams do provedor com suporte a Range e CORS ---
app.get('/proxy', async (req, res) => {
  try {
    const { streamType, user, pass, id, ext } = req.query;
    if (!streamType || !user || !pass || !id || !ext) {
      return res.status(400).send('Missing parameters');
    }

    const remoteUrl = `${credentials.server}/${streamType}/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${encodeURIComponent(id)}.${encodeURIComponent(ext)}`;
    // Repassar Range se presente (importantíssimo para seek)
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;

    const remoteResp = await axios.get(remoteUrl, { responseType: 'stream', headers, validateStatus: status => status < 500 });

    // Repassar status
    res.status(remoteResp.status);

    // Repassar cabeçalhos relevantes
    const headerAllowList = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    Object.entries(remoteResp.headers || {}).forEach(([name, value]) => {
      if (headerAllowList.includes(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    });

    // CORS headers (permitir acesso do frontend)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range,Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Accept-Ranges,Content-Length,Content-Type');

    // Pipe do stream remoto para o cliente
    remoteResp.data.pipe(res);
    remoteResp.data.on('error', (err) => {
      console.error('Remote stream error', err);
      try { res.end(); } catch(e) {}
    });

  } catch (err) {
    console.error('Proxy error', err && err.message ? err.message : err);
    res.status(502).send('Erro ao buscar stream remoto');
  }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log('Abra o arquivo frontend/index.html em seu navegador para usar a aplicação.');
});

