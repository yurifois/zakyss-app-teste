import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    // Apenas aceita requisições POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    // Proteção básica: exige um token no Header que a gente vai definir
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.EMAIL_GATEWAY_SECRET || 'zakys-secret-gateway-123'}`) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
        return res.status(400).json({ success: false, error: 'Faltam campos obrigatórios' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            connectionTimeout: 10000,
            tls: { rejectUnauthorized: false }
        });

        // Verifica se conecta
        await transporter.verify();

        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || `"Zakys" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html
        });

        return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('❌ Erro no Gateway Vercel:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}
