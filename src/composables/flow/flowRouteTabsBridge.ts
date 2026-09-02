import type { InjectionKey } from 'vue'

export interface FlowRouteTabActions {
  addTab: () => void
  closeTab: (tabId: string) => void
  openLibrary: () => void
  selectTab: (tabId: string) => void
}

export type FlowRouteTabActionRegistration = (actions: FlowRouteTabActions | null) => void

export const FLOW_ROUTE_TAB_REGISTER_KEY: InjectionKey<FlowRouteTabActionRegistration> = Symbol(
  'flow-route-tab-register',
)
