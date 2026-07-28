/**
 * Notification affichée DANS l'onglet actif, et non dans un coin de la fenêtre.
 *
 * `ngx-toastr` positionne toujours ses toasts par rapport à la fenêtre : il ne
 * peut pas viser un onglet. On insère donc l'élément nous-mêmes dans le corps
 * de l'onglet actif, que Tabby marque d'une classe dédiée
 * (`tab-body.content-tab-active`, cf. `appRoot.component.pug`).
 *
 * Dépendance à un détail d'implémentation de Tabby : si cette classe change, la
 * notification disparaît silencieusement — d'où le repli prévu par l'appelant.
 */

const HOST_SELECTOR = 'tab-body.content-tab-active'

export function activeTabHost (): HTMLElement | null {
    return document.querySelector(HOST_SELECTOR)
}

/**
 * Affiche la notification dans l'onglet actif. Renvoie `false` si aucun onglet
 * n'est actif — au démarrage, le coffre est déverrouillé avant que le moindre
 * onglet n'existe.
 */
export function showInlineToast (message: string, durationMs = 4000): boolean {
    const host = activeTabHost()
    if (!host) {
        return false
    }

    // L'élément est positionné par rapport à l'onglet : encore faut-il que
    // celui-ci serve de référentiel. On ne force `relative` que s'il ne l'est
    // pas déjà, pour toucher au style de Tabby le moins possible — et cela ne
    // change rien au flux, seulement l'origine des coordonnées.
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
