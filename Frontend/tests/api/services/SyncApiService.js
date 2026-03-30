import { BaseApiService } from './BaseApiService.js';

export class SyncApiService extends BaseApiService {
  async sync() {
    const response = await this.post('/api/sync');
    return this.asJsonResult(response);
  }
}
