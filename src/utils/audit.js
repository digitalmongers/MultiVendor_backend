import Logger from './logger.js';
import RequestContext from './context.js';

class AuditLogger {
  static log(action, target, meta = {}, level = 'info') {
    const context = RequestContext.getAll();
    const auditData = {
      action,
      target,
      ...meta,
      requestId: context.requestId,
      userId: context.userId, 
      ip: context.ip,
      userAgent: context.userAgent,
      timestamp: new Date().toISOString(),
    };
    Logger[level](`AUDIT: ${action}`, auditData);
  }

  static security(event, meta = {}) { this.log(event, 'SECURITY', meta, 'warn'); }
  static activity(action, userId, meta = {}) { this.log(action, 'USER_ACTIVITY', { ...meta, targetUserId: userId }); }
}

export default AuditLogger;
