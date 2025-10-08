const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const USER_INFO = {
    username: 'Evertonviamar',
    password: '185675284',
    serverUrl: 'http://imperiotv.cloud'
};

app.get('/', (req, res) => {
    res.send('Backend do ImpérioTV Player está a funcionar!');
});

app.get('/api/list/:category', async (req, res) => {
    const { category } = req.params;
    let action = '';

    switch (category) {
        case 'movies': action = 'get_vod_streams'; break;
        case 'series': action = 'get_series'; break;
        case 'live': action = 'get_live_streams'; break;
        default: return res.status(400).json({ error: 'Categoria inválida' });
    }

    const url = `${USER_INFO.serverUrl}/player_api.php?username=${USER_INFO.username}&password=${USER_INFO.password}&action=${action}`;

    try {
        const apiResponse = await fetch(url);
        if (!apiResponse.ok) throw new Error(`O servidor respondeu com o estado: ${apiResponse.status}`);
        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        console.error(`Erro ao buscar a categoria ${category}:`, error);
        res.status(500).json({ error: 'Falha ao comunicar com o servidor de IPTV.', details: error.message });
    }
});

// NOVA ROTA: Busca as categorias para um tipo de conteúdo
app.get('/api/categories/:type', async (req, res) => {
    const { type } = req.params;
    let action = '';

    switch (type) {
        case 'movies': action = 'get_vod_categories'; break;
        case 'series': action = 'get_series_categories'; break;
        case 'live': action = 'get_live_categories'; break;
        default: return res.status(400).json({ error: 'Tipo de categoria inválido' });
    }

    const url = `${USER_INFO.serverUrl}/player_api.php?username=${USER_INFO.username}&password=${USER_INFO.password}&action=${action}`;

    try {
        const apiResponse = await fetch(url);
        if (!apiResponse.ok) throw new Error(`O servidor respondeu com o estado: ${apiResponse.status}`);
        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        console.error(`Erro ao buscar categorias do tipo ${type}:`, error);
        res.status(500).json({ error: 'Falha ao buscar categorias.', details: error.message });
    }
});

app.get('/api/series-info/:series_id', async (req, res) => {
    const { series_id } = req.params;
    const url = `${USER_INFO.serverUrl}/player_api.php?username=${USER_INFO.username}&password=${USER_INFO.password}&action=get_series_info&series_id=${series_id}`;

    try {
        const apiResponse = await fetch(url);
        if (!apiResponse.ok) throw new Error(`O servidor respondeu com o estado: ${apiResponse.status}`);
        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        console.error(`Erro ao buscar informações da série ${series_id}:`, error);
        res.status(500).json({ error: 'Falha ao buscar detalhes da série.', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
});

