import { BaseApiService } from './BaseApiService.js';

export class KonfiguracjaApiService extends BaseApiService {
  async getKonfiguracja() {
    const response = await this.get('/api/konfiguracja');
    return this.asJsonResult(response);
  }

  async saveKonfiguracja(payload) {
    const response = await this.post('/api/konfiguracja', {
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });
    return this.asJsonResult(response);
  }

  async addNadpisanie(payload) {
    const response = await this.post('/api/konfiguracja/nadpisanie', {
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });
    return this.asJsonResult(response);
  }

  async deleteNadpisanie(id) {
    const response = await this.delete(`/api/konfiguracja/nadpisanie/${id}`);
    return { response };
  }
}
