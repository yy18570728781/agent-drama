import type { App, Directive, Plugin } from 'vue'

type GlobalDirective = Directive<HTMLElement, unknown>

const directiveModules = import.meta.glob<GlobalDirective>('./modules/*.ts', {
  eager: true,
  import: 'default',
})

function getDirectiveName(modulePath: string): string {
  const fileName = modulePath.split('/').pop()
  if (!fileName) {
    throw new Error(`Unable to resolve directive name from module path: ${modulePath}`)
  }
  return fileName.replace(/\.ts$/, '')
}

const directivesPlugin: Plugin = {
  install(app: App): void {
    Object.entries(directiveModules).forEach(
      ([modulePath, directive]: [string, GlobalDirective]): void => {
        app.directive(getDirectiveName(modulePath), directive)
      },
    )
  },
}

export default directivesPlugin
