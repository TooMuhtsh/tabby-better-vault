/**
 * Notification affichée DANS le panneau actif, et non dans un coin de la
 * fenêtre.
 *
 * `ngx-toastr` positionne toujours ses toasts par rapport à la fenêtre : il ne
 * peut pas viser un terminal. On insère donc l'élément nous-mêmes, au plus
 * près de ce que l'utilisateur regarde. Trois niveaux, du plus précis au plus
 * robuste (ROADMAP.html#toasts, ancrage revu le 2026-08-14) :
 *
 *   1. Le PANE focalisé, par l'injecteur : `AppService.activeTab` puis descente
 *      récursive `getFocusedTab()` — tout onglet terminal est déjà un
 *      `SplitTabComponent` à un pane (`openNewTab()` enveloppe d'office), donc
 *      ce chemin couvre aussi bien l'onglet entier que le sous-panneau d'une
 *      vue splittée, splits imbriqués compris. L'élément DOM sort de
 *      `viewContainerEmbeddedRef ?? hostView` → `rootNodes[0]`, exactement
 *      comme `splitTab.component.ts` le fait lui-même.
 *   2. Le pane focalisé, par le DOM : `split-tab > .child.focused` du corps
 *      d'onglet actif — le DERNIER trouvé, le plus profond en cas de splits
 *      imbriqués. (En mode « tout focalisé », tous les panes portent .focused :
 *      le chemin 1, univoque, reste la référence.)
 *   3. L'onglet actif entier (`tab-body.content-tab-active`), le comportement
 *      historique — si Tabby change ses classes, la notification se dégrade au
 *      lieu de disparaître.
 *
 * Dépendance à des détails d'implémentation de Tabby dans les trois cas : à
 * revérifier à chaque mise à jour, comme le pont lui-même.
 */

import type { AppService } from 'tabby-core'

const TAB_SELECTOR = 'tab-body.content-tab-active'
const PANE_SELECTOR = `${TAB_SELECTOR} split-tab > .child.focused`

function focusedPaneHost (app: AppService | null): HTMLElement | null {
    // 1. L'injecteur. Duck-typing sur getFocusedTab plutôt qu'instanceof :
    // moins cher, et le garde anti-cycle borne les splits imbriqués.
    let tab: any = app?.activeTab ?? null
    const seen = new Set<unknown>()
    while (tab && typeof tab.getFocusedTab === 'function' && !seen.has(tab)) {
        seen.add(tab)
        const inner = tab.getFocusedTab()
        if (!inner || inner === tab) {
            break
        }
        tab = inner
    }
    // `hostView` est typé ViewRef : le cast passe par `any`, et `rootNodes`
    // peut théoriquement être vide — tout l'accès reste optionnel.
    const ref: any = tab?.viewContainerEmbeddedRef ?? tab?.hostView
    const el = ref?.rootNodes?.[0] as HTMLElement | undefined
    // `isConnected` : après removeFromContainer()/detach(), la vue existe
    // encore mais vit dans un fragment hors document.
    if (el?.isConnected) {
        return el
    }

    // 2. Le DOM.
    const panes = document.querySelectorAll<HTMLElement>(PANE_SELECTOR)
    if (panes.length > 0) {
        return panes[panes.length - 1]
    }

    // 3. L'onglet entier.
    return document.querySelector(TAB_SELECTOR)
}

/**
 * Affiche la notification dans le panneau actif. Renvoie `false` si aucun
 * onglet n'est actif — au démarrage, le coffre est déverrouillé avant que le
 * moindre onglet n'existe.
 */
export function showInlineToast (message: string, app: AppService | null = null, durationMs = 4000): boolean {
    const host = focusedPaneHost(app)
    if (!host) {
        return false
    }

    // L'élément est positionné par rapport à son hôte : encore faut-il que
    // celui-ci serve de référentiel. Un pane de split est déjà en `absolute`
    // (splitTab.component.scss), le garde ne touche alors à rien ; il ne force
    // `relative` que sur un hôte resté `static` (onglet non splitté type page
    // de réglages) — sans effet sur le flux, seule l'origine des coordonnées
    // change. Ne jamais poser `relative` en dur : cela casserait la mise en
    // page des splits.
    if (getComputedStyle(host).position === 'static') {
        host.style.position = 'relative'
    }

    const el = document.createElement('div')
    el.className = 'better-vault-inline-toast'
    // textContent, jamais innerHTML : le message n'a pas à interpréter de balise.
    el.textContent = message
    host.appendChild(el)

    const remove = (): void => {
        el.classList.add('leaving')
        setTimeout(() => el.remove(), 200)
    }
    const timer = setTimeout(remove, durationMs)
    el.addEventListener('click', () => {
        clearTimeout(timer)
        remove()
    })

    return true
}
