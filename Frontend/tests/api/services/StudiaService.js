export class StudiaService {
  constructor(request, baseURL) {
    this.request = request;
    this.baseURL = baseURL;
  }

  // Pobiera wszystkie kierunki
  async getAll() {
    const response = await this.request.get(`${this.baseURL}/api/studia`);

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
    }

    return { response, data };
  }

  // Pobiera semestry dla kierunku
  async getSemestry(idStudiow) {
    const response = await this.request.get(`${this.baseURL}/api/studia/${idStudiow}/semestry`);

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
    }

    return { response, data };
  }

  // Pobiera specjalności (wymaga ID studiów i semestru)
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

  // Pobiera grupy (wymaga ID studiów, semestru i specjalności)
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