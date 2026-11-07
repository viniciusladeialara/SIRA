import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info, Upload, Download, Loader2, CheckCircle2 } from "lucide-react";

interface PartnerImportFlowProps {
  importStep: "idle" | "preview" | "validation" | "done";
  setImportStep: (step: any) => void;
  file: File | null;
  handleFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  preview: any[];
  importSummary: { alumnos: number; aulas: number; turma: string };
  importing: boolean;
  cancelImport: () => void;
  prepareImport: () => void;
  confirmImport: () => void;
  downloadTemplate: () => void;
}

export function PartnerImportFlow({
  importStep,
  setImportStep,
  file,
  handleFile,
  preview,
  importSummary,
  importing,
  cancelImport,
  prepareImport,
  confirmImport,
  downloadTemplate
}: PartnerImportFlowProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Guide Column */}
      <div className="space-y-6">
        <Card className="border-none shadow-sm bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <Info className="h-5 w-5" /> Guia de Importação
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-4 text-gray-700">
            <p>Siga os passos para garantir a integridade dos dados:</p>
            <ul className="space-y-3 list-none p-0">
              {[
                "Utilize o template padrão (XLS/XLSX)",
                "Preencha as colunas obrigatórias",
                "Use 'P' para Presença e 'F' para Falta",
                "Format de data: AAAA-MM-DD"
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">{i+1}</div>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            <Button 
              variant="outline" 
              className="w-full bg-white mt-4 border-primary/20 hover:bg-primary/10"
              onClick={downloadTemplate}
            >
              <Download className="h-4 w-4 mr-2" /> Baixar Template.xlsx
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Upload Column */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Selecione seu Arquivo</CardTitle>
            <CardDescription>Arraste ou selecione a planilha com os dados do diário escolar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <label className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-12 transition-all hover:border-primary/40 hover:bg-primary/5 group">
              <div className="h-16 w-16 bg-white rounded-full shadow-sm flex items-center justify-center transition-transform group-hover:scale-110">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-gray-900">
                  {file ? file.name : "Clique para fazer o upload"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Planilhas Excel (.xls, .xlsx) até 10MB</p>
              </div>
              <input type="file" accept=".xls,.xlsx" onChange={handleFile} className="hidden" />
            </label>

            {importStep === "preview" && preview.length > 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pré-visualização</h3>
                  <Badge variant="outline" className="text-xs font-normal">Mostrando primeiras linhas</Badge>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-inner bg-white">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                      <tr>
                        {Object.keys(preview[0]).map((key) => (
                          <th key={key as string} className="px-3 py-2">{key.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-3 py-2 truncate max-w-[120px]">{String(val || "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="ghost" onClick={cancelImport}>
                    Cancelar
                  </Button>
                  <Button onClick={prepareImport} className="px-8 shadow-lg shadow-primary/20">
                    Continuar para Validação
                  </Button>
                </div>
              </div>
            )}

            {importStep === "validation" && (
              <div className="space-y-6 animate-in zoom-in duration-300">
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                      <Info className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-amber-900">Conferência de Dados</h3>
                      <p className="text-sm text-amber-800 opacity-80">Revise o resumo antes de processar no banco de dados.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/50 p-4 rounded-xl border border-amber-200/50">
                      <p className="text-xs font-bold uppercase text-amber-700">Turma Detectada</p>
                      <p className="text-xl font-bold">{importSummary.turma}</p>
                    </div>
                    <div className="bg-white/50 p-4 rounded-xl border border-amber-200/50">
                      <p className="text-xs font-bold uppercase text-amber-700">Total de Alunos</p>
                      <p className="text-xl font-bold">{importSummary.alumnos}</p>
                    </div>
                    <div className="bg-white/50 p-4 rounded-xl border border-amber-200/50">
                      <p className="text-xs font-bold uppercase text-amber-700">Total de Aulas (Datas)</p>
                      <p className="text-xl font-bold">{importSummary.aulas}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setImportStep("preview")} disabled={importing}>
                    Voltar
                  </Button>
                  <Button onClick={confirmImport} disabled={importing} className="px-8 bg-black hover:bg-gray-800">
                    {importing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando Coleções...</>
                    ) : (
                      <><CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar e Gravar</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {importStep === "done" && (
              <div className="flex flex-col items-center gap-4 p-8 bg-emerald-50 rounded-2xl text-emerald-900 animate-in zoom-in duration-300">
                <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold">Importação concluída com sucesso!</h3>
                  <p className="text-sm opacity-80">Seus dados já estão disponíveis no painel de acompanhamento.</p>
                </div>
                <Button onClick={cancelImport} variant="outline" className="mt-2 text-emerald-700 border-emerald-200">
                  Realizar nova importação
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
