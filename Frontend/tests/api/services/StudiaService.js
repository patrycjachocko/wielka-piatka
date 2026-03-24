/**
 * StudiaService - serwis do obslugi kierunkow studiow
 * Wykorzystuje Playwright request API do prawdziwych zapytan HTTP
 *
 * Endpointy:
 * - GET /api/studia - lista kierunkow
 * - GET /api/studia/{id}/semestry - semestry dla kierunku
 * - GET /api/studia/{id}/specjalnosci?semestr=X - specjalnosci
 * - GET /api/studia/{id}/grupy?semestr=X&idSpec=Y - grupy
 */
export class StudiaService {
  constructor(request, baseURL) {
    this.request = request;
    this.baseURL = baseURL;
  }

  /**
   * Pobiera liste wszystkich kierunkow studiow
   * GET /api/studia
   * @returns {Promise<{response: APIResponse, data: Array}>}
   */
  async getAll() {
    const response = await this.request.get(`${this.baseURL}/api/studia`);

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
    }

    return { response, data };
  }

  /**
   * Pobiera semestry dla danego kierunku studiow
   * GET /api/studia/{id}/semestry
   * @param {number} idStudiow - ID kierunku
   * @returns {Promise<{response: APIResponse, data: Array}>}
   */
  async getSemestry(idStudiow) {
    const response = await this.request.get(`${this.baseURL}/api/studia/${idStudiow}/semestry`);

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
    }

    return { response, data };
  }

  /**
   * Pobiera specjalnosci dla danego kierunku i semestru
   * GET /api/studia/{id}/specjalnosci?semestr=X
   * @param {number} idStudiow - ID kierunku
   * @param {number} semestr - numer semestru
   * @returns {Promise<{response: APIResponse, data: Array}>}
   */
  async getSpecjalnosci(idStudiow, semestr) {
    const response = await this.request.get(
      `${this.baseURL}/api/studia/${idStudiow}/specjalnosci?semestr=${semestr}`
    );

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
    }

    return { response, data };
  }

  /**
   * Pobiera grupy dla danego kierunku, semestru i specjalnosci
   * GET /api/studia/{id}/grupy?semestr=X&idSpec=Y
   * @param {number} idStudiow - ID kierunku
   * @param {number} semestr - numer semestru
   * @param {number} idSpec - ID specjalnosci
   * @returns {Promise<{response: APIResponse, data: Array}>}
   */
  async getGrupy(idStudiow, semestr, idSpec) {
    const response = await this.request.get(
      `${this.baseURL}/api/studia/${idStudiow}/grupy?semestr=${semestr}&idSpec=${idSpec}`
    );

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
    }

    return { response, data };
  }
}
