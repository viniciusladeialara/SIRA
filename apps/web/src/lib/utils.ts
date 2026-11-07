import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUnitName(unitId: string): string {
  if (!unitId) return "";
  switch (unitId) {
    case 'caceres':
      return 'SENAI Cáceres';
    case 'varzea-grande':
      return 'SENAI Várzea Grande';
    case 'barra-do-bugres':
      return 'SENAI Barra do Bugres';
    default:
      // Fallback: converte slug/id (ex: "barra-do-bugres") para "SENAI Barra Do Bugres"
      const name = unitId
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return name.startsWith("SENAI") ? name : `SENAI ${name}`;
  }
}

/**
 * Formata nomes de exibição, convertendo e-mails para nomes limpos e amigáveis caso necessário.
 */
export function formatDisplayName(name?: string): string {
  if (!name || !name.trim()) return "Reserva Direta";
  if (name.includes("@")) {
    const prefix = name.split("@")[0];
    return prefix
      .replace(/[._-]/g, " ")
      .split(" ")
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  return name;
}
