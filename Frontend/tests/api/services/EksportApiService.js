import { BaseApiService } from './BaseApiService.js';

export class EksportApiService extends BaseApiService {
  async exportGlobalIcs() {
    const response = await this.get('/api/eksport/ics');
    const text = await this.toText(response);
    return { response, text };
  }
}
