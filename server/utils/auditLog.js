import { getRepository } from '../repositories/index.js'

const auditLogRepo = getRepository('audit_log.json')
const adminsRepo = getRepository('admins.json')

/**
 * Log de auditoria centralizado — quem fez o quê, quando, em qual
 * estabelecimento. Começa cobrindo funcionários (item 2.4 do roadmap);
 * dá pra chamar de qualquer rota no futuro pra outras ações sensíveis
 * (caixa, cadastro, permissões) sem precisar de tabela nova.
 *
 * Nunca deixa uma falha de log derrubar a operação principal — se der
 * erro, só loga no console e segue a vida.
 */
export async function logAudit({ establishmentId, admin, action, entityType, entityId, entityName, details }) {
    try {
        let adminName = admin?.name
        if (!adminName && admin?.id) {
            const fullAdmin = await adminsRepo.findById(admin.id)
            adminName = fullAdmin?.name || 'Admin'
        }

        await auditLogRepo.create({
            establishmentId: parseInt(establishmentId),
            adminId: admin?.id || null,
            adminName: adminName || 'Admin',
            action,
            entityType,
            entityId: entityId ?? null,
            entityName: entityName || '',
            details: details || ''
        })
    } catch (err) {
        console.error('[AuditLog] Falha ao registrar log (operação principal seguiu normalmente):', err.message)
    }
}
