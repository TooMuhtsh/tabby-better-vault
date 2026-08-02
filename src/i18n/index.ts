import { Inject, Injectable } from '@angular/core'
import { LocaleService, TranslateService } from 'tabby-core'

import { warn } from '../logger'
import { Message } from '../messages'
import fr_FR from './fr-FR'
import es_ES from './es-ES'
import de_DE from './de-DE'

/**
 * Traductions de l'interface du plugin, greffées sur le mécanisme de Tabby.
 *
 * POURQUOI PASSER PAR TABBY PLUTÔT QUE PAR NOTRE PROPRE MÉCANISME. Tabby monte
 * déjà `TranslateService` (ngx-translate) et le réexporte depuis `tabby-core` —
 * vérifié dans le bundle compilé, pas seulement dans les typings. Le pipe
 * `| translate` nous vient de `TranslateModule`, que le module racine de
 * `tabby-core` liste dans ses `exports` et que `src/index.ts` importe déjà.
 * Aucune dépendance à ajouter, et surtout : l'interface du plugin suit la langue
 * choisie dans Tabby au lieu d'en avoir une à elle.
 *
 * `@ngx-translate/core` n'est PAS une dépendance de ce projet et ne doit pas le
 * devenir : il est bundlé À L'INTÉRIEUR de `tabby-core` et n'existe nulle part
 * comme module résolvable à l'exécution. L'externaliser produirait un `require`
 * mort — même piège que `ngx-toastr` (#V8), à l'inverse près.
 *
 * LA CHAÎNE SOURCE ANGLAISE EST LA CLÉ. `LocaleService` charge des `.po` gettext
 * dont le msgid est la chaîne anglaise, et son `CustomMissingTranslationHandler`
 * compile la clé elle-même faute de traduction. Toute chaîne d'interface de ce
 * plugin est donc écrite en anglais dans le code, et les tables ci-dessous la
 * traduisent. C'est ce qui garantit qu'un utilisateur en turc voit de l'anglais
 * et non du français.
 */

/**
 * Langues couvertes, par code de locale Tabby.
 *
 * QUATRE LANGUES, PAS CINQ : la roadmap en visait cinq, l'utilisateur a ramené
 * le périmètre à quatre le 2026-08-01 — faute de donnée d'usage permettant de
 * choisir la cinquième. La mesure faite ce jour-là (taux de complétion des 24
 * `.po` livrés par Tabby) ne discrimine pas : dix-huit locales sont à 100 %.
 *
 * Les codes sont ceux de `LocaleService.allLanguages`, pas des codes de langue :
 * Tabby distingue `en-US` de `en-GB` et `pt-PT` de `pt-BR`. Une entrée sous
 * `fr` ne serait jamais trouvée.
 *
 * `en-US` n'y figure pas, et c'est voulu : nos chaînes sources SONT l'anglais.
 * Enregistrer une table identité n'ajouterait rien et ferait exister la locale
 * dans `translate.langs` — précisément ce que le commentaire de `merge()`
 * explique qu'il ne faut pas provoquer.
 */
const TABLES: Record<string, Record<string, string>> = {
    'fr-FR': fr_FR,
    'es-ES': es_ES,
    'de-DE': de_DE,
}

/**
 * Ce que ce plugin utilise de `TranslateService`, déclaré ici faute de types.
 *
 * MESURÉ, PAS SUPPOSÉ : `tabby-core` réexporte `TranslateService` depuis
 * `@ngx-translate/core`, qui n'est pas installé dans ce projet — et
 * `skipLibCheck` fait taire l'import non résolu plutôt que de le signaler. Le
 * type dégénère donc silencieusement en `any` : vérifié en compilant un appel à
 * une méthode inexistante, que TypeScript accepte sans broncher (`LocaleService`,
 * lui, est bien typé — il est défini dans `tabby-core`).
 *
 * Cette interface rend leur vérification aux trois seuls membres employés. Elle
 * couvre en particulier le troisième argument de `setTranslation()`, dont
 * l'oubli effacerait toutes les traductions de Tabby. Le prix à payer est
 * l'`@Inject()` explicite ci-dessous : `emitDecoratorMetadata` s'appuie sur le
 * type du paramètre pour choisir le jeton, et une interface s'efface à la
 * compilation.
 *
 * Installer `@ngx-translate/core` en devDependency donnerait les vrais types,
 * mais ouvrirait la porte à un import direct — que l'IDE proposerait
 * spontanément — dont le `require` serait introuvable à l'exécution (#V8). Son
 * absence est aussi ce qui protège : un tel import ne compile pas.
 */
interface TranslateApi {
    langs: string[]
    setTranslation (lang: string, translations: Record<string, string>, shouldMerge?: boolean): void
    instant (key: string, params?: Record<string, any>): string
}

@Injectable({ providedIn: 'root' })
export class I18nService {
    constructor (
        @Inject(TranslateService) private translate: TranslateApi,
        private locale: LocaleService,
    ) { }

    /**
     * Branche les traductions sur le cycle de vie de la locale de Tabby.
     *
     * Appelé depuis le constructeur du NgModule : aucun accès disque ni
     * trousseau ici, seulement un abonnement — cet endroit est sur le chemin de
     * démarrage de Tabby et n'admet rien qui puisse bloquer (voir `install()`
     * du pont).
     */
    install (): void {
        this.locale.localeChanged$.subscribe((lang: string) => this.merge(lang))

        // `localeChanged$` est un Subject, pas un BehaviorSubject : il ne rejoue
        // pas la dernière valeur. Si la locale a déjà été posée avant que ce
        // service n'existe, l'abonnement ci-dessus n'entendra plus rien jusqu'au
        // prochain changement de langue — et l'interface resterait en anglais
        // toute la session. D'où ce rattrapage, sous la condition qui le rend
        // sûr (voir `merge()`).
        const current = this.locale.getLocale()
        if (this.translate.langs.includes(current)) {
            this.merge(current)
        }
    }

    /**
     * Ajoute nos chaînes à celles de Tabby pour cette locale.
     *
     * LE TROISIÈME ARGUMENT N'EST PAS OPTIONNEL, MALGRÉ SA VALEUR PAR DÉFAUT.
     * `setTranslation(lang, table)` REMPLACE la table de la langue ; sans
     * `true`, ce plugin effacerait toutes les traductions de Tabby et
     * l'application entière basculerait en anglais.
     *
     * NE JAMAIS APPELER CECI POUR UNE LOCALE QUE TABBY N'A PAS ENCORE CHARGÉE.
     * `setTranslation()` appelle `updateLangs()`, qui inscrit la locale dans
     * `translate.langs` ; or `LocaleService.setLocale()` ne charge son `.po` que
     * `if (!translate.langs.includes(lang))`. Nous inscrire en premier ferait
     * sauter le chargement des traductions de Tabby — toute son interface, pas
     * seulement la nôtre, resterait en anglais pour la session. C'est pourquoi
     * l'appel n'a lieu que depuis `localeChanged$` (émis par `setLocale()` APRÈS
     * son chargement) ou sous test explicite de `langs`.
     */
    private merge (lang: string): void {
        const table = TABLES[lang]
        if (!table) {
            return
        }
        try {
            this.translate.setTranslation(lang, table, true)
        } catch (e) {
            // Une traduction qui ne se charge pas laisse l'anglais en place :
            // dégradé, mais utilisable. Rien ici ne justifie de casser Tabby.
            warn(`could not register ${lang} translations — ${String(e)}`)
        }
    }

    /**
     * Traduit dans le code TypeScript, là où le pipe `| translate` du gabarit
     * n'est pas disponible : libellés de listes, boîtes de dialogue natives,
     * notifications.
     */
    t (source: string, params?: Record<string, any>): string {
        return this.translate.instant(source, params)
    }

    /**
     * Traduit un message porteur de sa chaîne source, tel que ceux de
     * `messages.ts` — les seuls qui servent à la fois le journal et l'écran.
     *
     * Les `sourceParams` sont traduits avant substitution : sans cela, une
     * phrase française afficherait le nom d'opération resté en anglais.
     */
    message (message: Message): string {
        const params: Record<string, string> = { ...message.params }
        for (const [key, source] of Object.entries(message.sourceParams ?? {})) {
            params[key] = this.t(source)
        }
        for (const [key, at] of Object.entries(message.dateParams ?? {})) {
            params[key] = this.date(at)
        }
        return this.t(message.source, params)
    }

    /**
     * Date dans la locale de TABBY, et non dans celle du système.
     *
     * Les cinq sites qui affichaient une date appelaient `toLocaleString()` sans
     * argument : un utilisateur qui met Tabby en espagnol sur une machine
     * française lisait une interface espagnole ponctuée de dates françaises.
     *
     * POURQUOI PAS `TabbyFormatedDatePipe`, QUI EXISTE. Tabby le réexporte bien
     * (vérifié dans le bundle compilé) et il fait
     * `formatDate(date, 'medium', locale.getLocale())`. Mais `formatDate`
     * d'Angular exige que les données de la locale visée aient été déclarées par
     * `registerLocaleData()`, faute de quoi il lève « Missing locale data » —
     * seul `en-US` est fourni d'office. Or **Tabby n'appelle jamais
     * `registerLocaleData`** : mesuré dans `app.asar`, les seules occurrences y
     * sont la définition de la fonction par Angular lui-même. Emprunter ce pipe
     * ferait donc dépendre l'affichage d'une donnée absente, sur un chemin qui
     * sert notamment à expliquer une panne.
     *
     * `Intl`, lui, est natif à Chromium et n'a rien à enregistrer. Le format
     * diffère un peu de celui du reste de Tabby ; une exception au milieu d'un
     * message d'erreur coûterait plus cher que cette différence.
     */
    date (at: number | Date): string {
        const value = at instanceof Date ? at : new Date(at)
        try {
            return value.toLocaleString(this.locale.getLocale())
        } catch {
            // Étiquette de locale que l'`Intl` du moteur refuse : la date du
            // système reste préférable à une exception.
            return value.toLocaleString()
        }
    }
}
