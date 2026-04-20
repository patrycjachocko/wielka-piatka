// BasePage - bazowa klasa Page Object; Zawiera wspolne metody dla wszystkich stron

export class BasePage {
  constructor(page) {
    this.page = page;
    this.baseURL = 'http://localhost:5173';
  }

  // Nawigacja do ścieżki
  async navigate(path = '/') {
    await this.page.goto(`${this.baseURL}${path}`);
  }

  // Oczekiwanie na brak aktywności sieci
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  // Helper do pauzy (ms)
  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }
}