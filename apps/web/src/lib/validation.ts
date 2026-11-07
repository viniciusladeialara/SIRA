/**
 * Input Validation Utilities - Validação Robusta de Entrada
 * 
 * Implementa boas práticas recomendadas pelo Google para validação de input:
 * - Validar e sanitizar todas as entradas
 * - Usar regex seguros
 * - Prevenir injection attacks
 * - Type-safe validation
 * 
 * @see https://google.github.io/styleguide/javaguide.html#s5.8-in-practice
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
 */

import { logger } from "./logger";

/**
 * Resultado estruturado de validação
 */
export interface ValidationResult<T = unknown> {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: T;
}

/**
 * Valida se uma string é um email válido
 * @param email - Email para validar
 * @returns true se válido
 * 
 * @example
 * validateEmail("user@example.com") // true
 * validateEmail("invalid-email") // false
 */
export function validateEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  
  // RFC 5322 simplified pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return false;
  }

  // Checagens adicionais
  if (email.length > 254) return false; // RFC 5321 limit
  if (email.startsWith(".") || email.endsWith(".")) return false;
  if (email.includes("..")) return false;

  return true;
}

/**
 * Valida se uma string é uma URL válida
 * @param url - URL para validar
 * @returns true se válido
 */
export function validateUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Valida se um valor é um número dentro de um intervalo
 * @param value - Valor para validar
 * @param min - Valor mínimo (inclusive)
 * @param max - Valor máximo (inclusive)
 * @returns true se válido
 */
export function validateNumberRange(
  value: unknown,
  min: number,
  max: number
): value is number {
  if (typeof value !== "number" || isNaN(value)) return false;
  return value >= min && value <= max;
}

/**
 * Valida se uma string está dentro de um comprimento específico
 * @param value - String para validar
 * @param minLength - Comprimento mínimo
 * @param maxLength - Comprimento máximo
 * @returns true se válido
 */
export function validateStringLength(
  value: unknown,
  minLength: number = 1,
  maxLength: number = 255
): value is string {
  if (typeof value !== "string") return false;
  const len = value.trim().length;
  return len >= minLength && len <= maxLength;
}

/**
 * Sanitiza uma string removendo caracteres perigosos
 * @param input - String para sanitizar
 * @returns String sanitizada
 * 
 * @example
 * sanitizeString("<script>alert('xss')</script>") // "scriptalert'xss'/script"
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";

  return (
    input
      // Remove HTML tags
      .replace(/<[^>]*>/g, "")
      // Remove caracteres de controle
      .replace(/[\x00-\x1F\x7F]/g, "")
      // Escape de entidades HTML
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .trim()
  );
}

/**
 * Valida um campo de texto obrigatório
 * @param value - Valor para validar
 * @param fieldName - Nome do campo (para mensagem de erro)
 * @returns Resultado estruturado
 */
export function validateRequiredField(
  value: unknown,
  fieldName: string = "Campo"
): ValidationResult<string> {
  if (!validateStringLength(value, 1)) {
    return {
      isValid: false,
      errors: [`${fieldName} é obrigatório`],
      warnings: [],
    };
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
    data: value.trim(),
  };
}

/**
 * Valida número de capacidade (ex: capacidade de sala)
 * @param value - Valor para validar
 * @param minCapacity - Capacidade mínima
 * @param maxCapacity - Capacidade máxima
 * @returns Resultado estruturado
 */
export function validateCapacity(
  value: unknown,
  minCapacity: number = 1,
  maxCapacity: number = 1000
): ValidationResult<number> {
  const result: ValidationResult<number> = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      result.isValid = false;
      result.errors.push("Capacidade deve ser um número válido");
      return result;
    }
    value = parsed;
  }

  if (!validateNumberRange(value, minCapacity, maxCapacity)) {
    result.isValid = false;
    result.errors.push(
      `Capacidade deve estar entre ${minCapacity} e ${maxCapacity}`
    );
    return result;
  }

  result.data = value as number;
  return result;
}

/**
 * Valida um intervalo de datas
 * @param startDate - Data de início
 * @param endDate - Data de fim
 * @returns Resultado estruturado
 */
export function validateDateRange(
  startDate: unknown,
  endDate: unknown
): ValidationResult<{ start: Date; end: Date }> {
  const result: ValidationResult<{ start: Date; end: Date }> = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  let start: Date;
  let end: Date;

  try {
    start = startDate instanceof Date ? startDate : new Date(String(startDate));
    end = endDate instanceof Date ? endDate : new Date(String(endDate));
  } catch {
    result.isValid = false;
    result.errors.push("Datas inválidas");
    return result;
  }

  if (isNaN(start.getTime())) {
    result.isValid = false;
    result.errors.push("Data de início é inválida");
    return result;
  }

  if (isNaN(end.getTime())) {
    result.isValid = false;
    result.errors.push("Data de fim é inválida");
    return result;
  }

  if (start > end) {
    result.isValid = false;
    result.errors.push("Data de início não pode ser após a data de fim");
    return result;
  }

  // Aviso se range é muito grande (maior que 1 ano)
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > 365) {
    result.warnings.push("Período muito longo (maior que 1 ano)");
  }

  result.data = { start, end };
  return result;
}

/**
 * Valida um array de elementos
 * @param array - Array para validar
 * @param minLength - Tamanho mínimo
 * @param maxLength - Tamanho máximo
 * @returns Resultado estruturado
 */
export function validateArray<T>(
  array: unknown,
  minLength: number = 1,
  maxLength: number = 1000
): ValidationResult<T[]> {
  const result: ValidationResult<T[]> = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (!Array.isArray(array)) {
    result.isValid = false;
    result.errors.push("Valor deve ser um array");
    return result;
  }

  if (array.length < minLength) {
    result.isValid = false;
    result.errors.push(`Array deve ter pelo menos ${minLength} elemento(s)`);
    return result;
  }

  if (array.length > maxLength) {
    result.isValid = false;
    result.errors.push(`Array não pode ter mais de ${maxLength} elemento(s)`);
    return result;
  }

  result.data = array as T[];
  return result;
}

/**
 * Valida um objeto contra um schema de propriedades obrigatórias
 * @param obj - Objeto para validar
 * @param requiredFields - Array de nomes de campos obrigatórios
 * @returns Resultado estruturado
 */
export function validateObjectShape<T extends Record<string, unknown>>(
  obj: unknown,
  requiredFields: (keyof T)[]
): ValidationResult<T> {
  const result: ValidationResult<T> = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (typeof obj !== "object" || obj === null) {
    result.isValid = false;
    result.errors.push("Entrada deve ser um objeto válido");
    return result;
  }

  for (const field of requiredFields) {
    if (!(field in obj) || obj[field as keyof typeof obj] === undefined || obj[field as keyof typeof obj] === null) {
      result.isValid = false;
      result.errors.push(`Campo obrigatório ausente: ${String(field)}`);
    }
  }

  if (result.isValid) {
    result.data = obj as T;
  }

  return result;
}

/**
 * Valida um conjunto de campos em um formulário
 * @param fields - Objeto com os campos
 * @param schema - Schema de validação
 * @returns Resultado estruturado com todos os erros
 * 
 * @example
 * const result = validateForm(
 *   { email: "user@example.com", name: "John" },
 *   { email: (v) => validateEmail(v), name: (v) => validateStringLength(v, 1, 100) }
 * )
 */
export function validateForm<T extends Record<string, unknown>>(
  fields: T,
  schema: Record<keyof T, (value: unknown) => boolean>
): ValidationResult<T> {
  const result: ValidationResult<T> = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  for (const [fieldName, validator] of Object.entries(schema)) {
    const value = fields[fieldName as keyof T];
    try {
      if (!validator(value)) {
        result.isValid = false;
        result.errors.push(`Validação falhou para ${fieldName}`);
      }
    } catch (error) {
      logger.warn("Erro na validação de campo", {
        field: fieldName,
        error: error instanceof Error ? error.message : String(error),
      });
      result.isValid = false;
      result.errors.push(`Erro ao validar ${fieldName}`);
    }
  }

  if (result.isValid) {
    result.data = fields;
  }

  return result;
}

export default {
  validateEmail,
  validateUrl,
  validateNumberRange,
  validateStringLength,
  sanitizeString,
  validateRequiredField,
  validateCapacity,
  validateDateRange,
  validateArray,
  validateObjectShape,
  validateForm,
};
