import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs, query, where } from "firebase/firestore";
import { logger } from "@/lib/logger";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, GraduationCap, Users, Calendar, Wifi, Clock, BookOpen, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getHours, differenceInMinutes, format, parse, isWithinInterval, getDay, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";

import { usePermissions } from "@/hooks/usePermissions";
import { UserRole } from "@/lib/UserRoles";

// --- Tipagens para os dados de resumo ---
interface Environment { id: string; available: boolean; type: string; name: string; }
interface Professor { id: string; isActive: boolean; name: string; }
interface Class { id: string; period: string; name: string; environmentIds?: string[]; }
interface Schedule { id: string; startTime: any; endTime: any; teacherName: string; teacherId: string; roomName: string; roomId: string; classId: string; className?: string; }

// Define as cores para os gráficos de pizza e rosca
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

// --- Componente de Gráficos e Resumos do Dashboard ---
export function OverviewCharts() {
  const { userRole, userData, isUserAdmin } = usePermissions();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // Estado para o novo recurso de projeção
  const [projectionDate, setProjectionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [projectionStartTime, setProjectionStartTime] = useState('08:00');
  const [projectionEndTime, setProjectionEndTime] = useState('10:00');
  const [availableRooms, setAvailableRooms] = useState<Environment[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Estado para o filtro de semana do Gráfico 1
  const [selectedWeekDate, setSelectedWeekDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Estados para controle de carregamento otimizado
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    environments: false,
    professors: false,
    classes: false,
    schedules: false
  });

  // Cache local para evitar recarregamentos desnecessários
  const [cache, setCache] = useState<{
    environments?: Environment[];
    professors?: Professor[];
    classes?: Class[];
    schedules?: Schedule[];
    timestamp?: number;
  }>({});

  // Função para carregar dados com cache (otimização de custos)
  const loadDataWithCache = async (
    collectionName: string, 
    setter: (data: any[]) => void, 
    cacheKey: string,
    unitId: string
  ) => {
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
    const now = Date.now();
    const fullCacheKey = `${cacheKey}_${unitId}`;

    // Verificar cache primeiro
    if ((cache as any)[fullCacheKey] && cache.timestamp && (now - cache.timestamp) < CACHE_DURATION) {
      if (import.meta.env.DEV) {
        logger.debug(`Cache hit para ${collectionName} da unidade ${unitId}`);
      }
      setter((cache as any)[fullCacheKey] as any[]);
      return;
    }

    if (import.meta.env.DEV) {
      logger.debug(`Carregando ${collectionName} do Firestore para unidade ${unitId}`);
    }
    setLoadingStates(prev => ({ ...prev, [collectionName]: true }));

    try {
      // Filtrar por unidade para evitar carregar dados cruzados de outras unidades
      const q = query(collection(db, collectionName), where("unitId", "==", unitId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setter(data);

      // Atualizar cache
      setCache(prev => ({
        ...prev,
        [fullCacheKey]: data,
        timestamp: now
      }));
    } catch (error) {
      logger.error(`Erro ao carregar ${collectionName}`, { error });
    } finally {
      setLoadingStates(prev => ({ ...prev, [collectionName]: false }));
    }
  };

  // Carregar dados quando inicializar ou quando a unidade mudar
  useEffect(() => {
    const loadAllData = async () => {
      const selectedUnitId = userData?.selectedUnitId || "caceres";
      if (import.meta.env.DEV) {
        logger.debug('Iniciando carregamento otimizado dos dados do Overview para a unidade:', selectedUnitId);
      }
      await Promise.all([
        loadDataWithCache("rooms", setEnvironments, "environments", selectedUnitId),
        loadDataWithCache("teachers", setProfessors, "professors", selectedUnitId),
        loadDataWithCache("classes", setClasses, "classes", selectedUnitId),
        loadDataWithCache("schedules", setSchedules, "schedules", selectedUnitId)
      ]);
      setIsDataLoaded(true);
      if (import.meta.env.DEV) {
        logger.debug('Dados do Overview carregados com sucesso');
      }
    };

    loadAllData();
  }, [userData?.selectedUnitId]);

  // Função para recarregar dados quando necessário
  const refreshData = () => {
    if (import.meta.env.DEV) {
      logger.debug('Forçando recarregamento dos dados');
    }
    setCache({});
    setIsDataLoaded(false);
  };

  // --- Lógica para o novo recurso de projeção de salas ---
  const findAvailableRooms = () => {
    setIsSearching(true);
    const startDateTime = parse(`${projectionDate} ${projectionStartTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const endDateTime = parse(`${projectionDate} ${projectionEndTime}`, 'yyyy-MM-dd HH:mm', new Date());

    // Encontra as salas ocupadas
    const occupiedRoomIds = schedules
      .filter(schedule => {
        const scheduleStart = schedule.startTime.toDate();
        const scheduleEnd = schedule.endTime.toDate();
        // Verifica se há sobreposição de horários
        return isWithinInterval(startDateTime, { start: scheduleStart, end: scheduleEnd }) ||
          isWithinInterval(endDateTime, { start: scheduleStart, end: scheduleEnd });
      })
      .map(schedule => schedule.roomId);

    // Filtra para encontrar as salas disponíveis que não estão na lista de ocupadas e que não estão em manutenção
    const roomsAvailable = environments.filter(room => room.available !== false && !occupiedRoomIds.includes(room.id));
    setAvailableRooms(roomsAvailable);
    setIsSearching(false);
  };


  // --- Lógica para os dados dos gráficos ---

  // Agrega os 5 Ambientes com Mais Agendamentos
  const roomUsageCount = schedules.reduce((acc, schedule) => {
    acc[schedule.roomName] = (acc[schedule.roomName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedRoomUsage = Object.entries(roomUsageCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, usos]) => ({ name, usos }));

  // Agrega a carga horária por turma
  const classLoadData = schedules.reduce((acc, schedule) => {
    const durationInMinutes = differenceInMinutes(schedule.endTime.toDate(), schedule.startTime.toDate());
    const name = schedule.className || schedule.classId || "Turma Desconhecida";
    acc[name] = (acc[name] || 0) + durationInMinutes;
    return acc;
  }, {} as Record<string, number>);

  const sortedClassLoad = Object.entries(classLoadData)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, minutes]) => ({ name, hours: parseFloat((minutes / 60).toFixed(2)) }));

  // Agrega os horários por turno

  // Agrega os horários por turno
  const scheduleTurnoData = schedules.reduce((acc, schedule) => {
    const hour = getHours(schedule.startTime.toDate());
    if (hour >= 7 && hour < 13) acc.matutino = (acc.matutino || 0) + 1;
    else if (hour >= 13 && hour < 18) acc.vespertino = (acc.vespertino || 0) + 1;
    else acc.noturno = (acc.noturno || 0) + 1;
    return acc;
  }, { matutino: 0, vespertino: 0, noturno: 0 });

  const turnoData = [
    { name: 'Matutino', count: scheduleTurnoData.matutino, color: '#0088FE' },
    { name: 'Vespertino', count: scheduleTurnoData.vespertino, color: '#FFBB28' },
    { name: 'Noturno', count: scheduleTurnoData.noturno, color: '#FF8042' },
  ];

  // Lógica para o gráfico de Agendamentos por Dia da Semana
  const weekStart = startOfWeek(parse(selectedWeekDate || format(new Date(), 'yyyy-MM-dd'), 'yyyy-MM-dd', new Date()), { weekStartsOn: 1 }); // 1 = Segunda-feira
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const schedulesInWeek = schedules.filter(schedule => {
    const d = schedule.startTime.toDate();
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  });

  const schedulesByDay = schedulesInWeek.reduce((acc, schedule) => {
    const dayOfWeek = getDay(schedule.startTime.toDate());
    const dayName = WEEKDAYS[(dayOfWeek + 6) % 7];

    acc[dayName] = (acc[dayName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const schedulesByDayData = WEEKDAYS.map(dayName => ({
    name: dayName,
    agendamentos: schedulesByDay[dayName] || 0
  }));

  const pieChartLabelFormatter = ({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`;


  return (
    <PageLayout>
      <PageHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Bem-vindo, {userData?.name || 'Gestor'}</h2>
            <p className="text-muted-foreground">
              Aqui está o panorama atual da operação acadêmica.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
               {!isDataLoaded ? (
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                   <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full"></div>
                   Carregando...
                 </div>
               ) : (
                 <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                   <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                   Dados Atualizados
                 </div>
               )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={!isDataLoaded}
              className="shadow-sm"
            >
              <Clock className="h-4 w-4 mr-2" />
              Sincronizar
            </Button>
          </div>
        </div>
      </PageHeader>

      <PageContent>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Turmas em Execução</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.filter(s => {
                const today = format(new Date(), 'yyyy-MM-dd');
                const sDate = format(s.startTime.toDate(), 'yyyy-MM-dd');
                return sDate === today;
              }).reduce((acc, s) => {
                if (s.classId) acc.add(s.classId);
                return acc;
              }, new Set<string>()).size}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Ativas em {format(new Date(), 'dd/MM')}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alertas Operacionais</CardTitle>
            <Search className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {classes.filter(c => !c.environmentIds || c.environmentIds.length === 0).length}
            </div>
            <p className="text-xs text-muted-foreground">Turmas sem sala definida</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Turmas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classes.length}</div>
            <p className="text-xs text-muted-foreground">Turmas cadastradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Agendamentos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
            <p className="text-xs text-muted-foreground">Agendamentos criados</p>
          </CardContent>
        </Card>
      </div>

      {/* Bloco para Projeção de Salas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Projeção de Salas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="flex flex-col space-y-1">
              <Label htmlFor="projection-date">Data</Label>
              <Input id="projection-date" type="date" value={projectionDate} onChange={(e) => setProjectionDate(e.target.value)} />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="projection-start-time">Hora Início</Label>
              <Input id="projection-start-time" type="time" value={projectionStartTime} onChange={(e) => setProjectionStartTime(e.target.value)} />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="projection-end-time">Hora Fim</Label>
              <Input id="projection-end-time" type="time" value={projectionEndTime} onChange={(e) => setProjectionEndTime(e.target.value)} />
            </div>
            <Button onClick={findAvailableRooms} disabled={isSearching}>
              {isSearching ? 'Buscando...' : 'Buscar Salas'}
            </Button>
          </div>
          {availableRooms.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold text-md mb-2">Salas Disponíveis ({availableRooms.length}):</h3>
              <div className="flex flex-wrap gap-2">
                {availableRooms.map(room => (
                  <Button key={room.id} variant="outline" size="sm" disabled={!room.available}>
                    <MapPin className="h-4 w-4 mr-2" />
                    {room.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {availableRooms.length === 0 && !isSearching && (
            <p className="text-muted-foreground mt-4">Nenhuma sala disponível para o período selecionado ou a busca ainda não foi realizada.</p>
          )}
        </CardContent>
      </Card>

      {/* Bloco de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico 1: Agendamentos por Dia da Semana */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 gap-4">
            <CardTitle className="text-lg">Agendamentos na Semana do dia {format(parse(selectedWeekDate || format(new Date(), 'yyyy-MM-dd'), 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="week-filter" className="whitespace-nowrap text-sm text-muted-foreground mr-1">Filtrar a partir do dia:</Label>
              <Input
                id="week-filter"
                type="date"
                value={selectedWeekDate}
                onChange={(e) => setSelectedWeekDate(e.target.value)}
                className="w-auto h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={schedulesByDayData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="agendamentos"
                  fill="#0088FE"
                  name="Total de Agendamentos"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico 2: Top 5 Ambientes Mais Utilizados */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Ambientes Mais Utilizados</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sortedRoomUsage} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="usos" fill="#10b981" name="Agendamentos" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico 3: Carga Horária por Turma */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Turmas por Carga Horária</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sortedClassLoad} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Bar dataKey="hours" fill="#6366f1" name="Horas Agendadas" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico 4: Distribuição de Agendamentos por Turno (Donut) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Agendamentos por Turno</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={turnoData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  label={pieChartLabelFormatter}
                  paddingAngle={5}
                >
                  {turnoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      </PageContent>
    </PageLayout>
  );
}