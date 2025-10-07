// 1. Importar as ferramentas necessárias
const express = require('express');
const axios = require('axios');
const cors = require('cors');

// 2. Configurações da aplicação
const app = express();
const PORT = 3000;

// Informações de acesso ao serviço de TV
const credentials = {
    user: 'Evertonviamar',
    pass: '185675284',
    server: 'http://imperiotv.cloud'
};

// 3. Middlewares
app.use(cors());
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
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log('Abra o arquivo frontend/index.html em seu navegador para usar a aplicação.');
});

