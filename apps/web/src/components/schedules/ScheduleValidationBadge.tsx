import React from 'react';
import { Flag, XCircle } from "lucide-react";

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

interface ScheduleValidationBadgeProps {
    validationResult: ValidationResult | null;
    isValidating: boolean;
}

export function ScheduleValidationBadge({ validationResult, isValidating }: ScheduleValidationBadgeProps) {
    if (!validationResult && !isValidating) return null;

    return (
        <div className="border-t pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h4 className="text-sm font-semibold mb-2">Validação de Horários</h4>
            {isValidating ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Validando horários...
                </div>
            ) : (
                validationResult && (
                    <div className="space-y-2">
                        {validationResult.errors.length > 0 && (
                            <div className="space-y-1">
                                {validationResult.errors.map((error, index) => (
                                    <div key={index} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                                        <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {validationResult.warnings.length > 0 && (
                            <div className="space-y-1">
                                {validationResult.warnings.map((warning, index) => (
                                    <div key={index} className="flex items-start gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
                                        <Flag className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span>{warning}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {validationResult.isValid && validationResult.errors.length === 0 && validationResult.warnings.length === 0 && (
                            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                                <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                                    <div className="h-2 w-2 rounded-full bg-white"></div>
                                </div>
                                <span>Horários validados com sucesso!</span>
                            </div>
                        )}
                    </div>
                )
            )}
        </div>
    );
}
