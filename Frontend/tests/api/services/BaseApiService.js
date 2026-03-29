export class BaseApiService {
  constructor(request, baseURL) {
    this.request = request;
    this.baseURL = baseURL;
  }

  buildUrl(path) {
    return `${this.baseURL}${path}`;
  }

  async get(path, options = {}) {
    return this.request.get(this.buildUrl(path), options);
  }

  async post(path, options = {}) {
    return this.request.post(this.buildUrl(path), options);
  }

  async put(path, options = {}) {
    return this.request.put(this.buildUrl(path), options);
  }

  async delete(path, options = {}) {
    return this.request.delete(this.buildUrl(path), options);
  }

  async toJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  async toText(response) {
    try {
      return await response.text();
    } catch (error) {
      return '';
    }
  }

  async toBody(response) {
    try {
      return await response.body();
    } catch (error) {
      return null;
    }
  }

  async asJsonResult(response) {
    const data = await this.toJson(response);
    return { response, data };
  }
}
