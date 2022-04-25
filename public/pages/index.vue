<template>
  <v-container fluid>
    <v-navigation-drawer
      app
      clipped
      right
      light
    >
      <v-iframe
        :aspect-ratio="4"
        :src="`${env.notifyUrl}/embed/subscribe?key=backup:success,backup:failure&title=Succès,Échec&noSender=true`"
        class="pt-4"
      />
    </v-navigation-drawer>
    <v-layout column>
      <v-layout
        row
        wrap
        class="px-4"
      >
        <v-treeview
          v-if="directories"
          item-key="path"
          :items="directories"
          dense
          shaped
          :load-children="fetchChildren"
        >
          <template #label="{item}">
            {{ item.name || item.path }}<span v-if="item.size"> ({{ item.size }})</span>
          </template>
          <template #append="{item}">
            <v-btn
              v-if="!item.children"
              icon
              color="primary"
              :href="env.publicUrl + '/api/v1/directories/' + item.path"
            >
              <v-icon>mdi-download</v-icon>
            </v-btn>
          </template>
        </v-treeview>
      </v-layout>
    </v-layout>
  </v-container>
</template>

<script>
import { mapState } from 'vuex'
import VIframe from '@koumoul/v-iframe'

export default {
  name: 'Home',
  components: { VIframe },
  data: () => ({
    directories: null
  }),
  computed: {
    ...mapState(['env'])
  },
  watch: {},
  async created () {
    this.directories = await this.$axios.$get('api/v1/directories/')
  },
  methods: {
    async fetchChildren (item) {
      item.children = await this.$axios.$get(`api/v1/directories/${item.path}/`)
    }
  }
}
</script>
