import Vue from 'vue'
import Vuex from 'vuex'
import { sessionStoreBuilder } from '@data-fair/sd-vue'

Vue.use(Vuex)

export default () => {
  return new Vuex.Store({
    modules: {
      session: sessionStoreBuilder()
    },
    state: {
      env: {}
    },
    getters: {},
    mutations: {
      setAny (state, params) {
        Object.assign(state, params)
      }
    }
  })
}
