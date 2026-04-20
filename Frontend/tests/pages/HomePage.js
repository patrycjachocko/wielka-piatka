//HomePage - Page Object dla strony glownej
import { BasePage } from './BasePage.js';

export class HomePage extends BasePage {
  constructor(page) {
    super(page);

    // Selektory
    this.studentPlanLink = page.getByRole('link', { name: 'Plan studenta', exact: true });
    this.teacherPlanLink = page.getByRole('link', { name: 'Plan nauczyciela', exact: true });
  }

  // Otwiera stronę główną
  async open() {
    await this.navigate('/');
    await this.waitForPageLoad();
  }

  // Przejście do planu studenta
  async goToStudentPlan() {
    await this.studentPlanLink.click();
    await this.waitForPageLoad();
  }

  // Sprawdza widoczność linków nawigacyjnych
  async areNavigationLinksVisible() {
    const studentVisible = await this.studentPlanLink.isVisible();
    const teacherVisible = await this.teacherPlanLink.isVisible();
    return studentVisible && teacherVisible;
  }
}