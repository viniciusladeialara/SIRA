/**
 * Logger Utility - Sistema de Logging Estruturado
 * 
 * Implementa boas práticas recomendadas pelo Google para logging:
 * - Não envia logs de debug para produção
 * - Estrutura logs para melhor rastreamento
 * - Mascarar informações sensíveis
 * - Compatível com Cloud Logging
 * 
 * @see https://google.github.io/styleguide/javaguide.html#s10-logging
 * @see https://cloud.google.com/logging/docs/agent/logging-config-syntax
 */

interface LogContext {
  userId?: string;
  functionName?: string;
  module?: string;
  requestId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  severity: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  context?: LogContext;
  timestamp: string;
  errorDetails?: {
    code: string;
    stack?: string;
    originalError?: unknown;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private isProduction = process.env.NODE_ENV === "production";

  /**
   * Mascara informações sensíveis de strings
   * @param text - Texto que pode conter informações sensíveis
   * @returns Texto com informações sensíveis ocultadas
   */
  private maskSensitiveData(text: string): string {
    // Mascara emails
    text = text.replace(
      /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
      "[EMAIL_REDACTED]"
    );
    
    // Mascara UIDs/IDs
    text = text.replace(/uid:\s*["']?[a-zA-Z0-9-]{20,}["']?/gi, "uid: [ID_REDACTED]");
    
    // Mascara tokens
    text = text.replace(/token:\s*["']?[a-zA-Z0-9-._~+/]+=*["']?/gi, "token: [TOKEN_REDACTED]");
    
    // Mascara chaves de API
    text = text.replace(
      /api[_-]?key:\s*["']?[a-zA-Z0-9-._~+/]+=*["']?/gi,
      "api_key: [API_KEY_REDACTED]"
    );

    return text;
  }

  /**
   * Formata um log entry de acordo com padrões do Google Cloud Logging
   */
  private formatLogEntry(entry: LogEntry): string {
    // Em produção, usar JSON estruturado para Cloud Logging
    if (this.isProduction) {
      return JSON.stringify({
        severity: entry.severity,
        message: this.maskSensitiveData(entry.message),
        timestamp: entry.timestamp,
        context: entry.context,
        errorDetails: entry.errorDetails,
      });
    }

    // Em desenvolvimento, usar formato legível
    const contextStr = entry.context
      ? ` [${Object.entries(entry.context)
          .map(([key, value]) => `${key}=${value}`)
          .join(", ")}]`
      : "";

    return `[${entry.severity}] ${entry.timestamp} ${entry.message}${contextStr}`;
  }

  /**
   * Log de nível DEBUG - apenas em desenvolvimento
   * @param message - Mensagem do log
   * @param context - Contexto adicional
   */
  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment) return;

    const entry: LogEntry = {
      severity: "DEBUG",
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    console.debug(this.formatLogEntry(entry));
  }

  /**
   * Log de nível INFO
   * @param message - Mensagem do log
   * @param context - Contexto adicional
   */
  info(message: string, context?: LogContext): void {
    const entry: LogEntry = {
      severity: "INFO",
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    console.log(this.formatLogEntry(entry));
  }

  /**
   * Log de nível WARNING
   * @param message - Mensagem do log
   * @param context - Contexto adicional
   */
  warn(message: string, context?: LogContext): void {
    const entry: LogEntry = {
      severity: "WARNING",
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    console.warn(this.formatLogEntry(entry));
  }

  /**
   * Log de nível ERROR
   * @param message - Mensagem do log
   * @param error - Erro capturado
   * @param context - Contexto adicional
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    const errorDetails = this.extractErrorDetails(error);
    const entry: LogEntry = {
      severity: "ERROR",
      message,
      context,
      timestamp: new Date().toISOString(),
      errorDetails,
    };

    // Em produção, enviar para serviço de monitoring
    if (this.isProduction && error instanceof Error) {
      this.reportToMonitoring(entry);
    }

    console.error(this.formatLogEntry(entry));
  }

  /**
   * Log de nível CRITICAL - problemas graves
   * @param message - Mensagem do log
   * @param error - Erro capturado
   * @param context - Contexto adicional
   */
  critical(message: string, error?: unknown, context?: LogContext): void {
    const errorDetails = this.extractErrorDetails(error);
    const entry: LogEntry = {
      severity: "CRITICAL",
      message,
      context,
      timestamp: new Date().toISOString(),
      errorDetails,
    };

    // Sempre reportar problemas críticos
    if (this.isProduction) {
      this.reportToMonitoring(entry);
    }

    console.error(this.formatLogEntry(entry));
  }

  /**
   * Extrai informações estruturadas de um erro
   */
  private extractErrorDetails(error: unknown): LogEntry["errorDetails"] | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        code: error.name,
        stack: this.isDevelopment ? error.stack : undefined,
        originalError: this.isDevelopment ? error.message : undefined,
      };
    }

    return {
      code: "UNKNOWN",
      originalError: this.isDevelopment ? String(error) : undefined,
    };
  }

  /**
   * Envia logs críticos para serviço de monitoring (ex: Sentry, Google Cloud Error Reporting)
   * Esta função deve ser implementada de acordo com seu serviço de monitoramento
   */
  private reportToMonitoring(entry: LogEntry): void {
    // TODO: Integrar com Sentry, Google Cloud Error Reporting, ou outro serviço
    // Exemplo para Sentry:
    // if (window.Sentry) {
    //   window.Sentry.captureMessage(entry.message, entry.severity.toLowerCase());
    // }
  }

  /**
   * Cria um logger com contexto pré-configurado
   * @param functionName - Nome da função/módulo
   * @param userId - ID do usuário (opcional)
   * @returns Logger com contexto
   */
  createContextLogger(
    functionName: string,
    userId?: string
  ): {
    debug: (message: string, context?: Omit<LogContext, "functionName" | "userId">) => void;
    info: (message: string, context?: Omit<LogContext, "functionName" | "userId">) => void;
    warn: (message: string, context?: Omit<LogContext, "functionName" | "userId">) => void;
    error: (message: string, error?: unknown, context?: Omit<LogContext, "functionName" | "userId">) => void;
    critical: (message: string, error?: unknown, context?: Omit<LogContext, "functionName" | "userId">) => void;
  } {
    const baseContext: LogContext = { functionName, userId };

    return {
      debug: (msg, ctx) => this.debug(msg, { ...baseContext, ...ctx }),
      info: (msg, ctx) => this.info(msg, { ...baseContext, ...ctx }),
      warn: (msg, ctx) => this.warn(msg, { ...baseContext, ...ctx }),
      error: (msg, err, ctx) => this.error(msg, err, { ...baseContext, ...ctx }),
      critical: (msg, err, ctx) => this.critical(msg, err, { ...baseContext, ...ctx }),
    };
  }
}

// Exportar instância singleton
export const logger = new Logger();

export default logger;
