import { BaseApiService } from './BaseApiService.js';

export class StudiaApiService extends BaseApiService {
  async getStudia() {
    const response = await this.get('/api/studia');
    return this.asJsonResult(response);
  }

  async getSemestry(idStudiow) {
    const response = await this.get(`/api/studia/${idStudiow}/semestry`);
    return this.asJsonResult(response);
  }

  async getSpecjalnosci(idStudiow, semestr) {
    const response = await this.get(`/api/studia/${idStudiow}/specjalnosci?semestr=${semestr}`);
    return this.asJsonResult(response);
  }

  async getGrupy(idStudiow, semestr, idSpec) {
    const response = await this.get(
      `/api/studia/${idStudiow}/grupy?semestr=${semestr}&idSpec=${idSpec}`
    );
    return this.asJsonResult(response);
  }
}
