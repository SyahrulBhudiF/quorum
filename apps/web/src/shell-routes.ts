import { SANDBOX_IDS } from '@quorum/simulation/sandbox-summary'
import { MENU_PAGES } from './game/menu-pages.ts'

/* The paths the game answers with its app shell. The title screen, `/`, is a real file. Any other
   path gets the 404 page from the static assets, so a mistyped URL is a 404 and not a second copy
   of the title screen. The Worker serves the shell for these paths (`runWorkerFirst` in
   `alchemy.run.ts` lists the same prefixes), and `src/game/route.ts` is where the app parses them. */

const SANDBOXES: ReadonlySet<string> = new Set([...SANDBOX_IDS, 'free'])
const MENUS: ReadonlySet<string> = new Set(MENU_PAGES)

export const isAppPath = (pathname: string): boolean => {
  const [, first = '', second, ...rest] = pathname.replace(/\/$/, '').split('/')
  if (rest.length > 0) return false
  if (second === undefined) return first === 'company' || MENUS.has(first)
  if (second === '') return false
  switch (first) {
    case 'sandbox':
      return SANDBOXES.has(second)
    case 'challenges':
    case 'room':
      return true
    default:
      return false
  }
}
