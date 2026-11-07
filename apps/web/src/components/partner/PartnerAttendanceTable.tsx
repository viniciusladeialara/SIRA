import React from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen } from "lucide-react";

interface PartnerAttendanceTableProps {
  loading: boolean;
  filteredData: any[];
  turmasMetadata: any[];
  aulas: any[];
  isAdminOrUser: boolean;
}

export function PartnerAttendanceTable({
  loading,
  filteredData,
  turmasMetadata,
  aulas,
  isAdminOrUser
}: PartnerAttendanceTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Carregando registros...</p>
      </div>
    );
  }

  if (filteredData.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-20 text-center">
        <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
          <BookOpen className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Nenhum registro encontrado</h3>
          <p className="text-sm text-muted-foreground">Ajuste os filtros ou realize uma nova importação.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 border-b text-gray-800 font-bold">
          <tr>
            {isAdminOrUser && <th className="px-6 py-4">Escola</th>}
            <th className="px-6 py-4">Curso / Turma</th>
            <th className="px-6 py-4 text-center">Data</th>
            <th className="px-6 py-4">Aluno / RA</th>
            <th className="px-6 py-4 text-center">Status</th>
            <th className="px-6 py-4 text-center">Nota</th>
            <th className="px-6 py-4">Conteúdo / Obs</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filteredData.map((row) => {
            const meta = turmasMetadata.find(t => t.escolaId === row.escolaId && t.turmaId === row.turmaId);
            const lesson = aulas.find(a => a.escolaId === row.escolaId && a.turmaId === row.turmaId && a.dataAula === row.dataAula);
            
            return (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                {isAdminOrUser && <td className="px-6 py-4 font-medium text-gray-900">{meta?.escolaNome || "—"}</td>}
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{meta?.curso || "—"}</div>
                  <div className="text-xs text-muted-foreground">{row.turmaId}</div>
                </td>
                <td className="px-6 py-4 text-center text-gray-600">
                  {row.dataAula.split('-').reverse().join('/')}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{row.nomeAluno}</div>
                  <div className="text-xs font-mono text-muted-foreground">RA: {row.raAluno}</div>
                </td>
                <td className="px-6 py-4 text-center">
                  {row.status === 'P' ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none">Presente</Badge>
                  ) : row.status === 'F' ? (
                    <Badge variant="destructive" className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-none shadow-none">Falta</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">Não Informado</Badge>
                  )}
                </td>
                <td className="px-6 py-4 text-center font-medium text-gray-900">
                  {row.nota || "—"}
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-[200px] truncate text-xs text-gray-900 font-medium" title={lesson?.conteudo}>
                    {lesson?.conteudo || "—"}
                  </div>
                  <div className="max-w-[200px] truncate text-[10px] text-muted-foreground" title={lesson?.observacao}>
                    {lesson?.observacao}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
