import { BaseApiService } from './BaseApiService.js';

export class NauczycieleApiService extends BaseApiService {
  async getNauczyciele() {
    const response = await this.get('/api/nauczyciele');
    return this.asJsonResult(response);
  }
}
