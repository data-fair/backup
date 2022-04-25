<template>
  <v-app dark>
    <v-app-bar
      app
      dark
      scroll-off-screen
      clipped-right
    >
      <v-toolbar-title class="ml-3">
        <h1 class="headline">
          Sauvegardes
        </h1>
      </v-toolbar-title>

      <v-spacer />

      <!-- larger screens: navigation in toolbar -->
      <v-toolbar-items>
        <v-btn
          to="/"
          text
          color="primary"
          exact
        >
          Accueil
        </v-btn>

        <!-- Account specific menu -->
        <template v-if="session.initialized">
          <v-btn
            v-if="!user || !user.adminMode"
            color="primary"
            @click="setAdminMode(true)"
          >
            Se connecter / S'inscrire
          </v-btn>
          <v-menu
            v-else
            offset-y
            left
          >
            <template #activator="{on}">
              <v-btn
                text
                v-on="on"
              >
                {{ user.name }} ({{ user.organization ? user.organization.name : 'compte personnel' }})
              </v-btn>
            </template>
            <v-list>
              <template v-if="user.organizations && user.organizations.length">
                <v-subheader>Changer de compte</v-subheader>
                <v-list-tile
                  v-if="user.organization"
                  @click="switchOrganization()"
                >
                  <v-list-tile-title>Compte personnel</v-list-tile-title>
                </v-list-tile>
                <v-list-tile
                  v-for="organization in user.organizations.filter(o => !user.organization || (user.organization.id !== o.id))"
                  :key="organization.id"
                  @click="switchOrganization(organization.id)"
                >
                  <v-list-tile-title>Organisation {{ organization.name }}</v-list-tile-title>
                </v-list-tile>
                <v-divider />
              </template>
              <v-list-tile @click="logout">
                <v-list-tile-title>Se déconnecter</v-list-tile-title>
              </v-list-tile>
            </v-list>
          </v-menu>
        </template>
      </v-toolbar-items>
    </v-app-bar>
    <v-main v-if="user && user.adminMode">
      <nuxt />

      <v-snackbar
        v-if="notification"
        ref="notificationSnackbar"
        v-model="showSnackbar"
        :color="notification.type"
        :timeout="notification.type === 'error' ? 0 : 6000"
        class="notification"
        bottom
      >
        <div style="max-width: 85%;">
          <p>{{ notification.msg }}</p>
          <p
            v-if="notification.errorMsg"
            class="ml-3"
          >
            {{ notification.errorMsg }}
          </p>
        </div>
        <v-btn
          text
          icon
          @click.native="showSnackbar = false"
        >
          <v-icon>close</v-icon>
        </v-btn>
      </v-snackbar>
    </v-main>
    <v-footer class="pa-3">
      <v-spacer />
      <div>Powered by <a href="https://koumoul.com">Koumoul</a></div>
    </v-footer>
  </v-app>
</template>

<script>
import eventBus from '../event-bus'
const { mapState, mapActions } = require('vuex')

export default {
  data () {
    return {
      notification: null,
      showSnackbar: false
    }
  },
  computed: {
    ...mapState(['env']),
    session () {
      return this.$store.state.session
    },
    user () {
      return this.session.user
    },
    routePrefix () {
      return this.$route && this.$route.name && this.$route.name.split('-')[0]
    }
  },
  mounted () {
    eventBus.$on('notification', async notif => {
      this.showSnackbar = false
      await this.$nextTick()
      if (typeof notif === 'string') notif = { msg: notif }
      if (notif.error) {
        notif.type = 'error'
        notif.errorMsg = (notif.error.response && (notif.error.response.data || notif.error.response.status)) || notif.error.message || notif.error
      }
      this.notification = notif
      this.showSnackbar = true
    })
  },
  methods: mapActions('session', ['logout', 'setAdminMode', 'switchOrganization'])
}

</script>

<style lang="less">
body .application {
  font-family: 'Nunito', sans-serif;

  .logo-container {
    height: 100%;
    padding: 4px;
    margin-left: 4px !important;
    margin-right: 4px;

    img {
      height:100%;
    }
  }

  main.content {
    // background-color: white;
  }

  .main-toolbar {
    background-color: white;
    .v-toolbar__content {
      padding-left: 0;
    }
  }

  .actions-buttons {
    position: absolute;
    top: 76px;
    right: 8px;
    margin: 0;

    .v-btn {
      margin-bottom: 16px;
    }
  }

  .notification .v-snack__content {
    height: auto;
    p {
      margin-bottom: 4px;
      margin-top: 4px;
    }
  }
}

.event-finalize-end * {
  color: green !important;
}

.event-publication * {
  color: green !important;
}

.event-error {
  * {
    color: red !important;
  }
  .v-list__tile {
    height: auto;
  }
  p {
    margin-bottom: 0;
  }
}

iframe {
  background-color: transparent;
  border: none;
}
</style>
