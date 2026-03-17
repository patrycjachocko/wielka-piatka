<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="text-center py-12">
    <h1 class="text-4xl font-bold text-gray-900 mb-4">Plan Zajec WI PB</h1>
    <p class="text-lg text-gray-600 mb-10">
      System planow zajec Wydzialu Informatyki Politechniki Bialostockiej
    </p>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
      <RouterLink
        to="/plan-studenta"
        class="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition"
      >
        <div class="text-3xl mb-3">&#128218;</div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Plan studenta</h2>
        <p class="text-gray-600 text-sm">
          Przegladaj plan zajec wedlug kierunku, semestru i specjalnosci
        </p>
      </RouterLink>

      <RouterLink
        to="/plan-nauczyciela"
        class="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition"
      >
        <div class="text-3xl mb-3">&#128104;&#8205;&#127891;</div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Plan nauczyciela</h2>
        <p class="text-gray-600 text-sm">
          Sprawdz plan zajec i konsultacje wybranego prowadzacego
        </p>
      </RouterLink>

      <RouterLink
        to="/moj-plan"
        class="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition"
      >
        <div class="text-3xl mb-3">&#11088;</div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Moj plan</h2>
        <p class="text-gray-600 text-sm">
          Spersonalizowany plan z wlasnymi grupami i powiadomieniami o zmianach
        </p>
      </RouterLink>
    </div>
  </div>
</template>
