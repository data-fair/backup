<template>
  <v-app>
    <v-main>
      <v-app-bar
        density="comfortable"
        color="admin"
        title="Backups"
      >
        <v-spacer />
        <personal-menu />
      </v-app-bar>
      <RouterView v-if="session.user.value" />
      <ui-notif />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import personalMenu from '@data-fair/lib-vuetify/personal-menu.vue'
import uiNotif from '@data-fair/lib-vuetify/ui-notif.vue'

const session = useSession()
</script>
