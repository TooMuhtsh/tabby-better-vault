import { Component, HostBinding, Inject, Optional } from '@angular/core'
import { ConfigService, PlatformService } from 'tabby-core'

// Import en side-effect : `styleUrls` ne fonctionne pas pour un plugin tiers
// (piège hérité #3), les styles sont injectés en CSS globale.
import './settingsTab.component.scss'

import { BETTER_PANEL_EMBEDDED } from '../betterPanel'
import { I18nService } from '../i18n'
import { guardState, describeState, rearm } from '../keychainGuard'
import { log, warn, purge, LOG_PATH } from '../logger'
import { briefError, english } from '../messages'
import { keychainStatus, keychainRoundTrip, KeychainStatus } from '../osKeychain'
import {
    Settings,
    readSettings,
    writeSettings,
    computeExpiry,
    deleteToken,
    setProfilesExcluded,
    pruneExcludedProfiles,
} from '../store'

/** Un profil SSH de la config, avec son état d'exclusion au moment du calcul. */
interface ExclusionEntry {
    id: string
    /** Nom affiché — celui de la config, jamais traduit. */
    name: string
    excluded: boolean
}

/**
 * Un groupe de la config, ou le panier « sans groupe », avec ses membres.
 *
 * `name` et `source` s'excluent l'un l'autre : un vrai groupe porte le nom saisi
 * par l'utilisateur (`name`), qui ne se traduit pas ; le panier porte une chaîne
 * source anglaise (`source`), que le gabarit passe au pipe `translate` — même
 * convention que `weekdays` plus bas, et pour la même raison (traduire ici
 * figerait le libellé dans la langue active à l'ouverture de l'onglet).
 */
interface ExclusionGroup {
    /** Id du groupe dans la config, `null` pour le panier « sans groupe ». */
    id: string | null
    name: string | null
    source: string | null
    profiles: ExclusionEntry[]
    /** Ids des membres, tels que le raccourci de groupe les passe au store. */
    memberIds: string[]
    excludedCount: number
    allExcluded: boolean
}

/** @hidden */
@Component({
    // `templateUrl` ne fonctionne pas pour un plugin tiers — piège hérité #3.
    template: require('./settingsTab.component.pug'),
})
export class BetterVaultSettingsTabComponent {
    /**
     * `content-box` est la convention d'onglet racine de Tabby (padding +
     * largeur max). Embarqué comme sous-onglet par l'hôte Better Tabby (jeton
     * `BetterPanelEmbedded` présent dans l'injecteur), c'est l'hôte qui porte
     * la mise en page — on ne l'applique donc qu'en solo. Ce binding était
     * inopérant jusqu'ici (coquille : champ littéralement nommé `true`, de
     * valeur `undefined`) — l'appliquer réellement en solo est un changement
     * d'apparence à vérifier visuellement.
     */
    @HostBinding('class.content-box') contentBox: boolean

    settings: Settings
    /**
     * Résultat du diagnostic, ou `null` tant qu'il n'a pas été fait.
     *
     * Ce champ valait `keychainStatus()` en initialiseur, donc la sonde partait
     * à la construction du composant, sans égard pour `enabled`. Sur trousseau
     * verrouillé, ouvrir les réglages figeait l'interface — et ce panneau est le
     * SEUL endroit d'où l'on peut désactiver le plugin : le gel emportait avec
     * lui le moyen d'en sortir. Voir `keychainGuard.ts`.
     *
     * La sonde n'a donc plus lieu qu'à la demande, ou quand le plugin est déjà
     * activé : dans ce cas le pont l'a de toute façon déjà faite au démarrage,
     * et l'utilisateur a explicitement consenti à ce contact.
     */
    keychain: KeychainStatus | null = null

    /** Motif de `keychain`, déjà traduit — voir `setKeychain()`. */
    keychainReason = ''

    /**
     * Champs et non accesseurs : le gabarit les lit, et Angular réévalue une
     * expression de gabarit à CHAQUE cycle de détection — chaque frappe dans le
     * champ « nom de cette machine », chaque événement de souris. Un
     * `guardState()` derrière un `get` y ferait autant de `readFileSync`, dont
     * la plupart sur un fichier absent, donc autant d'exceptions levées puis
     * rattrapées. L'état ne change qu'aux endroits qui appellent
     * `refreshGuard()`.
     */
    suspended = false
    suspendedDetail = ''

    /**
     * Groupes et profils SSH avec leur état d'exclusion, RECALCULÉS à chaque
     * bascule par `buildExclusions()`.
     *
     * Modèle de vue précalculé, et non accesseurs, pour la raison donnée
     * ci-dessus à propos de `suspended` : le gabarit le parcourt, et Angular
     * réévalue une expression de gabarit à chaque cycle de détection. Dériver
     * « tous exclus / certains / aucun » derrière un `get` recompterait la liste
     * entière à chaque frappe et à chaque mouvement de souris, et une lecture de
     * `better-vault.json` avec.
     */
    exclusionGroups: ExclusionGroup[] = []

    logPath = LOG_PATH

    /**
     * `source` et non `label` : c'est la chaîne source anglaise, que le gabarit
     * passe au pipe `translate`. Traduire ici, à la construction, figerait ces
     * listes dans la langue active à l'ouverture de l'onglet — un changement de
     * locale ne les rattraperait qu'à la réouverture du panneau.
     */
    readonly weekdays = [
        { value: 1, source: 'Monday' },
        { value: 2, source: 'Tuesday' },
        { value: 3, source: 'Wednesday' },
        { value: 4, source: 'Thursday' },
        { value: 5, source: 'Friday' },
        { value: 6, source: 'Saturday' },
        { value: 0, source: 'Sunday' },
    ]

    readonly hours = Array.from({ length: 24 }, (_, h) => h)

    /**
     * Libellé du panier « sans groupe » de la section des exclusions.
     *
     * Même forme `{ source }` que `weekdays` et `retentions`, et pour les deux
     * mêmes raisons : la chaîne source anglaise voyage jusqu'au gabarit qui la
     * traduit (un changement de langue suit sans rouvrir l'onglet), et c'est
     * cette forme que `tools/lint-i18n.js` sait relever — un littéral posé au
     * milieu du code lui échapperait, et la traduction serait signalée morte.
     */
    readonly ungrouped = { source: 'Ungrouped' }

    readonly retentions = [
        { value: 30, source: '30 days' },
        { value: 90, source: '90 days' },
        { value: 365, source: '1 year' },
        { value: 0, source: 'Unlimited' },
    ]

    constructor (
        private platform: PlatformService,
        private config: ConfigService,
        private i18n: I18nService,
        @Optional() @Inject(BETTER_PANEL_EMBEDDED) embedded: unknown,
    ) {
        this.contentBox = !embedded
        this.settings = readSettings()
        this.refreshGuard()
        // La purge avant la construction du modèle : sans cela, l'affichage
        // décrirait un fichier que l'on vient de réécrire.
        this.pruneExclusions()
        this.buildExclusions()
        if (this.settings.enabled) {
            this.probeKeychain()
        }
    }

    private refreshGuard (): void {
        const state = guardState()
        this.suspended = state.suspended
        this.suspendedDetail = state.suspended ? this.i18n.message(describeState(state)) : ''
    }

    /**
     * Enregistre le résultat d'un diagnostic et en dérive le texte affiché.
     *
     * Champ et non accesseur, pour la raison donnée plus haut à propos de
     * `suspended` : un `get` serait réévalué à chaque cycle de détection, donc à
     * chaque frappe dans le champ « nom de cette machine ». `translate.instant()`
     * coûte moins qu'un `readFileSync`, mais rien n'oblige à le payer des
     * milliers de fois pour une valeur qui ne change qu'ici.
     *
     * Conséquence assumée, la même que pour `suspendedDetail` : changer la langue
     * de Tabby pendant que ce panneau est ouvert ne retraduit pas ce motif — il
     * faut rouvrir l'onglet. Le reste du panneau, lui, passe par le pipe
     * `translate` et suit immédiatement.
     */
    private setKeychain (status: KeychainStatus): void {
        this.keychain = status
        this.keychainReason = status.reason ? this.i18n.message(status.reason) : ''
    }

    /**
     * Diagnostic bon marché, à l'ouverture du panneau quand le plugin est déjà
     * actif. Ne prouve pas que le trousseau répond — voir `verifyKeychain()`.
     */
    private probeKeychain (): void {
        this.setKeychain(keychainStatus())
        // La sonde peut consigner le trousseau à son tour : l'affichage doit
        // suivre sans attendre une réouverture du panneau.
        this.refreshGuard()
    }

    /**
     * Vérification réelle, à la demande explicite de l'utilisateur.
     *
     * `keychainStatus()` ne convient PAS ici : sur Linux il se contente de lire
     * le nom du backend, mesuré comme ne touchant jamais le trousseau. Le
     * bouton annonçait donc « disponible » sur un trousseau verrouillé, effaçait
     * le témoin, et le démarrage suivant regelait — défaut D1 de la campagne du
     * 2026-07-29, sur le seul chemin de sortie offert à l'utilisateur.
     *
     * C'est le seul appel de ce panneau susceptible de bloquer, et c'est
     * délibéré : une vérification qui ne peut pas échouer ne vérifie rien. Sur
     * trousseau verrouillé, l'utilisateur voit l'invite d'authentification du
     * système et l'appel rend la main dès qu'il y répond.
     */
    verifyKeychain (): void {
        this.setKeychain(keychainRoundTrip())
        this.refreshGuard()

        // Tracé dans les deux sens : c'est le seul geste par lequel
        // l'utilisateur peut remettre le plugin en marche, son résultat doit
        // rester lisible après coup. En anglais, comme tout le journal — et via
        // `english()` plutôt que via le champ déjà traduit, sans quoi la ligne
        // suivrait la locale de l'utilisateur.
        const status = this.keychain as KeychainStatus
        if (status.verified) {
            log(`keychain verified from the settings — encryption round trip succeeded (${status.backend})`)
        } else {
            warn(`keychain verification from the settings failed — ${status.reason ? english(status.reason) : 'no reason given'}`)
        }
    }

    /**
     * Lève la consignation, puis vérifie réellement dans la foulée.
     *
     * Enchaîner les deux est délibéré : l'utilisateur ne clique ici qu'après
     * avoir déverrouillé son trousseau, et le laisser sur un état « suspendu »
     * levé mais non vérifié serait précisément le défaut D1 sous un autre nom.
     * Si le trousseau est en réalité toujours verrouillé, la vérification le
     * découvre — et si elle bloque, le témoin qu'elle vient de poser protège le
     * démarrage suivant.
     */
    rearmKeychain (): void {
        rearm()
        log('keychain guard lifted manually from the settings')
        this.refreshGuard()
        this.verifyKeychain()
    }

    openLog (): void {
        this.platform.openPath(LOG_PATH)
    }

    /**
     * Purge sur confirmation : le journal est le seul historique des ouvertures
     * du coffre, et l'effacer est irréversible. Un clic malencontreux ne doit
     * pas suffire.
     */
    async purgeLog (): Promise<void> {
        const result = await this.platform.showMessageBox({
            type: 'warning',
            message: this.i18n.t('Empty the log?'),
            detail: this.i18n.t('All history of vault openings, expiries and revocations will be lost. This action cannot be undone.'),
            buttons: [this.i18n.t('Empty'), this.i18n.t('Cancel')],
            defaultId: 1,
            cancelId: 1,
        })
        if (result.response === 0) {
            purge()
        }
    }

    get hasToken (): boolean {
        return !!this.settings.token
    }

    /**
     * Échéance du jeton actuellement enregistré, ou celle qu'aurait un jeton
     * créé maintenant — pour que l'utilisateur voie l'effet de son réglage
     * avant même d'avoir enregistré quoi que ce soit.
     */
    get expiryLabel (): string {
        if (this.settings.expiry.mode === 'never') {
            return this.i18n.t('no expiry')
        }
        const at = this.hasToken ? this.settings.tokenExpiresAt : computeExpiry(this.settings.expiry)
        if (!at) {
            return this.i18n.t('no expiry')
        }
        return this.i18n.date(at)
    }

    save (): void {
        this.persist(false)
    }

    /**
     * Changer la politique recalcule l'échéance du jeton déjà enregistré :
     * sans cela, passer de « jamais » à « chaque lundi » n'aurait aucun effet
     * tant que le mot de passe n'est pas ressaisi.
     */
    onExpiryChanged (): void {
        this.persist(true)
    }

    forgetNow (): void {
        deleteToken()
        // Purge délibérée de l'utilisateur : c'est l'événement le plus
        // significatif du cycle de vie, il doit laisser une trace.
        log('manual revocation from the settings — token deleted')
        this.settings = readSettings()
    }

    /**
     * Profils de `config.store`, TOUS TYPES confondus.
     *
     * `ConfigService.store` est typé `any` par Tabby et la clé peut manquer sur
     * une config neuve — d'où la vérification plutôt qu'un accès direct.
     */
    private configProfiles (): any[] {
        const profiles = this.config.store?.profiles
        return Array.isArray(profiles) ? profiles : []
    }

    /**
     * Retire les exclusions dont plus aucun profil ne porte l'id.
     *
     * ICI ET NULLE PART AILLEURS. La purge a besoin du référentiel COMPLET des
     * profils, donc d'une config chargée. Sur le chemin du déverrouillage, en
     * config chiffrée, la liste des profils est encore dans le blob (#V13) : le
     * référentiel y serait vide et la purge effacerait TOUTES les exclusions.
     * L'ouverture de ce panneau, elle, suppose Tabby démarré et la config lue.
     *
     * Le référentiel prend tous les types, alors que l'affichage ne montre que
     * les profils SSH : il sert à décider ce qui est ORPHELIN, pas ce qui est
     * montrable. Le restreindre à `ssh` supprimerait sans le dire l'exclusion
     * d'un profil dont le type aurait changé.
     */
    private pruneExclusions (): void {
        try {
            const ids = new Set(
                this.configProfiles()
                    .map(p => p?.id)
                    .filter((id): id is string => typeof id === 'string' && !!id),
            )
            const removed = pruneExcludedProfiles(ids)
            if (removed > 0) {
                log(`${removed} stale exclusion(s) dropped — no matching profile in the configuration`)
            }
        } catch (e) {
            // L'écriture peut échouer (disque plein, fichier tenu par un tiers).
            // Une entrée orpheline qui subsiste est sans effet — aucun profil ne
            // porte plus son id, `isProfileExcluded` ne la rencontre jamais. Rien
            // ici ne justifie d'empêcher l'onglet de s'ouvrir.
            warn(`could not prune stale exclusions — ${briefError(e)}`)
        }
    }

    /**
     * (Re)construit le modèle de vue des exclusions depuis la config et le
     * fichier de réglages.
     *
     * PÉRIMÈTRE : les profils `ssh` de `config.store.profiles`. Les profils
     * fabriqués par les providers (`built-in`) n'y figurent pas et sont hors
     * périmètre — décision de l'utilisateur, pas une limite technique.
     *
     * RIEN N'EST STOCKÉ PAR GROUPE, et c'est structurel : le fichier ne connaît
     * que des ids de PROFIL (voir `Settings.excludedProfiles`). Le groupe n'est
     * ici qu'un regroupement d'affichage doublé d'un raccourci d'action. Un
     * groupe re-parenté côté sidebar renaît sous un nouvel uuid (piège hérité
     * #12) : s'il portait l'exclusion, elle se perdrait sans un mot.
     */
    private buildExclusions (): void {
        const excluded = new Set(readSettings().excludedProfiles)

        // Noms de groupe par id : `profile.group` ne porte que l'id.
        const groupNames = new Map<string, string>()
        const groups = this.config.store?.groups
        if (Array.isArray(groups)) {
            for (const g of groups) {
                if (g?.id) {
                    groupNames.set(g.id, typeof g.name === 'string' && g.name ? g.name : g.id)
                }
            }
        }

        const buckets = new Map<string | null, ExclusionEntry[]>()
        for (const p of this.configProfiles()) {
            if (p?.type !== 'ssh' || typeof p.id !== 'string' || !p.id) {
                continue
            }
            // Un `group` qui ne désigne aucun groupe connu retombe dans le
            // panier : mieux vaut un profil rangé ailleurs qu'un profil
            // introuvable dans la liste.
            const key = typeof p.group === 'string' && groupNames.has(p.group) ? p.group : null
            const entry: ExclusionEntry = {
                id: p.id,
                name: typeof p.name === 'string' && p.name ? p.name : p.id,
                excluded: excluded.has(p.id),
            }
            const bucket = buckets.get(key)
            if (bucket) {
                bucket.push(entry)
            } else {
                buckets.set(key, [entry])
            }
        }

        const result: ExclusionGroup[] = []
        const push = (id: string | null, name: string | null, source: string | null): void => {
            const profiles = buckets.get(id)
            // Un groupe sans aucun profil SSH n'a rien à montrer : l'afficher
            // vide donnerait une ligne sur laquelle il n'y a rien à faire.
            if (!profiles?.length) {
                return
            }
            // Tri par nom : la liste sert à retrouver un profil, pas à refléter
            // l'ordre d'écriture de config.yaml.
            profiles.sort((a, b) => a.name.localeCompare(b.name))
            const excludedCount = profiles.filter(p => p.excluded).length
            result.push({
                id,
                name,
                source,
                profiles,
                memberIds: profiles.map(p => p.id),
                excludedCount,
                allExcluded: excludedCount === profiles.length,
            })
        }
        if (Array.isArray(groups)) {
            for (const g of groups) {
                if (g?.id) {
                    push(g.id, groupNames.get(g.id) ?? g.id, null)
                }
            }
        }
        // Le panier en dernier, comme dans la liste de profils de Tabby.
        push(null, null, this.ungrouped.source)

        this.exclusionGroups = result
    }

    /**
     * Bascule un profil.
     *
     * La cible vient du contrôle (`$event`) et non de `!entry.excluded` : le
     * modèle est un instantané, et il est reconstruit juste après depuis le
     * fichier — seule source de vérité, que le pont écrit aussi de son côté.
     */
    toggleProfile (entry: ExclusionEntry, excluded: boolean): void {
        setProfilesExcluded([entry.id], excluded)
        // Tracé comme les autres changements de comportement (voir `persist()`),
        // en anglais comme tout le journal. L'id de profil y est admis : il ne
        // dit rien du contenu du coffre.
        log(`profile ${entry.id} ${excluded ? 'excluded from' : 'included back into'} automatic unlocking`)
        this.buildExclusions()
    }

    /**
     * Raccourci de groupe : tous les membres exclus → tout réintégrer, sinon
     * tout exclure.
     *
     * L'action s'applique aux membres TELS QU'ILS SONT À CET INSTANT, et rien
     * n'en garde la trace : un profil ajouté au groupe ensuite ne sera pas
     * exclu. C'est la conséquence directe du choix de ne stocker que des ids de
     * profil, et le gabarit le dit à l'utilisateur.
     */
    toggleGroup (group: ExclusionGroup): void {
        const excluded = !group.allExcluded
        setProfilesExcluded(group.memberIds, excluded)
        log(`group ${group.id ?? 'ungrouped'} — ${group.memberIds.length} profile(s) ${excluded ? 'excluded from' : 'included back into'} automatic unlocking (${group.memberIds.join(', ')})`)
        this.buildExclusions()
    }

    /**
     * `trackBy` des deux listes : `buildExclusions()` remplace les objets à
     * chaque bascule, et sans cela Angular détruirait puis recréerait toutes les
     * lignes — donc les bascules elles-mêmes, en pleine animation.
     *
     * Fonctions sans `this` : Angular appelle un `trackBy` détaché de son
     * composant.
     */
    trackGroup (_index: number, group: ExclusionGroup): string {
        return group.id ?? ''
    }

    trackProfile (_index: number, entry: ExclusionEntry): string {
        return entry.id
    }

    /**
     * Écrit UNIQUEMENT les champs que ce panneau possède, fusionnés sur une
     * lecture fraîche du fichier.
     *
     * Ne jamais réécrire `this.settings` en bloc : le pont écrit le même fichier
     * de son côté, et cet objet date de l'ouverture de l'onglet. Un
     * enregistrement de mot de passe survenu depuis serait écrasé par le
     * `token: null` de notre instantané périmé — le mot de passe que
     * l'utilisateur vient de saisir disparaîtrait silencieusement. Symétrique­ment,
     * un jeton purgé par le pont serait ressuscité.
     */
    private persist (recomputeExpiry: boolean): void {
        const current = readSettings()
        const { debug, machineName, expiry, logRetentionDays } = this.settings

        // Second verrou, derrière le `*ngIf` du gabarit : sans trousseau
        // utilisable, ce panneau ne doit pas pouvoir activer le plugin — écrire
        // `enabled: true` promettrait un comportement inatteignable. L'interrupteur
        // est masqué dans ce cas, mais on ne fait pas reposer une garantie de
        // sécurité sur la seule absence d'un élément d'interface.
        //
        // Mais il ne doit pas non plus l'ÉTEINDRE. Le fichier est propre à la
        // machine, pas à la session : un utilisateur ayant activé le plugin
        // depuis une session où le trousseau fonctionne, puis ouvrant ce panneau
        // depuis une session dégradée, perdrait son réglage sans l'avoir
        // demandé. On laisse donc la valeur du fichier intacte.
        //
        // `keychain` vaut `null` tant que le diagnostic n'a pas eu lieu : c'est
        // aussi un cas où l'on ne doit pas pouvoir activer, pour la même raison.
        const enabled = this.keychain?.available ? this.settings.enabled : current.enabled
        const tokenExpiresAt = recomputeExpiry && current.token
            ? computeExpiry(expiry)
            : current.tokenExpiresAt
        writeSettings({ ...current, enabled, debug, machineName, expiry, logRetentionDays, tokenExpiresAt })

        // Trace les changements qui modifient le comportement du plugin, pas
        // les cosmétiques (le nom de machine n'en fait pas partie).
        if (enabled !== current.enabled) {
            log(`plugin ${enabled ? 'enabled' : 'disabled'} on this machine`)
        }
        if (debug !== current.debug) {
            log(`observation mode ${debug ? 'enabled' : 'disabled'}`)
        }
        if (recomputeExpiry && JSON.stringify(expiry) !== JSON.stringify(current.expiry)) {
            log(`expiry policy changed: ${this.describeExpiry(expiry)}`)
        }

        // Relecture : l'affichage reflète le fichier, pas notre instantané.
        this.settings = readSettings()
    }

    /**
     * Politique d'expiration en une phrase, pour le journal — donc en anglais et
     * non traduite, comme le reste du fichier. Elle réutilise `weekdays`, dont
     * les entrées portent justement la chaîne source anglaise.
     */
    private describeExpiry (expiry: Settings['expiry']): string {
        if (expiry.mode === 'never') {
            return 'no expiry'
        }
        if (expiry.mode === 'sliding') {
            return `${expiry.days} day(s) after entry`
        }
        const day = this.weekdays.find(d => d.value === expiry.weekday)?.source ?? '?'
        return `every ${day} at ${expiry.hour}:00`
    }
}
