import { expect, test } from '@playwright/test'

test.describe('schedule planner', () => {
  test('renders desktop layout and switches to teacher schedule', async ({ page }) => {
    const consoleErrors: string[] = []

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    await page.setViewportSize({ width: 1440, height: 1024 })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Plan zajęć' })).toBeVisible()
    await expect(page.getByTestId('context-label')).toHaveText('Informatyka I, semestr 1')

    const sidebar = page.getByTestId('sidebar-panel')
    const board = page.getByTestId('board-panel')
    const sidebarBox = await sidebar.boundingBox()
    const boardBox = await board.boundingBox()

    expect(sidebarBox).not.toBeNull()
    expect(boardBox).not.toBeNull()

    const sidebarShare = sidebarBox!.width / (sidebarBox!.width + boardBox!.width)
    expect(sidebarShare).toBeGreaterThan(0.2)
    expect(sidebarShare).toBeLessThan(0.32)

    await page.getByTestId('branch-teacher-section').click()
    await page.getByTestId('leaf-teacher-piotr-kon').click()

    await expect(page.getByTestId('context-label')).toHaveText('Piotr Koń')
    await expect(page.getByText('Poniedziałek-niedziela')).toBeVisible()
    await expect(page.getByText('Administrowanie systemami')).toBeVisible()
    await expect(page.getByTestId('weekday-table')).toBeVisible()
    await expect(page.getByTestId('weekend-table')).toBeVisible()
    expect(consoleErrors).toEqual([])
  })

  test('stacks the layout on mobile and keeps the board scrollable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    await page.getByTestId('branch-student-part-time').click()
    await page.getByTestId('leaf-student-part-time-informatyka-2-sem-1').click()

    const sidebar = page.getByTestId('sidebar-panel')
    const board = page.getByTestId('board-panel')
    const sidebarBox = await sidebar.boundingBox()
    const boardBox = await board.boundingBox()

    expect(sidebarBox).not.toBeNull()
    expect(boardBox).not.toBeNull()
    expect(boardBox!.y).toBeGreaterThan(sidebarBox!.y + sidebarBox!.height - 1)

    await expect(page.getByText('Piątek-niedziela')).toBeVisible()
    await expect(page.getByTestId('weekday-table')).toHaveCount(0)
    await expect(page.getByTestId('weekend-table')).toBeVisible()
    await expect(page.getByText('piątek')).toBeVisible()
    await expect(page.getByText('sobota')).toBeVisible()
    await expect(page.getByText('poniedziałek')).toHaveCount(0)
    await expect(page.getByText('Projektowanie aplikacji')).toBeVisible()

    const isHorizontallyScrollable = await page.getByTestId('schedule-board-scroll').evaluate((node) => {
      return node.scrollWidth > node.clientWidth
    })

    expect(isHorizontallyScrollable).toBe(true)
  })
})
