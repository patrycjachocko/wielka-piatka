/**
 * BasePage - bazowa klasa Page Object
 * Zawiera wspolne metody dla wszystkich stron
 */
export class BasePage {
  constructor(page) {
    this.page = page;
    this.baseURL = 'http://localhost:5173';
  }

  /**
   * Nawiguje do podanej sciezki
   * @param {string} path - sciezka URL
   */
  async navigate(path = '/') {
    await this.page.goto(`${this.baseURL}${path}`);
  }

  /**
   * Czeka na zaladowanie strony
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Czeka okreslony czas (helper)
   * @param {number} ms - czas w ms
   */
  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }
}
