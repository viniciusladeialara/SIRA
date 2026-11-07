const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Serviço de API cliente para o SIRA (Sistema Integrado de Recursos Acadêmicos)
 * Conecta com o backend NestJS + PostgreSQL + Redis
 */
export const apiService = {
  /**
   * Realiza requisições HTTP injetando o Token JWT e a Unidade ativa
   */
  async request(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const selectedUnitId = localStorage.getItem('selected_unit_id');

    // Normaliza o endpoint removendo prefixo redundante /api se houver
    let cleanEndpoint = endpoint;
    if (cleanEndpoint.startsWith('/api/')) {
      cleanEndpoint = cleanEndpoint.replace(/^\/api/, '');
    } else if (!cleanEndpoint.startsWith('/')) {
      cleanEndpoint = `/${cleanEndpoint}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(selectedUnitId ? { 'X-Unidade-Id': selectedUnitId } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(`${API_URL}${cleanEndpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail ||
        errorData.message ||
        errorData.error ||
        `Erro na requisição: ${response.statusText}`,
      );
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  },

  // --- Autenticação SIRA SQL ---
  async login(email: string, password: string) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, senha: password }),
    });

    const token = res.access_token || res.token;
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('access_token', token);
      if (res.refresh_token) {
        localStorage.setItem('refresh_token', res.refresh_token);
      }
      localStorage.setItem('user', JSON.stringify(res.user));
      if (res.user?.unidade?.id) {
        localStorage.setItem('selected_unit_id', res.user.unidade.id);
      }
    }
    return res;
  },

  async getCurrentUser() {
    return this.request('/auth/me');
  },

  async logout() {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      await this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch (err) {
      console.warn('Erro ao notificar logout no servidor:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  },

  // --- Módulo CORE (Usuários, Unidades e Perfis no PostgreSQL) ---
  async getUsuarios() {
    return this.request('/users');
  },

  async createUser(data: any) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUser(id: string, data: any) {
    return this.request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  async getUnits() {
    try {
      const data = await this.request('/units');
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {
      // Fallback seguro com unidades padrão
    }
    return [
      { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", code: "CBA", name: "SENAI Cuiabá", cidade: "Cuiabá" },
      { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12", code: "CAC", name: "SENAI Cáceres", cidade: "Cáceres" },
      { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13", code: "ROO", name: "SENAI Rondonópolis", cidade: "Rondonópolis" },
      { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14", code: "SNP", name: "SENAI Sinop", cidade: "Sinop" }
    ];
  },

  async getRoles() {
    return this.request('/roles');
  },

  // --- Módulo AMBIENTES / SALAS ---
  async getAmbientes() {
    try {
      return await this.request('/ambientes');
    } catch {
      return [];
    }
  },

  async getSalas() {
    return this.getAmbientes();
  },

  async getAmbienteById(id: string) {
    return this.request(`/ambientes/${id}`);
  },

  async createAmbiente(data: any) {
    return this.request('/ambientes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAmbiente(id: string, data: any) {
    return this.request(`/ambientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAmbiente(id: string) {
    return this.request(`/ambientes/${id}`, {
      method: 'DELETE',
    });
  },

  // --- Módulo CURSOS ---
  async getCursos() {
    try {
      return await this.request('/cursos');
    } catch {
      return [];
    }
  },

  async getCursoById(id: string) {
    return this.request(`/cursos/${id}`);
  },

  async createCurso(data: any) {
    return this.request('/cursos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCurso(id: string, data: any) {
    return this.request(`/cursos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteCurso(id: string) {
    return this.request(`/cursos/${id}`, {
      method: 'DELETE',
    });
  },

  // --- Módulo DOCENTES / PROFESSORES ---
  async getDocentes() {
    try {
      return await this.request('/docentes');
    } catch {
      return [];
    }
  },

  async getProfessores() {
    return this.getDocentes();
  },

  async getDocenteById(id: string) {
    return this.request(`/docentes/${id}`);
  },

  async createDocente(data: any) {
    return this.request('/docentes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateDocente(id: string, data: any) {
    return this.request(`/docentes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteDocente(id: string) {
    return this.request(`/docentes/${id}`, {
      method: 'DELETE',
    });
  },

  // --- Módulo TURMAS ---
  async getTurmas() {
    try {
      return await this.request('/turmas');
    } catch {
      return [];
    }
  },

  async getTurmaById(id: string) {
    return this.request(`/turmas/${id}`);
  },

  async createTurma(data: any) {
    return this.request('/turmas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTurma(id: string, data: any) {
    return this.request(`/turmas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteTurma(id: string) {
    return this.request(`/turmas/${id}`, {
      method: 'DELETE',
    });
  },

  // --- Módulo AGENDAMENTOS ---
  async getAgendamentos(params: Record<string, string> = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/agendamentos${query ? `?${query}` : ''}`);
    } catch {
      return [];
    }
  },

  async getAgendamentoById(id: string) {
    return this.request(`/agendamentos/${id}`);
  },

  async createAgendamento(data: any) {
    return this.request('/agendamentos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAgendamento(id: string, data: any) {
    return this.request(`/agendamentos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAgendamento(id: string) {
    return this.request(`/agendamentos/${id}`, {
      method: 'DELETE',
    });
  },

  // --- Módulo FERIADOS ---
  async getHolidays() {
    try {
      return await this.request('/calendar/holidays');
    } catch {
      return [];
    }
  },

  async createHoliday(data: { name: string; date: string | Date }) {
    return this.request('/calendar/holidays', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteHoliday(id: string) {
    return this.request(`/calendar/holidays/${id}`, {
      method: 'DELETE',
    });
  },

  // --- Módulo SUBSTITUIÇÕES & TROCAS ---
  async getSwaps() {
    try {
      return await this.request('/swaps');
    } catch {
      return [];
    }
  },

  async createSwap(data: any) {
    return this.request('/swaps', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateSwapStatus(id: string, status: string) {
    return this.request(`/swaps/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // --- Healthcheck ---
  async checkHealth() {
    try {
      return await this.request('/');
    } catch {
      return { status: 'down' };
    }
  },
};
