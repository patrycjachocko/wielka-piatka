import { beforeEach, describe, expect, it } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'

import App from '@/App.vue'
import router from '@/router'

describe('App', () => {
  beforeEach(async () => {
    await router.push('/')
  })

  async function mountApp() {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router],
      },
    })

    await flushPromises()

    return wrapper
  }

  it('renders the default student schedule without weekend', async () => {
    const wrapper = await mountApp()

    expect(wrapper.text()).toContain('Plan zajęć')
    expect(wrapper.text()).toContain('Student')
    expect(wrapper.text()).toContain('Nauczyciel')
    expect(wrapper.text()).toContain('Informatyka I, semestr 1')
    expect(wrapper.text()).toContain('Poniedziałek-piątek')
    expect(wrapper.text()).toContain('poniedziałek')
    expect(wrapper.find('[data-testid="weekday-table"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weekend-table"]').exists()).toBe(false)
  })

  it('renders the part-time student schedule from friday to sunday', async () => {
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="branch-student-part-time"]').trigger('click')
    await wrapper.get('[data-testid="leaf-student-part-time-informatyka-2-sem-1"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="context-label"]').text()).toBe('Informatyka II, semestr 1')
    expect(wrapper.text()).toContain('Piątek-niedziela')
    expect(wrapper.find('[data-testid="weekday-table"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="weekend-table"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('piątek')
    expect(wrapper.text()).toContain('sobota')
    expect(wrapper.text()).toContain('niedziela')
    expect(wrapper.text()).not.toContain('poniedziałek')
    expect(wrapper.text()).toContain('Projektowanie aplikacji')
  })

  it('switches to the teacher schedule from the sidebar', async () => {
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="branch-teacher-section"]').trigger('click')
    await wrapper.get('[data-testid="leaf-teacher-piotr-kon"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="context-label"]').text()).toBe('Piotr Koń')
    expect(wrapper.get('[data-testid="leaf-teacher-piotr-kon"]').classes()).toContain('is-active')
    expect(wrapper.text()).toContain('Poniedziałek-niedziela')
    expect(wrapper.text()).toContain('Administrowanie systemami')
    expect(wrapper.find('[data-testid="weekday-table"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('niedziela')
    expect(wrapper.find('[data-testid="weekend-table"]').exists()).toBe(true)
  })
})
