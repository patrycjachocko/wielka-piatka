/**
 * StudentPlanPage - Page Object dla strony planu studenta
 * Obsluguje wybor kierunku, semestru, specjalnosci i grup
 *
 * Domyslny kierunek: stac. I st., kier. informatyka (index 1)
 */
import { BasePage } from './BasePage.js';

export class StudentPlanPage extends BasePage {
  constructor(page) {
    super(page);

    // Selektory - dropdowny
    this.kierunekSelect = page.locator('select').first();
    this.semestrSelect = page.locator('select').nth(1);
    this.specjalnoscSelect = page.locator('select').nth(2);
  }

  /**
   * Wybiera kierunek "stac. I st., kier. informatyka"
   */
  async selectInformatyka() {
    await this.kierunekSelect.selectOption({ label: /informatyka/i });
    await this.wait(500);
  }

  /**
   * Otwiera strone planu studenta
   */
  async open() {
    await this.navigate('/');
    await this.page.getByRole('link', { name: 'Plan studenta', exact: true }).click();
    await this.waitForPageLoad();
  }

  /**
   * Wybiera kierunek studiow (pierwszy dostepny lub po indeksie)
   * @param {number} index - indeks kierunku (domyslnie 1 - pierwszy)
   */
  async selectKierunek(index = 1) {
    await this.kierunekSelect.selectOption({ index });
    await this.wait(500);
  }

  /**
   * Wybiera semestr
   * @param {number} index - indeks semestru
   */
  async selectSemestr(index = 1) {
    await this.semestrSelect.selectOption({ index });
    await this.wait(500);
  }

  /**
   * Wybiera specjalnosc
   * @param {number} index - indeks specjalnosci
   */
  async selectSpecjalnosc(index = 1) {
    await this.specjalnoscSelect.selectOption({ index });
    await this.wait(1000);
  }

  /**
   * Wybiera pelna konfiguracje (kierunek, semestr, specjalnosc)
   * @param {object} config - konfiguracja {kierunek, semestr, specjalnosc}
   */
  async selectFullConfiguration(config = { kierunek: 1, semestr: 1, specjalnosc: 1 }) {
    await this.selectKierunek(config.kierunek);
    await this.selectSemestr(config.semestr);
    await this.selectSpecjalnosc(config.specjalnosc);
  }
}
