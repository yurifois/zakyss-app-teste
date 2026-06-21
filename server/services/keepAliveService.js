import cron from 'node-cron';
import https from 'https';
import http from 'http';

export const startKeepAlive = () => {
    // A URL pública do backend. No Render, RENDER_EXTERNAL_URL é fornecida automaticamente.
    // O usuário também pode definir BACKEND_URL no .env do servidor.
    const url = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
    
    if (!url) {
        console.warn('⚠️ [KeepAlive] Nenhuma URL pública definida (RENDER_EXTERNAL_URL ou BACKEND_URL). O serviço de auto-ping não será iniciado.');
        console.warn('   DICA: Se seu backend dorme (ex: Render/Heroku), defina BACKEND_URL no .env ou use o Render (que define RENDER_EXTERNAL_URL sozinho).');
        return;
    }

    console.log(`[KeepAlive] 🚀 Iniciando serviço de auto-ping para a URL: ${url}`);

    // Executa a cada 14 minutos para evitar que serviços gratuitos (ex: Render, que dorme após 15m de inatividade) adormeçam
    cron.schedule('*/14 * * * *', () => {
        console.log(`[KeepAlive] 🔄 Enviando ping para a API para mantê-la acordada...`);
        
        // Remove a barra final da URL se houver para não ficar com duas barras
        const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        const healthUrl = `${cleanUrl}/api/health`;
        
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(healthUrl, (res) => {
            const { statusCode } = res;
            if (statusCode === 200) {
                console.log(`[KeepAlive] ✅ Ping bem sucedido. Status: ${statusCode} - Servidor mantido acordado!`);
            } else {
                console.error(`[KeepAlive] ⚠️ Ping retornou status: ${statusCode}`);
            }
            
            // É importante consumir os dados da resposta para não causar vazamento de memória (memory leak)
            res.on('data', () => {});
            res.on('end', () => {});
        }).on('error', (err) => {
            console.error(`[KeepAlive] ❌ Erro ao tentar pingar: ${err.message}`);
        });
    });
};

export default { startKeepAlive };
