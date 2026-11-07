import React from "react";
import { AlertCircle, AlertTriangle, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ScheduleConflictPanelProps {
  validationResult: ValidationResult | null;
  isValidating: boolean;
}

export function ScheduleConflictPanel({ validationResult, isValidating }: ScheduleConflictPanelProps) {
  if (isValidating) {
    return (
      <div className="flex items-center justify-center p-4 space-x-2 text-sm text-muted-foreground animate-pulse">
        <AlertCircle className="h-4 w-4" />
        <span>Validando conflitos...</span>
      </div>
    );
  }

  if (!validationResult) return null;

  const { errors, warnings } = validationResult;

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
        <AlertDescription className="text-green-800 dark:text-green-400 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          Nenhum conflito detectado. Horário disponível.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Conflitos Críticos</AlertTitle>
          <AlertDescription>
            <ScrollArea className="h-[100px] mt-2">
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx} className="text-xs">{error}</li>
                ))}
              </ul>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 text-amber-900 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Avisos</AlertTitle>
          <AlertDescription>
            <ScrollArea className="h-[80px] mt-2">
              <ul className="list-disc list-inside space-y-1">
                {warnings.map((warning, idx) => (
                  <li key={idx} className="text-xs">{warning}</li>
                ))}
              </ul>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
