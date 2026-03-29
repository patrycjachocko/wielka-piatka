import { BaseApiService } from './BaseApiService.js';

export class RozkladApiService extends BaseApiService {
  async getRozklad(idStudiow, semestr, idSpec) {
    const response = await this.get(
      `/api/rozklad?idStudiow=${idStudiow}&semestr=${semestr}&idSpec=${idSpec}`
    );
    return this.asJsonResult(response);
  }

  async getTeacherRozklad(idNauczyciela) {
    const response = await this.get(`/api/rozklad/nauczyciel/${idNauczyciela}`);
    return this.asJsonResult(response);
  }

  async getTeacherKonsultacje(idNauczyciela) {
    const response = await this.get(`/api/rozklad/nauczyciel/${idNauczyciela}/konsultacje`);
    return this.asJsonResult(response);
  }
}
