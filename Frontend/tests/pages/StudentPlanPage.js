// StudentPlanPage - Page Object dla strony planu studenta
//Domyslny kierunek: stac. I st., kier. informatyka (index 1)
import { BasePage } from './BasePage.js';

export class StudentPlanPage extends BasePage {
  constructor(page) {
    super(page);

    // Selektory dropdownów
    this.kierunekSelect = page.locator('select').first();
    this.semestrSelect = page.locator('select').nth(1);
    this.specjalnoscSelect = page.locator('select').nth(2);
  }

  // Otwiera stronę planu studenta
  async open() {
    await this.navigate('/');
    await this.page.getByRole('link', { name: 'Plan studenta', exact: true }).click();
    await this.waitForPageLoad();
  }

  // Wybiera kierunek po nazwie (informatyka)
  async selectInformatyka() {
    await this.kierunekSelect.selectOption({ label: /informatyka/i });
    await this.wait(500);
  }

  // Wybiera kierunek po indeksie
  async selectKierunek(index = 1) {
    await this.kierunekSelect.selectOption({ index });
    await this.wait(500);
  }

  // Wybiera semestr po indeksie
  async selectSemestr(index = 1) {
    await this.semestrSelect.selectOption({ index });
    await this.wait(500);
  }

  // Wybiera specjalność po indeksie
  async selectSpecjalnosc(index = 1) {
    await this.specjalnoscSelect.selectOption({ index });
    await this.wait(1000);
  }

  // Wybiera pełną konfigurację filtrów
  async selectFullConfiguration(config = { kierunek: 1, semestr: 1, specjalnosc: 1 }) {
    await this.selectKierunek(config.kierunek);
    await this.selectSemestr(config.semestr);
    await this.selectSpecjalnosc(config.specjalnosc);
  }
}