import { BaseApiService } from './BaseApiService.js';

export class SchedulesApiService extends BaseApiService {
  async createSchedule(payload) {
    const response = await this.post('/api/schedules', {
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });
    return this.asJsonResult(response);
  }

  async listSchedules() {
    const response = await this.get('/api/schedules');
    return this.asJsonResult(response);
  }

  async getSchedule(id) {
    const response = await this.get(`/api/schedules/${id}`);
    return this.asJsonResult(response);
  }

  async deleteSchedule(id) {
    const response = await this.delete(`/api/schedules/${id}`);
    return { response };
  }

  async getAvailableGroups(id, idPrzedmiotu, rodzaj) {
    const response = await this.get(
      `/api/schedules/${id}/available-groups?idPrzedmiotu=${idPrzedmiotu}&rodzaj=${encodeURIComponent(rodzaj)}`
    );
    return this.asJsonResult(response);
  }

  async saveOverrides(id, overrides, ignoredConflictIds = []) {
    const response = await this.put(`/api/schedules/${id}/overrides`, {
      data: {
        overrides,
        ignoredConflictIds,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    return this.asJsonResult(response);
  }

  async confirmSchedule(id) {
    const response = await this.put(`/api/schedules/${id}/confirm`);
    return this.asJsonResult(response);
  }

  async simulateUpdate(id) {
    const response = await this.post(`/api/schedules/${id}/simulate-update`);
    return this.asJsonResult(response);
  }

  async exportSchedule(id) {
    const response = await this.get(`/api/schedules/${id}/export`);
    const text = await this.toText(response);
    return { response, text };
  }
}
