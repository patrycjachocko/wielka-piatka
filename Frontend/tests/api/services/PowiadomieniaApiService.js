import { BaseApiService } from './BaseApiService.js';

export class PowiadomieniaApiService extends BaseApiService {
  async getAll() {
    const response = await this.get('/api/powiadomienia');
    return this.asJsonResult(response);
  }

  async getCount() {
    const response = await this.get('/api/powiadomienia/count');
    return this.asJsonResult(response);
  }

  async markAsRead(id) {
    const response = await this.put(`/api/powiadomienia/${id}/przeczytane`);
    return { response };
  }

  async markAllAsRead() {
    const response = await this.put('/api/powiadomienia/przeczytane-wszystkie');
    return { response };
  }
}
