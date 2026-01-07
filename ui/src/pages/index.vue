<template>
  <v-container fluid>
    <v-navigation-drawer location="right">
      <d-frame
        :src="`/events/embed/subscribe?key=backup:success,backup:failure&title=${encodeURIComponent('Succès,Échec')}&noSender=true`"
        resize="yes"
      />
    </v-navigation-drawer>
    <v-layout column>
      <v-layout
        row
        wrap
        class="px-4"
      >
        <v-treeview
          v-if="fetchDirectories.data.value"
          :items="directories"
          :load-children="fetchChildren"
          item-value="path"
          item-title="path"
          open-on-click
          density="compact"
        >
          <template #title="{item}">
            {{ item.name || item.path }}<span v-if="item.size"> ({{ item.size }})</span>
          </template>
          <template #append="{item}">
            <v-btn
              v-if="!item.children"
              icon
              color="primary"
              size="small"
              variant="text"
              :href="'/backup/api/directories/' + item.path"
            >
              <v-icon :icon="mdiDownload" />
            </v-btn>
          </template>
        </v-treeview>
      </v-layout>
    </v-layout>
  </v-container>
</template>

<script setup lang="ts">
import '@data-fair/frame/lib/d-frame.js'
import clone from '@data-fair/lib-utils/clone.js'
import { mdiDownload } from '@mdi/js'

const fetchChildren = async (item: any) => {
  const children = await $fetch(`directories/${item.path}/`)
  item.children.push(...children)
}

const directories = ref([] as any[])
const fetchDirectories = useFetch<any[]>($apiPath + '/directories/')
watch(fetchDirectories.data, (dirs) => {
  if (dirs) directories.value = clone(dirs)
})

</script>
